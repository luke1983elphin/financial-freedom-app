import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

globalThis.window = globalThis;
await import(`../calculator.js?stage1=${Date.now()}`);
await import(`../v2-data.js?stage1=${Date.now()}`);
await import(`../trust-readiness.js?stage1=${Date.now()}`);
await import(`../linked-setup.js?stage1=${Date.now()}`);

const TRUST = globalThis.FFSTrustReadiness;
const CALC = globalThis.FFSCalculator;
const DATA = globalThis.FFS_DATA;
const LINKED = globalThis.FFSLinkedSetup;

function emptyPlan() {
  const plan = CALC.emptyPlan();
  plan.incomeItems = [];
  plan.assetItems = [];
  plan.liabilityItems = [];
  plan.expenseItems = [];
  return plan;
}

test("Stage 1 readiness classifies a default empty plan as empty", () => {
  const plan = emptyPlan();
  assert.equal(TRUST.evaluatePlanReadiness(plan, CALC.calculatePlan(plan)).state, "empty");
});

test("Stage 1 readiness ignores default zero-value collection records", () => {
  const plan = emptyPlan();
  plan.assetItems = [{ id: "asset-home", category: "home", value: 0 }];
  plan.incomeItems = [{ id: "income-1", type: "salaryWages", amount: 0 }];
  assert.equal(TRUST.evaluatePlanReadiness(plan, CALC.calculatePlan(plan)).state, "empty");
});

test("Stage 1 readiness classifies materially incomplete data as partial", () => {
  const plan = emptyPlan();
  plan.personal.person1Age = 35;
  plan.incomeItems = [{ id: "salary", type: "salaryWages", owner: "person1", amount: 90000, frequency: "annually" }];
  const state = TRUST.evaluatePlanReadiness(plan, CALC.calculatePlan(plan));
  assert.equal(state.state, "partial");
  assert.equal(state.readyForPersonalisedResults, false);
});

test("Stage 1 readiness classifies every bundled sample plan as ready", () => {
  for (const sample of DATA.samplePlans) {
    const state = TRUST.evaluatePlanReadiness(sample.plan, CALC.calculatePlan(sample.plan));
    assert.equal(state.state, "ready", sample.name);
  }
});

test("Stage 1 readiness supports a legacy scalar plan", () => {
  const plan = CALC.emptyPlan();
  plan.personal.person1Age = 45;
  plan.personal.fullRetirementAge = 65;
  plan.personal.targetAnnualSpending = 60000;
  plan.income.person1Income = 100000;
  plan.expenses.livingCosts = 5000;
  plan.expenses.livingFrequency = "monthly";
  plan.assets.cash = 20000;
  plan.assets.sharesEtfs = 50000;
  plan.assets.superPerson1 = 150000;
  const state = TRUST.evaluatePlanReadiness(plan, CALC.calculatePlan(plan));
  assert.equal(state.state, "ready");
});

test("generic other property is not rental-link eligible", () => {
  const plan = { assetItems: [{ id: "land", category: "otherProperty", name: "Vacant land" }], incomeItems: [], liabilityItems: [] };
  assert.equal(TRUST.isRentalLinkEligible(plan, plan.assetItems[0]), false);
});

test("explicit rental property is rental-link eligible", () => {
  const plan = { assetItems: [{ id: "rental", category: "rentalInvestmentProperty" }], incomeItems: [], liabilityItems: [] };
  assert.equal(TRUST.isRentalLinkEligible(plan, plan.assetItems[0]), true);
});

test("legacy other property with an explicit rental relationship remains eligible", () => {
  const plan = {
    assetItems: [{ id: "legacy", category: "otherProperty" }],
    incomeItems: [{ id: "rent", type: "rentalNetCashIncome", linkedAssetId: "legacy" }],
    liabilityItems: [],
  };
  assert.equal(TRUST.isRentalLinkEligible(plan, plan.assetItems[0]), true);
});

test("deliberate guided conversion retains ID and creates correct links", () => {
  const source = { assetItems: [{ id: "holiday", category: "otherProperty", name: "Holiday house", value: 500000 }], incomeItems: [], liabilityItems: [] };
  const result = LINKED.upsertRentalProperty(source, {
    assetId: "holiday", name: "Holiday house rental", value: 500000, owner: "person1",
    annualRentReceived: 25000, annualPropertyExpensesExcludingPrincipal: 8000,
    hasLoan: true, loanBalance: 200000, repayment: 1500, repaymentFrequency: "monthly",
  }, { makeId: (prefix) => `${prefix}-new` });
  assert.equal(result.ok, true);
  assert.equal(result.ids.assetId, "holiday");
  assert.equal(result.plan.assetItems[0].category, "rentalInvestmentProperty");
  assert.equal(result.plan.incomeItems[0].linkedAssetId, "holiday");
  assert.equal(result.plan.liabilityItems[0].linkedAssetId, "holiday");
});

