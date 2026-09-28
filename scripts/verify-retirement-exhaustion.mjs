// Optional browser evidence harness. Install Playwright separately or set
// FFS_PLAYWRIGHT_MODULE to its installed entry point. No production test hooks.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { fixture, trace } from './retirement-exhaustion-fixture.mjs';
import { load, household } from './fi-cashflow-fixture.mjs';
const root=resolve(process.argv[2] || '.');
const output=resolve(process.argv[3] || 'outputs/retirement-exhaustion'); mkdirSync(output,{recursive:true});
const { chromium }=await import(process.env.FFS_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href : 'playwright');
const git=process.env.FFS_GIT || 'git';
const read=(name,before=false)=>before ? execFileSync(git,['show','main:'+name],{cwd:root,encoding:'utf8'}) : readFileSync(resolve(root,name),'utf8');
function model(before,input) {
  const c={console};c.globalThis=c;
  for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js']) vm.runInNewContext(read(file,before),c);
  const result=c.FFSSemiRetirementProjection.projectRetirementScenario(input);
  assert.equal(result.validation.isValid,true);
  return {result,view:c.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(result,input)};
}
function functionSource(source,name) {
  const start=source.indexOf('  function '+name+'('); assert.ok(start>=0,name);
  const end=source.indexOf('\n  function ',start+5);
  return source.slice(start,end<0?undefined:end);
}
function render(before,input) {
  const m=model(before,input); const source=read('app.js',before);
  const c={view:m.view,Intl,console};
  c.money=v=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(v);
  c.escapeHtml=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const names=['semiRetirementMoney','semiRetirementAgeList','semiRetirementMetricCard','milestoneAgesFromObject','semiRetirementFirstAgeLabel','semiRetirementProjectionEndLabel','semiRetirementAccessibleLastLabel'];
  if(!before) names.push('renderRetainedAssetsHtml');
  names.push('renderSemiRetirementLongevityHtml');
  vm.runInNewContext(names.map(n=>functionSource(source,n)).join('\n')+'\nhtml=renderSemiRetirementLongevityHtml(view);',c);
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/tailwind-static.css"><link rel="stylesheet" href="/styles.css"></head><body><main style="max-width:1100px;margin:auto;padding:16px"><h2>Synthetic retirement scenario</h2>'+c.html+'</main></body></html>';
}
const input=fixture();
const before=model(true,input).result,after=model(false,input).result;
writeFileSync(resolve(output,'before.json'),JSON.stringify({summary:before.summary,trace:trace(before)},null,2));
writeFileSync(resolve(output,'after.json'),JSON.stringify({summary:after.summary,trace:trace(after)},null,2));
// Unaffected outputs must be identical after removing additive report metadata.
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['retainedAssets','owner','ownershipPercent','yearEndSuperWithdrawal','yearEndAccessibleWithdrawal','calculationVersion'].includes(k)).map(([k,x])=>[k,strip(x)])):v;
const parity=[];
for(const variant of ['well-funded','zero-return','no-spending']) {
  const i=fixture();
  if(variant==='well-funded') i.people[0].openingSuperBalance=1e7;
  if(variant==='zero-return') { i.people[0].superReturnAfterRetirement=0;i.accessibleInvestments.annualReturnRate=0; }
  if(variant==='no-spending') {i.household.currentLifestyleSpending=0;i.household.semiRetirementLifestyleSpending=0;i.household.fullRetirementLifestyleSpending=0;i.scenario.fullRetirementAnnualSpending=0;}
  assert.deepEqual(JSON.parse(JSON.stringify(strip(model(false,i).result))),JSON.parse(JSON.stringify(strip(model(true,i).result))),variant);
  parity.push({variant,financialOutputParity:true});
}
writeFileSync(resolve(output,'parity.json'),JSON.stringify(parity,null,2));
const pages={'/before':render(true,input),'/after':render(false,input)};
const large=fixture();large.assets[0].openingValue=9e12;large.assets[0].name='Long property name for mobile wrapping and large projected values';
pages['/large']=render(false,large);
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(pages[url.pathname]) {res.setHeader('Content-Type','text/html');res.end(pages[url.pathname]);return;}
  if(url.pathname==='/favicon.ico') {res.writeHead(204);res.end();return;}
  if(url.pathname.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
  const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+sep)) {res.writeHead(403);res.end();return;}
  try {res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'text/plain');res.end(readFileSync(file));} catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.FFS_BROWSER_PATH?{executablePath:process.env.FFS_BROWSER_PATH}:{channel:'msedge'})});
