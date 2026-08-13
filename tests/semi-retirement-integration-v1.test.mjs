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
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function integrationPlan() {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Luke";
  plan.personal.person2Name = "Lisa";
  plan.personal.person1Age = 43;
  plan.personal.person2Age = 41;
  plan.personal.fullRetirementAge = 60;
  plan.personal.semiRetirementAge = 55;
  plan.personal.targetAnnualSpending = 90000;
  plan.assets.cash = 30000;
  plan.assets.offset = 20000;
  plan.assets.sharesEtfs = 150000;
  plan.assets.crypto = 10000;
  plan.assets.superPerson1 = 210000;
  plan.assets.superPerson2 = 145000;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.investing.inflationPct = 2.5;
  plan.income.person1HasStslDebt = true;
  plan.income.person2HasStslDebt = true;
  plan.incomeItems = [
    { id: "income-luke", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "income-lisa", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 85000, frequency: "annually" },
    { id: "income-interest", name: "Interest", type: "interest", owner: "joint", amount: 3000, frequency: "annually" },
  ];
  plan.liabilityItems = [
    { id: "stsl-luke", type: "stsl", owner: "person1", balance: 20000 },
    { id: "stsl-lisa", type: "stsl", owner: "person2", balance: 12000 },
  ];
  return plan;
}

function defaultsFor(plan = integrationPlan()) {
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  return { plan, result, defaults };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("Integration V1A feature flag off keeps semi-retirement UI gated", () => {
  ENGINE.featureFlags.semiRetirementProjectionEnabled = false;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), false);
  assert.match(indexSource, /id="semiRetirementScenarioRoot"/);
  assert.match(appSource, /if \(!semiRetirementUiEnabled\(\)\) \{/);
  assert.match(appSource, /container\.classList\.add\("hidden"\)/);
});

test("Integration V1B current app values map into the scenario defaults", () => {
  const { result, defaults } = defaultsFor();
  const draft = defaults.draft;
  assert.equal(draft.people[0].name, "Luke");
  assert.equal(draft.people[1].name, "Lisa");
  assert.equal(draft.people[0].currentAge, 43);
  assert.equal(draft.people[1].currentAge, 41);
  assert.equal(draft.people[0].currentGrossEmploymentIncome, 120000);
  assert.equal(draft.people[1].currentGrossEmploymentIncome, 85000);
  assert.equal(draft.people[0].openingSuperBalance, 210000);
  assert.equal(draft.people[1].openingSuperBalance, 145000);
  assert.equal(draft.people[0].stslOpeningBalance, 20000);
  assert.equal(draft.people[1].stslOpeningBalance, 12000);
  assert.equal(draft.accessibleInvestments.openingBalance, result.accessibleInvestmentAssets);
  assert.equal(draft.household.fullRetirementLifestyleSpending, 90000);
  assert.equal(draft.accessibleInvestments.annualReturnRatePct, 7);
  assert.equal(draft.assumptions.inflationRatePct, 2.5);
});

test("Integration V1C scenario edits and calculations do not mutate current app state", () => {
  const { plan, defaults } = defaultsFor();
  const before = JSON.stringify(plan);
  const draft = defaults.draft;
  UI.applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", 30000);
  UI.applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", 70000);
  UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(JSON.stringify(plan), before);
});

test("Integration V1D semi-retirement flow introduces no save or migration writes", () => {
  const start = appSource.indexOf("function renderSemiRetirementScenario");
  const end = appSource.indexOf("function plannerDateIso", start);
  const snippet = appSource.slice(start, end);
  ["localStorage", "indexedDB", "saveDraft(", "autosavePlan(", "manualSavePlan(", "migrate"].forEach((token) => {
    assert.ok(!snippet.includes(token), `Unexpected storage/schema operation: ${token}`);
  });
});

