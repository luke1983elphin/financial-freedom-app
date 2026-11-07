// Kept outside the default unit-test inventory because it launches a real browser.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

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
      // Test-only alternate-year fixture; production files and calculation logic remain unchanged.
      if (relative === "calculator.js" && evidenceFinancialYear) body = Buffer.from(body.toString().replace('const FINANCIAL_YEAR = "2026-27";', `const FINANCIAL_YEAR = "${evidenceFinancialYear}";`));
      if (relative === "app.js") body = Buffer.from(body.toString()
        .replace('  function lineChart(svgId, series, options = {}) {', '  function lineChart(svgId, series, options = {}) { window.__dollarCharts ||= {}; window.__dollarCharts[svgId] = structuredClone(series);')
        .replace('  installDollarBasisPresentation();', `  window.__dollarTest = {
          result: () => calculatePlan(plan),
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

test('custom Decision Engine compares year-specific forecasts and ten-year surplus outcomes', async () => {
  await fixture(); await select('future');
  await evaluate('__dollarTest.decisionAllocation()');
  const read = () => evaluate("Object.fromEntries([...document.querySelectorAll('#comparisonSummary .summary-tile')].map(tile=>[tile.querySelector('span').firstChild.textContent.trim(),tile.querySelector('strong').textContent]))");
  const nominal = await read();
  const rate = await evaluate('__dollarTest.result().plan.investing.inflationPct/100');
  await select('today');
  const real = await read();
  for (const [label, year] of Object.entries({'1-year net worth':1,'2-year net worth':2,'Long-term net worth':30,'Super balance in 2 years':2,'Investment balance in 2 years':2,'Projected investment balance in 10 years':10,'Projected FI assets in 10 years':10,'Projected passive income in 10 years':10})) {
    assert.ok(nominal[label],label);
    const before=nominal[label].split('->').map(amount), after=real[label].split('->').map(amount);
    before.forEach((value,index)=>close(after[index],value/(1+rate)**year));
  }
  assert.equal(real['Current annual final surplus'],nominal['Current annual final surplus']);
  await select('future');assert.deepEqual(await read(),nominal);
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
