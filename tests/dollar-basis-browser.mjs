// Kept outside the default unit-test inventory because it launches a real browser.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
let server;
let chrome;
let profile;
let cdp;
let baseUrl;
let evidenceFinancialYear;
let browserMessages = [];
const csp = JSON.parse(await readFile(path.join(root,"vercel.json"),"utf8")).headers[0].headers.find(h=>h.key==="Content-Security-Policy").value;
import aiHandler from "../api/ai-insights.js";
import payslipHandler from "../api/payslip-extract.js";

const publishMobileEvidence=process.env.FFS_CAPTURE_MOBILE_EVIDENCE==='1';
const mobileReviewDirectory=path.join(root,publishMobileEvidence?'docs/mobile-usability':'test-results/mobile-usability');
const publishedJourneyScreenshot=(width,slug)=>width===375 || (width===390&&['first-visit','my-plan-empty','semiretirement','weekly-created','assumptions-error','scenario-compare','reports','backup-notice','navigation'].includes(slug)) || (width>=768&&['dashboard','setup','reports','navigation'].includes(slug));
const mobileBefore = process.env.FFS_MOBILE_BEFORE === '1';
const annualMobileEvidence = [];
async function mobileScreenshot(file) {
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  // Allow Chromium's compositor to paint the new route/scroll position before
  // collecting pixels; DOM geometry can settle before the screenshot surface.
  await new Promise(resolve=>setTimeout(resolve,150));
  const match=/^journey\/(\d+)-(.*)\.png$/.exec(file);
  const folder=publishMobileEvidence&&match&&!publishedJourneyScreenshot(Number(match[1]),match[2])?path.join(root,'test-results/mobile-usability'):mobileReviewDirectory;
  const output=path.join(folder,file);await mkdir(path.dirname(output),{recursive:true});
  const clip=await evaluate('({x:scrollX,y:scrollY,width:innerWidth,height:innerHeight,scale:1})');
  const image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
  await writeFile(output,Buffer.from(image.data,'base64'));
}

function chromePath() {
  if (process.env.FFS_BROWSER_EXECUTABLE && existsSync(process.env.FFS_BROWSER_EXECUTABLE)) return process.env.FFS_BROWSER_EXECUTABLE;
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
        path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
        path.join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
        path.join(process.env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error("Stage 1 browser tests require an installed Chrome or Edge browser.");
  return found;
}

async function waitFor(check, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check().catch(() => null);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for browser state.");
}

class CdpClient {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(listener);
  }
  close() {
    this.socket.close();
  }
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function key(key, modifiers = 0) {
  const code = key === 'Enter' ? { code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' } : {};
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, modifiers, ...code });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, modifiers, ...code });
}

async function continueSavedOpening() {
  if(await evaluate('document.body.dataset.freedomStage==="welcome"&&document.getElementById("continuePlanButton").getClientRects().length>0')){
    await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog();document.getElementById("continuePlanButton").click()');
  }
}
async function navigate() {
  await cdp.send("Page.navigate", { url: baseUrl });
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.FFSStage1BrowserTestHooks)"));
}

before(async () => {
  server = createServer(async (request, response) => {
    response.setHeader("Content-Security-Policy", csp);
    if (request.url === "/api/ai-insights") return aiHandler(request,response);
    if (request.url === "/api/payslip-extract") return payslipHandler(request,response);
    try {
      const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
      const resolved = path.resolve(root, relative);
      if (!resolved.startsWith(root)) throw new Error("Invalid path");
      let body = await readFile(resolved);
      if (mobileBefore && ['styles.css','retirement-results.js'].includes(relative)) {
        body = execFileSync('git',['show',`913700cda5599d459c26cf821d2fa1da4124e3fa:${relative}`],{cwd:root});
      }
      if (process.env.FFS_STAGE3_PHASE === 'before' && ['index.html','app.js','styles.css'].includes(relative)) {
        body = execFileSync('git',['show',`bfb708361120a227db4e871cebfe22a9ed8c2809:${relative}`],{cwd:root,maxBuffer:4*1024*1024});
      }
      if (process.env.FFS_FOUR_NAV_PHASE === 'before' && ['index.html','app.js','styles.css'].includes(relative)) {
        body = execFileSync('git',['show',`02054bfcf9a687efae6074560104042c0c3a64db:${relative}`],{cwd:root,maxBuffer:4*1024*1024});
      }
      if (process.env.FFS_MOBILE_DISPLAY_PHASE === 'before' && ['index.html','app.js','styles.css','growth-scenarios-view.js'].includes(relative)) {
        body = execFileSync('git',['show',`25d49e4a033d5af88684842dd6cd9bcdb794207b:${relative}`],{cwd:root,maxBuffer:4*1024*1024});
      }
      if (process.env.FFS_RETURNING_HEADER_PHASE === 'before' && ['index.html','app.js'].includes(relative)) {
        body = execFileSync('git',['show',`b98955029638f675541e0b5bd34f3c6c77aaeeab:${relative}`],{cwd:root,maxBuffer:4*1024*1024});
      }
      if (process.env.FFS_WELCOME_CARDS_PHASE === 'before' && ['index.html','styles.css'].includes(relative)) {
        body = execFileSync('git',['show',`244adcf695d6a44b000f2f63ba389d9051d3043e:${relative}`],{cwd:root,maxBuffer:4*1024*1024});
      }
      // Test-only alternate-year fixture; production files and calculation logic remain unchanged.
      if (relative === "calculator.js" && evidenceFinancialYear) body = Buffer.from(body.toString().replace('const FINANCIAL_YEAR = "2026-27";', `const FINANCIAL_YEAR = "${evidenceFinancialYear}";`));
      if (relative === "semiRetirementUi.js") body = Buffer.from(body.toString().replace('  function runSemiRetirementProjection(engine, draft) {', '  function runSemiRetirementProjection(engine, draft) { window.__retirementRuns = (window.__retirementRuns || 0) + 1;'));
      if (relative === "app.js") body = Buffer.from(body.toString()
        .replace('  function lineChart(svgId, series, options = {}) {', '  function lineChart(svgId, series, options = {}) { window.__dollarCharts ||= {}; window.__dollarCharts[svgId] = structuredClone(series);')
        .replace('  installMobileUsabilityStage2();', `  const stage2OriginalWhatIf=renderWhatIf;
        window.__stage2Test={originalWhatIfHtml:()=>{const node=document.getElementById('whatIfResult'),shown=node.innerHTML;stage2OriginalWhatIf(calculatePlan(plan));const html=node.innerHTML;node.innerHTML=shown;return html;},retirementDraft:()=>cloneScenarioDraft(semiRetirementScenarioDraft)};
  installMobileUsabilityStage2();`)
        .replace('  installDollarBasisPresentation();', `  const originalRetirementResult = renderSemiRetirementScenarioResultHtml;
        window.__dollarTest = {
          originalRetirementHtml: () => originalRetirementResult(),
          redesignContext: () => {
            const view = window.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(semiRetirementScenarioResult, semiRetirementScenarioInputs, semiRetirementScenarioResultDraft || semiRetirementScenarioDraft);
            return { view, inputs: semiRetirementScenarioInputs, basis: forecastDollarBasis, money: semiRetirementMoney,
              state: semiRetirementDetailsState, outcome: window.FFSSemiRetirementUi.buildSavedRetirementOutcome(view),
              debtFree: semiRetirementDebtFreeLabel(view.debtProperty || {}), baseline: semiRetirementAdjustmentBaseline,
              adjustment: window.FFSSemiRetirementUi.buildScenarioAdjustmentDisplayState({ projection: semiRetirementScenarioResult,
                inputs: semiRetirementScenarioInputs, resultDraft: semiRetirementScenarioResultDraft, currentDraft: semiRetirementScenarioDraft,
                baseline: semiRetirementAdjustmentBaseline, hasValidationErrors: semiRetirementAdjustmentErrors.length > 0 }) };
          },
          configureRetirement: fields => { for (const [path, value] of Object.entries(fields)) window.FFSSemiRetirementUi.setDraftPath(semiRetirementScenarioDraft, path, value); calculateSemiRetirementScenario(); },
          result: () => calculatePlan(plan),
          growthForecast: candidate => calculatePlan(candidate),
          backup: () => buildCompletePlanBackupPayload(),
          validateBackup: value => validateImportedPlanPayload(value),
          retirementSaveContext: () => buildRetirementScenarioSaveContext(),
          openRetirementSnapshot: value => loadRetirementScenarioSnapshot(value),
          savedScenarios: () => loadScenarios(),
          seedSavedScenario: () => saveScenarios(sampleScenarioList().slice(0, 1).map(scenario => ({ ...scenario, id: "dollar-regression", source: "user" }))),
          renderReportPresentation: () => { const result = calculatePlan(plan); document.getElementById("financialReportBody").innerHTML = reportPresentationHtml(result, "Regression fixture"); renderReportCharts(result); },
          future: () => futureYouPreview(calculatePlan(plan)),
          retirement: () => ({ inputs: semiRetirementScenarioInputs, result: semiRetirementScenarioResult,
            view: window.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(semiRetirementScenarioResult, semiRetirementScenarioInputs, semiRetirementScenarioDraft) }),
          setRetirement: (year, rate) => { semiRetirementScenarioDraft.projectionStartYear = year; semiRetirementScenarioDraft.assumptions.inflationRatePct = rate; calculateSemiRetirementScenario(); },
          setComparisonRate: rate => { const scenario = semiRetirementComparisonScenarios[0]; scenario.draft.assumptions.inflationRatePct = rate; runSemiRetirementComparisonForScenario(scenario); renderOutputs(); },
          setPrintLayout: layout => { semiComparisonReportLayout = layout; renderOutputs(); },
          decisionAllocation: () => { decisionScenarioDraft = { ...comparisonDefaults, surplusAllocationTarget: "investments", surplusAllocationAmount: 1000 }; renderOutputs(); },
          comparisons: () => semiRetirementComparisonScenarioSet(window.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(semiRetirementScenarioResult, semiRetirementScenarioInputs, semiRetirementScenarioDraft)),
          quick: () => resolveWhatIfScenario(calculatePlan(whatIfBaseSnapshot || plan)),
        };
  installDollarBasisPresentation();`));
      response.writeHead(200, { "content-type": mime[path.extname(resolved)] || "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
  profile = await mkdtemp(path.join(tmpdir(), "ffs-stage1-browser-"));
  chrome = spawn(chromePath(), [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-breakpad", "--disable-crash-reporter",
    "--no-sandbox", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  const portFile = path.join(profile, "DevToolsActivePort");
  const contents = await waitFor(async () => existsSync(portFile) ? readFile(portFile, "utf8") : null);
  const port = String(contents).split(/\r?\n/)[0];
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = pages.find((item) => item.type === "page");
  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (["error", "warning", "warn"].includes(type)) browserMessages.push(args.map((item) => item.value || item.description || "").join(" "));
  });
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => browserMessages.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "Browser exception"));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  cdp.on("Log.entryAdded", ({entry})=>{if(entry.source==="security")browserMessages.push(entry.text)});
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true; window.print=()=>{window.__printCalls=(window.__printCalls||0)+1}; window.confirm=()=>true;",
  });
  await navigate();
});

after(async () => {
  if (cdp) await cdp.send("Browser.close").catch(() => {});
  if (chrome && chrome.exitCode === null) await Promise.race([
    new Promise(resolve => chrome.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  cdp?.close();
  if (chrome && chrome.exitCode === null) chrome.kill();
  chrome?.unref();
  server?.closeAllConnections?.();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (profile && path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(profile).startsWith("ffs-stage1-browser-")) await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});



const amount = text => Number(String(text).replace(/[^0-9.-]/g, ''));
const close = (actual, expected, tolerance = 1) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
async function select(basis) {
  await evaluate(`document.querySelector('[data-dollar-basis="${basis}"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-dollar-basis="${basis}"]').getAttribute('aria-pressed')`), 'true');
}
async function fixture() {
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'dashboard'); FFSStage1BrowserTestHooks.closeDurabilityDialog()");
}

for (const width of [1366, 375]) test(`forecast cards, charts, Future You and reports agree at ${width}px`, async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:width<600});
  await fixture(); await select('future');
  const before = await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  const result = await evaluate('__dollarTest.result()');
  const rate = result.plan.investing.inflationPct / 100;
  const nominal = await evaluate('structuredClone(__dollarCharts)');
  await select('today');
  const real = await evaluate('structuredClone(__dollarCharts)');
  for (const [id, series] of Object.entries(nominal)) {
    series.forEach((item, i) => item.points.forEach((p, j) => {
      close(real[id][i].points[j].y, /Progress/.test(id) ? p.y : p.y / (1 + rate) ** p.x, 0.000001);
    }));
  }
  for (const [i, year] of [5,10,20,30].entries()) {
    const value = await evaluate(`document.querySelectorAll('#investmentCards strong')[${i}].textContent`);
    close(amount(value), result.investmentProjection.find(r=>r.year===year).closingBalance / (1+rate)**year);
  }
  await evaluate(`(()=>{const slider=document.querySelector('[data-dashboard-future-age]'); slider.value=Number(slider.max); slider.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const future = await evaluate('__dollarTest.future()');
  const tiles = await evaluate(`Object.fromEntries([...document.querySelectorAll('[data-dashboard-future-results] .summary-tile')].map(tile=>[tile.querySelector('span').firstChild.textContent.trim(),tile.querySelector('strong').textContent]))`);
  close(amount(tiles['Projected net worth']), future.netWorth / (1+rate)**future.year);
  close(amount(tiles['Accessible FI Assets']), future.accessibleFiAssets / (1+rate)**future.year);
  const report = await evaluate("document.getElementById('financialReportBody').textContent");
  const net10 = new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(result.netWorthProjection.find(r=>r.year===10).closingBalance/(1+rate)**10);
  assert.ok(report.includes(`net worth of ${net10}`), 'report narrative uses real year-10 value');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports');document.getElementById('reportPrintButton').click()");
  const pdf = await cdp.send('Page.printToPDF',{printBackground:true});
  assert.ok(pdf.data.length>1000);
  const output = path.join(root, 'test-results/dollar-basis'); await mkdir(output,{recursive:true});
  await writeFile(path.join(output, `today-${width}.pdf`),Buffer.from(pdf.data,'base64'));
  await writeFile(path.join(output, `today-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
  await select('future');
  const reversed = await evaluate('__dollarCharts');
  assert.deepEqual(reversed,nominal,'chart reversal restores nominal data exactly');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
});

for (const inflation of [5, 0]) test(`loan checkpoints and report gap reconcile in both bases at ${inflation}% inflation`, async () => {
  await fixture();
  await evaluate(`(() => { const p = FFSStage1BrowserTestHooks.getPlan(); p.investing.inflationPct = ${inflation}; FFSStage1BrowserTestHooks.setPlan(p, 'dashboard'); })()`);
  await select('future');
  const result = await evaluate('__dollarTest.result()');
  assert.equal(result.plan.investing.inflationPct, inflation);
  assert.ok(result.targetProjectionYear > 0);
  assert.ok(result.loan.balanceAtYears[5] > 0, 'fixture must exercise a future loan balance');
  await evaluate('__dollarTest.seedSavedScenario()');
  const snapshot = () => evaluate(`JSON.stringify({ result: __dollarTest.result(), plan: FFSStage1BrowserTestHooks.getPlan(),
    scenarios: __dollarTest.savedScenarios(), storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => /scenario/i.test(key))) })`);
  const before = await snapshot();
  assert.ok((await evaluate('__dollarTest.savedScenarios()')).length > 0, 'saved comparison fixtures are present');
  let nominal;
  for (const basis of ['future', 'today', 'future']) {
    await select(basis);
    // Existing readiness policy requires positive inflation. Exercise the actual
    // report presentation at zero without changing or bypassing that production policy.
    if (inflation === 0) {
      assert.equal(await evaluate('FFSStage1BrowserTestHooks.getReadiness().readyForPersonalisedResults'), false);
      await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports');__dollarTest.renderReportPresentation()");
    }
    const display = await evaluate(`({
      cards: Object.fromEntries([...document.querySelectorAll('#loanSummary .summary-tile')].map(tile => [tile.querySelector('span').firstChild.textContent.trim(), tile.querySelector('strong').textContent])),
      chart: __dollarCharts.loanChart[0].points,
      gap: [...document.querySelectorAll('#financialReportBody .report-metric')].find(tile => tile.querySelector('h3').textContent === 'Gap to target').querySelector('strong').textContent,
      narrative: [...document.querySelectorAll('#financialReportBody .report-review-action')].find(tile => tile.querySelector('h4').textContent === 'Financial Independence target').textContent,
      cashflow: document.querySelector('#financialReportBody .report-waterfall').textContent,
    })`);
    for (const year of [5, 10, 20, 30]) {
      const expected = result.loan.balanceAtYears[year] / (basis === 'today' ? (1 + inflation / 100) ** year : 1);
      close(amount(display.cards[`Balance at ${year} years`]), expected);
      close(amount(display.cards[`Balance at ${year} years`]), display.chart.find(point => point.x === year).y);
    }
    const expectedGap = basis === 'today'
      ? Math.max(0, result.targetCapital / (1 + inflation / 100) ** result.targetProjectionYear - result.financialIndependenceAssets)
      : result.fiTargetRemaining;
    close(amount(display.gap), expectedGap);
    assert.ok(display.narrative.includes(`remaining target gap of ${display.gap}.`));
    if (!nominal) nominal = display;
    else {
      assert.equal(display.cashflow, nominal.cashflow, 'current cashflow table is unchanged');
      if (basis === 'future' || inflation === 0) assert.deepEqual(display, nominal);
    }
    assert.equal(await snapshot(), before, 'calculations, assumptions and saved scenarios stay unchanged');
    if (inflation === 0) await evaluate("document.body.dataset.printMode = 'financial-report'");
    else await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports');document.getElementById('reportPrintButton').click()");
    assert.ok(await evaluate(`document.getElementById('financialReportBody').textContent.includes(${JSON.stringify(`remaining target gap of ${display.gap}.`)})`));
    const pdf = await cdp.send('Page.printToPDF', { printBackground: true });
    assert.ok(pdf.data.length > 1000);
    await mkdir(path.join(root, 'test-results/dollar-basis'), { recursive: true });
    await writeFile(path.join(root, `test-results/dollar-basis/final-gap-${inflation}-${basis}.pdf`), Buffer.from(pdf.data, 'base64'));
    await evaluate('delete document.body.dataset.printMode');
  }
});

test('Quick What-If discounts each forecast and preserves current cashflow', async () => {
  await fixture(); await select('future');
  const current = await evaluate("document.querySelector('#whatIfResult .what-if-metrics').textContent");
  const nominal = await evaluate("[...document.querySelectorAll('#whatIfResult .what-if-forecast-row')].slice(1).map(r=>[...r.querySelectorAll('span,b')].map(c=>c.textContent))");
  const rate = await evaluate('__dollarTest.result().plan.investing.inflationPct / 100');
  await select('today');
  const real = await evaluate("[...document.querySelectorAll('#whatIfResult .what-if-forecast-row')].slice(1).map(r=>[...r.querySelectorAll('span,b')].map(c=>c.textContent))");
  assert.equal(real.length,3);
  for (let i=0;i<3;i++) for(let j=0;j<2;j++) close(amount(real[i][j]),amount(nominal[i][j])/(1+rate)**[1,5,10][i]);
  assert.equal(await evaluate("document.querySelector('#whatIfResult .what-if-metrics').textContent"),current);
});

test('dated retirement rows and comparison PDFs use scenario inflation', async () => {
  await fixture(); await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click();__dollarTest.setRetirement(2027, 5)");
  const before = await evaluate('JSON.stringify(__dollarTest.retirement())');
  await select('today');
  assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement())'),before);
  const { view } = await evaluate('__dollarTest.retirement()');
  const row = view.annualRows[2];
  const rendered = await evaluate("[...document.querySelectorAll('.semi-retirement-annual-table tbody tr')].map(r=>r.textContent).join(' ')");
  const expected = new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(row.household.totalSuperBalance/1.05**2);
  assert.ok(rendered.includes(expected), 'annual table discounts from 2027, not browser year');
  await evaluate("window.prompt=()=> 'Different inflation';document.querySelector('[data-semi-action=compare]').click()");
  await evaluate('__dollarTest.setComparisonRate(0)');
  const scenarios = await evaluate('__dollarTest.comparisons()');
  assert.equal(scenarios[1].inputs.inflationRate,0);
  for(const scenario of scenarios) {
    const full=scenario.viewModel.keyResults.accessibleWhenBothFullyRetired;
    if(full?.row) close(scenario.summary.accessibleAtRetirement, full.value/(1+scenario.inputs.inflationRate)**(full.row.calendarYear-scenario.inputs.projectionStartYear),0.0001);
  }
  await evaluate("document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
  assert.ok(await evaluate("document.querySelector('.semi-retirement-comparison-print-report').textContent.includes(\"today's dollars\")"));
  assert.ok(await evaluate("!document.querySelector('.semi-retirement-comparison-print-report').textContent.includes('nominal future values')"));
  const pdf=await cdp.send('Page.printToPDF',{printBackground:true}); assert.ok(pdf.data.length>1000);
  await mkdir(path.join(root,'test-results/dollar-basis'),{recursive:true});
  await writeFile(path.join(root,'test-results/dollar-basis/retirement-today.pdf'),Buffer.from(pdf.data,'base64'));
  await evaluate('delete document.body.dataset.printMode');
  for (const layout of ['landscape', 'portrait']) {
    if (layout === 'landscape') await evaluate("document.querySelector('[data-semi-action=compare]').click();document.querySelector('[data-semi-action=compare]').click()");
    await evaluate(`__dollarTest.setPrintLayout('${layout}');document.querySelector('[data-semi-action=export-comparison-pdf]').click()`);
    const report = await evaluate("document.querySelector('.semi-retirement-comparison-print-report').textContent");
    assert.ok(report.includes("today's dollars"));
    assert.ok(!report.includes('nominal future values') && !report.includes('nominal future dollars'));
    const output = await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
    assert.ok(output.data.length > 1000);
    await writeFile(path.join(root,`test-results/dollar-basis/retirement-${layout}.pdf`),Buffer.from(output.data,'base64'));
    await evaluate('delete document.body.dataset.printMode');
  }
});

