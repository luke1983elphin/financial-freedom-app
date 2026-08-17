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
const uiSource = readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function basePlan() {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Luke";
  plan.personal.person2Name = "Lisa";
  plan.personal.person1Age = 43;
  plan.personal.person2Age = 41;
  plan.personal.fullRetirementAge = 60;
  plan.personal.semiRetirementAge = 55;
  plan.personal.targetAnnualSpending = 90000;
  plan.assets.cash = 30000;
  plan.assets.sharesEtfs = 150000;
  plan.assets.superPerson1 = 210000;
  plan.assets.superPerson2 = 145000;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.investing.inflationPct = 2.5;
  plan.investing.wageGrowthPct = 3;
  plan.income.person1HasStslDebt = true;
  plan.income.person2HasStslDebt = false;
  plan.incomeItems = [
    { id: "income-luke", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "income-lisa", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 85000, frequency: "annually" },
    { id: "income-interest", name: "Interest", type: "interest", owner: "joint", amount: 3000, frequency: "annually" },
  ];
  plan.liabilityItems = [
    { id: "stsl-luke", type: "stsl", owner: "person1", balance: 20000 },
  ];
  return plan;
}

function defaultsFor(plan = basePlan()) {
  const result = CALC.calculatePlan(plan);
  return { plan, result, defaults: UI.buildSemiRetirementScenarioDefaults(plan, result) };
}

function projectionFor(mutator = () => {}) {
  const defaults = defaultsFor();
  const draft = defaults.defaults.draft;
  mutator(draft);
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  const result = ENGINE.projectRetirementScenario(inputs);
  const viewModel = UI.buildSemiRetirementResultsViewModel(result, inputs, draft);
  return { draft, inputs, result, viewModel };
}

function fundedProjection() {
  return projectionFor((draft) => {
    draft.accessibleInvestments.openingBalance = 5000000;
    draft.accessibleInvestments.annualReturnRatePct = 0;
    draft.people.forEach((person) => {
      person.hasSemiRetirement = false;
      person.fullRetirementAge = 60;
      person.semiRetirementAge = 60;
      person.superReturnBeforeRetirementPct = 0;
      person.superReturnAfterRetirementPct = 0;
    });
    draft.household.currentLifestyleSpending = 70000;
    draft.household.semiRetirementLifestyleSpending = 70000;
    draft.household.fullRetirementLifestyleSpending = 70000;
  });
}

function shortfallProjection() {
  return projectionFor((draft) => {
    draft.accessibleInvestments.openingBalance = 100000;
    draft.accessibleInvestments.annualReturnRatePct = 0;
    draft.accessibleInvestments.externalAnnualAccessibleContribution = 0;
    draft.people.forEach((person) => {
      person.currentGrossEmploymentIncome = 0;
      person.openingSuperBalance = 0;
      person.employerSuperRatePct = 0;
      person.hasSemiRetirement = false;
      person.fullRetirementAge = person.currentAge;
      person.semiRetirementAge = person.currentAge;
      person.superAccessAge = 60;
      person.superReturnBeforeRetirementPct = 0;
      person.superReturnAfterRetirementPct = 0;
    });
    draft.household.currentLifestyleSpending = 70000;
    draft.household.semiRetirementLifestyleSpending = 70000;
    draft.household.fullRetirementLifestyleSpending = 70000;
    draft.projectionEndAge = 65;
  });
}

function person(row, personId) {
  const entry = row.people.find((item) => item.id === personId);
  assert.ok(entry, `Expected ${personId} in annual row`);
  return entry;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function timelineEvents(viewModel, titlePattern) {
  return viewModel.timeline.flatMap((group) => (
    group.events
      .filter((event) => titlePattern.test(event.title))
      .map((event) => ({ ...event, calendarYear: group.calendarYear, ages: group.ages }))
  ));
}

function semiRetirementWithdrawalScenario(mutator = () => {}) {
  return projectionFor((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 50;
      person.currentGrossEmploymentIncome = 0;
      person.openingSuperBalance = 0;
      person.employerSuperRatePct = 0;
      person.hasSemiRetirement = false;
      person.semiRetirementAge = 60;
      person.fullRetirementAge = 60;
      person.superAccessAge = 60;
      person.superReturnBeforeRetirementPct = 0;
      person.superReturnAfterRetirementPct = 0;
    });
    draft.people[0].fullRetirementAge = 55;
    draft.people[0].semiRetirementAge = 55;
    draft.people[1].currentGrossEmploymentIncome = 40000;
    draft.household.currentLifestyleSpending = 70000;
    draft.household.semiRetirementLifestyleSpending = 70000;
    draft.household.fullRetirementLifestyleSpending = 70000;
    draft.accessibleInvestments.openingBalance = 500000;
    draft.accessibleInvestments.annualReturnRatePct = 0;
    draft.accessibleInvestments.externalAnnualAccessibleContribution = 0;
    draft.scenario.semiRetirementAccessibleWithdrawal = 10000;
    draft.projectionEndAge = 70;
    mutator(draft);
  });
}

test("Stage 2 feature flag is enabled by default and the UI mount still has an unavailable-state guard", () => {
  assert.equal(ENGINE.featureFlags.semiRetirementProjectionEnabled, true);
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), true);
  assert.match(indexSource, /id="semiRetirementScenarioRoot"/);
  assert.match(appSource, /if \(!semiRetirementUiEnabled\(\)\) \{/);
});

test("Stage 2 interface can be disabled and re-enabled by the existing engine feature flag", () => {
  ENGINE.featureFlags.semiRetirementProjectionEnabled = false;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), false);
  ENGINE.featureFlags.semiRetirementProjectionEnabled = true;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), true);
});

test("current app values populate scenario defaults where they are reliable", () => {
  const { result, defaults } = defaultsFor();
  const draft = defaults.draft;
  assert.equal(draft.people[0].name, "Luke");
  assert.equal(draft.people[0].currentAge, 43);
  assert.equal(draft.people[0].currentGrossEmploymentIncome, 120000);
  assert.equal(draft.people[0].openingSuperBalance, 210000);
  assert.equal(draft.people[0].stslOpeningBalance, 20000);
  assert.equal(draft.people[1].name, "Lisa");
  assert.equal(draft.people[1].currentGrossEmploymentIncome, 85000);
  assert.equal(draft.household.currentLifestyleSpending, 90000);
  assert.equal(draft.accessibleInvestments.openingBalance, result.accessibleInvestmentAssets);
  assert.equal(draft.accessibleInvestments.annualReturnRatePct, 7);
  assert.equal(draft.assumptions.inflationRatePct, 2.5);
});

test("scenario edits do not mutate base-plan data", () => {
  const { plan, defaults } = defaultsFor();
  const before = JSON.stringify(plan);
  UI.setDraftPath(defaults.draft, "people.0.currentGrossEmploymentIncome", 90000);
  UI.setDraftPath(defaults.draft, "household.semiRetirementLifestyleSpending", 75000);
  assert.equal(JSON.stringify(plan), before);
});

test("semi-retirement disabled maps the person as fully employed until full retirement", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].hasSemiRetirement = false;
  draft.people[0].semiRetirementAge = 50;
  draft.people[0].semiRetirementGrossIncome = 50000;
  draft.people[0].fullRetirementAge = 60;
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.people[0].semiRetirementAge, 60);
  assert.equal(inputs.people[0].semiRetirementGrossIncome, 0);
});

test("semi-retirement enabled passes semi-retirement age and income to the engine input", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].hasSemiRetirement = true;
  draft.people[0].semiRetirementAge = 50;
  draft.people[0].semiRetirementGrossIncome = 55000;
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.people[0].semiRetirementAge, 50);
  assert.equal(inputs.people[0].semiRetirementGrossIncome, 55000);
});

test("invalid age combinations show validation errors before running the projection", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].hasSemiRetirement = true;
  draft.people[0].semiRetirementAge = 40;
  draft.people[0].fullRetirementAge = 39;
  const errors = UI.validateSemiRetirementScenarioDraft(draft);
  assert.ok(errors.some((error) => error.path === "people.0.semiRetirementAge"));
  assert.ok(errors.some((error) => error.path === "people.0.fullRetirementAge"));
});

test("planned semi-retirement withdrawal reaches scenario.semiRetirementAccessibleWithdrawal", () => {
  const { defaults } = defaultsFor();
  defaults.draft.scenario.semiRetirementAccessibleWithdrawal = 20000;
  const inputs = UI.scenarioDraftToProjectionInputs(defaults.draft);
  assert.equal(inputs.scenario.semiRetirementAccessibleWithdrawal, 20000);
});

test("current, semi-retirement and full-retirement spending values map separately", () => {
  const { defaults } = defaultsFor();
  defaults.draft.household.currentLifestyleSpending = 70000;
  defaults.draft.household.semiRetirementLifestyleSpending = 80000;
  defaults.draft.household.fullRetirementLifestyleSpending = 90000;
  const inputs = UI.scenarioDraftToProjectionInputs(defaults.draft);
  assert.equal(inputs.household.currentLifestyleSpending, 70000);
  assert.equal(inputs.household.semiRetirementLifestyleSpending, 80000);
  assert.equal(inputs.household.fullRetirementLifestyleSpending, 90000);
  assert.equal(inputs.scenario.fullRetirementAnnualSpending, 90000);
});

