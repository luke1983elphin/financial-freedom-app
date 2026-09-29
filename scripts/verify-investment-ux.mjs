import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/investment-ux');mkdirSync(out,{recursive:true});
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
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);
 const fixture=investmentReturnFixture(false);fixture.investing.expectedInvestmentReturnPct=9;
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.closeDurabilityDialog();FFSStage1BrowserTestHooks.openLinkedSetup('investment');},fixture);
 const guided=key=>page.locator(`[data-linked-setup-field="${key}"]`);
 assert.equal(await guided('expectedTotalReturnPct').inputValue(),'7');assert.equal(await guided('expectedIncomeYieldPct').inputValue(),'0');assert.equal(await guided('incomeTreatment').inputValue(),'reinvest');assert.equal(await guided('investmentReturnMode').count(),0);
 await guided('name').fill('New QA investment');await guided('value').fill('50000');await guided('value').blur();
 await guided('expectedIncomeYieldPct').fill('3');await guided('expectedIncomeYieldPct').blur();
 const outcome=page.locator('#linkedSetupBody .investment-annual-outcome');assert.match(await outcome.innerText(),/4\.0% · \$2,000/);assert.match(await outcome.innerText(),/3\.0% · \$1,500/);assert.match(await outcome.innerText(),/7\.0% · \$3,500/);
 await guided('expectedTotalReturnPct').fill('8');await guided('expectedTotalReturnPct').blur();assert.match(await outcome.innerText(),/\$4,000/);
 await guided('expectedTotalReturnPct').fill('7');await guided('expectedTotalReturnPct').blur();
 await guided('incomeTreatment').selectOption('cash');assert.match(await outcome.innerText(),/\$1,500 p.a. is currently modelled as cash/);
 await guided('investmentType').selectOption('managedFund');assert.equal(await page.getByText('Expected distribution yield (%)',{exact:true}).count(),1);assert.equal(await guided('incomeTreatment').locator('option:checked').innerText(),'Take distributions as cash');
 await guided('investmentType').selectOption('otherInvestment');assert.equal(await guided('expectedTotalReturnPct').count(),0);assert.equal(await outcome.count(),0);
 await guided('investmentType').selectOption('shares');assert.equal(await guided('expectedTotalReturnPct').inputValue(),'7');assert.equal(await guided('expectedIncomeYieldPct').inputValue(),'0');
 await guided('expectedIncomeYieldPct').fill('8');await guided('expectedIncomeYieldPct').blur();await page.locator('#linkedSetupBody button[type="submit"]').click();assert.match(await page.locator('#linkedSetupBody').innerText(),/cannot exceed/);
 await guided('expectedIncomeYieldPct').fill('3');await guided('expectedIncomeYieldPct').blur();
 for(const [name,width,height] of [['desktop',1440,1100],['mobile',375,900]]){
  await page.setViewportSize({width,height});await guided('expectedTotalReturnPct').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`guided-${name}-inputs.png`)});
  await outcome.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`guided-${name}-outcome.png`)});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('#linkedSetupBody .investment-return-section').evaluate(e=>e.scrollWidth<=e.clientWidth));
 }
 await page.locator('#linkedSetupBody button[type="submit"]').click();
 assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.name==='New QA investment').expectedIncomeYieldPct),'3');checks.push('new guided defaults, editable return, canonical outcome, managed wording, switching, validation, save and responsive layout');
 await page.setViewportSize({width:1440,height:1100});
 const p=structuredClone(fixture);p.assetItems=[{id:'ux',name:'UX asset',category:'cash',value:50000}];p.incomeItems=p.incomeItems.filter(i=>!i.linkedAssetId);
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.setWizardStep(2);FFSStage1BrowserTestHooks.closeDurabilityDialog();},p);
 const field=key=>{const locator=page.locator(`#wizardAssetsForm [data-id="ux"][data-key="${key}"]`);return key==='category'?locator.first():locator;};
 for(const category of ['shares','home','shares','cash','managedFund','other','crypto','shares','rentalInvestmentProperty','super','shares','otherProperty','offset','vehicle']){
  await field('category').selectOption(category);
  const supports=['shares','managedFund','crypto'].includes(category),income=['shares','managedFund'].includes(category);
  assert.equal(await field('expectedTotalReturnPct').count(),supports?1:0,category);assert.equal(await field('expectedIncomeYieldPct').count(),income?1:0,category);assert.equal(await field('incomeTreatment').count(),income?1:0,category);assert.equal(await page.locator('#wizardAssetsForm .investment-return-section [data-key=owner]').count(),income?1:0,category);
  const saved=await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='ux'));
  if(!supports)assert.equal(saved.investmentReturnMode,undefined,category);
  else assert.equal(saved.expectedTotalReturnPct,7,category);
 }
 await field('category').selectOption('shares');await page.evaluate(()=>FFSStage1BrowserTestHooks.closeDurabilityDialog());await field('expectedIncomeYieldPct').click();await field('expectedIncomeYieldPct').fill('8');assert.equal(await field('expectedIncomeYieldPct').evaluate(e=>e.validity.valid),false);
 await field('expectedIncomeYieldPct').fill('3');await field('expectedIncomeYieldPct').blur();await field('expectedTotalReturnPct').fill('8');await field('expectedTotalReturnPct').blur();
 assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='ux').expectedTotalReturnPct),8);
 await page.locator('#wizardAssetsForm .investment-return-section').screenshot({path:resolve(out,'manual-desktop.png')});
 await page.setViewportSize({width:375,height:900});await page.locator('#wizardAssetsForm .investment-return-section').screenshot({path:resolve(out,'manual-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('all 11 asset types, required type transitions, stale fields cleared, direct validation and editable return');
 // The normal plan and wizard share the same asset card renderer.
 assert.equal(await page.locator('#assetsForm [data-id="ux"][data-key="expectedTotalReturnPct"]').inputValue(),'8');
 const legacy=structuredClone(p);legacy.assetItems[0].category='shares';
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.setWizardStep(2);},legacy);
 assert.equal(await field('expectedTotalReturnPct').count(),0);assert.equal(await page.locator('#wizardAssetsForm [data-investment-setup="ux"]').innerText(),'Set up investment income');
 assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='ux').investmentReturnMode),undefined);
 await page.locator('#wizardAssetsForm [data-investment-setup="ux"]').click();assert.equal(await field('expectedTotalReturnPct').inputValue(),'9');
 await page.evaluate(()=>{FFSStage1BrowserTestHooks.openLinkedSetup('investment','ux');});
 assert.equal(await guided('expectedTotalReturnPct').inputValue(),'9');assert.equal(await guided('investmentReturnMode').count(),0);await page.evaluate(()=>FFSStage1BrowserTestHooks.closeLinkedSetup());
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.openLinkedSetup('investment','ux');},legacy);
 assert.equal(await guided('expectedTotalReturnPct').count(),0);await page.locator('#linkedSetupBody [data-investment-setup="guided"]').click();assert.equal(await guided('expectedTotalReturnPct').inputValue(),'9');
 checks.push('normal editor parity, existing configured edit, legacy direct/guided opt-in without automatic migration');
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.closeLinkedSetup();p.incomeItems.push({id:'old-dividend',type:'dividends',owner:'person1',amount:10000,frequency:'annually',linkedAssetId:'ux'});FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.setWizardStep(2);FFSStage1BrowserTestHooks.closeDurabilityDialog();},legacy);
 await page.locator('#wizardAssetsForm [data-investment-setup="ux"]').click();
 assert.match(await page.locator('#linkedSetupBody').innerText(),/cannot exceed/);
 assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='ux').investmentReturnMode),undefined);
 assert.equal(Number(await guided('expectedIncomeYieldPct').inputValue()),20);
 checks.push('invalid legacy yield suggestion opens an editable draft without persisting invalid configuration');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.close();}
