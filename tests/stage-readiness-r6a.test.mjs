import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, rootUrl), "utf8");
const appSource = read("app.js");

const dataContext = { console };
dataContext.globalThis = dataContext;
dataContext.window = dataContext;
for (const file of ["calculator.js", "v2-data.js"]) {
  vm.runInNewContext(read(file), dataContext, { filename: file });
}
const CALC = dataContext.FFSCalculator;
const DATA = dataContext.FFS_DATA;

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in app.js`);
  const bodyStart = appSource.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const character = appSource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function arrayDeclaration(name) {
  const start = appSource.indexOf(`const ${name} = [`);
  assert.notEqual(start, -1, `${name} must exist in app.js`);
  const end = appSource.indexOf("\n  ];", start);
  assert.notEqual(end, -1, `${name} declaration must terminate predictably`);
  return appSource.slice(start, end + 5);
}

function createStageContext() {
  const context = {
    console,
    plan: null,
    money: (value) => String(value),
    safeWithdrawalRate: () => 0.04,
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const source of [
    arrayDeclaration("freedomStages"),
    arrayDeclaration("engagementJourneyStages"),
    functionSource("freedomPercent"),
    functionSource("financialStageInfo"),
    functionSource("engagementProgress"),
    functionSource("emergencyMonths"),
    functionSource("engagementStageInfo"),
  ]) vm.runInContext(source, context);
  return context;
}

function createReadinessContext() {
  const context = {
    console,
    CALC,
    plan: null,
    migratePlanData: (value) => CALC.clonePlan(value),
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const source of [
    functionSource("numberValue"),
    functionSource("positiveNumber"),
    functionSource("hasCollectionValue"),
    functionSource("isBlankPlan"),
    functionSource("isEngagementPlanReady"),
    functionSource("financialJourneyReadiness"),
    functionSource("personalisedResultsReadiness"),
  ]) vm.runInContext(source, context);
  return context;
}

function readinessFor(context, plan) {
  context.plan = CALC.clonePlan(plan);
  context.result = CALC.calculatePlan(context.plan);
  return vm.runInContext("personalisedResultsReadiness(plan, result)", context);
}

test("R6A all seven sample plans share complete Home and Dashboard readiness", () => {
  const context = createReadinessContext();
  assert.equal(DATA.samplePlans.length, 7);
  for (const sample of DATA.samplePlans) {
    const state = readinessFor(context, sample.plan);
    assert.equal(state.hasPlanData, true, `${sample.name}: has plan data`);
    assert.equal(state.complete, true, `${sample.name}: complete`);
    assert.equal(state.readyForPersonalisedResults, true, `${sample.name}: shared readiness`);
    assert.deepEqual([...state.missingSections], [], `${sample.name}: missing sections`);
  }
});

test("R6A incomplete and partial plans return one consistent readiness decision", () => {
  const context = createReadinessContext();
  const empty = CALC.emptyPlan();
  const emptyState = readinessFor(context, empty);
  assert.equal(emptyState.readyForPersonalisedResults, false);
  assert.equal(emptyState.hasPlanData, false);

  const partial = CALC.emptyPlan();
  partial.personal.person1Age = 35;
  partial.incomeItems = [{ id: "income-1", name: "Salary", amount: 90000, category: "salary_wages", owner: "person1" }];
  const partialState = readinessFor(context, partial);
  assert.equal(partialState.hasPlanData, true);
  assert.equal(partialState.complete, false);
  assert.equal(partialState.readyForPersonalisedResults, false);
  assert.ok(partialState.missingSections.length > 0);
});

test("R6A complete personal plan, JSON reload and sample-to-personal switch retain readiness", () => {
  const context = createReadinessContext();
  const personal = CALC.clonePlan(DATA.samplePlans[0].plan);
  personal.meta = { ...(personal.meta || {}), source: "personal", isDemo: false, planId: "r6a-personal" };
  const original = readinessFor(context, personal);
  const reloaded = readinessFor(context, JSON.parse(JSON.stringify(personal)));
  const sample = readinessFor(context, DATA.samplePlans[1].plan);
  const returned = readinessFor(context, JSON.parse(JSON.stringify(personal)));
  for (const state of [original, reloaded, sample, returned]) {
    assert.equal(state.readyForPersonalisedResults, true);
    assert.equal(state.complete, true);
  }
});

test("R6A formal Financial Stage and nine-step Journey are distinct actual classifiers", () => {
  const context = createStageContext();
  const formalNames = new Set(["Building the Foundation", "Building Wealth", "Financial Independence", "Financial Freedom"]);
  const journeyNames = new Set([
    "Getting Started", "Building Stability", "Emergency Ready", "Reducing Debt", "Building Wealth",
    "Growing Investment Income", "Approaching Independence", "Financial Independence", "Financial Freedom",
  ]);
  const matrix = [];
  for (const sample of DATA.samplePlans) {
    context.plan = CALC.clonePlan(sample.plan);
    context.result = CALC.calculatePlan(context.plan);
    const formal = vm.runInContext("financialStageInfo(result).stage.name", context);
    const journey = vm.runInContext("engagementStageInfo(result).stage.name", context);
    assert.ok(formalNames.has(formal), `${sample.name}: formal stage`);
    assert.ok(journeyNames.has(journey), `${sample.name}: journey step`);
    matrix.push({ id: sample.id, formal, journey });
  }
  const youngProfessional = matrix.find((entry) => entry.id === "young-professional");
  assert.equal(youngProfessional.formal, "Building the Foundation");
  assert.equal(youngProfessional.journey, "Building Wealth");
});

test("R6A Home labels the engagement classifier as a journey step", () => {
  assert.match(appSource, /<span>Current journey step<\/span><strong>\$\{escapeHtml\(stageInfo\.stage\.name\)\}<\/strong>/);
  assert.match(appSource, /current Financial Journey Step/);
  assert.doesNotMatch(appSource, /<span>Current stage<\/span><strong>\$\{escapeHtml\(stageInfo\.stage\.name\)\}<\/strong>/);
});

test("R6A Dashboard and Reports retain the authoritative four-stage classifier", () => {
  assert.match(appSource, /function renderDashboard\(result\)[\s\S]*?const stageInfo = financialStageInfo\(result\);/);
  assert.match(appSource, /<span class="metric-label">Financial Stage<\/span>/);
  assert.match(appSource, /function renderReports\(result\)[\s\S]*?const stage = financialStageInfo\(result\)\.stage;/);
  assert.match(appSource, /summaryTile\("Current financial stage", stage\.name\)/);
  assert.match(appSource, /what each milestone represents/);
});

test("R6A Dashboard updates its own stage card rather than the first global match", () => {
  assert.match(appSource, /const dashboardStageCard = progressSection\?\.querySelector\("\.freedom-stage-card"\);/);
  assert.doesNotMatch(appSource, /document\.querySelector\("\.freedom-stage-card"\)\.innerHTML/);
  assert.match(appSource, /if \(dashboardStageCard\) dashboardStageCard\.innerHTML/);
});

test("R6A Home and Dashboard consume the same readiness view model", () => {
  assert.match(appSource, /function personalisedResultsReadiness\(planData, resultInput\)/);
  assert.match(appSource, /function renderDashboard\(result\)[\s\S]*?personalisedResultsReadiness\(plan, result\)/);
  assert.match(appSource, /function renderEngagementHome\(result\)[\s\S]*?personalisedResultsReadiness\(plan, result\)/);
  assert.doesNotMatch(appSource, /function dashboardReadyState\(/);
});
