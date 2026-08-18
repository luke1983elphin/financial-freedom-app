import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadProjectionEngine() {
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
  return {
    CALC: context.FFSCalculator,
    ENGINE: context.FFSSemiRetirementProjection,
  };
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

function person1(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Person 1",
    currentAge: 50,
    currentGrossEmploymentIncome: 100000,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 55,
    semiRetirementGrossIncome: 50000,
    fullRetirementAge: 60,
    superAccessAge: 60,
    openingSuperBalance: 100000,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0.12,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 55,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function person2(overrides = {}) {
  return mergeDeep({
    id: "person2",
    name: "Person 2",
    currentAge: 50,
    currentGrossEmploymentIncome: 80000,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 60,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 60,
    superAccessAge: 60,
    openingSuperBalance: 80000,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0.12,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 60,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 65,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 70000,
      semiRetirementLifestyleSpending: 70000,
      fullRetirementLifestyleSpending: 70000,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 500000,
      annualReturnRate: 0,
      annualFeesRate: 0,
      currentAnnualContributions: 0,
    },
    people: [person1(), person2()],
    scenario: {
      semiRetirementAccessibleWithdrawal: 0,
      fullRetirementAnnualSpending: 70000,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
  }, overrides);
}

function zeroIncomePeople(extra = {}) {
  return [
    person1({
      currentGrossEmploymentIncome: 0,
      semiRetirementAge: 50,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 50,
      openingSuperBalance: 0,
      employerSuperRate: 0,
      ...extra.person1,
    }),
    person2({
      currentGrossEmploymentIncome: 0,
      semiRetirementAge: 50,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 50,
      openingSuperBalance: 0,
      employerSuperRate: 0,
      ...extra.person2,
    }),
  ];
}

function runProjection(overrides = {}) {
  const { ENGINE } = loadProjectionEngine();
  return ENGINE.projectRetirementScenario(baseInput(overrides));
}

function rowForAge(result, age, personId = "person1") {
  const row = result.years.find((year) => year.people.some((person) => person.id === personId && person.age === age));
  assert.ok(row, `Expected projection row for ${personId} at age ${age}`);
  return row;
}

function person(row, personId) {
  const value = row.people.find((entry) => entry.id === personId);
  assert.ok(value, `Expected ${personId} in projection row`);
  return value;
}

function approx(actual, expected, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertAccessibleReconciliation(row) {
  assert.equal(row.household.accessibleReconciliation.difference, 0);
  assert.equal(row.household.accessibleReconciliation.closingBalance, row.household.closingAccessibleInvestmentBalance);
}

function assertSuperReconciliation(row) {
  row.people.forEach((entry) => {
    assert.equal(entry.superReconciliation.difference, 0, `${entry.id} super reconciliation should balance`);
    assert.equal(entry.superReconciliation.closingBalance, entry.closingSuperBalance);
  });
}

test("semi-retirement projection is enabled by default for normal users", () => {
  const { ENGINE } = loadProjectionEngine();
  assert.equal(ENGINE.featureFlags.semiRetirementProjectionEnabled, true);
  assert.equal(typeof ENGINE.projectRetirementScenario, "function");
});

test("validation rejects impossible ages, duplicate people and return rates below -100%", () => {
  const { ENGINE } = loadProjectionEngine();
  const invalid = baseInput({
    accessibleInvestments: { annualReturnRate: -1.01 },
    people: [
      person1({ id: "duplicate", semiRetirementAge: 49 }),
      person2({ id: "duplicate" }),
    ],
  });

  const result = ENGINE.projectRetirementScenario(invalid);

  assert.equal(result.validation.isValid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "people.0.semiRetirementAge"));
  assert.ok(result.validation.errors.some((error) => error.path === "people.1.id"));
  assert.ok(result.validation.errors.some((error) => error.path === "accessibleInvestments.annualReturnRate"));
  assert.equal(result.years.length, 0);
});

test("no-semi-retirement scenarios stay full-time until full retirement", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 60, semiRetirementGrossIncome: 0 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0 }),
    ],
  });

  const age55 = rowForAge(result, 55);
  assert.equal(person(age55, "person1").employmentPhase, "full-time");
  assert.equal(person(age55, "person1").grossEmploymentIncome, 100000);
  assert.equal(person(age55, "person2").employmentPhase, "full-time");
  assert.equal(person(age55, "person2").grossEmploymentIncome, 80000);

  const age60 = rowForAge(result, 60);
  assert.equal(age60.householdPhase, "full-retirement");
  assert.equal(person(age60, "person1").grossEmploymentIncome, 0);
  assert.equal(person(age60, "person1").employerSuperContribution, 0);
  assert.equal(result.summary.totalPlannedSemiRetirementWithdrawals, 0);
});

test("one person can semi-retire while the other remains full-time", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 52, semiRetirementGrossIncome: 50000 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0 }),
    ],
  });

  const age52 = rowForAge(result, 52);
  assert.equal(age52.householdPhase, "semi-retirement");
  assert.equal(person(age52, "person1").employmentPhase, "semi-retired");
  assert.equal(person(age52, "person1").grossEmploymentIncome, 50000);
  assert.equal(person(age52, "person1").employerSuperContribution, 6000);
  assert.equal(person(age52, "person2").employmentPhase, "full-time");
  assert.equal(person(age52, "person2").employerSuperContribution, 9600);
});

test("two people can use different semi and full retirement ages", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 52, semiRetirementGrossIncome: 40000, fullRetirementAge: 55, superAccessAge: 60 }),
      person2({ semiRetirementAge: 58, semiRetirementGrossIncome: 30000, fullRetirementAge: 62, superAccessAge: 62 }),
    ],
    projectionEndAge: 64,
  });

  const p1Age56 = rowForAge(result, 56);
  assert.equal(person(p1Age56, "person1").employmentPhase, "fully-retired");
  assert.equal(person(p1Age56, "person2").employmentPhase, "full-time");

  const p2Age59 = rowForAge(result, 59, "person2");
  assert.equal(person(p2Age59, "person1").employmentPhase, "fully-retired");
  assert.equal(person(p2Age59, "person2").employmentPhase, "semi-retired");

  const p2Age62 = rowForAge(result, 62, "person2");
  assert.equal(person(p2Age62, "person2").employmentPhase, "fully-retired");
  assert.equal(p2Age62.householdPhase, "full-retirement");
});

