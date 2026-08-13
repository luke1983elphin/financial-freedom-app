import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

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

test("Stage A asset option exists in the Assets UI", () => {
  assert.match(appSource, /\["rentalInvestmentProperty",\s*"Rental \/ Investment Property"\]/);
  assert.match(appSource, /Use this for a property held to earn rent and\/or for investment purposes/);
});

test("Stage A classification uses normal asset collection data and defaults into the semi-retirement draft", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 60;
  plan.assetItems = [
    { id: "rental-asset", name: "Smith Street", category: "rentalInvestmentProperty", value: 500000, propertyGrowthRatePct: 4 },
  ];
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, CALC.calculatePlan(plan)).draft;
  assert.equal(defaults.assets[0].id, "rental-asset");
  assert.equal(defaults.assets[0].type, "rentalInvestmentProperty");
  assert.equal(defaults.assets[0].openingValue, 500000);
  assert.equal(defaults.assets[0].annualGrowthRatePct, 4);
});

test("Stage A reclassifying a property does not duplicate its value in projected net worth", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    assets: [{ id: "property", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
  });
  assert.equal(result.years[0].household.totalNetWorth, 500000);
  assert.equal(result.years[0].household.totalPropertyValue, 500000);
});

test("Stage A legacy Other property assets remain valid without forced reclassification", () => {
  const result = project({
    assets: [{ id: "legacy-property", type: "otherProperty", openingValue: 300000, annualGrowthRate: 0 }],
  });
  assert.equal(result.years[0].properties[0].type, "otherProperty");
  assert.equal(result.years[0].properties[0].netPropertyCashflow, 0);
});

