import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(`../consumer-setup.js?test=${Date.now()}`);
await import(`../linked-setup.js?test=${Date.now()}`);
const API = globalThis.FFSConsumerSetup;
const LINKED = globalThis.FFSLinkedSetup;
const makeId = (() => { let value = 0; return (prefix) => `${prefix}-stage2-${++value}`; })();

test("01 new consumer plan starts without persisted zero collections", () => {
  const plan = API.markNewPlan({ meta: {}, personal: {} });
  API.COLLECTIONS.forEach((key) => assert.deepEqual(plan[key], []));
  assert.equal(plan.meta.setupExperience, API.EXPERIENCE);
});

test("02 legacy plan without arrays still requests compatibility defaults", () => {
  const legacy = { income: { person1Income: 0 } };
  assert.equal(API.shouldCreateLegacyDefaults(legacy, "incomeItems"), true);
});

test("03 existing zero records are preserved", () => {
  const existing = { incomeItems: [{ id: "old-zero", amount: 0 }] };
  assert.equal(API.shouldCreateLegacyDefaults(existing, "incomeItems"), false);
  assert.equal(existing.incomeItems.length, 1);
});

test("04 adding salary creates the correct person-owned income record", () => {
  const created = API.createItem("salary-person1", { makeId, person1Name: "Alex" });
  assert.equal(created.collection, "incomeItems");
  assert.deepEqual([created.item.type, created.item.owner, created.item.name], ["salaryWages", "person1", "Alex salary"]);
});

test("05 adding home creates a home asset", () => {
  const created = API.createItem("home", { makeId });
  assert.deepEqual([created.collection, created.item.category, created.item.value], ["assetItems", "home", 0]);
});

test("06 adding liability creates the selected liability type", () => {
  assert.equal(API.createItem("home-loan", { makeId }).item.type, "homeLoan");
  assert.equal(API.createItem("investment-loan", { makeId }).item.type, "investmentLoan");
  assert.equal(API.createItem("personal-loan", { makeId }).item.type, "personalLoan");
});

test("07 goals are add-as-needed choices", () => {
  const emergency = API.createItem("goal-emergency", { makeId });
  assert.deepEqual([emergency.collection, emergency.item.name, emergency.item.target], ["goalItems", "Emergency fund", 0]);
});

test("08 meaningful edit excludes merely added zero templates", () => {
  const plan = API.markNewPlan({ personal: {} });
  plan.incomeItems.push(API.createItem("salary-person1", { makeId }).item);
  assert.equal(API.hasMeaningfulEdit(plan), false);
  plan.incomeItems[0].amount = 1000;
  assert.equal(API.hasMeaningfulEdit(plan), true);
});

test("09 guided rental setup creates linked asset, income and optional loan", () => {
  const result = LINKED.upsertRentalProperty({ assetItems: [], incomeItems: [], liabilityItems: [] }, {
    kind: "rental", name: "Rental", value: 500000, owner: "person1",
    person1AllocationPercentage: 100, person2AllocationPercentage: 0,
    annualRentReceived: 30000, annualPropertyExpensesExcludingPrincipal: 10000,
    taxableRentalProfitProvided: true, taxableRentalProfit: 15000,
    rentalCashflowTreatment: "afterInterest", hasLoan: true, loanBalance: 300000,
  }, { makeId });
  assert.equal(result.ok, true);
  assert.equal(result.plan.incomeItems[0].linkedAssetId, result.plan.assetItems[0].id);
  assert.equal(result.plan.liabilityItems[0].linkedAssetId, result.plan.assetItems[0].id);
});

test("10 guided investment setup creates linked investment, income and loan", () => {
  const result = LINKED.upsertInvestment({ assetItems: [], incomeItems: [], liabilityItems: [] }, {
    kind: "investment", name: "ETF", investmentType: "etf", value: 80000,
    owner: "person1", person1AllocationPercentage: 100, person2AllocationPercentage: 0,
    annualIncome: 3000, hasLoan: true, loanBalance: 10000,
  }, { makeId });
  assert.equal(result.ok, true);
  assert.equal(result.plan.incomeItems[0].linkedAssetId, result.plan.assetItems[0].id);
  assert.equal(result.plan.liabilityItems[0].linkedInvestmentIncomeId, result.plan.incomeItems[0].id);
});

test("11 mobile setup uses compact native selector and hides chips", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="wizardStepSelect"/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.wizard-step-chips\s*\{\s*display: none/);
  assert.match(css, /\.wizard-mobile-selector\s*\{[\s\S]*display: grid/);
});

test("12 Weekly Plan first run exposes only start date and opening balance", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const setup = app.slice(app.indexOf("function weeklyPlanSetupHtml"), app.indexOf("function readWeeklySetupOptions"));
  assert.match(setup, /data-weekly-setup="startDate"/);
  assert.match(setup, /data-weekly-setup="openingBankBalance"/);
  assert.doesNotMatch(setup, /data-weekly-setup="durationWeeks"/);
  assert.doesNotMatch(setup, /data-weekly-setup="minimumCashBuffer"/);
  assert.match(setup, /Planner settings use safe defaults/);
});

test("13 full Planner settings remain available after creation", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const start = app.indexOf("function weeklySettingsHtml");
  const settings = app.slice(start, app.indexOf("function renderWeeklyPlan", start));
  for (const field of ["durationWeeks", "minimumCashBuffer", "weeklyDiscretionaryLimit", "priorityFirst", "missedTransferTreatment"]) {
    assert.match(settings, new RegExp(`data-weekly-setting="${field}"`));
  }
});

test("14 backup prompt waits for a meaningful edit", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const prompt = app.slice(app.indexOf("function showDurabilityPromptIfNeeded"), app.indexOf("function maybeShowBackupReminder"));
  assert.match(prompt, /hasMeaningfulFinancialRecord/);
});

test("15 advanced tax and downsizing controls are progressively disclosed", async () => {
  const [app, html] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  assert.match(app, /<details class="advanced-tax-accordion">/);
  assert.match(html, /<details class="setup-advanced-section mt-6">/);
  assert.doesNotMatch(html, /<details class="setup-advanced-section mt-6" open/);
});

test("16 consumer actions use native buttons and clear labels", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  for (const label of ["Add home", "Add rental / investment property", "Add shares or investment", "Add cash / savings", "Add home loan", "Add household spending"]) {
    assert.match(app, new RegExp(label.replace(/[\/]/g, "\\/")));
  }
  assert.match(app, /<button class="btn/);
});

test("17 first Start My Plan replaces calculator-only defaults with the consumer blank plan", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const start = app.slice(app.indexOf("function startMyPlan"), app.indexOf("function resetPlan"));
  assert.match(start, /isBlankPlan\(plan\) \|\| !hasMeaningfulPersonalPlanData\(plan\)/);
  assert.match(start, /plan = blankUserPlan\(\)/);
});
