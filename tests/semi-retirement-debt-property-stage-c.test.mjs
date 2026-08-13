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
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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
  const inputs = baseInput(overrides);
  const result = ENGINE.projectRetirementScenario(inputs);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return result;
}

function rentalLoan(overrides = {}) {
  return {
    id: "loan",
    name: "Smith St investment property loan",
    type: "rentalPropertyLoan",
    linkedAssetId: "smith-st",
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
    id: "rent-smith-st",
    name: "Smith St rent",
    linkedAssetId: "smith-st",
    linkedLoanIds: ["loan"],
    annualIncome: 50000,
    taxableRentalIncomeAnnual: 5000,
    rentalCashflowTreatment: "afterInterest",
    ...overrides,
  };
}

function rowPerson(row, id = "person1") {
  const found = row.people.find((personRow) => personRow.id === id);
  assert.ok(found, `Expected ${id}`);
  return found;
}

function rowPropertyIncome(row, id = "rent-smith-st") {
  const found = row.propertyIncome.find((income) => income.id === id);
  assert.ok(found, `Expected ${id}`);
  return found;
}

test("Stage C passive income continues after employment stops and feeds taxable income", () => {
  const result = project({
    passiveIncome: [
      { id: "interest", type: "interest", owner: "person1", annualCashIncome: 4000, annualTaxableIncome: 4000 },
      { id: "dividends", type: "dividends", owner: "person1", annualCashIncome: 8000, annualTaxableIncome: 8000 },
      { id: "distributions", type: "distributions", owner: "person1", annualCashIncome: 3000, annualTaxableIncome: 3000 },
      { id: "rental-taxable", type: "rentalTaxableIncome", owner: "person1", annualCashIncome: 0, annualTaxableIncome: 10000 },
    ],
  });
  const firstYear = rowPerson(result.years[0]);
  const laterYear = rowPerson(result.years[3]);
  assert.equal(firstYear.grossEmploymentIncome, 0);
  assert.equal(firstYear.interestIncome, 4000);
  assert.equal(firstYear.dividendIncome, 8000);
  assert.equal(firstYear.distributionIncome, 3000);
  assert.equal(firstYear.rentalTaxableIncome, 10000);
  assert.equal(firstYear.totalTaxableIncome, 25000);
  assert.equal(laterYear.totalTaxableIncome, 25000);
  assert.ok(firstYear.incomeTax > 0, "passive taxable income should affect tax");
});

test("Stage C jointly owned passive income respects stored ownership percentages", () => {
  const result = project({
    people: [
      person({ id: "person1", name: "Luke" }),
      person({ id: "person2", name: "Sarah" }),
    ],
    passiveIncome: [
      {
        id: "joint-rent-taxable",
        type: "rentalTaxableIncome",
        owner: "joint",
        person1AllocationPercentage: 70,
        person2AllocationPercentage: 30,
        annualTaxableIncome: 20000,
      },
      {
        id: "joint-interest",
        type: "interest",
        owner: "joint",
        person1AllocationPercentage: 50,
        person2AllocationPercentage: 50,
        annualCashIncome: 4000,
        annualTaxableIncome: 4000,
      },
    ],
  });
  const p1 = rowPerson(result.years[0], "person1");
  const p2 = rowPerson(result.years[0], "person2");
  assert.equal(p1.rentalTaxableIncome, 14000);
  assert.equal(p2.rentalTaxableIncome, 6000);
  assert.equal(p1.interestIncome, 2000);
  assert.equal(p2.interestIncome, 2000);
  assert.equal(result.years[0].household.totalPassiveTaxableIncome, 24000);
});

test("Stage C passive income changes estimated tax compared with a no-passive scenario", () => {
  const withoutPassive = project();
  const withPassive = project({
    passiveIncome: [{ id: "interest", type: "interest", owner: "person1", annualCashIncome: 50000, annualTaxableIncome: 50000 }],
  });
  assert.equal(rowPerson(withoutPassive.years[0]).incomeTax, 0);
  assert.ok(rowPerson(withPassive.years[0]).incomeTax > rowPerson(withoutPassive.years[0]).incomeTax);
});

test("Stage C after-interest rental cashflow deducts principal once and keeps taxable rental income separate", () => {
  const result = project({
    assets: [{ id: "smith-st", name: "Smith St", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: 0 }],
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome({ rentalCashflowTreatment: "afterInterest" })],
    passiveIncome: [{ id: "passive-rent", type: "rentalTaxableIncome", owner: "joint", annualTaxableIncome: 5000 }],
    people: [
      person({ id: "person1", name: "Luke" }),
      person({ id: "person2", name: "Sarah" }),
    ],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.rentalCashIncome, 50000);
  assert.equal(rent.loanInterest, 24000);
  assert.equal(rent.loanPrincipal, 10000);
  assert.equal(rent.netPropertyCashflow, 40000);
  assert.equal(rent.taxableRentalIncome, 5000);
  assert.equal(rowPerson(result.years[0], "person1").rentalTaxableIncome, 2500);
  assert.equal(rowPerson(result.years[0], "person2").rentalTaxableIncome, 2500);
  assert.equal(result.years[0].household.netRentalCashflow, 40000);
});

