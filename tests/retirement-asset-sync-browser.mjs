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
      let body = await readFile(resolved);
      if (relative === "app.js") body = Buffer.from(body.toString().replace("  function escapeHtml(value) {", "  window.__growthAuditForecast = candidate => calculatePlan(candidate);\n  function escapeHtml(value) {"));
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

for (const width of [1366, 375, 390, 430]) test(`Issue 94: income and sale editing retains independent expansion, focus and scroll at ${width}px`, async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
  await evaluate('localStorage.clear();sessionStorage.clear()');await navigate();
  await evaluate(`(()=>{const p=FFSCalculator.emptyPlan();Object.assign(p.personal,{person1Name:'Alex',person1Age:68,person2Name:'Sam',person2Age:68,fullRetirementAge:68,targetAnnualSpending:20000});p.assetItems=[{id:'land',name:'Vacant land',category:'otherProperty',value:300000,owner:'joint'},{id:'rental',name:'Rental property',category:'investmentProperty',value:400000,owner:'joint'}];p.assets.cash=100000;FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-semi-action="add-one-off-income-event"]').click();})()`);
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const first=await evaluate(`document.querySelector('[data-one-off-income-id]').dataset.oneOffIncomeId`);
  assert.equal(await evaluate(`document.querySelector('[data-one-off-income-id]').open`),true,'new income opens');
  async function edit(index,field,value,{typing=false,selection=false}={}) {
    const selector=`[data-semi-input="scenario.oneOffIncomeEvents.${index}.${field}"]`;
    await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;n.scrollIntoView({block:'center',behavior:'instant'});n.focus({preventScroll:true});window.__eventInput=n;window.__eventScroll=scrollY;})()`);
    if(typing){
      await evaluate(`__eventInput.value='';__eventInput.dispatchEvent(new Event('input',{bubbles:true}))`);
      for(const character of String(value)) await cdp.send('Input.insertText',{text:character});
    } else await evaluate(`__eventInput.value=${JSON.stringify(String(value))};__eventInput.dispatchEvent(new Event('input',{bubbles:true}))`);
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    if(selection)await evaluate('__eventInput.setSelectionRange(2,5,"backward")');
    await evaluate(`window.__eventScroll=scrollY;__eventInput.dispatchEvent(new Event('change',{bubbles:true}));window.__afterChange=scrollY`);
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const state=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});return {same:n===__eventInput,focused:document.activeElement===n,open:n.closest('[data-one-off-income-id]').open,value:n.value,scroll:Math.abs(scrollY-__eventScroll),selection:[n.selectionStart,n.selectionEnd,n.selectionDirection]}})()`);
    assert.equal(state.open,true,field);assert.equal(state.same,true,`${field}: native input retained`);assert.equal(state.focused,true,`${field}: keyboard focus`);assert.equal(state.value,String(value),field);assert.ok(state.scroll<=2,`${field}: scroll moved ${state.scroll}; ${await evaluate("JSON.stringify({before:__eventScroll,after:__afterChange,now:scrollY,max:document.documentElement.scrollHeight-innerHeight,visual:visualViewport.offsetTop})")}`);
    if(selection)assert.deepEqual(state.selection,[2,5,'backward']);
  }
  await edit(0,'description','Family assistance',{typing:true,selection:true});
  await edit(0,'amountTodayDollars',25000,{typing:true});
  await edit(0,'year',2028);
  await evaluate(`document.querySelector('[data-one-off-income-id] > summary').focus()`);await key('Enter');
  assert.equal(await evaluate(`document.querySelector('[data-one-off-income-id]').open`),false,'explicit keyboard collapse');
  await evaluate(`document.querySelector('[data-semi-action="add-personal-asset-sale"]').click()`);
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const saleId=await evaluate(`document.querySelectorAll('[data-one-off-income-id]')[1].dataset.oneOffIncomeId`);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-one-off-income-id]')).map(n=>n.open)`),[false,true]);
  await edit(1,'assetSaleId','rental');
  await edit(1,'amountTodayDollars',450000,{typing:true});
  await edit(1,'sellingCostPct',2.5,{typing:true});
  await edit(1,'taxTreatment','net-capital-gain');
  await edit(1,'taxableCapitalGainPerson1',50000,{typing:true});
  await edit(1,'taxableCapitalGainPerson2',25000,{typing:true});
  await edit(1,'year',2029);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-one-off-income-id]')).map(n=>n.open)`),[false,true],'second event does not reopen first');
  await edit(1,'taxTreatment','exempt');
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.1.taxableCapitalGainPerson1"]')===null`),true);
  await edit(1,'taxTreatment','net-capital-gain');
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.1.taxableCapitalGainPerson1"]').value`),'50000');
  await evaluate(`document.querySelector('[data-semi-action="calculate"]').click()`);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-one-off-income-id]')).map(n=>n.open)`),[false,true],'full render retains independent states');
  await evaluate(`document.querySelector('[data-save-stage-g-scenario="retirement"]').click();document.querySelector('#stageGScenarioName').value='Event editor ${width}';document.querySelector('[data-scenario-save-action="save"]').click()`);
  await evaluate(`Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Event editor ${width}')).querySelector('[data-open-scenario]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.0.description"]').value`),'Family assistance');
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.oneOffIncomeEvents.1.sellingCostPct"]').value`),'2.5');
  await evaluate(`document.querySelector('[data-event-id="${first}"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-one-off-income-id]').dataset.oneOffIncomeId`),saleId,'state follows stable ID after index changes');
  assert.equal(await evaluate(`document.querySelector('[data-one-off-income-id]').open`),true);
  await edit(0,'sellingCostPct',3);
  assert.deepEqual(browserMessages,[]);
});

