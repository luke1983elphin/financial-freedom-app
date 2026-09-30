import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/minor-presentation');mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
 if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'}),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);
 const p=investmentReturnFixture(false),asset=p.assetItems.find(a=>a.id==='shares');
 Object.assign(asset,{value:56000,expectedTotalReturnPct:10,expectedIncomeYieldPct:5000/56000*100,incomeTreatment:'cash',owner:'person1'});
 p.incomeItems=p.incomeItems.filter(i=>i.id!=='div');p.incomeItems.push({id:'div',type:'dividends',owner:'person1',amount:5000,frequency:'annually',linkedAssetId:'shares'});
 const precise=asset.expectedIncomeYieldPct;
 for(const category of ['shares','etf','managedFund']){
  const fixture=structuredClone(p);fixture.assetItems.find(a=>a.id==='shares').category=category;
  await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.setWizardStep(2);FFSStage1BrowserTestHooks.closeDurabilityDialog();},fixture);
  const input=page.locator('#wizardAssetsForm [data-id="shares"][data-key="expectedIncomeYieldPct"]');
  assert.equal(await input.inputValue(),'8.93');await input.focus();await input.blur();
  assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='shares').expectedIncomeYieldPct),precise);
 }
 checks.push('shares, ETF and managed fund display 8.93 without changing internal precision on focus/blur');
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.openLinkedSetup('investment','shares');},p);
 const yieldInput=()=>page.locator('[data-linked-setup-field="expectedIncomeYieldPct"]');assert.equal(await yieldInput().inputValue(),'8.93');
 await yieldInput().focus();await yieldInput().blur();
 await page.locator('#linkedSetupBody button[type="submit"]').click();await page.evaluate(()=>FFSStage1BrowserTestHooks.closeDurabilityDialog());
 await page.reload();await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);
 const stored=await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='shares'));
 assert.equal(stored.expectedIncomeYieldPct,precise);assert.equal(await page.evaluate(()=>FFSCalculator.investmentReturnAmounts(FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='shares')).cashIncome),5000);
 await page.evaluate(()=>{FFSStage1BrowserTestHooks.closeDurabilityDialog();FFSStage1BrowserTestHooks.openLinkedSetup('investment','shares');});
 assert.equal(await yieldInput().inputValue(),'8.93');
 for(const [name,width,height] of [['desktop',1440,1100],['mobile',375,900]]){
  await page.setViewportSize({width,height});await yieldInput().scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`yield-${name}.png`)});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await yieldInput().fill('8.75');await yieldInput().blur();await page.locator('#linkedSetupBody button[type="submit"]').click();
 assert.equal(Number(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='shares').expectedIncomeYieldPct)),8.75);
 checks.push('guided untouched save and actual reload preserve precise yield and $5,000 cash income; explicit edits save normally');
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.closeDurabilityDialog();},p);
 const before=await page.evaluate(()=>JSON.stringify(FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan())));
 async function help(key,pattern,name){
  const button=page.locator(`[data-info-key="${key}"]:visible`).first();await button.scrollIntoViewIfNeeded();
  if(name==='mobile'){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,key);}
  await button.click();await page.locator('#goalInfoBody').waitFor({state:'visible'});assert.match(await page.locator('#goalInfoBody').innerText(),pattern);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(name==='mobile')await page.screenshot({path:resolve(out,`help-${key}-mobile.png`)});
  await page.keyboard.press('Escape');
 }
 for(const [name,width,height] of [['desktop',1440,1100],['mobile',375,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{FFSStage1BrowserTestHooks.setWizardStep(8);FFSStage1BrowserTestHooks.closeDurabilityDialog();});
  const summary=page.locator('#setupSummary');assert.match(await summary.innerText(),/Your target annual investing/);assert.match(await summary.innerText(),/Affordable cashflow used to invest/);assert.match(await summary.innerText(),/Modelled super access age 60/);
  for(const id of ['setupSummary','wizardResultsSummary']){assert.match(await page.locator('#'+id).innerText(),/Age Pension is not included in these projections/);await page.locator('#'+id).screenshot({path:resolve(out,`${id}-${name}.png`),style:'header { visibility: hidden !important; }'});}
  await help('targetAnnualInvesting',/may reduce the actual amount invested/,name);await help('superAvailability',/different years/,name);await help('agePensionExclusion',/age, residency, income, assets and household circumstances/,name);
  await page.evaluate(()=>FFSStage1BrowserTestHooks.setWizardStep(7));assert.match(await page.locator('#wizardMlsAssumption').innerText(),/0%, 1%, 1.25%, 1.5%/);assert.match(await page.locator('#wizardMlsAssumption').innerText(),/2026-27/);
  await page.locator('#wizardMlsAssumption').screenshot({path:resolve(out,`mls-${name}.png`)});await help('medicareLevySurchargeAssumption',/Taxable income alone does not determine/,name);
  await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('dashboard'));
  // Financial Details uses the existing disclosure panel; open it before testing its help.
  const remaining=page.locator('[data-info-key="remainingRequired"]').first();
  await remaining.evaluate(e=>{for(let n=e.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});
  await help('remainingRequired',/minimum of zero/,name);
  const future=page.locator('[data-info-key="futureAccessibleFiAssets"]').first();await future.evaluate(e=>{for(let n=e.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});
  await help('futureAccessibleFiAssets',/each person's super becomes accessible separately/i,name);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 const after=await page.evaluate(()=>JSON.stringify(FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan())));assert.equal(after,before);
 checks.push('all seven refinements checked at 1440px and 375px; new info buttons are 44px on mobile; opening help does not change financial outputs');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.close();}
