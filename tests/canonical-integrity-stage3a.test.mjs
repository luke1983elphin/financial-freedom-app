import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import(`../plan-schema.js?stage3a=${Date.now()}`);
await import(`../plan-mutations.js?stage3a=${Date.now()}`);
await import(`../scenario-overlay.js?stage3a=${Date.now()}`);
await import(`../calculator.js?stage3a=${Date.now()}`);

const S = globalThis.FFSPlanSchema;
const M = globalThis.FFSPlanMutations;
const O = globalThis.FFSScenarioOverlay;
const CALC = globalThis.FFSCalculator;

function emptyPlan(overrides = {}) {
  return {
    people: [{ id: "person1", legacyKey: "person1", name: "Alex", active: true }],
    incomeItems: [], assetItems: [], liabilityItems: [], expenseItems: [], goalItems: [], relationships: [],
    ...overrides,
  };
}

function relationshipPlan() {
  return S.migrate(emptyPlan({
    assetItems: [{ id: "a1", name: "Investment" }],
    liabilityItems: [{ id: "l1", name: "Loan" }],
    incomeItems: [{ id: "i1", name: "Income" }],
    goalItems: [{ id: "g1", name: "Goal" }],
  })).plan;
}

test("3A-01 goal-target unlink remains absent after migrate and JSON reload", () => {
  let plan = M.link(relationshipPlan(), { type: "goal-target", fromEntityType: "goal", fromId: "g1", toEntityType: "asset", toId: "a1" });
  const relationshipId = plan.relationships.find((item) => item.type === "goal-target").id;
  plan = M.unlink(plan, relationshipId);
  assert.equal(plan.goalItems[0].linkedAssetId, undefined);
  plan = S.migrate(JSON.parse(JSON.stringify(plan))).plan;
  assert.equal(plan.relationships.some((item) => item.type === "goal-target"), false);
});

test("3A-02 relinking a goal from asset to liability leaves one authoritative target", () => {
  let plan = M.link(relationshipPlan(), { type: "goal-target", fromEntityType: "goal", fromId: "g1", toEntityType: "asset", toId: "a1" });
  plan = M.link(plan, { type: "goal-target", fromEntityType: "goal", fromId: "g1", toEntityType: "liability", toId: "l1" });
  plan = S.migrate(JSON.parse(JSON.stringify(plan))).plan;
  const links = plan.relationships.filter((item) => item.type === "goal-target");
  assert.equal(links.length, 1);
  assert.equal(links[0].toEntityType, "liability");
  assert.equal(links[0].toId, "l1");
  assert.equal(plan.goalItems[0].linkedAssetId, undefined);
  assert.equal(plan.goalItems[0].linkedLiabilityId, "l1");
});

test("3A-03 relinking a goal from liability to asset leaves one authoritative target", () => {
  let plan = M.link(relationshipPlan(), { type: "goal-target", fromEntityType: "goal", fromId: "g1", toEntityType: "liability", toId: "l1" });
  plan = M.link(plan, { type: "goal-target", fromEntityType: "goal", fromId: "g1", toEntityType: "asset", toId: "a1" });
  plan = S.migrate(JSON.parse(JSON.stringify(plan))).plan;
  const links = plan.relationships.filter((item) => item.type === "goal-target");
  assert.equal(links.length, 1);
  assert.equal(links[0].toEntityType, "asset");
  assert.equal(plan.goalItems[0].linkedAssetId, "a1");
  assert.equal(plan.goalItems[0].linkedLiabilityId, undefined);
});

for (const [name, relationship] of [
  ["goal-target asset to asset", { type: "goal-target", fromEntityType: "asset", fromId: "a1", toEntityType: "asset", toId: "a1" }],
  ["goal-target liability to goal", { type: "goal-target", fromEntityType: "liability", fromId: "l1", toEntityType: "goal", toId: "g1" }],
  ["asset-income asset to liability", { type: "asset-income", fromEntityType: "asset", fromId: "a1", toEntityType: "liability", toId: "l1" }],
  ["asset-liability income to liability", { type: "asset-liability", fromEntityType: "income", fromId: "i1", toEntityType: "liability", toId: "l1" }],
]) {
  test(`3A mutation rejects ${name}`, () => assert.throws(() => M.link(relationshipPlan(), relationship), /incompatible/i));
}

