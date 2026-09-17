import { readFileSync } from "node:fs";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const context = { console };
context.globalThis = context;
context.window = context;
for (const file of ["calculator.js", "semiRetirementProjection.js", "semiRetirementUi.js", "v2-data.js"]) {
  vm.runInNewContext(readFileSync(new URL(file, rootUrl), "utf8"), context, { filename: file });
}

const { FFSCalculator: CALC, FFSSemiRetirementProjection: ENGINE, FFSSemiRetirementUi: UI, FFS_DATA: DATA } = context;
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const samples = DATA.samplePlans.map((sample) => {
  const plan = CALC.clonePlan(sample.plan);
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  const outcome = UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  const viewModel = UI.buildSemiRetirementResultsViewModel(outcome.result, outcome.inputs, defaults.draft);
  const retirement = viewModel.keyResults.accessibleWhenBothFullyRetired;
  const end = viewModel.keyResults.projectionEnd;
  return {
    id: sample.id,
    name: sample.name,
    people: [plan.personal.person1Name, plan.personal.person2Name].filter(Boolean),
    current: {
      grossIncome: round(result.annualGrossIncome),
      netIncomeAfterTaxMedicareStsl: round(result.netIncomeAfterTaxHelp),
      taxMedicareStsl: round(result.estimatedTaxAndHelp),
      expenses: round(result.annualExpenses),
      debtRepayments: round(result.annualDebtRepayments),
      annualSurplus: round(result.finalProjectedCashSurplus),
      assets: round(result.totalAssets),
      liabilities: round(result.totalLiabilities),
      netWorth: round(result.currentNetWorth),
      accessibleInvestments: round(result.accessibleInvestmentAssets),
      super: round(result.superannuationBalance),
      passiveIncome: round(result.annualPassiveIncome),
      fiProgressPercent: round(result.financialFreedomProgressRaw),
    },
    retirement: {
      calendarYear: retirement.milestone.calendarYear,
      accessibleAssets: round(retirement.value),
      super: round(retirement.row.household.totalSuperBalance),
      debt: round(retirement.row.household.totalDebt),
      totalInvestableAssets: round(retirement.row.household.totalInvestableAssets),
      firstUnfundedSpendingYear: viewModel.longevity.firstUnfundedSpending?.calendarYear || null,
      projectionEndNetWorth: round(end.projectedNetWorth),
    },
    calculationVersion: result.calculationVersion,
    financialYear: result.financialYear,
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), sampleCount: samples.length, samples }, null, 2));