test("household semi-retirement starts when one person is fully retired and the other remains full-time", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 52, semiRetirementGrossIncome: 0, fullRetirementAge: 52, superAccessAge: 60 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60 }),
    ],
    household: {
      currentLifestyleSpending: 10000,
      semiRetirementLifestyleSpending: 20000,
      fullRetirementLifestyleSpending: 30000,
    },
    scenario: { semiRetirementAccessibleWithdrawal: 5000, fullRetirementAnnualSpending: 30000 },
  });

  const age52 = rowForAge(result, 52);
  assert.equal(person(age52, "person1").employmentPhase, "fully-retired");
  assert.equal(person(age52, "person2").employmentPhase, "full-time");
  assert.equal(age52.householdPhase, "semi-retirement");
  assert.equal(age52.household.applicableLifestyleSpending, 20000);
  assert.equal(age52.household.plannedSemiRetirementWithdrawalRequested, 5000);
});

test("household working phase applies only while all people are full-time", () => {
  const result = runProjection({
    household: {
      currentLifestyleSpending: 11000,
      semiRetirementLifestyleSpending: 22000,
      fullRetirementLifestyleSpending: 33000,
    },
    scenario: { fullRetirementAnnualSpending: 33000 },
  });

  const firstYear = rowForAge(result, 50);
  assert.equal(firstYear.householdPhase, "working");
  assert.equal(firstYear.household.householdPhase, "working");
  assert.equal(firstYear.household.applicableLifestyleSpending, 11000);
});

test("household full-retirement phase applies only once all people are fully retired", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 55, semiRetirementGrossIncome: 50000, fullRetirementAge: 60 }),
      person2({ semiRetirementAge: 55, semiRetirementGrossIncome: 40000, fullRetirementAge: 60 }),
    ],
    household: {
      currentLifestyleSpending: 10000,
      semiRetirementLifestyleSpending: 20000,
      fullRetirementLifestyleSpending: 30000,
    },
    scenario: { semiRetirementAccessibleWithdrawal: 5000, fullRetirementAnnualSpending: 30000 },
  });

  const age60 = rowForAge(result, 60);
  assert.equal(age60.householdPhase, "full-retirement");
  assert.equal(age60.household.applicableLifestyleSpending, 30000);
  assert.equal(age60.household.plannedSemiRetirementWithdrawalRequested, 0);
  assert.equal(result.summary.firstFullRetirement.calendarYear, 2036);
  assert.equal(result.summary.firstFullRetirement.person1Age, 60);
  assert.equal(result.summary.firstFullRetirement.person2Age, 60);
  assert.equal(result.summary.householdFullRetirement.calendarYear, 2036);
  assert.equal(result.summary.householdFullRetirement.person1Age, 60);
  assert.equal(result.summary.householdFullRetirement.person2Age, 60);
});

test("older person does not trigger the younger person's retirement age milestone", () => {
  const result = runProjection({
    projectionEndAge: 70,
    people: [
      person1({ currentAge: 65, currentGrossEmploymentIncome: 100000, semiRetirementAge: 67, fullRetirementAge: 67, superAccessAge: 67 }),
      person2({ currentAge: 50, currentGrossEmploymentIncome: 80000, semiRetirementAge: 60, fullRetirementAge: 60, superAccessAge: 60 }),
    ],
  });

  const firstYear = result.years[0];
  assert.equal(person(firstYear, "person1").employmentPhase, "full-time");
  assert.equal(person(firstYear, "person2").employmentPhase, "full-time");
  assert.notEqual(result.summary.firstPersonFullRetirement.calendarYear, 2026);
  assert.equal(result.summary.firstPersonFullRetirement.calendarYear, 2028);
  assert.equal(result.summary.firstPersonFullRetirement.person1Age, 67);
  assert.equal(result.summary.firstPersonFullRetirement.person2Age, 52);
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds.length, 1);
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds[0], "person1");
});

test("first person full retirement identifies the actual retired person", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 55, semiRetirementGrossIncome: 0, fullRetirementAge: 55 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60 }),
    ],
  });

  assert.equal(result.summary.firstPersonFullRetirement.calendarYear, 2031);
  assert.equal(result.summary.firstPersonFullRetirement.person1Age, 55);
  assert.equal(result.summary.firstPersonFullRetirement.person2Age, 55);
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds.length, 1);
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds[0], "person1");
});

test("both people retiring in the same year records both retired person IDs", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60 }),
    ],
  });

  assert.equal(result.summary.firstPersonFullRetirement.calendarYear, 2036);
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds.length, 2);
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds[0], "person1");
  assert.equal(result.summary.firstPersonFullRetirement.retiredPersonIds[1], "person2");
  assert.equal(result.summary.householdFullRetirement.calendarYear, 2036);
});

test("first person and household full-retirement milestones can occur in different years", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 55, semiRetirementGrossIncome: 0, fullRetirementAge: 55 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60 }),
    ],
  });

  assert.equal(result.summary.firstPersonFullRetirement.calendarYear, 2031);
  assert.equal(result.summary.householdFullRetirement.calendarYear, 2036);
  assert.notEqual(result.summary.firstPersonFullRetirement.calendarYear, result.summary.householdFullRetirement.calendarYear);
});

test("accessible balance at first person's full retirement uses the correct milestone year", () => {
  const result = runProjection({
    people: [
      person1({ semiRetirementAge: 55, semiRetirementGrossIncome: 0, fullRetirementAge: 55 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60 }),
    ],
  });

  const milestoneRow = rowForAge(result, 55, "person1");
  assert.equal(result.summary.firstPersonFullRetirement.calendarYear, milestoneRow.calendarYear);
  assert.equal(
    result.summary.accessibleBalanceAtFirstPersonFullRetirement,
    milestoneRow.household.closingAccessibleInvestmentBalance,
  );
  assert.equal(
    result.summary.accessibleBalanceAtFirstFullRetirement,
    result.summary.accessibleBalanceAtFirstPersonFullRetirement,
  );
});

test("super at age 60 is recorded separately for people with different current ages", () => {
  const result = runProjection({
    projectionEndAge: 62,
    people: [
      person1({ currentAge: 58, semiRetirementAge: 62, semiRetirementGrossIncome: 0, fullRetirementAge: 62, superAccessAge: 62 }),
      person2({ currentAge: 55, semiRetirementAge: 62, semiRetirementGrossIncome: 0, fullRetirementAge: 62, superAccessAge: 62 }),
    ],
  });

  const p1Age60 = rowForAge(result, 60, "person1");
  const p2Age60 = rowForAge(result, 60, "person2");
  assert.equal(result.summary.superByPersonAtAge60.person1, person(p1Age60, "person1").closingSuperBalance);
  assert.equal(result.summary.superByPersonAtAge60.person2, person(p2Age60, "person2").closingSuperBalance);
  assert.equal(
    result.summary.totalSuperAtAge60,
    result.summary.superByPersonAtAge60.person1 + result.summary.superByPersonAtAge60.person2,
  );
});

