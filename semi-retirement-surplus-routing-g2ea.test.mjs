import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadEngine() {
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
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      output[key] = value.map((item) => mergeDeep({}, item));
    } else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      output[key] = mergeDeep(base[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Person 1",
    currentAge: 40,
    currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 60,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 65,
    superAccessAge: 60,
    openingSuperBalance: 0,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 60,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 66,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 80000,
      semiRetirementLifestyleSpending: 80000,
      fullRetirementLifestyleSpending: 80000,
      otherAnnualIncome: 120000,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 0,
      openingOffsetBalance: 0,
      annualReturnRate: 0,
      annualFeesRate: 0,
      externalAnnualAccessibleContribution: 10000,
    },
    people: [person()],
    scenario: {
      surplusDestination: "enjoyment",
      fullRetirementAnnualSpending: 80000,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
      withdrawalOrder: "accessible-first",
    },
    liabilities: [],
    assets: [],
    propertyIncome: [],
    passiveIncome: [],
  }, overrides);
}

function runProjection(overrides = {}) {
  const { FFSSemiRetirementProjection: engine } = loadEngine();
  const result = engine.projectRetirementScenario(baseInput(overrides));
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return result;
}

function rowForAge(result, age, personId = "person1") {
  const row = result.years.find((entry) => entry.people.some((candidate) => candidate.id === personId && candidate.age === age));
  assert.ok(row, `Expected projection row for ${personId} age ${age}`);
  return row;
}

test("Stage G2E-A legacy working surplus default preserves accessible-investment routing explicitly", () => {
  const year = rowForAge(runProjection(), 40);
  const household = year.household;

  assert.equal(year.householdPhase, "working");
  assert.equal(household.workingPhaseSurplusDestination, "accessible-investments");
  assert.equal(household.cashSurplusBeforePlannedAccessibleContribution, 40000);
  assert.equal(household.plannedExternalAccessibleContribution, 10000);
  assert.equal(household.cashSurplusBeforeAllocation, 30000);
  assert.equal(household.surplusToAccessibleInvestments, 30000);
  assert.equal(household.surplusAvailableForEnjoyment, 0);
  assert.equal(household.unallocatedSurplus, 0);
  assert.equal(household.accessibleInvestmentContribution, 40000);
  assert.equal(household.closingAccessibleInvestmentBalance, 40000);
});

test("Stage G2E-A working surplus can be routed to extra lifestyle instead of hidden investment", () => {
  const household = rowForAge(runProjection({
    scenario: { workingPhaseSurplusDestination: "enjoyment" },
  }), 40).household;

  assert.equal(household.workingPhaseSurplusDestination, "enjoyment");
  assert.equal(household.plannedExternalAccessibleContribution, 10000);
  assert.equal(household.cashSurplusBeforeAllocation, 30000);
  assert.equal(household.surplusAvailableForEnjoyment, 30000);
  assert.equal(household.surplusToAccessibleInvestments, 0);
  assert.equal(household.accessibleInvestmentContribution, 10000);
  assert.equal(household.closingAccessibleInvestmentBalance, 10000);
});

test("Stage G2E-A working surplus can be left unallocated without earning investment return", () => {
  const household = rowForAge(runProjection({
    accessibleInvestments: { annualReturnRate: 0.1 },
    scenario: { workingPhaseSurplusDestination: "unallocated" },
  }), 40).household;

  assert.equal(household.workingPhaseSurplusDestination, "unallocated");
  assert.equal(household.unallocatedSurplus, 30000);
  assert.equal(household.unallocatedSurplusClosingBalance, 30000);
  assert.equal(household.surplusToAccessibleInvestments, 0);
  assert.equal(household.closingAccessibleInvestmentBalance, 10500);
  assert.equal(household.totalAccessibleAssets, 40500);
});

test("Stage G2E-A planned working investment contribution is capped before creating a funding shortfall", () => {
  const household = rowForAge(runProjection({
    household: { otherAnnualIncome: 85000 },
    accessibleInvestments: { externalAnnualAccessibleContribution: 10000 },
  }), 40).household;

  assert.equal(household.cashSurplusBeforePlannedAccessibleContribution, 5000);
  assert.equal(household.plannedAccessibleInvestmentContributionRequested, 10000);
  assert.equal(household.plannedExternalAccessibleContribution, 5000);
  assert.equal(household.plannedExternalAccessibleContributionShortfall, 5000);
  assert.equal(household.plannedExternalAccessibleContributionWasReduced, true);
  assert.equal(household.cashSurplusOrShortfall, 0);
  assert.equal(household.requiredTotalPortfolioWithdrawal, 0);
  assert.equal(household.accessibleInvestmentContribution, 5000);
});