test('custom Decision Engine uses labelled cards and preserves year-specific forecasts and surplus outcomes', async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 375, height: 900, deviceScaleFactor: 1, mobile: true});
  await fixture(); await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('decision'); document.getElementById('customScenarioDetails').open = true; __dollarTest.decisionAllocation()");
  const read = () => evaluate(`Object.fromEntries([
    ...[...document.querySelectorAll('#comparisonSummary .summary-tile')].map(tile =>
      [tile.querySelector('span').firstChild.textContent.trim(), tile.querySelector('strong').textContent.split(' -> ')]),
    ...[...document.querySelectorAll('#comparisonSummary [data-stage2-comparison]')].map(row =>
      [row.firstElementChild.firstChild.textContent.trim(), [...row.querySelectorAll('.stage2-comparison-value')].map(node => node.textContent)])
  ])`);
  const layout = await evaluate(`(() => {
    const panel = document.querySelector('[data-view-panel=decision]');
    const forecast = panel.querySelector('#comparisonSummary .what-if-forecast');
    return {
      labels: [...forecast.querySelectorAll('[data-stage2-comparison]')].map(row =>
        [...row.querySelectorAll('.stage2-comparison-label')].map(label => label.textContent)),
      cardsFit: [...forecast.querySelectorAll('[data-stage2-comparison]')].every(row => row.scrollWidth <= row.clientWidth + 1),
      headerHidden: getComputedStyle(forecast.querySelector('.what-if-forecast-head')).display === 'none',
      passiveSummary: Boolean(panel.querySelector('.passive-income-breakdown-details, #decisionPassiveIncomeSummary')),
      details: Boolean(panel.querySelector('#comparisonSummary .decision-result-details summary')),
    };
  })()`);
  assert.deepEqual(layout.labels, Array.from({length: 4}, () => ['Current Plan', 'Adjusted Plan', 'Difference']));
  assert.equal(layout.cardsFit, true);
  assert.equal(layout.headerHidden, true);
  assert.equal(layout.passiveSummary, false);
  assert.equal(layout.details, true);
  const nominal = await read();
  assert.match(nominal['Financial Freedom progress'][2], /pp$/);
  const rate = await evaluate('__dollarTest.result().plan.investing.inflationPct/100');
  await select('today');
  const real = await read();
  for (const [label, year] of Object.entries({'Net worth after 1 year':1,'Net worth after 2 years':2,'Long-term net worth':30,'Super balance in 2 years':2,'Investment balance in 2 years':2,'Projected investment balance in 10 years':10,'Projected FI assets in 10 years':10,'Projected passive income in 10 years':10})) {
    assert.ok(nominal[label],label);
    const before = nominal[label].map(amount), after = real[label].map(amount);
    before.forEach((value,index)=>close(after[index],value/(1+rate)**year));
  }
  assert.deepEqual(real['Current annual final surplus'],nominal['Current annual final surplus']);
  await select('future'); assert.deepEqual(await read(),nominal);
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('goals')");
  assert.ok(await evaluate("document.querySelector('#goalsPassiveIncomeBreakdown .passive-income-breakdown-details') !== null"));
});

test('selector persists on reload and leaves unsaved text and plan unchanged', async () => {
  await fixture();
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('setup');document.querySelector('[data-path]').value='unsaved-text'");
  const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await select('future'); await select('today');
  assert.equal(await evaluate("document.querySelector('[data-path]').value"),'unsaved-text');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
  await navigate();
  assert.equal(await evaluate("document.querySelector('[data-dollar-basis=today]').getAttribute('aria-pressed')"),'true');
});

test('restricted storage still permits reversible display switching', async () => {
  await fixture();
  await evaluate("window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,...rest){if(key==='ffs.ui.forecastDollarBasis')throw new Error('blocked');return __originalSetItem.call(this,key,...rest)}");
  await select('future');await select('today');await select('future');
  await evaluate('Storage.prototype.setItem=window.__originalSetItem');
  assert.deepEqual(browserMessages,[],'no renderer errors or CSP violations');
});

