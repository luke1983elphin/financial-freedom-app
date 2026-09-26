// Kept outside the default unit-test inventory because it launches a real browser.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
let browserMessages = [];

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
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, modifiers });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, modifiers });
}

async function navigate() {
  await cdp.send("Page.navigate", { url: baseUrl });
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.FFSStage1BrowserTestHooks)"));
}

before(async () => {
  server = createServer(async (request, response) => {
    try {
      const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
      const resolved = path.resolve(root, relative);
      if (!resolved.startsWith(root)) throw new Error("Invalid path");
      const body = await readFile(resolved);
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
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true; window.print=()=>{window.__printCalls=(window.__printCalls||0)+1}; window.confirm=()=>true;",
  });
  await navigate();
});

after(async () => {
  cdp?.close();
  chrome?.kill();
  server?.closeAllConnections?.();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
});

test("real browser gates empty and partial plans while enabling ready plans", async () => {
  const empty = await evaluate("FFSStage1BrowserTestHooks.getReadiness()");
  assert.equal(empty.state, "empty");
  const emptyDecision = await evaluate("FFSStage1BrowserTestHooks.showWorkspace('decision'); document.getElementById('decisionList').innerText");
  assert.match(emptyDecision, /Complete your Financial Plan/);
  assert.doesNotMatch(emptyDecision, /Strongest opportunity/);
  const emptyReport = await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports'); ({text:document.getElementById('financialReportBody').innerText, disabled:document.getElementById('reportPrintButton').disabled})");
  assert.match(emptyReport.text, /Complete your Financial Plan/);
  assert.equal(emptyReport.disabled, true);

  const partial = await evaluate(`(() => { const p=FFSCalculator.emptyPlan(); p.incomeItems=[]; p.assetItems=[]; p.liabilityItems=[]; p.expenseItems=[]; p.personal.person1Age=40; p.incomeItems.push({id:'salary',type:'salaryWages',owner:'person1',amount:90000,frequency:'annually'}); return FFSStage1BrowserTestHooks.setPlan(p,'decision'); })()`);
  assert.equal(partial.state, "partial");
  assert.match(await evaluate("document.getElementById('decisionList').innerText"), /Complete your Financial Plan/);

  const ready = await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'decision')");
  assert.equal(ready.state, "ready");
  assert.match(await evaluate("document.getElementById('decisionList').innerText"), /Strongest opportunity/);
  const readyReport = await evaluate("FFSStage1BrowserTestHooks.showWorkspace('reports'); ({disabled:document.getElementById('reportPrintButton').disabled, title:document.getElementById('financialReportBody').innerText})");
  assert.equal(readyReport.disabled, false);
  assert.match(readyReport.title, /Your Financial Freedom Report/);
});

