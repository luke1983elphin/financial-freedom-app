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
