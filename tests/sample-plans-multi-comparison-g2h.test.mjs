import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const dataSource = readFileSync(new URL("../v2-data.js", import.meta.url), "utf8");

const context = { console };
context.globalThis = context;
context.window = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);
vm.runInNewContext(dataSource, context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const DATA = context.FFS_DATA;

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

function runRetirementForSample(sample) {
  const plan = CALC.clonePlan(sample.plan);
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  const outcome = UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  const viewModel = outcome.validation?.isValid
    ? UI.buildSemiRetirementResultsViewModel(outcome.result, outcome.inputs, defaults.draft)
    : null;
  return { plan, result, defaults, outcome, viewModel };
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function comparisonSnapshot(viewModel) {
  const key = viewModel.keyResults || {};
  const fullRow = key.accessibleWhenBothFullyRetired?.row || {};
  const household = fullRow.household || {};
  const firstShortfall = viewModel.longevity?.firstUnfundedSpending || {};
  return {
    fullRetirementYear: Number(key.accessibleWhenBothFullyRetired?.milestone?.calendarYear || fullRow.calendarYear || 0),
    assetsAtRetirement: roundMoney(key.totalInvestableAssetsWhenBothFullyRetired?.value ?? household.totalInvestableAssets),
    accessibleAtRetirement: roundMoney(key.accessibleWhenBothFullyRetired?.value ?? household.closingAccessibleInvestmentBalance),
    superAtRetirement: roundMoney(household.totalSuperBalance),
    debtAtRetirement: roundMoney(household.totalDebt),
    firstShortfallYear: firstShortfall?.calendarYear || null,
    projectionEndNetWorth: roundMoney(key.projectionEnd?.projectedNetWorth),
  };
}

test("Stage G2H expands active sample plans into seven realistic examples", () => {
  assert.equal(DATA.samplePlans.length, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(DATA.samplePlans.map((sample) => sample.name))), [
    "Young Professional",
    "Young Couple",
    "Growing Family",
    "Established Family / Wealth Building",
    "Pre-Retirement",
    "Semi-Retirement",
    "Retirement Ready",
  ]);
  assert.equal(new Set(DATA.samplePlans.map((sample) => sample.id)).size, DATA.samplePlans.length);
  assert.ok(DATA.samplePlans.every((sample) => sample.description && sample.plan?.meta?.source === "sample"));
});

test("Stage G2H active sample and demo runtime data does not contain Luke or Lisa", () => {
  const activeSampleData = JSON.stringify({
    samplePlans: DATA.samplePlans,
    demoPlan: DATA.demoPlan,
    demoScenarioAdjustments: DATA.demoScenarioAdjustments,
  });
  assert.doesNotMatch(activeSampleData, /\bLuke\b|\bLisa\b/);
  assert.doesNotMatch(appSource, /Luke Retirement Scenario|Lisa Retirement Scenario|Luke & Lisa Retirement/i);
});

test("Stage G2H every sample calculates and reaches Retirement Planning without validation errors", () => {
  for (const sample of DATA.samplePlans) {
    const { plan, result, outcome, viewModel } = runRetirementForSample(sample);
    assert.ok(plan.personal.person1Name, `${sample.name} should have a named primary person`);
    assert.ok(Number.isFinite(result.currentNetWorth), `${sample.name} should calculate net worth`);
    assert.equal(outcome.validation?.isValid, true, `${sample.name} should produce valid retirement inputs`);
    assert.equal(viewModel?.isAvailable, true, `${sample.name} should produce a retirement result view model`);
  }
});

test("Stage G2H sample selector is viewport-safe and keeps accessible touch targets", () => {
  assert.match(appSource, /function renderSamplePlanOptions/);
  assert.match(appSource, /data-sample-plan-choice/);
  assert.match(stylesSource, /\.sample-plan-menu-panel\s*\{[\s\S]*min-width: 250px;[\s\S]*max-width: min\(360px, calc\(100vw - 32px\)\)/);
  assert.match(stylesSource, /\.sample-plan-menu-panel button\s*\{[\s\S]*display: grid;[\s\S]*min-height: 44px;/);
  assert.match(stylesSource, /@media \(max-width: 520px\)[\s\S]*\.sample-plan-menu-panel\s*\{[\s\S]*max-height: min\(70vh, 440px\);[\s\S]*overflow-y: auto;/);
  assert.match(appSource, /closeSamplePlanMenus\(\)/);
});

test("Stage G2H Retirement Planning comparison supports Current plus up to five scenarios", () => {
  assert.match(appSource, /const MAX_SEMI_RETIREMENT_COMPARISONS = 5/);
  assert.match(appSource, /let semiRetirementComparisonScenarios = \[\]/);
  assert.match(appSource, /function addSemiRetirementComparisonScenario/);
  assert.match(appSource, /requestSemiRetirementComparisonReplacement/);
  assert.match(appSource, /Current Plan/);
  assert.match(appSource, /String\.fromCharCode\(65 \+ index\)/);
  assert.match(appSource, /semiRetirementComparisonScenarioLabel\(index\)/);
});

test("Stage G2H comparison rows use the authoritative projection result objects", () => {
  const runSnippet = sourceBetween(appSource, "function runSemiRetirementComparisonForScenario", "function requestSemiRetirementComparisonReplacement");
  const renderSnippet = sourceBetween(appSource, "function comparisonScenarioViewModel", "function renderSemiRetirementComparisonHtml");
  assert.match(runSnippet, /window\.FFSSemiRetirementUi\.runSemiRetirementProjection\(window\.FFSSemiRetirementProjection, scenario\.draft\)/);
  assert.match(renderSnippet, /buildSemiRetirementResultsViewModel\?\.\(scenario\.result, scenario\.inputs, scenario\.draft\)/);
  assert.doesNotMatch(renderSnippet, /projectRetirementScenario\(/);
});

test("Stage G2H standalone and comparison projection snapshots match for identical inputs", () => {
  const { defaults, outcome, viewModel } = runRetirementForSample(DATA.samplePlans[5]);
  const comparisonOutcome = UI.runSemiRetirementProjection(ENGINE, JSON.parse(JSON.stringify(defaults.draft)));
  const comparisonViewModel = UI.buildSemiRetirementResultsViewModel(
    comparisonOutcome.result,
    comparisonOutcome.inputs,
    JSON.parse(JSON.stringify(defaults.draft)),
  );
  assert.equal(outcome.validation?.isValid, true);
  assert.equal(comparisonOutcome.validation?.isValid, true);
  assert.deepEqual(comparisonSnapshot(comparisonViewModel), comparisonSnapshot(viewModel));
});

test("Stage G2H saved Retirement Planning scenarios can be added to Retirement comparison only", () => {
  const compareSnippet = sourceBetween(appSource, "function compareSavedScenario", "function clearSavedScenarioComparison");
  assert.match(compareSnippet, /normaliseSavedScenarioType\(selected\.scenarioType\) === "retirement"/);
  assert.match(compareSnippet, /addSavedRetirementScenarioToComparison\(selected\)/);
  assert.match(appSource, /function selectedSavedRetirementScenarios/);
  assert.match(appSource, /normaliseSavedScenarioType\(scenario\.scenarioType\) === "retirement"/);
  assert.match(appSource, /Future scenarios stay in the Saved Scenarios comparison area/);
});

test("Stage G2H retirement outcome components reconcile to authoritative annual rows", () => {
  const { viewModel } = runRetirementForSample(DATA.samplePlans[3]);
  const retirementRow = viewModel.keyResults.accessibleWhenBothFullyRetired.row;
  const household = retirementRow.household;
  const superByPerson = retirementRow.people.reduce((total, person) => total + roundMoney(person.closingSuperBalance), 0);
  const debtByRow = retirementRow.liabilities.reduce((total, liability) => total + roundMoney(liability.closingBalance), 0);
  assert.equal(roundMoney(household.totalAccessibleAssets + household.totalSuperBalance), roundMoney(household.totalInvestableAssets));
  assert.equal(roundMoney(superByPerson), roundMoney(household.totalSuperBalance));
  assert.equal(roundMoney(debtByRow), roundMoney(household.totalDebt));

  const finalRow = viewModel.annualRows.at(-1);
  const final = viewModel.keyResults.projectionEnd;
  const finalOtherAssets = finalRow.assets
    .filter((asset) => asset.includeInNetWorth !== false && !asset.isAccessibleAsset)
    .reduce((total, asset) => total + roundMoney(asset.closingValue), 0);
  const endingDebt = Number.isFinite(Number(final.totalDebt)) ? final.totalDebt : finalRow.household.totalDebt;
  assert.equal(
    roundMoney(final.accessibleInvestments + final.super + finalOtherAssets - endingDebt),
    roundMoney(final.projectedNetWorth),
  );
});

test("Stage G2H comparison breakdowns include requested outcome detail sections", () => {
  const snippet = sourceBetween(appSource, "function semiRetirementComparisonBreakdownRows", "function renderSemiRetirementComparisonBreakdown");
  [
    "Accessible investments",
    "Super",
    "Property equity",
    "Total investable retirement assets",
    "Total debt",
    "Projected net worth",
    "One-off lifestyle spending",
    "Extra concessional contributions",
    "First unmet spending",
  ].forEach((label) => assert.match(snippet, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("Stage G2H comparison PDF report is presentation-only and includes required content", () => {
  const snippet = sourceBetween(appSource, "function renderSemiRetirementComparisonPrintReport", "function renderSemiRetirementComparisonHtml");
  assert.match(snippet, /Financial Freedom/);
  assert.match(snippet, /Retirement Scenario Comparison/);
  assert.match(snippet, /Main differences/);
  assert.match(snippet, /Key modelled outcomes/);
  assert.match(snippet, /Detailed breakdowns/);
  assert.match(snippet, /Key assumptions/);
  assert.match(snippet, /This report illustrates projected outcomes based on the information and assumptions entered/);
  assert.match(snippet, /Property equity contributes to projected net worth/);
  assert.match(snippet, /Modelled super access ages used in this report/);
  assert.doesNotMatch(snippet, /runSemiRetirementProjection|projectRetirementScenario/);
});

test("comparison funding detail uses the shortfall annual row, including zero values and absent milestones", () => {
  const ctx = { window: context, semiRetirementMoney: value => value == null ? "Not available" : String(value),
    semiRetirementBreakdownRow: (label, value) => [label, value],
    milestoneAgesFromObject: () => [], semiRetirementAgeList: () => "Age 86" };
  vm.runInNewContext(sourceBetween(appSource, "function semiRetirementComparisonBreakdownRows", "function renderSemiRetirementComparisonBreakdown"), ctx);
  const scenario = {viewModel:{longevity:{firstUnfundedSpending:{calendarYear:2067}}, annualRows:[
    {calendarYear:2066,household:{normalLifestyleSpending:1}},
    {calendarYear:2067,household:{normalLifestyleSpending:109998,oneOffLifestyleSpending:0,netHouseholdCashIncome:12000,totalAccessibleWithdrawal:0,totalSuperWithdrawal:70000,unmetSpending:27998}},
  ]}};
  const rows = Object.fromEntries(ctx.semiRetirementComparisonBreakdownRows("firstShortfall",scenario));
  assert.equal(rows["Normal lifestyle spending"],"109998");
  assert.equal(rows["One-off spending"],"0");
  assert.equal(rows["Net cash income"],"12000");
  assert.equal(rows["Accessible withdrawal"],"0");
  assert.equal(rows["Super withdrawal"],"70000");
  assert.equal(rows["Unmet spending"],"27998");
  scenario.viewModel.annualRows=[];
  assert.match(JSON.stringify(ctx.semiRetirementComparisonBreakdownRows("firstShortfall",scenario)),/no annual row/);
  scenario.viewModel.longevity.firstUnfundedSpending={};
  assert.match(JSON.stringify(ctx.semiRetirementComparisonBreakdownRows("firstShortfall",scenario)),/None projected/);
});

test("Stage G2H print mode hides interactive UI and prints the static comparison report", () => {
  assert.match(appSource, /function printSemiRetirementComparisonPdf/);
  assert.match(appSource, /printWithMode\("retirement-comparison"\)/);
  assert.match(stylesSource, /body\[data-print-mode="retirement-comparison"\] \[data-view-panel\]:not\(\[data-view-panel="semiretirement"\]\)/);
  assert.match(stylesSource, /body\[data-print-mode="retirement-comparison"\] \.semi-retirement-comparison > :not\(\.semi-retirement-comparison-print-report\)/);
  assert.match(stylesSource, /body\[data-print-mode="retirement-comparison"\] \.semi-retirement-print-table thead\s*\{[\s\S]*display: table-header-group;/);
});

test("Stage G2H removing one comparison scenario does not call Saved Scenario deletion", () => {
  const snippet = sourceBetween(appSource, "function removeSemiRetirementComparisonScenario", "function setActiveSemiRetirementComparisonScenario");
  assert.match(snippet, /semiRetirementComparisonScenarios = semiRetirementComparisonScenarios\.filter/);
  assert.doesNotMatch(snippet, /deleteSavedScenario|removeSavedScenario|saveScenarios\(/);
});

test("Stage G2H mobile comparison stacks selected scenarios without page-level horizontal tables", () => {
  assert.match(stylesSource, /@media \(max-width: 640px\)[\s\S]*\.semi-retirement-comparison-summary-row,[\s\S]*grid-template-columns: 1fr;/);
  assert.match(stylesSource, /\.semi-retirement-comparison-cell::before\s*\{[\s\S]*content: attr\(data-scenario-label\)/);
  assert.match(stylesSource, /@media \(max-width: 640px\)[\s\S]*\.semi-retirement-comparison-actions,[\s\S]*flex-direction: column;/);
});

test("Stage G2H package scripts include the focused regression", () => {
  assert.match(packageSource, /"test:stage-g2h": "node scripts\/run-tests\.mjs --group stage-g2h"/);
});

function presentationFunction(name) {
  const start = appSource.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const next = appSource.indexOf("\n  function ", start + 1);
  return appSource.slice(start, next < 0 ? undefined : next);
}

test("mobile comparison selection consistently filters cells and breakdowns without changing scenarios", () => {
  const scenarios = [{ id: "base", isCurrent: true }, { id: "earlier" }, { id: "later" }];
  const before = JSON.stringify(scenarios);
  const ctx = { semiComparisonMobileSelection: "", semiRetirementComparisonScenarios: scenarios.slice(1) };
  vm.runInNewContext(presentationFunction("semiComparisonVisibleOnMobile"), ctx);
  assert.deepEqual(scenarios.map(ctx.semiComparisonVisibleOnMobile), [true, true, false]);
  ctx.semiComparisonMobileSelection = "later";
  assert.deepEqual(scenarios.map(ctx.semiComparisonVisibleOnMobile), [true, false, true]);
  ctx.semiComparisonMobileSelection = "all";
  assert.deepEqual(scenarios.map(ctx.semiComparisonVisibleOnMobile), [true, true, true]);
  assert.equal(JSON.stringify(scenarios), before);
});

test("portrait report automatically follows phone width and honours explicit desktop/portrait choices", () => {
  let phone = true;
  const ctx = { semiComparisonReportLayout: "auto", window: { matchMedia: () => ({ matches: phone }) } };
  vm.runInNewContext(presentationFunction("usePortraitRetirementReport"), ctx);
  assert.equal(ctx.usePortraitRetirementReport(), true);
  phone = false;
  assert.equal(ctx.usePortraitRetirementReport(), false);
  ctx.semiComparisonReportLayout = "portrait";
  assert.equal(ctx.usePortraitRetirementReport(), true);
  phone = true; ctx.semiComparisonReportLayout = "side-by-side";
  assert.equal(ctx.usePortraitRetirementReport(), false);
});

test("portrait report includes every scenario, its own inputs, milestones and disclosures regardless of mobile selection", () => {
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const ctx = { escapeHtml: escape, semiComparisonReportDetail: "overview", CALC: { CALCULATION_VERSION: "test", getRuleGovernance: () => ({ futureRuleAssumption: "Future rules held" }) }, carriedForwardRulesHtml: () => "<p>Held rules disclosure</p>", retirementScenarioSubtitle: scenario => `<p>${escape(scenario.name)} retirement summary</p>`, semiRetirementAgeList: () => "Alex 91 / Jordan 90", semiRetirementAssumptionValue: row => row.value, semiRetirementComparisonBreakdownRows: (_key, scenario) => [`<p>${scenario.id} event details</p>`], modellingCopy: () => ({ full: "Educational modelling only. Not financial advice." }) };
  vm.runInNewContext(presentationFunction("renderPortraitRetirementComparisonReport"), ctx);
  const scenarios = ["Current Plan", "Earlier <custom>", "Downsize", "Spend less", "Invest more", "Later"].map((name, i) => ({ name, id: `s${i}`, isCurrent: i === 0, summary: { amount: 100 + i }, viewModel: { assumptions: { rows: [{ label: "Annual investing", value: i * 1000 }] }, keyResults: { projectionEnd: { calendarYear: 2085, ages: [] } } } }));
  const before = JSON.stringify(scenarios);
  const metrics = [{ key: "assetsAtRetirement", label: "Assets at full retirement", value: s => String(s.amount), delta: (base, item) => String(item.amount - base.amount) }, { key: "oneOffLifestyle", label: "Events", value: () => "None" }];
  const html = ctx.renderPortraitRetirementComparisonReport(scenarios, metrics);
  assert.equal((html.match(/class="semi-portrait-scenario"/g) || []).length, 6);
  for (let i = 0; i < 6; i++) { assert.ok(html.includes(`<strong>${100 + i}</strong>`)); assert.ok(html.includes(`<dd>${i * 1000}</dd>`)); assert.ok(html.includes(`s${i} event details`)); }
  assert.ok(html.includes("Earlier &lt;custom>")); assert.ok(!html.includes("Earlier <custom>"));
  assert.ok(html.includes("Held rules disclosure")); assert.ok(html.includes("Future rules held")); assert.ok(html.includes("Not financial advice"));
  assert.equal(JSON.stringify(scenarios), before);
});
