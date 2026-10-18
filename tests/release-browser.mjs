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

test('CSP rejects injected inline script and both APIs remain disabled', async()=>{
  assert.deepEqual(browserMessages,[],'no accidental CSP or runtime errors');
  const disabled=await evaluate("Promise.all(['/api/ai-insights','/api/payslip-extract'].map(url=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)))");
  assert.deepEqual(disabled,[503,503]);
  await evaluate("const injected=document.createElement('script');injected.textContent='window.__unsafeInlineRan=true';document.body.append(injected)");
  assert.equal(await evaluate("window.__unsafeInlineRan===true"),false);
  await waitFor(async()=>browserMessages.some(m=>/Content Security Policy|inline script/i.test(m)));
});
