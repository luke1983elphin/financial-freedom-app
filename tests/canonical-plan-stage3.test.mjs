import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

globalThis.window = globalThis;
await import(`../plan-schema.js?stage3=${Date.now()}`);
await import(`../legacy-plan-adapter.js?stage3=${Date.now()}`);
await import(`../plan-selectors.js?stage3=${Date.now()}`);
await import(`../plan-mutations.js?stage3=${Date.now()}`);
await import(`../scenario-overlay.js?stage3=${Date.now()}`);
await import(`../v2-data.js?stage3=${Date.now()}`);
await import(`../calculator.js?stage3=${Date.now()}`);

const S = globalThis.FFSPlanSchema;
const A = globalThis.FFSLegacyPlanAdapter;
const Q = globalThis.FFSPlanSelectors;
const M = globalThis.FFSPlanMutations;
const O = globalThis.FFSScenarioOverlay;
const CALC = globalThis.FFSCalculator;

function legacyPlan(overrides = {}) {
  return {
    personal: { person1Name: "Alex", person1Age: 40, person2Name: "Sam", person2Age: 39, fullRetirementAge: 60, targetAnnualSpending: 70000 },
    income: { person1Income: 100000, person1Frequency: "annually", person2Income: 3000, person2Frequency: "fortnightly", otherIncome: 1200, otherIncomeFrequency: "monthly" },
    expenses: { livingCosts: 3000, livingFrequency: "monthly", food: 250, foodFrequency: "weekly", utilities: 5000, utilitiesFrequency: "annually", insurance: 3000, insuranceFrequency: "annually", otherExpenses: 400, otherFrequency: "monthly", mortgageRepayments: 2500 },
    assets: { homeValue: 700000, offsetBalance: 30000, cash: 20000, sharesEtfs: 60000, crypto: 5000, superPerson1: 150000, superPerson2: 100000 },
    liabilities: { homeLoanBalance: 400000, homeLoanInterestRatePct: 6, monthlyRepayment: 2500, remainingLoanTermYears: 25, otherDebts: 10000 },
    investing: { expectedInvestmentReturnPct: 6, expectedSuperReturnPct: 6, inflationPct: 2.5, safeWithdrawalRatePct: 4, annualInvestmentContribution: 10000 },
    ...overrides,
  };
}

test("01 legacy plans migrate to explicit schema version 3", () => {
  const { plan, report } = S.migrate(legacyPlan());
  assert.equal(plan.planSchemaVersion, 3);
  assert.equal(plan.meta.schemaVersion, 3);
  assert.equal(report.toVersion, 3);
});

test("02 household members receive stable compatibility IDs", () => {
  const { plan } = S.migrate(legacyPlan());
  assert.deepEqual(plan.people.map((person) => person.id), ["person1", "person2"]);
  assert.equal(plan.people[0].name, "Alex");
});

for (const [index, frequency] of ["weekly", "fortnightly", "monthly", "annually"].entries()) {
  test(`${String(index + 3).padStart(2, "0")} ${frequency} legacy salary timing is preserved`, () => {
    const source = legacyPlan({ income: { person1Income: 1234, person1Frequency: frequency } });
    const { plan } = S.migrate(source);
    assert.equal(plan.incomeItems.find((item) => item.id === "income-person-1").frequency, frequency);
    assert.equal(plan.incomeItems.find((item) => item.id === "income-person-1").amount, 1234);
  });
}

test("07 duplicate entity IDs are repaired deterministically", () => {
  const { plan, report } = S.migrate({ incomeItems: [{ id: "same" }, { id: "same" }] });
  assert.deepEqual(plan.incomeItems.map((item) => item.id), ["same", "same-2"]);
  assert.ok(report.repairs.some((message) => message.includes("unique ID")));
});

test("08 invalid owners are repaired without discarding records", () => {
  const { plan, report } = S.migrate({ incomeItems: [{ id: "income-x", owner: "missing", amount: 10 }] });
  assert.equal(plan.incomeItems[0].owner, "joint");
  assert.ok(report.repairs.some((message) => message.includes("invalid owner")));
});

