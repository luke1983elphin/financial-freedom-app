import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(`../consumer-setup.js?stage2b=${Date.now()}`);
await import(`../trust-readiness.js?stage2b=${Date.now()}`);
await import(`../linked-setup.js?stage2b=${Date.now()}`);
const SETUP = globalThis.FFSConsumerSetup;
const TRUST = globalThis.FFSTrustReadiness;
const LINKED = globalThis.FFSLinkedSetup;
const ids = (() => { let n = 0; return (prefix) => `${prefix}-stage2b-${++n}`; })();

const completePlan = () => ({
  meta: { setupExperience: SETUP.EXPERIENCE, setupConfirmations: { spendingReviewed: true, person1NoSuper: true } },
  personal: { person1Name: "Alex", person1Age: 40, fullRetirementAge: 60, targetAnnualSpending: 70000 },
  incomeItems: [{ id: "salary", type: "salaryWages", owner: "person1", amount: 2000, frequency: "weekly" }],
  expenseItems: [{ id: "spend", amount: 5000, frequency: "monthly" }],
  assetItems: [{ id: "cash", category: "cash", value: 30000 }],
  liabilityItems: [],
  assets: {}, liabilities: {}, expenses: {}, income: {},
  investing: { expectedInvestmentReturnPct: 6, expectedSuperReturnPct: 6, inflationPct: 2.5, safeWithdrawalRatePct: 4 },
});

test("01 salary labels and annual equivalents are explicit for every supported pay frequency", () => {
  const cases = [
    ["weekly", 1000, "Gross pay per week", 52000],
    ["fortnightly", 2000, "Gross pay per fortnight", 52000],
    ["monthly", 5000, "Gross pay per month", 60000],
    ["annually", 110000, "Gross annual salary", 110000],
  ];
  cases.forEach(([frequency, amount, label, annual]) => {
    const result = SETUP.salaryPresentation({ frequency, amount });
    assert.equal(result.label, label);
    assert.equal(result.annualEquivalent, annual);
  });
});

test("02 the 110000 fortnightly failure case is unmistakably fortnightly", () => {
  const result = SETUP.salaryPresentation({ frequency: "fortnightly", amount: 110000 });
  assert.equal(result.label, "Gross pay per fortnight");
  assert.equal(result.annualEquivalent, 2860000);
});

test("03 salary presentation is derived without mutating legacy or person-specific records", () => {
  const legacy = { id: "p2", owner: "person2", amount: 4500, frequency: "monthly" };
  const before = JSON.stringify(legacy);
  assert.equal(SETUP.salaryPresentation(legacy).annualEquivalent, 54000);
  assert.equal(JSON.stringify(legacy), before);
});

test("04 consumer readiness remains partial when spending is unconfirmed", () => {
  const plan = completePlan();
  plan.expenseItems = [];
  plan.meta.setupConfirmations.spendingReviewed = false;
  const result = TRUST.evaluatePlanReadiness(plan, { annualGrossIncome: 104000, totalAssets: 30000 });
  assert.equal(result.state, "partial");
  assert.ok(result.missingSections.includes("Household spending confirmation"));
});

test("05 consumer readiness remains partial when super status is missing", () => {
  const plan = completePlan();
  delete plan.meta.setupConfirmations.person1NoSuper;
  const result = TRUST.evaluatePlanReadiness(plan, { annualGrossIncome: 104000, annualLivingExpenses: 60000, totalAssets: 30000 });
  assert.ok(result.missingSections.includes("Superannuation status"));
});

test("06 explicit zero/no-super confirmation satisfies readiness", () => {
  const plan = completePlan();
  const result = TRUST.evaluatePlanReadiness(plan, { annualGrossIncome: 104000, annualLivingExpenses: 60000, totalAssets: 30000 });
  assert.equal(result.state, "ready");
});

test("07 a two-person household requires separate super confirmation", () => {
  const plan = completePlan();
  plan.personal.person2Name = "Jordan";
  assert.equal(SETUP.setupConfirmationState(plan).superConfirmed, false);
  plan.meta.setupConfirmations.person2NoSuper = true;
  assert.equal(SETUP.setupConfirmationState(plan).superConfirmed, true);
});

test("08 legacy and sample plans are not newly over-gated", () => {
  const legacy = completePlan(); delete legacy.meta.setupExperience; legacy.meta.setupConfirmations = {};
  assert.equal(TRUST.evaluatePlanReadiness(legacy, { annualGrossIncome: 104000, annualLivingExpenses: 60000, totalAssets: 30000 }).state, "ready");
  const sample = completePlan(); sample.meta = { source: "sample", samplePlanId: "sample" };
  assert.equal(TRUST.evaluatePlanReadiness(sample, { annualGrossIncome: 104000, annualLivingExpenses: 60000, totalAssets: 30000 }).state, "ready");
});

