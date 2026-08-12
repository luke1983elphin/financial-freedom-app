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
    name: "Luke",
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
      externalAnnualAccessibleContribution: 0,
    },
    assets: [
      { id: "smith-st", name: "Smith St", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: 0 },
    ],
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome()],
    passiveIncome: [],
    people: [
      person({ id: "person1", name: "Luke" }),
      person({ id: "person2", name: "Sarah" }),
    ],
    scenario: {
      semiRetirementAccessibleWithdrawal: 0,
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
  }, overrides);
}

function project(overrides = {}) {
  const inputs = baseInput(overrides);
  const result = ENGINE.projectRetirementScenario(inputs);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return { inputs, result };
}

function rentalLoan(overrides = {}) {
  return {
    id: "smith-loan",
    name: "Smith St loan",
    type: "rentalPropertyLoan",
    linkedAssetId: "smith-st",
    openingBalance: 400000,
    interestRatePct: 5,
    repaymentType: "interestOnly",
    additionalPrincipalRepayment: 10000,
    additionalPrincipalFrequency: "annually",
    ...overrides,
  };
}

function rentalIncome(overrides = {}) {
  return {
    id: "rent-smith-st",
    name: "Smith St",
    linkedAssetId: "smith-st",
    linkedLoanIds: ["smith-loan"],
    annualIncome: 38000,
    taxableRentalIncomeAnnual: 5000,
    rentalCashflowTreatment: "afterInterest",
    ...overrides,
  };
}

function missingRentalCashIncome(overrides = {}) {
  const income = rentalIncome({
    amount: 5000,
    annualIncome: undefined,
    taxableRentalIncomeAnnual: 5000,
    rentalCashflowTreatment: "afterInterest",
    ...overrides,
  });
  delete income.annualIncome;
  return income;
}

function rowPropertyIncome(row, id = "rent-smith-st") {
  const found = row.propertyIncome.find((income) => income.id === id);
  assert.ok(found, `Expected property income ${id}`);
  return found;
}

function rowProperty(row, id = "smith-st") {
  const found = row.properties.find((property) => property.id === id);
  assert.ok(found, `Expected property ${id}`);
  return found;
}

function rowPerson(row, id) {
  const found = row.people.find((personRow) => personRow.id === id);
  assert.ok(found, `Expected ${id}`);
  return found;
}

test("Stage C1 taxable rental amount is never used as fallback rental cash income", () => {
  const { result } = project({ propertyIncome: [missingRentalCashIncome()] });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.taxableRentalIncome, 5000);
  assert.equal(rent.rentalCashIncome, null);
  assert.equal(rent.baseRentalCashIncome, null);
  assert.equal(rent.netPropertyCashflow, 0);
});

test("Stage C1 missing rental cash income returns a structured warning state", () => {
  const { result } = project({ propertyIncome: [missingRentalCashIncome()] });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.warnings[0].code, "RENTAL_CASH_INCOME_REQUIRED");
  assert.equal(rent.warnings[0].incomeId, "rent-smith-st");
  assert.equal(rent.warnings[0].linkedAssetId, "smith-st");
  assert.match(result.years[0].warnings[0], /Rental cash income required for Smith St/);
});

test("Stage C1 taxable rental ownership allocation continues independently of cash income", () => {
  const { result } = project({
    propertyIncome: [missingRentalCashIncome()],
    passiveIncome: [{
      id: "passive-rent",
      type: "rentalTaxableIncome",
      owner: "joint",
      person1AllocationPercentage: 50,
      person2AllocationPercentage: 50,
      annualTaxableIncome: 5000,
    }],
  });
  assert.equal(rowPerson(result.years[0], "person1").rentalTaxableIncome, 2500);
  assert.equal(rowPerson(result.years[0], "person2").rentalTaxableIncome, 2500);
});

test("Stage C1 valid after-interest cash income deducts principal only", () => {
  const { result } = project({
    propertyIncome: [rentalIncome({ annualIncome: 30000, rentalCashflowTreatment: "afterInterest" })],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.rentalCashIncome, 30000);
  assert.equal(rent.loanInterest, 20000);
  assert.equal(rent.loanPrincipal, 10000);
  assert.equal(rent.netPropertyCashflow, 20000);
});

test("Stage C1 valid before-interest cash income deducts interest and principal once", () => {
  const { result } = project({
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "beforeInterest" })],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.rentalCashIncome, 50000);
  assert.equal(rent.loanInterest, 20000);
  assert.equal(rent.loanPrincipal, 10000);
  assert.equal(rent.netPropertyCashflow, 20000);
});

