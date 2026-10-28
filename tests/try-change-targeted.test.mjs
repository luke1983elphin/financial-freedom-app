import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTryChangeApp, controlledPlan } from './helpers/try-change-app.mjs';
const { app, CALC, context, document } = loadTryChangeApp();
const apply = (...args) => app.get('applyScenarioAdjustments')(...args);
const calc = p => app.get('calculatePlan')(p);
const close = (actual, expected, tolerance = .51) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const forecast = r => JSON.stringify({ cash: r.finalProjectedCashSurplus, worth: r.netWorthProjection, investments: r.investmentProjection, super: r.superProjection });
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

for (const cash of [10000, 0]) test(`F3 $50000 cost with $${cash} cash reports the full shortfall`, () => {
  const p = controlledPlan(CALC); p.assetItems[0].value = cash;
  assert.throws(() => apply(p, { oneOffCosts: 50000 }), new RegExp((50000 - cash).toLocaleString('en-AU')));
  assert.equal(p.assetItems[0].value, cash);
});
test('F3 missing cash cannot hide a cost; funded costs consume only cash once', () => {
  const p = controlledPlan(CALC); p.assetItems = p.assetItems.filter(item => item.category !== 'cash');
  assert.throws(() => apply(p, { oneOffCosts: 50000 }), /unfunded/);
  p.assetItems.push({ id: 'a', category: 'cash', value: 20000 }, { id: 'b', category: 'cash', value: 40000 });
  const q = apply(p, { oneOffCosts: 50000 });
  close(calc(q).currentNetWorth - calc(p).currentNetWorth, -50000);
  assert.equal(q.assetItems[0].value, 100000);
  close(q.assetItems.filter(a => a.category === 'cash').reduce((s, a) => s + a.value, 0), 10000);
});

test('F4 unsupported employer-super override is explicitly blocked, not silently ignored', () => {
  assert.throws(() => apply(controlledPlan(CALC), { superContributionChange: 5200 }), /Employer super.*not supported/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-comparison="superContributionChange"[^>]*disabled/);
  assert.match(html, /Employer super changes are not supported in this scenario/);
});

test('F5 custom expense preview and saved plan have identical inputs and results', () => {
  const p = controlledPlan(CALC); app.setPlan(p); app.choice('custom', { kind: 'expenses', amount: '5200', frequency: 'annually' });
  const saved = app.get('buildDecisionScenarioSaveContext')('what-if');
  assert.equal(saved.scenarioInputSnapshot.adjustments.expenseChange, -5200);
  assert.equal(saved.scenarioInputSnapshot.quick.custom.frequency, 'annually');
  close(calc(saved.planSnapshot).finalProjectedCashSurplus - calc(p).finalProjectedCashSurplus, 5200);
  assert.equal(JSON.stringify(app.getPlan()), JSON.stringify(p));
});
test('F5 expense saving allocated to investments is preserved once and reopens against its saved base', () => {
  const p = controlledPlan(CALC); app.setPlan(p); app.choice('expenses-500', null, 'investments');
  const resolved = app.get('resolveWhatIfScenario')(), saved = app.get('buildDecisionScenarioSaveContext')('what-if');
  assert.equal(saved.scenarioInputSnapshot.adjustments.investmentContributionChange, 6000);
  assert.equal(forecast(calc(saved.planSnapshot)), forecast(resolved.adjustedResult));
  const changed = controlledPlan(CALC); changed.assetItems[0].value = 500000; app.setPlan(changed);
  // Avoid DOM navigation only; use the real snapshot restoration before its navigation call.
  app.get('restoreDecisionScenarioInputs')({ ...saved, plan: saved.planSnapshot });
  const reopened = app.get('resolveWhatIfScenario')();
  assert.equal(forecast(reopened.adjustedResult), forecast(resolved.adjustedResult));
  assert.equal(JSON.stringify(app.getPlan()), JSON.stringify(changed));
});
test('F5 detailed combined scenario persists and reopens without applying surplus twice', () => {
  const p = controlledPlan(CALC); app.setPlan(p);
  app.comparison({ expenseChange: -5200, surplusAllocationTarget: 'investments', surplusAllocationAmount: 5200, surplusAllocationFrequency: 'annually' });
  const saved = app.get('buildDecisionScenarioSaveContext')('custom');
  assert.equal(saved.scenarioInputSnapshot.adjustments.investmentContributionChange, 5200);
  const scenario = { ...saved, id: 'targeted-save', name: 'Audit', plan: saved.planSnapshot, scenarioType: 'decision', source: 'user' };
  assert.equal(app.get('saveScenarios')([scenario]), true);
  const restored = app.get('loadScenarios')().find(s => s.id === 'targeted-save');
  assert.ok(restored);
  app.get('restoreDecisionScenarioInputs')(restored);
  assert.equal(forecast(calc(app.get('buildComparisonPlan')())), forecast(calc(saved.planSnapshot)));
  assert.equal(JSON.stringify(app.getPlan()), JSON.stringify(p));
});
