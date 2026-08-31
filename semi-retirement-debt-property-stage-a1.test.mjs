import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const CALC = context.FFSCalculator;

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
    projectionEndAge: 55,
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

function firstDebt(result) {
  return result.years[0].liabilities[0];
}

test("Stage A1 negatively amortising credit-card debt increases instead of staying flat", () => {
  const result = project({
    liabilities: [{ id: "card", type: "creditCard", openingBalance: 20000, interestRatePct: 20, repaymentAmount: 2000, repaymentFrequency: "annually", remainingTermYears: 30 }],
  });
  const row = firstDebt(result);
  assert.ok(row.closingBalance > 20000);
  assert.ok(row.capitalisedInterest > 0);
  assert.equal(row.principalRepaid, 0);
  assert.ok(row.warnings.some((warning) => warning.code === "DEBT_NEGATIVE_AMORTISATION"));
});

test("Stage A1 ordinary amortising debt capitalises unpaid interest", () => {
  const result = project({
    liabilities: [{ id: "loan", type: "personalLoan", openingBalance: 100000, interestRatePct: 8, repaymentAmount: 5000, repaymentFrequency: "annually", remainingTermYears: 30 }],
  });
  const row = firstDebt(result);
  assert.ok(row.closingBalance > 100000);
  assert.ok(row.interestCharged > row.totalRepayment);
  assert.equal(row.capitalisedInterest, Number((row.closingBalance - row.openingBalance).toFixed(2)));
});

test("Stage A1 annual debt row reconciles opening, capitalised interest and principal", () => {
  const result = project({
    liabilities: [{ id: "loan", type: "homeLoan", openingBalance: 120000, interestRatePct: 6, repaymentAmount: 1500, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  const row = firstDebt(result);
  assert.equal(Number((row.openingBalance + row.capitalisedInterest - row.principalRepaid).toFixed(2)), row.closingBalance);
  assert.equal(Number((row.regularRepayment + row.balloonRepayment).toFixed(2)), row.totalRepayment);
  assert.equal(row.scheduledRepayment, row.totalRepayment);
});

test("Stage A1 amortising debt clears with a balloon repayment when explicit term expires", () => {
  const result = project({
    liabilities: [{ id: "final-year", type: "personalLoan", openingBalance: 25000, interestRatePct: 6, repaymentAmount: 10000, repaymentFrequency: "annually", remainingTermYears: 1 }],
  });
  const row = firstDebt(result);
  assert.equal(row.closingBalance, 0);
  assert.ok(row.balloonRepayment > 0);
  assert.ok(row.totalRepayment > 10000);
  assert.ok(row.warnings.some((warning) => warning.code === "DEBT_TERM_BALLOON_REPAYMENT"));
});

test("Stage A1 final payment is capped and cannot create a negative balance", () => {
  const result = project({
    liabilities: [{ id: "small", type: "vehicleLoan", openingBalance: 1000, interestRatePct: 0, repaymentAmount: 500, repaymentFrequency: "monthly", remainingTermYears: 1 }],
  });
  const row = firstDebt(result);
  assert.equal(row.totalRepayment, 1000);
  assert.equal(row.principalRepaid, 1000);
  assert.equal(row.closingBalance, 0);
});

test("Stage A1 balloon repayment is included in household cash requirement", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 100000 },
    liabilities: [{ id: "balloon", type: "homeLoan", openingBalance: 25000, interestRatePct: 6, repaymentAmount: 10000, repaymentFrequency: "annually", remainingTermYears: 1 }],
  });
  const row = firstDebt(result);
  assert.equal(result.years[0].household.annualDebtCashRequirement, row.totalRepayment);
  assert.ok(result.years[0].household.requiredAccessibleWithdrawal > 10000);
});

test("Stage A1 future repayments are zero after payoff", () => {
  const result = project({
    liabilities: [{ id: "quick", type: "personalLoan", openingBalance: 1000, interestRatePct: 0, repaymentAmount: 1000, repaymentFrequency: "annually", remainingTermYears: 1 }],
  });
  assert.equal(result.years[0].liabilities[0].paidOffThisYear, true);
  assert.equal(result.years[1].liabilities[0].totalRepayment, 0);
  assert.equal(result.years[1].liabilities[0].closingBalance, 0);
});

test("Stage A1 revolving debt does not incorrectly use amortising balloon logic", () => {
  const result = project({
    liabilities: [{ id: "card", type: "creditCard", openingBalance: 1000, interestRatePct: 0, repaymentAmount: 100, repaymentFrequency: "annually", remainingTermYears: 0 }],
  });
  const row = firstDebt(result);
  assert.equal(row.debtScheduleType, "revolving");
  assert.equal(row.balloonRepayment, 0);
  assert.equal(row.closingBalance, 900);
});

test("Stage A1 mortgage interest is reduced by opening offset balance", () => {
  const result = project({
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 400000, openingOffsetBalance: 200000, interestRatePct: 6, repaymentType: "interestOnly" }],
  });
  const row = firstDebt(result);
  assert.equal(row.offsetBalanceUsed, 100000);
  assert.equal(row.interestBearingBalance, 300000);
  assert.equal(row.interestCharged, 18000);
});

test("Stage A1 offset greater than loan does not create negative interest", () => {
  const result = project({
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 100000, openingOffsetBalance: 150000, interestRatePct: 6, repaymentType: "interestOnly" }],
  });
  const row = firstDebt(result);
  assert.equal(row.offsetBalanceUsed, 100000);
  assert.equal(row.interestBearingBalance, 0);
  assert.equal(row.interestCharged, 0);
});

