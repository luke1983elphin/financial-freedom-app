import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console, URLSearchParams };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;

function rentalLoan(overrides = {}) {
  return {
    id: "smith-loan",
    name: "Smith St loan",
    type: "rentalPropertyLoan",
    balance: 400000,
    interestRatePct: 5,
    repayment: 32000,
    repaymentFrequency: "annually",
    repaymentType: "principalAndInterest",
    termYears: 30,
    linkedAssetId: "smith-st",
    ...overrides,
  };
}

function propertyAsset(overrides = {}) {
  return {
    id: "smith-st",
    name: "Smith St",
    category: "rentalInvestmentProperty",
    value: 600000,
    owner: "joint",
    person1AllocationPercentage: 50,
    person2AllocationPercentage: 50,
    annualGrossRentalIncome: 50000,
    annualPropertyOperatingExpenses: 10000,
    propertyGrowthRatePct: 0,
    ...overrides,
  };
}

function planWithProperty({ asset = propertyAsset(), liabilities = [rentalLoan()] } = {}) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Luke";
  plan.personal.person2Name = "Lisa";
  plan.personal.person1Age = 43;
  plan.personal.person2Age = 41;
  plan.personal.fullRetirementAge = 60;
  plan.personal.targetAnnualSpending = 90000;
  plan.investing.inflationPct = 2.5;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.assetItems = [asset];
  plan.liabilityItems = liabilities;
  plan.incomeItems = [
    { id: "salary-luke", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "salary-lisa", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 85000, frequency: "annually" },
  ];
  return plan;
}

function propertyResult(plan) {
  const summary = CALC.calculateRentalPropertySummary(plan);
  const result = summary.propertyResults.find((item) => item.linkedAssetId === "smith-st");
  assert.ok(result, "Expected Smith St property result");
  return { summary, result };
}

function project(plan = planWithProperty(), mutator = () => {}) {
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result).draft;
  defaults.projectionEndAge = 80;
  defaults.accessibleInvestments.openingBalance = 500000;
  defaults.accessibleInvestments.externalAnnualAccessibleContribution = 0;
  mutator(defaults);
  const run = UI.runSemiRetirementProjection(ENGINE, defaults);
  assert.equal(run.validation.isValid, true, JSON.stringify(run.validation.errors));
  return run.result;
}

test("Stage E1 Test A zero-balance loan with stale monthly repayment contributes zero current repayments", () => {
  const breakdown = CALC.getAnnualLoanBreakdown(rentalLoan({
    balance: 0,
    repayment: 1000,
    repaymentFrequency: "monthly",
  }));
  assert.equal(breakdown.annualRepayments, 0);
  assert.equal(breakdown.regularAnnualRepayments, 0);
  assert.equal(breakdown.annualInterest, 0);
  assert.equal(breakdown.annualPrincipal, 0);
  assert.equal(breakdown.additionalPrincipal, 0);
  assert.equal(breakdown.closingBalance, 0);
});

test("Stage E1 Test B zero-balance loan with stale annual repayment contributes zero current repayments", () => {
  const breakdown = CALC.getAnnualLoanBreakdown(rentalLoan({
    balance: 0,
    repayment: 12000,
    repaymentFrequency: "annually",
  }));
  assert.equal(breakdown.annualRepayments, 0);
  assert.equal(breakdown.regularAnnualRepayments, 0);
  assert.equal(breakdown.annualPrincipal, 0);
});

test("Stage E1 Test C zero-balance interest-only loan contributes no stale servicing cashflow", () => {
  const breakdown = CALC.getAnnualLoanBreakdown(rentalLoan({
    balance: 0,
    repayment: 12000,
    repaymentFrequency: "annually",
    repaymentType: "interestOnly",
    additionalPrincipalRepayment: 3000,
    additionalPrincipalFrequency: "annually",
  }));
  assert.equal(breakdown.annualRepayments, 0);
  assert.equal(breakdown.annualInterest, 0);
  assert.equal(breakdown.annualPrincipal, 0);
  assert.equal(breakdown.additionalPrincipal, 0);
});

test("Stage E1 Test D current taxable rental profit after payoff equals gross rent less expenses", () => {
  const { result } = propertyResult(planWithProperty({
    liabilities: [rentalLoan({
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "monthly",
    })],
  }));
  assert.equal(result.annualLoanInterest, 0);
  assert.equal(result.currentTaxableRentalProfit, 40000);
});