test("real browser converts, edits, unlinks, reloads and deletes rental records without orphans", async () => {
  const initial = await evaluate(`(() => { const p=FFSCalculator.emptyPlan(); p.incomeItems=[]; p.assetItems=[{id:'land',name:'Vacant land',category:'otherProperty',value:300000}]; p.liabilityItems=[]; p.expenseItems=[]; FFSStage1BrowserTestHooks.setPlan(p,'setup'); FFSStage1BrowserTestHooks.setWizardStep(2); return {list:document.querySelector('.linked-property-list').innerText, action:Boolean(document.querySelector('[data-linked-setup-open="rental"][data-linked-asset-id="land"]'))}; })()`);
  assert.match(initial.list, /No rental property has been added/);
  assert.equal(initial.action, true);
  await evaluate(`document.querySelector('[data-linked-setup-open="rental"][data-linked-asset-id="land"]').click()`);
  assert.equal(await evaluate("document.activeElement?.dataset?.linkedSetupField"), "name");
  await evaluate(`(() => { const set=(field,value,event='input')=>{const el=document.querySelector('[data-linked-setup-field="'+field+'"]'); el.value=value; el.dispatchEvent(new Event(event,{bubbles:true}));}; set('name','Vacant land rental'); set('value','320000'); set('annualRentReceived','26000'); set('annualPropertyExpensesExcludingPrincipal','9000'); const loan=document.querySelector('[data-linked-setup-field="hasLoan"]'); loan.checked=true; loan.dispatchEvent(new Event('change',{bubbles:true})); set('loanBalance','180000'); set('repayment','1400'); document.querySelector('[data-linked-setup-form="rental"]').requestSubmit(); })()`);
  await waitFor(() => evaluate("document.getElementById('linkedSetupDialog').classList.contains('hidden')"));
  const created = await evaluate(`(() => { const p=FFSStage1BrowserTestHooks.getPlan(); return {asset:p.assetItems.find(x=>x.id==='land'), income:p.incomeItems.find(x=>x.linkedAssetId==='land'), loan:p.liabilityItems.find(x=>x.linkedAssetId==='land')}; })()`);
  assert.equal(created.asset.category, "rentalInvestmentProperty");
  assert.equal(created.income.linkedAssetId, "land");
  assert.equal(created.loan.linkedAssetId, "land");

  await evaluate(`document.querySelector('[data-linked-setup-open="rental"][data-linked-asset-id="land"]').click(); (()=>{const el=document.querySelector('[data-linked-setup-field="owner"]'); el.value='person2'; el.dispatchEvent(new Event('change',{bubbles:true}));})(); document.querySelector('[data-linked-setup-form="rental"]').requestSubmit()`);
  await waitFor(() => evaluate("document.getElementById('linkedSetupDialog').classList.contains('hidden')"));
  assert.deepEqual(await evaluate(`(() => { const p=FFSStage1BrowserTestHooks.getPlan(); return [p.assetItems.find(x=>x.id==='land').owner,p.incomeItems.find(x=>x.linkedAssetId==='land').owner,p.liabilityItems.find(x=>x.linkedAssetId==='land').owner]; })()`), ["person2", "person2", "person2"]);

  await evaluate(`document.querySelector('[data-linked-setup-open="rental"][data-linked-asset-id="land"]').click(); (()=>{const el=document.querySelector('[data-linked-setup-field="hasLoan"]'); el.checked=false; el.dispatchEvent(new Event('change',{bubbles:true}));})(); document.querySelector('[name="existingLoanChoice"][value="unlink"]').click(); document.querySelector('[data-linked-setup-form="rental"]').requestSubmit()`);
  await waitFor(() => evaluate("document.getElementById('linkedSetupDialog').classList.contains('hidden')"));
  assert.equal(await evaluate("FFSStage1BrowserTestHooks.getPlan().liabilityItems.find(x=>x.type==='rentalPropertyLoan').linkedAssetId"), "");

  await navigate();
  const reloaded = await evaluate("FFSStage1BrowserTestHooks.getPlan()");
  assert.ok(reloaded.assetItems.some((item) => item.id === "land"));
  await evaluate(`FFSStage1BrowserTestHooks.setWizardStep(2); document.querySelector('[data-remove-collection="assetItems"][data-id="land"]').click()`);
  const removed = await evaluate(`(() => { const p=FFSStage1BrowserTestHooks.getPlan(); return {asset:p.assetItems.some(x=>x.id==='land'), income:p.incomeItems.some(x=>x.linkedAssetId==='land'), linkedLoan:p.liabilityItems.some(x=>x.linkedAssetId==='land')}; })()`);
  assert.deepEqual(removed, { asset: false, income: false, linkedLoan: false });
});

