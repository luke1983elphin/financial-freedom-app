import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/future-samples');
mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const instrument=text=>text.replace('window.FFSStage1BrowserTestHooks = {',`window.__futureQA = {
 snapshot:()=>{const result=calculatePlan(plan);return {preview:futureYouPreview(result),result,plan:CALC.clonePlan(plan),ui:collectDraftUi(),selected:futureYouSelectedAge};},
 legacy:age=>{restoredDraftUi={...restoredDraftUi,dashboardFutureAgeInput:age,homeFutureAgeInput:age,futureYouAge:age,inputs:{dashboardFutureAgeInput:age},scenarioName:'Keep unrelated name'};engagementData().futureYouAge=age;restoreDraftUiInputs();},
 render:renderAll
 }; window.FFSStage1BrowserTestHooks = {`);
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}try{let data=readFileSync(f);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(f)]||'text/plain');if(u.pathname==='/app.js')data=instrument(data.toString());res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
 if(process.env.FFS_PREVIEW_URL)await page.route('**/app.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:instrument(await response.text())});});
 await page.goto(process.env.FFS_PREVIEW_URL||'http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);await page.evaluate(()=>FFSStage1BrowserTestHooks.closeDurabilityDialog());
 const samples=await page.evaluate(()=>FFS_DATA.samplePlans.map(s=>({id:s.id,name:s.name,age:Number(s.plan.personal.person1Age||s.plan.personal.person2Age)})));
 const load=async id=>{await page.locator('#headerSamplePlanMenu > summary').click();await page.locator('#headerSamplePlanMenu [data-sample-plan-choice="'+id+'"]').click();};
 const move=async age=>{await page.locator('#dashboardFutureAgeInput').fill(String(age));};
 const snapshot=()=>page.evaluate(()=>__futureQA.snapshot());
 const checkAge=async age=>{const s=await snapshot();assert.equal(s.preview.age,age);for(const v of await page.locator('[data-dashboard-future-age]').evaluateAll(es=>es.map(e=>Number(e.value))))assert.equal(v,age);for(const label of await page.locator('[data-dashboard-future-age-label]').allTextContents())assert.equal(label,'Age '+age);return s;};
 await load('established-family-wealth-building');await move(75);
 for(const [i,sample] of samples.entries()){
  await page.evaluate(age=>__futureQA.legacy(age),[59,62,75][i%3]);
  await load(sample.id);const s=await checkAge(sample.age);assert.equal(s.preview.year,0);assert.equal(s.selected,null);
  assert.equal(s.preview.netWorth,s.result.currentNetWorth);assert.equal(s.preview.investmentBalance,s.result.investmentBalance);assert.equal(s.preview.totalFiWealth,s.result.fiWealth.totalFiWealth);
  const rendered=await page.locator('#dashboardFutureYouResults').innerText();
  assert.ok(rendered.includes(new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(s.preview.totalFiWealth)));
  for(const legacy of [59,62,75]){await page.evaluate(age=>__futureQA.legacy(age),legacy);await page.evaluate(()=>__futureQA.render());await checkAge(sample.age);const ui=(await snapshot()).ui;assert.equal(ui.futureYouAge,undefined);assert.equal(ui.dashboardFutureAgeInput,undefined);assert.equal(ui.scenarioName,'Keep unrelated name');}
  const before=await snapshot();await move(sample.age+1);const next=await checkAge(sample.age+1);assert.equal(next.preview.year,1);assert.equal(next.preview.investmentBalance,next.result.investmentProjection[0].closingBalance);
  await move(sample.id==='young-professional'?55:sample.id==='young-couple'?50:sample.age+5);
  const selected=(await snapshot()).preview.age;
  await page.evaluate(()=>{FFSStage1BrowserTestHooks.showWorkspace('investments');FFSStage1BrowserTestHooks.showWorkspace('dashboard');});await checkAge(selected);
  const after=await snapshot();assert.deepEqual(after.plan,before.plan);assert.deepEqual(after.result,before.result);
  checks.push({name:sample.name,currentAge:sample.age,year:0,headingAndSlider:true,currentMetrics:true,legacyIgnored:[59,62,75],sameSessionAge:selected,financialParity:true});
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({url:process.env.FFS_PREVIEW_URL||'local',checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.close();}
