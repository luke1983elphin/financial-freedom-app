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
    name: "Alex",
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
    projectionEndAge: 56,
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
    assets: [
      { id: "rental", name: "Rental property", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: 0 },
    ],
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
  const inputs = baseInput(overrides);
  const result = ENGINE.projectRetirementScenario(inputs);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return { inputs, result };
}

function rentalLoan(overrides = {}) {
  return {
    id: "loan",
    name: "Rental loan",
    type: "rentalPropertyLoan",
    linkedAssetId: "rental",
    openingBalance: 400000,
    interestRatePct: 6,
    repaymentType: "interestOnly",
    additionalPrincipalRepayment: 10000,
    additionalPrincipalFrequency: "annually",
    ...overrides,
  };
}

function rentalIncome(overrides = {}) {
  return {
    id: "rent",
    name: "Rental income",
    linkedAssetId: "rental",
    linkedLoanIds: ["loan"],
    annualIncome: 50000,
    rentalCashflowTreatment: "beforeInterest",
    ...overrides,
  };
}

function property(row, id = "rental") {
  const found = row.properties.find((item) => item.id === id);
  assert.ok(found, `Expected property ${id}`);
  return found;
}

function propertyIncome(row, id = "rent") {
  const found = row.propertyIncome.find((item) => item.id === id);
  assert.ok(found, `Expected property income ${id}`);
  return found;
}

test("Stage B1A percentage-point property growth fields preserve sub-one percent values", () => {
  for (const [value, expectedRate] of [[0.5, 0.005], [0.25, 0.0025], [1, 0.01], [3, 0.03], [0, 0], [-1, -0.01]]) {
    const { result } = project({
      assets: [{ id: `rental-${value}`, type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: value }],
    });
    const asset = result.years[0].assets[0];
    assert.equal(asset.annualGrowthRate, expectedRate);
    assert.equal(asset.annualGrowthRatePct, value);
    assert.equal(asset.closingValue, Math.round((600000 * (1 + expectedRate) + Number.EPSILON) * 100) / 100);
  }
});

test("Stage B1A 0.5 percent property growth on 600,000 produces 603,000, not 900,000", () => {
  const { result } = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 600000, propertyGrowthRatePct: 0.5 }],
  });
  assert.equal(property(result.years[0]).closingValue, 603000);
});

test("Stage B1A decimal property growth fields remain decimal rates", () => {
  const { result } = project({
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRate: 0.03 }],
  });
  const asset = result.years[0].assets[0];
  assert.equal(asset.annualGrowthRate, 0.03);
  assert.equal(asset.annualGrowthRatePct, 3);
  assert.equal(property(result.years[0]).closingValue, 618000);
});

test("Stage B1A calculator property-growth helpers use explicit percent and decimal field contracts", () => {
  assert.equal(CALC.propertyGrowthRateForAsset({}, { propertyGrowthRatePct: 0.5 }), 0.005);
  assert.equal(CALC.propertyGrowthRateForAsset({}, { propertyGrowthRate: 0.03 }), 0.03);
  assert.equal(CALC.principalResidenceGrowthRateForAsset({}, { principalResidenceGrowthRatePct: 0.25 }), 0.0025);
  assert.equal(CALC.principalResidenceGrowthRateForAsset({}, { principalResidenceGrowthRate: 0.005 }), 0.005);
});

test("Stage B1A scenario percentage assumptions pass one authoritative decimal rate to the engine", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 55;
  plan.assets.cash = 100000;
  plan.assetItems = [{ id: "rental", name: "Rental property", category: "rentalInvestmentProperty", value: 600000 }];
  plan.investing.expectedInvestmentReturnPct = 0;
  plan.investing.expectedSuperReturnPct = 0;
  plan.investing.inflationPct = 0;
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, CALC.calculatePlan(plan));
  defaults.draft.assumptions.investmentPropertyCapitalGrowthRatePct = 0.5;
  const run = UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  assert.equal(run.validation.isValid, true, JSON.stringify(run.validation.errors));
  assert.equal(run.inputs.assets.find((asset) => asset.id === "rental").annualGrowthRate, 0.005);
  assert.equal(property(run.result.years[0]).closingValue, 603000);
});

test("Stage B1A zero CPI keeps rental cash income flat", () => {
  const { result } = project({
    inflationRate: 0,
    liabilities: [rentalLoan({ interestRatePct: 0, additionalPrincipalRepayment: 0 })],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "afterInterest" })],
  });
  assert.equal(propertyIncome(result.years[0]).rentalCashIncome, 50000);
  assert.equal(propertyIncome(result.years[3]).rentalCashIncome, 50000);
});

test("Stage B1A positive CPI compounds annual rental cash income by year index", () => {
  const { result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan({ interestRatePct: 0, additionalPrincipalRepayment: 0 })],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "afterInterest" })],
  });
  assert.equal(propertyIncome(result.years[0]).rentalCashIncome, 50000);
  assert.equal(propertyIncome(result.years[1]).rentalCashIncome, 51250);
  assert.equal(propertyIncome(result.years[2]).rentalCashIncome, 52531.25);
});

