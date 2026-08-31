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
    name: "Luke",
    currentAge: 40,
    currentGrossEmploymentIncome: 100000,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 60,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 65,
    superAccessAge: 60,
    openingSuperBalance: 50000,
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
      oneOffLifestyleEvents: [],
      plannedConcessionalContributions: [],
      workingPhaseSurplusDestination: "accessible-investments",
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

function runProjection(input) {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const result = engine.projectRetirementScenario(input);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return result;
}

function rowForYear(result, year) {
  const row = result.years.find((entry) => entry.calendarYear === year);
  assert.ok(row, `Expected row for ${year}`);
  return row;
}

function personIn(row, id = "person1") {
  const entry = row.people.find((personRow) => personRow.id === id);
  assert.ok(entry, `Expected ${id} in ${row.calendarYear}`);
  return entry;
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function assertMoney(actual, expected, message) {
  assert.equal(money(actual), money(expected), message);
}

function taxSaving(basePerson, contributionPerson) {
  return money(
    (basePerson.incomeTax + basePerson.medicareLevy + basePerson.medicareLevySurcharge + basePerson.stslRepayment)
    - (contributionPerson.incomeTax + contributionPerson.medicareLevy + contributionPerson.medicareLevySurcharge + contributionPerson.stslRepayment),
  );
}

test("Stage G2E-S1 no planned contribution events preserve deterministic no-event output", () => {
  const result = runProjection(baseInput());
  const row = rowForYear(result, 2030);
  const luke = personIn(row);

  assert.equal(luke.grossEmploymentIncome, 100000);
  assert.equal(luke.taxableIncomeBeforeModelledConcessionalContributions, 100000);
  assert.equal(luke.modelledTaxReducingConcessionalContribution, 0);
  assert.equal(luke.totalTaxableIncome, 100000);
  assert.equal(luke.incomeTax, 20520);
  assert.equal(luke.medicareLevy, 2000);
  assert.equal(luke.netEmploymentIncome, 77480);
  assert.equal(row.household.closingAccessibleInvestmentBalance, 587400);
  assert.equal(row.household.totalSuperBalance, 101000);
});

test("Stage G2E-S1 planned extra concessional contribution reduces taxable income and keeps 15 percent contributions tax", () => {
  const base = runProjection(baseInput());
  const withEvent = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));
  const baseRow = rowForYear(base, 2030);
  const eventRow = rowForYear(withEvent, 2030);
  const baseLuke = personIn(baseRow);
  const eventLuke = personIn(eventRow);

  assert.equal(eventLuke.taxableIncomeBeforeModelledConcessionalContributions, 100000);
  assert.equal(eventLuke.modelledTaxReducingConcessionalContribution, 10000);
  assert.equal(eventLuke.modelledConcessionalContributionTaxableIncomeReduction, 10000);
  assert.equal(eventLuke.totalTaxableIncome, 90000);
  assert.equal(eventLuke.incomeTax, 17520);
  assert.equal(eventLuke.medicareLevy, 1800);
  assert.equal(eventLuke.plannedExtraConcessionalContribution, 10000);
  assert.equal(eventLuke.plannedExtraConcessionalContributionTax, 1500);
  assert.equal(eventLuke.netPlannedExtraConcessionalContribution, 8500);
  assert.equal(eventLuke.superContributionsTax, 3300);
  assert.equal(eventLuke.stslRepaymentIncome, 100000);
  assertMoney(eventLuke.netEmploymentIncome - baseLuke.netEmploymentIncome, 3200, "tax engine should create the cashflow tax effect");
  assertMoney(baseRow.household.closingAccessibleInvestmentBalance - eventRow.household.closingAccessibleInvestmentBalance, 6800);
  assertMoney(eventRow.household.totalSuperBalance - baseRow.household.totalSuperBalance, 8500);
  assertMoney(eventRow.household.totalInvestableAssets - baseRow.household.totalInvestableAssets, 1700);
});

test("Stage G2E-S1 contribution tax effect applies only in the selected financial year", () => {
  const result = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));

  assert.equal(personIn(rowForYear(result, 2029)).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(result, 2029)).totalTaxableIncome, 100000);
  assert.equal(personIn(rowForYear(result, 2029)).incomeTax, 20520);
  assert.equal(personIn(rowForYear(result, 2030)).plannedExtraConcessionalContribution, 10000);
  assert.equal(personIn(rowForYear(result, 2030)).totalTaxableIncome, 90000);
  assert.equal(personIn(rowForYear(result, 2031)).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(result, 2031)).totalTaxableIncome, 100000);
  assert.equal(personIn(rowForYear(result, 2031)).incomeTax, 20520);
});