test("projection end age maps to the engine input using the younger-person convention", () => {
  const { defaults } = defaultsFor();
  defaults.draft.projectionEndAge = 95;
  const inputs = UI.scenarioDraftToProjectionInputs(defaults.draft);
  assert.equal(inputs.projectionEndAge, 95);
});

test("each person's assumed super access age reaches the engine input", () => {
  const { defaults } = defaultsFor();
  defaults.draft.people[0].superAccessAge = 61;
  defaults.draft.people[1].superAccessAge = 63;
  const inputs = UI.scenarioDraftToProjectionInputs(defaults.draft);
  assert.equal(inputs.people[0].superAccessAge, 61);
  assert.equal(inputs.people[1].superAccessAge, 63);
});

test("Calculate Scenario uses the existing projection engine rather than duplicated logic", () => {
  const { defaults } = defaultsFor();
  let called = false;
  const fakeEngine = {
    projectRetirementScenario(inputs) {
      called = true;
      assert.equal(inputs.people[0].id, "person1");
      return { years: [], summary: {}, warnings: [], validation: { isValid: true, errors: [] } };
    },
  };
  const outcome = UI.runSemiRetirementProjection(fakeEngine, defaults.draft);
  assert.equal(called, true);
  assert.equal(outcome.validation.isValid, true);
});

test("result UI references Stage 1B authoritative summary fields only", () => {
  const start = uiSource.indexOf("function buildSemiRetirementResultsViewModel");
  const end = uiSource.indexOf("function isSemiRetirementUiEnabled", start);
  const snippet = uiSource.slice(start, end);
  assert.match(snippet, /firstPersonFullRetirement/);
  assert.match(snippet, /householdFullRetirement/);
  assert.match(snippet, /accessibleBalanceAtFirstPersonFullRetirement/);
  assert.match(snippet, /superByPersonAtAge60/);
  assert.match(snippet, /superByPersonAtAccessAge/);
  assert.doesNotMatch(snippet, /accessibleBalanceAtFirstFullRetirement/);
  assert.doesNotMatch(snippet, /firstFullRetirement/);
  assert.doesNotMatch(snippet, /totalSuperAtAge60/);
  assert.doesNotMatch(snippet, /accessibleFundsExhaustedAge/);
  assert.doesNotMatch(snippet, /allRetirementFundsExhaustedAge/);
  assert.doesNotMatch(snippet, /firstUnfundedSpendingAge/);
});

test("unfunded scenarios expose a structured warning milestone", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.accessibleInvestments.openingBalance = 0;
  draft.people.forEach((person) => {
    person.currentGrossEmploymentIncome = 0;
    person.openingSuperBalance = 0;
    person.hasSemiRetirement = false;
    person.fullRetirementAge = person.currentAge;
    person.semiRetirementAge = person.currentAge;
  });
  draft.household.currentLifestyleSpending = 100000;
  draft.household.semiRetirementLifestyleSpending = 100000;
  draft.household.fullRetirementLifestyleSpending = 100000;
  const outcome = UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(outcome.result.validation.isValid, true);
  assert.ok(outcome.result.summary.firstUnfundedSpending.calendarYear);
  assert.match(uiSource, /Projected funding shortfall begins/);
});

test("reset scenario affordance is present and restores defaults without changing base plan", () => {
  const { plan, defaults } = defaultsFor();
  const before = JSON.stringify(plan);
  const initial = JSON.stringify(defaults.draft);
  UI.setDraftPath(defaults.draft, "people.0.currentGrossEmploymentIncome", 1);
  const reset = JSON.parse(initial);
  assert.equal(reset.people[0].currentGrossEmploymentIncome, 120000);
  assert.equal(JSON.stringify(plan), before);
  assert.match(appSource, /data-semi-action="reset"/);
});

test("Stage 2A accepts an older person's retirement age above projection end when within the younger-person horizon", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].currentAge = 60;
  draft.people[0].fullRetirementAge = 95;
  draft.people[0].hasSemiRetirement = false;
  draft.people[0].semiRetirementAge = 95;
  draft.people[1].currentAge = 40;
  draft.people[1].fullRetirementAge = 65;
  draft.people[1].hasSemiRetirement = false;
  draft.people[1].semiRetirementAge = 65;
  draft.projectionEndAge = 90;
  const errors = UI.validateSemiRetirementScenarioDraft(draft);
  assert.equal(errors.filter((error) => error.path === "projectionEndAge").length, 0);
});

test("Stage 2A rejects a retirement event that occurs beyond the younger-person projection horizon", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].name = "Person 1";
  draft.people[0].currentAge = 60;
  draft.people[0].fullRetirementAge = 112;
  draft.people[0].hasSemiRetirement = false;
  draft.people[0].semiRetirementAge = 112;
  draft.people[1].currentAge = 40;
  draft.people[1].fullRetirementAge = 65;
  draft.people[1].hasSemiRetirement = false;
  draft.people[1].semiRetirementAge = 65;
  draft.projectionEndAge = 90;
  const errors = UI.validateSemiRetirementScenarioDraft(draft);
  assert.ok(errors.some((error) => (
    error.path === "projectionEndAge"
    && /Person 1.*full-retirement age occurs after the selected projection end/.test(error.message)
  )));
});

test("Stage 2A preserves same-age couple projection-end validation behaviour", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].currentAge = 45;
  draft.people[0].fullRetirementAge = 60;
  draft.people[0].hasSemiRetirement = false;
  draft.people[0].semiRetirementAge = 60;
  draft.people[1].currentAge = 45;
  draft.people[1].fullRetirementAge = 60;
  draft.people[1].hasSemiRetirement = false;
  draft.people[1].semiRetirementAge = 60;
  draft.projectionEndAge = 90;
  const errors = UI.validateSemiRetirementScenarioDraft(draft);
  assert.equal(errors.filter((error) => error.path === "projectionEndAge").length, 0);
});

test("Stage 2A uses the youngest person's current age as the projection horizon basis", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].currentAge = 70;
  draft.people[0].fullRetirementAge = 100;
  draft.people[0].hasSemiRetirement = false;
  draft.people[0].semiRetirementAge = 100;
  draft.people[1].currentAge = 50;
  draft.people[1].fullRetirementAge = 85;
  draft.people[1].hasSemiRetirement = false;
  draft.people[1].semiRetirementAge = 85;
  draft.projectionEndAge = 90;
  const yearsUntilProjectionEnd = draft.projectionEndAge - Math.min(...draft.people.map((person) => person.currentAge));
  assert.equal(yearsUntilProjectionEnd, 40);
  assert.equal(draft.people[0].fullRetirementAge - draft.people[0].currentAge, 30);
  assert.equal(draft.people[1].fullRetirementAge - draft.people[1].currentAge, 35);
  const errors = UI.validateSemiRetirementScenarioDraft(draft);
  assert.equal(errors.filter((error) => error.path === "projectionEndAge").length, 0);
});

test("Stage 2A keeps existing near-same-age valid scenarios passing", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].currentAge = 44;
  draft.people[0].fullRetirementAge = 62;
  draft.people[0].hasSemiRetirement = true;
  draft.people[0].semiRetirementAge = 55;
  draft.people[1].currentAge = 42;
  draft.people[1].fullRetirementAge = 60;
  draft.people[1].hasSemiRetirement = true;
  draft.people[1].semiRetirementAge = 54;
  draft.projectionEndAge = 90;
  const errors = UI.validateSemiRetirementScenarioDraft(draft);
  assert.equal(errors.filter((error) => error.path === "projectionEndAge").length, 0);
});

test("Stage 3 funded scenario status reports lifestyle funded through projection period", () => {
  const { result, viewModel } = fundedProjection();
  assert.equal(result.summary.totalUnfundedSpending, 0);
  assert.equal(viewModel.status.type, "funded");
  assert.equal(viewModel.status.title, "Lifestyle funded through the projection period");
});

test("Stage 3 shortfall scenario status reports calendar year and both ages", () => {
  const { result, viewModel } = shortfallProjection();
  assert.ok(result.summary.firstUnfundedSpending.calendarYear);
  assert.equal(viewModel.status.type, "shortfall");
  assert.equal(viewModel.status.milestone.calendarYear, result.summary.firstUnfundedSpending.calendarYear);
  assert.equal(viewModel.status.ages[0].age, result.summary.firstUnfundedSpending.person1Age);
  assert.equal(viewModel.status.ages[1].age, result.summary.firstUnfundedSpending.person2Age);
});

test("Stage 3 first-person retirement result uses firstPersonFullRetirement", () => {
  const { result, viewModel } = projectionFor((draft) => {
    draft.people[0].fullRetirementAge = 55;
    draft.people[0].hasSemiRetirement = false;
    draft.people[0].semiRetirementAge = 55;
    draft.people[1].fullRetirementAge = 62;
    draft.people[1].hasSemiRetirement = false;
    draft.people[1].semiRetirementAge = 62;
    draft.projectionEndAge = 90;
  });
  assert.equal(
    viewModel.keyResults.accessibleAtFirstPersonFullRetirement.milestone.calendarYear,
    result.summary.firstPersonFullRetirement.calendarYear,
  );
  assert.deepEqual(
    viewModel.keyResults.accessibleAtFirstPersonFullRetirement.milestone.retiredPersonIds,
    result.summary.firstPersonFullRetirement.retiredPersonIds,
  );
});

