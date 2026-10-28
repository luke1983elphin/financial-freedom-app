import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTryChangeApp, controlledPlan } from './helpers/try-change-app.mjs';
const { app, CALC, context, document } = loadTryChangeApp();
const apply = (...args) => app.get('applyScenarioAdjustments')(...args);
const calc = p => app.get('calculatePlan')(p);
const close = (actual, expected, tolerance = .51) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const mortgage = (id, frequency, divisor) => ({ id, name: id, type: 'homeLoan', balance: 200000, repayment: 12000 / divisor, repaymentFrequency: frequency, interestRatePct: 0, termYears: 30 });

for (const [frequency, divisor] of [['weekly', 52], ['fortnightly', 26], ['monthly', 12], ['annually', 1]]) {
  test(`F1 $500/month is $6000/year for ${frequency} mortgage`, () => {
    const p = controlledPlan(CALC); p.liabilityItems = [mortgage('home', frequency, divisor)];
    const original = JSON.stringify(p), before = calc(p), after = calc(apply(p, { loanRepaymentChangeMonthly: 500 }));
    close(after.annualLoanRepayments - before.annualLoanRepayments, 6000);
    for (const years of [1, 5, 10]) close(after.netWorthProjection[years - 1].closingBalance - before.netWorthProjection[years - 1].closingBalance, 6000 * years);
    assert.equal(JSON.stringify(p), original);
  });
}
test('F1 multiple loans require a target and apply the household increase once', () => {
  const p = controlledPlan(CALC); p.liabilityItems = [mortgage('a', 'monthly', 12), mortgage('b', 'weekly', 52)];
  assert.throws(() => apply(p, { loanRepaymentChangeMonthly: 500 }), /Choose.*home loan/);
  const q = apply(p, { loanRepaymentChangeMonthly: 500, loanId: 'b' });
  assert.equal(q.liabilityItems[0].repayment, 1000);
  close(calc(q).annualLoanRepayments - calc(p).annualLoanRepayments, 6000);
  assert.throws(() => apply(p, { loanRepaymentChangeMonthly: 500, loanId: 'missing' }), /Choose.*home loan/);
});
test('F1 paid-off and inactive loans cannot receive a fictitious repayment', () => {
  const p = controlledPlan(CALC); p.liabilityItems = [{ ...mortgage('a', 'monthly', 12), balance: 0 }];
  assert.throws(() => apply(p, { loanRepaymentChangeMonthly: 500 }), /eligible home loan/);
});

test('F2 single earner increases salary by $5200 with $1664 tax/levy and no second earner', () => {
  const p = controlledPlan(CALC), b = calc(p), q = apply(p, { incomeChange: 5200 }), r = calc(q);
  close(r.finalProjectedCashSurplus - b.finalProjectedCashSurplus, 3536);
  close(r.taxEstimate.totalTax - b.taxEstimate.totalTax, 1664);
  close(r.netConcessionalSuperContributions - b.netConcessionalSuperContributions, 530.4);
  assert.equal(q.incomeItems.length, 1); assert.equal(q.incomeItems[0].owner, 'person1');
});
test('F2 four days reduces the selected salary, tax and employer super', () => {
  const p = controlledPlan(CALC), b = calc(p), r = calc(apply(p, { incomeRateChange: -.2, incomeEmploymentOnly: true }));
  close(r.finalProjectedCashSurplus - b.finalProjectedCashSurplus, -13600);
  close(r.netConcessionalSuperContributions - b.netConcessionalSuperContributions, -2040);
});
test('F2 couples must select an existing income owner; frequency and joint tax-free type survive', () => {
  const p = controlledPlan(CALC);
  p.personal.person2Name = 'Partner'; p.personal.person2Age = 41;
  p.incomeItems.push({ id: 'partner', type: 'salaryWages', owner: 'person2', amount: 2000, frequency: 'fortnightly' });
  assert.throws(() => apply(p, { incomeChange: 5200 }), /Choose.*income/);
  const q = apply(p, { incomeChange: 5200, incomeItemId: 'partner' });
  assert.equal(q.incomeItems[0].amount, 100000); assert.equal(q.incomeItems[1].amount, 2200);
  p.incomeItems.push({ id: 'free', type: 'taxFree', owner: 'joint', amount: 1000, frequency: 'annually', person1AllocationPercentage: 25, person2AllocationPercentage: 75 });
  const t = apply(p, { incomeChange: 5200, incomeItemId: 'free' });
  assert.equal(t.incomeItems[2].type, 'taxFree'); assert.equal(t.incomeItems[2].person1AllocationPercentage, 25);
  close(calc(t).taxEstimate.totalTax, calc(p).taxEstimate.totalTax);
  assert.throws(() => apply(p, { incomeChange: -60000, incomeItemId: 'partner' }), /exceeds/);
});
