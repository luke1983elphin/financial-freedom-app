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

function baseDraft(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 66,
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
      name: "Luke",
      currentAge: 40,
      currentGrossEmploymentIncome: 100000,
      annualIncomeGrowthRatePct: 0,
      hasSemiRetirement: false,
      semiRetirementAge: 65,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 65,
      superAccessAge: 60,
      openingSuperBalance: 50000,
      superReturnBeforeRetirementPct: 0,
      superReturnAfterRetirementPct: 0,
      superAnnualFeesRatePct: 0,
      employerSuperRatePct: 12,
      existingAdditionalConcessionalContributions: 0,
      additionalContributionsStopAge: 60,
      stslOpeningBalance: 0,
      hasPrivateHealthCover: true,
    }],
    scenario: {
      oneOffLifestyleEvents: [],
      plannedConcessionalContributions: [],
      workingPhaseSurplusDestination: "accessible-investments",
      surplusDestination: "enjoyment",
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
    assets: [],
    liabilities: [],
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

function assertEqualMoney(actual, expected, message) {
  assert.equal(Math.round(Number(actual) * 100) / 100, Math.round(Number(expected) * 100) / 100, message);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("Stage G2E-S no planned contribution events preserve no-event projection parity", () => {
  const withoutField = runProjection(baseInput({ scenario: { plannedConcessionalContributions: undefined } }));
  const emptyEvents = runProjection(baseInput({ scenario: { plannedConcessionalContributions: [] } }));

  assert.deepEqual(plain(withoutField.years), plain(emptyEvents.years));
  assert.deepEqual(plain(withoutField.summary), plain(emptyEvents.summary));
});

test("Stage G2E-S one person one financial year applies once and uses existing contributions tax", () => {
  const base = runProjection(baseInput());
  const withEvent = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));

  assert.equal(personIn(rowForYear(withEvent, 2029)).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(withEvent, 2030)).plannedExtraConcessionalContribution, 10000);
  assert.equal(personIn(rowForYear(withEvent, 2031)).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(withEvent, 2030)).additionalSuperContribution, 10000);
  assert.equal(personIn(rowForYear(withEvent, 2030)).netAdditionalSuperContribution, 8500);
  assert.equal(personIn(rowForYear(withEvent, 2030)).superContributionsTax, 3300);
  assert.equal(personIn(rowForYear(withEvent, 2030)).totalModelledSuperContributions, 22000);
  assert.equal(rowForYear(withEvent, 2030).household.plannedExtraConcessionalContributionsPaidFromCash, 10000);

  assertEqualMoney(
    rowForYear(base, 2030).household.closingAccessibleInvestmentBalance - rowForYear(withEvent, 2030).household.closingAccessibleInvestmentBalance,
    6800,
    "outside-super accessible resources should reduce by the event amount after the modelled personal-tax effect",
  );
  assertEqualMoney(
    rowForYear(withEvent, 2030).household.totalSuperBalance - rowForYear(base, 2030).household.totalSuperBalance,
    8500,
    "super should increase by the event amount after existing 15% contributions tax",
  );
  assertEqualMoney(
    rowForYear(withEvent, 2030).household.totalInvestableAssets - rowForYear(base, 2030).household.totalInvestableAssets,
    1700,
    "total investable assets should reflect the modelled personal-tax effect and contributions tax",
  );
});

test("Stage G2E-S multiple contribution years apply independently", () => {
  const result = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [
        { id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 },
        { id: "luke-2032", personId: "person1", financialYear: 2032, amount: 15000 },
      ],
    },
  }));

  assert.equal(personIn(rowForYear(result, 2030)).plannedExtraConcessionalContribution, 10000);
  assert.equal(personIn(rowForYear(result, 2031)).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(result, 2032)).plannedExtraConcessionalContribution, 15000);
  assert.equal(result.summary.totalPlannedExtraConcessionalContributions, 25000);
});

