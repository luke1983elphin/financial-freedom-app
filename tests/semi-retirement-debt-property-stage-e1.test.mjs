import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);

const ENGINE = context.FFSSemiRetirementProjection;

function mergeDeep(base, override) {
  if (Array.isArray(override)) return override.map((item) => mergeDeep({}, item));
  if (!override || typeof override !== "object") return override;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) output[key] = value.map((item) => mergeDeep({}, item));
    else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) output[key] = mergeDeep(base[key], value);
    else output[key] = value;
  }
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Person 1",
    currentAge: 50,
    currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 50,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 50,
    superAccessAge: 60,
    openingSuperBalance: 0,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 50,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 53,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 100000,
      annualReturnRate: 0,
      annualFeesRate: 0,
      currentAnnualContributions: 0,
    },
    assets: [],
    liabilities: [],
    propertyIncome: [],
    passiveIncome: [],
    people: [person()],
    scenario: {
      semiRetirementAccessibleWithdrawal: 0,
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
  }, overrides);
}

function project(overrides = {}) {
  const result = ENGINE.projectRetirementScenario(baseInput(overrides));
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return result;
}

test("Stage E1 zero-start-balance loan with stale repayment does not reduce current cashflow", () => {
  const result = project({
    liabilities: [{
      id: "stale-paid-loan",
      name: "Stale paid loan",
      type: "personalLoan",
      openingBalance: 0,
      interestRatePct: 6,
      repaymentAmount: 12000,
      repaymentFrequency: "annually",
      remainingTermYears: 5,
    }],
  });
  const row = result.years[0].liabilities[0];
  assert.equal(row.openingBalance, 0);
  assert.equal(row.totalRepayment, 0);
  assert.equal(row.closingBalance, 0);
  assert.equal(result.years[0].household.annualDebtCashRequirement, 0);
});

test("Stage E1 loan paid off during projection stops future repayment cashflow after payoff", () => {
  const result = project({
    liabilities: [{
      id: "final-payment-loan",
      name: "Final payment loan",
      type: "personalLoan",
      openingBalance: 1000,
      interestRatePct: 0,
      repaymentAmount: 1000,
      repaymentFrequency: "annually",
      remainingTermYears: 1,
    }],
  });
  assert.equal(result.years[0].liabilities[0].paidOffThisYear, true);
  assert.equal(result.years[0].liabilities[0].totalRepayment, 1000);
  assert.equal(result.years[1].liabilities[0].totalRepayment, 0);
  assert.equal(result.years[1].household.annualDebtCashRequirement, 0);
});
