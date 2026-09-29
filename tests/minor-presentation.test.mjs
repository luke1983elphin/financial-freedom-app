import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load} from '../scripts/fi-cashflow-fixture.mjs';
import {investmentReturnFixture} from '../scripts/investment-return-fixture.mjs';
const {CALC}=load();
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const names=['investmentYieldDisplay','dynamicInput','linkedSetupInput','infoButtonHtml','summaryTile','agePensionExclusionHtml','renderAssumptions','renderSetupSummary','renderWizardResults','dashboardFutureMetricsHtml'];
const code=names.map(name=>{const a=source.indexOf('  function '+name+'(');assert.ok(a>=0,name);return source.slice(a,source.indexOf('\n  function ',a+5));}).join('\n');
const copyStart=source.indexOf('  const goalInfoCopy =');
const copyCode=source.slice(copyStart,source.indexOf('\n  };',copyStart)+5)+'\nthis.copy=goalInfoCopy;';
function setup(){
 const nodes={};const p=investmentReturnFixture(false),r=CALC.calculatePlan(p);
 const ctx={CALC,plan:p,linkedSetupDraft:{},console,escapeHtml:s=>String(s??''),money:n=>`$${n}`,plainPercent:n=>`${n}%`,percentFromRatio:n=>`${n*100}%`,
  optionList:()=>'',personalisedResultsReadiness:()=>({readyForPersonalisedResults:true}),freedomPercent:()=>50,
  financialStageInfo:()=>({stage:{name:'Building',explanation:'Test'},nextStage:{name:'Next'},progressToNext:50}),
  netWorthAtYear:()=>0,annualPassiveIncome:r=>r.annualPassiveIncome,lifestyleTarget:r=>r.targetAnnualLifestyleSpendingToday,nextMilestone:()=>null,metricCard:(label,value)=>`${label}:${value}`,
  document:{getElementById:id=>nodes[id]??=( {innerHTML:'',classList:{toggle(){}}})}};
 vm.runInNewContext(copyCode+'\n'+code,ctx);return {ctx,nodes,p,r};
}
for(const category of ['shares','etf','managedFund'])test(`${category}: precise migrated yield is display-only in both editors`,()=>{
 const {ctx}=setup(),asset={id:'a',category,expectedIncomeYieldPct:8.928571428571429};ctx.linkedSetupDraft=asset;
 assert.match(ctx.dynamicInput('assetItems',asset,'expectedIncomeYieldPct','Yield'),/value="8.93"/);
 assert.match(ctx.linkedSetupInput('expectedIncomeYieldPct','Yield'),/value="8.93"/);
 assert.equal(asset.expectedIncomeYieldPct,8.928571428571429);
});
test('yield formatting keeps zero, blanks and sensible edited values',()=>{
 const {ctx}=setup();for(const [a,b] of [[0,'0'],['',''],[null,''],[3.125,'3.13'],[3.1,'3.1'],[9,'9']])assert.equal(ctx.investmentYieldDisplay(a),b);
});
test('derived yield display preserves the original dollar income and stored precision',()=>{
 const {ctx,p}=setup(),a=p.assetItems.find(a=>a.id==='shares');a.value=56000;a.expectedTotalReturnPct=10;
 p.incomeItems=p.incomeItems.filter(i=>i.type!=='dividends');p.incomeItems.push({id:'linked',type:'dividends',linkedAssetId:a.id,amount:5000,frequency:'annually'});
 a.expectedIncomeYieldPct=CALC.linkedInvestmentIncomeYield(p,a);const before=CALC.calculatePlan(p);
 assert.equal(ctx.investmentYieldDisplay(a.expectedIncomeYieldPct),'8.93');assert.equal(CALC.investmentReturnAmounts(a).cashIncome,5000);
 assert.deepEqual(CALC.calculatePlan(JSON.parse(JSON.stringify(p))),before);
});
test('Future You accessible FI help explains each person reaching super access age',()=>{
 const {ctx}=setup();assert.match(ctx.copy.futureAccessibleFiAssets.body,/increase significantly/);assert.match(ctx.copy.futureAccessibleFiAssets.body,/each person's super becomes accessible separately/i);
 assert.match(ctx.dashboardFutureMetricsHtml({}),/data-info-key="futureAccessibleFiAssets"/);
});
test('Remaining Required explanation matches the zero-floored accessible-assets gap',()=>{
 const {ctx}=setup();assert.match(ctx.copy.remainingRequired.body,/target less current accessible FI assets/);assert.match(ctx.copy.remainingRequired.body,/minimum of zero/);
 assert.match(source,/metricCard\("Remaining Required"[^\n]+"remainingRequired"/);
});
test('MLS assumption renders authoritative rates and financial year in both locations',()=>{
 const {ctx,nodes,r}=setup();const rates=CALC.resolveFinancialYearConfig(r.taxEstimate.taxYear).config.medicareLevySurcharge.rates;
 ctx.renderAssumptions(r);for(const rate of rates)assert.ok(nodes.assumptionsList.innerHTML.includes(`${rate*100}%`));
 assert.match(nodes.assumptionsList.innerHTML,/2026-27/);assert.match(nodes.wizardMlsAssumption.innerHTML,/medicareLevySurchargeAssumption/);
 assert.match(ctx.copy.medicareLevySurchargeAssumption.body,/Taxable income alone does not determine/);
});
test('MLS presentation reads supplied year rules rather than independent rate constants',()=>{
 const {ctx,nodes,r}=setup();ctx.CALC={...CALC,resolveFinancialYearConfig:()=>({appliedFinancialYear:'test-year',config:{medicareLevySurcharge:{rates:[0,.009,.011,.014]}}})};
 ctx.renderAssumptions(r);assert.match(nodes.wizardMlsAssumption.innerHTML,/0%, 0.9%, 1.1%, 1.4%/);assert.match(nodes.wizardMlsAssumption.innerHTML,/test-year/);
});
test('target investing label and help remain distinct from affordable investment cashflow',()=>{
 const {ctx,nodes,r}=setup();ctx.renderSetupSummary(r);assert.match(nodes.setupSummary.innerHTML,/Your target annual investing/);assert.match(nodes.setupSummary.innerHTML,/Affordable cashflow used to invest/);assert.match(nodes.setupSummary.innerHTML,/data-info-key="targetAnnualInvesting"/);assert.match(ctx.copy.targetAnnualInvesting.body,/may reduce the actual amount invested/);
 assert.doesNotMatch(nodes.setupSummary.innerHTML,/Configured annual investing/);
});
test('Live Summary super availability label is derived from the model result',()=>{
 const {ctx,nodes,r}=setup();ctx.renderSetupSummary(r);assert.ok(nodes.setupSummary.innerHTML.includes(`Super available from age ${r.superAccessAge}`));
 ctx.renderSetupSummary({...r,superAccessAge:65});assert.match(nodes.setupSummary.innerHTML,/Super available from age 65/);assert.match(ctx.copy.superAvailability.body,/different years/);
});
test('Age Pension exclusion and help appear in Live Summary including preliminary plans',()=>{
 const {ctx,nodes,r}=setup();ctx.renderSetupSummary(r);assert.match(nodes.setupSummary.innerHTML,/Age Pension is not included in these projections/);assert.match(nodes.setupSummary.innerHTML,/data-info-key="agePensionExclusion"/);
 ctx.personalisedResultsReadiness=()=>({readyForPersonalisedResults:false});ctx.renderSetupSummary(r);assert.match(nodes.setupSummary.innerHTML,/Age Pension is not included/);
});
test('Final Results displays the Age Pension exclusion with neutral eligibility help',()=>{
 const {ctx,nodes,r}=setup();ctx.renderWizardResults(r);assert.match(nodes.wizardResultsSummary.innerHTML,/Age Pension is not included in these projections/);assert.match(ctx.copy.agePensionExclusion.body,/age, residency, income, assets and household circumstances/);
});
test('rendering all explanations leaves complete financial results unchanged and adds no pension value',()=>{
 const {ctx,p,r}=setup(),before=JSON.stringify(r),planBefore=JSON.stringify(p);
 ctx.renderSetupSummary(r);ctx.renderWizardResults(r);ctx.renderAssumptions(r);ctx.dashboardFutureMetricsHtml(r);
 assert.equal(JSON.stringify(r),before);assert.equal(JSON.stringify(p),planBefore);assert.deepEqual(CALC.calculatePlan(p),r);
});