test("Stage G2E-S multiple people events affect only the selected person", () => {
  const result = runProjection(baseInput({
    people: [
      person({ id: "person1", name: "Luke", openingSuperBalance: 50000 }),
      person({ id: "person2", name: "Lisa", currentAge: 40, currentGrossEmploymentIncome: 80000, openingSuperBalance: 60000 }),
    ],
    scenario: {
      plannedConcessionalContributions: [
        { id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 },
        { id: "lisa-2032", personId: "person2", financialYear: 2032, amount: 8000 },
      ],
    },
  }));

  assert.equal(personIn(rowForYear(result, 2030), "person1").plannedExtraConcessionalContribution, 10000);
  assert.equal(personIn(rowForYear(result, 2030), "person2").plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(result, 2032), "person1").plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(result, 2032), "person2").plannedExtraConcessionalContribution, 8000);
});

test("Stage G2E-S duplicate person and financial-year rows are blocked", () => {
  const { FFSSemiRetirementUi: ui, FFSSemiRetirementProjection: engine } = loadRuntime();
  const draft = baseDraft({
    scenario: {
      plannedConcessionalContributions: [
        { id: "first", personId: "person1", financialYear: 2030, amount: 10000 },
        { id: "second", personId: "person1", financialYear: 2030, amount: 5000 },
      ],
    },
  });
  const uiErrors = ui.validateSemiRetirementScenarioDraft(draft);
  assert.match(JSON.stringify(uiErrors), /one planned extra concessional contribution per person and financial year/);

  const engineResult = engine.projectRetirementScenario(ui.scenarioDraftToProjectionInputs(draft));
  assert.equal(engineResult.validation.isValid, false);
  assert.match(JSON.stringify(engineResult.validation.errors), /one planned extra concessional contribution per person and financial year/);
});

test("Stage G2E-S invalid and out-of-range planned contribution events are reported", () => {
  const { FFSSemiRetirementUi: ui } = loadRuntime();
  const draft = baseDraft({
    scenario: {
      plannedConcessionalContributions: [
        { id: "invalid-person", personId: "missing", financialYear: 2030, amount: 10000 },
        { id: "invalid-year", personId: "person1", financialYear: 2100, amount: 10000 },
        { id: "invalid-amount", personId: "person1", financialYear: 2031, amount: 0 },
      ],
    },
  });
  const errors = ui.validateSemiRetirementScenarioDraft(draft);
  const text = JSON.stringify(errors);
  assert.match(text, /Choose a person/);
  assert.match(text, /Choose a financial year within this projection/);
  assert.match(text, /greater than \$0/);
});

test("Stage G2E-S existing recurring contribution remains separate from annual event", () => {
  const row = rowForYear(runProjection(baseInput({
    people: [person({ existingAdditionalConcessionalContributions: 5000 })],
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  })), 2030);
  const luke = personIn(row);

  assert.equal(luke.recurringAdditionalSuperContribution, 5000);
  assert.equal(luke.plannedExtraConcessionalContribution, 10000);
  assert.equal(luke.additionalSuperContribution, 15000);
  assert.equal(row.household.plannedRecurringAdditionalConcessionalContributionsPaidFromCash, 5000);
  assert.equal(row.household.plannedExtraConcessionalContributionsPaidFromCash, 10000);
  assert.equal(row.household.plannedAdditionalConcessionalContributionsPaidFromCash, 15000);
});

test("Stage G2E-S extra contributions do not alter super access age behaviour", () => {
  const result = runProjection(baseInput({
    people: [person({ superAccessAge: 60 })],
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));

  assert.equal(personIn(rowForYear(result, 2030)).age, 44);
  assert.equal(personIn(rowForYear(result, 2030)).superAccessAge, 60);
  assert.equal(personIn(rowForYear(result, 2030)).superWithdrawal, 0);
  assert.equal(result.summary.firstYearAllPeopleSuperAccessible.calendarYear, 2046);
});

test("Stage G2E-S saved retirement scenario snapshots round trip planned contribution events", () => {
  const { FFSSemiRetirementUi: ui } = loadRuntime();
  const draft = baseDraft({
    scenario: {
      plannedConcessionalContributions: [
        { id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 },
        { id: "luke-2032", personId: "person1", financialYear: 2032, amount: 15000 },
      ],
    },
  });
  const reopened = JSON.parse(JSON.stringify(draft));
  const inputs = ui.scenarioDraftToProjectionInputs(reopened);

  assert.deepEqual(plain(inputs.scenario.plannedConcessionalContributions), [
    { id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 },
    { id: "luke-2032", personId: "person1", financialYear: 2032, amount: 15000 },
  ]);
});

test("Stage G2E-S comparison scenarios can model a different event schedule", () => {
  const current = runProjection(baseInput());
  const comparison = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));

  assert.equal(personIn(rowForYear(current, 2030)).plannedExtraConcessionalContribution, 0);
  assert.equal(personIn(rowForYear(comparison, 2030)).plannedExtraConcessionalContribution, 10000);
  assert.ok(rowForYear(comparison, 2030).household.totalSuperBalance > rowForYear(current, 2030).household.totalSuperBalance);
  assert.ok(rowForYear(comparison, 2030).household.closingAccessibleInvestmentBalance < rowForYear(current, 2030).household.closingAccessibleInvestmentBalance);
});

