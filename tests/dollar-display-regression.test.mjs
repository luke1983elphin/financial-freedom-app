import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import '../dollar-basis.js';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const basis = globalThis.FFSDollarBasis;
const extract = name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  function ', start + 5));
};
function context(extra = {}) {
  const ctx = { window: { FFSDollarBasis: basis, FFSSemiRetirementUi: {} },
    forecastDollarBasis: 'today', plan: { investing: { inflationPct: 99 } },
    semiRetirementScenarioInputs: { projectionStartYear: 2040, assumptions: { inflationRatePct: 20 } },
    money: value => String(value), semiRetirementMoney: value => String(value),
    semiRetirementMilestoneAgesFromRow: () => [], comparisonHouseholdMilestone: () => '',
    semiRetirementAgeList: () => '', milestoneAgesFromObject: () => [],
    semiRetirementBreakdownRow: (label, value) => ({ label, value }), ...extra };
  vm.runInNewContext(['displayedForecastAmount', 'forecastMoney', 'forecastYearFromCalendarYear',
    'retirementDisplayFields', 'retirementDisplaySum', 'retirementFundingDisplay',
    'semiRetirementComparisonSummaryDollarBasis', 'semiRetirementComparisonBreakdownRowsDollarBasis',
    'savedOutcomeForDisplay'].map(extract).join('\n'), ctx);
  return ctx;
}
const inputs = { projectionStartYear: 2026, assumptions: { inflationRatePct: 10 } };
function fixture() {
  const household = { totalInvestableAssets: 1210, closingAccessibleInvestmentBalance: 605,
    totalSuperBalance: 605, totalDebt: 121, totalPropertyEquity: 242,
    requiredAccessibleWithdrawal: 121, totalAccessibleWithdrawal: 121, totalSuperWithdrawal: 121 };
  const row = { calendarYear: 2028, yearIndex: 2, householdPhase: 'full-retirement', household,
    people: [{ name: 'A', closingSuperBalance: 605, employerSuperContribution: 121 }] };
  return { people: [], annualRows: [ { calendarYear: 2026, yearIndex: 0, household: {} }, row ],
    keyResults: { accessibleWhenBothFullyRetired: { row, milestone: { calendarYear: 2028 }, value: 605 },
      totalInvestableAssetsWhenBothFullyRetired: { value: 1210 },
      projectionEnd: { calendarYear: 2028, projectedNetWorth: 1089, accessibleInvestments: 605,
        super: 605, totalDebt: 121, totalInvestableAssets: 1210 } },
    debtProperty: { debtCards: [{ name: 'Loan', projectedBalanceAtRetirement: 121, projectedBalanceAtRetirementYear: 2028 }] },
    longevity: {}, semiRetirementFunding: {} };
}
const close = (actual, expected) => assert.ok(Math.abs(Number(actual) - expected) < 1e-8, `${actual} != ${expected}`);

