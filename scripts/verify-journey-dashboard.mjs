import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const root=resolve('.'),out=resolve('outputs/journey-dashboard');mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
 if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.FFS_PREVIEW_URL||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'}),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true);
 async function open(query,p){await page.goto(base+query);await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.closeDurabilityDialog();},p);await page.locator('[data-view-panel="dashboard"]').scrollIntoViewIfNeeded();}
 const fixture=investmentReturnFixture(false);
 await open('/',fixture);assert.equal(await page.locator('#journeyDashboard').count(),0);
 const before=await page.evaluate(()=>JSON.stringify(FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan())));
 const identifiedPlan=await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan());
 await page.locator('[data-view-panel="dashboard"]').screenshot({path:resolve(out,'existing-dashboard.png'),style:'body > div > header { visibility: hidden !important; }'});
 await open('/?dashboard=journey',identifiedPlan);await page.locator('.journey-dashboard').waitFor();
 assert.equal(await page.evaluate(()=>JSON.stringify(FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan()))),before);
 checks.push('Normal URL retains existing Dashboard; journey URL renders experiment; complete calculator result identical for same plan.');
 const planBefore=await page.evaluate(()=>JSON.stringify(FFSStage1BrowserTestHooks.getPlan()));
 const storageBefore=await page.evaluate(()=>JSON.stringify({...localStorage}));
 for(const view of ['investments','super','goals','decision','semiretirement','scenarios','reports','weeklyplan','setup','dashboard']){
  await page.evaluate(view=>FFSStage1BrowserTestHooks.showWorkspace(view),view);
  await page.locator(`[data-view-panel="${view}"]`).waitFor({state:'visible'});
 }
 assert.equal(await page.evaluate(()=>JSON.stringify(FFSStage1BrowserTestHooks.getPlan())),planBefore);
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storageBefore);
 checks.push('All existing navigation panels work; tab switching preserves plan and localStorage.');
 for(const [name,width,height] of [['desktop',1440,1100],['tablet',768,1100],['mobile',375,900]]){
  await page.setViewportSize({width,height});await page.locator('.journey-dashboard').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' page overflow');
  const clipped=await page.locator('.journey-heading, .journey-progress, .journey-path-scroll, .journey-metric, .journey-card, .journey-next').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(e=>e.className));
  assert.deepEqual(clipped,[],name+' clipped cards');
  for(const button of await page.locator('.journey-dashboard button').all()){const box=await button.boundingBox();assert.ok(box.height>=44,name+' touch target');}
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:0,behavior:'instant'});});
  await page.screenshot({path:resolve(out,`journey-${name}.png`),fullPage:true});
  checks.push(name+': no page overflow; controls >=44px.');
 }
 await page.setViewportSize({width:1440,height:1100});await page.locator('.journey-path-section').screenshot({path:resolve(out,'journey-close-up.png')});
 assert.doesNotMatch(await page.locator('.journey-path').innerText(),/Semi-retirement/);
 await page.locator('.journey-scenarios button').filter({hasText:'Work less'}).click();
 await page.locator('[data-view-panel="semiretirement"]').waitFor({state:'visible'});
 await page.locator('[data-semi-input="people.0.hasSemiRetirement"]').selectOption('true');
 await page.locator('[data-semi-input="people.0.semiRetirementAge"]').fill('55');
 await page.locator('[data-semi-input="people.0.semiRetirementAge"]').blur();
 await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('dashboard'));
 assert.match(await page.locator('.journey-path').innerText(),/Semi-retirement[\s\S]*Alex: age 55/);
 await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('semiretirement'));
 await page.locator('[data-semi-input="people.0.hasSemiRetirement"]').selectOption('false');
 await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('dashboard'));
 assert.doesNotMatch(await page.locator('.journey-path').innerText(),/Semi-retirement/);
 checks.push('Enabled semi-retirement milestone uses explicit scenario age; disabled milestone is hidden after tab switching.');
 for(const [name,p] of [['single',investmentReturnFixture(true)],['limited',{personal:{person1Age:43}}],['large',(()=>{const p=investmentReturnFixture(false);p.assetItems[0].value=123456789012;return p;})()]]){
  await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.closeDurabilityDialog();},p);
  await page.setViewportSize({width:375,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');
  assert.doesNotMatch(await page.locator('.journey-dashboard').innerText(),/NaN|undefined|Infinity/);
  if(name==='limited')assert.match(await page.locator('.journey-dashboard').innerText(),/Continue Setup/);
  checks.push(name+': renders safely without overflow.');
 }
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'verification.json'),JSON.stringify({base,checks,errors},null,2));console.log(JSON.stringify({base,checks,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
