import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load,household} from '../scripts/fi-cashflow-fixture.mjs';
const {CALC}=load();
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function extract(name) {
  const start=source.indexOf('  function '+name+'(');
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf('\n  function ',start+5));
}
function session(plan=household(CALC)) {
  const ctx={plan,CALC,futureYouSelectedAge:null,calculatePlan:CALC.calculatePlan,
    safeWithdrawalRate:()=>.04,engagementProgress:()=>({financialFreedomRaw:0}),
    document:{querySelectorAll:()=>[]},updateSaveStatus:()=>{}};
  vm.runInNewContext(['projectionRowAtAge','projectionYearForAge','mortgageBalanceAtAge','futureYouPreview','updateDashboardFutureAge','dashboardFutureAgeBounds'].map(extract).join('\n'),ctx);
  ctx.preview=()=>ctx.futureYouPreview(CALC.calculatePlan(ctx.plan));
  return ctx;
}
test('new plan opens at the current household age',()=>{
  const p=CALC.emptyPlan();p.personal.person1Age=32;
  const c=session(p);assert.equal(c.preview().age,32);assert.equal(c.preview().year,0);
});
test('legacy persisted future age is ignored without changing saved data',()=>{
  const p=household(CALC);p.engagement={futureYouAge:75};
  const before=JSON.stringify(p),c=session(p);assert.equal(c.preview().age,43);assert.equal(JSON.stringify(p),before);
});
test('unequal-age couples retain the existing person-one projection axis',()=>{
  const p=household(CALC);p.personal.person1Age=43;p.personal.person2Age=32;
  const c=session(p),r=CALC.calculatePlan(p);assert.equal(c.preview().age,43);
  assert.equal(r.investmentProjection[0].age,44);
});
test('manual slider selection survives repeated same-plan renders and makes no durable write',()=>{
  const c=session(),before=JSON.stringify(c.plan);
  c.updateDashboardFutureAge(55,{commit:true});
  assert.equal(c.preview().age,55);assert.equal(c.preview().age,55);
  assert.equal(JSON.stringify(c.plan),before);
  assert.doesNotMatch(extract('updateDashboardFutureAge'),/saveDraft|persistDraft|engagementData/);
});
test('fresh app session resets to current age after manual exploration',()=>{
  const c=session();c.updateDashboardFutureAge(75,{commit:true});
  assert.equal(session(JSON.parse(JSON.stringify(c.plan))).preview().age,43);
});
test('loading samples and returning to personal plan reset a previous future selection',()=>{
  const c=session(),personal=c.plan,sample=household(CALC);
  sample.personal.person1Age=32;sample.engagement={futureYouAge:75};
  Object.assign(c,{selectedSamplePlan:()=>({id:'sample',plan:sample}),
    preservePersonalContextBeforeDemo:()=>{},DEMO_PLAN_ID:'demo',
    ensurePlanIdentity:p=>p,weeklyPlanUiState:{},seedSampleScenarios:()=>{},
    renderAll:()=>{},showWorkspace:()=>{},loadPlanContext:()=>({lastPersonalPlanId:'personal'}),
    normalisePlanId:id=>id,userState:{},DEFAULT_PERSONAL_PLAN_ID:'personal',
    loadDraft:()=>personal,loadWeeklyPlan:()=>null,restoredDraftUi:{}});
  vm.runInNewContext(extract('loadSamplePlan')+'\n'+extract('returnToPersonalPlan'),c);
  c.updateDashboardFutureAge(75);c.loadSamplePlan();assert.equal(c.preview().age,32);
  c.updateDashboardFutureAge(75);sample.personal.person1Age=48;
  c.loadSamplePlan();assert.equal(c.preview().age,48);
  c.updateDashboardFutureAge(75);c.returnToPersonalPlan();assert.equal(c.preview().age,43);
});
test('every plan-load boundary resets viewing state while ordinary edits do not',()=>{
  for(const name of ['loadSamplePlan','returnToPersonalPlan','startMyPlan','blankUserPlan','importPlanPayload'])
    assert.match(extract(name),/futureYouSelectedAge = null/,name);
  for(const name of ['resetPlan','clearSavedPlan','deleteAllFinancialFreedomData'])
    assert.match(extract(name),/blankUserPlan\(\)/,name);
  assert.doesNotMatch(extract('commitLinkedSetup'),/futureYouSelectedAge = null/);
  assert.doesNotMatch(source,/engagementData\(\)\.futureYouAge\s*=/);
});
test('current age uses canonical current position and next age uses first future row',()=>{
  const c=session(),r=CALC.calculatePlan(c.plan),a=c.preview();
  assert.equal(a.netWorth,r.currentNetWorth);assert.equal(a.investmentBalance,r.investmentBalance);
  assert.equal(a.superBalance,r.superannuationBalance);
  assert.equal(a.totalFiWealth,CALC.selectFiWealthAtAge(r,43).totalFiWealth);
  c.updateDashboardFutureAge(44);const b=c.preview();
  assert.equal(b.year,1);assert.equal(b.investmentBalance,r.investmentProjection[0].closingBalance);
  assert.equal(b.totalFiWealth,CALC.selectFiWealthAtAge(r,44).totalFiWealth);
});
test('viewing ages leaves all calculations and slider bounds unchanged',()=>{
  const c=session(),before=JSON.stringify(CALC.calculatePlan(c.plan));
  const bounds=JSON.stringify(c.dashboardFutureAgeBounds(CALC.calculatePlan(c.plan),c.preview()));
  for(const age of [44,55,75])c.updateDashboardFutureAge(age,{commit:true});
  assert.equal(JSON.stringify(CALC.calculatePlan(c.plan)),before);
  assert.equal(JSON.stringify(c.dashboardFutureAgeBounds(CALC.calculatePlan(c.plan),c.preview())),bounds);
});