for (const width of [1366, 375, 430]) test(`retirement redesign structure, controls and expansion at ${width}px`, async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await navigate();
  await fixture(); await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
  const read = () => evaluate('JSON.stringify(__dollarTest.retirement().result)');
  const before = await read();
  const plan = await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  const saved = await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  const structure = await evaluate(`(() => { const root = document.querySelector('.retirement-redesign'); return {
    sections: [...root.children].map(node => node.id),
    cards: [...root.querySelectorAll('.rr-summary-grid > article > span')].map(node => node.textContent),
    funding: [...root.querySelectorAll('h3,h4')].filter(node => node.textContent === 'Funding Outlook').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    events: root.querySelectorAll('.rr-journey > li').length,
    expectedEvents: __dollarTest.retirement().view.timeline.reduce((n, group) => n + group.events.length, 0),
  }; })()`);
  assert.deepEqual(structure.sections, ['retirement-outlook','retirement-journey','retirement-adjustments','retirement-funding','retirement-details']);
  assert.deepEqual(structure.cards, ['Fully Retired','Lifestyle Funded Through','Non-Super Investments Remaining','Superannuation Remaining']);
  assert.equal(await evaluate("document.querySelector('[data-rr-impact-state]').dataset.rrImpactState"),'unchanged');
  assert.ok(await evaluate("document.querySelector('[data-rr-impact-state]').textContent.includes('No changes made yet.')"));
  assert.ok(await evaluate("(() => {const r=[...document.querySelectorAll('#retirement-journey > .rr-journey > li')].map(n=>n.getBoundingClientRect());return r.every((n,i)=>!i||n.top>=r[i-1].bottom);})()"), 'timeline is vertical');
  assert.equal(structure.funding, 0); assert.equal(structure.overflow, false); assert.equal(structure.events, structure.expectedEvents);
  assert.ok(await evaluate("['rr-pension','rr-comparison','rr-annual','rr-assumptions'].every(key=>!document.querySelector('[data-semi-detail-state='+key+']').open)"), 'detail panels are collapsed by default');
  const retained = await evaluate(`(() => { const template = document.createElement('template'); template.innerHTML = __dollarTest.originalRetirementHtml();
    return ['.semi-retirement-annual-table', '.retained-asset-list', '.semi-retirement-comparison-table'].every(selector => template.content.querySelector(selector)?.textContent === document.querySelector('.retirement-redesign ' + selector)?.textContent); })()`);
  assert.ok(retained, 'annual values, retained assets and comparison text are preserved verbatim');
  // Close any panels deliberately opened by preceding test cases, then exercise native keyboard behaviour.
  await evaluate("document.querySelectorAll('.retirement-redesign details').forEach(node=>node.open=false)");
  await evaluate("document.querySelector('[data-semi-detail-state=rr-annual] > summary').focus()");
  const runs = await evaluate('window.__retirementRuns');
  await key('Enter');
  await waitFor(() => evaluate("document.querySelector('[data-semi-detail-state=rr-annual]').open"));
  assert.equal(await read(), before, 'opening a panel leaves the model result unchanged');
  assert.equal(await evaluate('window.__retirementRuns'), runs, 'opening a panel does not run the projection');
  const chart = await evaluate("[...document.querySelectorAll('.rr-chart-point')].map(node=>({year:Number(node.dataset.year),value:Number(node.dataset.value)}))");
  const { view, inputs } = await evaluate('__dollarTest.retirement()');
  const full = view.keyResults.accessibleWhenBothFullyRetired.row;
  assert.equal(await evaluate("document.querySelector('[data-rr-metric=retired] > strong').textContent"),String(full.calendarYear));
  for (const person of (full.ages || full.people)) assert.ok(await evaluate(`document.querySelector('[data-rr-metric=retired] > small').textContent.includes(${JSON.stringify(`${person.name}: Age ${person.age}`)})`));
  assert.equal(chart.length, view.annualRows.length);
  assert.ok(await evaluate(`(() => { const svg=document.querySelector('.rr-chart svg'), box=svg.getBoundingClientRect();
    const labels=[...svg.querySelectorAll('text')].map(n=>n.getBoundingClientRect());
    return labels.every((r,i)=>r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1
      &&labels.slice(i+1).every(s=>r.right<=s.left||s.right<=r.left||r.bottom<=s.top||s.bottom<=r.top)); })()`),'chart axis labels fit without overlap');
  chart.forEach((point,index) => close(point.value,view.annualRows[index].household.closingAccessibleInvestmentBalance,0.000001));
  await select('today');
  assert.ok(await evaluate("document.querySelector('[data-semi-detail-state=rr-annual]').open"), 'annual panel survives toggle');
  const realChart = await evaluate("[...document.querySelectorAll('.rr-chart-point')].map(node=>Number(node.dataset.value))");
  realChart.forEach((value,index) => close(value,chart[index].value/(1+inputs.inflationRate)**view.annualRows[index].yearIndex,0.000001));
  close(amount(await evaluate("document.querySelector('[data-rr-metric=remaining] > strong').textContent")),realChart.at(-1));
  close(amount(await evaluate("document.querySelector('[data-rr-metric=super] > strong').textContent")),view.annualRows.at(-1).household.totalSuperBalance/(1+inputs.inflationRate)**view.annualRows.at(-1).yearIndex);
  assert.equal(await read(), before);
  await evaluate("document.querySelector('[data-semi-detail-state=rr-annual] > summary').click();document.querySelector('[data-rr-open=rr-comparison]').click()");
  assert.ok(await evaluate("document.querySelector('[data-semi-detail-state=rr-comparison]').open"));
  assert.equal(await evaluate("document.activeElement === document.querySelector('[data-semi-detail-state=rr-comparison] > summary')"),true);
  const originalSpending = await evaluate("Number(document.querySelector('[data-semi-adjustment]').value)");
  await evaluate("(() => {const slider=document.querySelector('[data-semi-adjustment-range]');slider.value=Number(slider.value)+5000;slider.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await waitFor(async () => (await read()) !== before);
  assert.equal(await evaluate("document.querySelector('[data-rr-impact-state]').dataset.rrImpactState"),'changed');
  const delta = await evaluate("(() => {const c=__dollarTest.redesignContext();return FFSRetirementResults.adjustmentPresentation(c.adjustment,c.baseline,c.inputs,c.basis).endDelta;})()");
  close(amount((await evaluate("document.querySelector('[data-rr-metric=change-assets] > strong').textContent")).replace('−','-')),delta);
  await mkdir(path.join(root,'test-results/retirement-redesign'),{recursive:true});
  await evaluate("window.scrollTo({top:0,behavior:'instant'})");
  const adjustmentClip=await evaluate("(() => {const r=document.querySelector('#retirement-adjustments').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()");
  await writeFile(path.join(root,`test-results/retirement-redesign/retirement-adjustments-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:adjustmentClip})).data,'base64'));
  assert.ok(await evaluate("document.querySelector('[data-semi-detail-state=rr-comparison]').open"), 'comparison panel survives adjustment');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
  await evaluate("document.querySelector('[data-semi-action=reset-adjustments]').click()");
  await waitFor(async () => (await read()) === before);
  assert.equal(await evaluate("document.querySelector('[data-rr-impact-state]').dataset.rrImpactState"),'unchanged');
  assert.equal(await evaluate("Number(document.querySelector('[data-semi-adjustment]').value)"),originalSpending);
  await evaluate("document.querySelector('[data-semi-action=manage-one-off-lifestyle-events]').click()");
  assert.ok(await evaluate("document.querySelector('[data-one-off-lifestyle-spending]').getBoundingClientRect().height > 0"));
  await evaluate("document.querySelectorAll('.retirement-redesign details').forEach(node=>node.open=false);window.scrollTo({top:0,behavior:'instant'})");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  const output=path.join(root,'test-results/retirement-redesign');await mkdir(output,{recursive:true});
  const clip=await evaluate("(() => { const r=document.querySelector('.retirement-redesign').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:Math.min(r.height,1800),scale:1};})()");
  await writeFile(path.join(output,`retirement-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})).data,'base64'));
  const journeyClip=await evaluate("(() => {const r=document.querySelector('#retirement-journey').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()");
  await writeFile(path.join(output,`retirement-journey-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:journeyClip})).data,'base64'));
  const detailClip=await evaluate("(() => { const r=document.querySelector('#retirement-funding').getBoundingClientRect();const end=document.querySelector('#retirement-details').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:end.bottom-r.top,scale:1};})()");
  await writeFile(path.join(output,`retirement-details-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:detailClip})).data,'base64'));
  await evaluate("document.querySelector('[data-semi-detail-state=rr-property]').open=true;document.querySelector('[data-semi-detail-state=rr-annual]').open=true");
  await evaluate("document.querySelectorAll('[data-semi-detail-state=rr-property] details').forEach(n=>n.open=true)");
  assert.ok(await evaluate(`(() => {const rows=[...document.querySelectorAll('[data-semi-detail-state=rr-property] .semi-retirement-person-values > div')];
    return rows.length>0&&rows.every(row=>{const [label,value]=[...row.children].map(n=>n.getBoundingClientRect());return !value||label.right<=value.left+1||value.right<=label.left+1||label.bottom<=value.top+1||value.bottom<=label.top+1;});})()`),'debt and property labels do not overlap values');
  const propertyClip=await evaluate("(() => {const r=document.querySelector('[data-semi-detail-state=rr-property]').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()");
  await writeFile(path.join(output,`retirement-property-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:propertyClip})).data,'base64'));
  assert.ok(await evaluate(`(() => {const value=[...document.querySelectorAll('.semi-retirement-debt-card strong')].find(n=>n.textContent.includes('Projected payoff'));
    if(!value)return false;const original=value.textContent;value.textContent+=' — Alexandra Montgomery age 56 / Christopher Montgomery age 55, based on the current repayment assumptions.';
    const label=value.previousElementSibling, r=value.getBoundingClientRect(), l=label.getBoundingClientRect();
    const fits=r.top>=l.bottom-1&&value.scrollWidth<=value.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1;
    value.textContent=original;return fits;})()`),'long payoff descriptions wrap without clipping or overlapping labels');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'expanded content stays within viewport');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.semi-retirement-projection-scroll')).display!=='none'"),width>900,'Desktop keeps the table; mobile uses the stacked year cards');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.maf-years')).display!=='none'"),width<=900);
});

test('retirement redesign keeps zero-inflation values and pension inclusion accurate', async () => {
  await fixture(); await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click();__dollarTest.configureRetirement({'assumptions.inflationRatePct':0,'scenario.agePension.enabled':true})");
  const nominal=await evaluate("[...document.querySelectorAll('.rr-chart-point')].map(node=>node.dataset.value)");
  const source=await evaluate('JSON.stringify(__dollarTest.retirement())');
  await select('today');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.rr-chart-point')].map(node=>node.dataset.value)"),nominal);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement())'),source);
  const included=await evaluate('__dollarTest.retirement().view.annualRows.some(row=>row.household.estimatedAgePension>0)');
  if(included) assert.ok(await evaluate("document.querySelector('[data-semi-detail-state=rr-pension] > summary').textContent.includes('included in funding') && !document.querySelector('.retirement-redesign').textContent.includes('Age Pension not included.')"));
  await evaluate("__dollarTest.configureRetirement({'scenario.agePension.unsupported':true})");
  assert.ok(await evaluate("document.querySelector('[data-semi-detail-state=rr-pension] > summary').textContent.includes('no pension included')"));
  assert.deepEqual(browserMessages, [], 'no renderer errors or CSP violations');
});

test('retirement redesign shows an actual single-person shortfall without claiming future funding', async () => {
  await navigate();
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[0].plan,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-semi-action=calculate]').click();__dollarTest.configureRetirement({'household.fullRetirementLifestyleSpending':500000})");
  const { view, inputs } = await evaluate('__dollarTest.retirement()');
  assert.equal(view.people.length,1);
  assert.ok(view.longevity.firstUnfundedSpending?.calendarYear);
  for(const basis of ['future','today']) {
    await select(basis);
    assert.ok(await evaluate("document.querySelector('#retirement-outlook').classList.contains('rr-warning')"));
    const first = view.annualRows.find(row=>row.calendarYear===view.longevity.firstUnfundedSpending.calendarYear);
    assert.equal(await evaluate("document.querySelector('[data-rr-metric=funded] > strong').textContent"),`First shortfall: Age ${first.ages[0].age}`);
    const expected = view.annualRows.reduce((sum,row)=>sum+row.household.unmetSpending/(basis==='today'?(1+inputs.inflationRate)**row.yearIndex:1),0);
    close(amount(await evaluate("document.querySelector('[data-rr-metric=shortfall] > strong').textContent")),expected);
    assert.ok(await evaluate("document.querySelector('#retirement-outlook .rr-headline').textContent.includes('projected spending shortfall')"));
    assert.ok(await evaluate("[...document.querySelectorAll('.rr-exhaustion.is-warning')].some(n=>n.textContent.includes('first spending shortfall'))"));
  }
  assert.deepEqual(browserMessages,[]);
});

test('chart investigation records exact balances around modelled depletion', async () => {
  await navigate();await fixture();await select('today');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
  const trace=await evaluate(`(()=>{const {view,inputs}=__dollarTest.retirement();return {inputs:{projectionStartYear:inputs.projectionStartYear,inflationRate:inputs.inflationRate,minimumAccessibleBalance:inputs.scenario.minimumAccessibleBalance},milestone:view.longevity.accessibleFundsExhausted,rows:view.annualRows.filter(r=>r.calendarYear>=2058&&r.calendarYear<=2069).map(r=>({year:r.calendarYear,closing:r.household.closingAccessibleInvestmentBalance,withdrawal:r.household.totalAccessibleWithdrawal,super:r.household.totalSuperBalance,unmet:r.household.unmetSpending,offset:r.household.offsetClosingBalance,unallocated:r.household.totalAccessibleAssets-r.household.closingAccessibleInvestmentBalance}))};})()`);
  await mkdir(path.join(root,'test-results/retirement-redesign'),{recursive:true});
  await writeFile(path.join(root,'test-results/retirement-redesign/exhaustion-trace.json'),JSON.stringify(trace,null,2));
  assert.equal(trace.milestone.calendarYear,2067);
  assert.equal(trace.rows.find(r=>r.year===2066).closing,.01);
  assert.equal(trace.rows.find(r=>r.year===2067).closing,0);
  assert.ok(trace.rows.every(r=>r.unmet===0&&r.super>0&&r.offset===0&&r.unallocated===0));
  assert.equal(await evaluate("Number(document.querySelector('[data-exhaustion-year]').dataset.exhaustionYear)"),2067);
  assert.ok(await evaluate("document.querySelector('.rr-exact-balances').textContent.includes('Less than $0.01')"));
  assert.ok(await evaluate("document.querySelector('.rr-exhaustion').classList.contains('is-information')"));
  for (const basis of ['future','today']) {
    await select(basis);
    const rows=await evaluate("[...document.querySelectorAll('.rr-exact-balances tbody tr')].map(r=>({year:Number(r.firstElementChild.textContent),text:r.lastElementChild.textContent}))");
    for(const row of rows) {
      const nominal=trace.rows.find(r=>r.year===row.year).closing;
      const value=nominal/(basis==='today'?(1+trace.inputs.inflationRate)**(row.year-trace.inputs.projectionStartYear):1);
      if(value>0&&value<.01) assert.equal(row.text,'Less than $0.01');
      else close(amount(row.text),value,.0051);
    }
  }
});

test('stable section markers tolerate heading changes and missing markup preserves complete original results', async () => {
  await fixture();await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
  const checks=await evaluate(`(() => {const context=__dollarTest.redesignContext(),original=__dollarTest.originalRetirementHtml();
    const template=document.createElement('template');template.innerHTML=original;
    template.content.querySelectorAll('h3,h4').forEach(n=>n.textContent='Reworded heading');
    const changed=document.createElement('template');changed.innerHTML=FFSRetirementResults.redesign(template.innerHTML,context);
    const retained=['.semi-retirement-annual-table','.retained-asset-list','.semi-retirement-comparison-table'].every(s=>template.content.querySelector(s)?.textContent===changed.content.querySelector(s)?.textContent);
    template.content.querySelector('[data-rr-source=snapshot]').removeAttribute('data-rr-source');
    const fallback=document.createElement('template');fallback.innerHTML=FFSRetirementResults.redesign(template.innerHTML,context);
    const fallbackComplete=[...template.content.querySelector('[data-semi-results-dashboard]').children].every(n=>[...fallback.content.querySelector('[data-semi-results-dashboard]').children].some(copy=>copy.outerHTML===n.outerHTML));
    return {redesigned:!!changed.content.querySelector('.retirement-redesign'),retained,fallbackComplete,notice:fallback.content.textContent.includes('complete original results remain below')};})()`);
  assert.deepEqual(checks,{redesigned:true,retained:true,fallbackComplete:true,notice:true});
  assert.ok(await evaluate(`(() => {const context=__dollarTest.redesignContext();context.view=structuredClone(context.view);
    context.view.annualRows.forEach(row=>row.household.closingAccessibleInvestmentBalance=0);
    context.view.longevity.accessibleFundsExhausted=null;
    const template=document.createElement('template');template.innerHTML=FFSRetirementResults.redesign(__dollarTest.originalRetirementHtml(),context);
    const svg=template.content.querySelector('.rr-chart svg');
    return [...svg.querySelectorAll('.rr-chart-point')].every(n=>Number(n.dataset.value)===0)
      &&[...svg.querySelectorAll('text')].filter(n=>n.textContent.startsWith('$')).map(n=>n.textContent).join()==='$0'
      &&template.content.textContent.includes('All recorded non-super closing balances are zero.');})()`),'all-zero chart has a zero scale and does not imply a shortfall');
});

async function assumptionsFixture() {
  await fixture();
  await evaluate(`(() => {const p=FFSStage1BrowserTestHooks.getPlan();
    const asset=p.assetItems.find(a=>FFSCalculator.assetCapabilities(a.category).supportsFinancialInvestmentReturn);
    if(asset)Object.assign(asset,{investmentReturnMode:'totalReturn',expectedTotalReturnPct:8,expectedIncomeYieldPct:3,incomeTreatment:'cash',name:'Long-term household investment portfolio'});
    p.assumptions={...(p.assumptions||{}),homeGrowthRate:.035};delete p.investing.principalResidenceGrowthRatePct;
    FFSStage1BrowserTestHooks.setPlan(p,'assumptions');FFSStage1BrowserTestHooks.closeDurabilityDialog();
  })()`);
}
async function assumptionEdit(key,value) {
  await evaluate(`(() => {const input=[...document.querySelectorAll('#forecastAssumptionsWorkspace [data-assumption]')].find(n=>n.dataset.assumption===${JSON.stringify(key)});input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
async function assumptionButton(text) {
  await evaluate(`(() => {const button=[...document.querySelectorAll('#forecastAssumptionsWorkspace button')].find(n=>n.textContent===${JSON.stringify(text)});if(!button)throw new Error('Missing assumption action');button.click();})()`);
}
for(const width of [1366,768,375,430])test(`assumptions workspace edits, saves and renders without overflow at ${width}px`,async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await assumptionsFixture();
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('dashboard');document.querySelector('.fa-nav').click()");
  assert.equal(await evaluate('document.body.dataset.activeView'),'assumptions');
  assert.equal(await evaluate("document.querySelector('.fa-nav').getAttribute('aria-current')"),'page');
  assert.equal(await evaluate("document.querySelector('.fa-advanced').open"),false);
  const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),result=await evaluate('JSON.stringify(__dollarTest.result())');
  const saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  await assumptionEdit('inflationPct',0);
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),result);
  await select('today');assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'0','toggle preserves unsaved text');
  await assumptionButton('Undo unsaved edits');
  assert.equal(await evaluate("Number(document.querySelector('[data-assumption=inflationPct]').value)"),JSON.parse(before).investing.inflationPct);
  await assumptionEdit('inflationPct',0);await assumptionEdit('principalResidenceGrowthRatePct',4);
  await assumptionButton('Save assumptions');
  await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  const current=await evaluate('FFSStage1BrowserTestHooks.getPlan()');assert.equal(current.investing.inflationPct,0);assert.equal(current.assumptions.homeGrowthRate,.04);
  assert.deepEqual(current.assetItems,JSON.parse(before).assetItems);assert.deepEqual(current.incomeItems,JSON.parse(before).incomeItems);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
  const stored=await evaluate("JSON.parse(localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')).plan");assert.equal(stored.investing.inflationPct,0);assert.equal(stored.assumptions.homeGrowthRate,.04);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await evaluate("document.querySelector('.fa-advanced > summary').focus()");const runs=await evaluate('window.__retirementRuns');await key('Enter');assert.ok(await evaluate("document.querySelector('.fa-advanced').open"));assert.equal(await evaluate('window.__retirementRuns'),runs);
  assert.ok(await evaluate(`(() => {const controls=[...document.querySelectorAll('#forecastAssumptionsWorkspace input,#forecastAssumptionsWorkspace select')];return controls.every(n=>!!document.querySelector('label[for="'+n.id+'"]')&&!!n.getAttribute('aria-describedby')&&n.scrollWidth<=n.clientWidth+2);})()`));
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  const output=path.join(root,'test-results/forecast-assumptions');await mkdir(output,{recursive:true});
  for(const expanded of [false,true]) {
    await evaluate(`document.querySelector('.fa-advanced').open=${expanded};window.scrollTo({top:0,behavior:'instant'})`);
    const clip=await evaluate("(() => {const r=document.querySelector('.forecast-assumptions-workspace').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()");
    await writeFile(path.join(output,`assumptions-${expanded?'advanced':'essential'}-${width}.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})).data,'base64'));
  }
  const chart=await evaluate('JSON.stringify(__dollarCharts)');await select('future');assert.equal(await evaluate('JSON.stringify(__dollarCharts)'),chart,'zero-inflation chart amounts are unchanged');
  await navigate();assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),0);assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().assumptions.homeGrowthRate'),.04);
});

test('assumptions defaults require preview and preserve asset overrides; investment changes reconcile',async()=>{
  await assumptionsFixture();const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await assumptionEdit('expectedSuperReturnPct',9);await assumptionButton('Restore app defaults…');
  assert.ok(await evaluate("!!document.querySelector('[data-defaults-preview]')"));assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
  await assumptionButton('Cancel');assert.equal(await evaluate("document.querySelector('[data-assumption=expectedSuperReturnPct]').value"),'9');
  await assumptionButton('Restore app defaults…');await assumptionButton('Use these defaults');assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
  assert.equal(await evaluate("document.querySelector('[data-assumption=expectedSuperReturnPct]').value"),'6.5');
  await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  assert.deepEqual(await evaluate('FFSStage1BrowserTestHooks.getPlan().assetItems'),JSON.parse(before).assetItems);
  await evaluate("document.querySelector('.fa-advanced').open=true");
  const asset=await evaluate("FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.investmentReturnMode==='totalReturn')");
  await assumptionEdit(`${asset.id}.expectedIncomeYieldPct`,2);await assumptionEdit(`${asset.id}.incomeTreatment`,'reinvest');await assumptionButton('Use plan return');
  await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  const amounts=await evaluate(`FFSCalculator.investmentReturnAmounts(FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id===${JSON.stringify(asset.id)}))`);
  assert.equal(amounts.cashIncome,0);assert.equal(amounts.totalReturn,amounts.retainedReturn);assert.ok(amounts.taxableIncome>0);
  const backup=await evaluate('__dollarTest.backup()');assert.equal(backup.plan.investing.expectedSuperReturnPct,6.5);
  const roundTrip=await evaluate(`__dollarTest.validateBackup(${JSON.stringify(backup)})`);assert.equal(roundTrip.plan.assetItems.find(a=>a.id===asset.id).incomeTreatment,'reinvest');
  await assumptionEdit('inflationPct',1);await assumptionButton('Undo unsaved edits');assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'2.5');
});

test('assumptions validation and failed persistence retain saved plan, forecasts and retryable edits',async()=>{
  await assumptionsFixture();const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),result=await evaluate('JSON.stringify(__dollarTest.result())');
  const storedBefore=await evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('ffs-personal-plan-v1:')||key==='ffs-current-plan-v3-mobile-dashboard-ux-test')))" );
  await assumptionEdit('inflationPct','');await assumptionButton('Save assumptions');
  assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').getAttribute('aria-invalid')"),'true');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
  await assumptionEdit('inflationPct',3.5);
  await evaluate("window.__faSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='ffs-current-plan-v3-mobile-dashboard-ux-test')throw new DOMException('Test storage quota','QuotaExceededError');return __faSetItem.call(this,key,value)}");
  try {
    await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.fa-errors').textContent.includes('Unable to save')"));
    assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),result);
    assert.equal(await evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('ffs-personal-plan-v1:')||key==='ffs-current-plan-v3-mobile-dashboard-ux-test')))"),storedBefore,'failed batch restores namespaced and legacy saved records');
    assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'3.5');
  } finally {await evaluate('Storage.prototype.setItem=window.__faSetItem;FFSStage1BrowserTestHooks.closeDurabilityDialog()');}
  await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),3.5);
});

test('assumptions protects against stale edits and exposes wage growth only for the applicable engine',async()=>{
  await assumptionsFixture();await assumptionEdit('inflationPct',8);
  await evaluate("(() => {const p=FFSStage1BrowserTestHooks.getPlan();p.investing.expectedSuperReturnPct=8;FFSStage1BrowserTestHooks.setPlan(p,'assumptions');})()");
  assert.ok(await evaluate("document.querySelector('.fa-state').textContent.includes('Saved plan changed')"));assert.ok(await evaluate("document.querySelector('.forecast-assumptions-form button[type=submit]').disabled"));
  await assumptionButton('Undo unsaved edits');assert.equal(await evaluate("document.querySelector('[data-assumption=expectedSuperReturnPct]').value"),'8');
  await evaluate("(() => {const p=FFSStage1BrowserTestHooks.getPlan();delete p.personal.retirementTiming;FFSStage1BrowserTestHooks.setPlan(p,'assumptions');})()");
  assert.ok(await evaluate("document.querySelector('[data-assumption=wageGrowthPct]').disabled"));
  await evaluate("(() => {const p=FFSStage1BrowserTestHooks.getPlan();p.personal.retirementTiming={people:[{id:'person1',fullRetirementAge:65,hasSemiRetirement:false},{id:'person2',fullRetirementAge:65,hasSemiRetirement:false}]};FFSStage1BrowserTestHooks.setPlan(p,'assumptions');})()");
  assert.equal(await evaluate("document.querySelector('[data-assumption=wageGrowthPct]').disabled"),false);
  assert.ok(await evaluate("document.querySelector('.fa-notice').textContent.length>0"));
  assert.deepEqual(browserMessages,[],'no runtime errors or CSP violations');
});

test('assumptions saves leave an opened saved retirement scenario and its forecasts unchanged',async()=>{
  await assumptionsFixture();await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
  await evaluate("__dollarTest.openRetirementSnapshot({...__dollarTest.retirementSaveContext(),id:'assumptions-snapshot'})");
  const before=await evaluate('JSON.stringify(__dollarTest.retirement())');
  await evaluate("document.querySelector('.fa-nav').click()");await assumptionEdit('expectedSuperReturnPct',8);await assumptionEdit('inflationPct',3);
  await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement())'),before);
  await select('future');await select('today');assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement())'),before);
  await evaluate("document.querySelector('.fa-advanced').open=true");
  const asset=await evaluate("FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.investmentReturnMode==='totalReturn')");
  await assumptionEdit(`${asset.id}.expectedTotalReturnPct`,1);await assumptionButton('Save assumptions');assert.ok(await evaluate("document.querySelector('.fa-errors').textContent.includes('Income yield cannot exceed')"));
  assert.equal(await evaluate(`FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id===${JSON.stringify(asset.id)}).expectedTotalReturnPct`),asset.expectedTotalReturnPct);
  await assumptionButton('Undo unsaved edits');
});

test('assumptions sample preview is isolated from saved personal data',async()=>{
  await assumptionsFixture();await assumptionEdit('inflationPct',3);await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));

  await evaluate("document.getElementById('heroDemoButton').click();FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('.fa-nav').click()");
  assert.ok(await evaluate("document.querySelector('.forecast-assumptions-workspace').textContent.includes('Sample plan:')"));
  const stored=await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')");
  await assumptionEdit('inflationPct',1);await assumptionButton('Apply to sample preview');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Sample preview updated')"));
  assert.equal(await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')"),stored);assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),1);
  assert.deepEqual(browserMessages,[]);
});

async function growthEdit(name,field,value){await evaluate(`(()=>{const input=document.querySelector('[data-growth-scenario="${name}"][data-growth-field="${field}"]');input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
for(const width of [1366,768,430,375])test(`growth comparisons preserve saved data and Base parity at ${width}px`,async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await assumptionsFixture();await select('future');
  const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),normal=await evaluate('JSON.stringify(__dollarTest.result())'),saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),storage=await evaluate('JSON.stringify({...localStorage})');
  await evaluate("document.querySelector('[data-growth-open]').focus()");await key('Enter');
  assert.equal(await evaluate("document.querySelectorAll('.growth-card').length"),3,JSON.stringify(browserMessages.slice(-10)));
  assert.equal(await evaluate("document.activeElement.textContent"),'Compare growth scenarios');
  assert.equal(await evaluate("document.querySelectorAll('.growth-card').length"),3);
  assert.equal(await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();return JSON.stringify(FFSGrowthScenarios.calculate(p,FFSGrowthScenarios.suggested(p).Base,__dollarTest.growthForecast).result)})()"),normal);
  const expected=await evaluate("__dollarTest.result().netWorthProjection.find(r=>r.year===10).closingBalance");
  close(amount(await evaluate("document.querySelector('[data-growth-result=Base] strong').textContent")),expected);
  assert.ok(await evaluate("(()=>{const panel=document.querySelector('.growth-panel').getBoundingClientRect();return panel.left>=0&&panel.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth})()"),JSON.stringify(await evaluate("[...document.querySelectorAll('.growth-panel *')].filter(n=>n.getBoundingClientRect().right>innerWidth).map(n=>({tag:n.tagName,cls:n.className,width:n.getBoundingClientRect().width,text:n.textContent.slice(0,80)}))")));
  assert.equal(await evaluate("(()=>{const cards=[...document.querySelectorAll('.growth-card')].map(n=>n.getBoundingClientRect());return cards[1].top>cards[0].top})()"),width<=800);
  await growthEdit('Base','expectedSuperReturnPct',9);
  assert.notEqual(amount(await evaluate("document.querySelector('[data-growth-result=Base] strong').textContent")),Math.round(expected));
  await evaluate("[...document.querySelectorAll('.growth-panel button')].find(n=>n.textContent==='Reset Base to saved values').click()");
  close(amount(await evaluate("document.querySelector('[data-growth-result=Base] strong').textContent")),expected);
  await growthEdit('Lower','expectedSuperReturnPct',-100);
  assert.match(await evaluate("document.querySelector('[data-growth-error=Lower]').textContent"),/greater than -100/);
  assert.equal(await evaluate("document.querySelector('[data-growth-result=Lower] strong')===null"),true);
  assert.equal(await evaluate("document.querySelector('[data-growth-scenario=Lower][data-growth-field=expectedSuperReturnPct]').getAttribute('aria-invalid')"),'true');
  await evaluate("[...document.querySelectorAll('.growth-panel button')].find(n=>n.textContent==='Reset to suggested bands').click()");
  await evaluate("document.querySelector('[data-growth-overrides=Higher]').click()");
  assert.equal(await evaluate('JSON.stringify({...localStorage})'),storage);
  await select('today');
  const todayExpected=await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan(),r=__dollarTest.result().netWorthProjection.find(r=>r.year===10);return FFSDollarBasis.displayedValue(r.closingBalance,10,p.investing.inflationPct,'today')})()");
  close(amount(await evaluate("document.querySelector('[data-growth-result=Base] strong').textContent")),todayExpected);
  close(amount(await evaluate("document.querySelector('.growth-table tbody tr:last-child td:nth-child(3)').textContent")),todayExpected);
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),normal);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
  await evaluate("document.querySelector('[data-growth-year]').value='5';document.querySelector('[data-growth-year]').dispatchEvent(new Event('change'))");
  assert.match(await evaluate("document.querySelector('.growth-table caption').textContent"),/Year 5/);
  await evaluate("document.querySelector('.growth-panel').scrollIntoView();document.querySelector('.growth-overrides').open=true");
  const evidence=path.join(root,'docs/growth-scenarios');await mkdir(evidence,{recursive:true});
  const clip=await evaluate("(()=>{const r=document.querySelector('.growth-panel').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(evidence,`comparison-${width}.png`),Buffer.from(shot.data,'base64'));
  await evaluate("[...document.querySelectorAll('.growth-panel button')].find(n=>n.textContent==='Close comparison').focus()");await key('Enter');
  assert.equal(await evaluate("document.activeElement.hasAttribute('data-growth-open')"),true);
  assert.equal(await evaluate("document.querySelector('.growth-panel').hidden"),true);
});
test('growth edits reset on plan, defaults and sample changes; unsaved assumption edits are excluded',async()=>{
  await navigate();await assumptionsFixture();await evaluate("document.querySelector('[data-growth-open]').click()");await growthEdit('Base','expectedSuperReturnPct',9);await assumptionEdit('expectedSuperReturnPct',11);
  await evaluate("[...document.querySelectorAll('.growth-panel button')].find(n=>n.textContent==='Reset Base to saved values').click()");
  assert.notEqual(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value"),'11');
  await growthEdit('Base','expectedSuperReturnPct',12);
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[0].plan,'assumptions');FFSStage1BrowserTestHooks.closeDurabilityDialog()");
  assert.equal(Number(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value")),await evaluate('FFSGrowthScenarios.savedValues(FFSStage1BrowserTestHooks.getPlan()).expectedSuperReturnPct'));
  await growthEdit('Base','expectedSuperReturnPct',12);
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFSCalculator.emptyPlan(),'assumptions');FFSStage1BrowserTestHooks.closeDurabilityDialog()");
  assert.equal(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value"),'6.5');
});
test('growth comparisons rerun only plan-linked retirement, preserving opened retirement snapshots and storage',async()=>{
  await navigate();await assumptionsFixture();
  await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.personal.retirementTiming={people:[{id:'person1',fullRetirementAge:65,hasSemiRetirement:false},{id:'person2',fullRetirementAge:65,hasSemiRetirement:false}]};FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-semi-action=calculate]').click();__dollarTest.openRetirementSnapshot({...__dollarTest.retirementSaveContext(),id:'growth-snapshot'});document.querySelector('.fa-nav').click()})()");
  const before=await evaluate('JSON.stringify(__dollarTest.retirement())'),normal=await evaluate('JSON.stringify(__dollarTest.result())'),stored=await evaluate('JSON.stringify({...localStorage})');
  await evaluate("document.querySelector('[data-growth-open]').click()");
  assert.match(await evaluate("document.querySelector('[data-growth-result=Base]').textContent"),/Plan-linked retirement: private funds exhausted/);
  assert.equal(await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();return JSON.stringify(FFSGrowthScenarios.calculate(p,FFSGrowthScenarios.suggested(p).Base,__dollarTest.growthForecast).result)})()"),normal);
  await growthEdit('Higher','expectedSuperReturnPct',10);await evaluate("document.querySelector('[data-growth-overrides=Higher]').click()");
  assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement())'),before);assert.equal(await evaluate('JSON.stringify({...localStorage})'),stored);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),normal);
  const evidence=path.join(root,'docs/growth-scenarios');await mkdir(evidence,{recursive:true});
  const clip=await evaluate("(()=>{const r=document.querySelector('.growth-panel').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(evidence,'plan-linked-retirement.png'),Buffer.from(shot.data,'base64'));
});
test('growth demo comparison and returning to personal plan never persist scenario edits',async()=>{
  await navigate();await assumptionsFixture();await assumptionEdit('inflationPct',3);await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  const stored=await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')");
  await evaluate("document.getElementById('heroDemoButton').click();FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('.fa-nav').click();document.querySelector('[data-growth-open]').click()");
  assert.match(await evaluate("document.querySelector('.growth-panel').textContent"),/Sample plan comparison/);
  const afterEntry=await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')");
  assert.deepEqual(JSON.parse(afterEntry).plan,JSON.parse(stored).plan);
  await growthEdit('Base','expectedSuperReturnPct',15);
  assert.equal(await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')"),afterEntry);
  await evaluate("document.querySelector('[data-demo-return]').click();FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('.fa-nav').click()");
  assert.equal(Number(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value")),await evaluate('FFSGrowthScenarios.savedValues(FFSStage1BrowserTestHooks.getPlan()).expectedSuperReturnPct'));
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')")).plan,JSON.parse(stored).plan);
  assert.deepEqual(browserMessages,[],'growth workflows produce no runtime errors or CSP violations');
});

test('assumptions presentation at requested desktop and phone widths',async()=>{
  const stage=process.env.FFS_ASSUMPTIONS_EVIDENCE==='before'?'before':'after';
  const evidence=path.join(root,'docs/assumptions-mobile');await mkdir(evidence,{recursive:true});
  for(const width of [375,390,430,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await assumptionsFixture();await select('future');
    const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),result=await evaluate('JSON.stringify(__dollarTest.result())');
    await evaluate("document.querySelector('[data-view-panel=assumptions]').scrollIntoView({block:'start'})");
    const clip=await evaluate("(()=>{const r=document.querySelector('[data-view-panel=assumptions]').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(evidence,`${stage}-${width}.png`),Buffer.from(shot.data,'base64'));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    if(stage==='after'){
      assert.ok(await evaluate("!!document.querySelector('.forecast-assumptions-workspace [data-growth-open]')"));
      assert.ok(await evaluate("(()=>{const p=document.querySelector('.forecast-assumptions-workspace').getBoundingClientRect(),b=document.querySelector('[data-growth-open]').getBoundingClientRect();return b.left>=p.left&&b.right<=p.right&&b.top>=p.top})()"));
      assert.equal(await evaluate("document.querySelector('.fa-advanced').open"),false);
      assert.ok(await evaluate("[...document.querySelectorAll('.fa-source')].every(n=>!n.textContent.includes('3.5000000000000004'))"));
      assert.ok(await evaluate("document.querySelector('.forecast-assumptions-actions button[type=submit]').disabled"));
      await evaluate("document.querySelector('[data-growth-open]').focus()");await key('Enter');await growthEdit('Base','expectedSuperReturnPct',9);
      await assumptionButton('Undo unsaved edits');
      assert.equal(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value"),'9','editor rerender preserves comparison session');
      assert.equal(await evaluate("document.querySelector('.growth-panel').hidden"),false);
      await evaluate("[...document.querySelectorAll('.growth-panel button')].find(n=>n.textContent==='Close comparison').click()");
      assert.ok(await evaluate("document.activeElement.hasAttribute('data-growth-open')"));
      assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
      assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),result);
    }
  }
  assert.deepEqual(browserMessages,[]);
});

test('dedicated Assumptions uses More tools and preserves the four main sections at every requested width',async()=>{
  const core=['dashboard','semiretirement','decision','weeklyplan'];
  const evidence=path.join(root,'docs/assumptions-navigation');await mkdir(evidence,{recursive:true});
  for(const width of [375,390,430,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await assumptionsFixture();
    const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),forecast=await evaluate('JSON.stringify(__dollarTest.result())');
    const history=await evaluate('JSON.stringify({length:history.length,state:history.state,url:location.href})');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.nav-primary-row button')].map(n=>n.textContent.trim())"),['My Freedom Progress','Explore My Future','Try a Change','My Weekly Mission']);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.nav-more-items button[data-view]')].map(n=>n.dataset.view)"),['assumptions','investments','super','setup','scenarios','reports','goals']);
    assert.equal(await evaluate("document.querySelectorAll('.dollar-basis-control [data-assumptions-open],.dollar-basis-control [data-view]').length"),0);
    for(const view of core){
      await evaluate(`document.querySelector('.nav-primary-row [data-view="${view}"]').click()`);
      assert.equal(await evaluate('document.body.dataset.activeView'),view);
      assert.equal(await evaluate(`document.querySelector('.nav-primary-row [data-view="${view}"]').getAttribute('aria-current')`),'page');
      assert.equal(await evaluate("document.querySelectorAll('.view-section:not(.hidden)').length"),1);
    }
    await evaluate("document.getElementById('moreNavigation').open=true;document.querySelector('.nav-more-items [data-view=assumptions]').focus()");await key('Enter');
    assert.equal(await evaluate('document.body.dataset.activeView'),'assumptions');
    assert.equal(await evaluate("document.querySelector('.fa-nav').getAttribute('aria-current')"),'page');
    assert.equal(await evaluate("document.getElementById('moreNavigation').classList.contains('has-active-view')"),true);
    assert.equal(await evaluate("document.activeElement===document.querySelector('#moreNavigation summary')"),true,'existing More tools focus return');
    assert.equal(await evaluate("document.querySelectorAll('#forecastAssumptionsWorkspace,.forecast-assumptions-form,[data-growth-open]').length"),3,'one editor and comparison mount');
    assert.match(await evaluate("document.querySelector('.fa-scope').textContent"),/not silently overwrite or recalculate/);
    assert.match(await evaluate("document.querySelector('.fa-scope').textContent"),/not legacy accumulation/);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
    assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),forecast);
    assert.equal(await evaluate('history.state.ffsWorkspace'),'assumptions');
    assert.equal(await evaluate('location.hash'),'#assumptions');
    await evaluate("document.getElementById('appWorkspace').scrollIntoView({behavior:'instant',block:'start'})");
    assert.ok(await evaluate("document.querySelector('.nav-primary-row').getBoundingClientRect().top>=document.querySelector('body > div > header').getBoundingClientRect().bottom"),'all four sections remain below the sticky header');
    if(width>=1024)assert.ok(await evaluate("document.querySelector('.forecast-assumptions-workspace h2').getBoundingClientRect().top>=document.querySelector('body > div > header').getBoundingClientRect().bottom"),'workspace heading is not obscured by sticky header');
    // Chromium's beyond-viewport captures can paint a sticky site header over
    // the crop. Visibility assertions above use its real position; only the
    // evidence capture makes that unrelated header static, then restores it.
    const headerPosition=await evaluate("(()=>{const h=document.querySelector('body > div > header'),position=h.style.position;h.style.position='static';return position})()");
    const clip=await evaluate("(()=>{const r=document.getElementById('appWorkspace').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(evidence,`workspace-${width}.png`),Buffer.from(shot.data,'base64'));
    await evaluate(`document.querySelector('body > div > header').style.position=${JSON.stringify(headerPosition)}`);
    if([375,1366].includes(width)){
      await evaluate("document.querySelector('[data-growth-open]').click()");
      const rect=await evaluate("(()=>{const r=document.querySelector('.growth-panel').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:rect});await writeFile(path.join(evidence,`comparison-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  }
  assert.deepEqual(browserMessages,[]);
});

test('Assumptions round trips retain unsaved edits, comparison isolation, save/undo/defaults and other tool routes',async()=>{
  await navigate();await assumptionsFixture();
  const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),result=await evaluate('JSON.stringify(__dollarTest.result())'),stored=await evaluate('JSON.stringify({...localStorage})');
  await assumptionEdit('inflationPct',4);await evaluate("document.querySelector('[data-growth-open]').click()");await growthEdit('Base','expectedSuperReturnPct',9);
  for(const view of ['decision','investments','super','reports','scenarios']){
    await evaluate(`document.querySelector('.workspace-nav [data-view="${view}"]').click()`);assert.equal(await evaluate('document.body.dataset.activeView'),view);
    await evaluate("document.querySelector('.fa-nav').click()");
    assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'4');
    assert.equal(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value"),'9');
    assert.match(await evaluate("document.querySelector('.forecast-assumptions-workspace > .fa-state').textContent"),/Unsaved edits/);
  }
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),result);
  // Reports have existing automatic snapshot behavior; compare the financial plan,
  // not unrelated history/report UI storage generated by visiting that tool.
  assert.equal(await evaluate("localStorage.getItem('ffs-current-plan-v3-mobile-dashboard-ux-test')"),JSON.parse(stored)['ffs-current-plan-v3-mobile-dashboard-ux-test']??null);
  await assumptionButton('Undo unsaved edits');assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'2.5');
  assert.equal(await evaluate("document.querySelector('[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]').value"),'9');
  await assumptionEdit('inflationPct',0);await assumptionButton('Save assumptions');await waitFor(()=>evaluate("document.querySelector('.forecast-assumptions-status').textContent.includes('Assumptions saved')"));
  assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),0);
  await evaluate("document.querySelector('.nav-primary-row [data-view=dashboard]').click();document.querySelector('.fa-nav').click()");
  assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'0');
  await assumptionButton('Restore app defaults…');await assumptionButton('Use these defaults');assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),0);
  await assumptionButton('Undo unsaved edits');assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'0');
  assert.deepEqual(browserMessages,[]);
});