test("Stage G2E-S1 planned contribution is person-specific for Luke and does not alter Lisa taxable income", () => {
  const input = baseInput({
    people: [
      person({ id: "person1", name: "Luke", currentGrossEmploymentIncome: 100000, openingSuperBalance: 50000 }),
      person({ id: "person2", name: "Lisa", currentGrossEmploymentIncome: 80000, openingSuperBalance: 60000 }),
    ],
  });
  const base = rowForYear(runProjection(input), 2030);
  const withLukeEvent = rowForYear(runProjection(mergeDeep(input, {
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  })), 2030);

  assert.equal(personIn(withLukeEvent, "person1").totalTaxableIncome, 90000);
  assert.ok(personIn(withLukeEvent, "person1").incomeTax < personIn(base, "person1").incomeTax);
  assert.equal(personIn(withLukeEvent, "person2").totalTaxableIncome, personIn(base, "person2").totalTaxableIncome);
  assert.equal(personIn(withLukeEvent, "person2").incomeTax, personIn(base, "person2").incomeTax);
  assert.equal(personIn(withLukeEvent, "person2").closingSuperBalance, personIn(base, "person2").closingSuperBalance);
});

test("Stage G2E-S1 planned contribution is person-specific for Lisa", () => {
  const result = runProjection(baseInput({
    people: [
      person({ id: "person1", name: "Luke", currentGrossEmploymentIncome: 100000, openingSuperBalance: 50000 }),
      person({ id: "person2", name: "Lisa", currentGrossEmploymentIncome: 80000, openingSuperBalance: 60000 }),
    ],
    scenario: {
      plannedConcessionalContributions: [{ id: "lisa-2030", personId: "person2", financialYear: 2030, amount: 8000 }],
    },
  }));
  const row = rowForYear(result, 2030);

  assert.equal(personIn(row, "person1").totalTaxableIncome, 100000);
  assert.equal(personIn(row, "person2").taxableIncomeBeforeModelledConcessionalContributions, 80000);
  assert.equal(personIn(row, "person2").modelledTaxReducingConcessionalContribution, 8000);
  assert.equal(personIn(row, "person2").totalTaxableIncome, 72000);
  assert.equal(personIn(row, "person2").netPlannedExtraConcessionalContribution, 6800);
});

test("Stage G2E-S1 STSL repayment income uses the existing add-back methodology", () => {
  const base = runProjection(baseInput({
    people: [person({ stslOpeningBalance: 50000 })],
  }));
  const withEvent = runProjection(baseInput({
    people: [person({ stslOpeningBalance: 50000 })],
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));
  const baseLuke = personIn(rowForYear(base, 2030));
  const eventLuke = personIn(rowForYear(withEvent, 2030));

  assert.equal(eventLuke.totalTaxableIncome, 90000);
  assert.equal(eventLuke.stslRepaymentIncome, 100000);
  assert.equal(eventLuke.stslRepaymentIncome, baseLuke.stslRepaymentIncome);
  assert.equal(eventLuke.stslRepayment, baseLuke.stslRepayment);
});

test("Stage G2E-S1 multiple people and multiple years apply independently", () => {
  const result = runProjection(baseInput({
    people: [
      person({ id: "person1", name: "Luke", currentGrossEmploymentIncome: 100000, openingSuperBalance: 50000 }),
      person({ id: "person2", name: "Lisa", currentGrossEmploymentIncome: 80000, openingSuperBalance: 60000 }),
    ],
    scenario: {
      plannedConcessionalContributions: [
        { id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 },
        { id: "luke-2032", personId: "person1", financialYear: 2032, amount: 15000 },
        { id: "lisa-2032", personId: "person2", financialYear: 2032, amount: 8000 },
      ],
    },
  }));

  assert.equal(personIn(rowForYear(result, 2030), "person1").totalTaxableIncome, 90000);
  assert.equal(personIn(rowForYear(result, 2030), "person2").totalTaxableIncome, 80000);
  assert.equal(personIn(rowForYear(result, 2031), "person1").totalTaxableIncome, 100000);
  assert.equal(personIn(rowForYear(result, 2031), "person2").totalTaxableIncome, 80000);
  assert.equal(personIn(rowForYear(result, 2032), "person1").totalTaxableIncome, 85000);
  assert.equal(personIn(rowForYear(result, 2032), "person2").totalTaxableIncome, 72000);
});

test("Stage G2E-S1 no double cash deduction for planned contribution events", () => {
  const baseRow = rowForYear(runProjection(baseInput()), 2030);
  const eventRow = rowForYear(runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  })), 2030);
  const baseLuke = personIn(baseRow);
  const eventLuke = personIn(eventRow);
  const expectedAfterTaxCashCost = money(eventLuke.plannedExtraConcessionalContribution - taxSaving(baseLuke, eventLuke));

  assert.equal(expectedAfterTaxCashCost, 6800);
  assertMoney(baseRow.household.closingAccessibleInvestmentBalance - eventRow.household.closingAccessibleInvestmentBalance, expectedAfterTaxCashCost);
  assert.notEqual(baseRow.household.closingAccessibleInvestmentBalance - eventRow.household.closingAccessibleInvestmentBalance, 20000);
});

