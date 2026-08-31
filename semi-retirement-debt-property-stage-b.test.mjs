import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function mergeDeep(base, override) {
  if (Array.isArray(override)) return override.map((item) => mergeDeep({}, item));
  if (!override || typeof override !== "object") return override;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) output[key] = value.map((item) => mergeDeep({}, item));
    else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) output[key] = mergeDeep(base[key], value);
    else output[key] = value;
  }
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Alex",
    currentAge: 50,
    currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 51,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 52,
    superAccessAge: 60,
    openingSuperBalance: 0,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 52,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 56,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 200000,
      annualReturnRate: 0,
      annualFeesRate: 0,
      currentAnnualContributions: 0,
    },
    assets: [
      { id: "rental", name: "12 Smith Street", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0.04 },
    ],
    liabilities: [
      { id: "home", name: "Home Loan", type: "homeLoan", openingBalance: 120000, openingOffsetBalance: 20000, interestRatePct: 0, repaymentAmount: 20000, repaymentFrequency: "annually", remainingTermYears: 10 },
      { id: "car", name: "Vehicle Loan", type: "vehicleLoan", openingBalance: 15000, interestRatePct: 0, repaymentAmount: 5000, repaymentFrequency: "annually", remainingTermYears: 5 },
      { id: "rental-loan", name: "Investment Property Loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 0, repaymentAmount: 10000, repaymentFrequency: "annually", remainingTermYears: 15 },
    ],
    propertyIncome: [
      { id: "rent", name: "12 Smith Street rent", linkedAssetId: "rental", linkedLoanIds: ["rental-loan"], annualIncome: 18000, rentalCashflowTreatment: "afterInterest" },
    ],
    people: [
      person(),
      person({ id: "person2", name: "Sam", currentAge: 48, semiRetirementAge: 51, fullRetirementAge: 53 }),
    ],
    scenario: {
      semiRetirementAccessibleWithdrawal: 0,
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
  }, overrides);
}

function project(overrides = {}) {
  const inputs = baseInput(overrides);
  const result = ENGINE.projectRetirementScenario(inputs);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  const viewModel = UI.buildSemiRetirementResultsViewModel(result, inputs, inputs);
  return { inputs, result, viewModel };
}

function yearFor(result, calendarYear) {
  return result.years.find((row) => row.calendarYear === calendarYear);
}

function debtProperty(overrides = {}) {
  return project(overrides).viewModel.debtProperty;
}

test("Stage B total debt current uses the scenario-start annual row", () => {
  const { result, viewModel } = project();
  const current = viewModel.debtProperty.milestoneDebt.find((item) => item.label === "Total debt now");
  assert.equal(current.value, result.years[0].household.totalDebt);
});

test("Stage B debt at first retirement uses the first-retirement annual row", () => {
  const { result, viewModel } = project();
  const item = viewModel.debtProperty.milestoneDebt.find((entry) => entry.label === "Debt when first person fully retires");
  assert.equal(item.value, yearFor(result, result.summary.firstPersonFullRetirement.calendarYear).household.totalDebt);
});

test("Stage B debt at household full retirement uses the household retirement annual row", () => {
  const { result, viewModel } = project();
  const item = viewModel.debtProperty.milestoneDebt.find((entry) => entry.label === "Debt when both are fully retired");
  assert.equal(item.value, yearFor(result, result.summary.householdFullRetirement.calendarYear).household.totalDebt);
});

test("Stage B debt at projection end uses the final annual row", () => {
  const { result, viewModel } = project();
  const item = viewModel.debtProperty.milestoneDebt.find((entry) => entry.label === "Debt at projection end");
  assert.equal(item.value, result.years.at(-1).household.totalDebt);
});

test("Stage B no-debt state avoids meaningless debt cards", () => {
  const model = debtProperty({ liabilities: [], propertyIncome: [] });
  assert.equal(model.hasDebt, false);
  assert.equal(model.debtCards.length, 0);
});