for (const width of [375,390,768,1366]) test(`mobile annual forecast readable expanded details at ${width}px`, async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  await navigate();await fixture();await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
  await evaluate(`__dollarTest.configureRetirement({'people.0.name':'Alexandria-Marie Long Household Name','people.1.name':'Christopher Long Household Name','accessibleInvestments.openingBalance':9876543210})`);
  const model=await evaluate('JSON.stringify(__dollarTest.retirement().result)'),plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  await evaluate("document.querySelector('[data-semi-detail-state=rr-annual]').open=true;window.scrollTo({top:scrollY+document.querySelector('[data-semi-detail-state=rr-annual]').getBoundingClientRect().top-80,behavior:'instant'})");
  const phase=mobileBefore?'before':'after';await mobileScreenshot(`${phase}/annual-collapsed-${width}.png`);
  await evaluate(`(()=>{const annual=document.querySelector('[data-semi-detail-state=rr-annual]');const year=annual.querySelector('.maf-year')||annual.querySelector('.semi-retirement-annual-card details');year.open=true;window.scrollTo({top:scrollY+year.getBoundingClientRect().top-80,behavior:'instant'});})()`);
  if(width>900)await evaluate("document.querySelector('.semi-retirement-annual-table tbody details').open=true");
  await mobileScreenshot(`${phase}/annual-expanded-${width}.png`);
  const measure=await evaluate(`(()=>{const root=document.querySelector('[data-semi-detail-state=rr-annual]'),cards=root.querySelector('.semi-retirement-annual-cards'),scroll=root.querySelector('.semi-retirement-projection-scroll'),year=root.querySelector('.maf-year');
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,tableVisible:getComputedStyle(scroll).display!=='none',tableOverflow:scroll.scrollWidth>scroll.clientWidth+1,
      cardsVisible:getComputedStyle(cards).display!=='none',mobileYearCount:root.querySelectorAll('.maf-year').length,
      clipped:year?[...year.querySelectorAll('summary,section,section > div,span,strong')].filter(n=>n.getClientRects().length).filter(n=>{const b=n.getBoundingClientRect();return b.left<-.5||b.right>innerWidth+.5||n.scrollWidth>n.clientWidth+1;}).map(n=>({tag:n.tagName,text:n.textContent.slice(0,80)})):[],
      summaryHeight:year?.querySelector('summary')?.getBoundingClientRect().height,
      people:year?[...year.querySelectorAll('.maf-person > h5')].map(n=>n.textContent):[]};})()`);
  annualMobileEvidence.push({width,phase,...measure});
  if(!mobileBefore){
    if(width<=900){assert.equal(measure.tableVisible,false);assert.equal(measure.cardsVisible,true);assert.ok(measure.documentWidth<=width);assert.deepEqual(measure.clipped,[]);assert.ok(measure.summaryHeight>=44);assert.equal(measure.people.length,2);assert.ok(measure.people[0].includes('Alexandria'));assert.ok(measure.people[1].includes('Christopher'));
      const parity=await evaluate(`(()=>{const t=document.createElement('template');t.innerHTML=__dollarTest.originalRetirementHtml();const original=[...t.content.querySelectorAll('.semi-retirement-annual-cards .semi-retirement-annual-detail section > div')].map(n=>n.textContent.trim()).sort();const actual=[...document.querySelectorAll('.maf-year .semi-retirement-annual-detail .maf-value-row')].map(n=>n.textContent.trim()).sort();return JSON.stringify(original)===JSON.stringify(actual);})()`);assert.equal(parity,true,'Every original label/value row is retained exactly');
      const ownerParity=await evaluate(`(()=>{const t=document.createElement('template');t.innerHTML=__dollarTest.originalRetirementHtml();const originals=[...t.content.querySelectorAll('.semi-retirement-annual-card')].map(card=>[...card.querySelectorAll('.semi-retirement-annual-detail > section')].filter(s=>[...s.querySelectorAll(':scope > div > span')].some(n=>n.textContent==='Gross employment income')).map(s=>({person:s.querySelector('h5').textContent,rows:[...s.querySelectorAll(':scope > div')].map(n=>n.textContent.trim()).sort()})));const shown=[...document.querySelectorAll('.maf-year')].map(y=>[...y.querySelectorAll('.maf-person')].map(s=>({person:s.querySelector('h5').textContent,rows:[...s.querySelectorAll('.maf-value-row')].map(n=>n.textContent.trim()).sort()})));return JSON.stringify(originals)===JSON.stringify(shown);})()`);assert.equal(ownerParity,true,'Rows remain associated with the correct person in every year');
      const beforeRuns=await evaluate('window.__retirementRuns');await evaluate("document.querySelector('.maf-year > summary').focus()");await key('Enter');assert.equal(await evaluate("document.querySelector('.maf-year').open"),false);await key('Enter');assert.equal(await evaluate("document.querySelector('.maf-year').open"),true);assert.equal(await evaluate('window.__retirementRuns'),beforeRuns);
      const taps=[];await journeyTap('.maf-year > summary',taps);assert.equal(await evaluate("document.querySelector('.maf-year').open"),false);await journeyTap('.maf-year > summary',taps);assert.equal(await evaluate("document.querySelector('.maf-year').open"),true);assert.ok(taps.every(t=>t.status==='pointer-click'),JSON.stringify(taps));
      const jump=await evaluate(`(()=>{const n=document.querySelector('[data-maf-jump]');n.value=n.options[3].value;n.dispatchEvent(new Event('change',{bubbles:true}));return {year:n.value,focused:document.activeElement.closest('.maf-year')?.dataset.semiDetailState,top:document.activeElement.getBoundingClientRect().top,header:document.querySelector('header').getBoundingClientRect().bottom};})()`);
      assert.equal(jump.focused,'maf-year-'+jump.year);assert.ok(jump.top>=jump.header,'Jump target stays below sticky header');assert.equal(await evaluate('window.__retirementRuns'),beforeRuns);
      await select('today');assert.equal(await evaluate("document.querySelector('.maf-year').open"),true,'Year stays expanded when dollar basis changes');
      const values=await evaluate(`(()=>{const t=document.createElement('template');t.innerHTML=__dollarTest.originalRetirementHtml();return {before:[...t.content.querySelectorAll('.semi-retirement-annual-cards .semi-retirement-annual-detail section > div')].map(n=>n.textContent.trim()).sort(),after:[...document.querySelectorAll('.maf-year .semi-retirement-annual-detail .maf-value-row')].map(n=>n.textContent.trim()).sort()};})()`);assert.deepEqual(values.after,values.before,'Today-dollar values are copied, not recalculated');
    }else{assert.equal(measure.tableVisible,true);assert.equal(measure.cardsVisible,false);}
    const desktopParity=await evaluate(`(()=>{const t=document.createElement('template');t.innerHTML=__dollarTest.originalRetirementHtml();return t.content.querySelector('.semi-retirement-annual-table').textContent===document.querySelector('.semi-retirement-annual-table').textContent;})()`);assert.equal(desktopParity,true,'Desktop table and all its data are unchanged');
    assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement().result)'),model);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
  }
  await mkdir(mobileReviewDirectory,{recursive:true});await writeFile(path.join(mobileReviewDirectory,`${phase}-annual-metrics.json`),JSON.stringify(annualMobileEvidence,null,2)+'\n');
});

async function journeyTap(selector, operations) {
  // Follow new native disclosures with a real summary tap before targeting a
  // control inside; keep the historical journey's actions and assertions.
  const closed=await evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)});let n=target?.matches('summary')?target.parentElement?.parentElement:target?.parentElement;const keys=[];while(n){if(n.matches('details.s3-disclosure:not([open])'))keys.unshift(n.dataset.s3Key);n=n.parentElement;}return keys;})()`);
  for(const key of closed)await journeyTap(`[data-s3-key="${key}"] > summary`,operations);
  const exists=await evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.getClientRects().length);if(!node)return null;node.scrollIntoView({block:'center',behavior:'instant'});return true;})()`);
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  // Native details can finish scroll anchoring after their layout frame.
  // Re-measure after scrolling the settled layout; never bypass hit testing.
  if(exists){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
  const target=exists?await evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.getClientRects().length);const b=node.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;return {x,y,label:node.textContent.trim().slice(0,90),hit:node.contains(document.elementFromPoint(x,y)),cover:document.elementFromPoint(x,y)?.outerHTML.slice(0,220)};})()`):null;
  if(target&&!target.hit&&selector!=='[data-durability-action=dismiss-prompt]'&&await evaluate("[...document.querySelectorAll('[data-durability-action=dismiss-prompt]')].some(n=>n.getClientRects().length)")){await mobileScreenshot(`journey/${await evaluate('innerWidth')}-backup-notice.png`);operations.push({event:'Backup prompt interrupted tap',selector});await journeyTap('[data-durability-action=dismiss-prompt]',operations);return journeyTap(selector,operations);}
  if(!target){operations.push({selector,status:'not-visible'});return false;}
  if(!target.hit){operations.push({selector,label:target.label,x:target.x,y:target.y,cover:target.cover,status:'blocked-tap; DOM fallback for continued audit'});await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
  else{await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});operations.push({selector,label:target.label,status:'pointer-click'});}
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');return true;
}
async function journeyNavigate(view, operations){
  if(await evaluate(`(()=>{const n=document.querySelector('.nav-more-items [data-view="${view}"]');return Boolean(n&&!n.getClientRects().length);})()`))await journeyTap('#moreNavigation > summary',operations);
  assert.ok(await journeyTap(`.workspace-nav [data-view="${view}"]`,operations),'Navigation exists: '+view);
  assert.equal(await evaluate('document.body.dataset.activeView'),view);
}

test('first-time household journey audit at phone tablet and desktop widths',async()=>{
  const evidence=[];
  for(const width of [375,390,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await evaluate('localStorage.clear()');await navigate();const operations=[];
    const record=async(slug,view=null)=>{
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      if(await evaluate("[...document.querySelectorAll('[data-durability-action=dismiss-prompt]')].some(n=>n.getClientRects().length)")){await mobileScreenshot(`journey/${width}-backup-notice.png`);operations.push({event:'backup notice interrupted current task',screen:slug});await journeyTap('[data-durability-action=dismiss-prompt]',operations);}
      if(view)await evaluate(`(()=>{const root=document.querySelector('[data-view-panel="${view}"]');const focus=${slug.endsWith('-error')}?root.querySelector('input:invalid,select:invalid,textarea:invalid,[aria-invalid=true]'):null;window.scrollTo({top:scrollY+(focus||root).getBoundingClientRect().top-100,behavior:'instant'});})()`);
      else await evaluate("window.scrollTo({top:0,behavior:'instant'})");
      await mobileScreenshot(`journey/${width}-${slug}.png`);
      const facts=await evaluate(`(()=>{const root=${view?`document.querySelector('[data-view-panel="${view}"]')`:'document.querySelector("#intro")||document.body'},visible=n=>{if(!n.getClientRects().length)return false;for(let p=n.parentElement;p&&p!==root;p=p.parentElement)if(p.matches('details:not([open])')&&!p.querySelector(':scope > summary')?.contains(n))return false;return true;};
        const controls=[...root.querySelectorAll('button,summary,input,select,textarea')].filter(visible);
        return {activeView:document.body.dataset.activeView,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,
          headings:[...root.querySelectorAll('h2,h3,h4')].filter(visible).slice(0,12).map(n=>n.textContent.trim()),
          controls:controls.length,viewportControls:controls.filter(n=>{const b=n.getBoundingClientRect();return b.bottom>64&&b.top<innerHeight;}).length,smallTargets:controls.filter(n=>n.getBoundingClientRect().height<44).map(n=>({text:(n.getAttribute('aria-label')||n.textContent||n.name||n.id).trim().slice(0,70),height:Math.round(n.getBoundingClientRect().height)})).slice(0,18),
          actions:[...root.querySelectorAll('button,summary')].filter(visible).slice(0,16).map(n=>n.textContent.trim().slice(0,90)),
          inputs:[...root.querySelectorAll('input,select,textarea')].filter(visible).slice(0,12).map(n=>({label:n.closest('label')?.textContent.trim().slice(0,110)||n.getAttribute('aria-label')||n.id,type:n.type,value:n.type==='password'?'':n.value})),
          invalidInputs:[...root.querySelectorAll('input,select,textarea')].filter(n=>visible(n)&&!n.validity.valid).map(n=>({label:n.closest('label')?.textContent.trim().slice(0,100)||n.id,message:n.validationMessage})),
          errors:[...root.querySelectorAll('[role=alert],.field-error,.fa-errors')].filter(visible).map(n=>n.textContent.trim()).filter(Boolean).slice(0,5),
          horizontalRegions:[...root.querySelectorAll('*')].filter(n=>visible(n)&&n.clientWidth>0&&n.scrollWidth>n.clientWidth+1&&['auto','scroll'].includes(getComputedStyle(n).overflowX)).map(n=>({element:n.id||n.className,viewport:n.clientWidth,content:n.scrollWidth,label:n.getAttribute('aria-label')})).slice(0,12),
          openSections:[...root.querySelectorAll('details[open]')].filter(visible).length,
          text:root.innerText.slice(0,5000)};})()`);
      evidence.push({width,screen:slug,screenshot:publishedJourneyScreenshot(width,slug)?`journey/${width}-${slug}.png`:null,reproductionCapture:`test-results/mobile-usability/journey/${width}-${slug}.png`,...facts});
      await writeFile(path.join(mobileReviewDirectory,'journey-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
    };
    await record('first-visit');
    await journeyTap('#heroStartButton',operations);await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
    await record('my-plan-empty','setup');
    await evaluate(`(()=>{for(const [path,value] of [['personal.person1Name','Jamie Example'],['personal.person1Age','32']]){const n=document.querySelector('[data-path="'+path+'"]');if(!n)throw Error('Missing first-time field '+path);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await journeyNavigate('dashboard',operations);await journeyNavigate('setup',operations);assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'),'Jamie Example');
    await journeyTap('#wizardNextButton',operations);await record('my-plan-next','setup');
    await navigate();evidence.push({width,check:'partial-setup-after-reload',retained:await evaluate("FFSStage1BrowserTestHooks.getPlan().personal.person1Name==='Jamie Example'")});
    // Existing public sample used as a synthetic personal-plan test fixture for
    // populated screens; this is not a claim that a novice completed all inputs.
    await fixture();await evaluate("document.querySelector('.workspace-nav').scrollIntoView({block:'start',behavior:'instant'})");await mobileScreenshot(`journey/${width}-navigation.png`);
    for(const view of ['dashboard','setup','goals','semiretirement','weeklyplan','assumptions','investments','super','decision','scenarios','reports']){
      await journeyNavigate(view,operations);await record(view,view);
      if(view==='semiretirement'){
        await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="people.0.hasSemiRetirement"]');n.value='true';n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        await journeyTap('[data-semi-action=calculate]',operations);await record('semi-retirement','semiretirement');
        const draftBefore=await evaluate('JSON.stringify(__dollarTest.retirement().inputs)');
        await journeyNavigate('goals',operations);await journeyNavigate('semiretirement',operations);
        const retained=await evaluate('JSON.stringify(__dollarTest.retirement().inputs)')===draftBefore;evidence.push({width,check:'retirement-draft-navigation',retained});
      }
      if(view==='weeklyplan'){
        if(await evaluate("Boolean(document.querySelector('[data-weekly-action=create-plan]'))")){await journeyTap('[data-weekly-action=create-plan]',operations);await record('weekly-created','weeklyplan');}
      }
      if(view==='assumptions'){
        const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');await assumptionEdit('inflationPct',4);
        await journeyNavigate('investments',operations);await journeyNavigate('assumptions',operations);
        assert.equal(await evaluate("document.querySelector('[data-assumption=inflationPct]').value"),'4');assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
        await assumptionEdit('inflationPct',-100);await evaluate("document.querySelector('#forecastAssumptionsWorkspace form').requestSubmit()");await record('assumptions-error','assumptions');
        await assumptionButton('Undo unsaved edits');await assumptionButton('Restore app defaults…');await record('defaults-preview','assumptions');
        await evaluate("[...document.querySelectorAll('[data-defaults-preview] button')].find(n=>n.textContent==='Cancel').click()");await assumptionButton('Undo unsaved edits');assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
      }
      if(view==='decision'){
        if(await evaluate("Boolean(document.querySelector('[data-what-if]'))")){await journeyTap('[data-what-if]',operations);await record('change-preview','decision');}
      }
      if(view==='scenarios'){
        const savedPlanBefore=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
        await evaluate(`(()=>{const n=document.getElementById('scenarioName');n.value='Usability review example';n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
        await journeyTap('#saveScenarioPanelButton',operations);const id=await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Usability review example')?.id");assert.ok(id);
        await record('scenario-saved','scenarios');await journeyTap(`[data-compare-scenario="${id}"]`,operations);await record('scenario-compare','scenarios');
        await journeyTap(`[data-open-scenario="${id}"]`,operations);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),savedPlanBefore);evidence.push({width,check:'open-saved-scenario',activeView:await evaluate('document.body.dataset.activeView'),planUnchanged:true});
      }
    }
    assert.deepEqual(operations.filter(operation=>operation.status&&operation.status!=='pointer-click'),[],'All journey actions are reachable with real pointer input');
    evidence.push({width,operations});
  }
  await writeFile(path.join(mobileReviewDirectory,'journey-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
});

test('mobile annual forecast single-person shortfall notes remain readable',async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:true});await navigate();
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[0].plan,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-semi-action=calculate]').click();__dollarTest.configureRetirement({'household.fullRetirementLifestyleSpending':500000})");
  const model=await evaluate('JSON.stringify(__dollarTest.retirement().result)');
  for(const width of [375,390,768]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    const check=await evaluate(`(()=>{document.querySelector('[data-semi-detail-state=rr-annual]').open=true;const y=document.querySelector('.maf-year.has-warning');if(!y)return {found:false};y.open=true;y.querySelector('summary').scrollIntoView({block:'start',behavior:'instant'});return {found:true,people:y.querySelectorAll('.maf-person').length,warning:y.querySelector('.semi-retirement-row-warning')?.textContent,summary:y.querySelector('summary').textContent,clipped:[...y.querySelectorAll('section,span,strong,li')].filter(n=>n.getClientRects().length).filter(n=>n.getBoundingClientRect().right>innerWidth+1||n.scrollWidth>n.clientWidth+1).map(n=>n.textContent.slice(0,50))};})()`);
    assert.equal(check.found,true);assert.equal(check.people,1);assert.ok(check.warning);assert.ok(check.summary.includes('Funding shortfall'));assert.deepEqual(check.clipped,[]);
    assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement().result)'),model);
    if(width===375)await mobileScreenshot('after/annual-shortfall-375.png');
  }
});

const stage2Phase=process.env.FFS_STAGE2_PHASE==='before'?'before':'after';
async function stage2Shot(screen,width,selector){
  const dir=path.join(root,'docs/mobile-usability-stage2',stage2Phase);await mkdir(dir,{recursive:true});
  const clip=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()`);
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(dir,`${screen}-${width}.png`),Buffer.from(shot.data,'base64'));
}
test('Stage 2 before and after screen evidence at all required widths',async()=>{
  for(const width of [375,390,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await evaluate('localStorage.clear()');await navigate();await fixture();await select('future');
    await evaluate("FFSStage1BrowserTestHooks.showWorkspace('decision')");await stage2Shot('u02',width,'#whatIfResult');
    await evaluate("FFSStage1BrowserTestHooks.setPlan(FFSCalculator.emptyPlan(),'setup');FFSStage1BrowserTestHooks.setWizardStep(0);FFSStage1BrowserTestHooks.closeDurabilityDialog()");await stage2Shot('u03',width,'.wizard-shell');
    await fixture();await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
    await stage2Shot('u04',width,'[data-semi-adjustments]');
    await evaluate("FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.getElementById('scenarioName').value='Stage 2 historical snapshot';document.getElementById('saveScenarioPanelButton').click()");
    await stage2Shot('u05',width,'#scenarioList');
  }
});

test('U02 labelled mobile comparisons retain every original money string through positive, negative, custom and saved changes',async()=>{
  const records=[];
  for(const width of [375,390,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await fixture();await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.assetItems.find(a=>a.category==='cash').value=100000;FFSStage1BrowserTestHooks.setPlan(p,'decision')})()");
    const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
    for(const preset of ['expenses-500','car-50000','invest-250']){
      // Exercise real preset IDs rather than injecting financial results.
      const id=await evaluate(`(()=>{const nodes=[...document.querySelectorAll('[data-what-if]')];return nodes.find(n=>n.dataset.whatIf===${JSON.stringify(preset)}).dataset.whatIf})()`);
      await evaluate(`document.querySelector('[data-what-if="${id}"]').click()`);
      for(const basis of ['future','today']){await select(basis);await evaluate("FFSMobileUsabilityStage2.decorateComparison(document.getElementById('whatIfResult'))");
        const parity=await evaluate(`(()=>{const t=document.createElement('template');t.innerHTML=__stage2Test.originalWhatIfHtml();const expected=[...t.content.querySelectorAll('.what-if-forecast-row:not(.what-if-forecast-head)')].map(row=>[...row.children].map(n=>n.textContent));const actual=[...document.querySelectorAll('.what-if-forecast-row:not(.what-if-forecast-head)')].map(row=>[row.firstElementChild.textContent,...[...row.querySelectorAll('.stage2-comparison-value')].map(n=>n.textContent)]);return {expected,actual,overflow:[...document.querySelectorAll('.what-if-forecast,.what-if-forecast-row')].some(n=>n.scrollWidth>n.clientWidth+1),page:document.documentElement.scrollWidth>innerWidth}})()`);
        for (const expected of parity.expected) assert.ok(parity.actual.some(actual=>JSON.stringify(actual)===JSON.stringify(expected)),JSON.stringify({expected,actual:parity.actual}));assert.equal(parity.page,false);assert.equal(parity.overflow,false);records.push({width,basis,preset,rows:parity.actual});
      }
    }
    await evaluate("document.querySelector('[data-what-if-custom-toggle]').click();document.querySelector('[data-what-if-custom-kind]').value='invest';document.querySelector('[data-what-if-custom-kind]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-what-if-custom-amount]').value='1000';document.querySelector('[data-what-if-custom-amount]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-what-if-custom-apply]').click()");
    assert.ok(await evaluate("document.querySelector('.what-if-metrics').textContent.includes('−')"),'custom investing gives negative available-cash impact');
    const parity=await evaluate("(()=>{const t=document.createElement('template');t.innerHTML=__stage2Test.originalWhatIfHtml();return [...t.content.querySelectorAll('.what-if-forecast-row:not(.what-if-forecast-head)')].map(r=>[...r.children].slice(1).map(n=>n.textContent)).flat().every(value=>[...document.querySelectorAll('.stage2-comparison-value')].some(n=>n.textContent===value))})()");assert.equal(parity,true);
    assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  }
  const dir=path.join(root,'docs/mobile-usability-stage2');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'comparison-parity.json'),JSON.stringify(records,null,2)+'\n');
});