test("Stage G2E-S1 comparison scenarios use the same corrected tax treatment", () => {
  const current = rowForYear(runProjection(baseInput()), 2030);
  const comparison = rowForYear(runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  })), 2030);

  assert.equal(personIn(current).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(comparison).plannedExtraConcessionalContribution, 10000);
  assert.equal(personIn(comparison).totalTaxableIncome, 90000);
  assertMoney(comparison.household.closingAccessibleInvestmentBalance, 580600);
  assertMoney(comparison.household.totalSuperBalance, 109500);
  assertMoney(comparison.household.totalNetWorth, 690100);
});

test("Stage G2E-S1 super balances include net planned contribution and carry forward", () => {
  const result = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));
  const contributionYear = rowForYear(result, 2030);
  const followingYear = rowForYear(result, 2031);

  assert.equal(personIn(contributionYear).netPlannedExtraConcessionalContribution, 8500);
  assert.equal(contributionYear.household.totalSuperBalance, personIn(contributionYear).closingSuperBalance);
  assert.equal(followingYear.people.reduce((total, entry) => total + entry.closingSuperBalance, 0), followingYear.household.totalSuperBalance);
  assert.ok(personIn(followingYear).openingSuperBalance >= personIn(contributionYear).closingSuperBalance);
});

test("Stage G2E-S1 existing recurring concessional contribution uses the aligned tax treatment", () => {
  const baseYear = rowForYear(runProjection(baseInput()), 2026);
  const recurringYear = rowForYear(runProjection(baseInput({
    people: [person({ existingAdditionalConcessionalContributions: 10000 })],
  })), 2026);
  const baseLuke = personIn(baseYear);
  const recurringLuke = personIn(recurringYear);

  assert.equal(recurringLuke.recurringAdditionalSuperContribution, 10000);
  assert.equal(recurringLuke.plannedExtraConcessionalContribution, 0);
  assert.equal(recurringLuke.modelledTaxReducingConcessionalContribution, 10000);
  assert.equal(recurringLuke.totalTaxableIncome, 90000);
  assert.equal(recurringLuke.stslRepaymentIncome, 100000);
  assert.equal(recurringLuke.netAdditionalSuperContribution, 8500);
  assertMoney(baseYear.household.closingAccessibleInvestmentBalance - recurringYear.household.closingAccessibleInvestmentBalance, 6800);
  assertMoney(recurringYear.household.totalInvestableAssets - baseYear.household.totalInvestableAssets, 1700);
  assert.equal(taxSaving(baseLuke, recurringLuke), 3200);
});

test("Stage G2E-S1 annual detail and info copy explain corrected tax treatment", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const detailSnippet = appSource.slice(
    appSource.indexOf("function renderSemiRetirementAnnualDetailHtml"),
    appSource.indexOf("function renderSemiRetirementAnnualProjectionHtml"),
  );

  assert.match(appSource, /reduces the selected person's modelled taxable income and 15% contributions tax is applied within super/);
  assert.match(appSource, /The projection applies its simplified concessional tax treatment; actual contribution limits and eligibility must be checked separately/);
  assert.match(detailSnippet, /Taxable income before modelled concessional contributions/);
  assert.match(detailSnippet, /Modelled concessional contribution taxable-income reduction/);
  assert.match(detailSnippet, /Net planned contribution added to super/);
  assert.doesNotMatch(appSource, /You will receive a tax deduction/);
  assert.doesNotMatch(appSource, /Available cap:/);
});