test("person already older than 60 at projection start does not receive an inferred age-60 super value", () => {
  const result = runProjection({
    projectionEndAge: 65,
    people: [
      person1({ currentAge: 65, semiRetirementAge: 67, semiRetirementGrossIncome: 0, fullRetirementAge: 67, superAccessAge: 67 }),
      person2({ currentAge: 55, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60 }),
    ],
  });

  assert.equal(result.summary.superByPersonAtAge60.person1, null);
  assert.equal(result.summary.superByPersonAtAge60.person2, person(rowForAge(result, 60, "person2"), "person2").closingSuperBalance);
  assert.equal(result.summary.totalSuperAtAge60, null);
  assert.ok(result.warnings.some((warning) => warning.includes("older than 60")));
});

test("super at assumed access age remains separate from super at age 60", () => {
  const result = runProjection({
    projectionEndAge: 62,
    people: [
      person1({ currentAge: 58, semiRetirementAge: 62, semiRetirementGrossIncome: 0, fullRetirementAge: 62, superAccessAge: 62 }),
    ],
  });

  assert.equal(result.summary.superByPersonAtAge60.person1, person(rowForAge(result, 60), "person1").closingSuperBalance);
  assert.equal(result.summary.superByPersonAtAccessAge.person1, person(rowForAge(result, 62), "person1").closingSuperBalance);
  assert.notEqual(result.summary.superByPersonAtAge60.person1, result.summary.superByPersonAtAccessAge.person1);
});

test("projection end age is applied to the youngest person in a couple", () => {
  const result = runProjection({
    projectionEndAge: 90,
    people: [
      person1({ currentAge: 50, fullRetirementAge: 60, semiRetirementAge: 60, superAccessAge: 60 }),
      person2({ currentAge: 45, fullRetirementAge: 60, semiRetirementAge: 60, superAccessAge: 60 }),
    ],
  });

  const finalYear = result.years.at(-1);
  assert.equal(finalYear.person1Age, 95);
  assert.equal(finalYear.person2Age, 90);
  assert.equal(result.assumptions.projectionHorizonYears, 45);
  assert.equal(result.assumptions.projectedEndAgesByPerson.person1, 95);
  assert.equal(result.assumptions.projectedEndAgesByPerson.person2, 90);
});

test("accessible exhaustion milestone reports calendar year and both ages", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 50, currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
      person2({ currentAge: 45, currentGrossEmploymentIncome: 0, semiRetirementAge: 45, fullRetirementAge: 45, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 20000,
      semiRetirementLifestyleSpending: 20000,
      fullRetirementLifestyleSpending: 20000,
    },
    scenario: { fullRetirementAnnualSpending: 20000 },
    accessibleInvestments: { openingBalance: 10000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(result.summary.accessibleFundsExhausted.calendarYear, 2026);
  assert.equal(result.summary.accessibleFundsExhausted.person1Age, 50);
  assert.equal(result.summary.accessibleFundsExhausted.person2Age, 45);
  assert.equal(result.summary.accessibleFundsExhaustedAge, 50);
});

test("first unfunded spending milestone reports calendar year and both ages", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 50, currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
      person2({ currentAge: 45, currentGrossEmploymentIncome: 0, semiRetirementAge: 45, fullRetirementAge: 45, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 50000,
      semiRetirementLifestyleSpending: 50000,
      fullRetirementLifestyleSpending: 50000,
    },
    scenario: { fullRetirementAnnualSpending: 50000 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(result.summary.firstUnfundedSpending.calendarYear, 2028);
  assert.equal(result.summary.firstUnfundedSpending.person1Age, 52);
  assert.equal(result.summary.firstUnfundedSpending.person2Age, 47);
});

test("external accessible contribution is added once on top of household surplus", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: zeroIncomePeople({
      person1: { semiRetirementAge: 55, fullRetirementAge: 60 },
      person2: { semiRetirementAge: 55, fullRetirementAge: 60 },
    }),
    household: {
      currentLifestyleSpending: 40000,
      semiRetirementLifestyleSpending: 40000,
      fullRetirementLifestyleSpending: 40000,
      otherAnnualIncome: 50000,
    },
    scenario: { fullRetirementAnnualSpending: 40000 },
    accessibleInvestments: {
      openingBalance: 100000,
      annualReturnRate: 0,
      annualFeesRate: 0,
      externalAnnualAccessibleContribution: 5000,
    },
  });

  const firstYear = result.years[0];
  assert.equal(firstYear.household.cashSurplusOrShortfall, 10000);
  assert.equal(firstYear.household.householdSurplusAccessibleContribution, 10000);
  assert.equal(firstYear.household.externalAnnualAccessibleContribution, 5000);
  assert.equal(firstYear.household.accessibleInvestmentContribution, 15000);
  assert.equal(firstYear.household.closingAccessibleInvestmentBalance, 115000);
  assert.ok(result.warnings.some((warning) => warning.includes("External annual accessible contribution")));
});

test("household cash surplus flows into accessible investments once when no external contribution is set", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: zeroIncomePeople({
      person1: { semiRetirementAge: 55, fullRetirementAge: 60 },
      person2: { semiRetirementAge: 55, fullRetirementAge: 60 },
    }),
    household: {
      currentLifestyleSpending: 40000,
      semiRetirementLifestyleSpending: 40000,
      fullRetirementLifestyleSpending: 40000,
      otherAnnualIncome: 50000,
    },
    scenario: { fullRetirementAnnualSpending: 40000 },
    accessibleInvestments: {
      openingBalance: 100000,
      annualReturnRate: 0,
      annualFeesRate: 0,
    },
  });

  const firstYear = result.years[0];
  assert.equal(firstYear.household.cashSurplusOrShortfall, 10000);
  assert.equal(firstYear.household.accessibleInvestmentContribution, 10000);
  assert.equal(firstYear.household.closingAccessibleInvestmentBalance, 110000);
});

test("unsupported withdrawal order is rejected instead of being silently ignored", () => {
  const result = runProjection({
    scenario: { withdrawalOrder: "super-first" },
  });

  assert.equal(result.validation.isValid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "scenario.withdrawalOrder"));
});