test("09 home-loan relationships are derived from stable IDs", () => {
  const { plan } = S.migrate(legacyPlan());
  assert.ok(plan.relationships.some((rel) => rel.type === "asset-liability" && rel.fromId === "asset-home" && rel.toId === "liability-home-loan"));
});

test("10 rental asset, income and loan relationships survive migration", () => {
  const source = legacyPlan({
    assetItems: [{ id: "rental-1", category: "rentalInvestmentProperty", value: 500000 }],
    incomeItems: [{ id: "rent-1", type: "rentalNetCashIncome", linkedAssetId: "rental-1", amount: 12000, frequency: "annually" }],
    liabilityItems: [{ id: "loan-1", type: "rentalPropertyLoan", linkedAssetId: "rental-1", balance: 200000 }],
  });
  const { plan } = S.migrate(source);
  assert.equal(plan.relationships.filter((rel) => rel.fromId === "rental-1").length, 2);
  assert.equal(Q.rentalProperties(plan)[0].income[0].id, "rent-1");
});

test("11 damaged relationships are removed while source entities remain", () => {
  const { plan, report } = S.migrate({ assetItems: [{ id: "asset-1" }], relationships: [{ id: "bad", type: "asset-liability", fromEntityType: "asset", fromId: "asset-1", toEntityType: "liability", toId: "missing" }] });
  assert.equal(plan.relationships.length, 0);
  assert.equal(plan.assetItems.length, 1);
  assert.ok(report.repairs.some((message) => message.includes("Removed invalid relationship")));
});

test("12 invariant validation identifies a dangling relationship", () => {
  const plan = S.migrate({}).plan;
  plan.relationships.push({ id: "dangling", type: "asset-income", fromEntityType: "asset", fromId: "missing", toEntityType: "income", toId: "also-missing" });
  assert.equal(S.validate(plan).valid, false);
});

test("13 the legacy adapter is one-way and never mutates its source", () => {
  const source = legacyPlan();
  const before = JSON.stringify(source);
  const projected = A.toCalculationPlan(source, (copy) => { copy.income.person1Income = 42; return copy; });
  assert.equal(projected.income.person1Income, 42);
  assert.equal(JSON.stringify(source), before);
});

test("14 selectors are deterministic and do not mutate canonical state", () => {
  const plan = S.migrate(legacyPlan()).plan;
  const before = JSON.stringify(plan);
  assert.deepEqual(Q.assets(plan), Q.assets(plan));
  assert.equal(JSON.stringify(plan), before);
});

test("15 employment selector annualises person-specific income", () => {
  const plan = S.migrate(legacyPlan()).plan;
  assert.equal(Q.annualEmploymentIncome(plan, "person1"), 100000);
  assert.equal(Q.annualEmploymentIncome(plan, "person2"), 78000);
});

test("16 accessible-investment selector excludes home and super", () => {
  const plan = S.migrate(legacyPlan()).plan;
  const ids = Q.accessibleInvestments(plan).map((item) => item.id);
  assert.ok(ids.includes("asset-cash"));
  assert.ok(!ids.includes("asset-home"));
  assert.ok(!ids.includes("asset-super-1"));
});

test("17 super selector retains person ownership", () => {
  const plan = S.migrate(legacyPlan()).plan;
  assert.deepEqual(Q.superBalances(plan).map((item) => item.ownerId), ["person1", "person2"]);
});

test("18 mutation upsert preserves a stable record ID", () => {
  let plan = S.migrate(legacyPlan()).plan;
  plan = M.upsert(plan, "assetItems", { id: "asset-home", value: 725000 });
  assert.equal(plan.assetItems.filter((item) => item.id === "asset-home").length, 1);
  assert.equal(plan.assetItems.find((item) => item.id === "asset-home").value, 725000);
});

test("19 mutation link rejects incompatible or missing endpoints", () => {
  const plan = S.migrate(legacyPlan()).plan;
  assert.throws(() => M.link(plan, { type: "asset-liability", fromEntityType: "asset", fromId: "missing", toEntityType: "liability", toId: "liability-home-loan" }), /missing source/i);
});

