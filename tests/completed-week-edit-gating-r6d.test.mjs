import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, rootUrl), "utf8");
const appSource = read("app.js");

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

const engineContext = { console };
engineContext.globalThis = engineContext;
engineContext.window = engineContext;
for (const file of ["calculator.js", "weekly-plan.js"]) {
  vm.runInNewContext(read(file), engineContext, { filename: file });
}
const CALC = engineContext.FFSCalculator;
const WEEKLY = engineContext.FFSWeeklyPlan;
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Taylor";
  plan.personal.person2Name = "Morgan";
  plan.incomeItems = [];
  plan.expenseItems = [];
  plan.assetItems = [];
  plan.liabilityItems = [];
  plan.investing.annualInvestingTarget = 0;
  plan.investing.extraSuperContributions = 0;
  const result = CALC.calculatePlan(plan);
  const weeklyPlan = WEEKLY.createFromPlan(plan, result, {
    startDate: "2026-09-14",
    todayIso: "2026-09-15",
    durationWeeks: 4,
    openingBankBalance: 1000,
    minimumCashBuffer: 0,
  });
  weeklyPlan.settings.allowCompletedWeekEditing = true;
  return { plan, result, weeklyPlan };
}

function completeFixtureWeek(f, weekNumber = 1, overrides = {}) {
  f.weeklyPlan = WEEKLY.completeWeek(f.plan, f.result, f.weeklyPlan, weekNumber, {
    openingBalance: 1000,
    income: 5000,
    essentialCosts: 1200,
    provisions: 100,
    amountSetAside: 100,
    discretionarySpending: 300,
    investment: 400,
    extraSuper: 0,
    extraDebtRepayment: 200,
    offsetTransfer: 0,
    otherTransfers: 0,
    transfersIn: 0,
    enteredBankBalance: 3800,
    ...overrides,
  });
  return f.weeklyPlan.weeks.find((week) => week.weekNumber === weekNumber);
}