test("Stage C1 CPI continues to compound valid rental cash income", () => {
  const { result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan({ interestRatePct: 0, additionalPrincipalRepayment: 0 })],
    propertyIncome: [rentalIncome({ annualIncome: 38000, rentalCashflowTreatment: "afterInterest" })],
  });
  assert.equal(rowPropertyIncome(result.years[0]).rentalCashIncome, 38000);
  assert.equal(rowPropertyIncome(result.years[1]).rentalCashIncome, 38950);
});

test("Stage C1 principal reduces cashflow only under after-interest treatment", () => {
  const { result } = project({
    propertyIncome: [rentalIncome({ annualIncome: 38000, rentalCashflowTreatment: "afterInterest" })],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.interestAlreadyIncluded, true);
  assert.equal(rent.netPropertyCashflow, 28000);
});

test("Stage C1 interest is deducted exactly once under before-interest treatment", () => {
  const { result } = project({
    propertyIncome: [rentalIncome({ annualIncome: 38000, rentalCashflowTreatment: "beforeInterest" })],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.interestAlreadyIncluded, false);
  assert.equal(rent.incomeAfterInterest, 18000);
  assert.equal(rent.netPropertyCashflow, 8000);
});

test("Stage C1 household property cashflow is counted once", () => {
  const { result } = project({
    propertyIncome: [rentalIncome({ annualIncome: 38000, rentalCashflowTreatment: "afterInterest" })],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(result.years[0].household.netRentalCashflow, rent.netPropertyCashflow);
  assert.equal(result.years[0].household.netHouseholdCashIncome, rent.netPropertyCashflow);
});

test("Stage C1 auto-linked property and loan behaviour remains intact", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 60;
  plan.assets.cash = 100000;
  plan.assetItems = [{ id: "smith-st", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 }];
  plan.liabilityItems = [rentalLoan({ id: "smith-loan", balance: 400000, repayment: 0, linkedAssetId: "smith-st" })];
  plan.incomeItems = [{
    id: "rent",
    name: "Smith St taxable rent",
    type: "rentalNetCashIncome",
    owner: "joint",
    amount: 5000,
    rentalCashIncomeAnnual: 38000,
    linkedAssetId: "smith-st",
    rentalCashflowTreatment: "afterInterest",
  }];
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, CALC.calculatePlan(plan)).draft;
  assert.deepEqual(Array.from(defaults.propertyIncome[0].linkedLoanIds), ["smith-loan"]);
  assert.equal(defaults.propertyIncome[0].annualIncome, 38000);
});

test("Stage C1 legacy rental records load without destructive migration or taxable-to-cash copy", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 60;
  plan.assets.cash = 100000;
  plan.assetItems = [{ id: "smith-st", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 }];
  plan.incomeItems = [{
    id: "rent",
    name: "Smith St taxable rent",
    type: "rentalNetCashIncome",
    owner: "joint",
    amount: 5000,
    linkedAssetId: "smith-st",
    rentalCashflowTreatment: "afterInterest",
  }];
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, CALC.calculatePlan(plan)).draft;
  assert.equal(plan.incomeItems[0].amount, 5000);
  assert.equal(defaults.propertyIncome[0].taxableRentalIncomeAnnual, 5000);
  assert.equal(defaults.propertyIncome[0].annualIncome, null);
  assert.equal(defaults.propertyIncome[0].missingRentalCashIncome, true);
});

test("Stage C1 retirement result changes only when valid rental cashflow is supplied", () => {
  const commonPassiveTax = [{
    id: "passive-rent",
    type: "rentalTaxableIncome",
    owner: "joint",
    person1AllocationPercentage: 50,
    person2AllocationPercentage: 50,
    annualTaxableIncome: 5000,
  }];
  const missing = project({
    household: { currentLifestyleSpending: 25000 },
    propertyIncome: [missingRentalCashIncome()],
    passiveIncome: commonPassiveTax,
  }).result;
  const supplied = project({
    household: { currentLifestyleSpending: 25000 },
    propertyIncome: [rentalIncome({ annualIncome: 38000, rentalCashflowTreatment: "afterInterest" })],
    passiveIncome: commonPassiveTax,
  }).result;
  assert.equal(rowPerson(missing.years[0], "person1").rentalTaxableIncome, rowPerson(supplied.years[0], "person1").rentalTaxableIncome);
  assert.equal(missing.years[0].household.netRentalCashflow, 0);
  assert.equal(supplied.years[0].household.netRentalCashflow, 28000);
  assert.ok(supplied.years[0].household.closingAccessibleInvestmentBalance > missing.years[0].household.closingAccessibleInvestmentBalance);
});

test("Stage C1 UI copy no longer advertises taxable fallback", () => {
  assert.equal(appSource.includes("Leave blank to use taxable amount as fallback"), false);
  assert.match(appSource, /Required for semi-retirement cashflow/);
});
