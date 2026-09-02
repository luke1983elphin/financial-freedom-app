import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadRuntime() {
  const context = { console, URLSearchParams };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);
  return context;
}

function mergeDeep(base, override) {
  if (Array.isArray(override)) return override.map((item) => mergeDeep({}, item));
  if (!override || typeof override !== "object") return override;
  const output = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = value.map((item) => mergeDeep({}, item));
    } else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      output[key] = mergeDeep(base[key], value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Person 1",
    currentAge: 55,
    currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 55,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 55,
    superAccessAge: 60,
    openingSuperBalance: 0,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 55,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 68,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 0,
      openingOffsetBalance: 0,
      annualReturnRate: 0,
      annualFeesRate: 0,
      externalAnnualAccessibleContribution: 0,
      currentAnnualContributions: 0,
    },
    assumptions: {
      principalResidenceCapitalGrowthRate: 0,
      investmentPropertyCapitalGrowthRate: 0,
    },
    people: [
      person(),
      person({
        id: "person2",
        name: "Person 2",
        currentAge: 57,
        semiRetirementAge: 57,
        fullRetirementAge: 57,
        additionalContributionsStopAge: 57,
      }),
    ],
    scenario: {
      oneOffLifestyleEvents: [],
      oneOffIncomeEvents: [],
      plannedConcessionalContributions: [],
      workingPhaseSurplusDestination: "accessible-investments",
      surplusDestination: "enjoyment",
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
      withdrawalOrder: "accessible-first",
      downsizeHomeEvent: { enabled: false },
    },
    assets: [],
    liabilities: [],
    propertyIncome: [],
    passiveIncome: [],
  }, overrides);
}

function runProjection(overrides = {}) {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const result = engine.projectRetirementScenario(baseInput(overrides));
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return result;
}

function rowForYear(result, year) {
  const row = result.years.find((entry) => entry.calendarYear === year);
  assert.ok(row, `Expected projection row for ${year}`);
  return row;
}