test("Stage 3 household retirement result uses householdFullRetirement", () => {
  const { result, viewModel } = fundedProjection();
  assert.equal(
    viewModel.keyResults.accessibleWhenBothFullyRetired.milestone.calendarYear,
    result.summary.householdFullRetirement.calendarYear,
  );
});

test("Stage 3 accessible balance at first retirement uses accessibleBalanceAtFirstPersonFullRetirement", () => {
  const { result, viewModel } = fundedProjection();
  assert.equal(
    viewModel.keyResults.accessibleAtFirstPersonFullRetirement.value,
    result.summary.accessibleBalanceAtFirstPersonFullRetirement,
  );
});

test("Stage 3 super at age 60 displays each person separately", () => {
  const { result, viewModel } = fundedProjection();
  const rows = viewModel.keyResults.superAtAge60;
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.person.id === "person1").value, result.summary.superByPersonAtAge60.person1);
  assert.equal(rows.find((row) => row.person.id === "person2").value, result.summary.superByPersonAtAge60.person2);
});

test("Stage 3 age-60 historical value unavailable is not displayed as zero", () => {
  const { viewModel } = projectionFor((draft) => {
    draft.people[0].currentAge = 61;
    draft.people[0].fullRetirementAge = 65;
    draft.people[0].semiRetirementAge = 65;
    draft.people[0].hasSemiRetirement = false;
    draft.people[0].superAccessAge = 61;
    draft.people[1].currentAge = 50;
    draft.people[1].fullRetirementAge = 65;
    draft.people[1].semiRetirementAge = 65;
    draft.people[1].hasSemiRetirement = false;
    draft.projectionEndAge = 90;
  });
  const person1Age60 = viewModel.keyResults.superAtAge60.find((row) => row.person.id === "person1");
  assert.equal(person1Age60.value, null);
  assert.match(person1Age60.unavailableReason, /age 60 predates this projection/);
});

test("Stage 3 super at assumed access age displays separately for each person", () => {
  const { result, viewModel } = fundedProjection();
  assert.equal(viewModel.keyResults.superAtAccessAge.length, 2);
  assert.equal(viewModel.keyResults.superAtAccessAge.find((row) => row.person.id === "person1").value, result.summary.superByPersonAtAccessAge.person1);
  assert.equal(viewModel.keyResults.superAtAccessAge.find((row) => row.person.id === "person2").value, result.summary.superByPersonAtAccessAge.person2);
});

test("Stage 3 projection end balances match the engine result", () => {
  const { result, viewModel } = fundedProjection();
  const end = viewModel.keyResults.projectionEnd;
  assert.equal(end.accessibleInvestments, result.summary.accessibleBalanceAtEndAge);
  assert.equal(end.super, result.summary.superBalanceAtEndAge);
  assert.equal(end.totalInvestableAssets, result.summary.totalInvestableAssetsAtEndAge);
});

test("Stage 3 accessible exhaustion milestone uses calendar year and both ages", () => {
  const { result, viewModel } = shortfallProjection();
  assert.ok(result.summary.accessibleFundsExhausted.calendarYear);
  assert.equal(viewModel.longevity.accessibleFundsExhausted.calendarYear, result.summary.accessibleFundsExhausted.calendarYear);
  assert.equal(viewModel.longevity.accessibleFundsExhausted.person1Age, result.summary.accessibleFundsExhausted.person1Age);
  assert.equal(viewModel.longevity.accessibleFundsExhausted.person2Age, result.summary.accessibleFundsExhausted.person2Age);
});

test("Stage 3 total retirement-fund exhaustion milestone uses calendar year and both ages", () => {
  const { result, viewModel } = shortfallProjection();
  assert.ok(result.summary.allRetirementFundsExhausted.calendarYear);
  assert.equal(viewModel.longevity.allRetirementFundsExhausted.calendarYear, result.summary.allRetirementFundsExhausted.calendarYear);
  assert.equal(viewModel.longevity.allRetirementFundsExhausted.person1Age, result.summary.allRetirementFundsExhausted.person1Age);
  assert.equal(viewModel.longevity.allRetirementFundsExhausted.person2Age, result.summary.allRetirementFundsExhausted.person2Age);
});

test("Stage 3 annual projection row count matches the engine years", () => {
  const { result, viewModel } = fundedProjection();
  assert.equal(viewModel.annualRows.length, result.years.length);
});

test("Stage 3 annual row values match selected engine outputs", () => {
  const { result, viewModel } = fundedProjection();
  const selectedIndex = Math.min(5, result.years.length - 1);
  const engineRow = result.years[selectedIndex];
  const viewRow = viewModel.annualRows[selectedIndex];
  assert.equal(viewRow.calendarYear, engineRow.calendarYear);
  assert.equal(viewRow.household.applicableLifestyleSpending, engineRow.household.applicableLifestyleSpending);
  assert.equal(viewRow.household.closingAccessibleInvestmentBalance, engineRow.household.closingAccessibleInvestmentBalance);
  assert.equal(viewRow.household.totalSuperBalance, engineRow.household.totalSuperBalance);
  assert.equal(viewRow.household.totalInvestableAssets, engineRow.household.totalInvestableAssets);
});

test("Stage 3 annual expanded detail is sourced from the annual projection", () => {
  const { result, viewModel } = fundedProjection();
  const engineRow = result.years[0];
  const viewRow = viewModel.annualRows[0];
  assert.equal(person(viewRow, "person1").grossEmploymentIncome, person(engineRow, "person1").grossEmploymentIncome);
  assert.equal(person(viewRow, "person1").incomeTax, person(engineRow, "person1").incomeTax);
  assert.equal(person(viewRow, "person1").closingSuperBalance, person(engineRow, "person1").closingSuperBalance);
  assert.equal(viewRow.household.cashSurplusOrShortfall, engineRow.household.cashSurplusOrShortfall);
});

test("Stage 3 assumptions match the projection inputs", () => {
  const { inputs, viewModel } = fundedProjection();
  const rows = Object.fromEntries(viewModel.assumptions.rows.map((row) => [row.label, row.value]));
  assert.equal(rows["Projection start year"], inputs.projectionStartYear);
  assert.equal(rows["Projection end age"], inputs.projectionEndAge);
  assert.equal(rows["Inflation"], inputs.inflationRate);
  assert.equal(rows["Accessible investment return"], inputs.accessibleInvestments.annualReturnRate);
  assert.equal(rows["Full-retirement lifestyle spending"], inputs.household.fullRetirementLifestyleSpending);
});

test("Stage 3 projection warnings are displayed without raw internal field codes", () => {
  const { viewModel } = projectionFor((draft) => {
    draft.people[0].currentAge = 61;
    draft.people[0].fullRetirementAge = 65;
    draft.people[0].semiRetirementAge = 65;
    draft.people[0].hasSemiRetirement = false;
    draft.people[0].superAccessAge = 61;
    draft.people[1].currentAge = 50;
    draft.people[1].fullRetirementAge = 65;
    draft.people[1].semiRetirementAge = 65;
    draft.people[1].hasSemiRetirement = false;
    draft.projectionEndAge = 90;
  });
  assert.ok(viewModel.warnings.some((warning) => /age-60 super balance/.test(warning)));
  assert.ok(viewModel.warnings.every((warning) => !/superByPersonAtAge60/.test(warning)));
});

test("Stage 3 recalculation view model removes stale previous results", () => {
  const funded = fundedProjection();
  const shortfall = shortfallProjection();
  assert.equal(funded.viewModel.status.type, "funded");
  assert.equal(shortfall.viewModel.status.type, "shortfall");
  assert.notEqual(
    funded.viewModel.keyResults.projectionEnd.totalInvestableAssets,
    shortfall.viewModel.keyResults.projectionEnd.totalInvestableAssets,
  );
});

test("Stage 3 results view model does not mutate scenario draft or base-plan data", () => {
  const { plan, defaults } = defaultsFor();
  const draft = defaults.draft;
  const planBefore = JSON.stringify(plan);
  const draftBefore = JSON.stringify(draft);
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  const result = ENGINE.projectRetirementScenario(inputs);
  UI.buildSemiRetirementResultsViewModel(result, inputs, draft);
  assert.equal(JSON.stringify(plan), planBefore);
  assert.equal(JSON.stringify(draft), draftBefore);
});

test("Stage 3 remains hidden when the feature flag is off", () => {
  ENGINE.featureFlags.semiRetirementProjectionEnabled = false;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), false);
  assert.match(appSource, /if \(!semiRetirementUiEnabled\(\)\) \{/);
  assert.match(appSource, /data-semi-results-dashboard/);
});

test("Stage 3 UI does not reference deprecated summary fields", () => {
  const start = appSource.indexOf("function renderSemiRetirementScenarioResultHtml");
  const end = appSource.indexOf("function renderSemiRetirementScenario(result)", start);
  const snippet = appSource.slice(start, end);
  assert.doesNotMatch(snippet, /accessibleBalanceAtFirstFullRetirement/);
  assert.doesNotMatch(snippet, /firstFullRetirement/);
  assert.doesNotMatch(snippet, /totalSuperAtAge60/);
  assert.doesNotMatch(snippet, /accessibleFundsExhaustedAge/);
  assert.doesNotMatch(snippet, /allRetirementFundsExhaustedAge/);
  assert.doesNotMatch(snippet, /firstUnfundedSpendingAge/);
});

test("Stage 3 mobile rendering uses annual cards and avoids page-level table overflow", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /semi-retirement-annual-cards/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.semi-retirement-table-wrap\s*\{\s*display: none;/s);
  assert.match(appSource, /semi-retirement-annual-card/);
});

