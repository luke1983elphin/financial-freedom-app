import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/working-surplus');mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const instrument=text=>text.replace('window.FFSStage1BrowserTestHooks = {','window.__surplusQA = { draft:()=>cloneScenarioDraft(semiRetirementScenarioDraft), loadSaved:loadRetirementScenarioSnapshot, backup:buildCompletePlanBackupPayload, importPlan:importPlanPayload }; window.FFSStage1BrowserTestHooks = {');
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}try{let data=readFileSync(f);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(f)]||'text/plain');if(u.pathname==='/app.js')data=instrument(data.toString());res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],checks=[];
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
if(process.env.FFS_PREVIEW_URL)await page.route('**/app.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:instrument(await response.text())});});
const url=process.env.FFS_PREVIEW_URL||'http://127.0.0.1:'+server.address().port;
const start=async()=>{await page.goto(url);await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);await page.evaluate(()=>FFSStage1BrowserTestHooks.closeDurabilityDialog());};
const open=()=>page.evaluate(()=>{FFSStage1BrowserTestHooks.showWorkspace('semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();});
const working=page.locator('[data-semi-input="scenario.workingPhaseSurplusDestination"]'),retirement=page.locator('[data-semi-input="scenario.surplusDestination"]');
const check=async(w,r='enjoyment')=>{assert.equal(await working.inputValue(),w);assert.equal(await retirement.inputValue(),r);const d=await page.evaluate(()=>__surplusQA.draft());assert.equal(d.scenario.workingPhaseSurplusDestination,w);assert.equal(d.scenario.surplusDestination,r);};
const reset=()=>page.locator('[data-semi-action="reset"]').click();
await start();await page.evaluate(()=>FFSStage1BrowserTestHooks.setPlan(null,'semiretirement'));await check('enjoyment');await working.selectOption('accessible-investments');await reset();await check('enjoyment');checks.push('new blank plan and Reset Scenario: enjoyment');
for(const value of ['accessible-investments','enjoyment','unallocated']){await start();await page.evaluate(value=>{const p=JSON.parse(JSON.stringify(FFS_DATA.samplePlans[0].plan));p.projectionSettings={workingPhaseSurplusDestination:value};FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');},value);await check(value);await page.evaluate(()=>{const backup=JSON.parse(JSON.stringify(__surplusQA.backup()));__surplusQA.importPlan(backup);});await open();await check(value);await working.selectOption(value==='enjoyment'?'accessible-investments':'enjoyment');await reset();await check(value);const saved=await page.evaluate(()=>__surplusQA.draft());saved.scenario.workingPhaseSurplusDestination=value;saved.scenario.surplusDestination='super';await page.evaluate(snapshot=>__surplusQA.loadSaved({id:'explicit-saved',scenarioInputSnapshot:snapshot}),JSON.parse(JSON.stringify(saved)));await check(value,'super');checks.push('explicit JSON plan/reset/saved scenario: '+value);}
await start();const samples=await page.evaluate(()=>FFS_DATA.samplePlans.map(s=>({id:s.id,name:s.name,value:s.plan.projectionSettings?.workingPhaseSurplusDestination??'enjoyment'})));
for(const sample of samples){await page.locator('#headerSamplePlanMenu > summary').click();await page.locator('#headerSamplePlanMenu [data-sample-plan-choice="'+sample.id+'"]').click();await open();await reset();await check(sample.value);checks.push(sample.name+': '+sample.value);}
assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.close();}