function personIn(row, id) {
  const entry = row.people.find((personRow) => personRow.id === id);
  assert.ok(entry, `Expected ${id} in ${row.calendarYear}`);
  return entry;
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function approxMoney(actual, expected, tolerance = 0.02) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

function deterministicDownsizeInput(overrides = {}) {
  return baseInput(mergeDeep({
    assumptions: {
      principalResidenceCapitalGrowthRate: 0.03,
      investmentPropertyCapitalGrowthRate: 0,
    },
    assets: [{
      id: "home",
      name: "Current home",
      type: "home",
      openingValue: 1000000,
      includeInNetWorth: true,
    }],
    liabilities: [{
      id: "home-loan",
      name: "Home loan",
      type: "homeLoan",
      linkedAssetId: "home",
      openingBalance: 200000,
      annualInterestRate: 0,
      repaymentAmount: 0,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      remainingTermYears: 30,
    }],
    scenario: {
      downsizeHomeEvent: {
        enabled: true,
        year: 2036,
        currentHomeSaleValueToday: 1000000,
        replacementHomeValueToday: 700000,
        saleCostRate: 0.025,
        purchaseCostRate: 0.045,
        allocation: "split",
        downsizerContributions: {
          person1: 60000,
          person2: 40000,
        },
      },
    },
  }, overrides));
}

test("Stage G2G no-event scenarios preserve previous projection output", () => {
  const withoutNewFields = runProjection({ scenario: { oneOffIncomeEvents: undefined, downsizeHomeEvent: undefined } });
  const withEmptyEvents = runProjection();
  assert.equal(JSON.stringify(withoutNewFields.years), JSON.stringify(withEmptyEvents.years));
  assert.equal(JSON.stringify(withoutNewFields.summary), JSON.stringify(withEmptyEvents.summary));
});

test("Stage G2G one-off income is inflated, added once and not treated as taxable income", () => {
  const result = runProjection({
    inflationRate: 0.1,
    scenario: {
      oneOffIncomeEvents: [{ id: "inheritance", description: "Inheritance", amountTodayDollars: 10000, year: 2028 }],
    },
  });

  assert.equal(rowForYear(result, 2027).household.oneOffIncome, 0);
  approxMoney(rowForYear(result, 2028).household.oneOffIncome, 12100);
  approxMoney(rowForYear(result, 2028).household.oneOffIncomeTodayDollars, 10000);
  approxMoney(rowForYear(result, 2028).household.accessibleInvestmentContribution, 12100);
  approxMoney(rowForYear(result, 2028).household.closingAccessibleInvestmentBalance, 12100);
  assert.equal(rowForYear(result, 2028).household.oneOffIncomeEvents.length, 1);
  assert.equal(personIn(rowForYear(result, 2028), "person1").totalTaxableIncome, 0);
  assert.equal(rowForYear(result, 2029).household.oneOffIncome, 0);
  assert.equal(result.summary.totalOneOffIncome, 12100);
  assert.equal(result.summary.totalOneOffIncomeTodayDollars, 10000);
});

test("Stage G2G multiple one-off income events are independent and summed only in their selected years", () => {
  const result = runProjection({
    scenario: {
      oneOffIncomeEvents: [
        { id: "insurance", description: "Insurance proceeds", amountTodayDollars: 5000, year: 2027 },
        { id: "refund", description: "Tax refund", amountTodayDollars: 3000, year: 2027 },
        { id: "family", description: "Family assistance", amountTodayDollars: 7000, year: 2029 },
      ],
    },
  });

  assert.equal(rowForYear(result, 2027).household.oneOffIncome, 8000);
  assert.equal(rowForYear(result, 2028).household.oneOffIncome, 0);
  assert.equal(rowForYear(result, 2029).household.oneOffIncome, 7000);
  assert.equal(result.summary.totalOneOffIncome, 15000);
});

test("Stage G2G deterministic downsizing sale, replacement purchase and allocation reconcile", () => {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const result = engine.projectRetirementScenario(deterministicDownsizeInput());
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  const row = rowForYear(result, 2036);
  const event = row.household.downsizeHomeEvent;
  const growthFactor = Math.pow(1.03, 10);
  const projectedSaleValue = roundCurrency(1000000 * growthFactor);
  const saleCosts = roundCurrency(projectedSaleValue * 0.025);
  const projectedReplacementHomeValue = roundCurrency(700000 * growthFactor);
  const purchaseCosts = roundCurrency(projectedReplacementHomeValue * 0.045);
  const netSaleProceeds = roundCurrency(projectedSaleValue - saleCosts - 200000);
  const replacementHomeCashRequirement = roundCurrency(projectedReplacementHomeValue + purchaseCosts);
  const netCashReleased = roundCurrency(netSaleProceeds - replacementHomeCashRequirement);
  const accessibleContribution = roundCurrency(netCashReleased - 100000);

  assert.equal(event.applied, true);
  approxMoney(event.projectedSaleValue, projectedSaleValue);
  approxMoney(event.saleCosts, saleCosts);
  approxMoney(event.linkedHomeDebtRepaid, 200000);
  approxMoney(event.projectedReplacementHomeValue, projectedReplacementHomeValue);
  approxMoney(event.purchaseCosts, purchaseCosts);
  approxMoney(event.netSaleProceeds, netSaleProceeds);
  approxMoney(event.replacementHomeCashRequirement, replacementHomeCashRequirement);
  approxMoney(event.netCashReleased, netCashReleased);
  approxMoney(event.downsizerContributions.person1, 60000);
  approxMoney(event.downsizerContributions.person2, 40000);
  approxMoney(event.accessibleInvestmentContribution, accessibleContribution);
  approxMoney(row.household.accessibleInvestmentContribution, accessibleContribution);
  approxMoney(row.household.closingAccessibleInvestmentBalance, accessibleContribution);
  approxMoney(personIn(row, "person1").downsizerSuperContribution, 60000);
  approxMoney(personIn(row, "person2").downsizerSuperContribution, 40000);
  approxMoney(row.household.totalSuperBalance, 100000);
  approxMoney(row.household.totalPropertyValue, projectedReplacementHomeValue);
  approxMoney(row.household.totalDebt, 0);
  approxMoney(row.liabilities.find((debt) => debt.id === "home-loan").downsizeDischargedBalance, 200000);
  assert.equal(result.summary.totalDownsizerContributions, 100000);
  approxMoney(result.summary.totalDownsizeAccessibleInvestmentContribution, accessibleContribution);
});

test("Stage G2G replacement home continues as the principal residence after downsizing", () => {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const result = engine.projectRetirementScenario(deterministicDownsizeInput());
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  const eventYear = rowForYear(result, 2036);
  const nextYear = rowForYear(result, 2037);
  const replacementValue = eventYear.household.downsizeHomeEvent.projectedReplacementHomeValue;
  const nextHome = nextYear.assets.find((asset) => asset.id === "home");

  assert.equal(nextHome.name, "Replacement home");
  approxMoney(nextHome.openingValue, replacementValue);
  approxMoney(nextHome.closingValue, roundCurrency(replacementValue * 1.03));
});

test("Stage G2G negative downsizing release does not manufacture cash and warns about any shortfall", () => {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const input = deterministicDownsizeInput({
    accessibleInvestments: { openingBalance: 10000 },
    scenario: {
      downsizeHomeEvent: {
        replacementHomeValueToday: 950000,
        allocation: "accessible-investments",
        downsizerContributions: { person1: 0, person2: 0 },
      },
    },
  });
  const result = engine.projectRetirementScenario(input);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  const event = rowForYear(result, 2036).household.downsizeHomeEvent;

  assert.ok(event.additionalFundsRequired > 0);
  assert.equal(event.accessibleInvestmentContribution, 0);
  assert.ok(event.unfundedShortfall > 0);
  assert.ok(result.warnings.some((warning) => /Downsizing requires/.test(warning)));
});

test("Stage G2G downsizer contribution validation uses the central person limit and age rule", () => {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const { DOWNSIZER_CONTRIBUTION_LIMIT } = engine;
  assert.equal(DOWNSIZER_CONTRIBUTION_LIMIT, 300000);

  const overLimit = engine.projectRetirementScenario(deterministicDownsizeInput({
    scenario: { downsizeHomeEvent: { downsizerContributions: { person1: 300001, person2: 0 } } },
  }));
  assert.equal(overLimit.validation.isValid, false);
  assert.ok(overLimit.validation.errors.some((error) => /cannot exceed/.test(error.message)));

  const underAge = engine.projectRetirementScenario(deterministicDownsizeInput({
    people: [person({ currentAge: 40, semiRetirementAge: 40, fullRetirementAge: 40 }), person({ id: "person2", currentAge: 57, semiRetirementAge: 57, fullRetirementAge: 57 })],
    scenario: { downsizeHomeEvent: { year: 2026, downsizerContributions: { person1: 1000, person2: 0 } } },
  }));
  assert.equal(underAge.validation.isValid, false);
  assert.ok(underAge.validation.errors.some((error) => /age 55/.test(error.message)));
});

test("Stage G2G UI maps one-off income and downsizing from drafts into engine inputs", () => {
  const { FFSSemiRetirementUi: ui } = loadRuntime();
  const draft = {
    projectionStartYear: 2026,
    projectionEndAge: 68,
    assumptions: { inflationRatePct: 2, principalResidenceCapitalGrowthRatePct: 3, investmentPropertyCapitalGrowthRatePct: 0 },
    household: { currentLifestyleSpending: 0, semiRetirementLifestyleSpending: 0, fullRetirementLifestyleSpending: 0, otherAnnualIncome: 0 },
    accessibleInvestments: { openingBalance: 0, openingOffsetBalance: 0, annualReturnRatePct: 0, annualFeesRatePct: 0, externalAnnualAccessibleContribution: 0 },
    people: [{ id: "person1", name: "Person 1", currentAge: 55, fullRetirementAge: 55, superAccessAge: 60 }],
    scenario: {
      oneOffIncomeEvents: [{ id: "income", description: "Inheritance", amountTodayDollars: 20000, year: 2030 }],
      downsizeHomeEvent: {
        enabled: true,
        year: 2035,
        currentHomeSaleValueToday: 1000000,
        replacementHomeValueToday: 800000,
        saleCostPct: 2.5,
        purchaseCostPct: 4.5,
        allocation: "downsizer-super",
        downsizerContributions: { person1: 250000 },
      },
    },
    assets: [{ id: "home", name: "Home", type: "home", openingValue: 1000000 }],
    liabilities: [],
    propertyIncome: [],
    passiveIncome: [],
  };
  const inputs = ui.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.scenario.oneOffIncomeEvents[0].description, "Inheritance");
  assert.equal(inputs.scenario.oneOffIncomeEvents[0].amountTodayDollars, 20000);
  assert.equal(inputs.scenario.downsizeHomeEvent.enabled, true);
  assert.equal(inputs.scenario.downsizeHomeEvent.allocation, "downsizer-super");
  assert.equal(inputs.scenario.downsizeHomeEvent.downsizerContributions.person1, 250000);
});

test("Stage G2G app preserves advanced contribution accordion state across controlled re-renders", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /semiRetirementDetailsState/);
  assert.match(appSource, /data-semi-detail-state="advancedAssumptions"/);
  assert.match(appSource, /data-semi-detail-state="plannedConcessional"/);
  assert.match(appSource, /markSemiRetirementDetailsOpen\("advancedAssumptions", "plannedConcessional"\)/);
  assert.match(appSource, /document\.addEventListener\("toggle"/);
});