const errors=[];const checks=[];
try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
  await page.goto(origin);await page.waitForFunction(()=>Boolean(window.FFSStage1BrowserTestHooks));
  assert.ok((await page.locator('body').innerText()).length>100);
  await page.evaluate(()=>FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'semiretirement'));
  await page.locator('[data-semi-action="calculate"]').click();
  await page.getByRole('heading',{name:'Property & other assets still owned'}).waitFor();
  assert.match(await page.locator('.retained-assets').innerText(),/Net equity remaining/i);
  await page.setViewportSize({width:375,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.retained-assets').screenshot({path:resolve(output,'app-retained-assets-375.png')});
  await page.screenshot({path:resolve(output,'app-smoke.png'),fullPage:true});
  checks.push({check:'Actual app loads and sample plan renders',pass:true});
  const fiTools=load(pathToFileURL(root+sep));const fiPlan=household(fiTools.CALC);
  const financial=fiTools.CALC.calculatePlan(fiPlan);
  writeFileSync(resolve(output,'cashflow-reconciliation.json'),JSON.stringify({input:fiPlan,wealth:financial.fiWealth,
    nextYearWealth:financial.fiWealthProjection[1],cashflow:financial.householdCashflow,tax:financial.taxEstimate,
    propertyCashflow:financial.rentalPropertyCashflow.propertyResults},null,2));
  // Readiness requires positive growth assumptions; current balances/cashflow
  // are unchanged. The zero-growth calculation fixture above remains separate.
  const browserFiPlan=structuredClone(fiPlan);
  Object.assign(browserFiPlan.investing,{expectedInvestmentReturnPct:5,expectedSuperReturnPct:5,inflationPct:2.5});
  await page.evaluate(p=>FFSStage1BrowserTestHooks.setPlan(p,'dashboard'),browserFiPlan);
  await page.evaluate(()=>{const slider=document.querySelector('[data-dashboard-future-age]');slider.value='43';slider.dispatchEvent(new Event('input',{bubbles:true}));});
  const futureText=await page.locator('[data-dashboard-future-results]').first().innerText();
  assert.match(futureText,/Accessible FI Assets/i);assert.match(futureText,/\$340,000/);assert.match(futureText,/\$690,000/);
  for(const width of [1366,375]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('.dashboard-future-card').first().screenshot({path:resolve(output,'future-you-'+width+'.png')});
  }
  await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('setup'));
  const summary=await page.locator('#setupSummary').innerText();
  assert.match(summary,/48,000/);assert.match(summary,/7,880/);assert.match(summary,/120,000/);
  await page.setViewportSize({width:1366,height:900});
  await page.locator('#setupSummary').screenshot({path:resolve(output,'live-summary-1366.png')});
  checks.push({check:'Future You current composition and Live Summary dollar reconciliation',pass:true});
  for(const mode of ['before','after','large']) for(const width of [1366,375]) {
    await page.setViewportSize({width,height:900});await page.goto(origin+'/'+mode);
    const dimensions=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
    assert.ok(dimensions.width<=width,JSON.stringify({mode,...dimensions}));
    if(mode!=='before') {await page.getByRole('heading',{name:'Property & other assets still owned'}).waitFor();assert.match(await page.locator('body').innerText(),/Exhausted by Age 85/);}
    await page.screenshot({path:resolve(output,mode+'-'+width+'.png'),fullPage:true});
    checks.push({check:mode+' '+width+'px',pass:true,...dimensions});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'browser-checks.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors,parity},null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));}