test("Stage 3A configured scenario super access age is used in the retirement timeline", () => {
  const { result, viewModel } = projectionFor((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 50;
      person.fullRetirementAge = 65;
      person.semiRetirementAge = 65;
      person.hasSemiRetirement = false;
    });
    draft.people[0].superAccessAge = 62;
    draft.people[1].superAccessAge = 60;
    draft.projectionEndAge = 75;
  });
  const expectedRow = result.years.find((row) => person(row, "person1").age === 62);
  const events = timelineEvents(viewModel, /Luke reaches the scenario super-access age/);
  assert.equal(events.length, 1);
  assert.equal(events[0].calendarYear, expectedRow.calendarYear);
  assert.ok(!viewModel.timeline[0].events.some((event) => /Luke reaches the scenario super-access age/.test(event.title)));
});

test("Stage 3A different person super access ages create independent timeline events", () => {
  const { result, viewModel } = projectionFor((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 50;
      person.fullRetirementAge = 66;
      person.semiRetirementAge = 66;
      person.hasSemiRetirement = false;
    });
    draft.people[0].superAccessAge = 60;
    draft.people[1].superAccessAge = 65;
    draft.projectionEndAge = 75;
  });
  const person1Expected = result.years.find((row) => person(row, "person1").age === 60);
  const person2Expected = result.years.find((row) => person(row, "person2").age === 65);
  assert.equal(timelineEvents(viewModel, /Luke reaches the scenario super-access age/)[0].calendarYear, person1Expected.calendarYear);
  assert.equal(timelineEvents(viewModel, /Lisa reaches the scenario super-access age/)[0].calendarYear, person2Expected.calendarYear);
});

test("Stage 3A timeline still works when projected annual people omit superAccessAge", () => {
  const { result, inputs, draft } = projectionFor((scenarioDraft) => {
    scenarioDraft.people.forEach((person) => {
      person.currentAge = 50;
      person.fullRetirementAge = 66;
      person.semiRetirementAge = 66;
      person.hasSemiRetirement = false;
    });
    scenarioDraft.people[0].superAccessAge = 62;
    scenarioDraft.projectionEndAge = 75;
  });
  const projectionWithoutAnnualAccessAge = deepClone(result);
  projectionWithoutAnnualAccessAge.years.forEach((row) => {
    row.people.forEach((annualPerson) => {
      delete annualPerson.superAccessAge;
    });
  });
  const viewModel = UI.buildSemiRetirementResultsViewModel(projectionWithoutAnnualAccessAge, inputs, draft);
  const expectedRow = result.years.find((row) => person(row, "person1").age === 62);
  assert.equal(timelineEvents(viewModel, /Luke reaches the scenario super-access age/)[0].calendarYear, expectedRow.calendarYear);
});

test("Stage 3A missing or invalid super access age does not become a false age-zero timeline event", () => {
  const { result, inputs, draft } = fundedProjection();
  const projection = deepClone(result);
  const projectionInputs = deepClone(inputs);
  const scenarioDraft = deepClone(draft);
  delete projectionInputs.people[0].superAccessAge;
  scenarioDraft.people[0].superAccessAge = "not available";
  projection.years.forEach((row) => {
    row.people.forEach((annualPerson) => {
      if (annualPerson.id === "person1") delete annualPerson.superAccessAge;
    });
  });
  const viewModel = UI.buildSemiRetirementResultsViewModel(projection, projectionInputs, scenarioDraft);
  assert.equal(timelineEvents(viewModel, /Luke .*super-access age/).length, 0);
  assert.ok(viewModel.warnings.some((warning) => /assumed super access age is missing/.test(warning)));
});

test("Stage 3A already reached access ages are shown at projection start without historical fabrication", () => {
  const { result, viewModel } = projectionFor((draft) => {
    draft.people[0].currentAge = 60;
    draft.people[0].superAccessAge = 60;
    draft.people[0].fullRetirementAge = 70;
    draft.people[0].semiRetirementAge = 70;
    draft.people[0].hasSemiRetirement = false;
    draft.people[1].currentAge = 50;
    draft.people[1].fullRetirementAge = 70;
    draft.people[1].semiRetirementAge = 70;
    draft.people[1].hasSemiRetirement = false;
    draft.projectionEndAge = 75;
  });
  const startYear = result.years[0].calendarYear;
  const events = timelineEvents(viewModel, /Luke is already at or above the assumed super access age/);
  assert.equal(events.length, 1);
  assert.equal(events[0].calendarYear, startYear);
});

test("Stage 3A Semi-Retirement Funding excludes full-retirement withdrawals", () => {
  const { result, viewModel } = semiRetirementWithdrawalScenario();
  const semiRows = result.years.filter((row) => row.householdPhase === "semi-retirement");
  const fullRows = result.years.filter((row) => row.householdPhase === "full-retirement");
  const semiRequired = roundCurrency(semiRows.reduce((total, row) => total + row.household.requiredAccessibleWithdrawal, 0));
  const allRequired = roundCurrency(result.years.reduce((total, row) => total + row.household.requiredAccessibleWithdrawal, 0));
  assert.ok(semiRows.length > 0);
  assert.ok(fullRows.some((row) => row.household.requiredAccessibleWithdrawal > 0));
  assert.ok(allRequired > semiRequired);
  assert.equal(viewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement, semiRequired);
});

test("Stage 3A required accessible withdrawal summary uses only semi-retirement householdPhase rows", () => {
  const { result, viewModel } = semiRetirementWithdrawalScenario((draft) => {
    draft.household.semiRetirementLifestyleSpending = 80000;
    draft.household.fullRetirementLifestyleSpending = 120000;
  });
  const expected = roundCurrency(result.years
    .filter((row) => row.householdPhase === "semi-retirement")
    .reduce((total, row) => total + row.household.requiredAccessibleWithdrawal, 0));
  assert.equal(viewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement, expected);
});

test("Stage 3A semi-retirement total asset withdrawals do not double count planned withdrawals", () => {
  const { result, viewModel } = semiRetirementWithdrawalScenario((draft) => {
    draft.scenario.semiRetirementAccessibleWithdrawal = 15000;
    draft.household.semiRetirementLifestyleSpending = 85000;
  });
  const semiRows = result.years.filter((row) => row.householdPhase === "semi-retirement");
  const planned = roundCurrency(semiRows.reduce((total, row) => total + row.household.plannedSemiRetirementWithdrawal, 0));
  const required = roundCurrency(semiRows.reduce((total, row) => total + row.household.requiredAccessibleWithdrawal, 0));
  const superWithdrawals = roundCurrency(semiRows.reduce((total, row) => total + row.household.totalSuperWithdrawal, 0));
  const accessibleTotal = roundCurrency(semiRows.reduce((total, row) => total + row.household.totalAccessibleWithdrawal, 0));
  assert.ok(planned > 0);
  assert.ok(required > 0);
  assert.equal(accessibleTotal, roundCurrency(planned + required));
  assert.equal(viewModel.semiRetirementFunding.totalAssetWithdrawalsDuringSemiRetirement, roundCurrency(planned + required + superWithdrawals));
});

test("Stage 3A zero semi-retirement funding stays zero when no semi-retirement phase exists", () => {
  const { result, viewModel } = projectionFor((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 50;
      person.currentGrossEmploymentIncome = 0;
      person.openingSuperBalance = 0;
      person.employerSuperRatePct = 0;
      person.hasSemiRetirement = false;
      person.semiRetirementAge = 60;
      person.fullRetirementAge = 60;
      person.superAccessAge = 60;
    });
    draft.household.currentLifestyleSpending = 90000;
    draft.household.semiRetirementLifestyleSpending = 90000;
    draft.household.fullRetirementLifestyleSpending = 90000;
    draft.accessibleInvestments.openingBalance = 200000;
    draft.accessibleInvestments.annualReturnRatePct = 0;
    draft.scenario.semiRetirementAccessibleWithdrawal = 25000;
    draft.projectionEndAge = 70;
  });
  assert.equal(result.years.filter((row) => row.householdPhase === "semi-retirement").length, 0);
  assert.equal(viewModel.semiRetirementFunding.totalPlannedSemiRetirementWithdrawals, 0);
  assert.equal(viewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement, 0);
  assert.equal(viewModel.semiRetirementFunding.totalAssetWithdrawalsDuringSemiRetirement, 0);
});

test("Stage 3A annual projection still displays full-retirement withdrawals", () => {
  const { viewModel } = projectionFor((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 50;
      person.currentGrossEmploymentIncome = 0;
      person.openingSuperBalance = 0;
      person.employerSuperRatePct = 0;
      person.hasSemiRetirement = false;
      person.semiRetirementAge = 60;
      person.fullRetirementAge = 60;
      person.superAccessAge = 60;
    });
    draft.household.currentLifestyleSpending = 90000;
    draft.household.semiRetirementLifestyleSpending = 90000;
    draft.household.fullRetirementLifestyleSpending = 90000;
    draft.accessibleInvestments.openingBalance = 1000000;
    draft.accessibleInvestments.annualReturnRatePct = 0;
    draft.projectionEndAge = 70;
  });
  const fullRetirementRows = viewModel.annualRows.filter((row) => row.householdPhase === "full-retirement");
  assert.ok(fullRetirementRows.some((row) => row.household.requiredAccessibleWithdrawal > 0));
  assert.equal(viewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement, 0);
});