function rendererContext(week, editingWeek = null) {
  const context = {
    console,
    weeklyPlan: { settings: { allowCompletedWeekEditing: true }, weeks: [week] },
    weeklyEditingWeek: editingWeek,
    activeWeeklyStep: "income",
    weeklyCurrentWeek: () => week,
    weeklyStatusClass: () => "status",
    weeklyWeekHasStarted: () => true,
    weeklyPlanCurrentCalendarWeekNumber: () => week.weekNumber,
    weeklyCalendarStatusText: () => "Current week · Completed",
    weeklyDateLabel: () => "14–20 September 2026",
    weeklyStatusLabel: () => "On track",
    weeklyNavigationHtml: () => "<nav>weeks</nav>",
    weeklyWarningPanelHtml: () => "",
    weeklyWorkflowHtml: () => "<div data-weekly-workflow>steps</div>",
    weeklyActiveStepSectionHtml: (value, canEdit) => canEdit
      ? `<input data-weekly-actual="income" value="${value.actual.income}">`
      : "<span>locked</span>",
    weeklyHasActualAmount: (actual, key) => Object.prototype.hasOwnProperty.call(actual || {}, key) && actual[key] !== null,
    weeklyLiveBalanceSummaryHtml: () => "<div>reconciliation</div>",
    weeklyVarianceSummaryHtml: () => "<div>variance</div>",
    money: (value) => `$${Number(value || 0).toFixed(0)}`,
    escapeHtml: (value) => String(value ?? ""),
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(functionSource("weeklyCompletedWeekHtml"), context);
  vm.runInContext(functionSource("weeklyThisWeekHtml"), context);
  return context;
}

function renderWeek(week, editingWeek = null) {
  const context = rendererContext(week, editingWeek);
  return vm.runInContext("weeklyThisWeekHtml()", context);
}

test("R6D-A completed week renders its compact read-only summary by default", () => {
  const f = fixture();
  const week = completeFixtureWeek(f);
  const html = renderWeek(week);
  assert.match(html, /weekly-completed-card/);
  assert.doesNotMatch(html, /data-weekly-workflow/);
});

test("R6D-B completed week does not expose an enabled actual input before confirmation", () => {
  const f = fixture();
  const html = renderWeek(completeFixtureWeek(f));
  assert.doesNotMatch(html, /data-weekly-actual=/);
});

test("R6D-C completed summary exposes Edit Completed Week", () => {
  const f = fixture();
  assert.match(renderWeek(completeFixtureWeek(f)), /Edit Completed Week/);
});

test("R6D-D edit action asks for explicit confirmation before unlocking", () => {
  const f = fixture();
  completeFixtureWeek(f);
  const context = {
    console,
    weeklyPlan: f.weeklyPlan,
    weeklyEditingWeek: null,
    weeklyViewedWeekNumber: null,
    renderOutputs: () => { context.rendered = true; },
    window: { confirm: () => { context.confirmed = true; return false; } },
  };
  vm.createContext(context);
  vm.runInContext(functionSource("beginCompletedWeekEdit"), context);
  assert.equal(vm.runInContext("beginCompletedWeekEdit(1)", context), false);
  assert.equal(context.confirmed, true);
  assert.equal(context.weeklyEditingWeek, null);
  assert.equal(context.rendered, undefined);
});

test("R6D-E cancelling the warning leaves completed data and future opening unchanged", () => {
  const f = fixture();
  const week = completeFixtureWeek(f);
  const before = JSON.stringify(f.weeklyPlan);
  const context = { weeklyPlan: f.weeklyPlan, weeklyEditingWeek: null, weeklyViewedWeekNumber: null, renderOutputs: () => {}, window: { confirm: () => false } };
  vm.createContext(context);
  vm.runInContext(functionSource("beginCompletedWeekEdit"), context);
  vm.runInContext("beginCompletedWeekEdit(1)", context);
  assert.equal(JSON.stringify(f.weeklyPlan), before);
  assert.equal(week.actual.income, 5000);
});

test("R6D-F confirmed edit mode loads existing actual values", () => {
  const f = fixture();
  const week = completeFixtureWeek(f);
  const html = renderWeek(week, 1);
  assert.match(html, /data-weekly-actual="income" value="5000"/);
  assert.match(html, /Editing this completed week/);
});

test("R6D-G saving a completed-week edit preserves completion", () => {
  const f = fixture();
  completeFixtureWeek(f);
  f.weeklyPlan = WEEKLY.completeWeek(f.plan, f.result, f.weeklyPlan, 1, { ...f.weeklyPlan.weeks[0].actual, income: 5100 });
  assert.equal(f.weeklyPlan.weeks[0].isCompleted, true);
  assert.equal(f.weeklyPlan.weeks[0].actual.income, 5100);
});

test("R6D-H completed-week edit reforecasts later opening balances", () => {
  const f = fixture();
  completeFixtureWeek(f);
  const before = f.weeklyPlan.weeks[1].planned.openingBalance;
  f.weeklyPlan = WEEKLY.completeWeek(f.plan, f.result, f.weeklyPlan, 1, { ...f.weeklyPlan.weeks[0].actual, income: 5500 });
  assert.notEqual(f.weeklyPlan.weeks[1].planned.openingBalance, before);
  assert.equal(f.weeklyPlan.weeks[1].planned.openingBalance, f.weeklyPlan.weeks[0].actual.closingBalance);
});

test("R6D-I editing Week 2 leaves earlier completed Week 1 unchanged", () => {
  const f = fixture();
  completeFixtureWeek(f, 1);
  completeFixtureWeek(f, 2, { openingBalance: f.weeklyPlan.weeks[1].planned.openingBalance, income: 1000 });
  const week1Actual = JSON.stringify(f.weeklyPlan.weeks[0].actual);
  const week1Completed = f.weeklyPlan.weeks[0].isCompleted;
  f.weeklyPlan = WEEKLY.completeWeek(f.plan, f.result, f.weeklyPlan, 2, { ...f.weeklyPlan.weeks[1].actual, income: 1100 });
  assert.equal(JSON.stringify(f.weeklyPlan.weeks[0].actual), week1Actual);
  assert.equal(f.weeklyPlan.weeks[0].isCompleted, week1Completed);
});

test("R6D-J Cancel discards staged values and clears edit mode", () => {
  const f = fixture();
  completeFixtureWeek(f);
  const context = {
    weeklyPlan: f.weeklyPlan,
    weeklyActualDrafts: new Map([[1, { income: 9999 }]]),
    weeklyEditingWeek: 1,
    weeklyViewedWeekNumber: 1,
    updateSaveStatus: () => {},
    renderOutputs: () => {},
    window: { FFSWeeklyPlan: { updateActual: () => { throw new Error("completed edit must not auto-commit"); } } },
  };
  vm.createContext(context);
  vm.runInContext(functionSource("commitWeeklyActualDraft"), context);
  vm.runInContext(functionSource("cancelCompletedWeekEdit"), context);
  vm.runInContext("commitWeeklyActualDraft(1)", context);
  assert.equal(context.weeklyActualDrafts.get(1).income, 9999);
  vm.runInContext("cancelCompletedWeekEdit(1)", context);
  assert.equal(context.weeklyActualDrafts.has(1), false);
  assert.equal(context.weeklyEditingWeek, null);
  assert.equal(f.weeklyPlan.weeks[0].actual.income, 5000);
});

test("R6D-K reload state defaults a completed week back to read-only", () => {
  const f = fixture();
  const restored = WEEKLY.migrate(JSON.parse(JSON.stringify(f.weeklyPlan = WEEKLY.completeWeek(f.plan, f.result, f.weeklyPlan, 1, { income: 5000 }))));
  assert.match(renderWeek(restored.weeks[0], null), /weekly-completed-card/);
  assert.doesNotMatch(renderWeek(restored.weeks[0], null), /data-weekly-actual=/);
});

test("R6D-L recorded actual zero remains zero in read-only and edit views", () => {
  const f = fixture();
  const week = completeFixtureWeek(f, 1, { income: 0 });
  assert.equal(week.actual.income, 0);
  assert.match(renderWeek(week), /Actual income received<\/span><strong>\$0/);
  assert.match(renderWeek(week, 1), /value="0"/);
});

test("R6D-M backup restore retains completion but never edit-mode UI state", () => {
  const f = fixture();
  completeFixtureWeek(f);
  const restored = WEEKLY.importPayload(JSON.parse(JSON.stringify(WEEKLY.exportPayload(f.weeklyPlan))));
  assert.equal(restored.weeks[0].isCompleted, true);
  assert.match(renderWeek(restored.weeks[0], null), /Edit Completed Week/);
  assert.doesNotMatch(renderWeek(restored.weeks[0], null), /data-weekly-actual=/);
});

test("R6D-N completed edit persistence remains delegated to the R5 coordinator path", () => {
  const saveSource = functionSource("saveWeekProgress");
  assert.match(saveSource, /saveWeeklyPlan\(/);
  assert.doesNotMatch(saveSource, /localStorage/);
  assert.match(read("storage.js"), /FFSStorage/);
});

test("R6D-O read-only completed week cannot directly invoke save or reforecast", () => {
  const f = fixture();
  completeFixtureWeek(f);
  const before = JSON.stringify(f.weeklyPlan);
  const context = {
    weeklyPlan: f.weeklyPlan,
    weeklyEditingWeek: null,
    plan: f.plan,
    CALC: { calculatePlan: () => f.result },
    updateSaveStatus: (message) => { context.status = message; },
    readWeekActual: () => { throw new Error("read must remain unreachable"); },
  };
  context.window = { FFSWeeklyPlan: WEEKLY };
  vm.createContext(context);
  vm.runInContext(functionSource("saveWeekProgress"), context);
  vm.runInContext("saveWeekProgress(1, false)", context);
  assert.match(context.status, /Edit Completed Week/);
  assert.equal(JSON.stringify(f.weeklyPlan), before);
});