test('U03 setup progress is step-based for blank and partial plans and navigation retains inputs',async()=>{
  await navigate();await evaluate("FFSStage1BrowserTestHooks.setPlan(FFSCalculator.emptyPlan(),'setup');FFSStage1BrowserTestHooks.closeDurabilityDialog()");
  for(const step of [0,1,6,7,8,1,0]){await evaluate(`FFSStage1BrowserTestHooks.setWizardStep(${step})`);assert.doesNotMatch(await evaluate("document.querySelector('.wizard-progress').textContent"),/% Complete|Setup complete/);if(step<7)assert.equal(await evaluate("document.getElementById('wizardStepLabel').textContent"),`Step ${step+1} of 7`);}
  await evaluate("(()=>{const n=document.querySelector('[data-path=\"personal.person1Name\"]');n.value='Stage Two Household';n.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await evaluate("document.getElementById('wizardNextButton').click();document.getElementById('wizardPrevButton').click()");
  assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'),'Stage Two Household');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('dashboard');FFSStage1BrowserTestHooks.showWorkspace('setup')");assert.equal(await evaluate("document.querySelector('[data-path=\"personal.person1Name\"]').value"),'Stage Two Household');
});

test('U04 calculated and manual retirement spending values remain exact and invalid edits never coerce draft values',async()=>{
  await navigate();await fixture();await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
  const selector='#semi-adjust-household-fullRetirementLifestyleSpending',plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  assert.equal(await evaluate(`document.querySelector('${selector}').checkValidity()`),true);
  const initial=await evaluate('__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending');
  for(const value of [75490,75000,75500,0,75490.37]){
    await evaluate(`(()=>{const n=document.querySelector('${selector}');n.value=${value};n.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await waitFor(()=>evaluate(`document.querySelector('${selector}')?.checkValidity()&&Math.abs(__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending-${value})<0.000001`));
    await new Promise(r=>setTimeout(r,450));
    assert.equal(await evaluate('__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending'),value);
    const parity=await evaluate("(()=>{const d=__stage2Test.retirementDraft(),r=FFSSemiRetirementUi.runSemiRetirementProjection(FFSSemiRetirementProjection,d);return JSON.stringify(r.result)===JSON.stringify(__dollarTest.retirement().result)})()");assert.equal(parity,true);
  }
  for(const invalid of ['-1','']){await evaluate(`(()=>{const n=document.querySelector('${selector}');n.value=${JSON.stringify(invalid)};n.dispatchEvent(new Event('input',{bubbles:true}))})()`);assert.equal(await evaluate(`document.querySelector('${selector}').checkValidity()`),false);assert.equal(await evaluate('__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending'),75490.37);}
  await evaluate(`document.querySelector('${selector}').value='75490';document.querySelector('${selector}').dispatchEvent(new Event('input',{bubbles:true}))`);await new Promise(r=>setTimeout(r,450));
  await evaluate("document.querySelector('[data-semi-action=reset-adjustments]').click()");assert.equal(await evaluate('__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending'),initial);
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
});

test('U05 snapshots are read-only, metadata is not a financial change, and current-plan comparison preserves history',async()=>{
  await navigate();await fixture();await evaluate("FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.getElementById('scenarioName').value='A very long historical snapshot name — family review and notes';document.getElementById('scenarioNotes').value='Historical context only';document.getElementById('saveScenarioPanelButton').click()");
  const id=await evaluate("__dollarTest.savedScenarios().find(s=>s.name.startsWith('A very long')).id"),history=await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  assert.doesNotMatch(await evaluate(`document.querySelector('[data-open-scenario="${id}"]').closest('article').querySelector('.scenario-card-grid').textContent`),/Saved plan snapshot|Current working plan/);
  assert.equal(await evaluate(`document.querySelector('[data-open-scenario="${id}"]').textContent`),'View saved snapshot');
  await evaluate(`document.querySelector('[data-open-scenario="${id}"]').click()`);assert.match(await evaluate("document.querySelector('#stage2SnapshotViewer').textContent"),/Read-only view/);
  await evaluate(`document.querySelector('[data-stage2-current="${id}"]').click()`);assert.match(await evaluate("document.querySelector('#stage2SnapshotViewer details').textContent"),/No recorded plan-input differences/);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),history);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  await evaluate("[...document.querySelectorAll('#stage2SnapshotViewer button')].find(n=>n.textContent==='Return to current plan').click()");assert.equal(await evaluate('document.body.dataset.activeView'),'dashboard');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  assert.deepEqual(browserMessages,[]);
});

test('U02 saved Try a Change settings reopen correct figures and large negative comparisons never clip',async()=>{
  await navigate();await fixture();await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.assetItems.find(a=>a.category==='cash').value=100000;FFSStage1BrowserTestHooks.setPlan(p,'decision');document.querySelector('[data-what-if=car-50000]').click()})()");
  const shown=await evaluate("[...document.querySelectorAll('.stage2-comparison-value')].map(n=>n.textContent)");assert.ok(shown.some(s=>s.includes('−')),'car purchase has a negative forecast difference');
  const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await evaluate("document.querySelector('[data-save-stage-g-scenario=decision-what-if]').click();document.getElementById('stageGScenarioName').value='Stage Two Car Comparison';document.querySelector('[data-scenario-save-action=save]').click()");
  const id=await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Stage Two Car Comparison').id"),history=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('decision');document.querySelector('[data-what-if=invest-250]').click();FFSStage1BrowserTestHooks.showWorkspace('scenarios')");
  await evaluate(`document.querySelector('[data-open-scenario="${id}"]').click()`);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.stage2-comparison-value')].map(n=>n.textContent)"),shown);
  assert.ok(await evaluate("document.querySelector('.stage2-comparison-label').textContent.includes('Saved base plan')"));
  assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),history);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  for(const width of [375,390,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.assetItems.find(a=>a.category==='shares').value=9876543210;FFSStage1BrowserTestHooks.setPlan(p,'decision');document.querySelector('[data-what-if=car-50000]').click();document.querySelector('.what-if-forecast-row:not(.what-if-forecast-head) strong').textContent='Long household comparison description — projected net worth including every recorded financial asset and debt';})()");
    assert.ok(await evaluate("[...document.querySelectorAll('.what-if-forecast,.what-if-forecast-row,.stage2-comparison-value')].every(n=>n.scrollWidth<=n.clientWidth+1||getComputedStyle(n).display==='inline')"));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.ok(await evaluate("document.querySelector('.stage2-comparison-value').textContent.length>10"));
    await stage2Shot('u02-negative-large',width,'#whatIfResult');
  }
});

test('U04 spending comparison, calculate, saved inputs and retirement editing retain exact currency and saved history',async()=>{
  await navigate();await fixture();await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click();__dollarTest.configureRetirement({'household.fullRetirementLifestyleSpending':75490.37})");
  const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await evaluate("document.querySelector('[data-semi-action=compare]').click()");
  const validity=await evaluate("[...document.querySelectorAll('[data-semi-comparison-input=\"household.fullRetirementLifestyleSpending\"]')].map(n=>({value:n.value,step:n.step,valid:n.checkValidity()}))");assert.ok(validity.length>0);assert.ok(validity.every(n=>n.step==='any'&&n.valid));
  await evaluate("document.querySelector('[data-save-stage-g-scenario=retirement]').click();document.getElementById('stageGScenarioName').value='Exact Retirement Spending';document.querySelector('[data-scenario-save-action=save]').click()");
  const id=await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Exact Retirement Spending').id"),history=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  assert.equal(await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Exact Retirement Spending').scenarioInputSnapshot.household.fullRetirementLifestyleSpending"),75490.37);
  assert.equal(await evaluate(`document.querySelector('[data-open-scenario="${id}"]').textContent`),'Open retirement scenario');
  assert.ok(await evaluate(`document.querySelector('[data-open-scenario="${id}"]').closest('article').textContent.includes('Changes from the current plan')`),'retirement differences keep their live current-plan scope');
  await evaluate(`document.querySelector('[data-stage2-view="${id}"]').click()`);assert.match(await evaluate("document.querySelector('#stage2SnapshotViewer').textContent"),/Read-only view/);
  await evaluate(`document.querySelector('[data-open-scenario="${id}"]').click()`);assert.equal(await evaluate('document.body.dataset.activeView'),'semiretirement');assert.equal(await evaluate('__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending'),75490.37);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),history);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
});

test('U05 current input differences and displayed snapshot values follow existing basis formatting without changing stored results',async()=>{
  await navigate();await fixture();await select('future');await evaluate("FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.getElementById('scenarioName').value='Input Difference Check';document.getElementById('saveScenarioPanelButton').click()");
  const id=await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Input Difference Check').id"),history=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  await evaluate("(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.personal.targetAnnualSpending=0;FFSStage1BrowserTestHooks.setPlan(p,'scenarios')})()");
  await evaluate(`document.querySelector('[data-stage2-current="${id}"]').click()`);assert.match(await evaluate("document.querySelector('#stage2SnapshotViewer details').textContent"),/Annual spending target.*Current: 0/);
  const future=await evaluate("document.querySelector('.stage2-snapshot-results').textContent");await select('today');const today=await evaluate("document.querySelector('.stage2-snapshot-results').textContent");assert.notEqual(today,future);
  await select('future');assert.equal(await evaluate("document.querySelector('.stage2-snapshot-results').textContent"),future);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),history);
});

test('U05 historical viewer remains readable and keyboard accessible at all required widths',async()=>{
  for(const width of [375,390,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await fixture();await select('future');
    const name='HistoricalHouseholdSnapshotWithAnIntentionallyLongUnbrokenNameForMobileReview';
    await evaluate(`FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.getElementById('scenarioName').value=${JSON.stringify(name)};document.getElementById('saveScenarioPanelButton').click();FFSStage1BrowserTestHooks.closeDurabilityDialog()`);
    const id=await evaluate(`__dollarTest.savedScenarios().find(s=>s.name===${JSON.stringify(name)}).id`),history=await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
    await evaluate(`document.querySelector('[data-stage2-current="${id}"]').click()`);
    assert.ok(await evaluate("[...document.querySelectorAll('#stage2SnapshotViewer,#stage2SnapshotViewer h3,#stage2SnapshotViewer dl div')].every(n=>n.scrollWidth<=n.clientWidth+1)"));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    for(const basis of ['today','future']){await select(basis);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),history);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);}
    await stage2Shot('u05-viewer',width,'#stage2SnapshotViewer');
    await evaluate("FFSStage1BrowserTestHooks.closeDurabilityDialog();[...document.querySelectorAll('#stage2SnapshotViewer button')].find(n=>n.textContent==='Back to saved scenarios').focus()");
    assert.equal(await evaluate('document.activeElement.textContent'),'Back to saved scenarios','close control accepts focus');
    await key('Enter');
    assert.equal(await evaluate('document.activeElement.dataset.openScenario'),id,JSON.stringify(await evaluate(`({active:document.activeElement.outerHTML.slice(0,300),viewerHidden:document.getElementById('stage2SnapshotViewer').hidden,open:document.querySelector('[data-open-scenario="${id}"]')?.outerHTML,visible:document.querySelector('[data-open-scenario="${id}"]')?.getClientRects().length})`)));
  }
  assert.deepEqual(browserMessages,[]);
});

const stage3Phase=process.env.FFS_STAGE3_PHASE==='before'?'before':'after';
async function stage3Shot(screen,width,selector){
  const target=selector || (screen==='u07-home'?'#homeView':screen==='u08-navigation'?'.workspace-nav':`[data-view-panel="${await evaluate('document.body.dataset.activeView')}"]`);
  await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(target)});scrollTo({top:node.getBoundingClientRect().top+scrollY-document.querySelector('header').getBoundingClientRect().height-16,behavior:'instant'});return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  await new Promise(r=>setTimeout(r,180));
  const dir=path.join(root,'docs/mobile-usability-stage3',stage3Phase);await mkdir(dir,{recursive:true});
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(dir,`${screen}-${width}.png`),Buffer.from(shot.data,'base64'));
}
test('Stage 3 before and after evidence and responsive financial parity',async()=>{
  const records=[];
  for(const width of [375,390,430,768,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await navigate();await evaluate('localStorage.clear()');await navigate();await stage3Shot('u07-home',width);
    await fixture();const model=await evaluate('JSON.stringify(__dollarTest.result())');
    for(const [view,screen] of [['setup','u06-my-plan'],['dashboard','u08-navigation'],['investments','u09-investments'],['goals','u10-goals'],['super','u10-super'],['semiretirement','u10-retirement']]){
      await evaluate(`FFSStage1BrowserTestHooks.showWorkspace('${view}');FFSStage1BrowserTestHooks.closeDurabilityDialog()`);
      if(view==='semiretirement')await evaluate("document.querySelector('[data-semi-action=calculate]').click()");
      await stage3Shot(screen,width);
      assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),model,'presentation preserves engine output');
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`${view} page overflow ${width}`);
      if(stage3Phase==='after'){
        if(view==='setup'&&width<600)assert.ok(await evaluate("document.querySelector('.wizard-actions').getBoundingClientRect().height<125"),'compact footer');
        if(view==='investments')assert.equal(await evaluate("[...document.querySelectorAll('#investingForm [data-assumptions-open]')].filter(n=>!n.hidden).length"),1);
        if(view==='dashboard'&&width<600)assert.equal(await evaluate('document.getElementById("moreNavigation").open'),false);
      }
      records.push({width,view,engineParity:true});
      if(view==='investments')await stage3Shot('u09-assumptions',width,'#investingForm');
      if(view==='semiretirement'){
        if(stage3Phase==='after'&&width<=760)await evaluate('document.querySelector("[data-s3-key=retirement-inputs]").open=true;document.querySelector("[data-s3-key=retirement-0]").open=true');
        await stage3Shot('u10-retirement-editing',width,'[data-semi-retirement-inputs]');
      }
    }
  }
  const dir=path.join(root,'docs/mobile-usability-stage3');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,`${stage3Phase}-parity.json`),JSON.stringify(records,null,2)+'\n');
});

test('U06-U10 mobile disclosures are keyboard accessible, retain edits and preserve saved scenarios',async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
  await navigate();await evaluate('localStorage.clear()');await navigate();
  assert.equal(await evaluate('document.querySelector("#heroSamplePlanMenu").open'),false);
  await evaluate('document.querySelector("#heroSamplePlanMenu > summary").focus()');await key('Enter');
  assert.equal(await evaluate('document.querySelector("#heroSamplePlanMenu").open'),true);
  await fixture();await evaluate('FFSStage1BrowserTestHooks.showWorkspace("goals")');
  const saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
  const result=await evaluate('JSON.stringify(__dollarTest.result())');
  const runs=await evaluate('window.__retirementRuns');
  assert.equal(await evaluate('document.querySelector("[data-s3-key=goals]").open'),false);
  await evaluate('document.querySelector("[data-s3-key=goals] > summary").focus()');await key('Enter');
  assert.equal(await evaluate('document.querySelector("[data-s3-key=goals]").open'),true);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),result);
  assert.equal(await evaluate('window.__retirementRuns'),runs,'disclosure does not recalculate');
  await evaluate(`(()=>{const n=document.querySelector('#personalForm [data-path="investing.annualInvestingTarget"]');n.value='75490';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate('FFSStage1BrowserTestHooks.showWorkspace("super");FFSStage1BrowserTestHooks.showWorkspace("goals")');
  assert.equal(await evaluate('document.querySelector("[data-s3-key=goals]").open'),true);
  assert.equal(await evaluate('document.querySelector(\'#personalForm [data-path="investing.annualInvestingTarget"]\').value'),'75490');
  assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.annualInvestingTarget'),75490);
  assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
  await evaluate('FFSStage1BrowserTestHooks.showWorkspace("investments");document.querySelector("[data-s3-assumptions]").click()');
  assert.equal(await evaluate('document.body.dataset.activeView'),'assumptions');
  await evaluate('FFSStage1BrowserTestHooks.showWorkspace("semiretirement");document.querySelector("[data-semi-action=calculate]").click()');
  const retirement=await evaluate('JSON.stringify(__dollarTest.retirement().result)');
  const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await journeyTap('[data-s3-key=retirement-inputs] > summary',[]);
  await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector("[data-s3-key=retirement-1] > summary").focus()');await key('Enter');
  assert.equal(await evaluate('document.querySelector("[data-s3-key=retirement-1]").open'),true);
  await evaluate('FFSStage1BrowserTestHooks.renderAll()');
  assert.equal(await evaluate('document.querySelector("[data-s3-key=retirement-1]").open'),true,'open settings survive a renderer refresh');
  assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement().result)'),retirement);
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  const scope=await evaluate('document.querySelector("[data-s3-key=retirement-1] .s3-scope").textContent');assert.match(scope,/Temporary scenario/);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
  await waitFor(()=>evaluate('!document.querySelector("[data-s3-key=retirement-1]")'));
  assert.ok(await evaluate(`document.querySelector('[data-semi-input="household.fullRetirementLifestyleSpending"]').getClientRects().length>0`));
  assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement().result)'),retirement);
});

test('U08 More tools starts closed and dollar controls stay discoverable without plan changes',async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await navigate();await evaluate('localStorage.clear()');await navigate();await fixture();
  assert.equal(await evaluate('document.getElementById("moreNavigation").open'),false);
  const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  const operations=[];await journeyTap('#moreNavigation > summary',operations);
  assert.equal(await evaluate('document.getElementById("moreNavigation").open'),true);
  await journeyTap('.workspace-nav [data-view=super]',operations);
  assert.match(await evaluate('document.getElementById("s3CurrentScreen").textContent'),/Super/);
  await journeyTap('[data-s3-key=dollars] > summary',operations);
  assert.ok(await evaluate('document.querySelector("[data-dollar-basis=today]").getBoundingClientRect().height>=44'));
  await journeyTap('[data-dollar-basis=today]',operations);
  assert.match(await evaluate('document.querySelector("[data-s3-key=dollars] > summary").textContent'),/Today/);
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
  await evaluate("localStorage.setItem('ffs.ui.moreNavigationOpen','true')");
  await navigate();await fixture();
  assert.equal(await evaluate('document.getElementById("moreNavigation").open'),false,'More tools starts closed on reload even with an older expanded preference');
});

test('U06 lower setup fields remain clear of the compact footer and simulated keyboard',async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
  await navigate();await fixture();await evaluate('FFSStage1BrowserTestHooks.showWorkspace("setup");FFSStage1BrowserTestHooks.setWizardStep(0);FFSStage1BrowserTestHooks.closeDurabilityDialog()');
  const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await evaluate(`(()=>{const inputs=[...document.querySelectorAll('.wizard-card input')].filter(n=>n.getClientRects().length);const n=inputs.at(-1);n.focus();n.scrollIntoView({block:'center',behavior:'instant'});})()`);
  await new Promise(r=>setTimeout(r,180));
  const geometry=await evaluate(`(()=>{const field=document.activeElement.getBoundingClientRect(),footer=document.querySelector('.wizard-actions').getBoundingClientRect();return {fieldBottom:field.bottom,footerTop:footer.top,footerHeight:footer.height,headerBottom:document.querySelector('header').getBoundingClientRect().bottom,fieldTop:field.top};})()`);
  assert.ok(geometry.footerHeight<125,JSON.stringify(geometry));assert.ok(geometry.fieldBottom<=geometry.footerTop,JSON.stringify(geometry));assert.ok(geometry.fieldTop>=geometry.headerBottom,JSON.stringify(geometry));
  await evaluate('Object.defineProperty(visualViewport,"height",{configurable:true,value:500});visualViewport.dispatchEvent(new Event("resize"))');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".wizard-actions")).position'),'static');
  await evaluate('delete visualViewport.height;visualViewport.dispatchEvent(new Event("resize"))');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".wizard-actions")).position'),'sticky');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
});

