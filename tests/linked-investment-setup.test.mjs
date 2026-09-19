import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(`../linked-setup.js?test=${Date.now()}`);
const API = globalThis.FFSLinkedSetup;
const ids = (() => { let value = 0; return (prefix) => `${prefix}-test-${++value}`; })();
const emptyPlan = () => ({ assetItems: [], incomeItems: [], liabilityItems: [] });
const rentalDraft = (overrides = {}) => ({
  kind: "rental", name: "Smith Street", value: 650000, owner: "person1",
  person1AllocationPercentage: 100, person2AllocationPercentage: 0,
  hasLoan: false, annualRentReceived: 36000,
  annualPropertyExpensesExcludingPrincipal: 12000,
  taxableRentalProfitProvided: true, taxableRentalProfit: 18000,
  rentalCashflowTreatment: "afterInterest", ...overrides,
});
const investmentDraft = (overrides = {}) => ({
  kind: "investment", name: "ETF portfolio", investmentType: "etf", value: 100000,
  owner: "person1", person1AllocationPercentage: 100, person2AllocationPercentage: 0,
  annualIncome: 4000, hasLoan: false, ...overrides,
});

test("01 creates rental asset and income without a loan", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft(), { makeId: ids });
  assert.equal(result.ok, true); assert.equal(result.plan.assetItems.length, 1); assert.equal(result.plan.incomeItems.length, 1); assert.equal(result.plan.liabilityItems.length, 0);
});
test("02 creates a rental property with a loan", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true, loanBalance: 400000, repayment: 2500 }), { makeId: ids });
  assert.equal(result.plan.liabilityItems[0].type, "rentalPropertyLoan");
});
test("03 rental IDs cross-link correctly", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true }), { makeId: ids });
  const { assetId, incomeId, loanId } = result.ids;
  assert.equal(result.plan.incomeItems[0].linkedAssetId, assetId); assert.equal(result.plan.liabilityItems[0].linkedRentalIncomeId, incomeId); assert.ok(result.plan.incomeItems[0].linkedLoanIds.includes(loanId));
});
test("04 rental joint ownership is preserved", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft({ owner: "joint", person1AllocationPercentage: 70, person2AllocationPercentage: 30 }), { makeId: ids });
  assert.equal(result.plan.assetItems[0].person1AllocationPercentage, 70); assert.equal(result.plan.incomeItems[0].person2AllocationPercentage, 30);
});
test("05 editing a property does not create duplicates", () => {
  const first = API.upsertRentalProperty(emptyPlan(), rentalDraft(), { makeId: ids });
  const second = API.upsertRentalProperty(first.plan, rentalDraft({ assetId: first.ids.assetId, incomeId: first.ids.incomeId, value: 700000 }), { makeId: ids });
  assert.equal(second.plan.assetItems.length, 1); assert.equal(second.plan.incomeItems.length, 1); assert.equal(second.plan.assetItems[0].value, 700000);
});
test("06 editing a linked loan retains its stable ID", () => {
  const first = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true, loanBalance: 400000 }), { makeId: ids });
  const second = API.upsertRentalProperty(first.plan, rentalDraft({ assetId: first.ids.assetId, incomeId: first.ids.incomeId, loanId: first.ids.loanId, hasLoan: true, loanBalance: 390000 }), { makeId: ids });
  assert.equal(second.ids.loanId, first.ids.loanId); assert.equal(second.plan.liabilityItems[0].balance, 390000);
});
test("07 changing ownership synchronises asset, income and loan", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft({ owner: "person2", hasLoan: true }), { makeId: ids });
  assert.deepEqual([result.plan.assetItems[0].owner, result.plan.incomeItems[0].owner, result.plan.liabilityItems[0].owner], ["person2", "person2", "person2"]);
});
test("08 no-loan transition requires a deliberate choice", () => {
  const first = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true }), { makeId: ids });
  const result = API.upsertRentalProperty(first.plan, rentalDraft({ assetId: first.ids.assetId, incomeId: first.ids.incomeId, loanId: first.ids.loanId, hasLoan: false }), { makeId: ids });
  assert.equal(result.ok, false); assert.match(result.errors[0], /Choose whether/);
});
test("09 unlinking keeps the legacy liability", () => {
  const first = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true }), { makeId: ids });
  const result = API.upsertRentalProperty(first.plan, rentalDraft({ assetId: first.ids.assetId, incomeId: first.ids.incomeId, loanId: first.ids.loanId, hasLoan: false, existingLoanChoice: "unlink" }), { makeId: ids });
  assert.equal(result.plan.liabilityItems.length, 1); assert.equal(result.plan.liabilityItems[0].linkedAssetId, "");
});
test("10 explicitly linked legacy rental is recognised", () => {
  const plan = { assetItems: [{ id: "a", category: "rentalInvestmentProperty" }], incomeItems: [{ id: "i", type: "rentalNetCashIncome", linkedAssetId: "a" }], liabilityItems: [{ id: "l", type: "rentalPropertyLoan", linkedAssetId: "a" }] };
  assert.deepEqual(Object.keys(API.linkedRentalRecords(plan, "a")), ["asset", "income", "loan"]);
});
test("11 unlinked legacy rental is not inferred by description", () => {
  const plan = { assetItems: [{ id: "a", name: "Same", category: "rentalInvestmentProperty" }], incomeItems: [{ id: "i", name: "Same", type: "rentalNetCashIncome" }], liabilityItems: [] };
  assert.equal(API.linkedRentalRecords(plan, "a").income, null);
});
test("12 taxable and cash rental amounts stay distinct", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft({ taxableRentalProfit: 18000 }), { makeId: ids });
  assert.equal(result.plan.incomeItems[0].amount, 18000); assert.equal(result.plan.incomeItems[0].rentalCashIncomeAnnual, 24000);
});
test("13 rental mapping retains after-interest treatment to avoid double counting", () => {
  const result = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true }), { makeId: ids });
  assert.equal(result.mapping.rentalCashflowTreatment, "afterInterest");
});
test("14 creates investment with dividend income", () => {
  const result = API.upsertInvestment(emptyPlan(), investmentDraft(), { makeId: ids });
  assert.equal(result.plan.assetItems[0].category, "shares"); assert.equal(result.plan.incomeItems[0].type, "dividends");
});
test("15 creates investment with loan", () => {
  const result = API.upsertInvestment(emptyPlan(), investmentDraft({ hasLoan: true, loanBalance: 30000 }), { makeId: ids });
  assert.equal(result.plan.liabilityItems[0].type, "investmentLoan");
});
test("16 investment asset, income and loan links match", () => {
  const result = API.upsertInvestment(emptyPlan(), investmentDraft({ hasLoan: true }), { makeId: ids });
  assert.equal(result.plan.incomeItems[0].linkedAssetId, result.ids.assetId); assert.equal(result.plan.liabilityItems[0].linkedInvestmentIncomeId, result.ids.incomeId);
});
test("17 investment joint ownership is preserved", () => {
  const result = API.upsertInvestment(emptyPlan(), investmentDraft({ owner: "joint", person1AllocationPercentage: 60, person2AllocationPercentage: 40 }), { makeId: ids });
  assert.equal(result.plan.incomeItems[0].person2AllocationPercentage, 40);
});
test("18 investment edit does not duplicate records", () => {
  const first = API.upsertInvestment(emptyPlan(), investmentDraft(), { makeId: ids });
  const second = API.upsertInvestment(first.plan, investmentDraft({ assetId: first.ids.assetId, incomeId: first.ids.incomeId, value: 120000 }), { makeId: ids });
  assert.deepEqual([second.plan.assetItems.length, second.plan.incomeItems.length], [1, 1]);
});
test("19 linked legacy dividend remains compatible", () => {
  const plan = { assetItems: [{ id: "a", category: "shares" }], incomeItems: [{ id: "i", type: "dividends", linkedAssetId: "a" }], liabilityItems: [] };
  assert.equal(API.linkedInvestmentRecords(plan, "a").income.id, "i");
});
test("20 managed fund maps to distributions", () => {
  const result = API.upsertInvestment(emptyPlan(), investmentDraft({ investmentType: "managedFund" }), { makeId: ids });
  assert.equal(result.plan.incomeItems[0].type, "distributions");
});
test("21 serialised linked records reload without identity loss", () => {
  const first = API.upsertRentalProperty(emptyPlan(), rentalDraft({ hasLoan: true }), { makeId: ids });
  const restored = JSON.parse(JSON.stringify(first.plan));
  assert.equal(API.linkedRentalRecords(restored, first.ids.assetId).loan.id, first.ids.loanId);
});
test("22 failed validation leaves the source plan unchanged", () => {
  const source = emptyPlan(); const result = API.upsertRentalProperty(source, rentalDraft({ name: "" }), { makeId: ids });
  assert.equal(result.ok, false); assert.deepEqual(source, emptyPlan());
});
test("23 advanced taxable value is preserved when omitted during edit", () => {
  const first = API.upsertRentalProperty(emptyPlan(), rentalDraft({ taxableRentalProfit: 19000 }), { makeId: ids });
  const second = API.upsertRentalProperty(first.plan, rentalDraft({ assetId: first.ids.assetId, incomeId: first.ids.incomeId, taxableRentalProfitProvided: false }), { makeId: ids });
  assert.equal(second.plan.incomeItems[0].amount, 19000);
});
test("24 joint allocation must total 100", () => {
  const result = API.upsertInvestment(emptyPlan(), investmentDraft({ owner: "joint", person1AllocationPercentage: 70, person2AllocationPercentage: 20 }), { makeId: ids });
  assert.equal(result.ok, false);
});
test("25 legal routes contain draft content and no placeholder copy", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /DRAFT — subject to legal review/); assert.doesNotMatch(app, /TODO: legal copy/);
});
test("26 guided advanced sections are collapsed initially", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /<details class="linked-setup-advanced">/); assert.doesNotMatch(app, /<details class="linked-setup-advanced" open/);
});
test("27 mobile CSS provides one-column fields and full-width actions", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /max-width: 600px/); assert.match(css, /linked-setup-dialog-card \.input-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});
