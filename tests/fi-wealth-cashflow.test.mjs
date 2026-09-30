import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load,household,loan} from '../scripts/fi-cashflow-fixture.mjs';
const {CALC,ENGINE,UI}=load();
const round=x=>Math.round(x*100)/100;
function result(change=()=>{}) {const p=household(CALC);change(p);return CALC.calculatePlan(p);}
for(const category of ['shares','etf','crypto','cash','offset','managedFund']) test('FI composition includes '+category,()=>{
  const p=CALC.emptyPlan();p.personal.person1Age=43;p.assetItems=[{id:'a',category,value:100000}];
  assert.equal(CALC.calculateNetFiAssetSummary({plan:p,currentAge:43}).accessibleFiAssets,100000);
});
test('shares ETFs and crypto counted once',()=>{assert.equal(result(p=>p.assetItems=[{id:'s',category:'shares',value:100},{id:'e',category:'etf',value:200},{id:'c',category:'crypto',value:300}]).accessibleFiAssets,600);});
test('current and next ages contain same wealth categories and genuine debt movements',()=>{
  const r=result(), a=CALC.selectFiWealthAtAge(r,43), b=CALC.selectFiWealthAtAge(r,44);
  assert.equal(a.accessibleFiAssets,340000);assert.equal(a.investmentPropertyEquity,350000);assert.equal(a.totalFiWealth,690000);
  // Existing monthly accumulation rounds the annual contribution into cents each month.
  assert.ok(Math.abs(b.accessibleFiAssets-a.accessibleFiAssets-r.actualAffordableInvestmentContribution)<=0.06);
  assert.equal(b.investmentPropertyEquity,368000);assert.equal(b.totalFiWealth,b.accessibleFiAssets+b.investmentPropertyEquity);
});
test('home equity remains separate and offset is not subtracted from principal twice',()=>{
  const r=result();assert.equal(r.fiWealth.principalResidenceEquity,400000);assert.equal(r.fiWealth.offsetFiAssets,190000);
  assert.equal(r.financialIndependenceAssets,340000);assert.equal(r.totalFiWealth,690000);
});
test('unrelated household loan does not reduce property equity',()=>{
  const r=result(p=>p.liabilityItems.push(loan('personal','personalLoan','',50000,5000)));
  assert.equal(r.investmentPropertyEquity,350000);
});
test('stable investmentLoan property link moves debt to property rather than liquid assets',()=>{
  const r=result(p=>p.liabilityItems[1].type='investmentLoan');
  assert.equal(r.investmentPropertyEquity,350000);assert.equal(r.accessibleFiAssets,340000);assert.equal(r.annualLoanRepayments,48000);
});
test('multiple properties with no automatic sale or drawdown',()=>{
  const r=result(p=>p.assetItems.push({id:'r2',category:'investmentProperty',value:200000,annualGrowthRatePct:0}));
  assert.equal(r.fiWealth.investmentPropertyEquity,550000);assert.equal(r.fiWealth.accessibleFiAssets,340000);
});
for(const age of [59,60,61]) test('super access composition at age '+age,()=>{
  const p=household(CALC);p.personal.person1Age=age;p.assets.superPerson1=100000;
  const s=CALC.calculateNetFiAssetSummary({plan:p,currentAge:age});
  assert.equal(s.accessibleSuper,age<60?0:100000);assert.equal(s.inaccessibleSuper,age<60?100000:0);
  assert.equal(s.accessibleFiAssets,340000+(age<60?0:100000));
});
test('Financial Freedom progress excludes unsold property',()=>{
  const a=result(),b=result(p=>p.assetItems.find(a=>a.id==='rental').value=9000000);
  assert.equal(a.financialFreedomProgressRaw,b.financialFreedomProgressRaw);assert.ok(b.totalFiWealth>a.totalFiWealth);
});
test('zero or inactive canonical assets do not resurrect legacy balances',()=>{
  const p=household(CALC);p.assets.sharesEtfs=100000;p.assetItems=[{id:'s',category:'shares',value:0}];
  assert.equal(CALC.calculateNetFiAssetSummary({plan:p,currentAge:43}).sharesEtfsFiAssets,0);
  p.assetItems[0].value=100000;p.assetItems[0].active=false;
  assert.equal(CALC.calculateNetFiAssetSummary({plan:p,currentAge:43}).sharesEtfsFiAssets,0);
});
test('home-only 30000 payments',()=>{assert.equal(result(p=>{p.incomeItems=p.incomeItems.slice(0,1);p.liabilityItems=p.liabilityItems.slice(0,1);}).annualLoanRepayments,30000);});
test('home plus rental 48000 payments exactly once',()=>{
  const r=result();assert.equal(r.annualLoanRepayments,48000);assert.equal(r.annualDebtRepayments,48000);
  assert.equal(r.householdCashflow.annualSurplus,round(r.netIncomeAfterTaxHelp-40000-48000));
});
test('investment-property-only 18000 payments',()=>{assert.equal(result(p=>p.liabilityItems=p.liabilityItems.slice(1)).annualLoanRepayments,18000);});
test('two rental loans each included once',()=>{
  const r=result(p=>{p.assetItems.push({id:'r2',category:'rentalInvestmentProperty',value:200000});p.liabilityItems.push(loan('l2','rentalPropertyLoan','r2',100000,10000));p.incomeItems.push({...p.incomeItems[1],id:'rent2',linkedAssetId:'r2',linkedLoanIds:['l2']});});
  assert.equal(r.annualLoanRepayments,57999.96);assert.equal(r.householdCashflow.rentalCashIncome,40000);
});
for(const type of ['personalLoan','vehicleLoan','investmentLoan','otherDebt']) test('standalone '+type+' payments included',()=>{
  const r=result(p=>p.liabilityItems.push(loan('extra',type,'',100000,6000)));assert.equal(r.annualLoanRepayments,54000);
});
test('duplicate canonical loan and income links cannot double count repayment',()=>{
  const r=result(p=>{p.liabilityItems.push({...p.liabilityItems[1]});p.incomeItems.push({...p.incomeItems[1],id:'rent2',rentalCashIncomeAnnual:0,amount:0});});
  assert.equal(r.annualLoanRepayments,48000);
});
test('after-interest rental cash deducts principal only',()=>{
  const r=result(p=>{Object.assign(p.liabilityItems[1],{interestRatePct:6,repaymentType:'interestOnly',repayment:15000});Object.assign(p.incomeItems[1],{rentalCashflowTreatment:'afterInterest',rentalCashIncomeAnnual:5000});});
  assert.equal(r.annualLoanRepayments,45000);assert.equal(r.annualDebtRepayments,30000);
  assert.equal(r.annualGrossIncome,105000);assert.equal(r.rentalPropertyCashflow.annualLoanPrincipal,0);
});
test('principal and interest separate; taxable rental amount does not become cash',()=>{
  const r=result(p=>p.liabilityItems[1].interestRatePct=6), property=r.rentalPropertyCashflow.propertyResults[0];
  assert.equal(round(property.annualLoanInterest+property.annualLoanPrincipal),18000);
  assert.equal(r.householdCashflow.rentalCashIncome,20000);assert.equal(r.householdCashflow.taxableRentalIncome,5000);
  assert.equal(r.annualGrossIncome,120000);assert.equal(r.incomeBreakdown.person1Taxable,105000);
});
test('rental without a loan has no phantom debt',()=>{const r=result(p=>p.liabilityItems=[]);assert.equal(r.annualLoanRepayments,0);assert.equal(r.householdCashflow.rentalCashIncome,20000);});
test('inactive loans income and expenses excluded',()=>{
  const r=result(p=>{p.liabilityItems.forEach(x=>x.active=false);p.incomeItems[1].deleted=true;p.expenseItems[0].status='inactive';});
  assert.equal(r.annualLoanRepayments,0);assert.equal(r.annualGrossIncome,100000);assert.equal(r.annualLivingExpenses,0);
});
test('unlinked rental loan still reduces household cashflow',()=>{
  const r=result(p=>{p.liabilityItems[1].linkedAssetId='';p.incomeItems=p.incomeItems.slice(0,1);});
  assert.equal(r.annualLoanRepayments,48000);assert.equal(r.annualDebtRepayments,48000);
});
for(const [frequency,expected] of [['weekly',5200],['fortnightly',2600],['monthly',1200],['quarterly',400],['annually',100]]) test('living expenses '+frequency,()=>{
  assert.equal(result(p=>p.expenseItems=[{id:'cost',category:'living',amount:100,frequency}]).annualLivingExpenses,expected);
});
test('negative surplus cannot fund configured investments',()=>{
  const r=result(p=>p.expenseItems[0].amount=200000);assert.equal(r.configuredInvestmentContribution,12000);
  assert.equal(r.actualAffordableInvestmentContribution,0);assert.equal(r.investmentProjection[0].closingBalance,r.investmentBalance);
});
test('affordable investing is capped and reconciles remaining cash',()=>{
  const r=result(p=>{p.expenseItems[0].amount=10000;p.investing.annualInvestingTarget=100000;});
  assert.equal(r.actualAffordableInvestmentContribution,r.cashSurplusBeforeInvesting);
  assert.equal(r.finalProjectedCashSurplus,0);
});
test('person ownership allocation does not halve household debt payments',()=>{
  const r=result(p=>{p.incomeItems[1].owner='joint';p.incomeItems[1].person1AllocationPercentage=25;p.incomeItems[1].person2AllocationPercentage=75;});
  assert.equal(r.incomeBreakdown.person1TaxableOther,1250);assert.equal(r.incomeBreakdown.person2TaxableOther,3750);assert.equal(r.annualLoanRepayments,48000);
});
test('current-year detailed projection reconciles cash income expenses debt and surplus',()=>{
  const p=household(CALC),r=CALC.calculatePlan(p),draft=UI.buildSemiRetirementScenarioDefaults(p,r).draft;
  draft.projectionStartYear=2026;draft.projectionEndAge=90;
  const out=UI.runSemiRetirementProjection(ENGINE,draft);assert.equal(out.validation.isValid,true,JSON.stringify(out.validation));
  const h=out.result.years[0].household;
  assert.equal(h.netHouseholdCashIncome,r.netIncomeAfterTaxHelp-r.rentalPropertyCashflow.annualHouseholdDebtDeduction);
  assert.equal(h.totalDebtRepayments,r.annualLoanRepayments);
  assert.equal(h.totalProjectedLifestyleSpending,r.annualLivingExpenses);
  assert.equal(h.cashSurplusOrShortfall,r.cashSurplusBeforeInvesting);
});
test('Future You uses the same selector at current next and zero-balance ages',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const names=['projectionRowAtAge','projectionYearForAge','mortgageBalanceAtAge','futureYouPreview'];
  const funcs=names.map(name=>{const start=source.indexOf('  function '+name+'(');return source.slice(start,source.indexOf('\n  function ',start+5));}).join('\n');
  const p=household(CALC),r=CALC.calculatePlan(p),c={plan:p,CALC,futureYouSelectedAge:null,safeWithdrawalRate:()=>.04,engagementProgress:()=>({financialFreedomRaw:0})};
  vm.runInNewContext(funcs,c);assert.equal(c.futureYouPreview(r).totalFiWealth,690000);
  c.futureYouSelectedAge=44;assert.equal(c.futureYouPreview(r).accessibleFiAssets,r.fiWealthProjection[1].accessibleFiAssets);
});
