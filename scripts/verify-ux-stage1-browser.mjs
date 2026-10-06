import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {investmentReturnFixture} from './investment-return-fixture.mjs';
const {chromium}=await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const root=resolve('.'),out=resolve('docs/ux-stage1-evidence');mkdirSync(out,{recursive:true});
const baseline=new Map();
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.includes('/api/')) {res.setHeader('Content-Type','application/json');res.end('{"enabled":false}');return;}
  if(url.pathname.endsWith('/favicon.ico')){res.writeHead(204);res.end();return;}
  const before=url.pathname.startsWith('/before/');
  const name=(before?url.pathname.slice(8):url.pathname.slice(1))||'index.html';
  const file=resolve(root,name);
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try {
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[extname(file)]||'text/plain');
    if(before && !baseline.has(name)) baseline.set(name,execFileSync('git',['show','bd23b2a:'+name],{maxBuffer:8e6}));
    res.end(before?baseline.get(name):readFileSync(file));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'}),checks=[],errors=[];
const snapshot=page=>page.evaluate(()=>({plan:JSON.stringify(FFSStage1BrowserTestHooks.getPlan()),storage:JSON.stringify({...localStorage}),calculation:JSON.stringify(FFSCalculator.calculatePlan(FFSStage1BrowserTestHooks.getPlan())),scenario:JSON.stringify(FFSStage1BrowserTestHooks.quickScenarioProvenance())}));
async function prepare(before=false){
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true;
    const NativeDate=Date;window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:['2026-10-06T00:00:00Z']));}static now(){return NativeDate.parse('2026-10-06T00:00:00Z');}};
  });
  await page.goto(base+(before?'/before/':'/'));
  await page.waitForFunction(()=>window.FFSStage1BrowserTestHooks);
  await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p);FFSStage1BrowserTestHooks.closeDurabilityDialog();},investmentReturnFixture(false));
  await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});
  return page;
}
async function active(page,id){assert.equal(await page.locator(`[data-view-panel="${id}"]`).isVisible(),true,id);}
async function nav(page,id){
  if(['investments','super','goals','weeklyplan','reports','scenarios'].includes(id))await page.locator('#moreNavigation > summary').click();
  await page.locator(`#sideNav [data-view="${id}"]`).click();await active(page,id);
  assert.equal(await page.locator(`#sideNav [data-view="${id}"]`).getAttribute('aria-current'),'page');
}
try {
  const before=await prepare(true),page=await prepare();
  // Use the exact baseline-normalised plan, including identity, on both sides.
  const identified=await before.evaluate(()=>FFSStage1BrowserTestHooks.getPlan());
  await page.evaluate(p=>FFSStage1BrowserTestHooks.setPlan(p),identified);
  const baselineOutputs=await snapshot(before),afterOutputs=await snapshot(page);
  assert.equal(afterOutputs.calculation,baselineOutputs.calculation);
  assert.equal(afterOutputs.scenario,baselineOutputs.scenario);
  const beforeViews=await before.locator('[data-view-panel]').evaluateAll(es=>es.map(e=>e.dataset.viewPanel).sort());
  assert.deepEqual(await page.locator('[data-view-panel]').evaluateAll(es=>es.map(e=>e.dataset.viewPanel).sort()),beforeViews);
  checks.push('Every underlying view ID retained; full browser calculation and quick-scenario inputs exactly match baseline.');
  for(const width of [1440,375]){
    await before.setViewportSize({width,height:1050});
    await before.locator('#appWorkspace').scrollIntoViewIfNeeded();
    await before.screenshot({path:resolve(out,`before-${width}.png`),fullPage:true});
  }
  const saved=await snapshot(page);
  for(const width of [1440,375]){
    await page.setViewportSize({width,height:1050});
    await page.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('dashboard'));
    assert.deepEqual(await page.locator('#sideNav > button, #moreNavigation > summary').allTextContents(),['Dashboard','My Plan','Future','Retirement','More']);
    assert.equal(await page.locator('#sideNav button:visible').count(),4);
    const summary=page.locator('#moreNavigation > summary');
    await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#moreNavigation').getAttribute('open'),'');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Investments');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#moreNavigation').getAttribute('open'),null);
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'More');
    await summary.press('Space');assert.equal(await page.locator('#moreNavigation').getAttribute('open'),'');
    await summary.press('Space');assert.equal(await page.locator('#moreNavigation').getAttribute('open'),null);
    await page.locator('#sideNav > [data-view="decision"]').focus();await page.keyboard.press('Enter');await active(page,'decision');
    await summary.focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await active(page,'investments');
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'More');
    for(const id of ['setup','decision','semiretirement','investments','super','goals','weeklyplan','reports','scenarios','dashboard'])await nav(page,id);
    assert.equal(await page.locator('#moreNavigation').getAttribute('open'),null);
    assert.deepEqual(await snapshot(page),saved,'Navigation cannot mutate plan, storage, calculation or scenario inputs');
    assert.doesNotMatch(await page.locator('[data-view-panel="dashboard"]').innerText(),/AI coaching is unavailable/);
    assert.equal(await page.locator('#dashboardSimplified .dashboard-change-card').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} dashboard overflow`);
    for(const control of await page.locator('#sideNav > button, #moreNavigation > summary').all()){
      const box=await control.boundingBox();assert.ok(box.height>=44,`${width} navigation tap target`);
    }
    await page.locator('#appWorkspace').scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(out,`after-${width}.png`),fullPage:true});
    await page.locator('[data-view-panel="dashboard"]').screenshot({path:resolve(out,`dashboard-${width}.png`),style:"body > div > header { visibility: hidden !important; }"});
    await summary.click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} More overflow`);
    await page.locator('.workspace-nav').screenshot({path:resolve(out,`more-${width}.png`)});
    await summary.click();
    await page.locator('.dashboard-change-card button').click();await active(page,'decision');
    await nav(page,'dashboard');await page.locator('#dashboardSimplified .dashboard-future-card [data-engagement-action="decision"]').click();await active(page,'decision');
    await nav(page,'dashboard');await page.locator('.dashboard-retirement-card button').click();await active(page,'semiretirement');
    await nav(page,'dashboard');await page.locator('[data-dashboard-detail-open]').click();
    assert.equal(await page.locator('#dashboardDetails').getAttribute('open'),'');
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#dashboardDetails > summary')),true);
    await page.locator('#dashboardWeeklyMission [data-engagement-action="weeklyplan"]').first().click();await active(page,'weeklyplan');
    await nav(page,'dashboard');await page.locator('#dashboardDetails > summary').click();
    checks.push(`${width}px: five primary choices, every More route, disclosure Enter/Space/Escape/Tab, aria-current, 44px tap targets, no horizontal overflow, dashboard links and financial details work; no plan/storage/result changes.`);
  }
  // Future You is compared against the unchanged baseline at current and future ages.
  await page.setViewportSize({width:1440,height:1050});
  for(const age of [43,55,65]){
    for(const p of [before,page])await p.locator('#dashboardFutureAgeInput').evaluate((el,age)=>{el.value=age;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},age);
    assert.equal(await page.locator('#dashboardFutureYouResults').innerText(),await before.locator('#dashboardFutureYouResults').innerText());
  }
  assert.deepEqual(await snapshot(page),saved);
  checks.push('Future You renders identical outputs at ages 43, 55 and 65 without changing plan or storage.');
  // Existing setup and detail routes, including views that were never primary tabs.
  await nav(page,'setup');
  await page.locator('.wizard-exit-button').click();await active(page,'dashboard');
  await page.locator('[data-dashboard-detail-open]').click();
  await page.locator('#financialProgressDashboardCard [data-view="progress"]').first().click();await active(page,'progress');
  await nav(page,'setup');await page.evaluate(()=>FFSStage1BrowserTestHooks.setWizardStep(5));
  await page.locator('[data-view-panel="setup"] [data-view="super"]').click();await active(page,'super');
  await nav(page,'semiretirement');
  await page.locator('[data-semi-action="calculate"]').click();
  await nav(page,'dashboard');assert.match(await page.locator('#dashboardRetirementCard').innerText(),/Full retirement — scenario age/);
  checks.push('Setup exit, dedicated Super link, Financial Progress detail route and calculated retirement timing card work.');
  await nav(page,'decision');await page.locator('#customScenarioDetails > summary').click();
  assert.equal(await page.locator('#customScenarioDetails').getAttribute('open'),'');
  for(const p of [before,page]){
    await p.evaluate(()=>FFSStage1BrowserTestHooks.showWorkspace('decision'));
    await p.locator('[data-what-if]').first().click();
  }
  const actions=await page.locator('[data-what-if]').evaluateAll(es=>es.map(e=>e.dataset.whatIf));
  for(const id of actions){
    await page.locator('[data-what-if="'+id+'"]').click();await before.locator('[data-what-if="'+id+'"]').click();
    assert.equal(await page.locator('#whatIfResult').innerText(),await before.locator('#whatIfResult').innerText(),id);
  }
  for(const p of [before,page]){
    if(await p.locator('#customScenarioDetails').getAttribute('open')===null)await p.locator('#customScenarioDetails > summary').click();
    await p.locator('[data-comparison="incomeChange"]').fill('10000');
    await p.locator('[data-comparison="incomeChange"]').blur();
  }
  assert.equal(await page.locator('#comparisonSummary').innerText(),await before.locator('#comparisonSummary').innerText());
  checks.push('Detailed custom scenario remains accessible; all quick scenarios and custom scenario rendered outcomes exactly match baseline.');
  await nav(page,'reports');
  await page.locator('[data-view-panel="reports"] [data-view="progress"]').click();await active(page,'progress');
  await nav(page,'reports');assert.equal(await page.locator('#reportAssumptionsForm').isVisible(),true);
  await nav(page,'decision');
  await page.locator('[data-save-stage-g-scenario="decision-what-if"]').click();
  await page.locator('#stageGScenarioName').fill('Stage 1 browser scenario');
  await page.locator('[data-scenario-save-action="save"]').click();await active(page,'scenarios');
  await page.locator('[data-open-scenario]').first().click();await active(page,'decision');
  checks.push('Report progress link, report assumptions and saving/opening an existing Future scenario work.');
  const goalPlan=investmentReturnFixture(false);goalPlan.goalItems=[{id:'retirement-intent',goalType:'retirementIntent',name:'Retire or reduce work'}];
  await page.evaluate(p=>{FFSStage1BrowserTestHooks.setPlan(p,'setup');FFSStage1BrowserTestHooks.setWizardStep(6);},goalPlan);
  await page.locator('[data-view-panel="setup"] [data-view="semiretirement"]').click();await active(page,'semiretirement');
  checks.push('Existing retirement-intent goal link opens Retirement Planning from setup.');
  const home=await browser.newPage({viewport:{width:375,height:900}});
  home.on('pageerror',e=>errors.push(e.message));await home.goto(base+'/');
  await home.locator('#heroStartButton').waitFor();
  for(const id of ['heroStartButton','heroDemoButton','continuePlanButton','planExportJsonButton'])assert.equal(await home.locator('#'+id).count(),1);
  await home.locator('#heroDemoButton').click();await active(home,'dashboard');
  await home.locator('#heroStartButton').click();await active(home,'setup');
  for(const id of ['setup','dashboard','semiretirement','decision']){
    const legacyHome=await browser.newPage({viewport:{width:375,height:900}});
    await legacyHome.addInitScript(()=>window.FFS_ENGAGEMENT_JOURNEY_ENABLED=false);await legacyHome.goto(base+'/');
    await legacyHome.locator('[data-home-step="'+id+'"]').click();await active(legacyHome,id);
    await legacyHome.close();
  }
  assert.equal(await home.locator('[data-policy-page="privacy"]').count()>0,true);
  await home.locator('[data-policy-page="privacy"]').first().click();assert.equal(await home.locator('#policyDialog').isVisible(),true);
  checks.push('375px Start My Plan/Load Sample Plan and Privacy work; Continue/backup controls retained; all fallback home journey links work under the existing legacy-home flag.');
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));}
