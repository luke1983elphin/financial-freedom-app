import assert from 'node:assert/strict';
import {test} from 'node:test';
import {load,mortgagePlan,couplePlan,debtPlans} from '../scripts/modelling-assurance-fixture.mjs';
const {CALC:C,UI}=load();
const mortgage=(change=()=>{})=>{const p=mortgagePlan(C);change(p);return C.calculatePlan(p);};
test('mortgage payoff mid-projection uses actual partial-year payment',()=>{
  const rows=mortgage().accumulationCashflowProjection;
  assert.deepEqual(Array.from(rows.slice(0,4),r=>r.requiredMortgageRepayment),[12000,6000,0,0]);
  assert.deepEqual(Array.from(rows.slice(0,4),r=>r.openingMortgageBalance),[18000,6000,0,0]);
});
test('mortgage repayment deducted equals required payment in every year',()=>{
  for(const row of mortgage().accumulationCashflowProjection) assert.equal(row.mortgageCashflowDeduction,row.requiredMortgageRepayment);
});
test('no automatic allocation of former payment above configured investing',()=>{
  const r=mortgage();assert.equal(r.investmentProjection[4].annualContribution,6000);
  assert.equal(r.accumulationCashflowProjection[4].actualInvesting,6000);
});
test('configured investing can use freed cash only up to affordability',()=>{
  const r=mortgage(p=>p.investing.annualInvestingTarget=30000);
  for(const row of r.accumulationCashflowProjection) {
    assert.equal(row.actualInvesting,Math.max(0,row.netHouseholdCashIncome-row.livingExpenses-row.requiredDebtRepayments));
    assert.ok(row.actualInvesting<=30000);
  }
});
test('negative future surplus cannot fund phantom investments after payoff',()=>{
  const r=mortgage(p=>p.expenseItems[0].amount=100000);
  assert.ok(r.accumulationCashflowProjection.every(r=>r.actualInvesting===0));
  assert.ok(r.investmentProjection.every(r=>r.annualContribution===0));
});
test('zero configured strategy never redirects repaid mortgage',()=>{
  assert.ok(mortgage(p=>p.investing.annualInvestingTarget=0).investmentProjection.every(r=>r.annualContribution===0));
});
test('unknown legacy balance does not imply payoff or release cashflow',()=>{
  const r=mortgage(p=>{delete p.liabilities.homeLoanBalance;p.investing.annualInvestingTarget=30000;});
  assert.ok(r.accumulationCashflowProjection.every(row=>row.requiredMortgageRepayment===12000));
});
test('unpaid principal at the end of a term does not free repayments',()=>{
  const r=mortgage(p=>{p.liabilities.homeLoanBalance=1000000;p.liabilities.remainingLoanTermYears=1;});
  assert.equal(r.accumulationCashflowProjection[2].requiredMortgageRepayment,12000);
});
test('structured-only mortgage payoff is scheduled without legacy mirrors',()=>{
  const r=mortgage(p=>{p.liabilityItems=[{id:'h',type:'homeLoan',balance:18000,repayment:1000,repaymentFrequency:'monthly',interestRatePct:0}];p.liabilities.homeLoanBalance=0;p.liabilities.monthlyRepayment=0;});
  assert.deepEqual(Array.from(r.accumulationCashflowProjection.slice(0,3),r=>r.requiredMortgageRepayment),[12000,6000,0]);
});
for(const [year,p1,p2] of [[0,0,0],[2,300000,0],[5,300000,250000]]) test('super eligibility at elapsed year '+year,()=>{
  const r=C.calculatePlan(couplePlan(C)),s=C.selectFiWealthAtAge(r,58+year);
  assert.equal(s.superPeople[0].accessible,p1);assert.equal(s.superPeople[1].accessible,p2);
  assert.equal(s.accessibleFiAssets,100000+p1+p2);assert.equal(s.inaccessibleSuper,550000-p1-p2);
  assert.equal(s.totalFiWealth,s.accessibleFiAssets);
});
test('older Person 2 can access own super while Person 1 remains ineligible',()=>{
  const p=couplePlan(C);p.personal.person1Age=55;p.personal.person2Age=61;
  assert.equal(C.calculatePlan(p).fiWealth.accessibleSuper,250000);
});
test('Financial Freedom percent excludes younger partner super',()=>{
  const s=C.selectFiWealthAtAge(C.calculatePlan(couplePlan(C)),60);
  assert.equal(s.progress,40);assert.equal(s.totalFiWealth,400000);
});
test('household super total is conserved while eligibility changes',()=>{
  const p=couplePlan(C);p.investing.expectedSuperReturnPct=5;
  const r=C.calculatePlan(p);
  for(let i=0;i<r.superProjection.length;i++) {
    const s=r.fiWealthProjection[i+1];assert.equal(Math.round((s.accessibleSuper+s.inaccessibleSuper)*100),Math.round(r.superProjection[i].closingBalance*100));
  }
});
test('new employer super remains owned by its contributing person',()=>{
  const p=couplePlan(C);p.assets.superPerson1=0;p.assets.superPerson2=0;
  p.incomeItems=[{id:'s',type:'salaryWages',owner:'person2',amount:100000,frequency:'annually'}];
  const s=C.selectFiWealthAtAge(C.calculatePlan(p),60);
  assert.equal(s.accessibleSuper,0);assert.equal(s.inaccessibleSuper,20400);
});
const debts=p=>UI.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft.liabilities;
for(const key of ['zero','inactive','absent','rental']) test('canonical '+key+' debt cannot resurrect from legacy mirror',()=>{
  const p=debtPlans(C)[key];assert.equal(debts(p).reduce((sum,d)=>sum+d.openingBalance,0),0);
});
test('active structured debt takes precedence over mismatched legacy balance',()=>{
  const rows=debts(debtPlans(C).active);assert.equal(rows.length,1);assert.equal(rows[0].openingBalance,12000);
});
test('genuine pre-structured legacy plan retains legitimate home debt',()=>{
  const rows=debts(debtPlans(C).legacy);assert.equal(rows[0].openingBalance,99000);
});
test('unversioned empty collection retains legacy compatibility',()=>{
  const p=debtPlans(C).legacy;p.liabilityItems=[];assert.equal(debts(p)[0].openingBalance,99000);
});
test('mixed structured liabilities do not restore a removed legacy home loan',()=>{
  const p=debtPlans(C).inactive;p.liabilityItems.push({id:'p',type:'personalLoan',balance:5000,repayment:100,repaymentFrequency:'monthly'});
  const rows=debts(p);assert.equal(rows.length,1);assert.equal(rows[0].id,'p');
});
test('schema-authoritative empty debt collection also suppresses main cash payments',()=>{
  assert.equal(C.calculatePlan(debtPlans(C).absent).annualLoanRepayments,0);
});