test("Stage G2E-A planned contribution and residual surplus are not double counted in accessible reconciliation", () => {
  const household = rowForAge(runProjection(), 40).household;
  const reconciliation = household.accessibleReconciliation;

  assert.equal(reconciliation.plannedExternalAccessibleContribution, 10000);
  assert.equal(reconciliation.surplusToAccessibleInvestments, 30000);
  assert.equal(reconciliation.plannedExternalAccessibleContribution + reconciliation.surplusToAccessibleInvestments, household.accessibleInvestmentContribution);
  assert.equal(reconciliation.expectedClosingBalance, household.closingAccessibleInvestmentBalance);
  assert.equal(reconciliation.difference, 0);
});

test("Stage G2E-A working planned contribution ceases at semi-retirement and retirement surplus setting takes over", () => {
  const result = runProjection({
    projectionEndAge: 66,
    people: [person({ currentAge: 59, semiRetirementAge: 60, fullRetirementAge: 65 })],
    scenario: {
      workingPhaseSurplusDestination: "accessible-investments",
      surplusDestination: "enjoyment",
    },
  });

  const workingRow = rowForAge(result, 59);
  const workingYear = workingRow.household;
  assert.equal(workingRow.householdPhase, "working");
  assert.equal(workingYear.accessibleInvestmentContribution, 40000);

  const semiRow = rowForAge(result, 60);
  const semiYear = semiRow.household;
  assert.equal(semiRow.householdPhase, "semi-retirement");
  assert.equal(semiYear.plannedExternalAccessibleContribution, 0);
  assert.equal(semiYear.ceasedExternalAccessibleContribution, 10000);
  assert.equal(semiYear.surplusDestination, "enjoyment");
  assert.equal(semiYear.surplusAvailableForEnjoyment, 40000);
  assert.equal(semiYear.accessibleInvestmentContribution, 0);
});

test("Stage G2E-A direct working-to-full retirement uses only the retirement surplus destination", () => {
  const year = rowForAge(runProjection({
    people: [person({ currentAge: 65, semiRetirementAge: 65, fullRetirementAge: 65 })],
    scenario: {
      workingPhaseSurplusDestination: "unallocated",
      surplusDestination: "accessible-investments",
    },
  }), 65);
  const household = year.household;

  assert.equal(year.householdPhase, "full-retirement");
  assert.equal(household.workingPhaseSurplusDestination, "unallocated");
  assert.equal(household.retirementSurplusDestination, "accessible-investments");
  assert.equal(household.plannedExternalAccessibleContribution, 0);
  assert.equal(household.surplusToAccessibleInvestments, 40000);
  assert.equal(household.accessibleInvestmentContribution, 40000);
});

test("Stage G2E-A saved scenario drafts preserve working and retirement surplus destinations separately", () => {
  const { FFSSemiRetirementProjection: engine, FFSSemiRetirementUi: ui } = loadEngine();
  const draft = {
    projectionStartYear: 2026,
    projectionEndAge: 80,
    assumptions: {
      inflationRatePct: 0,
      principalResidenceCapitalGrowthRatePct: 0,
      investmentPropertyCapitalGrowthRatePct: 0,
    },
    household: {
      currentLifestyleSpending: 80000,
      semiRetirementLifestyleSpending: 80000,
      fullRetirementLifestyleSpending: 80000,
      otherAnnualIncome: 120000,
    },
    accessibleInvestments: {
      openingBalance: 0,
      openingOffsetBalance: 0,
      annualReturnRatePct: 0,
      annualFeesRatePct: 0,
      externalAnnualAccessibleContribution: 10000,
    },
    people: [{
      id: "person1",
      name: "Person 1",
      currentAge: 40,
      currentGrossEmploymentIncome: 0,
      annualIncomeGrowthRatePct: 0,
      hasSemiRetirement: true,
      semiRetirementAge: 60,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 65,
      superAccessAge: 60,
      openingSuperBalance: 0,
      superReturnBeforeRetirementPct: 0,
      superReturnAfterRetirementPct: 0,
      superAnnualFeesRatePct: 0,
      employerSuperRatePct: 0,
      existingAdditionalConcessionalContributions: 0,
      stslOpeningBalance: 0,
      hasPrivateHealthCover: true,
    }],
    scenario: {
      workingPhaseSurplusDestination: "unallocated",
      surplusDestination: "accessible-investments",
      oneOffLifestyleEvents: [],
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
    assets: [],
    liabilities: [],
    propertyIncome: [],
    passiveIncome: [],
  };

  const inputs = ui.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.scenario.workingPhaseSurplusDestination, "unallocated");
  assert.equal(inputs.scenario.surplusDestination, "accessible-investments");

  const projection = ui.runSemiRetirementProjection(engine, draft);
  assert.equal(projection.validation.isValid, true, JSON.stringify(projection.validation.errors));
  assert.equal(rowForAge(projection.result, 40).household.workingPhaseSurplusDestination, "unallocated");
  assert.equal(rowForAge(projection.result, 65).household.retirementSurplusDestination, "accessible-investments");
});