test("Stage A home loan amortises and repayments stop after payoff", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    liabilities: [{ id: "home-loan", type: "homeLoan", openingBalance: 100000, interestRatePct: 0, repaymentAmount: 10000, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.equal(result.years[0].liabilities[0].closingBalance, 0);
  assert.equal(result.years[0].liabilities[0].scheduledRepayment, 100000);
  assert.equal(result.years[1].liabilities[0].scheduledRepayment, 0);
  assert.equal(result.summary.debtPayoffMilestones[0].liabilityId, "home-loan");
});

test("Stage A final repayment is capped so debt never becomes negative", () => {
  const result = project({
    liabilities: [{ id: "small-loan", type: "personalLoan", openingBalance: 5000, interestRatePct: 0, repaymentAmount: 10000, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.equal(result.years[0].liabilities[0].scheduledRepayment, 5000);
  assert.equal(result.years[0].liabilities[0].principalRepaid, 5000);
  assert.equal(result.years[0].liabilities[0].closingBalance, 0);
});

test("Stage A debt rows reconcile repayment, interest and principal", () => {
  const result = project({
    liabilities: [{ id: "loan", type: "homeLoan", openingBalance: 120000, interestRatePct: 6, repaymentAmount: 1500, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  const row = result.years[0].liabilities[0];
  assert.equal(Number((row.interestCharged + row.principalRepaid).toFixed(2)), row.scheduledRepayment);
  assert.ok(row.closingBalance < row.openingBalance);
});

test("Stage A repayment frequencies convert consistently", () => {
  const weekly = project({ liabilities: [{ id: "weekly", type: "personalLoan", openingBalance: 20000, interestRatePct: 0, repaymentAmount: 100, repaymentFrequency: "weekly", remainingTermYears: 30 }] });
  const monthly = project({ liabilities: [{ id: "monthly", type: "personalLoan", openingBalance: 20000, interestRatePct: 0, repaymentAmount: 5200 / 12, repaymentFrequency: "monthly", remainingTermYears: 30 }] });
  assert.equal(weekly.years[0].liabilities[0].scheduledRepayment, 5200);
  assert.equal(monthly.years[0].liabilities[0].scheduledRepayment, 5200);
});

test("Stage A household cash requirement falls after a loan is repaid", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    liabilities: [{ id: "fast-loan", type: "otherDebt", openingBalance: 6000, interestRatePct: 0, repaymentAmount: 1000, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.equal(result.years[0].household.annualDebtCashRequirement, 6000);
  assert.equal(result.years[1].household.annualDebtCashRequirement, 0);
});

test("Stage A non-property personal debt behaves as household cashflow debt", () => {
  const result = project({
    liabilities: [{ id: "car-loan", type: "vehicleLoan", openingBalance: 30000, interestRatePct: 0, repaymentAmount: 500, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.equal(result.years[0].household.scheduledDebtCashRequirement, 6000);
  assert.equal(result.years[0].liabilities[0].principalRepaid, 6000);
});

test("Stage A property income and debt link to the correct Rental / Investment Property asset", () => {
  const result = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    liabilities: [{ id: "rental-loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 0, repaymentAmount: 500, repaymentFrequency: "monthly", remainingTermYears: 30 }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", linkedLoanIds: ["rental-loan"], annualIncome: 10000, rentalCashflowTreatment: "afterInterest" }],
  });
  assert.equal(result.years[0].properties[0].id, "rental");
  assert.equal(result.years[0].properties[0].netPropertyCashflow, 4000);
});

test("Stage A property value projects using supplied growth assumption", () => {
  const result = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0.04 }],
  });
  assert.equal(result.years[0].properties[0].closingValue, 520000);
  assert.equal(result.years[1].properties[0].openingValue, 520000);
});

test("Stage A rental interest is not double counted for after-interest rental cashflow", () => {
  const afterInterest = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    liabilities: [{ id: "loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 10, repaymentType: "interestOnly", additionalPrincipalRepayment: 6000, additionalPrincipalFrequency: "annually" }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", linkedLoanIds: ["loan"], annualIncome: 25000, rentalCashflowTreatment: "afterInterest" }],
  });
  const beforeInterest = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    liabilities: [{ id: "loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 10, repaymentType: "interestOnly", additionalPrincipalRepayment: 6000, additionalPrincipalFrequency: "annually" }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", linkedLoanIds: ["loan"], annualIncome: 25000, rentalCashflowTreatment: "beforeInterest" }],
  });
  assert.equal(afterInterest.years[0].propertyIncome[0].loanInterest, 10000);
  assert.equal(afterInterest.years[0].propertyIncome[0].netPropertyCashflow, 19000);
  assert.equal(beforeInterest.years[0].propertyIncome[0].netPropertyCashflow, 9000);
});

test("Stage A rental principal reduces cashflow while increasing property equity through lower debt", () => {
  const result = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0 }],
    liabilities: [{ id: "loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 0, repaymentAmount: 500, repaymentFrequency: "monthly", remainingTermYears: 30 }],
    propertyIncome: [{ id: "rent", linkedAssetId: "rental", linkedLoanIds: ["loan"], annualIncome: 10000, rentalCashflowTreatment: "afterInterest" }],
  });
  const property = result.years[0].properties[0];
  assert.equal(result.years[0].propertyIncome[0].netPropertyCashflow, 4000);
  assert.equal(property.linkedLoanClosingBalance, 94000);
  assert.equal(property.propertyEquity, 406000);
});

test("Stage A property equity is not accessible retirement cash", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    household: { fullRetirementLifestyleSpending: 10000 },
    scenario: { fullRetirementAnnualSpending: 10000 },
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 800000, annualGrowthRate: 0 }],
  });
  assert.equal(result.years[0].household.totalInvestableAssets, 0);
  assert.equal(result.years[0].household.totalNetWorth, 800000);
  assert.equal(result.years[0].household.unmetSpending, 10000);
});

test("Stage A property remains owned when investments are exhausted", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 0 },
    household: { fullRetirementLifestyleSpending: 10000 },
    scenario: { fullRetirementAnnualSpending: 10000 },
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 800000, annualGrowthRate: 0 }],
  });
  assert.equal(result.years.at(-1).properties[0].closingValue, 800000);
});

test("Stage A general property generates no rental cashflow unless income is supplied", () => {
  const result = project({
    assets: [{ id: "holiday", type: "otherProperty", openingValue: 300000, annualGrowthRate: 0 }],
  });
  assert.equal(result.years[0].properties[0].netPropertyCashflow, 0);
  assert.equal(result.years[0].household.netRentalCashflow, 0);
});

