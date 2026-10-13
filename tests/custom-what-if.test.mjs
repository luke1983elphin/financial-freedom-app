import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = source.indexOf('  function customWhatIfAdjustments() {');
const end = source.indexOf('\n  function renderWhatIf(', start);
assert.ok(start >= 0 && end > start, 'custom what-if calculator is present');
const fn = source.slice(start, end);

function adjustments(kind, amount, frequency) {
  const context = { customWhatIf: { kind, amount: String(amount), frequency } };
  vm.runInNewContext(fn + '\nresult = customWhatIfAdjustments();', context);
  return context.result && JSON.parse(JSON.stringify(context.result));
}

test('custom amount and frequency convert to annual cashflow changes', () => {
  assert.deepEqual(adjustments('expenses', 300, 'monthly'), { expenseChange: -3600 });
  assert.deepEqual(adjustments('invest', 150, 'weekly'), { investmentContributionChange: 7800 });
  assert.deepEqual(adjustments('income', 200, 'fortnightly'), { incomeChange: 5200 });
  assert.deepEqual(adjustments('super', 1000, 'annually'), { extraConcessionalSuperChange: 1000 });
  assert.deepEqual(adjustments('debt', 500, 'monthly'), { loanRepaymentChangeMonthly: 500 });
});

test('invalid custom amounts are rejected instead of affecting financial results', () => {
  for (const value of [0, -1, 'abc', 10000001]) {
    assert.equal(adjustments('invest', value, 'monthly'), null);
  }
});

test('custom inputs use dedicated responsive form and preserve original-plan scenario flow', () => {
  assert.match(source, /class="what-if-custom-grid"/);
  assert.match(source, /class="what-if-custom-field">What would you like to change/);
  assert.match(source, /const firstResult = calculatePlan\(applyScenarioAdjustments\(plan, baseAdjustments\)\)/);
  assert.match(source, /const adjustedResult = calculatePlan\(applyScenarioAdjustments\(plan, allocationAdjustments\)\)/);
});

test('weekly to fortnightly to monthly expense reductions retain their distinct annual impacts', () => {
  assert.deepEqual(adjustments('expenses', 300, 'weekly'), { expenseChange: -15600 });
  assert.deepEqual(adjustments('expenses', 300, 'fortnightly'), { expenseChange: -7800 });
  assert.deepEqual(adjustments('expenses', 300, 'monthly'), { expenseChange: -3600 });
  assert.deepEqual(adjustments('expenses', 300, 'annually'), { expenseChange: -300 });
});

test('cashflow display distinguishes pre-investment saving from available-to-allocate cash', () => {
  assert.match(source, /const annualCashflowImpact = isCashflowSaving/);
  assert.match(source, /firstResult\.cashSurplusBeforeInvesting/);
  assert.match(source, /result\.cashSurplusBeforeInvesting/);
  assert.match(source, /const allocatable = Math\.max\(0, annualDifference\)/);
  assert.match(source, /fmtDelta\(annualCashflowImpact \/ 52\)/);
  assert.match(source, /fmtDelta\(annualCashflowImpact \/ 12\)/);
  assert.match(source, /already absorbed by your plan's investment contributions/);
});
