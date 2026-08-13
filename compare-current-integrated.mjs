
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

function loadContext(files) {
  const context = { console };
  context.globalThis = context;
  files.forEach((file) => vm.runInNewContext(readFileSync(file, "utf8"), context));
  return context;
}

function buildPlan(CALC) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Luke";
  plan.personal.person2Name = "Lisa";
  plan.personal.person1Age = 43;
  plan.personal.person2Age = 41;
  plan.personal.fullRetirementAge = 60;
  plan.personal.targetAnnualSpending = 90000;
  plan.assets.home = 950000;
  plan.assets.cash = 30000;
  plan.assets.offset = 20000;
  plan.assets.sharesEtfs = 150000;
  plan.assets.crypto = 10000;
  plan.assets.superPerson1 = 210000;
  plan.assets.superPerson2 = 145000;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.investing.inflationPct = 2.5;
  plan.incomeItems = [
    { id: "income-luke", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "income-lisa", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 85000, frequency: "annually" },
    { id: "income-interest", name: "Interest", type: "interest", owner: "joint", amount: 3000, frequency: "annually" },
  ];
  plan.loanItems = [
    { id: "home-loan", name: "Home loan", category: "homeLoan", balance: 520000, annualInterestRatePct: 6, repayment: 3600, repaymentFrequency: "monthly" },
  ];
  return plan;
}

const current = loadContext(["../__current_extract_for_compare/calculator.js", "../__current_extract_for_compare/weekly-plan.js"]);
const integrated = loadContext(["calculator.js", "weekly-plan.js"]);
const currentPlan = buildPlan(current.FFSCalculator);
const integratedPlan = buildPlan(integrated.FFSCalculator);
const currentResult = current.FFSCalculator.calculatePlan(currentPlan);
const integratedResult = integrated.FFSCalculator.calculatePlan(integratedPlan);
const fields = [
  "netWorth",
  "financialFreedomProgressRaw",
  "annualGrossIncome",
  "annualLivingExpenses",
  "annualLoanRepayments",
  "annualCashSurplus",
  "estimatedTaxAndHelp",
  "netIncomeAfterTaxHelp",
  "accessibleInvestmentAssets",
  "currentFiAssets",
  "targetFiCapital",
  "estimatedPassiveIncome",
  "totalAssets",
  "totalLiabilities",
  "totalSuper",
];
const comparisons = fields.map((field) => ({ field, current: currentResult[field], integrated: integratedResult[field], matches: currentResult[field] === integratedResult[field] }));
const currentWeekly = current.FFSWeeklyPlan.createFromPlan(currentPlan, currentResult, { startDate: "2026-08-03", durationWeeks: 12, openingBankBalance: 2500 });
const integratedWeekly = integrated.FFSWeeklyPlan.createFromPlan(integratedPlan, integratedResult, { startDate: "2026-08-03", durationWeeks: 12, openingBankBalance: 2500 });
const weeklyFields = ["openingBalance", "income", "bills", "provisions", "financialFreedomTransfers", "closingBalance"];
weeklyFields.forEach((field) => {
  comparisons.push({ field: `weekly.week1.${field}`, current: currentWeekly.weeks[0].planned[field], integrated: integratedWeekly.weeks[0].planned[field], matches: currentWeekly.weeks[0].planned[field] === integratedWeekly.weeks[0].planned[field] });
});
const mismatches = comparisons.filter((row) => !row.matches);
writeFileSync("SEMI-RETIREMENT-INTEGRATION-V1-NUMERIC-COMPARISON.json", JSON.stringify({ comparisons, mismatches }, null, 2));
assert.equal(mismatches.length, 0);
console.log(`Compared ${comparisons.length} current-vs-integrated outputs; mismatches: ${mismatches.length}`);
