// Focused F04 browser acceptance. Uses existing CSP and test-only closure access;
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
const hooks=`window.FFSF04 = {
 result:()=>calculatePlan(plan),
 snapshot:()=>financialPlanKeyResultSnapshot(calculatePlan(plan)),saved:()=>loadScenarios(),seed:s=>saveScenarios([s]),
 debt:y=>projectedDebtAtYear(calculatePlan(plan),y),
 growth:()=>Object.entries(FFSGrowthScenarios.suggested(plan)).map(([name,s])=>{s.includeOverrides=true;return {name,value:FFSGrowthScenarios.calculate(plan,s,calculatePlan).rows[0].netWorth};}),
 report:()=>{const r=calculatePlan(plan);document.getElementById('financialReportBody').innerHTML=reportPresentationHtml(r,'F04 acceptance');renderReportCharts(r);return document.getElementById('financialReportBody').innerText;}
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
 profile=await mkdtemp(path.join(tmpdir(),'ffa-f04-'));
 chrome=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--disable-extensions','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 const portFile=path.join(profile,'DevToolsActivePort');const contents=await wait(async()=>existsSync(portFile)?readFile(portFile,'utf8'):null);
 const pages=await fetch(`http://127.0.0.1:${contents.split('\n')[0]}/json/list`).then(r=>r.json());cdp=new CDP(pages.find(x=>x.type==='page').webSocketDebuggerUrl);await cdp.start();
 await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true;window.print=()=>{};'});
 await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await wait(()=>cdp.eval('Boolean(window.FFSF04 && window.FFSStage1BrowserTestHooks)'));
 const evidence=[];
 for(const route of ['legacy','linked-control','linked-F11']){
  const linked=route!=='legacy',knownF11=route==='linked-F11',expectedNetWorth=knownF11?868000:268000;
  const p=await cdp.eval(`(()=>{const p=FFSCalculator.emptyPlan();Object.assign(p.personal,{person1Name:'Landlord',person1Age:45,fullRetirementAge:65});
   Object.assign(p.investing,{annualInvestingTarget:0,expectedInvestmentReturnPct:0,expectedSuperReturnPct:0,inflationPct:2.5});
   p.assetItems=[{id:'rental',name:'Rental',category:${JSON.stringify(linked&&!knownF11?'otherProperty':'investmentProperty')},value:600000,propertyGrowthRatePct:3}];
   p.liabilityItems=[{id:'loan',name:'Rental loan',type:'rentalPropertyLoan',linkedAssetId:'rental',balance:350000,repayment:21000,repaymentFrequency:'annually',interestRatePct:6,termYears:30,repaymentType:'interestOnly'}];
   p.incomeItems=[{id:'rent',name:'Rent',type:'rentalNetCashIncome',owner:'person1',amount:30000,rentalCashIncomeAnnual:30000,taxableRentalIncomeAnnual:0,rentalCashflowTreatment:'beforeInterest',linkedAssetId:'rental',linkedLoanIds:['loan']}];
   if(${linked})p.personal.retirementTiming={version:1,mode:'individual',people:[{id:'person1',hasSemiRetirement:false,alreadyRetired:false,fullRetirementAge:65}]};return p;})()`);
  await cdp.eval(`FFSStage1BrowserTestHooks.setPlan(${JSON.stringify(p)},'reports');FFSStage1BrowserTestHooks.closeDurabilityDialog()`);
  await cdp.eval("document.querySelector('[data-dollar-basis=\"future\"]').click()");
  const r=await cdp.eval('FFSF04.result()');assert.equal(r.currentNetWorth,250000);assert.equal(r.netWorthProjection[0].closingBalance,expectedNetWorth);
  assert.equal(await cdp.eval('FFSF04.debt(0)'),350000);assert.equal(await cdp.eval('FFSF04.debt(1)'),350000);
  await cdp.eval('FFSF04.report()');
  const nominal=await cdp.eval('window.__stage2Charts.reportDebtChart[0].points');
  assert.equal(nominal.find(x=>x.x===1).y,350000);assert.equal(nominal.find(x=>x.x===10).y,350000);
  if(!linked){const growth=await cdp.eval('FFSF04.growth()');assert.deepEqual(growth.map(x=>x.value),[256000,268000,280000]);}
  await cdp.eval("document.querySelector('[data-dollar-basis=\"today\"]').click()");
  const text=await cdp.eval('FFSF04.report()');assert.ok(text.includes(knownF11?'846,829':'261,463'));assert.ok(!text.includes('overstate net worth and understate debt'));
  const charts=await cdp.eval('window.__stage2Charts');assert.ok(Math.abs(charts.reportDebtChart[0].points.find(x=>x.x===1).y-350000/1.025)<.01);
  assert.equal(await cdp.eval('FFSF04.result().netWorthProjection[0].closingBalance'),expectedNetWorth);
  await cdp.eval("FFSF04.seed({id:'historical',scenarioType:'financial-plan',keyResultSnapshot:{rows:[{label:'1-year net worth',rawValue:618000}]}})");
  const stored=await cdp.eval('JSON.stringify(FFSF04.saved())');const snapshot=await cdp.eval('FFSF04.snapshot()');assert.equal(snapshot.debtProjectionVersion,'2026.27.1-f04');assert.equal(await cdp.eval('JSON.stringify(FFSF04.saved())'),stored);
  await cdp.eval("document.body.dataset.printMode='financial-report'");const pdf=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
  const pdfPath=path.join('/tmp',`ffa-f04-${route}.pdf`);await writeFile(pdfPath,Buffer.from(pdf.data,'base64'));
  const pdfText=execFileSync('pdftotext',['-layout',pdfPath,'-'],{encoding:'utf8'});assert.ok(pdfText.includes(knownF11?'846,829':'261,463'));assert.ok(pdfText.includes('273,419'),'Ten-year IO debt is discounted once in the PDF');
  await cdp.eval('delete document.body.dataset.printMode');
  evidence.push({route,current:250000,yearOneNetWorth:expectedNetWorth,yearOneDebt:350000,todayNetWorth:expectedNetWorth/1.025,todayDebt:350000/1.025,pdfPath,pdfBytes:Buffer.from(pdf.data,'base64').length});
 }
 assert.equal(cdp.errors.length,0,JSON.stringify(cdp.errors));
 await writeFile(path.join(root,'docs/f04-property-debt/browser-evidence.json'),JSON.stringify({cases:evidence,runtimeErrors:cdp.errors},null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{if(cdp)cdp.ws.close();if(chrome)chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));if(profile)await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
