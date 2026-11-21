// Kept outside the default unit-test inventory because it launches a real browser.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
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


async function changeField(fieldPath, value) {
  await evaluate(`(()=>{const field=document.querySelector('[data-semi-input="'+${JSON.stringify(fieldPath)}+'"]');field.value=${JSON.stringify(String(value))};field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}


test('My Plan edits refresh a dirty retirement forecast and exported reports; saved inputs stay historical', async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`(()=>{const p=structuredClone(FFS_DATA.samplePlans[1].plan);Object.assign(p.personal,{person1Age:43,person2Age:43,person2Name:'Sam',fullRetirementAge:65});delete p.personal.retirementTiming;p.assetItems=[{id:'sync-property',name:'259 Bakers Beach Road',category:'otherProperty',value:300000,capitalGrowthRatePct:0,owner:'joint'}];p.liabilityItems=[];FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();})()`);
  await changeField('household.fullRetirementLifestyleSpending',42000);
  await evaluate(`document.querySelector('[data-semi-action="calculate"]').click()`);
  await evaluate(`(()=>{const p=FFSStage1BrowserTestHooks.getPlan();Object.assign(p.assetItems.find(a=>a.id==='sync-property'),{name:'259 Eagle Point Road',capitalGrowthRatePct:3});FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');})()`);
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="household.fullRetirementLifestyleSpending"]').value`),'42000');
  await evaluate(`document.querySelector('[data-semi-action="calculate"]').click()`);
  const current=await evaluate(`document.querySelector('[data-view-panel="semiretirement"]').textContent`);
  assert.match(current,/259 Eagle Point Road/);assert.doesNotMatch(current,/259 Bakers Beach Road/);
  await evaluate(`document.querySelector('[data-save-stage-g-scenario="retirement"]').click();document.querySelector('#stageGScenarioName').value='Asset sync snapshot';document.querySelector('[data-scenario-save-action="save"]').click()`);
  const id=await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Asset sync snapshot')).querySelector('[data-open-scenario]').dataset.openScenario`);
  const card=await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Asset sync snapshot')).textContent`);
  assert.match(card,/259 Eagle Point Road/);assert.match(card,/Historical snapshot/);
  const out=path.join(root,'output/asset-sync');await mkdir(out,{recursive:true});
  await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Asset sync snapshot')).querySelector('.scenario-print-inline').click()`);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('#saved-scenario-print-root details')).every(d=>d.open)`));
  const savedPdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await writeFile(path.join(out,'saved-scenario.pdf'),Buffer.from(savedPdf.data,'base64'));
  await evaluate(`window.dispatchEvent(new Event('afterprint'))`);
  await evaluate(`(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.assetItems.find(a=>a.id==='sync-property').name='Later My Plan edit';FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');document.querySelector('[data-semi-action="calculate"]').click();})()`);
  await evaluate(`FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.querySelector('[data-compare-scenario="${id}"]').click()`);
  const comparison=await evaluate(`document.querySelector('.semi-retirement-comparison-print-report').textContent`);
  assert.match(comparison,/259 Eagle Point Road/);assert.match(comparison,/Later My Plan edit/);assert.match(comparison,/historical assets/);
  await evaluate(`document.body.dataset.printMode='retirement-comparison'`);
  const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await writeFile(path.join(out,'comparison.pdf'),Buffer.from(pdf.data,'base64'));
  await evaluate(`delete document.body.dataset.printMode;FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.querySelector('[data-open-scenario="${id}"]').click()`);
  const reopened=await evaluate(`document.querySelector('[data-view-panel="semiretirement"]').textContent`);assert.match(reopened,/259 Eagle Point Road/);assert.match(reopened,/Historical snapshot/);
  await writeFile(path.join(out,'browser-evidence.json'),JSON.stringify({current,card,comparison,reopened,browserMessages},null,2));
  assert.deepEqual(browserMessages,[]);
});

test('Issue 92: sell a rental with debt and CGT, save/reopen and export complete settlement', async () => {
  await evaluate('localStorage.clear();sessionStorage.clear()');await navigate();
  await evaluate(`(()=>{const p=FFSCalculator.emptyPlan();Object.assign(p.personal,{person1Name:'Alex',person1Age:68,fullRetirementAge:68,targetAnnualSpending:20000});p.assetItems=[{id:'rental-sale',name:'Rental to sell',category:'investmentProperty',value:300000,capitalGrowthRatePct:3,owner:'person1'},{id:'home-keep',name:'Principal residence',category:'home',value:500000,owner:'person1'}];p.liabilityItems=[{id:'rental-loan',name:'Rental loan',type:'rentalPropertyLoan',linkedAssetId:'rental-sale',balance:100000,interestRatePct:0,repayment:0,termYears:30,repaymentType:'interestOnly'}];p.incomeItems=[{id:'rent',name:'Rental income',type:'rentalNetCashIncome',owner:'person1',amount:9000,rentalCashIncomeAnnual:12000,taxableRentalIncomeAnnual:9000,rentalCashflowTreatment:'beforeInterest',linkedAssetId:'rental-sale',linkedLoanIds:['rental-loan']}];p.assets.cash=100000;FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();})()`);
  assert.match(await evaluate(`document.querySelector('[data-semi-action="add-personal-asset-sale"]').textContent`),/Sell an asset/);
  await evaluate(`document.querySelector('[data-semi-action="add-personal-asset-sale"]').click()`);
  const choices=await evaluate(`Array.from(document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.0.assetSaleId"]').options).map(o=>o.value)`);
  assert.ok(choices.includes('rental-sale'));assert.ok(!choices.includes('home-keep'));
  await changeField('scenario.oneOffIncomeEvents.0.amountTodayDollars',300000);
  await changeField('scenario.oneOffIncomeEvents.0.year',2027);
  await changeField('scenario.oneOffIncomeEvents.0.sellingCostPct',2);
  await changeField('scenario.oneOffIncomeEvents.0.taxTreatment','net-capital-gain');
  await changeField('scenario.oneOffIncomeEvents.0.taxableCapitalGainPerson1',50000);
  await evaluate(`document.querySelector('[data-semi-action="calculate"]').click()`);
  const text=await evaluate(`document.querySelector('[data-view-panel="semiretirement"]').textContent`);
  assert.match(text,/linked loans repaid/);assert.match(text,/100,000/);assert.match(text,/50,000/);assert.match(text,/net taxable/i);
  await evaluate(`document.querySelector('[data-save-stage-g-scenario="retirement"]').click();document.querySelector('#stageGScenarioName').value='Issue 92 rental sale';document.querySelector('[data-scenario-save-action="save"]').click()`);
  const id=await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Issue 92 rental sale')).querySelector('[data-open-scenario]').dataset.openScenario`);
  const card=await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Issue 92 rental sale')).textContent`);assert.match(card,/Asset sales/);assert.match(card,/linked loans repaid/);
  await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Issue 92 rental sale')).querySelector('.scenario-print-inline').click()`);
  const out=path.join(root,'output/asset-sync');await mkdir(out,{recursive:true});const saved=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await writeFile(path.join(out,'issue92-saved-sale.pdf'),Buffer.from(saved.data,'base64'));await evaluate(`window.dispatchEvent(new Event('afterprint'))`);
  await evaluate(`document.querySelector('[data-open-scenario="${id}"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.0.taxableCapitalGainPerson1"]').value`),'50000');
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.0.sellingCostPct"]').value`),'2');
  await evaluate(`document.querySelector('[data-semi-action="reset"]').click();document.querySelector('[data-semi-action="calculate"]').click();FFSStage1BrowserTestHooks.showWorkspace('scenarios');document.querySelector('[data-compare-scenario="${id}"]').click()`);
  const report=await evaluate(`document.querySelector('.semi-retirement-comparison-print-report').textContent`);assert.match(report,/Asset sale: Sell Rental to sell/);assert.match(report,/selling costs/);assert.match(report,/Gains are included once/);
  await evaluate(`document.body.dataset.printMode='retirement-comparison'`);const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await writeFile(path.join(out,'issue92-comparison.pdf'),Buffer.from(pdf.data,'base64'));await evaluate(`delete document.body.dataset.printMode`);
  assert.deepEqual(browserMessages,[]);
});