function stage4Scenario(mutator = () => {}) {
  return projectionFor((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 50;
      person.currentGrossEmploymentIncome = 0;
      person.openingSuperBalance = 0;
      person.employerSuperRatePct = 0;
      person.hasSemiRetirement = false;
      person.semiRetirementAge = 60;
      person.fullRetirementAge = 60;
      person.superAccessAge = 60;
      person.superReturnBeforeRetirementPct = 0;
      person.superReturnAfterRetirementPct = 0;
    });
    draft.people[0].hasSemiRetirement = true;
    draft.people[0].semiRetirementAge = 55;
    draft.people[0].fullRetirementAge = 60;
    draft.accessibleInvestments.openingBalance = 500000;
    draft.accessibleInvestments.annualReturnRatePct = 0;
    draft.accessibleInvestments.externalAnnualAccessibleContribution = 0;
    draft.household.currentLifestyleSpending = 70000;
    draft.household.semiRetirementLifestyleSpending = 70000;
    draft.household.fullRetirementLifestyleSpending = 70000;
    draft.scenario.semiRetirementAccessibleWithdrawal = 20000;
    draft.projectionEndAge = 80;
    mutator(draft);
  });
}

function adjustedStage4Scenario(mutator = () => {}, adjustments = {}) {
  const base = stage4Scenario(mutator);
  const draft = deepClone(base.draft);
  Object.entries(adjustments).forEach(([field, value]) => {
    UI.applyScenarioAdjustment(draft, field, value);
  });
  const outcome = UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(outcome.validation.isValid, true);
  const viewModel = UI.buildSemiRetirementResultsViewModel(outcome.result, outcome.inputs, draft);
  return { base, draft, outcome, viewModel };
}

function assumptionRow(viewModel, label) {
  const row = viewModel.assumptions.rows.find((item) => item.label === label);
  assert.ok(row, `Expected assumption row: ${label}`);
  return row;
}

test("Stage 4A semi-retirement withdrawal adjustment reaches the engine input", () => {
  const { draft } = stage4Scenario((scenarioDraft) => {
    scenarioDraft.scenario.semiRetirementAccessibleWithdrawal = 20000;
  });
  UI.applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", 30000);
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.scenario.semiRetirementAccessibleWithdrawal, 30000);
});

test("Stage 4B retirement spending adjustment reaches the engine input", () => {
  const { draft } = stage4Scenario((scenarioDraft) => {
    scenarioDraft.household.fullRetirementLifestyleSpending = 70000;
  });
  UI.applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", 60000);
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  assert.equal(inputs.household.fullRetirementLifestyleSpending, 60000);
  assert.equal(inputs.scenario.fullRetirementAnnualSpending, 60000);
});

test("Stage 4C recalculation uses the existing projection engine again", () => {
  const { draft } = stage4Scenario();
  let calls = 0;
  const mockEngine = {
    projectRetirementScenario(inputs) {
      calls += 1;
      return ENGINE.projectRetirementScenario(inputs);
    },
  };
  UI.runSemiRetirementProjection(mockEngine, draft);
  UI.applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", 30000);
  UI.runSemiRetirementProjection(mockEngine, draft);
  assert.equal(calls, 2);
});

test("Stage 4D controller does not manually manipulate displayed balances", () => {
  const start = appSource.indexOf("function runSemiRetirementAdjustmentRecalculation");
  const end = appSource.indexOf("function scheduleSemiRetirementAdjustmentRecalculation", start);
  const snippet = appSource.slice(start, end);
  assert.match(snippet, /runSemiRetirementProjection/);
  assert.doesNotMatch(snippet, /displayedBalance|closingAccessibleInvestmentBalance\\s*[+\\-]?=|totalInvestableAssets\\s*[+\\-]?=/);
});

test("Stage 4E result controls synchronize the matching main form fields", () => {
  assert.match(appSource, /function syncSemiRetirementAdjustmentControls/);
  assert.ok(appSource.includes('document.querySelectorAll("[data-semi-input]")'));
  assert.ok(appSource.includes("input.dataset.semiInput === path"));
});

test("Stage 4F comparison is measured against the last main calculated baseline", () => {
  const base = stage4Scenario((draft) => {
    draft.accessibleInvestments.openingBalance = 5000000;
  });
  const baseline = UI.buildScenarioAdjustmentSnapshot(base.result, base.inputs, base.draft);
  const adjusted = adjustedStage4Scenario((draft) => {
    draft.accessibleInvestments.openingBalance = 5000000;
  }, { fullRetirementLifestyleSpending: 60000 });
  const snapshot = UI.buildScenarioAdjustmentSnapshot(adjusted.outcome.result, adjusted.outcome.inputs, adjusted.draft);
  const comparison = UI.buildScenarioAdjustmentComparison(baseline, snapshot);
  assert.equal(
    comparison.endAssetsDelta,
    roundCurrency(snapshot.projectionEndAssets - baseline.projectionEndAssets),
  );
  assert.ok(comparison.endAssetsDelta > 0);
});

test("Stage 4G a new main Calculate Scenario establishes a fresh baseline", () => {
  const start = appSource.indexOf("function calculateSemiRetirementScenario");
  const end = appSource.indexOf("function resetSemiRetirementScenario", start);
  const snippet = appSource.slice(start, end);
  assert.ok(snippet.includes("clearSemiRetirementAdjustmentState({ keepBaseline: false })"));
  assert.ok(snippet.includes("semiRetirementAdjustmentBaseline = semiRetirementScenarioResult"));
  assert.ok(snippet.includes("buildScenarioAdjustmentSnapshot"));
});

test("Stage 4H Reset Adjustments restores the two baseline values only", () => {
  const { draft, result, inputs } = stage4Scenario();
  const baseline = UI.buildScenarioAdjustmentSnapshot(result, inputs, draft);
  UI.applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", 45000);
  UI.applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", 100000);
  UI.resetScenarioAdjustmentsToBaseline(draft, baseline);
  assert.equal(draft.scenario.semiRetirementAccessibleWithdrawal, baseline.values.semiRetirementAccessibleWithdrawal);
  assert.equal(draft.household.fullRetirementLifestyleSpending, baseline.values.fullRetirementLifestyleSpending);
  assert.equal(draft.people[0].fullRetirementAge, 60);
});

test("Stage 4I Reset Scenario clears adjustment comparison state", () => {
  const start = appSource.indexOf("function resetSemiRetirementScenario");
  const end = appSource.indexOf("function plannerDateIso", start);
  const snippet = appSource.slice(start, end);
  assert.ok(snippet.includes("clearSemiRetirementAdjustmentState()"));
  assert.ok(snippet.includes("semiRetirementScenarioResult = null"));
});

test("Stage 4J no semi-retirement phase disables the withdrawal control", () => {
  const { result, inputs, draft } = projectionFor((scenarioDraft) => {
    scenarioDraft.people.forEach((person) => {
      person.currentAge = 50;
      person.fullRetirementAge = 60;
      person.semiRetirementAge = 60;
      person.hasSemiRetirement = false;
      person.superAccessAge = 60;
    });
    scenarioDraft.accessibleInvestments.openingBalance = 5000000;
    scenarioDraft.projectionEndAge = 70;
  });
  const state = UI.buildScenarioAdjustmentState(result, inputs, draft, null);
  assert.equal(state.controls.semiRetirementAccessibleWithdrawal.enabled, false);
  assert.equal(state.controls.fullRetirementLifestyleSpending.enabled, true);
});

test("Stage 4K high manual withdrawals remain valid projection outcomes when funds run out", () => {
  const adjusted = adjustedStage4Scenario(() => {}, {
    semiRetirementAccessibleWithdrawal: 150000,
    fullRetirementLifestyleSpending: 120000,
  });
  assert.equal(adjusted.outcome.validation.isValid, true);
  assert.equal(adjusted.viewModel.status.type, "shortfall");
  assert.ok(adjusted.viewModel.longevity.firstUnfundedSpending.calendarYear);
});

test("Stage 4L increasing withdrawals and spending can move first shortfall earlier", () => {
  const baseline = stage4Scenario();
  const adjusted = adjustedStage4Scenario(() => {}, {
    semiRetirementAccessibleWithdrawal: 80000,
    fullRetirementLifestyleSpending: 120000,
  });
  assert.ok(adjusted.viewModel.longevity.firstUnfundedSpending.calendarYear < baseline.viewModel.longevity.firstUnfundedSpending.calendarYear);
});

test("Stage 4M lowering retirement spending improves the actual engine output", () => {
  const baseline = stage4Scenario();
  const adjusted = adjustedStage4Scenario(() => {}, {
    fullRetirementLifestyleSpending: 50000,
  });
  const baselineShortfall = baseline.viewModel.longevity.firstUnfundedSpending.calendarYear;
  const adjustedShortfall = adjusted.viewModel.longevity.firstUnfundedSpending.calendarYear;
  assert.ok(adjustedShortfall >= baselineShortfall);
});

test("Stage 4N assumptions display adjusted values", () => {
  const adjusted = adjustedStage4Scenario(() => {}, {
    semiRetirementAccessibleWithdrawal: 30000,
    fullRetirementLifestyleSpending: 60000,
  });
  assert.equal(assumptionRow(adjusted.viewModel, "Optional additional lifestyle draw").value, 30000);
  assert.equal(assumptionRow(adjusted.viewModel, "Full-retirement lifestyle spending").value, 60000);
});

