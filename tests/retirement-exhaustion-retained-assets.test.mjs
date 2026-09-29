import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { engine, fixture } from '../scripts/retirement-exhaustion-fixture.mjs';
const ENGINE = engine();
function project(change = () => {}) {
  const input = fixture(); change(input);
  const result = ENGINE.projectRetirementScenario(input);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation));
  return result;
}
function exhausted(change = () => {}) {
  return project(input => { input.people[0].openingSuperBalance = 0; input.accessibleInvestments.openingBalance = 0; change(input); });
}
function debt(id, assetId, type='homeLoan') {
  return { id, linkedAssetId: assetId, name: 'Loan', type, openingBalance: 120000,
    annualInterestRate: 0, repaymentAmount: 0, remainingTermYears: 30, repaymentType: 'interestOnly' };
}
test('accessible investments exhaust before super with zero returns', () => {
  const r=project(i=>{i.accessibleInvestments.annualReturnRate=0;i.people[0].superReturnAfterRetirement=0;});
  assert.ok(r.summary.accessibleFundsExhaustedYear < r.summary.allRetirementFundsExhaustedYear);
});
test('consume eligible super and accessible returns before reporting residual unfunded spending', () => {
  const r=project(), y=r.years.find(r=>r.calendarYear===2068);
  assert.equal(y.household.totalSuperBalance,0);
  assert.equal(y.household.totalAccessibleAssets,0);
  assert.equal(y.household.totalSuperWithdrawal,52640.16);
  assert.equal(y.household.unmetSpending,17353.43);
});
test('no tiny residual or investment return survives after exhaustion', () => {
  const r=project();
  for (const y of r.years.filter(y=>y.calendarYear>2068)) {
    assert.equal(y.household.totalInvestableAssets,0);
    assert.equal(y.household.accessibleInvestmentEarnings,0);
    assert.equal(y.people[0].superInvestmentEarnings,0);
  }
});
test('exhaustion milestone reconciles with first unfunded spending', () => {
  const s=project().summary;
  assert.equal(s.allRetirementFundsExhaustedYear,s.firstUnfundedSpendingYear);
  assert.equal(s.allRetirementFundsExhaustedAge,85);
});
test('no exhaustion inside horizon uses end-year retained assets', () => {
  const s=project(i=>i.people[0].openingSuperBalance=1e7).summary;
  assert.equal(s.allRetirementFundsExhaustedYear,null);
  assert.equal(s.retainedAssets.reference,'projection-end');
  assert.equal(s.retainedAssets.calendarYear,2073);
});
test('cash income then accessible investments then super fund spending', () => {
  const y=project(i=>{i.household.otherAnnualIncome=20000;i.accessibleInvestments.annualReturnRate=0;}).years[0];
  assert.equal(y.household.totalAccessibleWithdrawal,10000);
  assert.equal(y.household.totalSuperWithdrawal,40000);
  assert.equal(y.household.unmetSpending,0);
});
test('year-end settlements preserve cents reconciliation for every account', () => {
  for (const y of project().years) {
    assert.equal(y.household.accessibleReconciliation.difference,0);
    for(const p of y.people) assert.equal(p.superReconciliation.difference,0);
    assert.equal(Math.round((y.household.totalPortfolioWithdrawal+y.household.unmetSpending)*100),7000000);
  }
});
test('ineligible super remains unavailable despite shortfall', () => {
  const y=project(i=>{i.people[0].currentAge=55;i.people[0].fullRetirementAge=55;i.projectionEndAge=56;i.accessibleInvestments.openingBalance=0;}).years[0];
  assert.equal(y.household.totalSuperWithdrawal,0);
  assert.ok(y.household.totalSuperBalance>0);
  assert.ok(y.household.unmetSpending>0);
});
test('practical exhaustion reports restricted super separately without withdrawing it', () => {
  const r=project(i=>{i.people[0].currentAge=55;i.people[0].fullRetirementAge=55;i.projectionEndAge=56;i.accessibleInvestments.openingBalance=0;});
  assert.equal(r.summary.allRetirementFundsExhaustedYear,2066);
  const a=r.summary.retainedAssets.assets.find(a=>a.type==='restrictedSuper');
  assert.equal(a.projectedValue,r.years[0].household.totalSuperBalance);
  assert.equal(a.status,'Not yet accessible');
});
test('explicit accessible reserve is respected by settlement', () => {
  const y=exhausted(i=>{i.accessibleInvestments.openingBalance=10000;i.scenario.minimumAccessibleBalance=10000;}).years[0];
  assert.equal(y.household.totalAccessibleAssets,10000);
});
test('explicit reserve does not postpone available-funding exhaustion', () => {
  const r=exhausted(i=>{i.accessibleInvestments.openingBalance=10000;i.scenario.minimumAccessibleBalance=10000;});
  assert.equal(r.summary.allRetirementFundsExhaustedYear,2066);
  assert.equal(r.summary.retainedAssets.assets.find(a=>a.type==='cashReserve').projectedValue,10000);
});
test('home owned outright',()=>{
  const a=exhausted().summary.retainedAssets.assets[0];
  assert.equal(a.status,'Owned outright'); assert.equal(a.netEquity,1030000);
});
test('home mortgage remaining uses stable link',()=>{
  const s=exhausted(i=>i.liabilities=[debt('loan','home')]).summary.retainedAssets;
  assert.equal(s.assets[0].status,'Still owned'); assert.equal(s.totalLinkedDebt,120000); assert.equal(s.totalNetEquity,910000);
});
test('rental property owned outright',()=>{
  const a=exhausted(i=>i.assets[0].type='rentalInvestmentProperty').summary.retainedAssets.assets[0];
  assert.equal(a.status,'Owned outright'); assert.equal(a.type,'rentalInvestmentProperty');
});
test('rental property linked loan',()=>{
  const a=exhausted(i=>{i.assets[0].type='rentalInvestmentProperty';i.liabilities=[debt('loan','home','rentalPropertyLoan')];}).summary.retainedAssets.assets[0];
  assert.equal(a.linkedDebt,120000); assert.equal(a.status,'Still owned');
});
test('multiple properties and non-liquid assets reconcile',()=>{
  const s=exhausted(i=>{i.assets.push({id:'rental',name:'Rental',type:'rentalInvestmentProperty',openingValue:920000},{id:'car',name:'Car',type:'vehicle',openingValue:25000});i.liabilities=[debt('loan','rental','rentalPropertyLoan')];}).summary.retainedAssets;
  assert.equal(s.assets.length,3); assert.equal(s.totalValue,1975000); assert.equal(s.totalNetEquity,1855000);
});
test('zero value and zero ownership excluded',()=>{
  const s=exhausted(i=>{i.assets[0].ownershipPercent=0;i.assets.push({id:'zero',type:'vehicle',openingValue:0});}).summary.retainedAssets;
  assert.equal(s.assets.length,0); assert.equal(s.totalValue,0);
});
test('no retained assets returns zero totals',()=>{
  const s=exhausted(i=>i.assets=[]).summary.retainedAssets;
  assert.equal(s.totalNetEquity,0); assert.equal(s.assets.length,0);
});
test('retained property cannot fund lifestyle spending',()=>{
  const a=exhausted(), b=exhausted(i=>i.assets=[]);
  assert.deepEqual(a.years.map(y=>[y.household.totalPortfolioWithdrawal,y.household.unmetSpending]),b.years.map(y=>[y.household.totalPortfolioWithdrawal,y.household.unmetSpending]));
});
test('legacy unlinked property debt never guesses from matching names',()=>{
  const s=exhausted(i=>{i.liabilities=[{...debt('loan',''),name:'Home'}];}).summary.retainedAssets;
  assert.equal(s.assets[0].linkedDebt,null); assert.equal(s.assets[0].netEquity,null);
  assert.equal(s.assets[0].status,'Linked debt unknown'); assert.equal(s.totalNetEquity,null);
});
test('stable rental-income links resolve debt without name matching',()=>{
  const s=exhausted(i=>{i.assets[0].type='rentalInvestmentProperty';i.liabilities=[{...debt('loan','','rentalPropertyLoan'),linkedRentalIncomeId:'rent'}];i.propertyIncome=[{id:'rent',linkedAssetId:'home',linkedLoanIds:['loan'],rentalCashIncome:0,taxableRentalIncome:0}];}).summary.retainedAssets;
  assert.equal(s.assets[0].linkedDebt,120000); assert.equal(s.debtUnknown,false);
});
test('accessible and super asset rows are not retained assets',()=>{
  const s=exhausted(i=>i.assets=[{id:'cash',type:'cash',isAccessibleAsset:true,openingValue:100},{id:'super',type:'super',openingValue:100}]).summary.retainedAssets;
  assert.equal(s.assets.length,0);
});
test('downsizing retains only replacement home without double-counting sale proceeds',()=>{
  const s=exhausted(i=>{i.scenario.downsizeHomeEvent={enabled:true,year:2066,currentHomeSaleValueToday:1000000,replacementHomeValueToday:300000,saleCostRate:0,purchaseCostRate:0,allocation:'accessible-investments'};}).summary.retainedAssets;
  assert.ok(s.totalValue < 1000000); assert.equal(s.assets.length,1);
});
test('home sold before reference year is replaced rather than counted twice',()=>{
  const s=exhausted(i=>{i.scenario.downsizeHomeEvent={enabled:true,year:2066,currentHomeSaleValueToday:1000000,replacementHomeValueToday:300000,saleCostRate:0,purchaseCostRate:0,allocation:'accessible-investments'};}).summary.retainedAssets;
  assert.ok(s.calendarYear>2066); assert.equal(s.assets.some(a=>a.name==='Home'),false);
  assert.equal(s.assets[0].name,'Replacement home');
});
test('mobile portfolio label uses total portfolio withdrawal',()=>{
  assert.match(readFileSync(new URL('../app.js',import.meta.url),'utf8'),/label: "Portfolio withdrawal", value: semiRetirementMoney\(household.totalPortfolioWithdrawal\)/);
});
test('results view model passes through the retained-assets reference',()=>{
  const context={console};context.globalThis=context;
  for(const name of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js']) vm.runInNewContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),context);
  const ui=context.FFSSemiRetirementUi;
  const fn=ui.buildSemiRetirementResultsViewModel || ui.buildResultsViewModel;
  assert.ok(fn, Object.keys(ui).join(','));
  const r=project(); const model=fn(r,fixture());
  assert.equal(model.retainedAssets?.calendarYear,2068);
});
