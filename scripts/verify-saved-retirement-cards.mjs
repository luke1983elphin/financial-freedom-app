import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||'.'),output=resolve(process.argv[3]||'outputs/saved-cards');mkdirSync(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
 if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>Boolean(window.FFSStage1BrowserTestHooks));
 await page.evaluate(()=>FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'semiretirement'));
 await page.locator('[data-semi-action="calculate"]').click();
 await page.locator('[data-save-stage-g-scenario="retirement"]').click();
 await page.locator('#stageGScenarioName').fill('Saved outcome assurance');
 await page.locator('[data-scenario-save-action="save"]').click();
 const card=page.locator('.scenario-library-card').filter({hasText:'Saved outcome assurance'}).first();await card.waitFor();
 const before=await card.locator('.saved-retirement-outcome').innerText();assert.match(before,/Retirement pathway/);assert.match(before,/Retirement funding assets/);assert.match(before,/Capital assets remaining/);
 await card.screenshot({path:resolve(output,'saved-card-desktop.png')});
 await page.evaluate(()=>{const p=FFSStage1BrowserTestHooks.getPlan();p.personal.fullRetirementAge=70;p.personal.person1FullRetirementAge=70;p.assets.cash=99999999;FFSStage1BrowserTestHooks.setPlan(p,'scenarios');});
 assert.equal(await card.locator('.saved-retirement-outcome').innerText(),before);
 const changed=await card.innerText();assert.match(changed,/What changed from your current plan/);assert.match(changed,/→/);
 await page.setViewportSize({width:375,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await card.screenshot({path:resolve(output,'saved-card-mobile-stale.png')});
 await card.locator('[data-duplicate-scenario]').click();
 assert.ok(await page.locator('.scenario-library-card').count()>=2);
 await page.reload();await page.waitForFunction(()=>Boolean(window.FFSStage1BrowserTestHooks));await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('scenarios'));
 assert.equal(await page.locator('.scenario-library-card').filter({hasText:'Saved outcome assurance'}).first().locator('.saved-retirement-outcome').innerText(),before);
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'browser-checks.json'),JSON.stringify({checks:['save through real dialog','grouped snapshot metrics','snapshot unchanged after live plan edits','current-plan arrows','375px no overflow','duplicate','reload persists snapshot'],errors},null,2));
 console.log('Saved scenario browser checks passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
