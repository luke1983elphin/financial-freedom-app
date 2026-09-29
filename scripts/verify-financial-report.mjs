import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reportFixture} from './report-fixture.mjs';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/report');mkdirSync(out,{recursive:true});
const baseline=process.argv.includes('--baseline');
const splitReturns=process.argv.includes('--investment-split');
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
 if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(f)]||'text/plain');
 // Local QA only: capture the exact result passed to the report, after the app's normal adapter.
 const data=readFileSync(f);res.end(u.pathname==='/app.js'?data.toString().replace('function renderReports(result) {','function renderReports(result) { window.__reportResult = structuredClone(result);'):data);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[];
try {for(const simple of [false,true]){
 const name=simple?'simple':'populated',errors=[];const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>Boolean(window.FFSStage1BrowserTestHooks));
 const fixture=splitReturns?investmentReturnFixture(simple):reportFixture(simple);
 await page.evaluate(p=>FFSStage1BrowserTestHooks.setPlan(p,'reports'),fixture);await page.locator('#financialReportBody h1').waitFor();
 if(splitReturns){
   await page.evaluate(()=>FFSStage1BrowserTestHooks.setWizardStep(2));
   const editor=page.locator('#wizardAssetsForm [data-id="shares"][data-key="expectedIncomeYieldPct"]');
   await editor.fill('8');assert.equal(await editor.evaluate(e=>e.validity.valid),false);
   assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='shares').expectedIncomeYieldPct),3);
   await editor.fill('3');await editor.blur();
   await page.locator('#wizardAssetsForm [data-id="shares"][data-key="incomeTreatment"]').selectOption('cash');
   assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.id==='shares').incomeTreatment),'cash');
   await page.locator('#wizardAssetsForm').screenshot({path:resolve(out,name+'-investment-editor-desktop.png'),style:'header {visibility:hidden!important}'});
   await page.setViewportSize({width:375,height:900});
   await page.locator('#wizardAssetsForm').screenshot({path:resolve(out,name+'-investment-editor-mobile.png'),style:'header {visibility:hidden!important}'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.setViewportSize({width:1440,height:1000});
   const review=structuredClone(fixture);review.incomeItems=review.incomeItems.filter(i=>i.id!=='div');review.incomeItems.push({id:'review-dividend',type:'dividends',owner:'person1',amount:20000,frequency:'annually'});
   await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.setWizardStep(1);FFSStage1BrowserTestHooks.closeDurabilityDialog();},review);
   const income=page.locator('#wizardIncomeForm');assert.ok(await income.getByText('Check investment income',{exact:true}).isVisible());
   await income.locator('[data-id="review-dividend"][data-key="confirmedSeparateInvestmentIncome"]').check();
   assert.equal(await income.getByText('Check investment income',{exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().incomeItems.find(i=>i.id==='review-dividend').confirmedSeparateInvestmentIncome),true);
   await income.locator('[data-id="review-dividend"][data-key="linkedAssetId"]').selectOption('shares');
   assert.equal(await income.getByText('Check investment income',{exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().incomeItems.find(i=>i.id==='review-dividend').linkedAssetId),'shares');
   await page.evaluate(()=>{FFSStage1BrowserTestHooks.closeDurabilityDialog();FFSStage1BrowserTestHooks.openLinkedSetup('investment');});
   await page.locator('[data-linked-setup-field="name"]').fill('QA new portfolio');
   await page.locator('[data-linked-setup-field="value"]').fill('500000');await page.locator('[data-linked-setup-field="value"]').blur();
   await page.locator('[data-linked-setup-field="incomeTreatment"]').selectOption('cash');
   await page.locator('[data-linked-setup-field="expectedIncomeYieldPct"]').fill('3');await page.locator('[data-linked-setup-field="expectedIncomeYieldPct"]').blur();
   await page.locator('[data-linked-setup-field="name"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,name+'-guided-editor-desktop-top.png')});
   await page.locator('[data-linked-setup-field="expectedIncomeYieldPct"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,name+'-guided-editor-desktop-bottom.png')});
   await page.setViewportSize({width:375,height:900});
   await page.locator('[data-linked-setup-field="name"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,name+'-guided-editor-mobile-top.png')});
   await page.locator('[data-linked-setup-field="expectedIncomeYieldPct"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,name+'-guided-editor-mobile-bottom.png')});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.setViewportSize({width:1440,height:1000});
   await page.locator('#linkedSetupBody button[type="submit"]').click();
   assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().assetItems.find(a=>a.name==='QA new portfolio').expectedIncomeYieldPct),'3');
   // Editor autosaves create history snapshots. Start the export from a clean fixture,
   // keeping its pagination comparable to report-only QA.
   await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>Boolean(window.FFSStage1BrowserTestHooks));
   await page.evaluate(p=>FFSStage1BrowserTestHooks.setPlan(p,'reports'),fixture);
 }
 await page.screenshot({path:resolve(out,name+'-desktop.png'),fullPage:true});
 if(!baseline)await page.locator('.report-opening').screenshot({path:resolve(out,name+'-desktop-opening.png'),style:'header { visibility: hidden !important; }'});
 if(!baseline)await page.locator('.report-chart-page').first().screenshot({path:resolve(out,name+'-desktop-charts.png')});
 const financial=await page.evaluate(()=>window.__reportResult);writeFileSync(resolve(out,name+'-calculations.json'),JSON.stringify(financial,null,2));
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:resolve(out,name+'-mobile.png'),fullPage:true});
 if(!baseline)await page.locator('.report-opening').screenshot({path:resolve(out,name+'-mobile-opening.png'),style:'header { visibility: hidden !important; }'});
 if(!baseline)await page.locator('.report-chart-page').first().screenshot({path:resolve(out,name+'-mobile-charts.png')});
 const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));if(!baseline)assert.ok(mobile.scrollWidth<=mobile.width,JSON.stringify(mobile));
 await page.setViewportSize({width:794,height:1123});await page.evaluate(()=>document.body.dataset.printMode='financial-report');await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 const layout=await page.locator('#financialReportBody').evaluate(el=>({width:el.getBoundingClientRect().width,scrollWidth:el.scrollWidth,stages:[...el.querySelectorAll('.report-stage,.report-title-card')].map(e=>({title:e.querySelector('h1,h2')?.textContent,height:e.getBoundingClientRect().height})),protectedText:[...el.querySelectorAll('.report-metric,.report-review-action,.report-milestone-card,.report-disclaimer,.report-narrative-box,.report-chart-card')].map(e=>e.innerText),headings:[...el.querySelectorAll('.report-stage-heading')].map(e=>e.innerText)}));
 layout.headingPairs=await page.locator('#financialReportBody .report-stage').evaluateAll(sections=>sections.map(section=>({heading:section.querySelector('.report-stage-heading')?.innerText,first:section.querySelector('.report-metric,.report-narrative-box,.report-cash-row,.report-chart-card,.report-milestone-card,.report-review-action')?.innerText})).filter(pair=>pair.heading&&pair.first));
 await page.pdf({path:resolve(out,name+'.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
 if(!baseline){assert.deepEqual(errors,[]);assert.ok(layout.scrollWidth<=layout.width+1);}
 results.push({name,mobile,layout,errors});await page.close();
}writeFileSync(resolve(out,'browser-checks.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