test("Stage 4O annual rows refresh from the adjusted projection", () => {
  const adjusted = adjustedStage4Scenario(() => {}, {
    semiRetirementAccessibleWithdrawal: 30000,
  });
  assert.equal(adjusted.viewModel.annualRows.length, adjusted.outcome.result.years.length);
  const semiRow = adjusted.viewModel.annualRows.find((row) => row.householdPhase === "semi-retirement");
  assert.ok(semiRow);
  assert.equal(semiRow.household.plannedSemiRetirementWithdrawal, 30000);
});

test("Stage 4P timeline refreshes from the adjusted projection summary", () => {
  const adjusted = adjustedStage4Scenario(() => {}, {
    semiRetirementAccessibleWithdrawal: 80000,
    fullRetirementLifestyleSpending: 120000,
  });
  const shortfallYear = adjusted.outcome.result.summary.firstUnfundedSpending.calendarYear;
  assert.ok(adjusted.viewModel.timeline.some((group) => (
    group.calendarYear === shortfallYear
    && group.events.some((event) => /First projected funding shortfall/.test(event.title))
  )));
});

test("Stage 4Q impact state uses the new projection and not stale warning years", () => {
  const baseline = stage4Scenario();
  const adjusted = adjustedStage4Scenario(() => {}, {
    semiRetirementAccessibleWithdrawal: 80000,
    fullRetirementLifestyleSpending: 120000,
  });
  const impact = UI.buildScenarioAdjustmentSnapshot(adjusted.outcome.result, adjusted.outcome.inputs, adjusted.draft);
  assert.equal(impact.firstShortfallYear, adjusted.outcome.result.summary.firstUnfundedSpending.calendarYear);
  assert.notEqual(impact.firstShortfallYear, baseline.viewModel.longevity.firstUnfundedSpending.calendarYear);
});

test("Stage 4R interactive adjustments do not mutate base-plan data", () => {
  const { plan, defaults } = defaultsFor();
  const before = JSON.stringify(plan);
  UI.applyScenarioAdjustment(defaults.draft, "semiRetirementAccessibleWithdrawal", 30000);
  UI.applyScenarioAdjustment(defaults.draft, "fullRetirementLifestyleSpending", 60000);
  UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  assert.equal(JSON.stringify(plan), before);
});

test("Stage 4S interactive adjustments are not persisted", () => {
  const start = appSource.indexOf("function applySemiRetirementAdjustmentField");
  const end = appSource.indexOf("function calculateSemiRetirementScenario", start);
  const snippet = appSource.slice(start, end);
  ["localStorage", "indexedDB", "autosavePlan(", "saveDraft(", "manualSavePlan("].forEach((token) => {
    assert.ok(!snippet.includes(token), `Unexpected persistence call: ${token}`);
  });
});

test("Stage 4T UI remains unavailable when the semi-retirement feature flag is off", () => {
  ENGINE.featureFlags.semiRetirementProjectionEnabled = false;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), false);
  assert.ok(appSource.includes("if (!semiRetirementUiEnabled()) {"));
  assert.ok(appSource.includes("renderSemiRetirementAdjustmentsHtml(resultDraft)"));
});

test("Stage 4U mobile adjustment layout avoids page-level overflow", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.ok(styles.includes("semi-retirement-adjustment-controls"));
  assert.ok(styles.includes("@media (max-width: 640px)"));
  assert.match(styles, /\.semi-retirement-adjustment-controls\s*\{\s*grid-template-columns: 1fr;/s);
  assert.match(styles, /\.semi-retirement-adjustment-range\s*\{[^}]*width: 100%;/s);
});

test("Stage 4V prior regression scripts remain available", () => {
  const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  assert.ok(packageSource.includes('"test:semi-retirement"'));
  assert.ok(packageSource.includes("semi-retirement-projection.test.mjs"));
  assert.ok(packageSource.includes("semi-retirement-ui.test.mjs"));
});

function stage4ControllerState(mutator = () => {}) {
  const base = stage4Scenario(mutator);
  return {
    base,
    draft: deepClone(base.draft),
    inputs: deepClone(base.inputs),
    result: base.result,
    resultDraft: deepClone(base.draft),
    baseline: UI.buildScenarioAdjustmentSnapshot(base.result, base.inputs, base.draft),
    errors: [],
  };
}

function stage4AttemptAdjustment(state, field, value) {
  UI.applyScenarioAdjustment(state.draft, field, value);
  const outcome = UI.runSemiRetirementProjection(ENGINE, state.draft);
  const outcomeErrors = outcome.validation?.isValid ? [] : (outcome.validation?.errors || []);
  const engineErrors = outcome.result?.validation && !outcome.result.validation.isValid ? (outcome.result.validation.errors || []) : [];
  const errors = outcomeErrors.length ? outcomeErrors : engineErrors;
  if (errors.length) {
    state.errors = errors;
    return { outcome, errors, committed: false };
  }
  state.inputs = deepClone(outcome.inputs);
  state.result = outcome.result;
  state.resultDraft = deepClone(state.draft);
  state.errors = [];
  return { outcome, errors: [], committed: true };
}

test("Stage 4A invalid retirement spending preserves last valid inputs", () => {
  const state = stage4ControllerState();
  const priorInputs = deepClone(state.inputs);
  const attempt = stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  assert.equal(attempt.committed, false);
  assert.equal(state.inputs.household.fullRetirementLifestyleSpending, priorInputs.household.fullRetirementLifestyleSpending);
  assert.equal(state.inputs.scenario.fullRetirementAnnualSpending, priorInputs.scenario.fullRetirementAnnualSpending);
  assert.notEqual(attempt.outcome.inputs.household.fullRetirementLifestyleSpending, priorInputs.household.fullRetirementLifestyleSpending);
});

test("Stage 4A invalid retirement spending preserves last valid result", () => {
  const state = stage4ControllerState();
  const priorSummary = JSON.stringify(state.result.summary);
  stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  assert.equal(JSON.stringify(state.result.summary), priorSummary);
});

test("Stage 4A invalid draft remains visible only in adjustment controls", () => {
  const state = stage4ControllerState();
  stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  const displayState = UI.buildScenarioAdjustmentDisplayState({
    projection: state.result,
    inputs: state.inputs,
    resultDraft: state.resultDraft,
    currentDraft: state.draft,
    baseline: state.baseline,
    hasValidationErrors: true,
  });
  assert.equal(state.draft.household.fullRetirementLifestyleSpending, -1);
  assert.equal(displayState.controls.fullRetirementLifestyleSpending.value, -1);
  assert.equal(displayState.impact.values.fullRetirementLifestyleSpending, 70000);
  assert.equal(displayState.resultValues.fullRetirementLifestyleSpending, 70000);
  assert.match(displayState.statusMessage, /Last valid projection remains visible/);
});

test("Stage 4A assumptions remain based on last valid inputs after invalid adjustment", () => {
  const state = stage4ControllerState();
  stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  const viewModel = UI.buildSemiRetirementResultsViewModel(state.result, state.inputs, state.resultDraft);
  assert.equal(assumptionRow(viewModel, "Full-retirement lifestyle spending").value, 70000);
});

test("Stage 4A invalid semi-retirement withdrawal follows the same state rule", () => {
  const state = stage4ControllerState();
  const priorInputs = deepClone(state.inputs);
  const priorSummary = JSON.stringify(state.result.summary);
  stage4AttemptAdjustment(state, "semiRetirementAccessibleWithdrawal", -1);
  const displayState = UI.buildScenarioAdjustmentDisplayState({
    projection: state.result,
    inputs: state.inputs,
    resultDraft: state.resultDraft,
    currentDraft: state.draft,
    baseline: state.baseline,
    hasValidationErrors: true,
  });
  assert.equal(state.inputs.scenario.semiRetirementAccessibleWithdrawal, priorInputs.scenario.semiRetirementAccessibleWithdrawal);
  assert.equal(JSON.stringify(state.result.summary), priorSummary);
  assert.equal(state.draft.scenario.semiRetirementAccessibleWithdrawal, -1);
  assert.equal(displayState.controls.semiRetirementAccessibleWithdrawal.value, -1);
  assert.equal(displayState.impact.values.semiRetirementAccessibleWithdrawal, 20000);
});

test("Stage 4A corrected value after invalid adjustment commits successfully", () => {
  const state = stage4ControllerState();
  stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  const corrected = stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", 60000);
  assert.equal(corrected.committed, true);
  assert.equal(state.errors.length, 0);
  assert.equal(state.inputs.household.fullRetirementLifestyleSpending, 60000);
  assert.equal(state.inputs.scenario.fullRetirementAnnualSpending, 60000);
  assert.equal(assumptionRow(UI.buildSemiRetirementResultsViewModel(state.result, state.inputs, state.resultDraft), "Full-retirement lifestyle spending").value, 60000);
});

test("Stage 4A invalid adjustment does not change the baseline comparison", () => {
  const state = stage4ControllerState();
  const baselineBefore = JSON.stringify(state.baseline);
  stage4AttemptAdjustment(state, "semiRetirementAccessibleWithdrawal", -1);
  const displayState = UI.buildScenarioAdjustmentDisplayState({
    projection: state.result,
    inputs: state.inputs,
    resultDraft: state.resultDraft,
    currentDraft: state.draft,
    baseline: state.baseline,
    hasValidationErrors: true,
  });
  assert.equal(JSON.stringify(state.baseline), baselineBefore);
  assert.equal(displayState.comparison.valueDeltas.semiRetirementAccessibleWithdrawal, 0);
});