test("Stage A1 offset does not reduce reported loan principal", () => {
  const result = project({
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 400000, openingOffsetBalance: 200000, interestRatePct: 0, repaymentAmount: 0, repaymentFrequency: "monthly" }],
  });
  const row = firstDebt(result);
  assert.equal(row.openingBalance, 400000);
  assert.equal(row.closingBalance, 400000);
  assert.equal(result.years[0].household.totalDebt, 400000);
});

test("Stage A1 offset is not double counted as debt reduction in net worth", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 200000 },
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 400000, openingOffsetBalance: 200000, interestRatePct: 0, repaymentAmount: 0, repaymentFrequency: "monthly" }],
  });
  assert.equal(result.years[0].household.closingAccessibleInvestmentBalance, 200000);
  assert.equal(result.years[0].household.totalDebt, 400000);
  assert.equal(result.years[0].household.totalNetWorth, -200000);
});

test("Stage A1 zero offset preserves prior interest behaviour", () => {
  const result = project({
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 400000, openingOffsetBalance: 0, interestRatePct: 6, repaymentType: "interestOnly" }],
  });
  assert.equal(firstDebt(result).interestCharged, 24000);
});

test("Stage A1 UI maps existing home offset into the home-loan projection input", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 60;
  plan.assets.offsetBalance = 75000;
  plan.liabilities.homeLoanBalance = 300000;
  plan.liabilities.homeLoanInterestRatePct = 6;
  plan.liabilities.monthlyRepayment = 2000;
  plan.liabilities.remainingLoanTermYears = 25;
  const draft = UI.buildSemiRetirementScenarioDefaults(plan, CALC.calculatePlan(plan)).draft;
  assert.equal(draft.liabilities[0].openingOffsetBalance, 75000);
});

test("Stage A1 offset lowers bridge-period cash drain under interest-only assumptions", () => {
  const noOffset = project({
    accessibleInvestments: { openingBalance: 100000 },
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 400000, openingOffsetBalance: 0, interestRatePct: 6, repaymentType: "interestOnly" }],
  });
  const withOffset = project({
    accessibleInvestments: { openingBalance: 100000 },
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 400000, openingOffsetBalance: 200000, interestRatePct: 6, repaymentType: "interestOnly" }],
  });
  assert.ok(withOffset.years[0].household.requiredAccessibleWithdrawal < noOffset.years[0].household.requiredAccessibleWithdrawal);
  assert.ok(withOffset.years[0].household.closingAccessibleInvestmentBalance > noOffset.years[0].household.closingAccessibleInvestmentBalance);
});

test("Stage A1 negatively amortising debt worsens projected net worth", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    liabilities: [{ id: "bad-debt", type: "personalLoan", openingBalance: 100000, interestRatePct: 8, repaymentAmount: 5000, repaymentFrequency: "annually", remainingTermYears: 30 }],
  });
  assert.ok(result.summary.totalDebtAtEndAge > 100000);
  assert.ok(result.summary.totalNetWorthAtEndAge < -100000);
});

test("Stage A1 rental after-interest treatment deducts principal only once", () => {
  const result = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    liabilities: [{ id: "loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 10, repaymentType: "interestOnly", additionalPrincipalRepayment: 6000, additionalPrincipalFrequency: "annually" }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", linkedLoanIds: ["loan"], annualIncome: 25000, rentalCashflowTreatment: "afterInterest" }],
  });
  const income = result.years[0].propertyIncome[0];
  assert.equal(income.rentalCashIncome, 25000);
  assert.equal(income.grossRentalIncome, 25000);
  assert.equal(income.loanInterest, 10000);
  assert.equal(income.loanPrincipal, 6000);
  assert.equal(income.netPropertyCashflow, 19000);
});

test("Stage A1 rental before-interest treatment deducts full linked loan repayments", () => {
  const result = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    liabilities: [{ id: "loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 10, repaymentType: "interestOnly", additionalPrincipalRepayment: 6000, additionalPrincipalFrequency: "annually" }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", linkedLoanIds: ["loan"], annualIncome: 25000, rentalCashflowTreatment: "beforeInterest" }],
  });
  const income = result.years[0].propertyIncome[0];
  assert.equal(income.rentalCashIncome, 25000);
  assert.equal(income.loanInterest, 10000);
  assert.equal(income.loanPrincipal, 6000);
  assert.equal(income.fullLoanRepayments, 16000);
  assert.equal(income.netPropertyCashflow, 9000);
});

test("Stage A1 property row uses rental cash-income terminology with compatibility alias", () => {
  const result = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", annualIncome: 12000, rentalCashflowTreatment: "afterInterest" }],
  });
  const property = result.years[0].properties[0];
  assert.equal(property.rentalCashIncome, 12000);
  assert.equal(property.grossRentalIncome, 12000);
});

test("Stage A1 property equity still does not fund retirement cashflow automatically", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    household: { fullRetirementLifestyleSpending: 10000 },
    scenario: { fullRetirementAnnualSpending: 10000 },
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 800000, annualGrowthRate: 0 }],
  });
  assert.equal(result.years[0].household.totalInvestableAssets, 0);
  assert.equal(result.years[0].household.unmetSpending, 10000);
  assert.equal(result.years[0].properties[0].closingValue, 800000);
});

test("Stage A1 assumptions document debt, offset and rental limitations", () => {
  const result = project();
  assert.match(result.assumptions.debtAndPropertyTreatment, /capitalised interest/i);
  assert.match(result.assumptions.offsetTreatment, /remaining offset balance/i);
  assert.match(result.assumptions.rentalTaxModel, /Rental cashflow and taxable rental income are modelled separately/i);
  assert.match(result.assumptions.offsetTreatment, /next projection year/i);
  assert.ok(result.assumptions.limitations.some((item) => /negative-gearing/i.test(item)));
});