test("Stage B home-loan card displays balance, repayment and payoff milestone", () => {
  const model = debtProperty();
  const card = model.debtCards.find((item) => item.id === "home");
  assert.equal(card.currentBalance, 120000);
  assert.equal(card.annualRepayment, 20000);
  assert.equal(card.payoff.calendarYear, 2031);
});

test("Stage B other debt card displays independently", () => {
  const model = debtProperty();
  const card = model.debtCards.find((item) => item.id === "car");
  assert.equal(card.name, "Vehicle Loan");
  assert.equal(card.currentBalance, 15000);
  assert.notEqual(card.currentBalance, model.debtCards.find((item) => item.id === "home").currentBalance);
});

test("Stage B balloon repayment is visible in debt warnings and card data", () => {
  const model = debtProperty({
    liabilities: [{ id: "balloon", name: "Short Loan", type: "personalLoan", openingBalance: 25000, interestRatePct: 6, repaymentAmount: 10000, repaymentFrequency: "annually", remainingTermYears: 1 }],
    assets: [],
    propertyIncome: [],
  });
  assert.ok(model.warnings.balloonRepayments.some((item) => item.liabilityId === "balloon" && item.amount > 0));
  assert.equal(model.debtCards.find((item) => item.id === "balloon").payoffIsBalloon, true);
});

test("Stage B negative amortisation warning is grouped for readable display", () => {
  const model = debtProperty({
    liabilities: [{ id: "card", name: "Credit Card", type: "creditCard", openingBalance: 20000, interestRatePct: 20, repaymentAmount: 2000, repaymentFrequency: "annually", remainingTermYears: 30 }],
    assets: [],
    propertyIncome: [],
  });
  const warning = model.warnings.negativeAmortisation.find((item) => item.liabilityId === "card");
  assert.ok(warning.yearCount > 1);
  assert.equal(model.debtCards.find((item) => item.id === "card").hasNegativeAmortisation, true);
});

test("Stage B debt payoff timeline event includes calendar year and ages", () => {
  const { viewModel } = project();
  const group = viewModel.timeline.find((item) => item.calendarYear === 2031);
  assert.ok(group.events.some((event) => /Home Loan repaid/.test(event.title)));
  assert.ok(group.ages.some((age) => age.name === "Alex" && age.age === 55));
  assert.ok(group.ages.some((age) => age.name === "Sam" && age.age === 53));
});

test("Stage B rental property card displays the correct property", () => {
  const model = debtProperty();
  assert.equal(model.propertyCards[0].name, "12 Smith Street");
});

test("Stage B linked property label resolves from stable asset ID", () => {
  const model = debtProperty();
  const card = model.debtCards.find((item) => item.id === "rental-loan");
  assert.equal(card.linkedPropertyName, "12 Smith Street");
});

test("Stage B property equity equals the selected engine output", () => {
  const { result, viewModel } = project();
  const selectedYear = viewModel.debtProperty.propertyCards[0].selectedYear;
  const property = yearFor(result, selectedYear).properties.find((item) => item.id === "rental");
  assert.equal(viewModel.debtProperty.propertyCards[0].projectedPropertyEquity, property.propertyEquity);
});

test("Stage B property equity is not labelled as accessible money", () => {
  assert.match(appSource, /Property equity contributes to projected net worth but is not treated as available retirement spending/);
  assert.doesNotMatch(appSource, /Property equity.*Available investments/i);
});

test("Stage B positive net rental cashflow is surfaced as property cashflow", () => {
  const card = debtProperty().propertyCards[0];
  assert.ok(card.netPropertyCashflow > 0);
  assert.equal(card.cashflowTone, "positive");
});

test("Stage B negative net rental cashflow is surfaced without calling it profit", () => {
  const card = debtProperty({ propertyIncome: [{ id: "rent", name: "12 Smith Street rent", linkedAssetId: "rental", linkedLoanIds: ["rental-loan"], annualIncome: 1000, rentalCashflowTreatment: "afterInterest" }] }).propertyCards[0];
  assert.ok(card.netPropertyCashflow < 0);
  assert.equal(card.cashflowTone, "warning");
  assert.match(appSource, /Net property cashflow/);
  assert.doesNotMatch(appSource, /Net property profit/);
});