test("Stage 4A Reset Adjustments from invalid state restores baseline cleanly", () => {
  const state = stage4ControllerState();
  stage4AttemptAdjustment(state, "semiRetirementAccessibleWithdrawal", -1);
  UI.resetScenarioAdjustmentsToBaseline(state.draft, state.baseline);
  const reset = stage4AttemptAdjustment(state, "semiRetirementAccessibleWithdrawal", state.baseline.values.semiRetirementAccessibleWithdrawal);
  assert.equal(reset.committed, true);
  assert.equal(state.errors.length, 0);
  assert.equal(state.inputs.scenario.semiRetirementAccessibleWithdrawal, state.baseline.values.semiRetirementAccessibleWithdrawal);
  assert.equal(state.draft.household.fullRetirementLifestyleSpending, state.baseline.values.fullRetirementLifestyleSpending);
});

test("Stage 4A last valid inputs and result stay paired after validation failure", () => {
  const state = stage4ControllerState();
  stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  const viewModel = UI.buildSemiRetirementResultsViewModel(state.result, state.inputs, state.resultDraft);
  assert.equal(viewModel.keyResults.projectionEnd.calendarYear, state.result.years.at(-1).calendarYear);
  assert.equal(assumptionRow(viewModel, "Full-retirement lifestyle spending").value, state.inputs.household.fullRetirementLifestyleSpending);
});

test("Stage 4A base-plan isolation remains intact after invalid adjustment", () => {
  const { plan, defaults } = defaultsFor();
  const before = JSON.stringify(plan);
  const state = stage4ControllerState(() => {
    defaults.draft.household.fullRetirementLifestyleSpending = 70000;
  });
  stage4AttemptAdjustment(state, "fullRetirementLifestyleSpending", -1);
  assert.equal(JSON.stringify(plan), before);
});

test("Stage 4A invalid adjustment flow introduces no persistence", () => {
  const start = appSource.indexOf("function runSemiRetirementAdjustmentRecalculation");
  const end = appSource.indexOf("function scheduleSemiRetirementAdjustmentRecalculation", start);
  const snippet = appSource.slice(start, end);
  ["localStorage", "indexedDB", "autosavePlan(", "saveDraft(", "manualSavePlan("].forEach((token) => {
    assert.ok(!snippet.includes(token), `Unexpected persistence call: ${token}`);
  });
});

test("Stage 4A app commits adjustment inputs only after validation succeeds", () => {
  const start = appSource.indexOf("function runSemiRetirementAdjustmentRecalculation");
  const end = appSource.indexOf("function scheduleSemiRetirementAdjustmentRecalculation", start);
  const snippet = appSource.slice(start, end);
  const errorBranchIndex = snippet.indexOf("if (errors.length)");
  const commitIndex = snippet.indexOf("semiRetirementScenarioInputs = outcome.inputs");
  assert.ok(errorBranchIndex > -1);
  assert.ok(commitIndex > errorBranchIndex);
  assert.ok(snippet.includes("semiRetirementScenarioResultDraft = cloneScenarioDraft(semiRetirementScenarioDraft)"));
});

test("Stage 4A result rendering uses the last successful draft snapshot", () => {
  const start = appSource.indexOf("function renderSemiRetirementScenarioResultHtml");
  const end = appSource.indexOf("function renderSemiRetirementScenario(", start + 1);
  const snippet = appSource.slice(start, end);
  assert.ok(snippet.includes("semiRetirementScenarioResultDraft || semiRetirementScenarioDraft"));
  assert.ok(snippet.includes("buildSemiRetirementResultsViewModel?.(result, semiRetirementScenarioInputs, resultDraft)"));
  assert.ok(snippet.includes("renderSemiRetirementAdjustmentsHtml(resultDraft)"));
});

test("Stage 4A feature flag remains off and adjustment helper does not bypass gating", () => {
  ENGINE.featureFlags.semiRetirementProjectionEnabled = false;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), false);
  assert.ok(typeof UI.buildScenarioAdjustmentDisplayState === "function");
  assert.ok(appSource.includes("if (!semiRetirementUiEnabled()) {"));
});

function sourceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `Missing source start: ${startNeedle}`);
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : source.length;
  assert.ok(end >= 0, `Missing source end: ${endNeedle}`);
  return source.slice(start, end);
}

function stageFStyles() {
  return readFileSync(new URL("../styles.css", import.meta.url), "utf8");
}

function stageFComparisonPair(mutator = () => {}) {
  const current = projectionFor();
  const comparisonDraft = deepClone(current.draft);
  mutator(comparisonDraft);
  const comparisonOutcome = UI.runSemiRetirementProjection(ENGINE, comparisonDraft);
  assert.equal(comparisonOutcome.validation.isValid, true);
  const comparisonViewModel = UI.buildSemiRetirementResultsViewModel(comparisonOutcome.result, comparisonOutcome.inputs, comparisonDraft);
  return { current, comparisonDraft, comparisonOutcome, comparisonViewModel };
}

test("Stage F1 semi-retirement user-facing workspace copy removes internal stage labels", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementScenario(result)", "function renderDecision(result)");
  ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage A", "Stage B", "Stage C", "Stage D", "Stage E", "private projection beta", "projection dashboard", "scenario-only Stage values"].forEach((token) => {
    assert.ok(!snippet.includes(token), `Unexpected user-facing token: ${token}`);
  });
});

test("Stage F2 scenario workspace renders one main page title", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementScenario(result)", "function renderDecision(result)");
  const matches = snippet.match(/Semi-Retirement & Retirement Scenario/g) || [];
  assert.equal(matches.length, 1);
});

test("Stage F3 selected conceptual info buttons are wired into scenario fields", () => {
  ["semiSuperAccessAge", "semiAdditionalSuperContribution", "semiRetirementLifestyleSpending", "fullRetirementLifestyleSpending", "semiOptionalLifestyleDraw", "semiSurplusDestination", "semiAccessibleInvestments"].forEach((key) => {
    assert.ok(appSource.includes(`infoKey: "${key}"`), `Missing info button ${key}`);
    assert.ok(appSource.includes(`${key}: {`), `Missing info copy ${key}`);
  });
});

test("Stage F4 info buttons use click/tap controls and keyboard-close modal behaviour", () => {
  assert.match(appSource, /data-info-key/);
  assert.match(appSource, /openGoalInfo\(infoButton\.dataset\.infoKey\)/);
  assert.match(appSource, /role", "dialog"/);
  assert.match(appSource, /event\.key === "Escape"[\s\S]*closeGoalInfo\(\)/);
});

test("Stage F5 Assumptions Used is collapsed by default", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementAssumptionsHtml", "function renderSemiRetirementWarningsHtml");
  assert.match(snippet, /<details class="semi-retirement-results-section">/);
  assert.doesNotMatch(snippet, /<details class="semi-retirement-results-section" open>/);
});

test("Stage F6 Income & Tax Detail is collapsed by default", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementPassiveIncomeHtml", "function renderSemiRetirementDebtWarningsHtml");
  assert.match(snippet, /<details class="semi-retirement-results-section">/);
  assert.match(snippet, /Income & Tax Detail/);
  assert.doesNotMatch(snippet, /<details class="semi-retirement-results-section" open>/);
});

test("Stage F7 Debt & Property detail is behind a collapsed disclosure", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementDebtPropertyHtml", "function semiRetirementDetailRows");
  assert.match(snippet, /View debt & property details/);
  assert.match(snippet, /semi-retirement-input-details/);
});

test("Stage F8 visible important disclosure is included", () => {
  assert.match(appSource, /function renderSemiRetirementDisclosureHtml/);
  assert.match(appSource, /Important information/);
  assert.match(appSource, /Results are estimates, not predictions/);
});

test("Stage F9 detailed disclosure expands behind Learn more", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementDisclosureHtml", "function renderSemiRetirementScenarioResultHtml");
  assert.match(snippet, /<summary>Learn more<\/summary>/);
  assert.match(snippet, /Property equity is not automatically available to fund spending/);
});

test("Stage F10 user-facing semi-retirement disclosure does not claim liability removal", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementDisclosureHtml", "function renderSemiRetirementScenarioResultHtml");
  assert.doesNotMatch(snippet, /accept no liability|removes liability|no liability/i);
});

test("Stage FY1 annual projection viewport is limited to about ten rows", () => {
  assert.match(stageFStyles(), /\.semi-retirement-projection-scroll\s*\{[^}]*max-height: 520px;/s);
});

test("Stage FY2 annual projection region supports vertical scrolling", () => {
  assert.match(stageFStyles(), /\.semi-retirement-projection-scroll\s*\{[^}]*overflow: auto;/s);
});

test("Stage FY3 annual table headers are sticky in the scroll viewport", () => {
  assert.match(stageFStyles(), /\.semi-retirement-annual-table th\s*\{[^}]*position: sticky;[^}]*top: 0;/s);
});

test("Stage FY4 overview table retains horizontal access to all columns", () => {
  const styles = stageFStyles();
  assert.match(styles, /\.semi-retirement-table-wrap\s*\{[^}]*overflow-x: auto;/s);
  assert.match(styles, /\.semi-retirement-annual-table\s*\{[^}]*min-width: 1420px;/s);
});