for(const width of [1366,375])test(`Issue 95: property rates, equity, totals and dollar basis reconcile at ${width}px`,async()=>{
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
  await evaluate('localStorage.clear();sessionStorage.clear()');await navigate();
  await evaluate(`(()=>{const p=FFSCalculator.emptyPlan();Object.assign(p.personal,{person1Name:'Alex',person1Age:43,fullRetirementAge:65,targetAnnualSpending:0,retirementTiming:{people:[{id:'person1',fullRetirementAge:65,hasSemiRetirement:false,alreadyRetired:false}]}});p.assetItems=[{id:'land',name:'Example land',category:'otherProperty',value:600000,capitalGrowthRatePct:3,owner:'person1'},{id:'home',name:'Home',category:'home',value:800000,owner:'person1'},{id:'shares',name:'Shares',category:'shares',value:500000,owner:'person1'}];Object.assign(p.assets,{otherPropertyValue:600000,homeValue:800000,sharesEtfs:500000,superPerson1:200000});p.liabilityItems=[{id:'loan',name:'Property loan',type:'rentalPropertyLoan',linkedAssetId:'land',balance:Math.round((600000*1.03**15-529857*1.025**15)*100)/100,interestRatePct:0,repayment:0,termYears:30,repaymentType:'interestOnly'}];FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-semi-action="calculate"]').click();document.querySelector('[data-save-stage-g-scenario="retirement"]').click();document.querySelector('#stageGScenarioName').value='Property audit ${width}';document.querySelector('[data-scenario-save-action="save"]').click();FFSStage1BrowserTestHooks.showWorkspace('assumptions');document.querySelector('[data-growth-open]').click();document.querySelector('[data-growth-year]').value='15';document.querySelector('[data-growth-year]').dispatchEvent(new Event('change'));})()`);
  const before=await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())');
  const propertyCells=()=>evaluate(`Array.from(document.querySelectorAll('.growth-table tbody tr')).find(r=>r.querySelector('th').textContent==='Investment property equity').innerText`);
  assert.match(await propertyCells(),/529,857.*529,857.*529,857/s);
  for(const name of ['Lower','Base','Higher'])assert.match(await evaluate(`document.querySelector('[data-growth-result="${name}"] .growth-property-rates').textContent`),/Example land: 3% — Fixed individual rate/);
  await evaluate(`document.querySelectorAll('[data-growth-overrides]').forEach(n=>n.click())`);
  assert.doesNotMatch(await propertyCells(),/529,857.*529,857.*529,857/s);
  for(const basis of ['future','today']){
    await evaluate(`document.querySelector('[data-dollar-basis="${basis}"]').click()`);
    const values=await evaluate(`(()=>{const p=FFSStage1BrowserTestHooks.getPlan(),s=FFSGrowthScenarios.suggested(p);return Object.entries(s).map(([name,scenario])=>{scenario.includeOverrides=true;const r=FFSGrowthScenarios.calculate(p,scenario,q=>__growthAuditForecast(q)),row=r.rows.find(x=>x.year===15);return {name,row:FFSGrowthScenarios.display(row,p.investing.inflationPct,${JSON.stringify(basis)}),debt:FFSCalculator.projectedDebtAtYear(r.result,15),rate:r.propertyRates.find(a=>a.id==='land').value};})})()`);
    const parse=s=>Number(s.replace(/[^\d.-]/g,''));
    for(const [index,{name,row,rate}] of values.entries()){
      const shown=await evaluate(`(()=>{const rows=Array.from(document.querySelectorAll('.growth-table tbody tr'));return {property:rows.find(r=>r.querySelector('th').textContent==='Investment property equity').querySelectorAll('td')[${index}].textContent,total:rows.at(-1).querySelectorAll('td')[${index}].textContent,bar:document.querySelectorAll('.growth-chart meter')[${index}].value,card:document.querySelector('[data-growth-result="${name}"] .growth-total').textContent,mobile:document.querySelector('[data-growth-mobile-scenario="${name}"] [data-growth-mobile-metric="property"] dd').textContent,rates:document.querySelector('[data-growth-result="${name}"] .growth-property-rates').textContent}})()`);
      assert.ok(Math.abs(parse(shown.property)-row.property)<=.5);assert.ok(Math.abs(parse(shown.total)-row.netWorth)<=.5);assert.equal(shown.bar,row.netWorth);assert.equal(shown.card,shown.total);assert.equal(shown.mobile,shown.property);assert.match(shown.rates,new RegExp('Example land: '+rate+'% — Scenario rate'));
      assert.ok(Math.abs(row.netWorth-(row.investments+row.super+row.home+row.property))<.1);
    }
    assert.equal(new Set(values.map(v=>v.debt)).size,1,'growth does not change loan schedules');
  }
  assert.equal(await evaluate('JSON.stringify(FFSStage1BrowserTestHooks.getPlan())'),before,'comparison never saves overlay rates');
  await evaluate(`FFSStage1BrowserTestHooks.showWorkspace('scenarios');Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Property audit ${width}')).querySelector('[data-open-scenario]').click()`);
  assert.match(await evaluate(`document.querySelector('[data-view-panel="semiretirement"]').textContent`),/Historical snapshot/);
  await evaluate(`FFSStage1BrowserTestHooks.showWorkspace('scenarios');Array.from(document.querySelectorAll('.scenario-library-card')).find(c=>c.textContent.includes('Property audit ${width}')).querySelector('.scenario-print-inline').click()`);
  const report=await evaluate(`document.querySelector('#saved-scenario-print-root').textContent`);assert.match(report,/Example land/);assert.doesNotMatch(report,/legacy-other-property/);
  const out=path.join(root,'output/issue95');await mkdir(out,{recursive:true});const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await writeFile(path.join(out,`saved-property-${width}.pdf`),Buffer.from(pdf.data,'base64'));await evaluate(`window.dispatchEvent(new Event('afterprint'))`);
  assert.deepEqual(browserMessages,[]);
});