test("real browser creates and edits a linked investment with stable IDs", async () => {
  await evaluate(`(() => { const p=FFSCalculator.emptyPlan(); p.incomeItems=[]; p.assetItems=[]; p.liabilityItems=[]; p.expenseItems=[]; FFSStage1BrowserTestHooks.setPlan(p,'investments'); FFSStage1BrowserTestHooks.openLinkedSetup('investment'); })()`);
  await evaluate(`(() => { const set=(field,value,event='input')=>{const el=document.querySelector('[data-linked-setup-field="'+field+'"]'); el.value=value; el.dispatchEvent(new Event(event,{bubbles:true}));}; set('name','Managed portfolio'); set('investmentType','managedFund','change'); set('value','100000'); set('annualIncome','4500'); const loan=document.querySelector('[data-linked-setup-field="hasLoan"]'); loan.checked=true; loan.dispatchEvent(new Event('change',{bubbles:true})); set('loanBalance','25000'); document.querySelector('[data-linked-setup-form="investment"]').requestSubmit(); })()`);
  await waitFor(() => evaluate("document.getElementById('linkedSetupDialog').classList.contains('hidden')"));
  const first = await evaluate(`(() => { const p=FFSStage1BrowserTestHooks.getPlan(); const a=p.assetItems.find(x=>x.name==='Managed portfolio'); return {assetId:a.id,income:p.incomeItems.find(x=>x.linkedAssetId===a.id),loan:p.liabilityItems.find(x=>x.linkedAssetId===a.id)}; })()`);
  assert.equal(first.income.type, "distributions");
  assert.ok(first.loan.id);
  await evaluate(`FFSStage1BrowserTestHooks.openLinkedSetup('investment',${JSON.stringify(first.assetId)}); (()=>{const el=document.querySelector('[data-linked-setup-field="owner"]'); el.value='person2'; el.dispatchEvent(new Event('change',{bubbles:true}));})(); document.querySelector('[data-linked-setup-form="investment"]').requestSubmit()`);
  await waitFor(() => evaluate("document.getElementById('linkedSetupDialog').classList.contains('hidden')"));
  const edited = await evaluate(`(() => { const p=FFSStage1BrowserTestHooks.getPlan(); return {asset:p.assetItems.find(x=>x.id===${JSON.stringify(first.assetId)}), income:p.incomeItems.find(x=>x.linkedAssetId===${JSON.stringify(first.assetId)}), loan:p.liabilityItems.find(x=>x.linkedAssetId===${JSON.stringify(first.assetId)})}; })()`);
  assert.deepEqual([edited.asset.owner, edited.income.owner, edited.loan.owner], ["person2", "person2", "person2"]);
  assert.equal(edited.asset.id, first.assetId);
  await navigate();
  assert.equal(await evaluate(`FFSStage1BrowserTestHooks.getPlan().assetItems.some(x=>x.id===${JSON.stringify(first.assetId)})`), true);
});

test("real browser exposes accurate provenance for every quick scenario and legacy samples", async () => {
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'decision')");
  const quick = await evaluate("FFSStage1BrowserTestHooks.quickScenarioProvenance()");
  assert.equal(quick.length, 8);
  quick.forEach((scenario) => assert.ok(scenario.changes.length > 0, scenario.label));
  const samples = await evaluate("FFSStage1BrowserTestHooks.sampleScenarioList(FFS_DATA.samplePlans[1].plan).filter(x=>x.scenarioType==='decision').map(x=>({name:x.name,changes:x.changedInputs}))");
  assert.equal(samples.find((item) => item.name === "Invest extra $10k").changes[0].label, "Investment contribution");
  assert.equal(samples.find((item) => item.name === "Lower expenses").changes[0].label, "Expenses");
});

test("real browser dialog controller manages focus, Tab, Shift+Tab, Escape and background inertness", async () => {
  const policy = await evaluate(`(() => { const opener=document.querySelector('[data-policy-page="privacy"]'); opener.focus(); opener.click(); return {active:document.activeElement.getAttribute('aria-label'), inert:document.querySelector('body > .min-h-screen').inert}; })()`);
  assert.equal(policy.active, "Close");
  assert.equal(policy.inert, true);
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Close");
  await key("Tab", 8);
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Close");
  const backgroundFocus = await evaluate("document.getElementById('enterDataButton').focus(); document.activeElement.getAttribute('aria-label') || document.activeElement.id");
  assert.equal(backgroundFocus, "Close");
  await key("Escape");
  assert.equal(await evaluate("document.getElementById('policyDialog').classList.contains('hidden')"), true);
  assert.equal(await evaluate("document.activeElement.dataset.policyPage"), "privacy");

  await evaluate(`(() => { const opener=document.getElementById('enterDataButton'); opener.focus(); FFSStage1BrowserTestHooks.openDurabilityDialog({title:'Test backup',body:'Test',actions:[{label:'Close',action:'close'}]}); })()`);
  assert.equal(await evaluate("document.activeElement.textContent"), "Close");
  await key("Escape");
  assert.equal(await evaluate("document.activeElement.id"), "enterDataButton");
});

test("real browser has no overflow at required widths and no console errors", async () => {
  for (const width of [375, 390, 430]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("FFSStage1BrowserTestHooks.showWorkspace('dashboard')");
    const dimensions = await evaluate("({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
    assert.ok(dimensions.scroll <= dimensions.client, `${width}px overflow: ${JSON.stringify(dimensions)}`);
  }
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  assert.deepEqual(browserMessages, []);
});