test('scenario epoch is independent of wall clock and supports fallback annual rows', () => {
  close(basis.calendarHorizon(2028, inputs), 2);
  close(basis.calendarHorizon(2028, {}, [{ calendarYear: 2026 }]), 2);
  close(basis.calendarHorizon(2025, inputs), 0);
  close(context().forecastYearFromCalendarYear(2028, inputs), 2);
});
test('saved comparisons use their own rates, including explicit zero', () => {
  const ctx = context();
  close(ctx.semiRetirementComparisonSummaryDollarBasis(fixture(), inputs).assetsAtRetirement, 1000);
  close(ctx.semiRetirementComparisonSummaryDollarBasis(fixture(), { ...inputs, assumptions: { inflationRatePct: 0 } }).assetsAtRetirement, 1210);
  assert.match(extract('semiRetirementComparisonScenarioSetDollarBasis'), /semiRetirementComparisonSummary\(viewModel, scenario.inputs\)/);
});
test('engine decimal inflation takes precedence over draft percentages and main plan rates', () => {
  const ctx = context();
  close(basis.inflationPercent({ inflationRate: 0.05, assumptions: { inflationRatePct: 99 } }), 5);
  close(basis.inflationPercent({ inflationRate: 0, assumptions: { inflationRatePct: 99 } }), 0);
  const scenarioInputs = { projectionStartYear: 2026, inflationRate: 0.1 };
  close(ctx.semiRetirementComparisonSummaryDollarBasis(fixture(), scenarioInputs).assetsAtRetirement, 1000);
  close(basis.annualSum([{ yearIndex: 1, value: 110 }], row => row.value, scenarioInputs, 'today'), 100);
  const missing = ctx.semiRetirementComparisonSummaryDollarBasis({ people: [], annualRows: [] }, scenarioInputs);
  assert.equal(missing.assetsAtRetirement, undefined, 'an unreached milestone is not a zero balance');
  assert.equal(missing.projectedEndNetWorth, undefined);
});
test('comparison totals, super components, debt and end net worth reconcile without mutation', () => {
  const ctx = context(), view = fixture(), before = JSON.stringify(view);
  const summary = ctx.semiRetirementComparisonSummaryDollarBasis(view, inputs);
  const scenario = { viewModel: view, inputs, summary };
  const rows = key => Object.fromEntries(ctx.semiRetirementComparisonBreakdownRowsDollarBasis(key, scenario).map(r => [r.label, r.value]));
  close(rows('superAtRetirement')['A closing super'], 500);
  close(rows('superAtRetirement')['A employer super'], 100);
  close(rows('debtAtRetirement').Loan, 100);
  const end = rows('projectionEndNetWorth');
  close(Number(end['Accessible investments']) + Number(end.Super) - Number(end['Less remaining debt']), Number(end['Projected net worth']));
  close(summary.projectedEndNetWorth, 900);
  assert.equal(JSON.stringify(view), before);
});
test('shortfall breakdown uses shortfall year rather than retirement year', () => {
  const ctx = context(), view = fixture();
  view.longevity.firstUnfundedSpending = { calendarYear: 2029 };
  view.annualRows.push({ calendarYear: 2029, household: { unmetSpending: 1331 } });
  const rows = ctx.semiRetirementComparisonBreakdownRowsDollarBasis('firstShortfall', { viewModel: view, inputs });
  close(rows.find(r => r.label === 'Unmet spending').value, 1000);
});
test('cumulative cashflow discounts each year and leaves already-real amounts alone', () => {
  const rows = [0, 1, 2].map(yearIndex => ({ yearIndex, calendarYear: 2026 + yearIndex,
    householdPhase: 'semi-retirement', household: { requiredAccessibleWithdrawal: 100 * 1.1 ** yearIndex } }));
  const funding = context().retirementFundingDisplay({ annualRows: rows, semiRetirementFunding: { totalOneOffLifestyleSpendingTodayDollars: 987 } }, inputs);
  close(funding.requiredAccessibleWithdrawalsDuringSemiRetirement, 300);
  assert.equal(funding.totalOneOffLifestyleSpendingTodayDollars, 987);
  close(basis.annualSum(rows, r => r.household.requiredAccessibleWithdrawal, inputs, 'future'), 331);
});
test('field conversion preserves unknown values, rates, dates and source objects', () => {
  const value = { balance: 121, missing: null, rate: 10, calendarYear: 2028 };
  const converted = basis.convertedFields(value, ['balance', 'missing'], 2, 10, 'today');
  close(converted.balance, 100); assert.equal(converted.missing, null);
  assert.equal(converted.rate, 10); assert.equal(converted.calendarYear, 2028); assert.equal(value.balance, 121);
});
test('saved outcomes use distinct milestone and horizon years and preserve saved data', () => {
  const ctx = context(), saved = { fullRetirement: { calendarYear: 2027 }, horizon: { calendarYear: 2028 },
    accessibleAtRetirement: 110, superAtRetirement: 220, fundingAssetsAtRetirement: 330,
    capital: { totalNetEquity: 121, assets: [{ netEquity: 121 }, { netEquity: null }] } };
  const before = JSON.stringify(saved), display = ctx.savedOutcomeForDisplay(saved, inputs);
  close(display.accessibleAtRetirement, 100); close(display.capital.totalNetEquity, 100);
  assert.equal(display.capital.assets[1].netEquity, null); assert.equal(JSON.stringify(saved), before);
  ctx.forecastDollarBasis = 'future'; assert.equal(ctx.savedOutcomeForDisplay(saved, inputs), saved);
});
test('old snapshots without rate or epoch do not masquerade as real-dollar forecasts', () => {
  const saved = { accessibleAtRetirement: 123, superAtRetirement: 456, fundingAssetsAtRetirement: 579,
    capital: { totalNetEquity: 999, assets: [{ netEquity: 999 }] } };
  const display = context().savedOutcomeForDisplay(saved, {});
  assert.equal(display.accessibleAtRetirement, null);
  assert.equal(display.capital.assets[0].netEquity, null);
  assert.equal(display.capital.debtUnknown, true);
  assert.equal(saved.accessibleAtRetirement, 123);
});
test('Future You resolves semantic labels even when tiles are reordered', () => {
  const tiles = ['Projected passive income', 'Financial Freedom %', 'Projected net worth'].map(label => ({
    output: { textContent: 'original' }, querySelector(selector) { return selector === 'span' ? { firstChild: { textContent: label } } : this.output; },
  }));
  const ctx = context({ document: { querySelectorAll: () => tiles }, futureYouPreview: () => ({ year: 2, netWorth: 1210, passiveIncome: 121 }) });
  vm.runInNewContext(extract('refreshFutureYouDollarDisplay'), ctx);
  ctx.refreshFutureYouDollarDisplay({ plan: { investing: { inflationPct: 10 } } });
  close(tiles[0].output.textContent.replace(' pa', ''), 100); close(tiles[2].output.textContent, 1000);
  assert.equal(tiles[1].output.textContent, 'original');
  ctx.forecastDollarBasis = 'future'; ctx.refreshFutureYouDollarDisplay({ plan: { investing: { inflationPct: 10 } } });
  assert.equal(tiles[2].output.textContent, '1210');
});
test('sustainability cards use the actual final forecast row when a requested age exceeds the horizon', () => {
  const elements = { superCards: {}, superSummary: {} };
  const ctx = context({ plan: { investing: { inflationPct: 10 } },
    document: { getElementById: id => elements[id] }, summaryTile: () => '' });
  vm.runInNewContext(extract('projectionRowAtAge') + extract('renderSuperDollarBasis'), ctx);
  const nominal = 1000 * 1.1 ** 30;
  ctx.renderSuperDollarBasis({ plan: { personal: { person1Age: 20 }, investing: { inflationPct: 10 } },
    sustainabilityStartAge: 90, totalRetirementAssets: nominal, superAccessAge: 60,
    investmentProjection: [{ age: 50, year: 30 }],
    superProjection: [{ age: 50, year: 30, closingBalance: nominal, passiveIncome: 100 }],
    taxEstimate: { extraSuper: {} } });
  assert.match(elements.superSummary.innerHTML, /sustainability assets: 1000/);
});