test("3A-08 mutation rejects unknown relationship types", () => {
  assert.throws(() => M.link(relationshipPlan(), { type: "mystery", fromEntityType: "asset", fromId: "a1", toEntityType: "income", toId: "i1" }), /unknown type/i);
});

test("3A-09 mutation rejects a missing source", () => {
  assert.throws(() => M.link(relationshipPlan(), { type: "asset-income", fromEntityType: "asset", fromId: "missing", toEntityType: "income", toId: "i1" }), /missing source/i);
});

test("3A-10 mutation rejects a missing target", () => {
  assert.throws(() => M.link(relationshipPlan(), { type: "asset-income", fromEntityType: "asset", fromId: "a1", toEntityType: "income", toId: "missing" }), /missing target/i);
});

test("3A-11 migration removes invalid contracts but preserves financial entities", () => {
  const source = emptyPlan({
    assetItems: [{ id: "a1" }], incomeItems: [{ id: "i1" }], liabilityItems: [{ id: "l1" }], goalItems: [{ id: "g1" }],
    relationships: [
      { id: "bad-type", type: "mystery", fromEntityType: "asset", fromId: "a1", toEntityType: "income", toId: "i1" },
      { id: "bad-goal", type: "goal-target", fromEntityType: "asset", fromId: "a1", toEntityType: "asset", toId: "a1" },
    ],
  });
  const { plan, report } = S.migrate(source);
  assert.equal(plan.relationships.length, 0);
  assert.equal(plan.assetItems.length, 1);
  assert.equal(plan.incomeItems.length, 1);
  assert.ok(report.repairs.some((item) => item.includes("unknown type")));
  assert.ok(report.repairs.some((item) => item.includes("incompatible goal-target")));
});

test("3A-12 duplicate asset IDs do not silently capture imported or compatibility links", () => {
  const source = emptyPlan({
    assetItems: [{ id: "dup", name: "First" }, { id: "dup", name: "Second" }],
    incomeItems: [{ id: "i1", linkedAssetId: "dup" }],
    relationships: [{ id: "ambiguous", type: "asset-income", fromEntityType: "asset", fromId: "dup", toEntityType: "income", toId: "i1" }],
  });
  const { plan, report } = S.migrate(source);
  assert.deepEqual(plan.assetItems.map((item) => item.id), ["dup", "dup-2"]);
  assert.equal(plan.relationships.length, 0);
  assert.equal(plan.incomeItems[0].linkedAssetId, undefined);
  assert.ok(report.repairs.some((item) => item.includes("ambiguous relationship")));
  assert.ok(report.repairs.some((item) => item.includes("explicit relinking")));
});

test("3A-13 distinct holdings and their explicit relationships remain intact", () => {
  const plan = S.migrate(emptyPlan({
    assetItems: [{ id: "a1" }, { id: "a2" }],
    incomeItems: [{ id: "i1" }, { id: "i2" }],
    relationships: [
      { id: "r1", type: "asset-income", fromEntityType: "asset", fromId: "a1", toEntityType: "income", toId: "i1" },
      { id: "r2", type: "asset-income", fromEntityType: "asset", fromId: "a2", toEntityType: "income", toId: "i2" },
    ],
  })).plan;
  assert.equal(plan.relationships.length, 2);
});

test("3A-14 legacy adjustments scenarios retain typed events", () => {
  const scenario = O.migrateScenario({ id: "adjustments", adjustments: { investmentContributionChange: 5200 } }, relationshipPlan());
  assert.equal(scenario.events[0].type, "investmentContribution");
  assert.equal(scenario.events[0].parameters.value, 5200);
});

