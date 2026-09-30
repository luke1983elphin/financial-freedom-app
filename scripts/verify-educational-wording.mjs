import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/wording');mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(f)]||'text/plain');let data=readFileSync(f);if(u.pathname==='/app.js')data=data.toString().replace('window.FFSStage1BrowserTestHooks = {','window.__wordingQA = { calculateSemiRetirementScenario, getRetirement: () => semiRetirementScenarioResult, saveCurrentPlanAsScenario, getSaved: loadScenarios }; window.FFSStage1BrowserTestHooks = {');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p,'decision');FFSStage1BrowserTestHooks.closeDurabilityDialog();__wordingQA.calculateSemiRetirementScenario();__wordingQA.saveCurrentPlanAsScenario();},investmentReturnFixture());
 assert.ok(await page.evaluate(()=>__wordingQA.getRetirement()?.years?.length>0));assert.ok(await page.evaluate(()=>__wordingQA.getSaved().length>0));
 await page.evaluate(()=>{FFSStage1BrowserTestHooks.showWorkspace('semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();});
 await page.locator('[data-semi-results-dashboard] [data-save-stage-g-scenario="retirement"]').click();
 await page.locator('#stageGScenarioName').fill('Fully Retire at 52 — user scenario name');
 await page.locator('[data-scenario-save-action="save"]').click();
 assert.ok(await page.evaluate(()=>__wordingQA.getSaved().some(s=>s.scenarioType==='retirement')));
 const snapshot=await page.evaluate(()=>JSON.stringify({plan:FFSStage1BrowserTestHooks.getPlan(),result:FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan()),retirement:__wordingQA.getRetirement(),saved:__wordingQA.getSaved()}));
 for(const [name,width] of [['desktop',1440],['mobile',375]]){
  await page.setViewportSize({width,height:1000});
  for(const [view,selector] of [['dashboard','[data-view-panel="dashboard"]'],['decision','#decisionList'],['retirement','[data-semi-results-dashboard]'],['scenarios','#scenarioList'],['assumptions','#wizardAssumptionsForm']]){
   await page.evaluate(view=>{if(view==='assumptions')FFSStage1BrowserTestHooks.setWizardStep(7);else FFSStage1BrowserTestHooks.showWorkspace(view==='retirement'?'semiretirement':view);FFSStage1BrowserTestHooks.closeDurabilityDialog();},view);
   let target=page.locator(selector);if(view==='assumptions')target=page.locator('.modelling-information:visible').first();
   if(view==='retirement'&&!(await target.isVisible())){await page.evaluate(()=>{FFSStage1BrowserTestHooks.showWorkspace('semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();});}
   await target.waitFor({state:'visible'});if(view==='assumptions')await target.locator('summary').click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view+' '+name);
   const text=await target.innerText();
   if(view==='decision'){assert.doesNotMatch(text,/Strongest opportunity|Priority score|Best option/);const labels=await target.locator('h3').allTextContents();assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b)));}
   if(view==='retirement'){assert.match(text,/Age Pension not included/);assert.match(text,/preservation and release/);}
   if(view==='scenarios')assert.match(text,/Key modelled outcome/);
   await target.screenshot({path:resolve(out,`${view}-${name}.png`),style:'header {visibility:hidden!important}'});
   checks.push({view,width,noHorizontalOverflow:true});
  }
 }
 const final=await page.evaluate(()=>JSON.stringify({plan:FFSStage1BrowserTestHooks.getPlan(),result:FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan()),retirement:__wordingQA.getRetirement(),saved:__wordingQA.getSaved()}));assert.equal(final,snapshot);assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'checks.json'),JSON.stringify({checks,errors,planResultsRetirementAndSavedDataUnchanged:true},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.close();}
