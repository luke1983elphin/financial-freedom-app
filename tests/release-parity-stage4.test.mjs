import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const context = { console };
context.globalThis = context;
context.window = context;
for (const file of ["calculator.js", "semiRetirementProjection.js", "semiRetirementUi.js", "v2-data.js"]) {
  vm.runInNewContext(readFileSync(new URL(file, rootUrl), "utf8"), context, { filename: file });
}

const { FFSCalculator: CALC, FFSSemiRetirementProjection: ENGINE, FFSSemiRetirementUi: UI, FFS_DATA: DATA } = context;
const round = (value) => Math.round(Number(value) * 100) / 100;

function samplePlan(id) {
  return CALC.clonePlan(DATA.samplePlans.find((sample) => sample.id === id).plan);
}

function coupleWithStsl() {
  const plan = samplePlan("young-couple");
  plan.income.person2HasStslDebt = true;
  plan.liabilities.person2StslBalance = 18000;
  plan.liabilities.person2HecsHelpDebt = 18000;
  plan.liabilities.hecsHelpDebt = 18000;
  const stsl = plan.liabilityItems.find((item) => item.owner === "person2" && ["hecsHelp", "stsl"].includes(item.type));
  stsl.balance = 18000;
  return plan;
}

function releaseMetrics(plan) {
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  // Preserve the explicit investment assumption of these historical parity fixtures.
  defaults.draft.scenario.workingPhaseSurplusDestination = "accessible-investments";
  const outcome = UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  assert.equal(outcome.validation?.isValid, true);
  const view = UI.buildSemiRetirementResultsViewModel(outcome.result, outcome.inputs, defaults.draft);
  const retirement = view.keyResults.accessibleWhenBothFullyRetired;
  return {
    tax: round(result.estimatedTaxAndHelp),
    netIncome: round(result.netIncomeAfterTaxHelp),
    surplus: round(result.finalProjectedCashSurplus),
    totalDebt: round(result.totalLiabilities),
    netWorth: round(result.currentNetWorth),
    accessibleInvestments: round(result.accessibleInvestmentAssets),
    super: round(result.superannuationBalance),
    propertyEquity: round(result.investmentPropertyEquity),
    retirementYear: retirement.milestone.calendarYear,
    retirementAccessible: round(retirement.value),
    retirementSuper: round(retirement.row.household.totalSuperBalance),
    retirementDebt: round(retirement.row.household.totalDebt),
    projectionEndNetWorth: round(view.keyResults.projectionEnd.projectedNetWorth),
  };
}

const fixtures = [
  {
    name: "single person",
    plan: () => samplePlan("young-professional"),
    expected: { tax: 25510.8, netIncome: 72489.2, surplus: 10479.2, totalDebt: 36000, netWorth: 102500, accessibleInvestments: 58500, super: 68000, propertyEquity: 0, retirementYear: 2057, retirementAccessible: 4526553.98, retirementSuper: 1919067.08, retirementDebt: 0, projectionEndNetWorth: 30753838.97 },
  },
  {
    name: "couple with STSL and private hospital cover",
    plan: coupleWithStsl,
    expected: { tax: 46941.8, netIncome: 152858.2, surplus: 15368.2, totalDebt: 578000, netWorth: 542000, accessibleInvestments: 124000, super: 181000, propertyEquity: 0, retirementYear: 2057, retirementAccessible: 7914618.99, retirementSuper: 4148994.77, retirementDebt: 0, projectionEndNetWorth: 58181019.27 },
  },
  {
    name: "property household",
    plan: () => samplePlan("established-family-wealth-building"),
    expected: { tax: 70489.32, netIncome: 211310.68, surplus: 0, totalDebt: 930000, netWorth: 2068000, accessibleInvestments: 491000, super: 575000, propertyEquity: 280000, retirementYear: 2044, retirementAccessible: 2904778.95, retirementSuper: 2953629.38, retirementDebt: 93065.13, projectionEndNetWorth: 23843554.69 },
  },
  {
    name: "semi-retirement household",
    plan: () => samplePlan("semi-retirement"),
    expected: { tax: 56857.12, netIncome: 189642.88, surplus: 9622.88, totalDebt: 310000, netWorth: 2290000, accessibleInvestments: 682000, super: 790000, propertyEquity: 0, retirementYear: 2039, retirementAccessible: 2825949.65, retirementSuper: 2441658.43, retirementDebt: 0, projectionEndNetWorth: 19438485.66 },
  },
];

for (const fixture of fixtures) {
  test(`Stage 4 release parity: ${fixture.name}`, () => {
    assert.deepEqual(releaseMetrics(fixture.plan()), fixture.expected);
  });
}

test("Stage 4 property fixture keeps rental loan in debt and property equity", () => {
  const plan = samplePlan("established-family-wealth-building");
  const loan = plan.liabilityItems.find((item) => item.id === "liability-rental-loan");
  const income = plan.incomeItems.find((item) => item.id === "income-rental-net");
  assert.equal(loan.type, "rentalPropertyLoan");
  assert.equal(loan.linkedRentalIncomeId, income.id);
  assert.deepEqual(Array.from(income.linkedLoanIds), [loan.id]);
  const metrics = releaseMetrics(plan);
  assert.equal(metrics.totalDebt, 930000);
  assert.equal(metrics.propertyEquity, 280000);
});

test("Stage 4 retirement debt presentation identifies the first annual projection row", () => {
  const appSource = readFileSync(new URL("app.js", rootUrl), "utf8");
  assert.match(appSource, /Debt after first projection year/);
  assert.match(appSource, /Projected debt at the end of the first annual projection period/);
  assert.doesNotMatch(appSource, /semiRetirementMetricCard\("Current debt"/);
});

test("Stage 4 pre-setup copy does not imply disabled AI unlocks after setup", () => {
  const appSource = readFileSync(new URL("app.js", rootUrl), "utf8");
  assert.match(appSource, /AI coaching is unavailable in this beta/);
  assert.match(appSource, /without sending financial information to an AI provider/);
  assert.doesNotMatch(appSource, /AI coaching unlocks after setup/);
  assert.doesNotMatch(appSource, /Once your plan is complete, AI (?:will|can)/);
});
