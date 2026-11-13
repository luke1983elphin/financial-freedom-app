// Focused F08 browser acceptance. Uses existing CSP and test-only closure access;
// financial functions are served unchanged from the working branch.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const csp=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8')).headers[0].headers.find(x=>x.key==='Content-Security-Policy').value;
const hooks=`window.FFSF08 = {
 result:()=>calculatePlan(plan),
 draft:()=>FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(legacyCalculationProjection(plan),calculatePlan(plan)).draft,
 open:s=>{loadRetirementScenarioSnapshot(s);return {inputs:semiRetirementScenarioInputs,result:semiRetirementScenarioResult,errors:semiRetirementScenarioErrors};},
 context:()=>buildRetirementScenarioSaveContext(),
 saved:()=>loadScenarios(),seed:s=>saveScenarios([s]),
 saveNew:()=>openScenarioSaveDialog(buildRetirementScenarioSaveContext()),
 report:()=>{const r=calculatePlan(plan);document.getElementById('financialReportBody').innerHTML=reportPresentationHtml(r,'F08 acceptance');renderReportCharts(r);return document.getElementById('financialReportBody').innerText;}
};`;
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
 await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await wait(()=>cdp.eval('Boolean(window.FFSF08 && window.FFSStage1BrowserTestHooks)'));
 const p=await cdp.eval(`(()=>{const p=FFSCalculator.emptyPlan();p.personal.person1Name='Retiree';p.personal.person1Age=65;p.personal.fullRetirementAge=65;
 p.personal.retirementTiming={version:1,mode:'individual',people:[{id:'person1',alreadyRetired:true,hasSemiRetirement:false,semiRetirementAge:65,fullRetirementAge:65}]};
 p.assetItems=[{id:'shares',name:'Reinvested shares',category:'shares',owner:'person1',value:2000000,investmentReturnMode:'totalReturn',expectedTotalReturnPct:7,expectedIncomeYieldPct:3,incomeTreatment:'reinvest'}];return p;})()`);
 await cdp.eval(`FFSStage1BrowserTestHooks.setPlan(${JSON.stringify(p)},'semiretirement');FFSStage1BrowserTestHooks.closeDurabilityDialog()`);
 const forecast=await cdp.eval('FFSF08.result()');
 const h=forecast.retirementProjection.years[0].household;
 assert.equal(h.netHouseholdCashIncome,-9620);assert.equal(h.totalAccessibleInvestmentWithdrawal,9620);
 assert.equal(h.closingAccessibleInvestmentBalance,2130043.30);
 const draft=await cdp.eval('FFSF08.draft()');draft.projectionEndAge=80;
 await cdp.eval(`FFSF08.open({id:'initial',scenarioInputSnapshot:${JSON.stringify(draft)}})`);
 const oldSnapshot=await cdp.eval('FFSF08.context().keyResultSnapshot');
 delete oldSnapshot.projectionEngineVersion;oldSnapshot.retirementOutcome.fundingAssetsAtRetirement=2140000;
 const scenario={id:'old-f08',name:'Original saved scenario',source:'user',scenarioType:'retirement',plan:p,scenarioInputSnapshot:draft,
  keyResultSnapshot:oldSnapshot,savedAt:'2026-11-12T00:00:00Z',updatedAt:'2026-11-12T00:00:00Z'};
 await cdp.eval(`FFSF08.seed(${JSON.stringify(scenario)})`);
 const oldStored=await cdp.eval('JSON.stringify(FFSF08.saved())');
 const opened=await cdp.eval('FFSF08.open(FFSF08.saved()[0])');
 assert.ok(opened.result,JSON.stringify(opened.errors));
 assert.equal(opened.result.years[0].household.closingAccessibleInvestmentBalance,2130043.30);
 assert.equal(await cdp.eval('JSON.stringify(FFSF08.saved())'),oldStored,'Opening does not overwrite old stored results or inputs');
 assert.ok(await cdp.eval("document.body.textContent.includes('Recalculated with corrected tax funding')"));
 const context=await cdp.eval('FFSF08.context()');assert.equal(context.keyResultSnapshot.projectionEngineVersion,'2026.27.4-f08');
 await cdp.eval("FFSF08.saveNew();document.getElementById('stageGScenarioName').value='Corrected tax funding';document.querySelector('[data-scenario-save-action=save]').click()");
 const saved=await cdp.eval('FFSF08.saved()');
 assert.equal(saved.length,2);assert.equal(saved.find(s=>s.id==='old-f08').keyResultSnapshot.retirementOutcome.fundingAssetsAtRetirement,2140000);
 const corrected=saved.find(s=>s.id!=='old-f08');assert.equal(corrected.keyResultSnapshot.projectionEngineVersion,'2026.27.4-f08');
 const reopened=await cdp.eval(`FFSF08.open(${JSON.stringify(corrected)})`);
 assert.deepEqual(reopened.inputs,opened.inputs);assert.deepEqual(reopened.result,opened.result);
 await cdp.eval("FFSStage1BrowserTestHooks.showWorkspace('reports');document.querySelector('[data-dollar-basis=\"today\"]').click()");
 const today=await cdp.eval('({result:FFSF08.result().retirementProjection.years[0].household.closingAccessibleInvestmentBalance,text:FFSF08.report()})');
 assert.equal(today.result,2130043.30);
 assert.ok(today.text.includes('2,078,091'),'Report discounts corrected year-one closing wealth once');
 await cdp.eval("document.body.dataset.printMode='financial-report'");
 const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
 const pdfPath=path.join('/tmp','ffa-f08-corrected-report.pdf');await writeFile(pdfPath,Buffer.from(pdf.data,'base64'));
 const pdfText=execFileSync('pdftotext',['-layout',pdfPath,'-'],{encoding:'utf8'});assert.ok(pdfText.includes('2,078,091'));
 await cdp.eval("delete document.body.dataset.printMode;document.querySelector('[data-dollar-basis=\"future\"]').click()");
 const insolvent=structuredClone(draft);insolvent.accessibleInvestments.openingBalance=0;delete insolvent.accessibleInvestments.components;
 insolvent.passiveIncome=[{id:'noncash',name:'Taxable noncash distribution',type:'dividends',owner:'person1',annualCashIncome:0,annualTaxableIncome:60000}];
 const noFunds=await cdp.eval(`FFSF08.open({id:'no-funds',scenarioInputSnapshot:${JSON.stringify(insolvent)}})`);
 assert.equal(noFunds.result.years[0].household.unmetSpending,9620);
 assert.ok(await cdp.eval("document.body.textContent.includes('Unfunded required cashflow')"));
 assert.ok(await cdp.eval("document.body.textContent.includes('Includes required taxes and other cash needs')"));
 assert.equal(cdp.errors.length,0,JSON.stringify(cdp.errors));
 const evidence={firstYear:{taxWithdrawal:h.totalAccessibleInvestmentWithdrawal,closing:h.closingAccessibleInvestmentBalance,todayClosing:2130043.30/1.025},
  savedInputsAndHistoricalResultsPreserved:true,newSnapshotVersion:context.keyResultSnapshot.projectionEngineVersion,reopenedResultMatches:true,
  unfundedTax:noFunds.result.years[0].household.unmetSpending,pdfPath,pdfBytes:Buffer.from(pdf.data,'base64').length,runtimeErrors:cdp.errors};
 await writeFile(path.join(root,'docs/f08-tax-funding/browser-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence,null,2));
}finally{if(cdp)cdp.ws.close();if(chrome)chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));if(profile)await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