test("09 rental loan can be unlinked, preserved and deliberately relinked without duplication", () => {
  const draft = { name: "Rental", value: 600000, owner: "person1", annualRentReceived: 36000, annualPropertyExpensesExcludingPrincipal: 10000, hasLoan: true, loanBalance: 380000 };
  const first = LINKED.upsertRentalProperty({ assetItems: [], incomeItems: [], liabilityItems: [] }, draft, { makeId: ids });
  const unlinked = LINKED.upsertRentalProperty(first.plan, { ...draft, assetId: first.ids.assetId, incomeId: first.ids.incomeId, loanId: first.ids.loanId, hasLoan: false, existingLoanChoice: "unlink" }, { makeId: ids });
  const relinked = LINKED.upsertRentalProperty(unlinked.plan, { ...draft, assetId: first.ids.assetId, incomeId: first.ids.incomeId, linkExistingLoanId: first.ids.loanId, hasLoan: true }, { makeId: ids });
  assert.equal(relinked.plan.liabilityItems.length, 1);
  assert.equal(relinked.plan.liabilityItems[0].linkedAssetId, first.ids.assetId);
});

test("10 investment editing retains one canonical asset, income and liability", () => {
  const draft = { name: "ETF", investmentType: "etf", value: 80000, owner: "person1", annualIncome: 3000, hasLoan: true, loanBalance: 10000 };
  const first = LINKED.upsertInvestment({ assetItems: [], incomeItems: [], liabilityItems: [] }, draft, { makeId: ids });
  const second = LINKED.upsertInvestment(first.plan, { ...draft, assetId: first.ids.assetId, incomeId: first.ids.incomeId, loanId: first.ids.loanId, value: 90000 }, { makeId: ids });
  assert.deepEqual([second.plan.assetItems.length, second.plan.incomeItems.length, second.plan.liabilityItems.length], [1, 1, 1]);
});

test("11 home setup supports no loan, a new loan and reload", () => {
  const empty = { assetItems: [], incomeItems: [], liabilityItems: [] };
  const noLoan = LINKED.upsertHome(empty, { name: "Family home", value: 850000, hasLoan: false }, { makeId: ids });
  assert.equal(noLoan.plan.liabilityItems.length, 0);
  const withLoan = LINKED.upsertHome(noLoan.plan, { assetId: noLoan.ids.assetId, name: "Family home", value: 850000, hasLoan: true, loanBalance: 500000, repayment: 3000 }, { makeId: ids });
  assert.equal(withLoan.plan.liabilityItems.length, 1);
  const restored = JSON.parse(JSON.stringify(withLoan.plan));
  assert.equal(LINKED.linkedHomeRecords(restored, noLoan.ids.assetId).loan.balance, 500000);
});

test("12 home setup links an existing loan without duplicating it", () => {
  const source = { assetItems: [{ id: "home", category: "home", value: 800000 }], incomeItems: [], liabilityItems: [{ id: "loan", name: "Mortgage", type: "homeLoan", balance: 450000 }] };
  const result = LINKED.upsertHome(source, { assetId: "home", name: "Home", value: 800000, hasLoan: true, linkExistingLoanId: "loan" }, { makeId: ids });
  assert.equal(result.plan.liabilityItems.length, 1);
  assert.equal(result.plan.liabilityItems[0].linkedAssetId, "home");
});

test("13 legacy home and loan records remain separate until the user links them", () => {
  const source = { assetItems: [{ id: "home", category: "home", value: 800000 }], incomeItems: [], liabilityItems: [{ id: "loan", type: "homeLoan", balance: 450000 }] };
  assert.equal(LINKED.linkedHomeRecords(source, "home").loan, null);
  assert.equal(source.liabilityItems.length, 1);
});

test("14 goal templates use intent-specific records while generic goals stay compatible", () => {
  assert.equal(SETUP.createItem("goal-retire", { makeId: ids }).item.goalType, "retirementIntent");
  assert.equal(SETUP.createItem("goal-home-loan", { makeId: ids }).item.goalType, "homeLoanPayoff");
  const generic = SETUP.createItem("goal-other", { makeId: ids }).item;
  assert.equal(generic.goalType, undefined);
  assert.equal(generic.target, 0);
});

test("15 backup reminder threshold ignores names and zero templates", () => {
  const plan = SETUP.markNewPlan({ personal: { person1Name: "Alex", person1Age: 40 } });
  plan.incomeItems.push(SETUP.createItem("salary-person1", { makeId: ids }).item);
  assert.equal(SETUP.hasMeaningfulFinancialRecord(plan), false);
  plan.incomeItems[0].amount = 2000;
  assert.equal(SETUP.hasMeaningfulFinancialRecord(plan), true);
});

test("16 source contains focused setup, super checkpoint and conditional Weekly Plan controls", async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="wizardSuperCheckpoint"/);
  assert.match(html, /data-view="dashboard">Exit setup/);
  assert.match(app, /function setCanonicalSuperBalance\(personNumber, value\)/);
  assert.match(app, /setCanonicalSuperBalance\(personNumber, value\)/);
  assert.match(app, /allocation\.mode === "split"/);
  assert.match(css, /body\[data-active-view="setup"\] #homeView/);
});

test("17 linked records render as summaries with one primary edit route", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /linked-primary-summary/);
  assert.match(app, /Edit linked setup/);
  assert.match(app, /Link existing loan/);
});

test("18 rental and Decision Engine explanations state treatment and horizon", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /Loan principal is kept separate/);
  assert.match(app, /Estimated annual wealth benefit/);
  assert.match(app, /Annual comparison using the current rates and tax assumptions/);
});
