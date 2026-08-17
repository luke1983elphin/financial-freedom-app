import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const currentDir = process.cwd();
const baselineDir = path.resolve(currentDir, "..", "stage-f-retirement-workspace-comparison-20260817");

function loadContext(dir) {
  const context = { console };
  context.globalThis = context;
  ["calculator.js", "semiRetirementProjection.js", "semiRetirementUi.js"].forEach((file) => {
    vm.runInNewContext(readFileSync(path.join(dir, file), "utf8"), context, { filename: file });
  });
  return context;
}

function createFixturePlan(CALC) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Luke";
  plan.personal.person2Name = "Lisa";
  plan.personal.person1Age = 43;
  plan.personal.person2Age = 41;
  plan.personal.fullRetirementAge = 60;
  plan.personal.semiRetirementAge = 55;
  plan.personal.targetAnnualSpending = 90000;
  plan.assets.cash = 30000;
  plan.assets.offset = 45000;
  plan.assets.sharesEtfs = 240000;
  plan.assets.superPerson1 = 260000;
  plan.assets.superPerson2 = 180000;
  plan.assets.home = 900000;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.investing.inflationPct = 2.5;
  plan.investing.wageGrowthPct = 3;
  plan.incomeItems = [
    { id: "income-luke", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 125000, frequency: "annually" },
    { id: "income-lisa", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 90000, frequency: "annually" },
    { id: "income-interest", name: "Interest", type: "interest", owner: "joint", amount: 4000, frequency: "annually" },
    { id: "income-rental", name: "Rental property net cash income", type: "rentalNetCashIncome", owner: "joint", amount: 18000, frequency: "annually", rentalCashflowTreatment: "afterInterest", linkedAssetId: "asset-rental", linkedLoanIds: ["loan-rental"] },
  ];
  plan.assetItems = [
    { id: "asset-home", name: "Home", type: "home", value: 900000 },
    { id: "asset-rental", name: "Rental property", type: "investmentProperty", value: 650000, annualGrowthRatePct: 3 },
  ];
  plan.liabilityItems = [
    { id: "loan-home", name: "Home loan", type: "homeLoan", balance: 420000, annualInterestRatePct: 5.8, repaymentAmount: 3600, repaymentFrequency: "monthly", remainingTermYears: 24, openingOffsetBalance: 45000 },
    { id: "loan-rental", name: "Rental loan", type: "rentalPropertyLoan", balance: 310000, annualInterestRatePct: 6.1, repaymentAmount: 2400, repaymentFrequency: "monthly", remainingTermYears: 22, linkedAssetId: "asset-rental", repaymentType: "principalAndInterest" },
    { id: "stsl-luke", type: "stsl", owner: "person1", balance: 18000 },
  ];
  return plan;
}

function projectionSnapshot(context) {
  const CALC = context.FFSCalculator;
  const UI = context.FFSSemiRetirementUi;
  const ENGINE = context.FFSSemiRetirementProjection;
  const plan = createFixturePlan(CALC);
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  const draft = defaults.draft;
  draft.people[0].hasSemiRetirement = true;
  draft.people[0].semiRetirementAge = 55;
  draft.people[0].semiRetirementGrossIncome = 65000;
  draft.people[0].fullRetirementAge = 60;
  draft.people[1].hasSemiRetirement = true;
  draft.people[1].semiRetirementAge = 57;
  draft.people[1].semiRetirementGrossIncome = 45000;
  draft.people[1].fullRetirementAge = 62;
  draft.household.currentLifestyleSpending = 90000;
  draft.household.semiRetirementLifestyleSpending = 85000;
  draft.household.fullRetirementLifestyleSpending = 95000;
  draft.scenario.semiRetirementAccessibleWithdrawal = 12000;
  draft.scenario.surplusDestination = "accessible-investments";
  draft.projectionEndAge = 92;
  const outcome = UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(outcome.validation.isValid, true);
  assert.equal(outcome.result.validation.isValid, true);
  const viewModel = UI.buildSemiRetirementResultsViewModel(outcome.result, outcome.inputs, draft);
  const rows = outcome.result.years;
  const checkpoints = [
    rows[0],
    rows.find((row) => row.calendarYear === outcome.result.summary.firstPersonFullRetirement?.calendarYear),
    rows.find((row) => row.calendarYear === outcome.result.summary.householdFullRetirement?.calendarYear),
    rows.at(-1),
  ].filter(Boolean);
  return {
    summary: outcome.result.summary,
    funding: viewModel.semiRetirementFunding,
    comparisonMetricSources: {
      requiredWithdrawals: viewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement,
      firstFullRetirementSurplus: viewModel.keyResults.accessibleWhenBothFullyRetired.row.household.annualLifestyleSurplusOrShortfall,
    },
    checkpoints: checkpoints.map((row) => ({
      calendarYear: row.calendarYear,
      householdPhase: row.householdPhase,
      people: row.people.map((person) => ({
        id: person.id,
        age: person.age,
        grossEmploymentIncome: person.grossEmploymentIncome,
        incomeTax: person.incomeTax,
        medicareLevy: person.medicareLevy,
        medicareLevySurcharge: person.medicareLevySurcharge,
        stslRepayment: person.stslRepayment,
        netIncome: person.netIncome,
        openingSuperBalance: person.openingSuperBalance,
        closingSuperBalance: person.closingSuperBalance,
      })),
      household: {
        applicableLifestyleSpending: row.household.applicableLifestyleSpending,
        requiredAccessibleWithdrawal: row.household.requiredAccessibleWithdrawal,
        optionalAdditionalLifestyleWithdrawal: row.household.optionalAdditionalLifestyleWithdrawal,
        annualLifestyleSurplusOrShortfall: row.household.annualLifestyleSurplusOrShortfall,
        openingAccessibleInvestmentBalance: row.household.openingAccessibleInvestmentBalance,
        closingAccessibleInvestmentBalance: row.household.closingAccessibleInvestmentBalance,
        totalSuperBalance: row.household.totalSuperBalance,
        totalInvestableAssets: row.household.totalInvestableAssets,
        netRentalCashflow: row.household.netRentalCashflow,
        totalDebt: row.household.totalDebt,
        totalPropertyValue: row.household.totalPropertyValue,
        totalPropertyEquity: row.household.totalPropertyEquity,
        totalNetWorth: row.household.totalNetWorth,
      },
    })),
  };
}

const baseline = projectionSnapshot(loadContext(baselineDir));
const current = projectionSnapshot(loadContext(currentDir));
assert.equal(JSON.stringify(current), JSON.stringify(baseline));

writeFileSync(
  path.join(currentDir, "STAGE-F1-NUMERICAL-COMPARISON.txt"),
  [
    "Stage F1 numerical comparison against Stage F final-tested copy",
    `Baseline: ${baselineDir}`,
    `Current: ${currentDir}`,
    "Result: PASS - representative semi-retirement projection snapshot is numerically identical.",
    "Fields compared: retirement milestones, tax, Medicare, MLS, STSL, lifestyle spending, semi-retirement withdrawals, first full-retirement surplus, optional draws, accessible investments, super, property cashflow, debt, property value, property equity and net worth.",
  ].join("\n"),
);