const fourNavBefore=process.env.FFS_FOUR_NAV_PHASE==='before';
async function fourNavShot(screen,width,selector='.workspace-nav'){
  const dir=path.join(root,'docs/four-section-navigation',fourNavBefore?'before':'after');await mkdir(dir,{recursive:true});
  await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});scrollTo({top:n.getBoundingClientRect().top+scrollY-document.querySelector('body > div > header').getBoundingClientRect().height-16,behavior:'instant'});return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  await new Promise(r=>setTimeout(r,150));
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(dir,`${screen}-${width}.png`),Buffer.from(shot.data,'base64'));
}
test('four-section navigation before and after responsive screen evidence',async()=>{
  for(const width of [375,390,430,768,1024,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await evaluate('localStorage.clear()');await navigate();await fourNavShot('welcome',width,'#homeView');await fixture();
    const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),engine=await evaluate('JSON.stringify(__dollarTest.result())');
    for(const [view,screen] of [['dashboard','progress'],['semiretirement','future'],['decision','change'],['weeklyplan','weekly']]){
      await evaluate(`FFSStage1BrowserTestHooks.showWorkspace('${view}');FFSStage1BrowserTestHooks.closeDurabilityDialog()`);if(view==='semiretirement')await evaluate("document.querySelector('[data-semi-action=calculate]').click()");await fourNavShot(screen,width);
      assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),engine);
      if(!fourNavBefore){assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`${view} page overflow ${width}`);assert.equal(await evaluate("document.querySelectorAll('.nav-primary-row [data-view]').length"),4);}
    }
  }
});

async function fourNavSavedFixture(name='Four section saved fixture'){
  await evaluate(`(()=>{const p=structuredClone(FFS_DATA.samplePlans[1].plan);p.personal.person1Name=${JSON.stringify(name)};FFSStage1BrowserTestHooks.setPlan(p,'investments');const n=document.querySelector('#investingForm [data-path="investing.annualInvestingTarget"]');n.value='18765';n.dispatchEvent(new Event('input',{bubbles:true}));FFSStage1BrowserTestHooks.closeDurabilityDialog();})()`);
  return evaluate("(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('ffs-personal-plan-v1:'));return {key,raw:localStorage.getItem(key)}})()");
}
test('four sections retain every tool, one workspace and financial parity at all six widths',async()=>{
  const rows=[];
  for(const width of [375,390,430,768,1024,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await evaluate('localStorage.clear()');await navigate();await fixture();
    const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),engine=await evaluate('JSON.stringify(__dollarTest.result())'),saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),runs=await evaluate('window.__retirementRuns');
    const operations=[];
    for(const view of ['dashboard','semiretirement','decision','weeklyplan','setup','assumptions','investments','super','goals','scenarios','reports']){
      await journeyNavigate(view,operations);
      assert.equal(await evaluate('document.querySelectorAll(".view-section:not(.hidden)").length'),1);
      assert.equal(await evaluate('document.body.dataset.freedomStage'),'workspace');assert.equal(await evaluate('getComputedStyle(document.getElementById("homeView")).display'),'none');
      assert.equal(await evaluate('history.state.ffsWorkspace'),view);
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`${view} ${width}`);
      const primary=await evaluate('FFSFreedomNavigation.sections.find(s=>s.view===document.body.dataset.activeView)');
      if(primary){assert.equal(await evaluate(`document.querySelector('[data-view-panel="${view}"] > .section-heading h2').textContent`),primary.label);assert.equal(await evaluate(`document.querySelector('[data-view-panel="${view}"] > .section-heading p').textContent`),primary.subtitle);}
    }
    assert.ok(operations.every(op=>!op.status||op.status==='pointer-click'),JSON.stringify(operations));
    assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),engine);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
    assert.equal(await evaluate('window.__retirementRuns'),runs,'navigation adds no retirement projection runs');
    assert.ok(await evaluate("[...document.querySelectorAll('.nav-primary-row button')].every(n=>n.getBoundingClientRect().height>=44)"));
    assert.equal(await evaluate("document.querySelectorAll('#semiRetirementScenarioRoot,#weeklyPlanRoot,#forecastAssumptionsWorkspace,.forecast-assumptions-form,[data-growth-open]').length"),5);
    assert.equal(await evaluate("/AI Coach|AI Coaching/i.test(document.querySelector('.workspace-nav').innerText+document.querySelector('[data-view-panel=dashboard]').innerText)"),false);
    rows.push({width,allDestinationsReachable:true,oneWorkspaceEach:true,engineParity:true,noExtraRetirementRuns:true,noOverflow:true});
  }
  await writeFile(path.join(root,'docs/four-section-navigation/access-verification.json'),JSON.stringify(rows,null,2)+'\n');
});

test('four-section welcome, fictional samples, saved-plan startup, refresh and browser history',async()=>{
  for(const width of [375,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await continueSavedOpening();await evaluate('localStorage.clear()');await navigate();await continueSavedOpening();
    assert.equal(await evaluate('document.body.dataset.freedomStage'),'welcome');assert.equal(await evaluate('getComputedStyle(document.getElementById("appWorkspace")).display'),'none');
    await evaluate("localStorage.setItem('ffs-user-state-v3-mobile-dashboard-ux-test',JSON.stringify({hasCreatedPersonalPlan:true}))");await navigate();await continueSavedOpening();assert.equal(await evaluate('document.getElementById("introSampleActions").classList.contains("hidden")'),false,'an old UI flag cannot hide Start My Plan when no valid saved plan exists');
    assert.ok(await evaluate("[...document.querySelectorAll('#homeView .home-snapshot-grid,#engagementHome')].every(n=>getComputedStyle(n).display==='none')"));
    await journeyTap('#heroStartButton',[]);assert.equal(await evaluate('document.body.dataset.activeView'),'setup');
    const stored=await fourNavSavedFixture();await navigate();await continueSavedOpening();await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
    assert.equal(await evaluate('document.body.dataset.activeView'),'dashboard');assert.equal(await evaluate('location.hash'),'#progress');assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(stored.key)})`),stored.raw);
    const operations=[];await journeyNavigate('semiretirement',operations);await journeyNavigate('decision',operations);const length=await evaluate('history.length');
    await evaluate('history.back()');await waitFor(()=>evaluate("document.body.dataset.activeView==='semiretirement'"));await evaluate('history.back()');await waitFor(()=>evaluate("document.body.dataset.activeView==='dashboard'"));await evaluate('history.forward()');await waitFor(()=>evaluate("document.body.dataset.activeView==='semiretirement'"));assert.equal(await evaluate('history.length'),length);
    await journeyNavigate('decision',operations);await cdp.send('Page.reload');await waitFor(()=>evaluate('document.readyState==="complete"&&Boolean(window.FFSStage1BrowserTestHooks)&&document.body.dataset.freedomStage==="welcome"'));await continueSavedOpening();await waitFor(()=>evaluate("Boolean(window.FFSStage1BrowserTestHooks)&&document.body.dataset.activeView==='dashboard'"));assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'),'Four section saved fixture');assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(stored.key)})`),stored.raw);
    await navigate();await continueSavedOpening();await evaluate('localStorage.clear()');await navigate();await continueSavedOpening();
    const sampleTarget='#heroSamplePlanMenu > summary';await journeyTap(sampleTarget,[]);
    await journeyTap('#heroSamplePlanMenu [data-sample-plan-choice]',[]);
    assert.equal(await evaluate('document.body.dataset.freedomSample'),'true');assert.match(await evaluate('document.getElementById("s3CurrentScreen").textContent'),/Fictional sample/);assert.equal(await evaluate("Object.keys(localStorage).some(k=>k.startsWith('ffs-personal-plan-v1:'))"),false);
  }
});

test('Explore My Future reuses growth and retirement sessions and preserves unsaved assumptions across all four sections',async()=>{
  for(const width of [375,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await fixture();
    const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),model=await evaluate('JSON.stringify(__dollarTest.result())');
    await journeyNavigate('semiretirement',[]);await journeyTap('[data-freedom-future=growth]',[]);
    assert.equal(await evaluate('location.hash'),'#future-growth');assert.equal(await evaluate('document.querySelectorAll("#freedomGrowthHost [data-growth-open]").length'),1);
    await evaluate('window.__fourGrowthNode=document.querySelector(".growth-workspace")');
    await select('future');const expected=await evaluate('__dollarTest.result().netWorthProjection.find(r=>r.year===10).closingBalance');close(amount(await evaluate('document.querySelector("[data-growth-result=Base] strong").textContent')),expected);
    await growthEdit('Base','expectedSuperReturnPct',9);const comparison=await evaluate('document.querySelector("[data-growth-result=Base] strong").textContent');
    await journeyNavigate('assumptions',[]);await assumptionEdit('inflationPct',4);
    for(const view of ['dashboard','semiretirement','decision','weeklyplan'])await journeyNavigate(view,[]);
    await journeyNavigate('semiretirement',[]);await journeyTap('[data-freedom-future=growth]',[]);
    assert.equal(await evaluate('document.querySelector("[data-growth-scenario=Base][data-growth-field=expectedSuperReturnPct]").value'),'9');assert.equal(await evaluate('document.querySelector("[data-growth-result=Base] strong").textContent'),comparison);
    assert.equal(await evaluate('window.__fourGrowthNode===document.querySelector(".growth-workspace")'),true);
    await journeyNavigate('assumptions',[]);assert.equal(await evaluate('document.querySelector("[data-assumption=inflationPct]").value'),'4');
    await assumptionButton('Undo unsaved edits');assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),model);
    await journeyNavigate('semiretirement',[]);await journeyTap('[data-freedom-future=growth]',[]);await fourNavShot('future-growth',width,'[data-view-panel=semiretirement]');await evaluate("[...document.querySelectorAll('.growth-panel button')].find(n=>n.textContent==='Open Retirement Planning').click()");
    assert.equal(await evaluate('document.body.dataset.freedomFuture'),'retirement');assert.notEqual(await evaluate('getComputedStyle(document.getElementById("semiRetirementScenarioRoot")).display'),'none');
  }
});

test('four-section retirement edits, saved scenarios, weekly edits and report source remain functional',async()=>{
  for(const width of [375,1366]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await evaluate('localStorage.clear()');await navigate();await fourNavSavedFixture('Navigation financial workflow');
    await journeyNavigate('semiretirement',[]);
    await journeyTap('[data-semi-input="people.0.fullRetirementAge"]',[]);
    await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="people.0.fullRetirementAge"]');n.value='63';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.retirementTiming.people[0].fullRetirementAge'),63);
    const plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
    await journeyTap('[data-semi-input="household.fullRetirementLifestyleSpending"]',[]);await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="household.fullRetirementLifestyleSpending"]');n.value='75490';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await journeyTap('[data-semi-action=calculate]',[]);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan,'scenario-only lifestyle edits do not replace plan inputs');
    assert.equal(await evaluate('JSON.stringify(FFSSemiRetirementUi.runSemiRetirementProjection(FFSSemiRetirementProjection,__stage2Test.retirementDraft()).result)===JSON.stringify(__dollarTest.retirement().result)'),true);
    await evaluate("document.querySelector('[data-semi-action=compare]').click();document.querySelector('[data-save-stage-g-scenario=retirement]').click();document.getElementById('stageGScenarioName').value='Navigation saved retirement';document.querySelector('[data-scenario-save-action=save]').click();FFSStage1BrowserTestHooks.closeDurabilityDialog()");
    const id=await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Navigation saved retirement').id"),saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
    await journeyNavigate('scenarios',[]);await journeyTap(`[data-stage2-view="${id}"]`,[]);assert.match(await evaluate('document.querySelector("#stage2SnapshotViewer").textContent'),/Read-only view/);
    await evaluate("[...document.querySelectorAll('#stage2SnapshotViewer button')].find(n=>n.textContent==='Back to saved scenarios').click()");await journeyTap(`[data-open-scenario="${id}"]`,[]);assert.equal(await evaluate('document.body.dataset.activeView'),'semiretirement');assert.equal(await evaluate('document.body.dataset.freedomFuture'),'retirement');assert.equal(await evaluate('__stage2Test.retirementDraft().household.fullRetirementLifestyleSpending'),75490);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);
    await journeyNavigate('weeklyplan',[]);await journeyTap('[data-weekly-action=create-plan]',[]);await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
    await journeyTap('[data-weekly-step-button=income]',[]);await journeyTap('[data-weekly-actual=income]',[]);
    await evaluate(`(()=>{const n=document.querySelector('[data-weekly-actual=income]');n.value='4321';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-weekly-step-button=complete]').click();document.querySelector('[data-weekly-action=save-week]').click();FFSStage1BrowserTestHooks.closeDurabilityDialog();})()`);
    const weekly=await evaluate('JSON.stringify(__dollarTest.backup().weeklyPlan)');assert.match(weekly,/4321/);
    for(const view of ['dashboard','semiretirement','decision','weeklyplan'])await journeyNavigate(view,[]);assert.equal(await evaluate('JSON.stringify(__dollarTest.backup().weeklyPlan)'),weekly);
    await journeyNavigate('reports',[]);assert.match(await evaluate('document.querySelector(".report-toolbar").textContent'),/Generated from the current Financial Plan/);close(amount(await evaluate('document.querySelector("#financialReportBody .report-narrative-box p strong").textContent')),await evaluate('__dollarTest.result().currentNetWorth'));close(amount(await evaluate('document.querySelector("#financialReportBody .report-narrative-box p:nth-child(2) strong").textContent')),await evaluate('__dollarTest.result().targetAnnualLifestyleSpendingToday'));assert.equal(await evaluate('document.getElementById("reportPrintButton").disabled'),false);await journeyTap('#reportPrintButton',[]);assert.ok(await evaluate('window.__printCalls>0'));
    await journeyTap('[data-view=progress]',[]);assert.equal(await evaluate('location.hash'),'#financial-history');assert.equal(await evaluate('document.body.dataset.activeView'),'progress');
    await journeyNavigate('assumptions',[]);await assumptionEdit('inflationPct',3);await assumptionButton('Save assumptions');assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),3);
    await journeyNavigate('weeklyplan',[]);
    await cdp.send('Page.reload');
    await waitFor(()=>evaluate('document.readyState==="complete"&&Boolean(window.FFSStage1BrowserTestHooks)&&document.body.dataset.freedomStage==="welcome"'));
    await journeyTap('#continuePlanButton',[]);
    await journeyNavigate('weeklyplan',[]);
    const restoredWeekly=await evaluate('__dollarTest.backup().weeklyPlan'),expectedWeekly=JSON.parse(weekly);delete restoredWeekly.updatedAt;delete expectedWeekly.updatedAt;assert.deepEqual(restoredWeekly,expectedWeekly,'all weekly allocations, actuals and history survive refresh; existing updatedAt metadata may advance');assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().investing.inflationPct'),3);
  }
});

const mobileDisplayBefore=process.env.FFS_MOBILE_DISPLAY_PHASE==='before';
async function mobileDisplayShot(area,width,selector){
 const dir=path.join(root,'docs/mobile-growth-display',mobileDisplayBefore?'before':'after');await mkdir(dir,{recursive:true});
 await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const headerPosition=await evaluate("(()=>{const h=document.querySelector('body > div > header'),old=h.style.position;h.style.position='static';return old})()");
 const clip=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:'center',behavior:'instant'});const r=n.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()`);
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(dir,`${area}-${width}.png`),Buffer.from(shot.data,'base64'));
 await evaluate(`document.querySelector('body > div > header').style.position=${JSON.stringify(headerPosition)}`);
}
test('mobile growth and display defaults before and after evidence at six widths',async()=>{
 for(const width of [375,390,430,768,1024,1366]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await evaluate('localStorage.clear()');await navigate();await fixture();
  await evaluate("document.getElementById('moreNavigation').open=true;const d=document.querySelector('[data-s3-key=dollars]');if(d)d.open=true");
  await mobileDisplayShot('tools-and-default',width,'.workspace-nav');await select('future');
  await journeyNavigate('semiretirement',[]);await journeyTap('[data-freedom-future=growth]',[]);
  await mobileDisplayShot('growth-results',width,'.growth-output');
  if(!mobileDisplayBefore){assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);}
 }
});

test('mobile growth cards and chart retain every desktop value across bases, large values and negative outcomes',async()=>{
 const evidence=[];
 for(const width of [375,390,430,768,1024,1366]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await evaluate('localStorage.clear()');await navigate();await fixture();
  for(const variant of ['standard','large-negative']){
   if(variant==='large-negative')await evaluate(`(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.assetItems.forEach(a=>a.value=0);Object.assign(p.liabilities,{homeLoanBalance:9876543210,homeLoanInterestRatePct:0,monthlyRepayment:0});const loan=p.liabilityItems.find(n=>n.type==='homeLoan');Object.assign(loan,{balance:9876543210,interestRatePct:0,repayment:0,repaymentFrequency:'monthly',termYears:40});FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');})()`);
   await journeyNavigate('semiretirement',[]);await journeyTap('[data-freedom-future=growth]',[]);
   const heading=await evaluate("({top:document.querySelector('.growth-panel h2').getBoundingClientRect().top,header:document.querySelector('body > div > header').getBoundingClientRect().bottom})");assert.ok(heading.top>=heading.header-1,JSON.stringify({width,...heading}));
   const model=await evaluate('JSON.stringify(__dollarTest.result())'),plan=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),saved=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');
   for(const basis of ['future','today']){
    await select(basis);
    const comparison=await evaluate(`(()=>{const names=['Lower','Base','Higher'],metrics=[...document.querySelectorAll('.growth-table tbody tr')];return names.map((name,index)=>({name,table:metrics.map(n=>[n.querySelector('th').textContent,n.querySelectorAll('td')[index].textContent]),card:[...document.querySelector('[data-growth-mobile-scenario="'+name+'"]').querySelectorAll('dl > div')].map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent]),bar:[...document.querySelectorAll('.growth-bar-row')][index]?.lastElementChild.textContent}));})()`);
    for(const row of comparison){assert.deepEqual(row.card,row.table);assert.equal(row.card.length,5);assert.equal(row.bar,row.table.at(-1)[1]);}
    const layout=await evaluate(`(()=>{const visible=n=>n.clientWidth>0&&n.getClientRects().length&&getComputedStyle(n).display!=='none';return {page:document.documentElement.scrollWidth>innerWidth+1,table:getComputedStyle(document.querySelector('.growth-table-scroll')).display,cards:getComputedStyle(document.querySelector('.growth-result-cards')).display,overflow:[...document.querySelectorAll('.growth-panel,.growth-panel *')].filter(visible).filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className||n.tagName)}})()`);
    assert.equal(layout.page,false,JSON.stringify({width,layout}));
    if(width<=800){assert.equal(layout.table,'none');assert.notEqual(layout.cards,'none');assert.deepEqual(layout.overflow,[],JSON.stringify({width,layout}));}else{assert.notEqual(layout.table,'none');assert.equal(layout.cards,'none');}
    assert.equal(await evaluate("document.querySelector('.growth-panel').textContent.includes('scroll the table')"),false);
    assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),model);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),plan);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),saved);
    if(variant==='large-negative')assert.ok(comparison.some(n=>n.bar.includes('-')||n.bar.includes('−')),'negative outcomes are actually tested');
    evidence.push({width,variant,basis,allFiveValuesMatchTable:true,chartMatches:true,engineUnchanged:true,noPageOverflow:true});
   }
  }
 }
 await writeFile(path.join(root,'docs/mobile-growth-display/comparison-parity.json'),JSON.stringify(evidence,null,2)+'\n');
});