test("Stage B before-interest rental treatment appears in assumptions", () => {
  const { viewModel } = project({ propertyIncome: [{ id: "rent", name: "Rent before interest", linkedAssetId: "rental", linkedLoanIds: ["rental-loan"], annualIncome: 18000, rentalCashflowTreatment: "beforeInterest" }] });
  assert.ok(viewModel.assumptions.rows.some((row) => row.label === "Rent before interest treatment" && /before loan interest/.test(row.value)));
});

test("Stage B after-interest rental treatment appears in assumptions", () => {
  const { viewModel } = project();
  assert.ok(viewModel.assumptions.rows.some((row) => row.label === "12 Smith Street rent treatment" && /after loan interest/.test(row.value)));
});

test("Stage B investable assets and net worth are displayed separately", () => {
  const distinction = debtProperty().netWorthDistinction;
  assert.notEqual(distinction.investableRetirementAssets, distinction.projectedNetWorth);
  assert.ok(Number.isFinite(Number(distinction.investableRetirementAssets)));
  assert.ok(Number.isFinite(Number(distinction.projectedNetWorth)));
});

test("Stage B property equity increases net worth but not investable assets", () => {
  const distinction = debtProperty().netWorthDistinction;
  assert.ok(distinction.totalPropertyEquity > 0);
  assert.ok(distinction.projectedNetWorth > distinction.investableRetirementAssets);
});

test("Stage B debt reduces projected net worth", () => {
  const withDebt = debtProperty().netWorthDistinction.projectedNetWorth;
  const noDebt = debtProperty({ liabilities: [], propertyIncome: [] }).netWorthDistinction.projectedNetWorth;
  assert.ok(withDebt < noDebt);
});

test("Stage B property remains after accessible funds exhaustion and is marked non-accessible", () => {
  const model = debtProperty({
    accessibleInvestments: { openingBalance: 50000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
    household: { fullRetirementLifestyleSpending: 100000 },
    liabilities: [],
    propertyIncome: [],
    scenario: { fullRetirementAnnualSpending: 100000 },
  });
  assert.ok(model.accessibleExhaustionPropertyEquity.propertyEquity > 0);
});

test("Stage B annual liability detail matches engine output", () => {
  const { result, viewModel } = project();
  const annual = viewModel.annualRows[0].liabilities.find((item) => item.id === "home");
  const engine = result.years[0].liabilities.find((item) => item.id === "home");
  assert.deepEqual(annual, engine);
});

test("Stage B annual property detail matches engine output", () => {
  const { result, viewModel } = project();
  const annual = viewModel.annualRows[0].properties.find((item) => item.id === "rental");
  const engine = result.years[0].properties.find((item) => item.id === "rental");
  assert.deepEqual(annual, engine);
});

test("Stage B annual rows reflect lower repayment after debt payoff", () => {
  const { viewModel } = project();
  const payoffYear = viewModel.annualRows.find((row) => row.calendarYear === 2031);
  const followingYear = viewModel.annualRows.find((row) => row.calendarYear === 2032);
  assert.ok(payoffYear.household.totalDebtRepayments > followingYear.household.totalDebtRepayments);
});

test("Stage B annual debt and property detail refreshes after scenario adjustment", () => {
  const original = baseInput();
  const originalProjection = ENGINE.projectRetirementScenario(original);
  const draft = mergeDeep(original, {});
  UI.applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", 25000);
  const adjustedProjection = ENGINE.projectRetirementScenario(draft);
  const adjustedViewModel = UI.buildSemiRetirementResultsViewModel(adjustedProjection, draft, draft);
  assert.notEqual(originalProjection.years[0].household.totalNetWorth, undefined);
  assert.equal(adjustedViewModel.annualRows[0].liabilities[0].closingBalance, adjustedProjection.years[0].liabilities[0].closingBalance);
  assert.equal(adjustedViewModel.annualRows[0].properties[0].propertyEquity, adjustedProjection.years[0].properties[0].propertyEquity);
});