test("semi-retirement starts exactly at the selected age boundary", () => {
  const result = runProjection({
    people: [
      person1({ currentAge: 49, semiRetirementAge: 50, semiRetirementGrossIncome: 40000, fullRetirementAge: 60 }),
    ],
    projectionEndAge: 60,
  });

  assert.equal(person(rowForAge(result, 49), "person1").employmentPhase, "full-time");
  assert.equal(person(rowForAge(result, 50), "person1").employmentPhase, "semi-retired");
});

test("full retirement starts exactly at the selected age boundary", () => {
  const result = runProjection({
    people: [
      person1({ currentAge: 49, semiRetirementAge: 50, semiRetirementGrossIncome: 40000, fullRetirementAge: 51 }),
    ],
    projectionEndAge: 55,
  });

  assert.equal(person(rowForAge(result, 50), "person1").employmentPhase, "semi-retired");
  assert.equal(person(rowForAge(result, 51), "person1").employmentPhase, "fully-retired");
  assert.equal(person(rowForAge(result, 51), "person1").grossEmploymentIncome, 0);
});

test("super access starts exactly at the selected access age boundary", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 59, currentGrossEmploymentIncome: 0, semiRetirementAge: 59, fullRetirementAge: 59, superAccessAge: 60, openingSuperBalance: 50000, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 30000,
      semiRetirementLifestyleSpending: 30000,
      fullRetirementLifestyleSpending: 30000,
    },
    scenario: { fullRetirementAnnualSpending: 30000 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(person(rowForAge(result, 59), "person1").superWithdrawal, 0);
  assert.equal(rowForAge(result, 59).household.unmetSpending, 30000);
  assert.equal(person(rowForAge(result, 60), "person1").superWithdrawal, 30000);
  assert.equal(result.summary.firstYearAllPeopleSuperAccessible.calendarYear, 2027);
  assert.equal(result.summary.firstYearAllPeopleSuperAccessible.person1Age, 60);
  assert.equal(result.summary.firstYearAllPeopleSuperAccessible.person2Age, null);
});

test("zero-return accessible investment reconciliation balances exactly", () => {
  const result = runProjection({
    accessibleInvestments: { annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 5000 },
  });

  result.years.forEach(assertAccessibleReconciliation);
});

test("zero-return super reconciliation balances exactly for each person", () => {
  const result = runProjection({
    people: [
      person1({ superReturnBeforeRetirement: 0, superReturnAfterRetirement: 0, superAnnualFeesRate: 0 }),
      person2({ superReturnBeforeRetirement: 0, superReturnAfterRetirement: 0, superAnnualFeesRate: 0 }),
    ],
  });

  result.years.forEach(assertSuperReconciliation);
});

test("lower semi-retirement income reduces employer super and final investable assets", () => {
  const noSemi = runProjection({
    people: [
      person1({ semiRetirementAge: 60, semiRetirementGrossIncome: 0 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0 }),
    ],
  });
  const semi = runProjection({
    people: [
      person1({ semiRetirementAge: 52, semiRetirementGrossIncome: 40000 }),
      person2({ semiRetirementAge: 60, semiRetirementGrossIncome: 0 }),
    ],
  });

  assert.ok(person(rowForAge(semi, 52), "person1").employerSuperContribution < person(rowForAge(noSemi, 52), "person1").employerSuperContribution);
  assert.ok(semi.summary.superByPersonAtAge60.person1 < noSemi.summary.superByPersonAtAge60.person1);
  assert.ok(semi.summary.totalInvestableAssetsAtEndAge < noSemi.summary.totalInvestableAssetsAtEndAge);
});

test("positive cash surplus is added to accessible investments", () => {
  const result = runProjection({
    household: {
      currentLifestyleSpending: 10000,
      semiRetirementLifestyleSpending: 10000,
      fullRetirementLifestyleSpending: 10000,
    },
    scenario: { fullRetirementAnnualSpending: 10000 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  const firstYear = result.years[0];
  assert.ok(firstYear.household.cashSurplusOrShortfall > 0);
  assert.equal(firstYear.household.accessibleInvestmentContribution, firstYear.household.cashSurplusOrShortfall);
  approx(
    firstYear.household.closingAccessibleInvestmentBalance,
    firstYear.household.openingAccessibleInvestmentBalance + firstYear.household.accessibleInvestmentContribution,
  );
});

test("cash shortfalls draw down accessible investments before super", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: zeroIncomePeople(),
    household: {
      currentLifestyleSpending: 20000,
      semiRetirementLifestyleSpending: 20000,
      fullRetirementLifestyleSpending: 20000,
    },
    scenario: { fullRetirementAnnualSpending: 20000 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  const firstYear = result.years[0];
  assert.equal(firstYear.household.requiredAccessibleWithdrawal, 20000);
  assert.equal(firstYear.household.totalSuperWithdrawal, 0);
  assert.equal(firstYear.household.closingAccessibleInvestmentBalance, 80000);
});

test("planned semi-retirement withdrawals are separate from lifestyle shortfall withdrawals", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentGrossEmploymentIncome: 0, semiRetirementAge: 50, semiRetirementGrossIncome: 0, fullRetirementAge: 60, openingSuperBalance: 0 }),
      person2({ currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, openingSuperBalance: 0 }),
    ],
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
    },
    scenario: { semiRetirementAccessibleWithdrawal: 20000, fullRetirementAnnualSpending: 0 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  const firstYear = result.years[0];
  assert.equal(firstYear.household.householdPhase, "semi-retirement");
  assert.equal(firstYear.household.requiredAccessibleWithdrawal, 0);
  assert.equal(firstYear.household.plannedSemiRetirementWithdrawal, 20000);
  assert.equal(firstYear.household.totalAccessibleWithdrawal, 20000);
  assert.equal(firstYear.household.closingAccessibleInvestmentBalance, 80000);
});

