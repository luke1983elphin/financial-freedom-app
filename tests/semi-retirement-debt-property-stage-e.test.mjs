import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console, URLSearchParams };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function rentalLoan(overrides = {}) {
  return {
    id: "smith-loan",
    name: "Smith St loan",
    type: "rentalPropertyLoan",
    balance: 400000,
    interestRatePct: 5,
    repayment: 32000,
    repaymentFrequency: "annually",
    termYears: 30,
    linkedAssetId: "smith-st",
    ...overrides,
  };
}

function propertyAsset(overrides = {}) {
  return {
    id: "smith-st",
    name: "Smith St",
    category: "rentalInvestmentProperty",
    value: 600000,
    owner: "joint",
    person1AllocationPercentage: 50,
    person2AllocationPercentage: 50,
    annualGrossRentalIncome: 50000,
    annualPropertyOperatingExpenses: 10000,
    propertyGrowthRatePct: 3,
    ...overrides,
  };
}

function planWithProperty({ asset = propertyAsset(), liabilities = [rentalLoan()], incomeItems = [] } = {}) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Luke";
  plan.personal.person2Name = "Lisa";
  plan.personal.person1Age = 43;
  plan.personal.person2Age = 41;
  plan.personal.fullRetirementAge = 60;
  plan.personal.targetAnnualSpending = 90000;
  plan.investing.inflationPct = 2.5;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.investing.expectedSuperReturnPct = 6.5;
  plan.assetItems = [asset];
  plan.liabilityItems = liabilities;
  plan.incomeItems = [
    { id: "salary-luke", name: "Luke salary", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "salary-lisa", name: "Lisa salary", type: "salaryWages", owner: "person2", amount: 85000, frequency: "annually" },
    ...incomeItems,
  ];
  return plan;
}

function propertyResult(plan = planWithProperty()) {
  const summary = CALC.calculateRentalPropertySummary(plan);
  const result = summary.propertyResults.find((item) => item.linkedAssetId === "smith-st");
  assert.ok(result, "Expected Smith St property result");
  return { summary, result };
}

function project(plan = planWithProperty(), mutator = () => {}) {
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result).draft;
  defaults.projectionEndAge = 80;
  defaults.accessibleInvestments.openingBalance = 500000;
  defaults.accessibleInvestments.externalAnnualAccessibleContribution = 0;
  mutator(defaults);
  const run = UI.runSemiRetirementProjection(ENGINE, defaults);
  assert.equal(run.validation.isValid, true, JSON.stringify(run.validation.errors));
  return run.result;
}

test("Stage E Phase 1 property editor is the authoritative rental-property entry point", () => {
  assert.match(appSource, /Annual gross rental income/);
  assert.match(appSource, /Annual property expenses/);
  assert.match(appSource, /Investment property loan/);
  assert.match(appSource, /data-add-property-loan/);
  assert.match(appSource, /data-property-loan-link/);
  assert.match(appSource, /Managed under Rental \/ Investment Property/);
  assert.match(appSource, /ensureDerivedRentalIncomeForProperty/);
});

test("Stage E Phase 1 uses stable property and loan IDs for rental linking", () => {
  assert.match(appSource, /linkedAssetId: asset\.id/);
  assert.match(appSource, /linkedLoanIds/);
  assert.doesNotMatch(appSource, /linkedAssetName/);
  assert.match(appSource, /loan\.linkedAssetId = assetId/);
});

test("Stage E legacy rental record loads without fabricating gross rent or expenses", () => {
  const plan = planWithProperty({
    asset: propertyAsset({
      annualGrossRentalIncome: undefined,
      annualPropertyOperatingExpenses: undefined,
    }),
    liabilities: [],
    incomeItems: [{
      id: "legacy-rent",
      name: "Smith St legacy rent",
      type: "rentalNetCashIncome",
      owner: "joint",
      amount: 8000,
      taxableRentalIncomeAnnual: 8000,
      linkedAssetId: "smith-st",
    }],
  });
  const { result } = propertyResult(plan);
  assert.equal(result.hasRentalPropertyDetails, false);
  assert.equal(result.annualGrossRentalIncome, null);
  assert.equal(result.annualPropertyOperatingExpenses, null);
  assert.equal(result.legacyTaxableRentalProfitAnnual, 8000);
  assert.match(result.warnings[0].message, /needs gross rental income and annual property expenses/i);
});

