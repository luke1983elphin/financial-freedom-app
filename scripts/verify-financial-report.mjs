import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reportFixture} from './report-fixture.mjs';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'outputs/report');mkdirSync(out,{recursive:true});
const baseline=process.argv.includes('--baseline');
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
 await page.evaluate(p=>FFSStage1BrowserTestHooks.setPlan(p,'reports'),reportFixture(simple));await page.locator('#financialReportBody h1').waitFor();
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