test('More tools uses the requested six-tool order with all original destinations and a readable narrow fallback',async()=>{
 for(const width of [320,375,390,430,768,1024,1366]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await navigate();await fixture();await evaluate('document.getElementById("moreNavigation").open=true');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.nav-management-grid [data-view]')].map(n=>n.dataset.view)"),['assumptions','investments','super','setup','scenarios','reports']);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-management-grid')).gridTemplateColumns.split(' ').length"),width>=360&&width<=800?3:2);
  assert.ok(await evaluate("[...document.querySelectorAll('.nav-management-grid button')].every(n=>n.getBoundingClientRect().height>=44&&n.scrollWidth<=n.clientWidth+1)"));
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.nav-primary-row button')].map(n=>n.textContent.trim())"),['My Freedom Progress','Explore My Future','Try a Change','My Weekly Mission']);
  for(const view of ['assumptions','investments','super','setup','scenarios','reports','goals'])await journeyNavigate(view,[]);
 }
});

test('Today default and explicit saved preferences survive new plans, sample views, snapshots and refresh without converting plan data',async()=>{
 const key='ffs.ui.forecastDollarBasis',scoped='ffs.ui.forecastDollarBasisPlans.v1';
 await navigate();await evaluate('localStorage.clear()');await navigate();
 assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'today');assert.equal(await evaluate(`localStorage.getItem('${key}')`),null,'a default is not an explicit global preference');
 await fourNavSavedFixture('Existing preference fixture');await select('future');const record=await evaluate("(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('ffs-personal-plan-v1:'));return {key,raw:localStorage.getItem(key)}})()");
 const oldIdentity=await evaluate('FFSForecastDisplayPreferences.identity(FFSStage1BrowserTestHooks.getPlan(),FFSStage1BrowserTestHooks.getPlan().meta.planId)');
 await evaluate(`localStorage.removeItem('${scoped}')`);await navigate();assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'future','legacy explicit preference migrates unchanged');assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(record.key)})`),record.raw);
 const nominal=await evaluate('JSON.stringify(__dollarTest.result())'),financial=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
 await select('today');await select('future');assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'),nominal);assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),financial);
 await evaluate("document.getElementById('heroDemoButton').click();FFSStage1BrowserTestHooks.closeDurabilityDialog()");assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'future');await select('today');await evaluate("document.querySelector('[data-demo-return]').click()");assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'today');await select('future');
 await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click();__dollarTest.openRetirementSnapshot({...__dollarTest.retirementSaveContext(),id:'display-snapshot'})");
 const retirement=await evaluate('JSON.stringify(__dollarTest.retirement().result)'),history=await evaluate('JSON.stringify(__dollarTest.savedScenarios())');await select('today');assert.equal(await evaluate('JSON.stringify(__dollarTest.retirement().result)'),retirement);assert.equal(await evaluate('JSON.stringify(__dollarTest.savedScenarios())'),history);await select('future');
 await evaluate("FFSStage1BrowserTestHooks.closeDurabilityDialog();window.confirm=()=>false;document.getElementById('planNewButton').click();window.confirm=()=>true");assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'future','cancelling New Plan preserves the display choice');
 await evaluate("FFSStage1BrowserTestHooks.closeDurabilityDialog();document.getElementById('planNewButton').click()");assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'today');assert.equal(await evaluate(`localStorage.getItem('${key}')`),'future','creating a new plan does not overwrite the legacy explicit choice');
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('${scoped}'))[${JSON.stringify(oldIdentity)}]`),'future','the previous plan display choice is retained');
 await evaluate(`(()=>{const n=document.querySelector('#wizardAboutForm [data-path="personal.person1Name"]');n.value='New plan display fixture';n.dispatchEvent(new Event('input',{bubbles:true}));FFSStage1BrowserTestHooks.closeDurabilityDialog();})()`);await navigate();
 assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'today','the new plan default survives a fresh session');assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'),'New plan display fixture');
 await select('future');await navigate();assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'future');await select('today');await navigate();assert.equal(await evaluate('document.body.dataset.forecastDollarBasis'),'today');
});

const returningHeaderBefore = process.env.FFS_RETURNING_HEADER_PHASE === 'before';
const returningHeaderDir = path.join(root, 'docs/returning-dashboard-header', returningHeaderBefore ? 'before' : 'after');
const personalDraftKey = 'ffs-current-plan-v3-mobile-dashboard-ux-test';
const savedTimeKey = 'ffs-current-plan-last-saved-v3-mobile-dashboard-ux-test';
async function openingShot(name, width) {
  await mkdir(returningHeaderDir, {recursive: true});
  await evaluate('scrollTo({top:0,behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await new Promise(resolve => setTimeout(resolve, 150));
  const shot = await cdp.send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  await writeFile(path.join(returningHeaderDir, `${name}-${width}.png`), Buffer.from(shot.data, 'base64'));
}
async function cleanOpening(width) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height:1000, deviceScaleFactor:1, mobile:width<600});
  await navigate();
  await evaluate('localStorage.clear()');
  await navigate();
}

test('opening experience: first visitors keep welcome and saved households open the original dashboard at every width', async () => {
  const evidence = [];
  for (const width of [375,390,430,768,1024,1366]) {
    await cleanOpening(width);
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'welcome');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("appWorkspace")).display'), 'none');
    assert.equal(await evaluate('document.body.dataset.freedomSample'), 'false');
    assert.equal(await evaluate('document.getElementById("introSampleActions").classList.contains("hidden")'), false);
    assert.equal(await evaluate('document.getElementById("continuePanel").classList.contains("hidden")'), true);
    assert.ok(await evaluate('document.getElementById("heroStartButton").getClientRects().length>0'));
    assert.ok(await evaluate('Boolean(document.querySelector("#homeView [data-s3-key=sample],#heroSamplePlanMenu"))'));
    assert.equal(await evaluate('Object.keys(localStorage).some(k=>k.startsWith("ffs-personal-plan-v1:"))'), false);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
    await openingShot('first-visit', width);

    const stored = await fourNavSavedFixture('Saved household browser fixture');
    const before = await evaluate('JSON.stringify(__dollarTest.result())');
    await journeyNavigate('dashboard', []);
    const dashboard = await evaluate('document.querySelector("[data-view-panel=dashboard]").innerHTML');
    // A bare app URL defaults to the dashboard even when the saved UI last used Investments.
    await navigate();await continueSavedOpening();
    await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'workspace');
    assert.equal(await evaluate('document.body.dataset.activeView'), 'dashboard');
    assert.equal(await evaluate('location.hash'), '#progress');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("homeView")).display'), 'none');
    assert.equal(await evaluate('document.querySelectorAll(".view-section:not(.hidden)").length'), 1);
    assert.equal(await evaluate('document.querySelector("[data-view-panel=dashboard]").innerHTML'), dashboard, 'same existing dashboard markup, values and charts');
    assert.equal(await evaluate('JSON.stringify(__dollarTest.result())'), before);
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(stored.key)})`), stored.raw, 'opening never saves over the plan');
    assert.equal(await evaluate('document.querySelectorAll(".nav-primary-row [data-view]").length'), 4);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
    assert.equal(await evaluate('document.querySelectorAll("#headerSaveStatus").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll("#lastSavedLabel").length'), returningHeaderBefore ? 1 : 0);
    await openingShot('returning-dashboard', width);
    evidence.push({width,firstVisitWelcome:true,noAutomaticSample:true,returningDashboard:true,noContinueClick:true,originalDashboardMarkup:true,financialParity:true,savedRecordUnchanged:true,noOverflow:true});
  }
  await writeFile(path.join(returningHeaderDir, 'opening-verification.json'), JSON.stringify(evidence,null,2)+'\n');
});

test('opening recovery: legacy and partial plans open directly, while invalid or unavailable data retain safe recovery', async () => {
  for (const width of [375,1366]) {
    await cleanOpening(width);
    const stored = await fourNavSavedFixture('Recovery browser fixture');
    // Legacy-only personal data still follow the existing migration and open directly.
    await evaluate(`localStorage.removeItem(${JSON.stringify(stored.key)})`);
    await navigate();await continueSavedOpening();
    assert.equal(await evaluate('document.body.dataset.activeView'), 'dashboard');
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'workspace');
    assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'), 'Recovery browser fixture');
    const legacyRaw = await evaluate(`localStorage.getItem('${personalDraftKey}')`);
    assert.equal(legacyRaw, stored.raw);
    // A preserved corrupt namespaced copy can recover from a valid legacy copy.
    await evaluate(`localStorage.setItem(${JSON.stringify(stored.key)},'{broken saved plan')`);
    await navigate();await continueSavedOpening();
    assert.equal(await evaluate('document.body.dataset.activeView'), 'dashboard');
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'workspace');
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(stored.key)})`), '{broken saved plan');
    assert.equal(await evaluate(`localStorage.getItem('${personalDraftKey}')`), legacyRaw);
    assert.match(await evaluate('document.getElementById("durabilityNotice").innerText'), /preserved|not.*overwritten/i);

    // No valid copy: retain corrupt bytes, welcome and the existing import/new-plan recovery actions.
    await evaluate(`localStorage.setItem('${personalDraftKey}','{broken legacy plan')`);
    await navigate();await continueSavedOpening();
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'welcome');
    assert.equal(await evaluate('document.body.dataset.freedomSample'), 'false');
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(stored.key)})`), '{broken saved plan');
    assert.equal(await evaluate(`localStorage.getItem('${personalDraftKey}')`), '{broken legacy plan');
    assert.ok(await evaluate('document.querySelector("#durabilityNotice [data-durability-action=import]")'));
    assert.ok(await evaluate('document.querySelector("#durabilityNotice [data-durability-action=new-plan]")'));
    await openingShot('recovery', width);

    // A partially entered personal plan is still the user's plan, without claiming complete results.
    await cleanOpening(width);
    await journeyTap('#heroStartButton', []);
    await evaluate('(()=>{const n=document.querySelector("#wizardAboutForm [data-path=\\"personal.person1Name\\"]");n.value="Partial household";n.dispatchEvent(new Event("input",{bubbles:true}));FFSStage1BrowserTestHooks.closeDurabilityDialog();})()');
    const partialRaw = await evaluate(`localStorage.getItem('${personalDraftKey}')`);
    assert.ok(partialRaw);
    await navigate();await continueSavedOpening();
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'workspace');
    assert.equal(await evaluate('document.body.dataset.activeView'), 'dashboard');
    assert.equal(await evaluate('FFSStage1BrowserTestHooks.getReadiness().readyForPersonalisedResults'), false);
    assert.equal(await evaluate(`localStorage.getItem('${personalDraftKey}')`), partialRaw);

    // Storage unavailable from the first read: do not pretend the saved plan loaded or replace it.
    const script = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source:`window.__openingStorageGet=Storage.prototype.getItem;Storage.prototype.getItem=function(){throw new DOMException('Browser storage unavailable','SecurityError');};Storage.prototype.setItem=function(){throw new DOMException('Browser storage unavailable','SecurityError');};`});
    try {
      await navigate();await continueSavedOpening();
      assert.equal(await evaluate('document.body.dataset.freedomStage'), 'welcome');
      assert.equal(await evaluate('document.body.dataset.freedomSample'), 'false');
      assert.equal(await evaluate(`__openingStorageGet.call(localStorage,'${personalDraftKey}')`), partialRaw);
      assert.ok(await evaluate('document.querySelector("#durabilityNotice [data-durability-action=import]")'));
    } finally {
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', {identifier:script.identifier});
      await navigate();await continueSavedOpening();
    }
  }
});

test('opening resilience: a validated saved plan still opens when subsequent plan reads become unavailable', async () => {
  for (const width of [375,1366]) {
    await cleanOpening(width);
    const stored = await fourNavSavedFixture('Already loaded household');
    const script = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source:`
      window.__openingStorageGet=Storage.prototype.getItem;
      let personalReads=0;
      Storage.prototype.getItem=function(key){
        if(key.startsWith('ffs-personal-plan-v1:'))personalReads++;
        if(personalReads>1&&(key.startsWith('ffs-personal-plan-v1:')||key==='${personalDraftKey}'))throw new DOMException('Plan storage became unavailable after load','SecurityError');
        return __openingStorageGet.call(this,key);
      };
    `});
    try {
      await navigate();await continueSavedOpening();
      assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'), 'Already loaded household');
      assert.equal(await evaluate('document.body.dataset.freedomStage'), 'welcome');
      await evaluate("FFSStage1BrowserTestHooks.showWorkspace('dashboard')");
      assert.equal(await evaluate(`__openingStorageGet.call(localStorage,${JSON.stringify(stored.key)})`), stored.raw);
      await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
      await openingShot('interrupted-storage', width);
    } finally {
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', {identifier:script.identifier});
      await navigate();await continueSavedOpening();
    }
  }
});

test('header cleanup: one desktop save indicator updates after edits and header actions remain usable', async () => {
  for (const width of [375,768,1366]) {
    await cleanOpening(width);
    await fourNavSavedFixture('Save status fixture');
    await evaluate(`localStorage.setItem('${savedTimeKey}','2025-01-01T00:00:00.000Z')`);
    await navigate();await continueSavedOpening();
    await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
    const oldLabel = await evaluate('document.getElementById("headerSaveStatus").textContent');
    assert.match(oldLabel, /Last saved:/i);
    assert.equal(await evaluate('document.querySelectorAll(".app-header #headerSaveStatus").length'), 1);
    if (!returningHeaderBefore) assert.equal(await evaluate('document.querySelector(".header-brand").innerText.includes("Saved")'), false);
    if (width>=1024) assert.ok(await evaluate('document.getElementById("headerSaveStatus").getClientRects().length>0'));
    await journeyNavigate('investments', []);
    await evaluate('(()=>{const n=document.querySelector("#investingForm [data-path=\\"investing.annualInvestingTarget\\"]");n.value="19000";n.dispatchEvent(new Event("input",{bubbles:true}));})()');
    await waitFor(()=>evaluate(`localStorage.getItem('${savedTimeKey}')!=='2025-01-01T00:00:00.000Z'`));
    await waitFor(()=>evaluate('document.getElementById("headerSaveStatus").textContent.startsWith("Last saved:")'));
    assert.notEqual(await evaluate('document.getElementById("headerSaveStatus").textContent'), oldLabel);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('${personalDraftKey}')).plan.investing.annualInvestingTarget`), 19000);
    // Saving may show the existing backup reminder; close it before checking header hit targets.
    await evaluate('FFSStage1BrowserTestHooks.closeDurabilityDialog()');
    // The original desktop Plan and mobile Actions menus remain reachable by pointer.
    const operations=[];
    await journeyTap(width<=760?'#mobileActionMenu > summary':'#planMenu > summary', operations);
    if (width<=760) await journeyTap('#mobilePlanGroup > summary', operations);
    assert.ok(operations.every(op=>op.status==='pointer-click'), JSON.stringify({width,operations}));
    assert.ok(await evaluate(`document.querySelector('${width<=760?'[data-mobile-action=export-plan-json]':'#planExportJsonButton'}').getClientRects().length>0`));
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
  }
});

test('opening first paint: welcome stays hidden until startup classifies first-time and returning visitors', async () => {
  let paused = null;
  cdp.on('Fetch.requestPaused', event => { paused = event; });
  for (const returning of [false,true]) {
    await cleanOpening(375);
    if (returning) await fourNavSavedFixture('First paint household');
    paused = null;
    await cdp.send('Fetch.enable', {patterns:[{urlPattern:new URL('app.js',baseUrl).href,requestStage:'Request'}]});
    try {
      await cdp.send('Page.navigate', {url:baseUrl});
      await waitFor(async () => paused && await evaluate('Boolean(document.getElementById("homeView"))'));
      assert.equal(await evaluate('Boolean(window.FFSStage1BrowserTestHooks)'), false, 'app startup is deliberately held before executing');
      assert.equal(await evaluate('getComputedStyle(document.getElementById("homeView")).display==="none"'), !returningHeaderBefore, 'no welcome flash before saved-plan detection');
    } finally {
      if (paused) await cdp.send('Fetch.continueRequest', {requestId:paused.requestId});
      await cdp.send('Fetch.disable');
    }
    await waitFor(()=>evaluate('document.readyState==="complete" && Boolean(window.FFSStage1BrowserTestHooks)'));
    assert.equal(await evaluate('document.body.dataset.freedomStage'), 'welcome');
    if (returning) await continueSavedOpening();
    if (returning) assert.equal(await evaluate('document.body.dataset.activeView'), 'dashboard');
  }
});