test("20 relinking a liability removes its old derived relationship", () => {
  let plan = S.migrate({ assetItems: [{ id: "a1" }, { id: "a2" }], liabilityItems: [{ id: "l1", linkedAssetId: "a1" }] }).plan;
  plan = M.upsert(plan, "liabilityItems", { id: "l1", linkedAssetId: "a2" });
  assert.equal(plan.relationships.some((rel) => rel.fromId === "a1" && rel.toId === "l1"), false);
  assert.equal(plan.relationships.some((rel) => rel.fromId === "a2" && rel.toId === "l1"), true);
});

test("21 removing a linked asset cleans relationships and compatibility references", () => {
  let plan = S.migrate({ assetItems: [{ id: "a1" }], liabilityItems: [{ id: "l1", linkedAssetId: "a1" }] }).plan;
  plan = M.remove(plan, "assetItems", "a1");
  assert.equal(plan.relationships.length, 0);
  assert.equal(plan.liabilityItems[0].linkedAssetId, undefined);
});

test("22 strict removal can prevent accidental orphan creation", () => {
  const plan = S.migrate({ assetItems: [{ id: "a1" }], liabilityItems: [{ id: "l1", linkedAssetId: "a1" }] }).plan;
  assert.throws(() => M.remove(plan, "assetItems", "a1", { onLinked: "reject" }), /linked relationships/i);
});

test("23 ownership mutations require a valid stable member ID", () => {
  const plan = S.migrate(legacyPlan()).plan;
  assert.equal(M.updateOwnership(plan, "incomeItems", "income-other", "person2").incomeItems.find((item) => item.id === "income-other").owner, "person2");
  assert.throws(() => M.updateOwnership(plan, "incomeItems", "income-other", "person3"), /Unknown household member/);
});

test("24 quick decision adjustments become typed events", () => {
  const events = O.fromDecisionAdjustments({ investmentContributionChange: 5200, oneOffCosts: 10000 });
  assert.deepEqual(events.map((item) => item.type).sort(), ["investmentContribution", "oneOffExpense"].sort());
});

test("25 typed decision overlays round-trip to existing engine inputs", () => {
  const adjustments = { incomeChange: 5000, expenseChange: -1200, loanRepaymentChangeMonthly: 100 };
  const events = O.fromDecisionAdjustments(adjustments);
  assert.deepEqual(O.toDecisionAdjustments(events, {}), adjustments);
});

test("26 provenance is generated from event definitions", () => {
  const details = O.provenance(O.fromDecisionAdjustments({ expenseChange: -6000 }));
  assert.equal(details[0].title, "Household expenses");
  assert.match(details[0].description, /-6000/);
});

test("27 same-year events use the documented existing-engine order", () => {
  const events = O.sortEvents([
    { id: "i", type: "investmentContribution", effectiveYear: 5 },
    { id: "s", type: "propertySale", effectiveYear: 5 },
    { id: "d", type: "debtRepayment", effectiveYear: 5 },
  ]);
  assert.deepEqual(events.map((item) => item.id), ["s", "d", "i"]);
});

test("28 old saved scenarios migrate to a typed inspectable overlay", () => {
  const plan = S.migrate(legacyPlan()).plan;
  const scenario = O.migrateScenario({ id: "old", name: "Invest more", adjustments: { investmentContributionChange: 5200 } }, plan);
  assert.equal(scenario.scenarioSchemaVersion, 1);
  assert.equal(scenario.events[0].type, "investmentContribution");
  assert.equal(scenario.basePlanRevision, plan.meta.revision.hash);
});

test("29 plan revision changes only after financial content changes", () => {
  const plan = S.migrate(legacyPlan(), { now: "2026-01-01T00:00:00.000Z" }).plan;
  const first = { ...plan.meta.revision };
  S.commitRevision(plan, "2026-01-02T00:00:00.000Z");
  assert.equal(plan.meta.revision.number, first.number);
  plan.assetItems.find((item) => item.id === "asset-cash").value += 1;
  S.commitRevision(plan, "2026-01-03T00:00:00.000Z");
  assert.equal(plan.meta.revision.number, first.number + 1);
});

test("30 scenarios identify when the base plan has changed", () => {
  const plan = S.migrate(legacyPlan()).plan;
  const scenario = O.migrateScenario({ id: "scenario" }, plan);
  plan.assetItems[0].value += 100;
  S.commitRevision(plan);
  assert.equal(O.isStale(scenario, plan), true);
});