test("accessible assets can be exhausted before super is accessible", () => {
  const result = runProjection({
    projectionEndAge: 52,
    people: zeroIncomePeople(),
    household: {
      currentLifestyleSpending: 20000,
      semiRetirementLifestyleSpending: 20000,
      fullRetirementLifestyleSpending: 20000,
    },
    scenario: { fullRetirementAnnualSpending: 20000 },
    accessibleInvestments: { openingBalance: 10000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(result.years[0].household.closingAccessibleInvestmentBalance, 0);
  assert.equal(result.years[0].household.unmetSpending, 10000);
  assert.equal(result.summary.accessibleFundsExhaustedAge, 50);
  assert.equal(result.summary.firstUnfundedSpendingAge, 50);
});

test("super is not withdrawn before the relevant person's access age", () => {
  const result = runProjection({
    projectionEndAge: 52,
    people: [
      person1({ currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 500000, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 20000,
      semiRetirementLifestyleSpending: 20000,
      fullRetirementLifestyleSpending: 20000,
    },
    scenario: { fullRetirementAnnualSpending: 20000 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0 },
  });

  const firstYear = result.years[0];
  assert.equal(person(firstYear, "person1").superWithdrawal, 0);
  assert.equal(firstYear.household.totalSuperWithdrawal, 0);
  assert.equal(firstYear.household.unmetSpending, 20000);
});

test("super withdrawals respect different access ages by person", () => {
  const result = runProjection({
    projectionEndAge: 61,
    people: [
      person1({ currentAge: 55, currentGrossEmploymentIncome: 0, semiRetirementAge: 55, fullRetirementAge: 55, superAccessAge: 55, openingSuperBalance: 50000, employerSuperRate: 0 }),
      person2({ currentAge: 55, currentGrossEmploymentIncome: 0, semiRetirementAge: 55, fullRetirementAge: 55, superAccessAge: 60, openingSuperBalance: 50000, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 30000,
      semiRetirementLifestyleSpending: 30000,
      fullRetirementLifestyleSpending: 30000,
    },
    scenario: { fullRetirementAnnualSpending: 30000 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0 },
  });

  const age55 = rowForAge(result, 55);
  assert.equal(person(age55, "person1").superWithdrawal, 30000);
  assert.equal(person(age55, "person2").superWithdrawal, 0);

  const age60 = rowForAge(result, 60, "person2");
  assert.equal(person(age60, "person2").superWithdrawal, 30000);
});

test("adequately funded retirement scenarios last to age 90", () => {
  const result = runProjection({
    projectionEndAge: 90,
    people: [
      person1({ currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 70000,
      semiRetirementLifestyleSpending: 70000,
      fullRetirementLifestyleSpending: 70000,
    },
    scenario: { fullRetirementAnnualSpending: 70000 },
    accessibleInvestments: { openingBalance: 5000000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(result.summary.firstUnfundedSpendingAge, null);
  assert.equal(result.summary.totalUnfundedSpending, 0);
  assert.ok(result.summary.totalInvestableAssetsAtEndAge > 0);
});

test("underfunded retirement scenarios identify the first unfunded age", () => {
  const result = runProjection({
    projectionEndAge: 55,
    people: [
      person1({ currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 50000,
      semiRetirementLifestyleSpending: 50000,
      fullRetirementLifestyleSpending: 50000,
    },
    scenario: { fullRetirementAnnualSpending: 50000 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(result.summary.accessibleFundsExhaustedAge, 51);
  assert.equal(result.summary.firstUnfundedSpendingAge, 52);
  assert.equal(rowForAge(result, 52).household.unmetSpending, 50000);
});

test("minimum estate balance target is reported at projection end age", () => {
  const result = runProjection({
    projectionEndAge: 55,
    people: [
      person1({ currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
    },
    scenario: {
      fullRetirementAnnualSpending: 0,
      minimumEstateBalanceAtEndAge: 150000,
    },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(result.summary.totalInvestableAssetsAtEndAge, 100000);
  assert.equal(result.summary.minimumEstateBalanceTarget, 150000);
  assert.equal(result.summary.minimumEstateBalanceShortfallAtEndAge, 50000);
  assert.equal(result.summary.meetsMinimumEstateBalanceAtEndAge, false);
});

test("today-dollar spending is inflated year by year", () => {
  const result = runProjection({
    projectionEndAge: 52,
    inflationRate: 0.1,
    people: zeroIncomePeople(),
    household: {
      currentLifestyleSpending: 100,
      semiRetirementLifestyleSpending: 100,
      fullRetirementLifestyleSpending: 100,
    },
    scenario: { fullRetirementAnnualSpending: 100 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(rowForAge(result, 50).household.applicableLifestyleSpending, 100);
  assert.equal(rowForAge(result, 51).household.applicableLifestyleSpending, 110);
  assert.equal(rowForAge(result, 52).household.applicableLifestyleSpending, 121);
});

test("optional additional lifestyle draw is entered in today's dollars and inflated each post-working year", () => {
  const result = runProjection({
    projectionEndAge: 60,
    inflationRate: 0.1,
    people: [
      person1({
        currentAge: 50,
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 52,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 60,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
      person2({
        currentAge: 50,
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 52,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 60,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
    ],
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    scenario: {
      semiRetirementAccessibleWithdrawal: 100,
      optionalAdditionalLifestyleWithdrawal: 100,
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
    },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });

  assert.equal(rowForAge(result, 50).householdPhase, "working");
  assert.equal(rowForAge(result, 50).household.optionalAdditionalLifestyleWithdrawalRequested, 0);
  assert.equal(rowForAge(result, 51).household.optionalAdditionalLifestyleWithdrawalRequested, 0);
  assert.equal(rowForAge(result, 52).household.optionalAdditionalLifestyleWithdrawalRequested, 121);
  assert.equal(rowForAge(result, 52).household.optionalAdditionalLifestyleWithdrawal, 121);
  assert.equal(rowForAge(result, 53).household.optionalAdditionalLifestyleWithdrawalRequested, 133.1);
  assert.equal(rowForAge(result, 54).household.optionalAdditionalLifestyleWithdrawalRequested, 146.41);
});

test("accessible investment growth is based on gross accessible assets and not double-counted as income", () => {
  const result = runProjection({
    projectionEndAge: 50,
    people: [
      person1({ currentGrossEmploymentIncome: 0, semiRetirementAge: 50, fullRetirementAge: 50, superAccessAge: 60, openingSuperBalance: 0, employerSuperRate: 0 }),
    ],
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
    },
    scenario: { fullRetirementAnnualSpending: 0 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0.1, annualFeesRate: 0 },
  });

  const firstYear = result.years[0];
  assert.equal(firstYear.household.netHouseholdCashIncome, 0);
  assert.equal(firstYear.household.accessibleInvestmentEarnings, 10000);
  assert.equal(firstYear.household.closingAccessibleInvestmentBalance, 110000);
});

test("super earnings can switch from pre-retirement to post-retirement return rates", () => {
  const result = runProjection({
    projectionEndAge: 51,
    people: [
      person1({
        currentGrossEmploymentIncome: 100000,
        semiRetirementAge: 51,
        fullRetirementAge: 51,
        superAccessAge: 60,
        openingSuperBalance: 100000,
        employerSuperRate: 0,
        superReturnBeforeRetirement: 0.1,
        superReturnAfterRetirement: 0.02,
      }),
    ],
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
    },
    scenario: { fullRetirementAnnualSpending: 0 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(rowForAge(result, 50).people[0].superInvestmentEarnings, 10000);
  assert.equal(rowForAge(result, 51).people[0].superInvestmentEarnings, 2200);
});

test("STSL repayments are person-specific, capped and stop when the balance reaches zero", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentGrossEmploymentIncome: 100000, stslOpeningBalance: 1000 }),
      person2({ currentGrossEmploymentIncome: 50000, stslOpeningBalance: 0 }),
    ],
  });

  const age50 = rowForAge(result, 50);
  assert.equal(person(age50, "person1").stslOpeningBalance, 1000);
  assert.equal(person(age50, "person1").stslRepayment, 1000);
  assert.equal(person(age50, "person1").stslClosingBalance, 0);
  assert.equal(person(age50, "person2").stslRepayment, 0);
  assert.equal(person(rowForAge(result, 51), "person1").stslRepayment, 0);
});

test("additional concessional contributions stop at the configured age and enter super net of contributions tax", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({
        currentGrossEmploymentIncome: 100000,
        semiRetirementAge: 56,
        fullRetirementAge: 60,
        openingSuperBalance: 0,
        employerSuperRate: 0,
        existingAdditionalConcessionalContributions: 10000,
        additionalContributionsStopAge: 55,
      }),
    ],
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
    },
    scenario: { fullRetirementAnnualSpending: 0 },
    accessibleInvestments: { openingBalance: 100000, annualReturnRate: 0, annualFeesRate: 0 },
  });

  assert.equal(person(rowForAge(result, 54), "person1").additionalSuperContribution, 10000);
  assert.equal(person(rowForAge(result, 54), "person1").netAdditionalSuperContribution, 8500);
  assert.equal(person(rowForAge(result, 55), "person1").additionalSuperContribution, 0);
});

test("projection does not mutate inputs and produces repeatable results", () => {
  const { ENGINE } = loadProjectionEngine();
  const input = baseInput({
    people: [
      person1({ semiRetirementAge: 52, semiRetirementGrossIncome: 40000 }),
      person2({ semiRetirementAge: 58, semiRetirementGrossIncome: 30000 }),
    ],
  });
  const original = JSON.parse(JSON.stringify(input));

  const first = ENGINE.projectRetirementScenario(input);
  const second = ENGINE.projectRetirementScenario(input);

  assert.deepEqual(input, original);
  assert.deepEqual(first, second);
  assert.equal(first.warnings.length, 0);
});

test("existing core calculator output is unchanged by running the semi-retirement projection", () => {
  const { CALC, ENGINE } = loadProjectionEngine();
  const plan = CALC.emptyPlan();
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
    { id: "salary-2", type: "salaryWages", owner: "person2", amount: 80000, frequency: "annually" },
  ];
  const before = CALC.calculatePlan(JSON.parse(JSON.stringify(plan)));

  ENGINE.projectRetirementScenario(baseInput());
  const after = CALC.calculatePlan(JSON.parse(JSON.stringify(plan)));

  assert.equal(after.annualGrossIncome, before.annualGrossIncome);
  assert.equal(after.estimatedAnnualTax, before.estimatedAnnualTax);
  assert.equal(after.annualNetIncome, before.annualNetIncome);
  assert.equal(after.employerSuperContributions.person1Calculated, before.employerSuperContributions.person1Calculated);
  assert.equal(after.employerSuperContributions.person2Calculated, before.employerSuperContributions.person2Calculated);
  assert.equal(after.employerSuperContributions.totalEffective, before.employerSuperContributions.totalEffective);
  assert.equal(after.netEmployerSuperContributions, before.netEmployerSuperContributions);
});

function optionalDrawProjection(overrides = {}) {
  return runProjection(mergeDeep({
    projectionEndAge: 66,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 500000,
      annualReturnRate: 0,
      annualFeesRate: 0,
      currentAnnualContributions: 0,
    },
    people: [
      person1({
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 55,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 60,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
      person2({
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 55,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 60,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
    ],
    scenario: {
      semiRetirementAccessibleWithdrawal: 10000,
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
  }, overrides));
}

test("Stage G2B-R optional additional lifestyle draw is zero during every Working-phase year", () => {
  const result = optionalDrawProjection();
  assert.equal(result.validation.isValid, true);
  result.years
    .filter((row) => row.householdPhase === "working")
    .forEach((row) => {
      assert.equal(row.household.optionalAdditionalLifestyleWithdrawalRequested, 0);
      assert.equal(row.household.optionalAdditionalLifestyleWithdrawal, 0);
      assert.equal(row.household.plannedSemiRetirementWithdrawalRequested, 0);
    });
});

test("Stage G2B-R optional additional lifestyle draw begins in the first Semi-retirement year", () => {
  const result = optionalDrawProjection();
  const firstSemi = rowForAge(result, 55);
  assert.equal(firstSemi.householdPhase, "semi-retirement");
  assert.equal(firstSemi.household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
  assert.equal(firstSemi.household.optionalAdditionalLifestyleWithdrawal, 10000);
  assert.equal(firstSemi.household.plannedSemiRetirementWithdrawalRequested, 10000);
});

test("Stage G2B-R optional additional lifestyle draw continues into first and later Full-retirement years", () => {
  const result = optionalDrawProjection();
  const firstFull = rowForAge(result, 60);
  const laterFull = rowForAge(result, 64);
  [firstFull, laterFull].forEach((row) => {
    assert.equal(row.householdPhase, "full-retirement");
    assert.equal(row.household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
    assert.equal(row.household.optionalAdditionalLifestyleWithdrawal, 10000);
    assert.equal(row.household.plannedSemiRetirementWithdrawalRequested, 0);
  });
  assert.equal(result.summary.totalPlannedSemiRetirementWithdrawals, 50000);
  assert.equal(result.summary.totalOptionalAdditionalLifestyleWithdrawals, 120000);
});

test("Stage G2B-R direct Working to Full retirement starts optional draw at Full retirement", () => {
  const result = optionalDrawProjection({
    projectionEndAge: 58,
    people: [
      person1({
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 55,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 55,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
      person2({
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 55,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 55,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
    ],
  });
  assert.equal(rowForAge(result, 54).householdPhase, "working");
  assert.equal(rowForAge(result, 54).household.optionalAdditionalLifestyleWithdrawalRequested, 0);
  assert.equal(rowForAge(result, 55).householdPhase, "full-retirement");
  assert.equal(rowForAge(result, 55).household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
  assert.equal(rowForAge(result, 58).household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
  assert.equal(result.summary.totalPlannedSemiRetirementWithdrawals, 0);
});

test("Stage G2B-R one-person-retired household phase applies optional draw when household leaves Working", () => {
  const result = optionalDrawProjection({
    projectionEndAge: 66,
    people: [
      person1({
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 55,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 55,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
      person2({
        currentGrossEmploymentIncome: 50000,
        semiRetirementAge: 65,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 65,
        openingSuperBalance: 0,
        employerSuperRate: 0,
      }),
    ],
  });
  const firstPostWorking = rowForAge(result, 55);
  assert.equal(firstPostWorking.householdPhase, "semi-retirement");
  assert.equal(person(firstPostWorking, "person1").employmentPhase, "fully-retired");
  assert.equal(person(firstPostWorking, "person2").employmentPhase, "full-time");
  assert.equal(firstPostWorking.household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
});

test("Stage G2B-R optional draw remains separate from normal lifestyle spending", () => {
  const noDraw = optionalDrawProjection({ scenario: { semiRetirementAccessibleWithdrawal: 0 } });
  const withDraw = optionalDrawProjection({ scenario: { semiRetirementAccessibleWithdrawal: 10000 } });
  [55, 60].forEach((age) => {
    const baselineRow = rowForAge(noDraw, age);
    const adjustedRow = rowForAge(withDraw, age);
    assert.equal(adjustedRow.household.applicableLifestyleSpending, baselineRow.household.applicableLifestyleSpending);
    assert.equal(adjustedRow.household.requiredAccessibleWithdrawal, baselineRow.household.requiredAccessibleWithdrawal);
    assert.equal(adjustedRow.household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
    assert.equal(adjustedRow.household.totalAccessibleWithdrawal, baselineRow.household.totalAccessibleWithdrawal + 10000);
  });
});

test("Stage G2C optional draw uses accessible assets first and then eligible super", () => {
  const result = optionalDrawProjection({
    projectionEndAge: 50,
    accessibleInvestments: { openingBalance: 5000 },
    people: [
      person1({
        currentGrossEmploymentIncome: 0,
        semiRetirementAge: 50,
        semiRetirementGrossIncome: 0,
        fullRetirementAge: 50,
        superAccessAge: 50,
        openingSuperBalance: 100000,
        employerSuperRate: 0,
      }),
    ],
  });
  const firstYear = rowForAge(result, 50);
  assert.equal(firstYear.householdPhase, "full-retirement");
  assert.equal(firstYear.household.requiredAccessibleWithdrawal, 0);
  assert.equal(firstYear.household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
  assert.equal(firstYear.household.optionalAdditionalLifestyleAccessibleWithdrawal, 5000);
  assert.equal(firstYear.household.optionalAdditionalLifestyleSuperWithdrawal, 5000);
  assert.equal(firstYear.household.optionalAdditionalLifestyleWithdrawal, 10000);
  assert.equal(firstYear.household.unfundedOptionalAdditionalLifestyleWithdrawal, 0);
  assert.equal(firstYear.household.totalSuperWithdrawal, 5000);
  assert.equal(person(firstYear, "person1").closingSuperBalance, 95000);
});

test("Stage G2B-R optional draw zero produces numerical parity with omitted optional draw input", () => {
  const explicitZero = optionalDrawProjection({ scenario: { semiRetirementAccessibleWithdrawal: 0, optionalAdditionalLifestyleWithdrawal: 0 } });
  const omitted = optionalDrawProjection({ scenario: { semiRetirementAccessibleWithdrawal: undefined, optionalAdditionalLifestyleWithdrawal: undefined } });
  assert.equal(JSON.stringify(explicitZero.summary), JSON.stringify(omitted.summary));
  assert.equal(JSON.stringify(explicitZero.years), JSON.stringify(omitted.years));
});

test("Stage G2B-R positive optional draw changes only post-working rows in the expected fields", () => {
  const noDraw = optionalDrawProjection({ scenario: { semiRetirementAccessibleWithdrawal: 0 } });
  const withDraw = optionalDrawProjection({ scenario: { semiRetirementAccessibleWithdrawal: 10000 } });
  noDraw.years.forEach((baselineRow, index) => {
    const adjustedRow = withDraw.years[index];
    assert.equal(adjustedRow.householdPhase, baselineRow.householdPhase);
    if (baselineRow.householdPhase === "working") {
      assert.equal(JSON.stringify(adjustedRow), JSON.stringify(baselineRow));
    } else {
      assert.equal(adjustedRow.household.applicableLifestyleSpending, baselineRow.household.applicableLifestyleSpending);
      assert.equal(adjustedRow.household.optionalAdditionalLifestyleWithdrawalRequested, 10000);
      assert.equal(adjustedRow.household.closingAccessibleInvestmentBalance, baselineRow.household.closingAccessibleInvestmentBalance - 10000 * (index - 4));
    }
  });
});

test("Stage G2C funds a basic accessible-to-super transition before unmet spending", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 500000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 70000, semiRetirementLifestyleSpending: 70000, fullRetirementLifestyleSpending: 70000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 70000, minimumAccessibleBalance: 0, minimumEstateBalanceAtEndAge: 0 },
    accessibleInvestments: { openingBalance: 20000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60);
  assert.equal(row.household.requiredAccessibleWithdrawal, 20000);
  assert.equal(row.household.requiredSuperWithdrawal, 50000);
  assert.equal(row.household.totalSuperWithdrawal, 50000);
  assert.equal(row.household.closingAccessibleInvestmentBalance, 0);
  assert.equal(row.household.unmetSpending, 0);
});

test("Stage G2C transitions from partial accessible balance to super in the same year", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 100000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 40000, semiRetirementLifestyleSpending: 40000, fullRetirementLifestyleSpending: 40000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 40000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 15000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60);
  assert.equal(row.household.requiredAccessibleWithdrawal, 15000);
  assert.equal(row.household.requiredSuperWithdrawal, 25000);
  assert.equal(row.household.totalSuperWithdrawal, 25000);
  assert.equal(row.household.closingAccessibleInvestmentBalance, 0);
  assert.equal(row.household.unmetSpending, 0);
});

test("Stage G2C does not withdraw super before the scenario access age", () => {
  const result = runProjection({
    projectionEndAge: 58,
    people: [
      person1({ currentAge: 58, currentGrossEmploymentIncome: 0, semiRetirementAge: 58, semiRetirementGrossIncome: 0, fullRetirementAge: 58, superAccessAge: 60, openingSuperBalance: 500000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 30000, semiRetirementLifestyleSpending: 30000, fullRetirementLifestyleSpending: 30000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 30000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 58);
  assert.equal(person(row, "person1").superWithdrawal, 0);
  assert.equal(row.household.totalSuperWithdrawal, 0);
  assert.equal(row.household.unmetSpending, 30000);
});

test("Stage G2C uses only the super balance of a person who has reached access age", () => {
  const result = runProjection({
    projectionEndAge: 57,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 30000, employerSuperRate: 0 }),
      person2({ currentAge: 57, currentGrossEmploymentIncome: 0, semiRetirementAge: 57, semiRetirementGrossIncome: 0, fullRetirementAge: 57, superAccessAge: 60, openingSuperBalance: 500000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 40000, semiRetirementLifestyleSpending: 40000, fullRetirementLifestyleSpending: 40000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 40000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60, "person1");
  assert.equal(person(row, "person1").superWithdrawal, 30000);
  assert.equal(person(row, "person2").superWithdrawal, 0);
  assert.equal(row.household.totalSuperWithdrawal, 30000);
  assert.equal(row.household.unmetSpending, 10000);
});

test("Stage G2C preserves the existing oldest-available-person-first rule when both super balances are accessible", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 30000, employerSuperRate: 0 }),
      person2({ currentAge: 61, currentGrossEmploymentIncome: 0, semiRetirementAge: 61, semiRetirementGrossIncome: 0, fullRetirementAge: 61, superAccessAge: 60, openingSuperBalance: 50000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 70000, semiRetirementLifestyleSpending: 70000, fullRetirementLifestyleSpending: 70000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 70000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60, "person1");
  assert.equal(person(row, "person2").superWithdrawal, 50000);
  assert.equal(person(row, "person1").superWithdrawal, 20000);
  assert.equal(row.household.totalSuperWithdrawal, 70000);
  assert.equal(row.household.unmetSpending, 0);
  assert.equal(person(row, "person2").closingSuperBalance, 0);
  assert.equal(person(row, "person1").closingSuperBalance, 10000);
});

test("Stage G2C optional draw uses super after ordinary accessible funding is exhausted", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 100000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 30000, semiRetirementLifestyleSpending: 30000, fullRetirementLifestyleSpending: 30000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { semiRetirementAccessibleWithdrawal: 10000, optionalAdditionalLifestyleWithdrawal: 10000, fullRetirementAnnualSpending: 30000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 35000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60);
  assert.equal(row.household.requiredAccessibleWithdrawal, 30000);
  assert.equal(row.household.optionalAdditionalLifestyleAccessibleWithdrawal, 5000);
  assert.equal(row.household.optionalAdditionalLifestyleSuperWithdrawal, 5000);
  assert.equal(row.household.optionalAdditionalLifestyleWithdrawal, 10000);
  assert.equal(row.household.totalSuperWithdrawal, 5000);
  assert.equal(row.household.unmetSpending, 0);
});

test("Stage G2C zero optional draw still transitions required shortfalls from accessible assets to super", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 100000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 40000, semiRetirementLifestyleSpending: 40000, fullRetirementLifestyleSpending: 40000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 40000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 15000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60);
  assert.equal(row.household.optionalAdditionalLifestyleWithdrawalRequested, 0);
  assert.equal(row.household.optionalAdditionalLifestyleSuperWithdrawal, 0);
  assert.equal(row.household.requiredAccessibleWithdrawal, 15000);
  assert.equal(row.household.requiredSuperWithdrawal, 25000);
  assert.equal(row.household.unmetSpending, 0);
});

test("Stage G2C reports unmet spending only after accessible assets and eligible super are exhausted", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 25000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 50000, semiRetirementLifestyleSpending: 50000, fullRetirementLifestyleSpending: 50000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { optionalAdditionalLifestyleWithdrawal: 0, fullRetirementAnnualSpending: 50000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 10000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60);
  assert.equal(row.household.requiredAccessibleWithdrawal, 10000);
  assert.equal(row.household.requiredSuperWithdrawal, 25000);
  assert.equal(row.household.unmetRequiredLifestyleSpending, 15000);
  assert.equal(row.household.unmetSpending, 15000);
  assert.equal(row.household.closingAccessibleInvestmentBalance, 0);
  assert.equal(person(row, "person1").closingSuperBalance, 0);
});

test("Stage G2C annual required and optional funding legs reconcile", () => {
  const result = runProjection({
    projectionEndAge: 60,
    people: [
      person1({ currentAge: 60, currentGrossEmploymentIncome: 0, semiRetirementAge: 60, semiRetirementGrossIncome: 0, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 100000, employerSuperRate: 0 }),
    ],
    household: { currentLifestyleSpending: 30000, semiRetirementLifestyleSpending: 30000, fullRetirementLifestyleSpending: 30000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { semiRetirementAccessibleWithdrawal: 10000, optionalAdditionalLifestyleWithdrawal: 10000, fullRetirementAnnualSpending: 30000, minimumAccessibleBalance: 0 },
    accessibleInvestments: { openingBalance: 35000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
  });
  const row = rowForAge(result, 60);
  const requiredNeed = Math.max(0, -row.household.cashSurplusOrShortfall);
  assert.equal(
    row.household.requiredAccessibleWithdrawal + row.household.requiredSuperWithdrawal + row.household.unmetRequiredLifestyleSpending,
    requiredNeed,
  );
  assert.equal(
    row.household.optionalAdditionalLifestyleAccessibleWithdrawal
      + row.household.optionalAdditionalLifestyleSuperWithdrawal
      + row.household.unfundedOptionalAdditionalLifestyleWithdrawal,
    row.household.optionalAdditionalLifestyleWithdrawalRequested,
  );
  assert.equal(
    row.household.totalAccessibleWithdrawal + row.household.totalSuperWithdrawal + row.household.unmetSpending,
    requiredNeed + row.household.optionalAdditionalLifestyleWithdrawalRequested,
  );
});