test("Stage C before-interest rental cashflow deducts interest and principal exactly once", () => {
  const result = project({
    assets: [{ id: "smith-st", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: 0 }],
    liabilities: [rentalLoan()],
    propertyIncome: [rentalIncome({ rentalCashflowTreatment: "beforeInterest" })],
  });
  const rent = rowPropertyIncome(result.years[0]);
  assert.equal(rent.rentalCashIncome, 50000);
  assert.equal(rent.loanInterest, 24000);
  assert.equal(rent.loanPrincipal, 10000);
  assert.equal(rent.netPropertyCashflow, 16000);
});

test("Stage C rental cashflow trend is explained by CPI and loan payoff", () => {
  const result = project({
    inflationRate: 0.025,
    assets: [{ id: "smith-st", type: "rentalInvestmentProperty", openingValue: 600000, annualGrowthRatePct: 0 }],
    liabilities: [rentalLoan({ openingBalance: 10000, interestRatePct: 0 })],
    propertyIncome: [rentalIncome({ annualIncome: 50000, rentalCashflowTreatment: "afterInterest" })],
  });
  assert.equal(rowPropertyIncome(result.years[0]).netPropertyCashflow, 40000);
  assert.equal(rowPropertyIncome(result.years[1]).loanPrincipal, 0);
  assert.equal(rowPropertyIncome(result.years[1]).rentalCashIncome, 51250);
  assert.equal(rowPropertyIncome(result.years[1]).netPropertyCashflow, 51250);
});

test("Stage C UI defaults pass passive income and subtract mapped passive cash from flat other income", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 60;
  plan.assets.cash = 100000;
  plan.assetItems = [{ id: "smith-st", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 }];
  plan.liabilityItems = [rentalLoan({ id: "smith-loan", balance: 400000, repayment: 0, linkedAssetId: "smith-st" })];
  plan.incomeItems = [
    { id: "salary", name: "Salary", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
    { id: "interest", name: "Bank interest", type: "interest", owner: "person1", amount: 4000, frequency: "annually" },
    { id: "dividends", name: "Dividends", type: "dividends", owner: "person1", amount: 8000, frequency: "annually" },
    { id: "distributions", name: "Trust distributions", type: "distributions", owner: "person1", amount: 3000, frequency: "annually" },
    {
      id: "rent",
      name: "Smith St taxable rent",
      type: "rentalNetCashIncome",
      owner: "joint",
      amount: 5000,
      rentalCashIncomeAnnual: 50000,
      linkedAssetId: "smith-st",
      rentalCashflowTreatment: "afterInterest",
      person1AllocationPercentage: 50,
      person2AllocationPercentage: 50,
    },
  ];
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result).draft;
  assert.deepEqual(Array.from(defaults.propertyIncome[0].linkedLoanIds), ["smith-loan"]);
  assert.equal(defaults.propertyIncome[0].annualIncome, 50000);
  assert.equal(defaults.propertyIncome[0].taxableRentalIncomeAnnual, 5000);
  assert.deepEqual(Array.from(defaults.passiveIncome.map((item) => item.type).sort()), ["distributions", "dividends", "interest", "rentalTaxableIncome"].sort());
  assert.equal(defaults.passiveIncome.find((item) => item.type === "rentalTaxableIncome").annualCashIncome, 0);
  assert.equal(defaults.household.otherAnnualIncome, 0);
});

test("Stage C stable asset IDs auto-link multiple rental-property loans and remove stale linked loans", () => {
  const plan = {
    liabilityItems: [
      { id: "loan-a", type: "rentalPropertyLoan", linkedAssetId: "smith-st" },
      { id: "loan-b", type: "rentalPropertyLoan", linkedAssetId: "smith-st" },
      { id: "loan-c", type: "rentalPropertyLoan", linkedAssetId: "other-property" },
    ],
  };
  const linked = UI.rentalLoansLinkedToIncome(plan, {
    id: "rent",
    type: "rentalNetCashIncome",
    linkedAssetId: "smith-st",
    linkedLoanIds: ["loan-c"],
  });
  assert.deepEqual(Array.from(linked.sort()), ["loan-a", "loan-b"]);
});

test("Stage C passive defaults are applied in the app when income types are normalised", () => {
  assert.ok(appSource.includes('["interest", "dividends", "rentalNetCashIncome", "distributions"].includes(item.type)'));
  assert.ok(appSource.includes("item.isPassiveIncome = true"));
  assert.ok(appSource.includes('item.type === "salaryWages"'));
  assert.ok(appSource.includes("item.isPassiveIncome = false"));
});

test("Stage C dedicated Semi-Retirement tab is not rendered inside Decision Engine", () => {
  assert.match(indexSource, /data-view="semiretirement"/);
  assert.match(indexSource, /data-semi-retirement-nav/);
  assert.equal((indexSource.match(/id="semiRetirementScenarioRoot"/g) || []).length, 1);
  const decisionStart = indexSource.indexOf('data-view-panel="decision"');
  const scenarioStart = indexSource.indexOf('data-view-panel="semiretirement"');
  assert.ok(decisionStart >= 0 && scenarioStart > decisionStart);
  assert.equal(indexSource.slice(decisionStart, scenarioStart).includes("semiRetirementScenarioRoot"), false);
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), true);
  assert.equal(UI.setSemiRetirementProjectionEnabledForDevelopment(false), false);
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), false);
  assert.equal(UI.setSemiRetirementProjectionEnabledForDevelopment(true), true);
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), true);
  assert.match(appSource, /function updateSemiRetirementNavigation/);
});
