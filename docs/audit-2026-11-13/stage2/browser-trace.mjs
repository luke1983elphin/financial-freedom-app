// Headless tracing of real application routing/renderers. In-memory hooks only;
// served financial function bodies and all files on disk stay unchanged.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
const diagnostics=JSON.parse(await readFile(path.join(out,'diagnostics.json'),'utf8'));
const csp=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8')).headers[0].headers.find(x=>x.key==='Content-Security-Policy').value;
const hooks=`window.FFSStage2 = {
 result:()=>calculatePlan(plan),raw:()=>CALC.calculatePlan(legacyCalculationProjection(plan)),
 debt:y=>projectedDebtAtYear(calculatePlan(plan),y),
 report:()=>{const r=calculatePlan(plan);document.getElementById('financialReportBody').innerHTML=reportPresentationHtml(r,'Stage-two diagnostic');renderReportCharts(r);return document.getElementById('financialReportBody').innerText;},
 weekly:()=>window.FFSWeeklyPlan.createFromPlan(plan,calculatePlan(plan),{startDate:'2026-11-16',periodWeeks:52,startingBalance:0}),
 snapshot:()=>buildRetirementScenarioSaveContext(),
 open:s=>{loadRetirementScenarioSnapshot(s);return {inputs:semiRetirementScenarioInputs,result:semiRetirementScenarioResult};},
 draft:()=>window.FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(legacyCalculationProjection(plan),calculatePlan(plan)).draft,
 growth:()=>{const p=legacyCalculationProjection(plan),s=FFSGrowthScenarios.suggested(p);return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,FFSGrowthScenarios.calculate(p,v,calculatePlan)]));}
};
`;
const server=createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({enabled:false}));return;}
 const pathname=new URL(req.url,'http://localhost').pathname,relative=pathname==='/'?'index.html':pathname.slice(1);
 const file=path.resolve(root,relative);if(!file.startsWith(root))throw Error('path');
 let bytes=await readFile(file);
 if(relative==='app.js'){
  let source=bytes.toString();assert.ok(source.includes('window.FFSStage1BrowserTestHooks = {'));
  source=source.replace('window.FFSStage1BrowserTestHooks = {',hooks+'window.FFSStage1BrowserTestHooks = {');
  source=source.replace('  function lineChart(svgId, series, options = {}) {','  function lineChart(svgId, series, options = {}) { window.__stage2Charts ||= {}; window.__stage2Charts[svgId] = structuredClone(series);');
  bytes=Buffer.from(source);
 }
 res.setHeader('Content-Security-Policy',csp);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
}catch(e){res.statusCode=404;res.end('Not found');}});
let chrome,cdp,profile;
const wait=async(fn)=>{for(let i=0;i<300;i++){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,50));}throw Error('timeout');};
class CDP{constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.errors=[];}
 async start(){await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails.text);};}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
}
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 profile=await mkdtemp(path.join(tmpdir(),'ffa-stage2-'));
 chrome=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--disable-extensions','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 const portFile=path.join(profile,'DevToolsActivePort');const contents=await wait(async()=>existsSync(portFile)?readFile(portFile,'utf8'):null);
 const pages=await fetch(`http://127.0.0.1:${contents.split('\n')[0]}/json/list`).then(r=>r.json());cdp=new CDP(pages.find(x=>x.type==='page').webSocketDebuggerUrl);await cdp.start();
 await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true;window.print=()=>{};'});
 await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await wait(()=>cdp.eval('Boolean(window.FFSStage2 && window.FFSStage1BrowserTestHooks)'));
 const traces=[];
 const taxPlan=JSON.parse(await readFile(path.join(out,'../household-results.json'),'utf8')).results.find(x=>x.id==='H41').input;
 taxPlan.personal.person1Age=65;taxPlan.personal.fullRetirementAge=65;
 taxPlan.personal.retirementTiming={version:1,mode:'individual',people:[{id:'person1',alreadyRetired:true,hasSemiRetirement:false,semiRetirementAge:65,fullRetirementAge:65}]};
 for(const id of ['PROPERTY-legacy','PROPERTY-linked','PROPERTY-linked-otherProperty','TAX-linked']){
  const p=id==='TAX-linked'?taxPlan:diagnostics.diagnostics.find(x=>x.id===id).input;
  await cdp.eval(`FFSStage1BrowserTestHooks.setPlan(${JSON.stringify(p)},'reports');FFSStage1BrowserTestHooks.closeDurabilityDialog()`);
  const base=await cdp.eval(`(()=>{const r=FFSStage2.result(),raw=FFSStage2.raw(),w=FFSStage2.weekly();return {canonicalPlan:FFSStage1BrowserTestHooks.getPlan(),currentNetWorth:r.currentNetWorth,currentSignedCash:r.netIncomeAfterTaxHelp,year1NetWorth:r.netWorthProjection[0].closingBalance,rawYear1:raw.netWorthProjection[0].closingBalance,linked:Boolean(r.retirementProjection),year1ReportedDebt:FFSStage2.debt(1),year1Investments:r.investmentProjection[0].closingBalance,year1Super:r.superProjection[0].closingBalance,growth:Object.fromEntries(Object.entries(FFSStage2.growth()).map(([k,v])=>[k,{ok:v.ok,year1:v.rows?.[0]}])),weekly:w.weeks.slice(0,2),weeklyTotals:w.weeks.reduce((s,x)=>({income:s.income+x.planned.income,essential:s.essential+x.planned.essentialCosts}),{income:0,essential:0}),reportText:FFSStage2.report(),charts:window.__stage2Charts};})()`);
  const draft=await cdp.eval('FFSStage2.draft()');
  const opened=await cdp.eval(`FFSStage2.open({id:'stage2-saved',scenarioInputSnapshot:${JSON.stringify(draft)}})`);
  const context=await cdp.eval('FFSStage2.snapshot()');assert.ok(context?.scenarioInputSnapshot);
  await cdp.eval(`localStorage.setItem('stage2-review-saved',JSON.stringify(${JSON.stringify(context)}))`);
  const mutated=structuredClone(p);mutated.investing.expectedSuperReturnPct=9;mutated.investing.expectedInvestmentReturnPct=9;
  await cdp.eval(`FFSStage1BrowserTestHooks.setPlan(${JSON.stringify(mutated)},'reports');FFSStage1BrowserTestHooks.closeDurabilityDialog()`);
  const reopened=await cdp.eval(`FFSStage2.open({id:'stage2-saved',...JSON.parse(localStorage.getItem('stage2-review-saved'))})`);
  assert.deepEqual(reopened.inputs,opened.inputs,'Saved scenario must use its own input snapshot');
  assert.deepEqual(reopened.result,opened.result,'Saved scenario replay under unchanged engine');
  await cdp.eval(`FFSStage1BrowserTestHooks.setPlan(${JSON.stringify(p)},'reports');FFSStage1BrowserTestHooks.closeDurabilityDialog();document.querySelector('[data-dollar-basis="today"]').click()`);
  const today=await cdp.eval('({result:FFSStage2.result().netWorthProjection[0],report:FFSStage2.report(),charts:window.__stage2Charts})');
  assert.equal(today.result.closingBalance,base.year1NetWorth,'Display basis cannot change nominal result');
  await cdp.eval("document.getElementById('reportPrintButton').click()");
  const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});const pdfPath=path.join('/tmp',`ffa-stage2-${id}.pdf`);await writeFile(pdfPath,Buffer.from(pdf.data,'base64'));
  traces.push({case:id,base,today,retirement:{first:opened.result.years[0].household,draftAssets:draft.assets},saved:{inputsUnchanged:true,resultUnchanged:true,storedSnapshot:context},pdf:{localPath:pdfPath,bytes:Buffer.from(pdf.data,'base64').length}});
 }
 assert.equal(cdp.errors.length,0,JSON.stringify(cdp.errors));
 await writeFile(path.join(out,'browser-trace.json'),JSON.stringify({mode:'real Chromium; existing renderer code; read-only diagnostic hooks in served app.js; CSP enforced',traces,runtimeErrors:cdp.errors})+'\n');
 console.log(JSON.stringify(traces.map(t=>({case:t.case,netWorth:t.base.year1NetWorth,reportedDebt:t.base.year1ReportedDebt,linked:t.base.linked,retirementNetWorth:t.retirement.first.totalNetWorth,savedStable:t.saved.inputsUnchanged,pdfBytes:t.pdf.bytes})),null,2));
}finally{if(cdp)cdp.ws.close();if(chrome)chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));if(profile)await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