test("Stage B1A before-interest treatment applies CPI before deducting interest and principal once", () => {
  const { result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "beforeInterest" })],
  });
  const firstYear = propertyIncome(result.years[0]);
  assert.equal(firstYear.baseRentalCashIncome, 50000);
  assert.equal(firstYear.rentalCashIncome, 50000);
  assert.equal(firstYear.loanInterest, 24000);
  assert.equal(firstYear.loanPrincipal, 10000);
  assert.equal(firstYear.netPropertyCashflow, 16000);

  const secondYear = propertyIncome(result.years[1]);
  assert.equal(secondYear.rentalCashIncome, 51250);
  assert.equal(secondYear.loanInterest, 23400);
  assert.equal(secondYear.loanPrincipal, 10000);
  assert.equal(secondYear.netPropertyCashflow, 17850);
});

test("Stage B1A after-interest treatment applies CPI and does not deduct rental-loan interest again", () => {
  const { result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "afterInterest" })],
  });
  const secondYear = propertyIncome(result.years[1]);
  assert.equal(secondYear.rentalCashIncome, 51250);
  assert.equal(secondYear.loanInterest, 23400);
  assert.equal(secondYear.loanPrincipal, 10000);
  assert.equal(secondYear.netPropertyCashflow, 41250);
});

test("Stage B1A loan principal is deducted from the inflated rental cash amount after CPI", () => {
  const { result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan({ interestRatePct: 0, additionalPrincipalRepayment: 10000 })],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "afterInterest" })],
  });
  assert.equal(propertyIncome(result.years[1]).netPropertyCashflow, 41250);
});

test("Stage B1A rental income continues escalating after the linked loan is repaid", () => {
  const { result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan({ openingBalance: 10000, interestRatePct: 0, additionalPrincipalRepayment: 10000 })],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "afterInterest" })],
  });
  const secondYear = propertyIncome(result.years[1]);
  assert.equal(result.years[0].liabilities[0].closingBalance, 0);
  assert.equal(secondYear.rentalCashIncome, 51250);
  assert.equal(secondYear.loanInterest, 0);
  assert.equal(secondYear.loanPrincipal, 0);
  assert.equal(secondYear.netPropertyCashflow, 51250);
});

test("Stage B1A CPI-linked rent improves later cashflow and lowers accessible withdrawals through cashflow only", () => {
  const flat = project({
    inflationRate: 0,
    liabilities: [rentalLoan({ interestRatePct: 0, additionalPrincipalRepayment: 20000 })],
    propertyIncome: [rentalIncome({ annualIncome: 10000, rentalCashflowTreatment: "afterInterest" })],
  }).result;
  const cpi = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan({ interestRatePct: 0, additionalPrincipalRepayment: 20000 })],
    propertyIncome: [rentalIncome({ annualIncome: 10000, rentalCashflowTreatment: "afterInterest" })],
  }).result;
  const flatYear = flat.years[2];
  const cpiYear = cpi.years[2];
  assert.ok(propertyIncome(cpiYear).rentalCashIncome > propertyIncome(flatYear).rentalCashIncome);
  assert.ok(propertyIncome(cpiYear).netPropertyCashflow > propertyIncome(flatYear).netPropertyCashflow);
  assert.ok(cpiYear.household.requiredAccessibleWithdrawal < flatYear.household.requiredAccessibleWithdrawal);
  assert.equal(cpiYear.household.closingAccessibleInvestmentBalance - flatYear.household.closingAccessibleInvestmentBalance, 756.25);
  assert.equal(property(cpiYear).closingValue, property(flatYear).closingValue);
});

test("Stage B1A property capital growth and rental CPI growth are independent assumptions", () => {
  const { result } = project({
    inflationRate: 0.025,
    assets: [{ id: "rental", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: 3 }],
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "beforeInterest" })],
  });
  const first = result.years[0];
  const second = result.years[1];
  assert.equal(property(first).closingValue, 618000);
  assert.equal(propertyIncome(first).rentalCashIncome, 50000);
  assert.equal(property(second).closingValue, 636540);
  assert.equal(propertyIncome(second).rentalCashIncome, 51250);
  assert.equal(property(second).propertyEquity, property(second).closingValue - property(second).linkedLoanClosingBalance);
  assert.equal(second.household.totalPropertyValue, property(second).closingValue);
  assert.equal(second.household.totalPropertyEquity, property(second).propertyEquity);
});

test("Stage B1A assumptions and annual detail explain CPI-linked rental income", () => {
  const { inputs, result } = project({
    inflationRate: 0.025,
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "beforeInterest" })],
  });
  const viewModel = UI.buildSemiRetirementResultsViewModel(result, inputs, inputs);
  const rentalGrowth = viewModel.assumptions.rows.find((row) => row.label === "Rental cash income growth");
  assert.equal(rentalGrowth.value, "CPI");
  assert.match(rentalGrowth.note, /2.5%/);
  assert.match(result.assumptions.rentalIncomeTreatment, /CPI-escalated each projection year/);
  assert.match(appSource, /Base rental cash income/);
  assert.match(appSource, /Rental cash income growth/);
});
