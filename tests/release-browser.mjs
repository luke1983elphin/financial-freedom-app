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


for (const width of [1366, 375]) test('release safeguards under enforcing CSP at '+width+'px', async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'setup'); FFSStage1BrowserTestHooks.setWizardStep(1)");
  assert.equal(await evaluate("document.querySelectorAll('[data-payslip-file]').length"),0);
  assert.ok(await evaluate("document.body.textContent.includes('Payslip uploads are currently unavailable')"));
  const manual = await evaluate(`(()=>{const field=document.querySelector('[data-collection="incomeItems"][data-key="amount"]'); if(!field)return {found:false}; field.value='110000'; field.dispatchEvent(new Event('input',{bubbles:true})); field.dispatchEvent(new Event('change',{bubbles:true})); return {found:true};})()`);
  assert.ok(manual.found,'manual salary field');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports')");
  assert.ok(await evaluate("document.getElementById('financialReportBody').textContent.includes('Financial Freedom Report')"));
  assert.equal(await evaluate("document.querySelectorAll('#financialReportBody .carried-forward-rules').length"),0,'supported main year has no warning');
  assert.ok(await evaluate("document.querySelectorAll('svg').length>0"),'charts rendered');
  await evaluate("document.getElementById('reportPrintButton').click()");
  assert.ok(await evaluate("window.__printCalls>0"));
  const pdf=await cdp.send('Page.printToPDF',{printBackground:true});
  assert.ok(pdf.data.length>1000,'print rendering succeeds');
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement')");
  await evaluate("document.querySelector('[data-semi-action=calculate]').click()");
  await waitFor(()=>evaluate("document.querySelector('[data-semi-results-dashboard] .carried-forward-rules')!==null"));
  const notice=await evaluate("[...document.querySelectorAll('[data-semi-results-dashboard] .carried-forward-rules')].map(x=>x.textContent).join(' ')");
  assert.match(notice,/2026-27 settings for Medicare/);assert.match(notice,/2027-28 settings for income tax/);
  await evaluate("document.querySelector('[data-semi-action=compare]').click()");
  await waitFor(()=>evaluate("document.querySelector('.semi-retirement-comparison-print-report .carried-forward-rules')!==null"));
  assert.match(await evaluate("document.querySelector('.semi-retirement-comparison-print-report').textContent"),/2026-27 settings for Medicare/);
  await evaluate("document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
  assert.equal(await evaluate("document.body.dataset.printMode"),"retirement-comparison");
  assert.ok((await cdp.send('Page.printToPDF',{printBackground:true})).data.length>1000);
  assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'no horizontal overflow');
  await mkdir(path.join(root,'docs/release-evidence'),{recursive:true});
  await evaluate("FFSStage1BrowserTestHooks.closeDurabilityDialog(); document.querySelector('[data-semi-results-dashboard]').scrollIntoView()");
  const shot=await cdp.send('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(root,'docs/release-evidence','retirement-'+width+'.png'),Buffer.from(shot.data,'base64'));
});
test('complete backup downloads under CSP', async()=>{
  const downloads=path.join(profile,'downloads');await mkdir(downloads,{recursive:true});
  let download;
  cdp.on('Browser.downloadProgress',event=>{if(event.state==='completed')download=event.guid;});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
  await evaluate("document.getElementById('planExportJsonButton').click()");
  await waitFor(async()=>download);
  const backup=JSON.parse(await readFile(path.join(downloads,download),'utf8'));
  assert.ok(backup && typeof backup==='object');
});
test('partially supported 2027-28 renders the source year and affected sections in setup and report', async()=>{
  evidenceFinancialYear = '2027-28';
  await navigate();
  assert.equal(await evaluate('FFSCalculator.FINANCIAL_YEAR'), '2027-28');
  const evidence = [];
  for (const width of [1366, 375]) {
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'setup'); FFSStage1BrowserTestHooks.setWizardStep(1); FFSStage1BrowserTestHooks.closeDurabilityDialog()");
    for (const surface of ['setup', 'report']) {
      if (surface === 'report') await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports')");
      const selector = surface === 'report' ? '#financialReportBody .carried-forward-rules' : '.carried-forward-rules';
      const text = await evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
      assert.match(text,/Some settings for 2027-28.*2026-27 settings for Medicare levy, Medicare levy surcharge, study loan repayments, superannuation/);
      assert.doesNotMatch(text,/income tax/);
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
      await waitFor(()=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return r.height>0 && r.top>=90 && r.bottom<innerHeight-150})()`));
      const shot = await cdp.send('Page.captureScreenshot',{format:'png'});
      await writeFile(path.join(root,'docs/release-evidence',`partial-2027-${surface}-${width}.png`),Buffer.from(shot.data,'base64'));
      evidence.push({width,surface,text});
      if (surface === 'report' && width === 1366) {
        await evaluate("document.getElementById('reportPrintButton').click()");
        await cdp.send('Emulation.setEmulatedMedia',{media:'print'});
        assert.equal(await evaluate("document.body.dataset.printMode"),'financial-report');
        assert.ok(await evaluate("document.querySelector('#financialReportBody .carried-forward-rules').getBoundingClientRect().height>0"));
        await evaluate("window.scrollTo({top:0,behavior:'instant'})");
        const printed = await cdp.send('Page.captureScreenshot',{format:'png'});
        await writeFile(path.join(root,'docs/release-evidence','partial-2027-print-1366.png'),Buffer.from(printed.data,'base64'));
        await cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
        await evaluate("delete document.body.dataset.printMode");
      }
    }
  }
  await writeFile(path.join(root,'docs/release-evidence','partial-2027-rendered.json'), JSON.stringify({fixture:'Local test server changes only calculator FINANCIAL_YEAR to 2027-28; actual application renderers and calculations run under enforcing CSP.',evidence},null,2)+'\n');
  evidenceFinancialYear = undefined;
});

test('saved custom names survive comparison edits and reopening restores saved retirement inputs', async()=>{
  await navigate();
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'semiretirement'); FFSStage1BrowserTestHooks.closeDurabilityDialog(); document.querySelector('[data-semi-action=calculate]').click(); document.querySelector('[data-save-stage-g-scenario=retirement]').click()");
  await evaluate("document.querySelector('#stageGScenarioName').value='Retire at 62 - custom';document.querySelector('[data-scenario-save-action=save]').click()");
  const id=await evaluate("document.querySelector('.scenario-library-card [data-compare-scenario]').dataset.compareScenario");
  await evaluate(`document.querySelector('[data-compare-scenario="${id}"]').click()`);
  await evaluate(`(()=>{const e=document.querySelector('[data-semi-comparison-input="people.0.fullRetirementAge"]');e.value='65';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const report=await evaluate("document.querySelector('.semi-retirement-comparison-print-report').textContent");
  assert.match(report,/Retire at 62 - custom/);assert.match(report,/Alex retires at 65 · Jordan retires at 62/);
  await navigate();
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('scenarios')");
  assert.match(await evaluate("document.querySelector('.scenario-library-card').textContent"),/Alex retires at 62 · Jordan retires at 62/);
  await evaluate(`document.querySelector('[data-open-scenario="${id}"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="people.0.fullRetirementAge"]').value`),'62');
});

test('shared calendar-year selection and typed edits persist matching partner ages', async()=>{
  await navigate();
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'semiretirement'); FFSStage1BrowserTestHooks.closeDurabilityDialog()");
  assert.equal(await evaluate("document.querySelector('[data-retirement-couple-mode]').value"),'individual');
  await evaluate("(()=>{const e=document.querySelector('[data-retirement-couple-mode]');e.value='shared';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  let timing=await evaluate("FFSStage1BrowserTestHooks.getPlan().personal.retirementTiming");
  assert.equal(timing.mode,'shared');assert.deepEqual(timing.people.map(p=>p.fullRetirementAge),[62,61]);
  await evaluate(`(()=>{const e=document.querySelector('[data-semi-input="people.0.fullRetirementAge"]');e.value='65';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  timing=await evaluate("FFSStage1BrowserTestHooks.getPlan().personal.retirementTiming");
  assert.equal(timing.mode,'shared');assert.deepEqual(timing.people.map(p=>p.fullRetirementAge),[65,64]);
  await navigate();
  await evaluate("FFSStage1BrowserTestHooks.showWorkspace('semiretirement')");
  assert.equal(await evaluate("document.querySelector('[data-retirement-couple-mode]').value"),'shared');
  await evaluate(`(()=>{const e=document.querySelector('[data-semi-input="people.1.fullRetirementAge"]');e.value='65';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  timing=await evaluate("FFSStage1BrowserTestHooks.getPlan().personal.retirementTiming");
  assert.equal(timing.mode,'individual');assert.deepEqual(timing.people.map(p=>p.fullRetirementAge),[65,65]);
});

test('comparison print preserves headers, assumptions and funding detail for distinct scenarios in both rule years', async()=>{
  const output = process.env.FFS_PDF_OUTPUT_DIR || path.join(profile, 'pdfs');
  await mkdir(output, {recursive:true});
  for (const year of ['2026-27', '2027-28']) {
    evidenceFinancialYear = year;
    await navigate();
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'reports'); FFSStage1BrowserTestHooks.closeDurabilityDialog()");
    await evaluate("document.getElementById('reportPrintButton').click()");
    await cdp.send('Emulation.setEmulatedMedia',{media:'print'});
    assert.ok(await evaluate("document.querySelector('#financialReportBody').getBoundingClientRect().height>0"));
    if (year === '2027-28') assert.ok(await evaluate("document.querySelector('#financialReportBody .carried-forward-rules').getBoundingClientRect().height>0"));
    await writeFile(path.join(output,`financial-${year}.pdf`),Buffer.from((await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true})).data,'base64'));
    await cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
    await evaluate("delete document.body.dataset.printMode; FFSStage1BrowserTestHooks.showWorkspace('semiretirement'); document.querySelector('[data-semi-action=calculate]').click(); document.querySelector('[data-semi-action=compare]').click()");
    await evaluate(`(()=>{const paths=[...document.querySelectorAll('[data-semi-comparison-input$="fullRetirementAge"]')].map(e=>e.dataset.semiComparisonInput); for(const path of paths){const field=document.querySelector('[data-semi-comparison-input="'+path+'"]'); field.value=String(Number(field.value)+3); field.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await waitFor(()=>evaluate("document.querySelector('.semi-retirement-comparison-print-report').textContent.includes('3 years later')"));
    await evaluate("document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
    await cdp.send('Emulation.setEmulatedMedia',{media:'print'});
    const printed = await evaluate(`(()=>{const report=document.querySelector('.semi-retirement-comparison-print-report'); return {title:report.querySelector('h1').getBoundingClientRect().height,cover:report.querySelector('header').innerText,notices:[...report.querySelectorAll('.carried-forward-rules')].map(e=>({text:e.innerText,height:e.getBoundingClientRect().height})),assumptions:report.querySelector('.semi-retirement-print-assumptions').innerText,text:report.innerText,appHeader:document.querySelector('.app-header').getBoundingClientRect().height,nav:[...document.querySelectorAll('nav')].every(e=>e.getBoundingClientRect().height===0)};})()`);
    assert.ok(printed.title>0);
    assert.match(printed.cover,/Calculation version:/);
    assert.ok(printed.notices.length && printed.notices.every(n=>n.height>0));
    assert.match(printed.notices.map(n=>n.text).join(' '),/2026-27 settings for Medicare/);
    assert.match(printed.assumptions,/Inflation/);
    assert.match(printed.assumptions,/Accessible investment return/);
    assert.match(printed.text,/Retire at 65/);
    assert.match(printed.text,/Alex retires at 65 · Jordan retires at 65/);
    assert.match(printed.text,new RegExp(`First year both retired: ${new Date().getFullYear()+34}.*Alex 66, Jordan 65`));
    assert.match(printed.text,new RegExp(`Alex was already retired from ${new Date().getFullYear()+33}`));
    assert.doesNotMatch(printed.text,/No key assumptions available/);
    assert.doesNotMatch(printed.text,/Not available/);
    assert.equal(printed.appHeader,0);
    assert.ok(printed.nav);
    assert.equal(await evaluate("(()=>{const banner=document.querySelector('#demoModeBanner');const hidden=banner.classList.contains('hidden');banner.classList.remove('hidden');const display=getComputedStyle(banner).display;banner.classList.toggle('hidden',hidden);return display;})()"),'none','even active sample exploration controls never enter printed reports');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.semi-retirement-print-closing')).breakInside"), 'avoid', 'keep assumptions and disclaimer together when they fit on a page');
    await writeFile(path.join(output,`comparison-${year}.pdf`),Buffer.from((await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true})).data,'base64'));
    await writeFile(path.join(output,`comparison-${year}.json`),JSON.stringify(printed,null,2));
    await cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
    await evaluate("delete document.body.dataset.printMode");
  }
  evidenceFinancialYear = undefined;
});

test('five alternative preview isolates baseline, exports readable groups and supports mobile selection', async () => {
  const output = process.env.FFS_PDF_OUTPUT_DIR || path.join(profile, 'pdfs');
  await mkdir(output, {recursive:true});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate();
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'semiretirement'); FFSStage1BrowserTestHooks.closeDurabilityDialog(); document.querySelector('[data-semi-action=calculate]').click()");
  const planBefore = await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  await evaluate("document.querySelector('[data-semi-action=demo-comparisons]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.semi-retirement-comparison-chip-list > article').length"),5);
  assert.equal(await evaluate("document.querySelector('.semi-retirement-comparison-table').dataset.comparisonCount"),'6');
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),planBefore,'creating comparisons must not change the plan');
  const overview = await evaluate("document.querySelector('.semi-retirement-comparison-print-report').innerHTML");
  for (const name of ['Current Plan','Retire 3 years earlier','Retire 3 years later','Spend 10% less','Spend 10% more','Invest $5,000 more']) assert.ok(overview.includes(name));
  assert.ok(overview.includes('Shared assumptions'));
  assert.ok(overview.includes('Assumptions that differ'));
  assert.ok(overview.includes('Forecast end (year and ages)'));
  assert.equal(await evaluate("document.querySelectorAll('.semi-comparison-detail-group').length"),0);
  await evaluate("document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
  await cdp.send('Emulation.setEmulatedMedia',{media:'print'});
  assert.equal(await evaluate('document.body.dataset.comparisonWide'),'true');
  assert.ok(await evaluate("[...document.querySelectorAll('.semi-comparison-wide .semi-retirement-print-table')].every(t=>t.getBoundingClientRect().right <= document.querySelector('.semi-comparison-wide').getBoundingClientRect().right+2)"));
  await writeFile(path.join(output,'five-alternatives-overview.pdf'),Buffer.from((await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true})).data,'base64'));
  await cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
  await evaluate("delete document.body.dataset.printMode;document.querySelector('[data-semi-comparison]').scrollIntoView()");
  await writeFile(path.join(output,'desktop-comparison.png'),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
  const visibleCount = () => evaluate("[...document.querySelector('.semi-retirement-comparison-summary-row').querySelectorAll('.semi-retirement-comparison-cell')].filter(e=>getComputedStyle(e).display!=='none').length");
  assert.equal(await visibleCount(),2,'mobile defaults to Current plus one alternative');
  await evaluate("(()=>{const e=document.querySelector('[data-semi-mobile-comparison]');e.value=e.options[4].value;e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assert.equal(await visibleCount(),2);
  assert.match(await evaluate("document.querySelector('.semi-retirement-comparison-summary-row [data-mobile-visible=true]:last-child').dataset.scenarioLabel"),/Invest/);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+2'),'mobile page must not overflow');
  await evaluate("document.querySelector('[data-semi-mobile-comparison]').scrollIntoView()");
  await writeFile(path.join(output,'mobile-comparison.png'),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("(()=>{const e=document.querySelector('[data-semi-report-detail]');e.value='full';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assert.equal(await evaluate("document.querySelectorAll('.semi-comparison-detail-group').length"),3);
  assert.ok(await evaluate("[...document.querySelectorAll('.semi-comparison-detail-group .semi-retirement-comparison-breakdown')].every(g=>g.children.length<=3 && g.firstElementChild.innerText.includes('Current Plan'))"));
  await evaluate("document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
  await cdp.send('Emulation.setEmulatedMedia',{media:'print'});
  await writeFile(path.join(output,'five-alternatives-full.pdf'),Buffer.from((await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true})).data,'base64'));
  await cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
  await evaluate("delete document.body.dataset.printMode;window.prompt=()=>null;document.querySelector('[data-semi-action=compare]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.semi-retirement-comparison-chip-list > article').length"),5,'sixth alternative is not silently inserted');
  await evaluate("document.querySelector('.semi-retirement-comparison-chip-list [data-semi-action=remove-comparison]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.semi-retirement-comparison-chip-list > article').length"),4);
  await evaluate("(()=>{const e=document.querySelector('[data-semi-report-detail]');e.value='overview';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await evaluate("document.querySelector('[data-semi-action=export-comparison-pdf]').click()");
  await cdp.send('Emulation.setEmulatedMedia',{media:'print'});
  await writeFile(path.join(output,'four-alternatives-overview.pdf'),Buffer.from((await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true})).data,'base64'));
  await cdp.send('Emulation.setEmulatedMedia',{media:'screen'});
  await evaluate("delete document.body.dataset.printMode");
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),planBefore);
});

test('CSP rejects injected inline script and both APIs remain disabled', async()=>{
  assert.deepEqual(browserMessages,[],'no accidental CSP or runtime errors');
  const disabled=await evaluate("Promise.all(['/api/ai-insights','/api/payslip-extract'].map(url=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)))");
  assert.deepEqual(disabled,[503,503]);
  await evaluate("const injected=document.createElement('script');injected.textContent='window.__unsafeInlineRan=true';document.body.append(injected)");
  assert.equal(await evaluate("window.__unsafeInlineRan===true"),false);
  await waitFor(async()=>browserMessages.some(m=>/Content Security Policy|inline script/i.test(m)));
});