const welcomeCardsBefore = process.env.FFS_WELCOME_CARDS_PHASE === 'before';
async function welcomeCardsShot(width, state) {
  const dir = path.join(root, 'docs/welcome-sample-feature-cards', welcomeCardsBefore ? 'before' : 'after');
  await mkdir(dir, {recursive:true});
  await evaluate('scrollTo({top:0,behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await new Promise(resolve=>setTimeout(resolve,150));
  const clip=await evaluate('({x:0,y:0,width:innerWidth,height:document.documentElement.scrollHeight,scale:1})');
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
  await writeFile(path.join(dir,`${state}-${width}.png`),Buffer.from(shot.data,'base64'));
}

test('welcome sample button and four feature cards stay readable, accessible and isolated from personal data', async () => {
  const evidence=[];
  for (const width of [320,375,390,430,600,768,1024,1366]) {
    await cleanOpening(width);
    assert.equal(await evaluate('document.body.dataset.freedomStage'),'welcome');
    const summary='#heroSamplePlanMenu > summary';
    const details='#heroSamplePlanMenu';
    const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
    const trigger=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(summary)}),s=getComputedStyle(n),b=n.getBoundingClientRect();return {label:n.textContent.trim(),background:s.backgroundColor,color:s.color,align:s.textAlign,width:b.width,height:b.height,arrow:getComputedStyle(n,'::after').borderBottomWidth};})()`);
    assert.equal(trigger.label,'Explore a Sample Plan');
    assert.ok(trigger.height>=44);
    if(!welcomeCardsBefore){
      assert.equal(trigger.align,'center');assert.equal(trigger.background,'rgb(232, 245, 238)');assert.equal(trigger.arrow,'2px');
      const features=await evaluate(`(()=>{const cards=[...document.querySelectorAll('.welcome-feature-card')];return {labels:cards.map(n=>n.querySelector('h4').textContent),columns:getComputedStyle(document.querySelector('.welcome-feature-grid')).gridTemplateColumns.split(' ').length,below:document.querySelector('.welcome-features').getBoundingClientRect().top>=document.querySelector(${JSON.stringify(summary)}).getBoundingClientRect().bottom,readable:cards.every(n=>n.scrollWidth<=n.clientWidth+1&&n.querySelector('p').getClientRects().length>0)};})()`);
      assert.deepEqual(features.labels,['My Freedom Progress','Explore My Future','Try a Change','My Weekly Mission']);
      assert.equal(features.columns,width<=600?1:2);assert.equal(features.below,true);assert.equal(features.readable,true);
    }
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);
    if([375,390,430,768,1366].includes(width))await welcomeCardsShot(width,'welcome');

    // A native summary opens with Enter and closes with Space without loading a plan.
    await evaluate(`document.querySelector(${JSON.stringify(summary)}).focus()`);
    await key('Enter');
    await waitFor(()=>evaluate(`document.querySelector(${JSON.stringify(details)}).open`));
    assert.equal(await evaluate('document.activeElement.tagName'),'SUMMARY');
    assert.equal(await evaluate('document.body.dataset.freedomSample'),'false');
    assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before);
    assert.equal(await evaluate('Object.keys(localStorage).some(k=>k.startsWith("ffs-personal-plan-v1:"))'),false);
    if([375,1366].includes(width))await welcomeCardsShot(width,'sample-open');
    await key(' ');
    await waitFor(()=>evaluate(`!document.querySelector(${JSON.stringify(details)}).open`));

    // Pointer interaction retains the existing sample picker and load handlers.
    const operations=[];await journeyTap(summary,operations);
    await journeyTap('#heroSamplePlanMenu [data-sample-plan-choice]',operations);
    assert.ok(operations.every(op=>op.status==='pointer-click'),JSON.stringify({width,operations}));
    assert.equal(await evaluate('document.body.dataset.freedomSample'),'true');
    assert.equal(await evaluate('Object.keys(localStorage).some(k=>k.startsWith("ffs-personal-plan-v1:"))'),false);
    if(!welcomeCardsBefore)assert.equal(await evaluate('document.querySelectorAll(".welcome-feature-card").length'),4);
    evidence.push({width,centeredLightGreenButton:!welcomeCardsBefore,fourFeatures:!welcomeCardsBefore,noOverflow:true,nativeKeyboardToggle:true,sampleLoadsOnlyOnSelection:true});
  }
  if(!welcomeCardsBefore){
    await cleanOpening(375);await journeyTap('#heroStartButton',[]);
    assert.equal(await evaluate('document.body.dataset.activeView'),'setup');
    await fourNavSavedFixture('Welcome returning fixture');await navigate();await continueSavedOpening();
    assert.equal(await evaluate('document.body.dataset.activeView'),'dashboard');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("homeView")).display'),'none');
    assert.equal(await evaluate('document.querySelectorAll(".welcome-feature-card").length'),4,'static cards never duplicate on rerender or navigation');
    await writeFile(path.join(root,'docs/welcome-sample-feature-cards/responsive-verification.json'),JSON.stringify(evidence,null,2)+'\n');
  }
});

test('Try a Change live surplus matches the dashboard and resolved allocations across screen sizes', async () => {
  await navigate();
  await fixture();
  const planBefore = await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  const annual = await evaluate('__dollarTest.result().finalProjectedCashSurplus');
  const fmt = value => new Intl.NumberFormat('en-AU', {style: 'currency', currency: 'AUD', maximumFractionDigits: 0}).format(value);
  const figure = (key, scope = 'whatIfResult', selector = 'dd > :is(a,strong)') =>
    evaluate(`document.querySelector('#${scope} [data-surplus-figure=${key}] ${selector}')?.textContent`);
  for (const width of [375, 768, 1366]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: width < 600});
    await select(width === 768 ? 'future' : 'today');
    await evaluate("FFSStage1BrowserTestHooks.showWorkspace('decision'); document.querySelector('[data-what-if=expenses-500]').click()");
    assert.equal(await figure('current'), `${fmt(annual / 52)}/week`);
    assert.equal(await figure('current', 'whatIfResult', 'dd > small'), `${fmt(annual)}/year`);
    assert.equal(await figure('change'), `+${fmt(6000 / 52)}/week`);
    assert.equal(await figure('revised'), `${fmt((annual + 6000) / 52)}/week`);
    await evaluate("document.querySelector('[data-what-if-allocation=lifestyle]').click()");
    assert.equal(await figure('change'), '$0/week', 'allocating all extra cash leaves no surplus change');
    assert.equal(await figure('revised'), await figure('current'));
    await evaluate("document.querySelector('[data-what-if=invest-250]').click()");
    const after = await evaluate('__dollarTest.quick().adjustedResult.finalProjectedCashSurplus');
    assert.ok(after < annual);
    assert.equal(await figure('change'), `−${fmt((annual - after) / 52)}/week`);
    assert.equal(await figure('revised'), `${fmt(after / 52)}/week`);
    assert.ok(await evaluate(`[...document.querySelectorAll('#whatIfResult .decision-surplus-figure')].every(n=>n.scrollWidth<=n.clientWidth+1)&&document.documentElement.scrollWidth<=innerWidth+1`));
    const operations = [];
    await journeyTap('#whatIfResult [data-cash-surplus-link]', operations);
    assert.ok(operations.every(action => action.status === 'pointer-click'), JSON.stringify(operations));
    assert.equal(await evaluate('document.body.dataset.activeView'), 'dashboard');
    assert.equal(await evaluate('document.activeElement.id'), 'dashboardCashSurplus');
    assert.equal(await evaluate('document.getElementById("dashboardDetails").open'), true);
    assert.equal(await evaluate('document.querySelector("#dashboardSurplusRows .cashflow-row-final strong").textContent'), fmt(annual));
    assert.equal(await evaluate('document.querySelector("#dashboardSurplusRows .cashflow-row:last-child strong").textContent'), fmt(annual / 52));
    assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'), planBefore);
  }
});

test('Try a Change states how the extra $100 is funded and labels both forecast bases', async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 375, height: 900, deviceScaleFactor: 1, mobile: true});
  await navigate();
  await fixture();
  await evaluate(`(() => {
    const p = FFSStage1BrowserTestHooks.getPlan();
    FFSStage1BrowserTestHooks.setPlan({
      ...p,
      personal: {person1Name: 'Audit', person1Age: 43, fullRetirementAge: 65, targetAnnualSpending: 40000,
        retirementTiming: {version: 1, people: [{id: 'person1', fullRetirementAge: 65, hasSemiRetirement: false}]}},
      income: {person1HospitalCoverStatus: 'full-year'},
      incomeItems: [{id: 'salary', type: 'salaryWages', owner: 'person1', amount: 100000, frequency: 'annually'}],
      expenseItems: [{id: 'living', category: 'living', amount: 16912, frequency: 'annually'}],
      liabilityItems: [{id: 'loan', name: 'Home loan', type: 'homeLoan', balance: 50000, repayment: 500, repaymentFrequency: 'monthly', interestRatePct: 3, termYears: 30}],
      assetItems: [{id: 'cash', category: 'cash', value: 100000}, {id: 'shares', category: 'shares', value: 100000}],
      investing: {annualInvestingTarget: 6000, expectedInvestmentReturnPct: 7, inflationPct: 2.5, wageGrowthPct: 0},
      projectionSettings: {workingPhaseSurplusDestination: 'enjoyment'},
    }, 'decision');
    document.querySelector('[data-what-if=invest-100]').click();
  })()`);
  await select('future');
  assert.equal(await evaluate(`document.querySelector('.what-if-dollar-basis [data-dollar-basis=future]').getAttribute('aria-pressed')`), 'true');
  assert.ok(await evaluate(`(() => {
    const control = document.querySelector('.what-if-dollar-basis');
    return control.nextElementSibling.querySelector('[data-what-if-growth]')
      && control.nextElementSibling.nextElementSibling.classList.contains('what-if-forecast')
      && [...control.querySelectorAll('button')].every(button => button.getBoundingClientRect().height >= 44)
      && document.documentElement.scrollWidth <= innerWidth;
  })()`));
  const planBefore = await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  for (const [basis, expected] of [['today', [5251, 27356, 58090]], ['future', [5382, 30950, 74360]]]) {
    const selector = `.what-if-dollar-basis [data-dollar-basis="${basis}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await key('Enter');
    assert.ok(await evaluate(`document.activeElement.matches(${JSON.stringify(selector)})`));
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-dollar-basis="${basis}"]')].map(button => button.getAttribute('aria-pressed'))`), ['true', 'true']);
    const summary = await evaluate(`document.getElementById('whatIfResult').textContent`);
    assert.match(summary, /\$934\/week/);
    assert.match(summary, /−\$100\/week/);
    assert.match(summary, /\$834\/week/);
    assert.match(summary, /\$100 per week goes into investments from your existing surplus/);
    assert.match(summary, /\$834 per week remains available/);
    assert.doesNotMatch(summary, /shortfall|What would you do with the extra money/);
    assert.match(summary, basis === 'today' ? /today’s dollars, adjusted for inflation/ : /future dollars/);
    assert.equal(await evaluate(`document.querySelector('[data-what-if-allocation=investments]').disabled`), true);
    const deltas = await evaluate(`[...document.querySelectorAll('#whatIfResult .what-if-forecast-row:not(.what-if-forecast-head) b')].map(n => Number(n.textContent.replace(/[^0-9]/g, '')))`);
    assert.deepEqual(deltas, expected);
  }
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'), planBefore);
  await evaluate("document.querySelector('[data-what-if=expenses-500]').click()");
  assert.match(await evaluate("document.getElementById('whatIfResult').textContent"), /This change frees up cash you can allocate below/);
  assert.equal(await evaluate("document.querySelector('[data-what-if-allocation=investments]').disabled"), false);
});

test('Try a Change previews existing growth presets for both plans without changing Base or cashflow', async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 375, height: 900, deviceScaleFactor: 1, mobile: true});
  await navigate();
  await fixture();
  await select('future');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('decision'); document.querySelector('[data-what-if=invest-100]').click()");
  const forecast = () => evaluate(`[...document.querySelectorAll('#whatIfResult .what-if-forecast-row:not(.what-if-forecast-head)')]
    .map(row => [...row.querySelectorAll('.stage2-comparison-value')].map(cell => cell.textContent))`);
  const quickState = () => evaluate(`JSON.stringify({
    plan: FFSStage1BrowserTestHooks.getPlan(),
    quick: __dollarTest.quick(),
    surplus: document.querySelector('#whatIfResult .decision-surplus-grid').textContent
  })`);
  const original = await quickState();
  const base = await forecast();
  assert.equal(await evaluate("document.querySelector('[data-what-if-growth][aria-pressed=true]').textContent"), 'Base');
  assert.equal(await evaluate("document.querySelectorAll('[data-what-if-growth]').length"), 3);

  for (const name of ['Lower', 'Higher']) {
    const selector = `[data-what-if-growth="${name}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await key('Enter');
    assert.ok(await evaluate(`document.activeElement.matches(${JSON.stringify(selector)})`));
    assert.equal(await evaluate(`document.querySelector('[data-what-if-growth][aria-pressed=true]').textContent`), name);
    const expected = await evaluate(`(() => {
      const {result, adjustedResult} = __dollarTest.quick();
      const api = FFSGrowthScenarios;
      const preset = api.suggested(result.plan)[${JSON.stringify(name)}];
      const before = api.calculate(result.plan, preset, __dollarTest.growthForecast).result;
      const after = api.calculate(adjustedResult.plan, preset, __dollarTest.growthForecast).result;
      const money = value => value.toLocaleString('en-AU', {style: 'currency', currency: 'AUD', maximumFractionDigits: 0});
      return [1,5,10].map(year => {
        const b = before.netWorthProjection[year-1].closingBalance;
        const a = after.netWorthProjection[year-1].closingBalance;
        return [money(b), money(a), (a >= b ? '+' : '−') + money(Math.abs(a-b))];
      });
    })()`);
    assert.deepEqual(await forecast(), expected);
    assert.notDeepEqual(expected, base);
    assert.equal(await quickState(), original);
  }
  await select('today');
  assert.equal(await evaluate("document.querySelector('[data-what-if-growth][aria-pressed=true]').textContent"), 'Higher');
  await select('future');
  await evaluate("document.querySelector('[data-what-if-growth=Base]').click()");
  assert.deepEqual(await forecast(), base);
});

test('Try a Change uses household names, preserves income ownership and shows zero for return-only changes', async () => {
  await navigate();
  await fixture();
  await evaluate(`(() => {
    const p = FFSStage1BrowserTestHooks.getPlan();
    p.personal.person1Name = 'Alex & Co';
    p.personal.person2Name = '';
    p.incomeItems = [
      {id: 'alex-income', name: 'Person 1 salary', owner: 'person1', type: 'salaryWages', amount: 125000, frequency: 'annually'},
      {id: 'partner-income', name: 'Person 2 salary', owner: 'person2', type: 'salaryWages', amount: 75000, frequency: 'annually'},
    ];
    FFSStage1BrowserTestHooks.setPlan(p, 'decision');
    document.querySelector('[data-what-if=income-5]').click();
  })()`);
  const names = await evaluate(`[...document.querySelectorAll('#whatIfActions select[data-scenario-target=incomeItemId] option')].slice(1).map(o=>[o.value,o.textContent])`);
  assert.equal(names[0][0], 'alex-income');
  assert.match(names[0][1], /Alex & Co/);
  assert.equal(names[1][0], 'partner-income');
  assert.match(names[1][1], /Partner/);
  assert.doesNotMatch(names.flat().join(' '), /Person\s*[12]/i);
  for (const [id, expected] of [['alex-income', 6250], ['partner-income', 3750]]) {
    const result = await evaluate(`(() => {
      const select = document.querySelector('#whatIfActions [data-scenario-target=incomeItemId]');
      select.value = '${id}';
      select.dispatchEvent(new Event('input',{bubbles:true}));
      const scenario = __dollarTest.quick();
      return {id:scenario.baseAdjustments.incomeItemId, change:scenario.baseAdjustments.incomeChange,
        adjustedIncome:scenario.adjustedResult.plan.incomeItems.map(item=>[item.id,item.owner,item.amount])};
    })()`);
    assert.equal(result.id, id);
    assert.equal(result.change, expected);
    assert.deepEqual(result.adjustedIncome, [['alex-income','person1',125000+(id==='alex-income'?expected:0)], ['partner-income','person2',75000+(id==='partner-income'?expected:0)]]);
  }
  await evaluate(`(() => {
    const p = FFSStage1BrowserTestHooks.getPlan();
    p.personal.person1Name = '';
    p.incomeItems.push({id:'side-income',name:'Consulting',owner:'person1',type:'other',amount:5000,frequency:'annually'});
    FFSStage1BrowserTestHooks.setPlan(p, 'decision');
  })()`);
  assert.match(await evaluate(`document.querySelector('#whatIfActions option[value=alex-income]').textContent`), /You/);
  await evaluate(`(() => {
    const p = FFSStage1BrowserTestHooks.getPlan();
    const selector = document.querySelector('#whatIfActions [data-scenario-target=incomeItemId]');
    selector.value = '';
    selector.dispatchEvent(new Event('input', {bubbles:true}));
    p.personal.person2Age = 0;
    p.incomeItems = p.incomeItems.filter(item => item.id === 'alex-income');
    FFSStage1BrowserTestHooks.setPlan(p, 'decision');
    document.querySelector('[data-what-if=income-5]').click();
  })()`);
  assert.equal(await evaluate('__dollarTest.quick().baseAdjustments.incomeItemId'), 'alex-income');
  assert.equal(await evaluate(`document.querySelector('#whatIfActions select[data-scenario-target=incomeItemId]')`), null);
  await evaluate(`(() => {
    document.getElementById('customScenarioDetails').open = true;
    const input = document.querySelector('[data-comparison=investmentReturnChangePct]');
    input.value = '2';
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  assert.equal(await evaluate(`document.querySelector('#comparisonSummary [data-surplus-figure=change] strong').textContent`), '$0/week');
  const [before, after] = await evaluate(`[...document.querySelectorAll('#comparisonSummary [data-stage2-comparison]')]
    .find(row => row.firstElementChild.textContent === 'Long-term net worth')
    .querySelectorAll('.stage2-comparison-value').values().map(node => node.textContent).toArray()`);
  assert.ok(after);
  assert.notEqual(before, after, 'return assumptions still affect the forecast');
  await evaluate(`(() => {
    const input = document.querySelector('[data-comparison=expenseChange]');
    input.value = '5200';
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  assert.equal(await evaluate(`document.querySelector('#comparisonSummary [data-surplus-figure=change] strong').textContent`), '−$100/week');
  await evaluate(`(() => {
    for (const key of ['investmentReturnChangePct','expenseChange']) {
      const input = document.querySelector('[data-comparison='+key+']');
      input.value = '0';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
  })()`);
  assert.equal(await evaluate(`document.querySelector('#comparisonSummary [data-surplus-figure=change] strong').textContent`), '$0/week');
});

test('Update My Plan on My Freedom Progress opens the existing editor and respects sample mode', async () => {
  for (const width of [375, 768, 1366]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: width < 600});
    await navigate();
    await evaluate("localStorage.clear(); localStorage.setItem('ffs.ui.moreNavigationOpen', 'true')");
    await navigate();
    const stored = await fourNavSavedFixture('Dashboard update fixture');
    await evaluate("FFSStage1BrowserTestHooks.showWorkspace('dashboard')");
    assert.equal(await evaluate('document.getElementById("moreNavigation").open'), false);
    assert.ok(await evaluate('document.querySelector(".dashboard-update-plan").getBoundingClientRect().height >= 44'));
    const operations = [];
    await journeyTap('.dashboard-update-plan', operations);
    assert.ok(operations.some(action => action.status === 'pointer-click'), JSON.stringify(operations));
    assert.equal(await evaluate('document.body.dataset.activeView'), 'setup');
    assert.equal(await evaluate('FFSStage1BrowserTestHooks.getPlan().personal.person1Name'), 'Dashboard update fixture');
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(stored.key)})`), stored.raw);
    await evaluate('document.getElementById("heroDemoButton").click()');
    assert.equal(await evaluate('document.body.dataset.freedomSample'), 'true');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".dashboard-update-plan")).display'), 'none');
    assert.ok(await evaluate('document.querySelector("[data-demo-return]").getClientRects().length'));
  }
});
for (const width of [1366,768,390]) test('unified super contributions edit and reconcile at '+width+'px', async()=>{
 await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
 await fixture();
 await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement')");
 await evaluate("(()=>{let n=document.querySelector('[data-semi-action=add-super-contribution]');while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}})()");
 await evaluate("document.querySelector('[data-semi-action=add-super-contribution][data-person-index=\\\"0\\\"]').click()");
 const path='people.0.superContributions.0.amount';
 assert.equal(await evaluate('document.activeElement.dataset.semiInput'),path, JSON.stringify({errors:browserMessages,dom:await evaluate('document.querySelector("[data-super-contribution-id]")?.outerHTML')}));
 await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="${path}"]');n.value='20000';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 assert.equal(await evaluate('document.activeElement.dataset.semiInput'),path);
 await evaluate("document.querySelector('[data-semi-action=calculate]').click()");
 const first=await evaluate('__dollarTest.retirement()');
 assert.ok(first.result?.validation?.isValid,JSON.stringify(first.result?.validation));
 assert.equal(first.result.years[0].people[0].personalDeductibleContribution,20000);
 const saved=await evaluate('JSON.stringify(__stage2Test.retirementDraft().people[0].superContributions)');
 await select('today'); await select('future');
 assert.equal(await evaluate('JSON.stringify(__stage2Test.retirementDraft().people[0].superContributions)'),saved);
 await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="${path}"]');n.focus();n.value='';n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 assert.ok(await evaluate("!document.querySelector('[data-semi-results-dashboard]') || document.querySelector('[data-semi-results-dashboard]').hidden"),'stale forecast hidden immediately');
 await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="${path}"]');n.value='20000';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-semi-action=calculate]').click();})()`);
 assert.equal(await evaluate('__dollarTest.retirement().result.years[0].people[0].personalDeductibleContribution'),20000);
 assert.ok(await evaluate("document.querySelector('#semiRetirementScenarioRoot').textContent.includes('actual nominal gross transactions')"));
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 const output=pathModuleForSuper();
 await mkdir(output,{recursive:true});
 await writeFile(output+'/super-'+width+'.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('[data-semi-action=remove-super-contribution]').click();document.querySelector('[data-semi-action=calculate]').click()");
 assert.equal(await evaluate('__dollarTest.retirement().result.years[0].people[0].personalDeductibleContribution || 0'),0);
});
function pathModuleForSuper(){return path.join(root,'test-results/super-contributions');}

test('super arrangements survive scenario saving, backup import, reopening and PDF comparison',async()=>{
 await navigate(); await fixture();
 await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement');document.querySelector('[data-semi-action=calculate]').click()");
 const year=await evaluate('__stage2Test.retirementDraft().projectionStartYear');
 const arrangements=[{id:'deductible',type:'personal-deductible',amount:20000,startYear:year,frequency:'one-off',indexation:'none'},
  {id:'sacrifice',type:'salary-sacrifice',amount:5000,startYear:year+1,frequency:'annual',stopAge:55,indexation:'cpi'},
  {id:'after-tax',type:'personal-after-tax',amount:10000,startYear:year,frequency:'one-off',indexation:'none'}];
 await evaluate(`__dollarTest.configureRetirement({'people.0.superContributions':${JSON.stringify(arrangements)}})`);
 assert.ok(await evaluate('__dollarTest.retirement().result.validation.isValid'));
 await evaluate("document.querySelector('[data-save-stage-g-scenario=retirement]').click();document.getElementById('stageGScenarioName').value='Super persistence regression';document.querySelector('[data-scenario-save-action=save]').click();FFSStage1BrowserTestHooks.closeDurabilityDialog()");
 const snapshot=await evaluate("__dollarTest.savedScenarios().find(s=>s.name==='Super persistence regression')");
 assert.deepEqual(snapshot.scenarioInputSnapshot.people[0].superContributions,arrangements);
 const backup=await evaluate('__dollarTest.backup()');
 const restored=await evaluate(`__dollarTest.validateBackup(${JSON.stringify(backup)})`);
 assert.deepEqual(restored.scenarios.find(s=>s.id===snapshot.id).scenarioInputSnapshot.people[0].superContributions,arrangements);
 await evaluate(`__dollarTest.openRetirementSnapshot(${JSON.stringify(restored.scenarios.find(s=>s.id===snapshot.id))})`);
 assert.deepEqual(await evaluate('__stage2Test.retirementDraft().people[0].superContributions'),arrangements);
 assert.equal(await evaluate('__dollarTest.retirement().result.years[0].people[0].personalDeductibleContribution'),20000);
 await evaluate("document.querySelector('[data-semi-action=compare]').click();document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
 const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
 assert.ok(pdf.data.length>1000);
 await mkdir(pathModuleForSuper(),{recursive:true});await writeFile(path.join(pathModuleForSuper(),'super-comparison.pdf'),Buffer.from(pdf.data,'base64'));
 await evaluate('delete document.body.dataset.printMode');
 // An unrelated retirement field invalidates the visible forecast immediately.
 await evaluate("(()=>{const n=document.querySelector('[data-semi-input=\"people.0.openingSuperBalance\"]');n.value='123456';n.dispatchEvent(new Event('input',{bubbles:true}));})()");
 assert.ok(await evaluate("!document.querySelector('[data-semi-results-dashboard]') || document.querySelector('[data-semi-results-dashboard]').hidden"));
});

test('recurring contribution editor retains focus, expansion and final financial year on iPhone',async()=>{
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 await navigate();await fixture();await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement')");
 await evaluate("(()=>{let n=document.querySelector('[data-semi-action=add-super-contribution]');while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}})();document.querySelector('[data-semi-action=add-super-contribution]').click()");
 async function field(name,value){await evaluate(`(()=>{const n=document.querySelector('[data-semi-input="people.0.superContributions.0.${name}"]');n.focus();n.value=${JSON.stringify(String(value))};n.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
 await field('amount',5000);await field('type','salary-sacrifice');await field('frequency','annual');
 assert.equal(await evaluate('document.activeElement.dataset.semiInput'),'people.0.superContributions.0.frequency');
 assert.ok(await evaluate('document.querySelector("[data-super-contribution-id]").open'));
 const year=await evaluate('__stage2Test.retirementDraft().projectionStartYear');
 const age=await evaluate('__stage2Test.retirementDraft().people[0].currentAge');
 await field('startYear',year+2);await field('stopAge',age+5);
 assert.match(await evaluate('document.querySelector("[data-contribution-final-year]").textContent'),new RegExp(String(year+4)));
 await evaluate("document.querySelector('[data-super-contribution-id] details').open=true");await field('indexation','cpi');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 await evaluate("(()=>{const n=document.querySelector('[data-super-contribution-id]');scrollTo({top:n.getBoundingClientRect().top+scrollY-70,behavior:'instant'});return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()");
 await mkdir(pathModuleForSuper(),{recursive:true});await writeFile(path.join(pathModuleForSuper(),'super-editor-390.png'),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('[data-semi-action=calculate]').click()");
 assert.equal(await evaluate('__dollarTest.retirement().result.years[2].people[0].scenarioSalarySacrificeSuper'),5000);
});
