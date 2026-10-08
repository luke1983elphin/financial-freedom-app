import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, rootUrl), "utf8");
const context = { console };
context.globalThis = context;
context.window = context;
for (const file of ["calculator.js", "semiRetirementProjection.js", "semiRetirementUi.js", "v2-data.js"]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const DATA = context.FFS_DATA;
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

function runSample(sample) {
  const plan = CALC.clonePlan(sample.plan);
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  const outcome = UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  const viewModel = outcome.validation?.isValid
    ? UI.buildSemiRetirementResultsViewModel(outcome.result, outcome.inputs, defaults.draft)
    : null;
  return { plan, result, defaults, outcome, viewModel };
}

test("R6 inventory contains all seven fictional sample journeys", () => {
  assert.equal(DATA.samplePlans.length, 7);
  assert.equal(new Set(DATA.samplePlans.map((sample) => sample.id)).size, 7);
  for (const sample of DATA.samplePlans) {
    assert.equal(sample.plan?.meta?.source, "sample");
    assert.equal(sample.plan?.meta?.isDemo, true);
    assert.ok(sample.plan?.personal?.person1Name);
  }
  assert.doesNotMatch(JSON.stringify(DATA.samplePlans), /\bLuke\b|\bLisa\b/);
});

test("R6 every sample reconciles the current net worth equation", () => {
  for (const sample of DATA.samplePlans) {
    const { result } = runSample(sample);
    assert.equal(round(result.currentNetWorth), round(result.totalAssets - result.totalLiabilities), sample.name);
    for (const key of ["annualGrossIncome", "annualNetIncome", "annualExpenses", "currentNetFiAssets", "currentNetWorth", "annualPassiveIncome"]) {
      assert.equal(Number.isFinite(Number(result[key])), true, `${sample.name}: ${key}`);
    }
  }
});

test("R6 every sample reaches a valid Retirement Planning annual projection", () => {
  for (const sample of DATA.samplePlans) {
    const { outcome, viewModel } = runSample(sample);
    assert.equal(outcome.validation?.isValid, true, sample.name);
    assert.equal(viewModel?.isAvailable, true, sample.name);
    assert.ok(viewModel.annualRows.length > 1, sample.name);
    for (const row of viewModel.annualRows) {
      const superByPerson = row.people.reduce((sum, person) => sum + round(person.closingSuperBalance), 0);
      const debtByLoan = row.liabilities.reduce((sum, loan) => sum + round(loan.closingBalance), 0);
      assert.equal(round(superByPerson), round(row.household.totalSuperBalance), `${sample.name}: super ${row.calendarYear}`);
      assert.equal(round(debtByLoan), round(row.household.totalDebt), `${sample.name}: debt ${row.calendarYear}`);
      assert.equal(
        round(row.household.totalAccessibleAssets + row.household.totalSuperBalance),
        round(row.household.totalInvestableAssets),
        `${sample.name}: investable assets ${row.calendarYear}`,
      );
    }
  }
});

test("R6 identical standalone and comparison inputs produce identical retirement outcomes", () => {
  for (const sample of DATA.samplePlans) {
    const { defaults, viewModel } = runSample(sample);
    const second = UI.runSemiRetirementProjection(ENGINE, JSON.parse(JSON.stringify(defaults.draft)));
    const compared = UI.buildSemiRetirementResultsViewModel(second.result, second.inputs, defaults.draft);
    const snapshot = (model) => {
      const row = model.keyResults.accessibleWhenBothFullyRetired.row;
      return {
        year: row.calendarYear,
        accessible: round(row.household.closingAccessibleInvestmentBalance),
        super: round(row.household.totalSuperBalance),
        debt: round(row.household.totalDebt),
        investable: round(row.household.totalInvestableAssets),
        endingNetWorth: round(model.keyResults.projectionEnd.projectedNetWorth),
      };
    };
    assert.deepEqual(snapshot(compared), snapshot(viewModel), sample.name);
  }
});

test("R6 sample plans keep accessible investments, super and debt separately classified", () => {
  for (const sample of DATA.samplePlans) {
    const { result } = runSample(sample);
    assert.equal(Number.isFinite(Number(result.superAccessibleToday)), true, `${sample.name}: current super classification`);
    assert.ok(result.currentNetFiAssets >= 0, sample.name);
    assert.ok(result.superannuationBalance >= 0, sample.name);
    assert.ok(result.totalLiabilities >= 0, sample.name);
  }
});

test("R6 release candidate exposes the complete navigation and export inventory", () => {
  const html = read("index.html");
  const app = read("app.js");
  for (const [view, label] of [
    ["dashboard", "Dashboard"], ["setup", "My Plan"], ["investments", "Investments"],
    ["super", "Super"], ["goals", "Goals"], ["decision", "Future"],
    ["semiretirement", "Retirement"], ["reports", "Reports"],
    ["scenarios", "Saved Scenarios"], ["weeklyplan", "Weekly Plan"],
  ]) assert.match(html, new RegExp(`data-view="${view}"[^>]*>${label}`));
  assert.match(app, /Export comparison PDF/);
  assert.match(html, /Export complete backup/);
  assert.match(html, /id="weeklyPlanBackupExportButton">Export backup/);
});

test("R6 security, storage and AI containment assets remain integrated in load order", () => {
  const html = read("index.html");
  const vercel = JSON.parse(read("vercel.json"));
  assert.ok(html.indexOf("security.js") < html.indexOf("storage.js"));
  assert.ok(html.indexOf("storage.js") < html.indexOf("app.js"));
  const headers = Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [key, value]));
  for (const key of ["Content-Security-Policy-Report-Only", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"]) {
    assert.ok(headers[key], key);
  }
  assert.match(read("api/ai-insights.js"), /value === ENABLED_VALUE/);
});

test("R6 policy routes remain explicit professional-review placeholders", () => {
  const app = read("app.js");
  assert.match(app, /Privacy/);
  assert.match(app, /Terms of Use/);
  assert.match(app, /professional review/i);
});
