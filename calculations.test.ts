import assert from "node:assert/strict";
import test from "node:test";

import {
  amortiseLoan,
  calculateCashflow,
  calculateFinancialModel,
  calculateLoanSummary,
  calculateOffsetBenefit,
  projectInvestments,
  projectSuper,
} from "../lib/calculations.ts";
import { sampleHousehold } from "../lib/sampleData.ts";

test("a 30-year loan does not project beyond 360 months", () => {
  const summary = calculateLoanSummary({
    principal: 500_000,
    annualInterestRate: 0.06,
    monthlyRepayment: 1_000,
    termYears: 30,
  });

  assert.ok(summary.schedule.length <= 360);
  assert.equal(summary.schedule.at(-1)?.month, summary.schedule.length);
  assert.equal(summary.balanceAtYears[30], summary.finalBalance);
});

test("loan balance reduces each month when repayment exceeds interest", () => {
  const { schedule } = amortiseLoan({
    principal: 100_000,
    annualInterestRate: 0.06,
    monthlyRepayment: 1_000,
    termYears: 30,
  });

  assert.ok(schedule.length > 12);
  for (const month of schedule.slice(0, 12)) {
    assert.ok(month.repayment > month.interestCharged);
    assert.ok(month.closingBalance < month.openingBalance);
  }
});

test("repayments stop once loan reaches zero", () => {
  const summary = calculateLoanSummary({
    principal: 1_050,
    annualInterestRate: 0,
    monthlyRepayment: 500,
    termYears: 30,
  });

  assert.equal(summary.finalBalance, 0);
  assert.equal(summary.schedule.length, 3);
  assert.equal(summary.schedule.at(-1)?.repayment, 50);
  assert.equal(summary.yearsToRepay, 0.25);
});

test("offset reduces interest charged", () => {
  const noOffset = calculateLoanSummary({
    principal: 500_000,
    annualInterestRate: 0.06,
    monthlyRepayment: 3_500,
    termYears: 30,
  });
  const withOffset = calculateLoanSummary({
    principal: 500_000,
    annualInterestRate: 0.06,
    monthlyRepayment: 3_500,
    termYears: 30,
    offsetBalance: 100_000,
  });
  const offsetBenefit = calculateOffsetBenefit({
    principal: 500_000,
    annualInterestRate: 0.06,
    offsetBalance: 100_000,
  });

  assert.ok(withOffset.schedule[0].interestCharged < noOffset.schedule[0].interestCharged);
  assert.equal(noOffset.schedule[0].interestCharged, 2_500);
  assert.equal(withOffset.schedule[0].interestCharged, 2_000);
  assert.equal(offsetBenefit.effectiveLoanBalance, 400_000);
  assert.equal(offsetBenefit.annualInterestSaved, 6_000);
  assert.equal(offsetBenefit.taxFreeEquivalentReturn, 0.06);
});

test("returns a warning when repayment is less than monthly interest", () => {
  const summary = calculateLoanSummary({
    principal: 100_000,
    annualInterestRate: 0.12,
    monthlyRepayment: 500,
    termYears: 30,
  });

  assert.ok(summary.warnings.some((warning) => warning.code === "REPAYMENT_TOO_LOW"));
  assert.equal(summary.schedule[0].interestCharged, 1_000);
  assert.equal(summary.schedule[0].principalRepaid, -500);
});

test("investment projection compounds contributions", () => {
  const projection = projectInvestments({
    startingBalance: 1_000,
    annualContribution: 1_200,
    expectedReturn: 0,
    projectionYears: 2,
    currentAge: 40,
    safeWithdrawalRate: 0.04,
  });

  assert.equal(projection[0].closingBalance, 2_200);
  assert.equal(projection[1].closingBalance, 3_400);
  assert.equal(projection[1].passiveIncome, 136);
});

test("super projection separates employer and extra contributions", () => {
  const projection = projectSuper({
    startingBalance: 10_000,
    annualEmployerContribution: 1_200,
    annualExtraContribution: 600,
    expectedReturn: 0,
    projectionYears: 1,
    currentAge: 49,
    safeWithdrawalRate: 0.04,
  });

  assert.equal(projection[0].age, 50);
  assert.equal(projection[0].employerContribution, 1_200);
  assert.equal(projection[0].extraContribution, 600);
  assert.equal(projection[0].closingBalance, 11_800);
});

test("quarterly income and expense frequencies convert correctly", () => {
  const model = {
    ...sampleHousehold,
    incomes: [{ id: "quarterly-income", name: "Quarterly income", amount: 1_000, frequency: "quarterly" as const }],
    expenses: [{ id: "quarterly-expense", name: "Quarterly expense", amount: 250, frequency: "quarterly" as const }],
  };
  const cashflow = calculateCashflow(model, []);

  assert.equal(cashflow.annualNetIncome, 4_000);
  assert.equal(cashflow.annualExpenses, 1_000);
});

test("sample household dashboard calculates offset and cashflow", () => {
  const dashboard = calculateFinancialModel(sampleHousehold);
  const homeLoan = dashboard.loanSummaries[0];

  assert.equal(homeLoan.offsetBenefit.grossLoanBalance, 550_000);
  assert.equal(homeLoan.offsetBenefit.offsetBalance, 90_000);
  assert.equal(homeLoan.offsetBenefit.effectiveLoanBalance, 460_000);
  assert.equal(homeLoan.offsetBenefit.annualInterestSaved, 5_490);
  assert.equal(dashboard.cashflow.annualNetIncome, 127_200);
  assert.equal(dashboard.cashflow.annualExpenses, 77_100);
  assert.equal(dashboard.cashflow.annualMortgageRepayments, 40_800);
  assert.equal(dashboard.cashflow.cashSurplusBeforeInvesting, 9_300);
  assert.equal(dashboard.cashflow.cashSurplusAfterInvesting, -20_700);
  assert.ok(dashboard.wealthCreationRate > sampleHousehold.investing.annualInvestingTarget);
});