test("31 scenario entity references are validated explicitly", () => {
  const plan = S.migrate(legacyPlan()).plan;
  const scenario = O.migrateScenario({ events: [{ id: "x", type: "debtRepayment", liabilityId: "missing", parameters: {} }] }, plan);
  assert.deepEqual(O.validateReferences(scenario, plan), { valid: false, missing: [{ eventId: "x", entityType: "liability", entityId: "missing" }] });
});

test("32 canonical migration is idempotent and round-trip stable", () => {
  const first = S.migrate(legacyPlan()).plan;
  const second = S.migrate(JSON.parse(JSON.stringify(first))).plan;
  assert.equal(S.validate(second).valid, true);
  assert.deepEqual(second.incomeItems, first.incomeItems);
  assert.deepEqual(second.relationships, first.relationships);
});

test("33 migration preserves representative calculator outputs", () => {
  const source = legacyPlan();
  const migrated = S.migrate(source).plan;
  const before = CALC.calculatePlan(source);
  const after = CALC.calculatePlan(migrated);
  ["annualGrossIncome", "annualNetIncome", "annualExpenses", "netWorth", "financialFreedomTarget"].forEach((key) => assert.equal(after[key], before[key], key));
});

test("34 sample plans retain calculation parity after canonical migration", () => {
  for (const sample of globalThis.FFS_DATA.samplePlans || []) {
    const before = CALC.calculatePlan(sample.plan);
    const after = CALC.calculatePlan(S.migrate(sample.plan).plan);
    ["annualGrossIncome", "annualNetIncome", "annualExpenses", "netWorth"].forEach((key) => assert.equal(after[key], before[key], `${sample.id}:${key}`));
  }
});

test("35 app rendering uses the calculation adapter and does not run live compatibility sync", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const renderBody = source.match(/function renderOutputs\(\) \{([\s\S]*?)\n  \}\n\n  function renderAll/)?.[1] || "";
  assert.match(renderBody, /calculatePlan\(plan\)/);
  assert.doesNotMatch(renderBody, /syncCollectionsToLegacy\(\)/);
});

test("36 canonical modules load before app.js", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const file of ["plan-schema.js", "legacy-plan-adapter.js", "plan-selectors.js", "plan-mutations.js", "scenario-overlay.js"]) {
    assert.ok(html.indexOf(file) > -1 && html.indexOf(file) < html.indexOf("app.js"), file);
  }
});

test("37 protected calculation modules remain outside Stage 3 architecture modules", async () => {
  const modules = await Promise.all(["plan-schema.js", "legacy-plan-adapter.js", "plan-selectors.js", "plan-mutations.js", "scenario-overlay.js"].map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  modules.forEach((source) => assert.doesNotMatch(source, /income tax|medicare levy|STSL_RATE|safe withdrawal rate/i));
});

test("38 retirement snapshots adapt existing events without rewriting the retirement engine", () => {
  const events = O.fromRetirementSnapshot({
    people: [{ id: "person1", name: "Alex", semiRetirementAge: 55, fullRetirementAge: 60 }],
    scenario: {
      oneOffLifestyleEvents: [{ id: "holiday", year: 4, amount: 20000, description: "Holiday" }],
      oneOffIncomeEvents: [{ id: "inheritance", year: 6, amount: 50000, description: "Inheritance" }],
      plannedConcessionalContributions: [{ id: "super-extra", personId: "person1", financialYear: 3, amount: 10000 }],
    },
  });
  assert.deepEqual(new Set(events.map((item) => item.type)), new Set(["retirementTransition", "oneOffExpense", "oneOffIncome", "superContribution"]));
});

test("39 canonical schema retains Weekly Plan and report metadata without copying it into entity collections", () => {
  const source = legacyPlan({ weeklyPlan: { version: 5, weeks: [{ weekNumber: 1 }] }, reportSettings: { weeklyPlanner: { reviewed: true } } });
  const plan = S.migrate(source).plan;
  assert.deepEqual(plan.weeklyPlan, source.weeklyPlan);
  assert.deepEqual(plan.reportSettings, source.reportSettings);
  assert.equal(plan.assetItems.some((item) => item.weekNumber), false);
});