test("Stage E1 Test E current net property cashflow after payoff ignores stale stored repayment", () => {
  const { summary, result } = propertyResult(planWithProperty({
    liabilities: [rentalLoan({
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "monthly",
    })],
  }));
  assert.equal(result.annualLoanRepayments, 0);
  assert.equal(result.annualLoanPrincipal, 0);
  assert.equal(result.currentNetPropertyCashflow, 40000);
  assert.equal(summary.annualCurrentNetPropertyCashflow, 40000);

  const planResult = CALC.calculatePlan(planWithProperty({
    liabilities: [rentalLoan({
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "monthly",
    })],
  }));
  assert.equal(planResult.annualRentalLoanCashflowRepayments, 0);
  assert.equal(planResult.rentalPropertySummary.annualHouseholdCashflowContribution, 40000);
});

test("Stage E1 Test F multiple linked loans include only active loan servicing", () => {
  const { result } = propertyResult(planWithProperty({
    liabilities: [
      rentalLoan({
        id: "paid-off",
        balance: 0,
        repayment: 1000,
        repaymentFrequency: "monthly",
      }),
      rentalLoan({
        id: "active",
        balance: 200000,
        interestRatePct: 5,
        repayment: 10000,
        repaymentFrequency: "annually",
        repaymentType: "interestOnly",
        additionalPrincipalRepayment: 10000,
        additionalPrincipalFrequency: "annually",
      }),
    ],
  }));
  assert.equal(result.annualLoanInterest, 10000);
  assert.equal(result.annualLoanPrincipal, 10000);
  assert.equal(result.annualLoanRepayments, 20000);
  assert.equal(result.currentTaxableRentalProfit, 30000);
  assert.equal(result.currentNetPropertyCashflow, 20000);
});

test("Stage E1 Test G ordinary active loan current-year behaviour is unchanged", () => {
  const breakdown = CALC.getAnnualLoanBreakdown(rentalLoan({
    balance: 200000,
    interestRatePct: 5,
    repayment: 10000,
    repaymentFrequency: "annually",
    repaymentType: "interestOnly",
    additionalPrincipalRepayment: 5000,
    additionalPrincipalFrequency: "annually",
  }));
  assert.equal(breakdown.annualRepayments, 15000);
  assert.equal(breakdown.regularAnnualRepayments, 10000);
  assert.equal(breakdown.annualInterest, 10000);
  assert.equal(breakdown.annualPrincipal, 5000);
  assert.equal(breakdown.additionalPrincipal, 5000);
  assert.equal(breakdown.closingBalance, 195000);
});

test("Stage E1 Test H future semi-retirement debt schedule remains unchanged", () => {
  const result = project(planWithProperty({
    liabilities: [rentalLoan({
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "monthly",
      repaymentType: "interestOnly",
    })],
  }));
  const year0 = result.years[0].propertyIncome[0];
  assert.equal(year0.loanInterest, 0);
  assert.equal(year0.loanPrincipal, 0);
  assert.equal(year0.fullLoanRepayments, 0);
  assert.equal(year0.taxableRentalIncome, 40000);
  assert.equal(year0.netPropertyCashflow, 40000);

  const activePayoff = ENGINE.projectDebtYearForAudit({
    id: "future-loan",
    type: "rentalPropertyLoan",
    annualInterestRate: 0,
    repaymentAmount: 1000,
    repaymentFrequency: "monthly",
    repaymentType: "principalAndInterest",
    hasExplicitRemainingTerm: true,
    remainingTermYears: 30,
  }, 12000, 0, 2026);
  assert.equal(activePayoff.totalRepayment, 12000);
  assert.equal(activePayoff.principalRepaid, 12000);
  assert.equal(activePayoff.closingBalance, 0);
});

test("Stage E1 Test I paid-off linked liability leaves property equity at full property value", () => {
  const result = project(planWithProperty({
    liabilities: [rentalLoan({
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "monthly",
    })],
  }));
  const property = result.years[0].properties[0];
  assert.equal(property.linkedLoanOpeningBalance, 0);
  assert.equal(property.linkedLoanClosingBalance, 0);
  assert.equal(property.propertyEquity, property.closingValue);
});

test("Stage E1 Test J paid-off loan calculation does not mutate saved repayment fields", () => {
  const loan = rentalLoan({
    balance: 0,
    repayment: 1000,
    repaymentFrequency: "monthly",
    additionalPrincipalRepayment: 3000,
  });
  CALC.getAnnualLoanBreakdown(loan);
  propertyResult(planWithProperty({ liabilities: [loan] }));
  assert.equal(loan.balance, 0);
  assert.equal(loan.repayment, 1000);
  assert.equal(loan.repaymentFrequency, "monthly");
  assert.equal(loan.additionalPrincipalRepayment, 3000);
});
