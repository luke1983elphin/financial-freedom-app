import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {reportFixture} from './report-fixture.mjs';
const out=resolve(process.argv[2]||'test-results/reporting-scope'); mkdirSync(out,{recursive:true});
const baseline=process.argv.includes('--baseline');
const baselineRef=process.env.FFS_REPORT_BASE_REF||'a22a862f64a96df3e0d1416d2df72e1f18c1fff2';
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
// Local verification hooks only; production source is served unchanged otherwise.
const hook=`window.__reportQA={
 configure: fields=>{for(const [path,value] of Object.entries(fields)) window.FFSSemiRetirementUi.setDraftPath(semiRetirementScenarioDraft,path,value);calculateSemiRetirementScenario();},
 state:()=>({plan:calculatePlan(plan),draft:semiRetirementScenarioDraft,result:semiRetirementScenarioResult,inputs:semiRetirementScenarioInputs}),
 compare:()=>createSemiRetirementComparisonScenario(), wide:()=>tryFiveRetirementAlternatives(),
 format:layout=>{semiComparisonReportLayout=layout;renderOutputs();},
 detail:value=>{semiComparisonReportDetail=value;renderOutputs();},
 basis:value=>{document.querySelector('[data-dollar-basis='+value+']').click();},
 print:()=>printSemiRetirementComparisonPdf(),
 scenarios:()=>semiRetirementComparisonScenarioSet(window.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(semiRetirementScenarioResult,semiRetirementScenarioInputs,semiRetirementScenarioResultDraft)),
 saved:value=>addSavedRetirementScenarioToComparison(value), open:value=>loadRetirementScenarioSnapshot(value), seed:value=>saveScenarios([value]), stored:()=>loadScenarios()
};`;
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;
 if(p.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
 try {const file=p==='/'?'/index.html':p;let data=baseline&&['/app.js','/styles.css','/index.html'].includes(file)?execFileSync('git',['show',baselineRef+':'+file.slice(1)],{maxBuffer:5*1024*1024}):readFileSync(resolve('.'+file));if(p==='/app.js')data=data.toString().replace('  window.addEventListener("storage", (event) => {',hook+'\n  window.addEventListener("storage", (event) => {');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(p)]||'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'});const checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>{window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true;window.print=()=>{};window.confirm=()=>true;});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__reportQA);
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p,'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-semi-action="calculate"]').click();},reportFixture());
 await page.evaluate(()=>__reportQA.configure({'people.0.hasSemiRetirement':true,'people.0.semiRetirementAge':60,'people.0.fullRetirementAge':65,'people.1.hasSemiRetirement':true,'people.1.semiRetirementAge':58,'people.1.fullRetirementAge':65}));
 await page.evaluate(()=>__reportQA.compare());
 for(const [name,format,basis,wide] of [['two-future','wide','future',false],['two-today','portrait','today',false],['wide-future','wide','future',true],['wide-today','wide','today',false],['wide-full','wide','future',false],['portrait-six','portrait','future',false]]){
  if(wide)await page.evaluate(()=>__reportQA.wide());
  if(name==='wide-full')await page.evaluate(()=>__reportQA.detail('full'));
  if(name==='portrait-six')await page.evaluate(()=>__reportQA.detail('overview'));
  await page.evaluate(({format,basis})=>{__reportQA.format(format);__reportQA.basis(basis);__reportQA.print();},{format,basis});
  await page.emulateMedia({media:'print'});
  const geometry=await page.evaluate(()=>{let r=document.querySelector('.semi-retirement-comparison-print-report'),w=document.querySelector('#appWorkspace > div');return {width:r.getBoundingClientRect().width,workspaceWidth:w.getBoundingClientRect().width,grid:getComputedStyle(w).gridTemplateColumns,text:r.innerText};});
  await page.pdf({path:resolve(out,name+'.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
  const scenarios=await page.evaluate(()=>__reportQA.scenarios());
  writeFileSync(resolve(out,name+'-scenarios.json'),JSON.stringify(scenarios,null,2));
  for(const scenario of scenarios){
   const {summary,viewModel:view,inputs}=scenario,end=view.keyResults.projectionEnd,full=view.keyResults.accessibleWhenBothFullyRetired.row;
   const convert=(amount,year)=>amount==null?amount:basis==='today'?amount/Math.pow(1+(inputs.inflationRate||0),year-inputs.projectionStartYear):amount;
   assert.ok(Math.abs(summary.projectedEndNetWorth-convert(end.projectedNetWorth,end.calendarYear))<.01);
   if(full)assert.ok(Math.abs(summary.assetsAtRetirement-convert(full.household.totalInvestableAssets,full.calendarYear))<.01);
   if(!baseline){assert.equal(summary.allFundsExhaustionYear,view.longevity.allRetirementFundsExhausted?.calendarYear??null);assert.equal(summary.projectionEndAssets,convert(end.totalInvestableAssets,end.calendarYear));}
  }
  checks.push({name,...geometry});
  if(!baseline){assert.ok(geometry.width>=geometry.workspaceWidth-2,JSON.stringify(geometry));assert.match(geometry.text,/reduces work at 60/);}
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 }
 const state=await page.evaluate(()=>__reportQA.state());
 const snapshot={id:'reporting-fictional-saved',name:'Fictional later retirement',scenarioType:'retirement',scenarioInputSnapshot:structuredClone(state.draft),keyResultSnapshot:{historicalMarker:'Must remain unchanged'}};
 snapshot.scenarioInputSnapshot.people[0].fullRetirementAge=67;
 await page.evaluate(s=>{__reportQA.seed(s);__reportQA.open(s);},snapshot);
 const storedBefore=await page.evaluate(()=>JSON.stringify(__reportQA.stored()));
 for(const basis of ['future','today']){
  await page.evaluate(basis=>{__reportQA.basis(basis);FFSStage1BrowserTestHooks.showWorkspace('reports');},basis);
  const html=await page.locator('#financialReportBody').innerText();if(!baseline){assert.match(html,/Current Financial Plan Report/);assert.match(html,/separate output/);}
  assert.equal(await page.evaluate(()=>JSON.stringify(__reportQA.state().plan)),JSON.stringify(state.plan));
  await page.evaluate(()=>document.getElementById('reportPrintButton').click());await page.emulateMedia({media:'print'});
  await page.pdf({path:resolve(out,'current-plan-'+basis+'.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 }
 await page.evaluate(()=>{FFSStage1BrowserTestHooks.showWorkspace('semiretirement');__reportQA.compare();});
 const reopened=await page.evaluate(()=>__reportQA.scenarios());if(!baseline)assert.match(reopened[0].name,/Fictional later retirement.*baseline/);
 assert.equal(await page.evaluate(()=>JSON.stringify(__reportQA.stored())),storedBefore);
 // Compare saved inputs against the current retirement baseline, without updating history.
 await page.evaluate(s=>{document.querySelector('[data-semi-action="reset"]').click();__reportQA.saved(s);},snapshot);
 const saved=await page.evaluate(()=>__reportQA.scenarios());assert.ok(saved.some(s=>s.source==='saved'&&s.name===snapshot.name));
 assert.equal(await page.evaluate(()=>JSON.stringify(__reportQA.stored())),storedBefore);
 for(const width of [375,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('reports'));assert.ok(await page.locator('#financialReportBody').isVisible());
  await page.locator('[data-view="semiretirement"]:visible').first().click();assert.equal(await page.evaluate(()=>document.body.dataset.activeView),'semiretirement');
  await page.locator('[data-view="dashboard"]:visible').first().click();assert.equal(await page.evaluate(()=>document.body.dataset.activeView),'dashboard');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve(out,`navigation-after-print-${width}.png`)});
 }
 writeFileSync(resolve(out,'checks.json'),JSON.stringify(checks,null,2));console.log(checks.map(({name,width,workspaceWidth,grid})=>({name,width,workspaceWidth,grid})));
}finally{await browser.close();await new Promise(r=>server.close(r));}