test("Stage E rental-property summary CSS is responsive", () => {
  assert.match(stylesSource, /\.rental-property-summary-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s);
  assert.match(stylesSource, /@media \(max-width: 640px\)[\s\S]*\.rental-property-summary-grid\s*\{[\s\S]*grid-template-columns: 1fr;/);
});

test("Stage E Phase 2 current-year rental property derives taxable profit and household cashflow", () => {
  const plan = planWithProperty({
    liabilities: [rentalLoan({
      repayment: 20000,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
    })],
  });
  const { summary, result } = propertyResult(plan);
  assert.equal(result.annualGrossRentalIncome, 50000);
  assert.equal(result.annualPropertyOperatingExpenses, 10000);
  assert.equal(result.annualLoanInterest, 20000);
  assert.equal(result.annualLoanPrincipal, 12000);
  assert.equal(result.annualLoanRepayments, 32000);
  assert.equal(result.currentTaxableRentalProfit, 20000);
  assert.equal(result.currentNetPropertyCashflow, 8000);
  assert.equal(result.householdCashflowContribution, 8000);
  assert.equal(summary.annualGrossRentalIncome, 50000);
  assert.equal(summary.annualPropertyOperatingExpenses, 10000);
  assert.equal(summary.annualCurrentTaxableRentalProfit, 20000);
  assert.equal(summary.annualCurrentNetPropertyCashflow, 8000);
});

test("Stage E Phase 2 rental taxable profit follows property ownership while household cashflow is counted once", () => {
  const plan = planWithProperty({
    asset: propertyAsset({
      owner: "joint",
      person1AllocationPercentage: 50,
      person2AllocationPercentage: 50,
    }),
    liabilities: [rentalLoan({
      repayment: 20000,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
    })],
  });
  const income = CALC.incomeBreakdown(plan, CALC.calculateRentalPropertySummary(plan));
  assert.equal(income.person1TaxableOther, 10000);
  assert.equal(income.person2TaxableOther, 10000);
  assert.equal(income.jointOtherTaxable, 20000);
  assert.equal(income.otherIncome, 20000);
  const result = CALC.calculatePlan(plan);
  assert.equal(result.rentalPropertySummary.annualHouseholdCashflowContribution, 8000);
  assert.equal(result.annualRentalLoanCashflowRepayments, 12000);
  assert.equal(result.otherAnnualIncome, 20000);
  assert.equal(result.incomeBreakdown.otherIncome, 20000);
});

test("Stage E Phase 2 rental ownership can allocate taxable profit unequally without duplicate household income", () => {
  const plan = planWithProperty({
    asset: propertyAsset({
      owner: "joint",
      person1AllocationPercentage: 70,
      person2AllocationPercentage: 30,
    }),
    liabilities: [rentalLoan({
      repayment: 20000,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
    })],
  });
  const income = CALC.incomeBreakdown(plan, CALC.calculateRentalPropertySummary(plan));
  assert.equal(income.person1TaxableOther, 14000);
  assert.equal(income.person2TaxableOther, 6000);
  assert.equal(income.taxableTotal, 225000);
  assert.equal(income.total, 225000);
});

test("Stage E Phase 3 future property rows grow gross rent and expenses with CPI and use the debt schedule", () => {
  const plan = planWithProperty({
    liabilities: [rentalLoan({
      repayment: 20000,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
      termYears: 30,
    })],
  });
  const result = project(plan);
  const year0 = result.years[0].propertyIncome[0];
  const year1 = result.years[1].propertyIncome[0];
  assert.equal(year0.grossRentalIncome, 50000);
  assert.equal(year0.propertyExpenses, 10000);
  assert.equal(year0.loanInterest, 20000);
  assert.equal(year0.loanPrincipal, 12000);
  assert.equal(year0.fullLoanRepayments, 32000);
  assert.equal(year0.taxableRentalIncome, 20000);
  assert.equal(year0.netPropertyCashflow, 8000);
  assert.equal(year0.person1TaxableIncome, 10000);
  assert.equal(year0.person2TaxableIncome, 10000);
  assert.equal(result.years[0].people[0].rentalTaxableIncome, 10000);
  assert.equal(result.years[0].people[1].rentalTaxableIncome, 10000);
  assert.equal(result.years[0].household.totalRentalTaxableIncome, 20000);
  assert.equal(result.years[0].household.netRentalCashflow, 8000);
  assert.equal(year1.grossRentalIncome, 51250);
  assert.equal(year1.propertyExpenses, 10250);
  assert.equal(year1.loanInterest, 19400);
  assert.equal(year1.loanPrincipal, 12600);
  assert.equal(year1.fullLoanRepayments, 32000);
  assert.equal(year1.taxableRentalIncome, 21600);
  assert.equal(year1.netPropertyCashflow, 9000);
});

test("Stage E Phase 3 rent and expenses continue after a linked rental loan is repaid", () => {
  const plan = planWithProperty({
    liabilities: [rentalLoan({
      balance: 12000,
      interestRatePct: 0,
      repayment: 0,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
      termYears: 30,
    })],
  });
  const result = project(plan);
  const year0 = result.years[0].propertyIncome[0];
  const year1 = result.years[1].propertyIncome[0];
  assert.equal(year0.loanPrincipal, 12000);
  assert.equal(year0.netPropertyCashflow, 28000);
  assert.equal(year1.loanInterest, 0);
  assert.equal(year1.loanPrincipal, 0);
  assert.equal(year1.fullLoanRepayments, 0);
  assert.equal(year1.grossRentalIncome, 51250);
  assert.equal(year1.propertyExpenses, 10250);
  assert.equal(year1.taxableRentalIncome, 41000);
  assert.equal(year1.netPropertyCashflow, 41000);
});

test("Stage E Phase 3 multiple linked rental loans are combined once", () => {
  const plan = planWithProperty({
    liabilities: [
      rentalLoan({
        id: "smith-loan-1",
        repayment: 20000,
        repaymentFrequency: "annually",
        repaymentType: "interestOnly",
        additionalPrincipalRepayment: 12000,
        additionalPrincipalFrequency: "annually",
      }),
      rentalLoan({
        id: "smith-loan-2",
        name: "Second Smith St loan",
        balance: 100000,
        interestRatePct: 5,
        repayment: 5000,
        repaymentFrequency: "annually",
        repaymentType: "interestOnly",
        additionalPrincipalRepayment: 3000,
        additionalPrincipalFrequency: "annually",
      }),
    ],
  });
  const result = project(plan);
  const row = result.years[0].propertyIncome[0];
  assert.equal(Array.from(row.linkedLoanIds).sort().join(","), "smith-loan-1,smith-loan-2");
  assert.equal(row.loanInterest, 25000);
  assert.equal(row.loanPrincipal, 15000);
  assert.equal(row.fullLoanRepayments, 40000);
  assert.equal(row.taxableRentalIncome, 15000);
  assert.equal(row.netPropertyCashflow, 0);
  assert.equal(result.years[0].household.propertyDebtRepayments, 40000);
});

test("Stage E Phase 3 rental income is not duplicated as passive income in semi-retirement inputs", () => {
  const plan = planWithProperty({
    incomeItems: [{
      id: "income-rental-smith-st",
      name: "Smith St derived rent",
      type: "rentalNetCashIncome",
      owner: "joint",
      amount: 20000,
      annualGrossRentalIncome: 50000,
      annualPropertyOperatingExpenses: 10000,
      linkedAssetId: "smith-st",
      derivedFromProperty: true,
    }],
  });
  const result = CALC.calculatePlan(plan);
  const draft = UI.buildSemiRetirementScenarioDefaults(plan, result).draft;
  assert.equal(draft.propertyIncome.length, 1);
  assert.equal(draft.propertyIncome[0].annualGrossRentalIncome, 50000);
  assert.equal(draft.propertyIncome[0].annualPropertyOperatingExpenses, 10000);
  assert.equal(draft.passiveIncome.some((item) => item.type === "rentalTaxableIncome"), false);
});

test("Stage E Phase 4 semi-retirement property cards expose the full rental cashflow model", () => {
  const plan = planWithProperty({
    liabilities: [rentalLoan({
      repayment: 20000,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
      termYears: 30,
    })],
  });
  const result = project(plan);
  const view = UI.buildDebtPropertyResultsViewModel(result, result.years[0].people);
  const card = view.propertyCards.find((item) => item.id === "smith-st");
  assert.ok(card, "Expected Smith St property card");
  assert.equal(card.grossRentalIncome > 0, true);
  assert.equal(card.propertyExpenses > 0, true);
  assert.equal(Number.isFinite(card.loanInterest), true);
  assert.equal(Number.isFinite(card.loanPrincipal), true);
  assert.equal(Number.isFinite(card.taxableRentalProfit), true);
  assert.equal(Number.isFinite(card.netPropertyCashflow), true);
  assert.match(appSource, /Projected gross rental income/);
  assert.match(appSource, /Projected operating expenses/);
  assert.match(appSource, /Projected loan interest/);
  assert.match(appSource, /Projected loan principal/);
  assert.match(appSource, /Projected taxable rental profit/);
});

test("Stage E Phase 4 household cashflow includes whole-property net cashflow once", () => {
  const plan = planWithProperty({
    liabilities: [rentalLoan({
      repayment: 20000,
      repaymentFrequency: "annually",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 12000,
      additionalPrincipalFrequency: "annually",
      termYears: 30,
    })],
  });
  const result = project(plan);
  const year0 = result.years[0];
  assert.equal(year0.household.netRentalCashflow, 8000);
  assert.equal(year0.household.otherIncome, 0);
  assert.equal(year0.household.netHouseholdCashIncome, year0.household.totalNetEmploymentIncome + 8000);
  assert.equal(year0.household.scheduledDebtCashRequirement, 0);
  assert.equal(year0.household.propertyDebtRepayments, 32000);
});