test("Stage G2E-S financial-year mapping applies 2030-31 to calendarYear 2030 exactly once", () => {
  const result = runProjection(baseInput({
    scenario: {
      plannedConcessionalContributions: [{ id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 }],
    },
  }));
  const yearsWithEvent = result.years
    .filter((row) => row.people.some((personRow) => personRow.plannedExtraConcessionalContribution > 0))
    .map((row) => row.calendarYear);

  assert.deepEqual(plain(yearsWithEvent), [2030]);
});

test("Stage G2E-S annual details reconcile person and household super balances", () => {
  const row = rowForYear(runProjection(baseInput({
    people: [
      person({ id: "person1", name: "Luke", openingSuperBalance: 50000 }),
      person({ id: "person2", name: "Lisa", currentGrossEmploymentIncome: 80000, openingSuperBalance: 60000 }),
    ],
    scenario: {
      plannedConcessionalContributions: [
        { id: "luke-2030", personId: "person1", financialYear: 2030, amount: 10000 },
        { id: "lisa-2030", personId: "person2", financialYear: 2030, amount: 8000 },
      ],
    },
  })), 2030);
  const personTotal = row.people.reduce((total, personRow) => total + personRow.closingSuperBalance, 0);
  assertEqualMoney(row.household.totalSuperBalance, personTotal);
  assert.equal(row.household.plannedExtraConcessionalContributionsPaidFromCash, 18000);
});

test("Stage G2E-S UI source includes advanced section, info wording and saved-scenario summaries", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /Advanced super contributions/);
  assert.match(appSource, /Planned extra concessional contributions/);
  assert.match(appSource, /Financial Freedom assumes planned extra concessional contributions receive concessional tax treatment/);
  assert.match(appSource, /Money contributed to super may not be accessible until the assumed super access age/);
  assert.match(appSource, /planned extra concessional contribution events are included in this comparison/);
  assert.match(appSource, /No one-off lifestyle spending or planned extra concessional contribution events are included/);
  assert.match(appSource, /Added: \$\{contributionSummary/);
  assert.doesNotMatch(appSource, /Available cap:/);
});

test("Stage G2E-S year-by-year overview exposes super balance without overloading collapsed cards", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const annualSnippet = appSource.slice(
    appSource.indexOf("function renderSemiRetirementAnnualProjectionHtml"),
    appSource.indexOf("function renderSemiRetirementAssumptionsHtml"),
  );
  assert.match(annualSnippet, /<th>Super balance<\/th>/);
  const accessibleIndex = annualSnippet.indexOf('{ label: "Accessible investments"');
  const superIndex = annualSnippet.indexOf('{ label: "Super balance"');
  assert.ok(accessibleIndex >= 0 && superIndex > accessibleIndex, "mobile annual card should show Super balance below Accessible investments");
  assert.doesNotMatch(annualSnippet, /Employer super contributions/);
  assert.match(annualSnippet, /semi-retirement-projection-scroll/);
});

test("Stage G2E-S annual detail output includes extra concessional contribution breakdown", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const detailSnippet = appSource.slice(
    appSource.indexOf("function renderSemiRetirementAnnualDetailHtml"),
    appSource.indexOf("function renderSemiRetirementAnnualProjectionHtml"),
  );
  assert.match(detailSnippet, /planned extra concessional contribution/);
  assert.match(detailSnippet, /Total planned extra concessional contribution/);
  assert.match(detailSnippet, /Combined household closing super balance/);
});