test("Integration V1E full enabled workflow runs inputs, results and adjustments", () => {
  ENGINE.featureFlags.semiRetirementProjectionEnabled = true;
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), true);
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].hasSemiRetirement = true;
  draft.people[0].semiRetirementAge = 55;
  draft.people[0].fullRetirementAge = 60;
  const baseline = UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(baseline.validation.isValid, true);
  const baselineSnapshot = UI.buildScenarioAdjustmentSnapshot(baseline.result, baseline.inputs, draft);
  UI.applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", 25000);
  UI.applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", 75000);
  const adjusted = UI.runSemiRetirementProjection(ENGINE, draft);
  const state = UI.buildScenarioAdjustmentState(adjusted.result, adjusted.inputs, draft, baselineSnapshot);
  assert.equal(adjusted.validation.isValid, true);
  assert.equal(state.isAvailable, true);
  assert.equal(state.controls.semiRetirementAccessibleWithdrawal.value, 25000);
  ENGINE.featureFlags.semiRetirementProjectionEnabled = false;
});

test("Integration V1F invalid Stage 4A drafts preserve paired last-valid input and result", () => {
  const { defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.people[0].hasSemiRetirement = true;
  draft.people[0].semiRetirementAge = 55;
  draft.people[0].fullRetirementAge = 60;
  draft.household.fullRetirementLifestyleSpending = 90000;
  const valid = UI.runSemiRetirementProjection(ENGINE, draft);
  const lastValidInputs = clone(valid.inputs);
  const lastValidResult = valid.result;
  const lastValidDraft = clone(draft);
  const baseline = UI.buildScenarioAdjustmentSnapshot(valid.result, valid.inputs, draft);
  UI.applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", -1);
  const invalid = UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(invalid.validation.isValid, false);
  const displayState = UI.buildScenarioAdjustmentDisplayState({
    projection: lastValidResult,
    inputs: lastValidInputs,
    resultDraft: lastValidDraft,
    currentDraft: draft,
    baseline,
    hasValidationErrors: true,
  });
  assert.equal(lastValidInputs.household.fullRetirementLifestyleSpending, 90000);
  assert.equal(displayState.controls.fullRetirementLifestyleSpending.value, -1);
  assert.equal(displayState.impact.values.fullRetirementLifestyleSpending, 90000);
});

test("Integration V1G projection uses the current calculator tax helper", () => {
  const { defaults } = defaultsFor();
  const original = CALC.individualTaxBreakdown;
  let calls = 0;
  CALC.individualTaxBreakdown = (income) => {
    calls += 1;
    return original(income);
  };
  try {
    UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  } finally {
    CALC.individualTaxBreakdown = original;
  }
  assert.ok(calls > 0);
});

test("Integration V1H current surplus and accessible investment values are not double counted", () => {
  const { result, defaults } = defaultsFor();
  const draft = defaults.draft;
  draft.accessibleInvestments.externalAnnualAccessibleContribution = 0;
  assert.equal(draft.accessibleInvestments.openingBalance, result.accessibleInvestmentAssets);
  const projected = UI.runSemiRetirementProjection(ENGINE, draft);
  const firstYear = projected.result.years[0];
  assert.equal(
    firstYear.household.accessibleInvestmentContribution,
    Math.max(0, firstYear.household.cashSurplusOrShortfall),
  );
});

test("Integration V1I current clear/reset functions remain outside semi-retirement storage", () => {
  const resetStart = appSource.indexOf("function resetPlan");
  const resetEnd = appSource.indexOf("function clearSavedPlan", resetStart);
  const resetSnippet = appSource.slice(resetStart, resetEnd);
  assert.ok(resetSnippet.includes("localStorage.removeItem(currentPersonalPlanKey())"));
  assert.ok(!resetSnippet.includes("semiRetirement"));
});

test("Integration V1J mobile semi-retirement styles avoid page-level overflow", () => {
  assert.ok(stylesSource.includes("@media (max-width: 640px)"));
  assert.match(stylesSource, /\.semi-retirement-adjustment-controls\s*\{\s*grid-template-columns: 1fr;/s);
  assert.match(stylesSource, /\.semi-retirement-table-wrap\s*\{[^}]*overflow-x: auto;/s);
});