test("rental unlink keeps the liability but removes relationship IDs", () => {
  const first = LINKED.upsertRentalProperty({ assetItems: [], incomeItems: [], liabilityItems: [] }, {
    name: "Rental", value: 600000, owner: "joint", person1AllocationPercentage: 50, person2AllocationPercentage: 50,
    annualRentReceived: 30000, annualPropertyExpensesExcludingPrincipal: 10000,
    hasLoan: true, loanBalance: 350000, repayment: 2200, repaymentFrequency: "monthly",
  }, { makeId: (prefix) => `${prefix}-1` });
  const second = LINKED.upsertRentalProperty(first.plan, {
    assetId: first.ids.assetId, incomeId: first.ids.incomeId, loanId: first.ids.loanId,
    name: "Rental", value: 600000, owner: "joint", person1AllocationPercentage: 50, person2AllocationPercentage: 50,
    annualRentReceived: 30000, annualPropertyExpensesExcludingPrincipal: 10000,
    hasLoan: false, existingLoanChoice: "unlink",
  });
  assert.equal(second.ok, true);
  assert.equal(second.plan.liabilityItems[0].linkedAssetId, "");
  assert.deepEqual(second.plan.incomeItems[0].linkedLoanIds, []);
});

test("deleting a linked asset removes generated income and preserves an unlinked liability", () => {
  const first = LINKED.upsertInvestment({ assetItems: [], incomeItems: [], liabilityItems: [] }, {
    name: "ETF", investmentType: "etf", value: 80000, owner: "person1", annualIncome: 3000,
    hasLoan: true, loanBalance: 20000, repayment: 500, repaymentFrequency: "monthly",
  }, { makeId: (prefix) => `${prefix}-delete` });
  const removed = LINKED.removeLinkedAsset(first.plan, first.ids.assetId);
  assert.equal(removed.plan.assetItems.length, 0);
  assert.equal(removed.plan.incomeItems.length, 0);
  assert.equal(removed.plan.liabilityItems.length, 1);
  assert.equal(removed.plan.liabilityItems[0].linkedAssetId, "");
  assert.equal(removed.plan.liabilityItems[0].linkedInvestmentIncomeId, "");
});

for (const [name, adjustments, expected] of [
  ["extra investing", { investmentContributionChange: 5200 }, /Investment contribution.*\$5,200 per year/],
  ["reduced expenses", { expenseChange: -6000 }, /Expenses.*-\$6,000 per year/],
  ["additional debt repayment", { loanRepaymentChangeMonthly: 500 }, /Mortgage repayment.*\$500 per month/],
  ["income increase", { incomeChange: 5000 }, /Income.*\$5,000 per year/],
  ["concessional super", { extraConcessionalSuperChange: 10000 }, /Additional concessional super.*\$10,000 per year/],
  ["one-off purchase", { oneOffCosts: 50000 }, /One-off costs.*\$50,000/],
  ["legacy annual investing", { annualInvestingTarget: 10000 }, /Investment contribution.*\$10,000 per year/],
  ["legacy expense reduction", { otherExpenseAnnualChange: -7500 }, /Expenses.*-\$7,500 per year/],
]) {
  test(`scenario provenance describes ${name}`, () => {
    const overlay = TRUST.createScenarioOverlay({ actionId: name, label: name, adjustments });
    assert.ok(overlay.changes.length > 0);
    assert.match(`${overlay.changes[0].label}: ${overlay.changes[0].after}`, expected);
  });
}

test("legacy scenario snapshots receive typed provenance without changing adjustments", () => {
  const snapshot = { mode: "decision-sample", adjustments: { annualInvestingTarget: 10000 } };
  const overlay = TRUST.scenarioOverlayFromSnapshot(snapshot, { label: "Legacy investment scenario" });
  assert.equal(overlay.version, 1);
  assert.equal(overlay.adjustments.annualInvestingTarget, 10000);
  assert.equal(overlay.changes[0].label, "Investment contribution");
});

test("Stage 1 runtime contains product-presentation gates without changing calculation files", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(app, /Complete your Financial Plan before/);
  assert.match(app, /personalisedResultsReadiness\(plan, result\)/);
  assert.match(index, /trust-readiness\.js[\s\S]*dialog-controller\.js[\s\S]*app\.js/);
});
