import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const root=resolve('.'),out=resolve('docs/household-ui-evidence');mkdirSync(out,{recursive:true});
const originals=new Map();
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.includes('/api/')){res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
 if(url.pathname.endsWith('/favicon.ico')){res.writeHead(204);res.end();return;}
 const before=url.pathname.startsWith('/before/');const name=(before?url.pathname.slice(8):url.pathname.slice(1))||'index.html';
 const file=resolve(root,name);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'text/plain');
 if(before&&!originals.has(name))originals.set(name,execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'show','2b9ecfd:'+name],{maxBuffer:8e6}));
 res.end(before?originals.get(name):readFileSync(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.FFS_PREVIEW_URL||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],checks=[];
async function prepare(before=false){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 await page.addInitScript(()=>{window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true;});
 await page.goto(base+(before?'/before/':'/'));await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);
 await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.closeDurabilityDialog();},investmentReturnFixture(false));return page;
}
try{
 const page=await prepare();
 if(!process.env.FFS_PREVIEW_URL){const before=await prepare(true);const plan=await before.evaluate(()=>FFSStage1BrowserTestHooks.getPlan());await page.evaluate(p=>FFSStage1BrowserTestHooks.setPlan(p),plan);
 const calc=p=>p.evaluate(()=>JSON.stringify(FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan())));assert.equal(await calc(page),await calc(before));checks.push('Complete calculation output identical to GitHub baseline for identical inputs');await before.close();}
 assert.equal(await page.locator('#moreNavigation').getAttribute('open'),'');
 await page.locator('#moreNavigation > summary').click();await page.reload();await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);assert.equal(await page.locator('#moreNavigation').getAttribute('open'),null);
 await page.evaluate(()=>{FFSStage1BrowserTestHooks.showWorkspace('setup');FFSStage1BrowserTestHooks.closeDurabilityDialog();});
 await page.locator('#moreNavigation > summary').click();checks.push('More tools defaults open and preserves user preference after reload');
 for(const width of [1440,1920,768,375,430]){
 await page.setViewportSize({width,height:1000});await page.evaluate(()=>FFSStage1BrowserTestHooks.setWizardStep(0));
 const input=page.locator('#wizardAboutForm [data-path="personal.person1Name"]');await input.fill('');await input.focus();await input.evaluate(el=>window.originalNameInput=el);
 await input.pressSequentially('Luke Alexander Smith');assert.equal(await input.inputValue(),'Luke Alexander Smith');assert.equal(await input.evaluate(el=>el===window.originalNameInput&&document.activeElement===el),true);
 await input.press('Backspace');assert.equal(await input.inputValue(),'Luke Alexander Smit');await input.press('ControlOrMeta+A');await page.keyboard.insertText('Luke Smith');assert.equal(await input.inputValue(),'Luke Smith');
 await page.locator('#wizardAboutForm [data-path="personal.person2Name"]').fill('Lisa Jones');
 assert.ok((await page.locator('#wizardIncomeForm').textContent()).includes('Luke Smith'));
 await input.fill('');assert.ok((await page.locator('#wizardIncomeForm').textContent()).includes('Person 1'));await input.fill('Luke Smith');
 await page.evaluate(()=>FFSStage1BrowserTestHooks.setWizardStep(7));
 assert.equal(await page.locator('#reviewAdvanced').getAttribute('open'),null);assert.equal(await page.locator('#wizardAssumptionsReview input:visible').count(),3);
 const rate=page.locator('#wizardAssumptionsReview [data-path="investing.expectedInvestmentReturnPct"]');await rate.fill('');await rate.pressSequentially('7.25');assert.equal(await rate.inputValue(),'7.25');assert.equal(await rate.evaluate(el=>el===document.activeElement),true);
 await page.locator('#reviewAdvanced > summary').click();assert.equal(await page.locator('#wizardHelpReview').isVisible(),true);assert.ok((await page.locator('#wizardHelpReview').textContent()).includes('Lisa Jones'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
 await page.screenshot({path:resolve(out,`review-expanded-${width}.png`),fullPage:true});
 await page.locator('#reviewAdvanced > summary').click();await page.screenshot({path:resolve(out,`review-${width}.png`),fullPage:true});
 checks.push(`${width}px: continuous typing, delete, paste, same input identity/focus, names/fallback, decimal assumptions, disclosure, no page overflow`);
 }
 await page.reload();await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);assert.equal(await page.evaluate(()=>FFSStage1BrowserTestHooks.getPlan().personal.person1Name),'Luke Smith');checks.push('Household name persisted after browser reload');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.close();}
