import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadEngine(extraContext = {}) {
  const context = { console, URLSearchParams, ...extraContext };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);
  return context;
}

const context = loadEngine();
const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function sourceSnippet(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Missing ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `Missing ${endToken}`);
  return source.slice(start, end);
}

function workspaceNavSnippet() {
  return sourceSnippet(indexSource, 'id="sideNav"', "</div>");
}

function navDataViewOrder() {
  return Array.from(workspaceNavSnippet().matchAll(/data-view="([^"]+)"/g)).map((match) => match[1]);
}

function representativePlan() {
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
  plan.assets.superPerson1 = 210000;
  plan.assets.superPerson2 = 145000;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.investing.inflationPct = 2.5;
  plan.incomeItems = [
    { id: "salary-1", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "salary-2", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 85000, frequency: "annually" },
    { id: "interest", name: "Interest", type: "interest", owner: "joint", amount: 3000, frequency: "annually" },
  ];
  return plan;
}

function roundCents(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

test("Stage D enables Semi-Retirement by default for normal users and keeps explicit development overrides", () => {
  assert.equal(ENGINE.featureFlags.semiRetirementProjectionEnabled, true);
  assert.equal(UI.isSemiRetirementUiEnabled(ENGINE), true);

  const queryDisabled = loadEngine({ location: { search: "?semiRetirementProjection=0" } });
  assert.equal(queryDisabled.FFSSemiRetirementProjection.featureFlags.semiRetirementProjectionEnabled, false);

  const globalDisabled = loadEngine({ FFS_ENABLE_SEMI_RETIREMENT_PROJECTION: false });
  assert.equal(globalDisabled.FFSSemiRetirementProjection.featureFlags.semiRetirementProjectionEnabled, false);
});

test("Stage D exposes Semi-Retirement as a dedicated top-level workspace tab", () => {
  const nav = workspaceNavSnippet();
  assert.match(nav, /data-view="semiretirement"[^>]*data-semi-retirement-nav/);
  assert.doesNotMatch(nav, /class="nav-button hidden"[^>]*data-view="semiretirement"/);

  const order = navDataViewOrder();
  assert.deepEqual(order, [
    "dashboard",
    "setup",
    "investments",
    "goals",
    "super",
    "decision",
    "semiretirement",
    "reports",
    "scenarios",
    "weeklyplan",
  ]);
});

test("Stage D keeps the Semi-Retirement UI out of the Decision Engine panel", () => {
  assert.equal((indexSource.match(/id="semiRetirementScenarioRoot"/g) || []).length, 1);
  const decisionPanel = sourceSnippet(indexSource, 'data-view-panel="decision"', 'data-view-panel="semiretirement"');
  assert.equal(decisionPanel.includes("semiRetirementScenarioRoot"), false);
  assert.match(indexSource, /data-view-panel="semiretirement"/);
});

test("Stage D tab switching does not reset the semi-retirement scenario state", () => {
  const setViewSnippet = sourceSnippet(appSource, "function setView", "function updateSemiRetirementNavigation");
  assert.match(setViewSnippet, /document\.querySelectorAll\("\[data-view-panel\]"\)/);
  assert.match(setViewSnippet, /aria-current/);
  assert.doesNotMatch(setViewSnippet, /semiRetirementScenarioDraft\s*=\s*null/);
  assert.doesNotMatch(setViewSnippet, /ensureSemiRetirementScenarioDraft/);
  assert.doesNotMatch(setViewSnippet, /renderSemiRetirementScenario/);
});

test("Stage D Year-by-Year Projection is contained in an accessible horizontal scroll region", () => {
  assert.match(appSource, /Year-by-Year Projection/);
  assert.match(appSource, /semi-retirement-projection-scroll/);
  assert.match(appSource, /role="region" aria-label="Year-by-year projection table\. Scroll horizontally to see all columns\." tabindex="0"/);
  assert.match(appSource, /scroll this table sideways/i);
  assert.match(stylesSource, /\.semi-retirement-projection-scroll\s*\{[^}]*overflow-scrolling: touch;/s);
  assert.match(stylesSource, /\.semi-retirement-table-wrap\s*\{[^}]*overflow-x: auto;[^}]*max-width: 100%;/s);
});

test("Stage D responsive projection treatment avoids page-level table overflow on phones", () => {
  assert.match(stylesSource, /@media \(max-width: 640px\)/);
  assert.match(stylesSource, /\.semi-retirement-table-wrap\s*\{[^}]*display: none;/s);
  assert.match(stylesSource, /\.semi-retirement-annual-cards\s*\{[^}]*display: grid;/s);
  assert.match(stylesSource, /\.semi-retirement-results-section\s*\{[^}]*overflow: hidden;/s);
});

test("Stage D Year-by-Year Projection keeps all projection columns available", () => {
  [
    "Year",
    "Person 1 age",
    "Person 2 age",
    "Household phase",
    "Net cash income",
    "Projected spending",
    "Accessible withdrawal",
    "Accessible investments",
    "Super",
    "Total investable assets",
    "Total debt",
    "Net rental cashflow",
    "Projected net worth",
    "Unfunded spending",
    "Details",
  ].forEach((heading) => assert.match(appSource, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("Stage D places Weekly Plan last and visually separates it as the ongoing operating tool", () => {
  const nav = workspaceNavSnippet();
  const order = navDataViewOrder();
  assert.equal(order.at(-1), "weeklyplan");
  assert.match(nav, /class="nav-button nav-button-optional" type="button" data-view="weeklyplan"/);
  assert.match(stylesSource, /\.nav-button-optional\s*\{[^}]*box-shadow: inset 0 1px 0 #e2e8f0;/s);
});

test("Stage D keeps the representative semi-retirement projection arithmetic unchanged", () => {
  const result = CALC.calculatePlan(representativePlan());
  const defaults = UI.buildSemiRetirementScenarioDefaults(representativePlan(), result).draft;
  defaults.people[0].hasSemiRetirement = true;
  defaults.people[0].semiRetirementAge = 55;
  defaults.people[0].semiRetirementGrossIncome = 60000;
  defaults.people[1].hasSemiRetirement = false;
  defaults.accessibleInvestments.openingBalance = 500000;
  defaults.accessibleInvestments.annualReturnRatePct = 5;
  defaults.accessibleInvestments.externalAnnualAccessibleContribution = 0;
  defaults.household.currentLifestyleSpending = 80000;
  defaults.household.semiRetirementLifestyleSpending = 75000;
  defaults.household.fullRetirementLifestyleSpending = 70000;
  defaults.projectionEndAge = 80;

  const projection = UI.runSemiRetirementProjection(ENGINE, defaults);
  assert.equal(projection.validation.isValid, true);
  const firstYear = projection.result.years[0];
  const household = firstYear.household;
  const expectedAccessibleClosing = Math.max(
    0,
    household.openingAccessibleInvestmentBalance
      + household.accessibleInvestmentContribution
      + household.accessibleInvestmentEarnings
      - household.totalAccessibleWithdrawal,
  );
  assert.equal(roundCents(household.closingAccessibleInvestmentBalance), roundCents(expectedAccessibleClosing));
  assert.equal(
    roundCents(household.totalInvestableAssets),
    roundCents(household.closingAccessibleInvestmentBalance + household.totalSuperBalance),
  );
});