test("3A-15 typed-overlay scenarios retain their supplied events", () => {
  const event = { id: "typed", type: "oneOffIncome", parameters: { value: 10000 }, enabled: true };
  const scenario = O.migrateScenario({ id: "overlay", overlay: { events: [event] } }, relationshipPlan());
  assert.deepEqual(scenario.events, [event]);
});

test("3A-16 changedInputs-only scenarios map deterministic rows and retain provenance", () => {
  const scenario = O.migrateScenario({
    id: "changed-only",
    changedInputs: [
      { label: "Income", before: "No change", after: "+$5,000 per year" },
      { label: "Mortgage repayment", before: "No change", after: "+$100 per month" },
    ],
  }, relationshipPlan());
  const valuesByKey = Object.fromEntries(scenario.events.map((item) => [item.parameters.key, item.parameters.value]));
  assert.deepEqual(valuesByKey, { loanRepaymentChangeMonthly: 100, incomeChange: 5000 });
  assert.equal(scenario.legacyProvenance.changedInputs.every((item) => item.status === "mapped"), true);
});

test("3A-17 unmappable changedInputs remain explicit read-only provenance", () => {
  const original = { label: "Saved plan snapshot", before: "Current working plan", after: "Family plan" };
  const scenario = O.migrateScenario({ id: "display-only", changedInputs: [original] }, relationshipPlan());
  assert.deepEqual(scenario.events, []);
  assert.equal(scenario.legacyProvenance.changedInputs[0].status, "read-only");
  assert.deepEqual(scenario.legacyProvenance.changedInputs[0].original, original);
});

test("3A-18 retirement scenarios continue to adapt their saved snapshot", () => {
  const scenario = O.migrateScenario({
    id: "retirement", scenarioType: "retirement",
    scenarioInputSnapshot: { people: [{ id: "person1", name: "Alex", fullRetirementAge: 65 }], scenario: {} },
  }, relationshipPlan());
  assert.equal(scenario.engine, "retirement");
  assert.equal(scenario.events[0].type, "retirementTransition");
});

test("3A-19 migrated scenario provenance survives JSON save and reload", () => {
  const first = O.migrateScenario({ id: "saved", changedInputs: [{ label: "Unknown historical display", after: "Kept" }] }, relationshipPlan());
  const second = O.migrateScenario(JSON.parse(JSON.stringify(first)), relationshipPlan());
  assert.deepEqual(second.events, first.events);
  assert.deepEqual(second.legacyProvenance, first.legacyProvenance);
});

test("3A-20 relationship hardening does not change representative calculator outputs", () => {
  const source = {
    personal: { person1Age: 40, fullRetirementAge: 60, targetAnnualSpending: 70000 },
    income: { person1Income: 100000, person1Frequency: "annually" },
    expenses: { livingCosts: 50000, livingFrequency: "annually" },
    assets: { homeValue: 700000, cash: 20000, sharesEtfs: 60000, superPerson1: 150000 },
    liabilities: { homeLoanBalance: 400000, monthlyRepayment: 2500 },
    investing: { expectedInvestmentReturnPct: 6, expectedSuperReturnPct: 6, inflationPct: 2.5, safeWithdrawalRatePct: 4 },
  };
  const before = CALC.calculatePlan(source);
  const after = CALC.calculatePlan(S.migrate(source).plan);
  ["annualGrossIncome", "annualNetIncome", "annualExpenses", "netWorth", "financialFreedomTarget"].forEach((key) => assert.equal(after[key], before[key], key));
});

test("3A-21 complete-backup JSON import cannot recreate an unlinked goal target", () => {
  let plan = M.link(relationshipPlan(), { type: "goal-target", fromEntityType: "goal", fromId: "g1", toEntityType: "asset", toId: "a1" });
  plan = M.unlink(plan, plan.relationships.find((item) => item.type === "goal-target").id);
  const backup = JSON.stringify({ type: "financial-freedom-complete-backup", planSchemaVersion: 3, plan });
  const imported = S.migrate(JSON.parse(backup).plan).plan;
  assert.equal(imported.relationships.some((item) => item.type === "goal-target"), false);
  assert.equal(imported.goalItems[0].linkedAssetId, undefined);
});
