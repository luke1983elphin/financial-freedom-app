import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fixture } from '../scripts/retirement-exhaustion-fixture.mjs';
const context = { console }; context.globalThis = context;
for (const file of ['calculator.js', 'agePensionEstimate.js', 'semiRetirementProjection.js', 'semiRetirementUi.js', 'dollar-basis.js', 'retirement-results.js']) vm.runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
const display = context.FFSRetirementResults.presentation;
const variants = {
  'single person with non-super and total exhaustion': () => {},
  'funded through forecast end': i => { i.accessibleInvestments.openingBalance = 1e7; },
  'restricted super is not accessible investments': i => { i.people[0].currentAge = 55; i.people[0].fullRetirementAge = 55; i.projectionEndAge = 56; i.accessibleInvestments.openingBalance = 0; },
  'couple and staggered semi retirement': i => { i.people[0].currentAge = 58; i.people[0].hasSemiRetirement = true; i.people[0].semiRetirementAge = 59; i.people[0].fullRetirementAge = 65; i.people[0].semiRetirementGrossIncome = 30000; i.people[0].currentGrossEmploymentIncome = 80000; i.people.push({ ...i.people[0], id: 'person2', name: 'Partner', currentAge: 55, fullRetirementAge: 63 }); },
  'property debt outstanding': i => { i.liabilities = [{ id: 'loan', linkedAssetId: 'home', name: 'Home loan', type: 'homeLoan', openingBalance: 120000, annualInterestRate: 0, repaymentAmount: 0, remainingTermYears: 30, repaymentType: 'interestOnly' }]; },
  'estimated pension included': i => { i.scenario.agePension = { enabled: true }; },
  'unsupported pension': i => { i.scenario.agePension = { enabled: true, unsupported: true }; },
};
for (const [name, configure] of Object.entries(variants)) test('retirement presentation: ' + name, () => {
  const inputs = fixture(); configure(inputs);
  const result = context.FFSSemiRetirementProjection.projectRetirementScenario(inputs);
  assert.equal(result.validation.isValid, true);
  const view = context.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(result, inputs, {});
  const before = JSON.stringify({ inputs, result, view });
  for (const rate of [0, .05]) for (const basis of ['future', 'today', 'future']) {
    const scenario = { ...inputs, inflationRate: rate };
    const data = display(view, scenario, basis);
    assert.equal(data.shortfall, Boolean(result.summary.firstUnfundedSpending?.calendarYear));
    assert.equal(data.points.length, result.years.length);
    for (const [index, point] of data.points.entries()) {
      const row = result.years[index];
      const expected = row.household.closingAccessibleInvestmentBalance / (basis === 'today' ? (1 + rate) ** row.yearIndex : 1);
      assert.ok(Math.abs(point.value - expected) < 1e-6);
    }
    assert.equal(data.remaining, data.points.at(-1).value);
    const end = result.years.at(-1);
    const expectedSuper = end.household.totalSuperBalance / (basis === 'today' ? (1 + rate) ** end.yearIndex : 1);
    assert.ok(Math.abs(data.superRemaining - expectedSuper) < 1e-6);
    assert.equal(data.allSuperAccessible, end.people.every(person => person.age >= person.superAccessAge));
    assert.equal(data.pensionIncluded, result.years.some(row => row.household.estimatedAgePension > 0));
    assert.equal(data.hasEmploymentIncome, result.years.some(row => row.people.some(person => person.grossEmploymentIncome > 0)), 'pension or passive cash income must not be described as employment');
    const sum = result.years.reduce((sum, row) => sum + row.household.unmetSpending / (basis === 'today' ? (1 + rate) ** row.yearIndex : 1), 0);
    assert.ok(Math.abs(data.shortfallAmount - sum) < 1e-6);
    if (!data.shortfall) assert.match(data.headline, /end of your forecast/);
  }
  assert.equal(JSON.stringify({ inputs, result, view }), before);
});

test('unknown investment balances remain unknown rather than appearing as zero', () => {
  const data = display({ annualRows: [{ calendarYear: 2040, household: {} }] }, { projectionStartYear: 2040, inflationRate: 0 }, 'today');
  assert.equal(data.remaining, null); assert.equal(data.points[0].value, null);
});