test("Stage A outstanding home loan increases accessible drawdown while repayments continue", () => {
  const noDebt = project({
    accessibleInvestments: { openingBalance: 100000 },
    household: { fullRetirementLifestyleSpending: 10000 },
    scenario: { fullRetirementAnnualSpending: 10000 },
  });
  const withDebt = project({
    accessibleInvestments: { openingBalance: 100000 },
    household: { fullRetirementLifestyleSpending: 10000 },
    scenario: { fullRetirementAnnualSpending: 10000 },
    liabilities: [{ id: "home", type: "homeLoan", openingBalance: 30000, interestRatePct: 0, repaymentAmount: 500, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.ok(withDebt.years[0].household.requiredAccessibleWithdrawal > noDebt.years[0].household.requiredAccessibleWithdrawal);
});

test("Stage A loan payoff improves later cashflow requirements", () => {
  const result = project({
    liabilities: [{ id: "small", type: "homeLoan", openingBalance: 6000, interestRatePct: 0, repaymentAmount: 1000, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.equal(result.years[0].household.householdCashRequirement, 6000);
  assert.equal(result.years[1].household.householdCashRequirement, 0);
});

test("Stage A positive rental property cashflow reduces household funding shortfall", () => {
  const noRent = project({
    accessibleInvestments: { openingBalance: 100000 },
    household: { fullRetirementLifestyleSpending: 20000 },
    scenario: { fullRetirementAnnualSpending: 20000 },
  });
  const withRent = project({
    accessibleInvestments: { openingBalance: 100000 },
    household: { fullRetirementLifestyleSpending: 20000 },
    scenario: { fullRetirementAnnualSpending: 20000 },
    propertyIncome: [{ id: "rent", annualIncome: 5000, rentalCashflowTreatment: "afterInterest" }],
  });
  assert.equal(withRent.years[0].household.netRentalCashflow, 5000);
  assert.equal(withRent.years[0].household.requiredAccessibleWithdrawal, noRent.years[0].household.requiredAccessibleWithdrawal - 5000);
});

test("Stage A negative property cashflow increases household funding requirement", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 100000 },
    household: { fullRetirementLifestyleSpending: 20000 },
    scenario: { fullRetirementAnnualSpending: 20000 },
    propertyIncome: [{ id: "rent", annualIncome: -5000, rentalCashflowTreatment: "afterInterest" }],
  });
  assert.equal(result.years[0].household.netRentalCashflow, -5000);
  assert.equal(result.years[0].household.requiredAccessibleWithdrawal, 25000);
});

test("Stage A changing loan balances does not directly alter accessible investments outside cashflow", () => {
  const result = project({
    accessibleInvestments: { openingBalance: 50000 },
    liabilities: [{ id: "loan", type: "homeLoan", openingBalance: 12000, interestRatePct: 0, repaymentAmount: 1000, repaymentFrequency: "monthly", remainingTermYears: 30 }],
  });
  assert.equal(result.years[0].liabilities[0].closingBalance, 0);
  assert.equal(result.years[0].household.closingAccessibleInvestmentBalance, 38000);
  assert.equal(result.years[0].household.totalInvestableAssets, 38000);
});

test("Stage A semi-retirement defaults map property data and do not double count rental income", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 60;
  plan.incomeItems = [
    { id: "salary", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
    { id: "interest", type: "interest", owner: "person1", amount: 2000, frequency: "annually" },
    { id: "rent", type: "rentalNetCashIncome", owner: "joint", amount: 10000, frequency: "annually", linkedAssetId: "rental", linkedLoanIds: ["rental-loan"], rentalCashflowTreatment: "afterInterest" },
  ];
  plan.assetItems = [{ id: "rental", category: "rentalInvestmentProperty", value: 500000 }];
  plan.liabilityItems = [{ id: "rental-loan", type: "rentalPropertyLoan", linkedAssetId: "rental", balance: 100000, interestRatePct: 0, repayment: 500, repaymentFrequency: "monthly", termYears: 30 }];
  const result = CALC.calculatePlan(plan);
  const draft = UI.buildSemiRetirementScenarioDefaults(plan, result).draft;
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.household.otherAnnualIncome, 2000);
  assert.equal(inputs.propertyIncome[0].annualIncome, 10000);
  assert.equal(inputs.propertyIncome[0].linkedAssetId, "rental");
});