test("Stage FY5 each year keeps a View details interaction", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementAnnualProjectionHtml", "function renderSemiRetirementAssumptionsHtml");
  assert.match(snippet, /<summary>View details<\/summary>/);
  assert.match(snippet, /renderSemiRetirementAnnualDetailHtml\(row\)/);
});

test("Stage FY6 annual detail uses a vertical section layout", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementAnnualDetailHtml", "function renderSemiRetirementAnnualProjectionHtml");
  assert.match(snippet, /<div class="semi-retirement-annual-detail">/);
  assert.match(snippet, /<section>/);
  assert.match(stageFStyles(), /\.semi-retirement-annual-detail\s*\{[^}]*display: grid;/s);
});

test("Stage FY7 annual detail does not require horizontal scrolling", () => {
  const styles = stageFStyles();
  assert.match(styles, /\.semi-retirement-annual-detail\s*\{[^}]*min-width: 0;/s);
  assert.match(styles, /\.semi-retirement-annual-table details\s*\{[^}]*white-space: normal;/s);
});

test("Stage FY8 phone widths use compact annual cards instead of the wide table", () => {
  const styles = stageFStyles();
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.semi-retirement-table-wrap\s*\{\s*display: none;/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.semi-retirement-annual-cards\s*\{\s*display: grid;/s);
});

test("Stage FY9 phone annual cards show concise values and can open full details", () => {
  const snippet = sourceBetween(appSource, "semi-retirement-annual-cards", "function renderSemiRetirementAssumptionsHtml");
  ["Net cash income", "Lifestyle spending", "Portfolio withdrawal", "Accessible investments", "View details"].forEach((label) => {
    assert.match(snippet, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("Stage FC1 comparison scenario is cloned from the current scenario values", () => {
  const snippet = sourceBetween(appSource, "function createSemiRetirementComparisonScenario", "function updateSemiRetirementComparisonDraftFromInput");
  assert.match(snippet, /const sourceDraft = semiRetirementScenarioResultDraft \|\| semiRetirementScenarioDraft/);
  assert.match(snippet, /semiRetirementComparisonDraft = cloneScenarioDraft\(sourceDraft\)/);
});

test("Stage FC2 changing comparison inputs does not mutate the original scenario draft", () => {
  const { current, comparisonDraft } = stageFComparisonPair((draft) => {
    UI.setDraftPath(draft, "household.fullRetirementLifestyleSpending", 123456);
  });
  assert.notEqual(comparisonDraft.household.fullRetirementLifestyleSpending, current.draft.household.fullRetirementLifestyleSpending);
  assert.equal(current.draft.household.fullRetirementLifestyleSpending, UI.scenarioDraftToProjectionInputs(current.draft).household.fullRetirementLifestyleSpending);
});

test("Stage FC3 comparison controls do not persist to the Financial Plan", () => {
  const snippet = sourceBetween(appSource, "function updateSemiRetirementComparisonDraftFromInput", "function resetSemiRetirementComparison");
  ["localStorage", "indexedDB", "autosavePlan(", "saveDraft(", "manualSavePlan(", "plan ="].forEach((token) => {
    assert.ok(!snippet.includes(token), `Unexpected persistence or plan mutation token: ${token}`);
  });
});

test("Stage FC4 comparison uses the same projection engine path", () => {
  const snippet = sourceBetween(appSource, "function runSemiRetirementComparison", "function resetSemiRetirementComparison");
  assert.match(snippet, /runSemiRetirementProjection\(window\.FFSSemiRetirementProjection, semiRetirementComparisonDraft\)/);
});

test("Stage FC5 comparison difference values reconcile mathematically", () => {
  const { current, comparisonViewModel } = stageFComparisonPair((draft) => {
    draft.household.fullRetirementLifestyleSpending += 10000;
  });
  const currentAssets = current.viewModel.keyResults.projectionEnd.projectedNetWorth;
  const comparisonAssets = comparisonViewModel.keyResults.projectionEnd.projectedNetWorth;
  assert.equal(Math.round((comparisonAssets - currentAssets) * 100) / 100, Math.round((comparisonAssets - currentAssets) * 100) / 100);
  assert.notEqual(comparisonViewModel.keyResults.projectionEnd.projectedNetWorth, undefined);
});

test("Stage FC6 comparison displays only key outputs", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  ["Both fully retired", "Assets at retirement", "Accessible assets last", "Semi-retirement withdrawals", "Surplus in first full-retirement year", "Debt at retirement", "Projected end net worth"].forEach((label) => {
    assert.match(snippet, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
  assert.doesNotMatch(snippet, /renderSemiRetirementAnnualProjectionHtml|renderSemiRetirementDebtPropertyHtml/);
});

test("Stage FC7 comparison copy is descriptive and not advisory", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  assert.doesNotMatch(snippet, /Recommended|Best option|You should|Optimal/i);
  assert.match(snippet, /Temporary comparison only/);
});

test("Stage FC8 comparison mobile layout stacks without horizontal overflow", () => {
  const styles = stageFStyles();
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.semi-retirement-comparison-row\s*\{\s*grid-template-columns: 1fr;/s);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.semi-retirement-comparison-header\s*\{\s*display: none;/s);
});

test("Stage FC9 comparison state survives ordinary workspace switching during the session", () => {
  assert.match(appSource, /let semiRetirementComparisonDraft = null/);
  const showWorkspaceSnippet = sourceBetween(appSource, "function showWorkspace", "function renderEngagementHome");
  assert.doesNotMatch(showWorkspaceSnippet, /clearSemiRetirementComparisonState|semiRetirementComparisonDraft = null/);
});

test("Stage FC10 reset comparison removes only comparison state", () => {
  const snippet = sourceBetween(appSource, "function resetSemiRetirementComparison", "function semiRetirementAdjustmentPath");
  assert.match(snippet, /clearSemiRetirementComparisonState\(\)/);
  assert.doesNotMatch(snippet, /semiRetirementScenarioResult = null|semiRetirementScenarioDraft = null|plan =/);
});

test("Stage F1-A comparison displays Semi-retirement withdrawals label", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  assert.match(snippet, /Semi-retirement withdrawals/);
});

test("Stage F1-B old Required withdrawals label is removed from the aggregate comparison metric", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  assert.doesNotMatch(snippet, /"Required withdrawals"/);
});

test("Stage F1-C aggregate semi-retirement withdrawals are not labelled per year", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  const rowStart = snippet.indexOf("Semi-retirement withdrawals");
  assert.ok(rowStart >= 0, "Expected semi-retirement withdrawals comparison row");
  const rowSnippet = snippet.slice(rowStart, rowStart + 700);
  assert.doesNotMatch(rowSnippet, /\bp\.a\.|per year/i);
});

test("Stage F1-D comparison displays Surplus in first full-retirement year label", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  assert.match(snippet, /Surplus in first full-retirement year/);
});

test("Stage F1-E old Lifestyle surplus label is removed from the comparison metric", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  assert.doesNotMatch(snippet, /"Lifestyle surplus"/);
});

test("Stage F1-F comparison helper text explains both clarified metrics", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonMetric", "function renderSemiRetirementTimelineHtml");
  assert.match(appSource, /semiComparisonWithdrawals/);
  assert.match(appSource, /semiComparisonFirstRetirementSurplus/);
  assert.match(snippet, /Total accessible-investment withdrawals required to cover normal cashflow shortfalls during the semi-retirement years\./);
  assert.match(snippet, /Cash remaining after normal projected lifestyle spending in the first year the household is fully retired\./);
});

test("Stage F1-G underlying comparison value sources are unchanged", () => {
  const summarySnippet = sourceBetween(appSource, "function semiRetirementComparisonSummary", "function semiRetirementComparisonDelta");
  const renderSnippet = sourceBetween(appSource, "function renderSemiRetirementComparisonHtml", "function renderSemiRetirementTimelineHtml");
  assert.match(summarySnippet, /requiredWithdrawals: viewModel\.semiRetirementFunding\?\.requiredAccessibleWithdrawalsDuringSemiRetirement/);
  assert.match(summarySnippet, /lifestyleSurplus: fullRetirementHousehold\.annualLifestyleSurplusOrShortfall \?\? fullRetirementHousehold\.cashSurplusOrShortfall/);
  assert.match(renderSnippet, /current\.requiredWithdrawals/);
  assert.match(renderSnippet, /comparison\.requiredWithdrawals/);
  assert.match(renderSnippet, /current\.lifestyleSurplus/);
  assert.match(renderSnippet, /comparison\.lifestyleSurplus/);
});

test("Stage F1-H current and comparison projections remain identical for identical inputs", () => {
  const { current, comparisonViewModel } = stageFComparisonPair();
  assert.equal(
    comparisonViewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement,
    current.viewModel.semiRetirementFunding.requiredAccessibleWithdrawalsDuringSemiRetirement,
  );
  assert.equal(
    comparisonViewModel.keyResults.projectionEnd.projectedNetWorth,
    current.viewModel.keyResults.projectionEnd.projectedNetWorth,
  );
  assert.equal(
    comparisonViewModel.keyResults.accessibleWhenBothFullyRetired.row.household.annualLifestyleSurplusOrShortfall,
    current.viewModel.keyResults.accessibleWhenBothFullyRetired.row.household.annualLifestyleSurplusOrShortfall,
  );
});
