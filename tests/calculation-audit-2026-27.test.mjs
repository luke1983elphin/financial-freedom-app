import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const CALCULATOR_PATH = new URL("../calculator.js", import.meta.url);
const APP_PATH = new URL("../app.js", import.meta.url);

function loadCalculator() {
  const source = readFileSync(CALCULATOR_PATH, "utf8");
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.FFSCalculator;
}

function basePlan() {
  const CALC = loadCalculator();
  const plan = CALC.emptyPlan();
  plan.incomeItems = [];
  plan.expenseItems = [];
  plan.assetItems = [];
  plan.liabilityItems = [];
  plan.investing.annualInvestingTarget = 0;
  plan.investing.extraSuperContributions = 0;
  plan.investing.person1EmployerSuperOverrideEnabled = false;
  plan.investing.person2EmployerSuperOverrideEnabled = false;
  plan.liabilities.homeLoanBalance = 0;
  plan.liabilities.monthlyRepayment = 0;
  plan.liabilities.creditCardBalance = 0;
  plan.liabilities.creditCardMonthlyRepayment = 0;
  plan.liabilities.otherDebts = 0;
  return { CALC, plan };
}

test("2026-27 resident tax helper uses the audited resident bracket table before offsets and Medicare", () => {
  const CALC = loadCalculator();
  assert.equal(CALC.CALCULATION_VERSION, "2026.27.1");
  assert.equal(CALC.FINANCIAL_YEAR, "2026-27");
  const cases = [
    [18200, 0],
    [20000, 270],
    [45000, 4020],
    [50000, 5520],
    [135000, 31020],
    [150000, 36570],
    [190000, 51370],
    [200000, 55870],
  ];
  for (const [income, expected] of cases) {
    assert.equal(CALC.calculateResidentIncomeTax2026_27(income), expected);
  }
});

test("LITO reduces income tax only and is capped at income tax before Medicare", () => {
  const CALC = loadCalculator();
  assert.equal(CALC.calculateLITO(0), 700);
  assert.equal(CALC.calculateLITO(37500), 700);
  assert.equal(CALC.calculateLITO(45000), 325);
  assert.equal(CALC.calculateLITO(66667), 0);

  const lowIncome = CALC.individualTaxBreakdown(20000);
  assert.equal(lowIncome.incomeTaxBeforeOffsets, 270);
  assert.equal(lowIncome.lito, 270);
  assert.equal(lowIncome.incomeTax, 0);
  assert.equal(lowIncome.medicareLevy, 400);

  const midIncome = CALC.individualTaxBreakdown(50000);
  assert.equal(midIncome.incomeTaxBeforeOffsets, 5520);
  assert.equal(midIncome.lito, 250);
  assert.equal(midIncome.incomeTax, 5270);
  assert.equal(midIncome.medicareLevy, 1000);
});

test("2026-27 STSL repayments use marginal thresholds and cap at remaining balance", () => {
  const CALC = loadCalculator();
  const bigBalance = 100000;
  const cases = [
    [69528, 0],
    [69529, 0.15],
    [86380, 2527.8],
    [129717, 9028.35],
    [129718, 9028.17],
    [137064, 10276.99],
    [186050, 18604.61],
    [186051, 18605.1],
  ];
  for (const [income, expected] of cases) {
    assert.equal(CALC.estimateHelpRepayment(income, bigBalance).annualRepayment, expected);
  }
  assert.equal(CALC.estimateHelpRepayment(100000, 1000).annualRepayment, 1000);
  assert.equal(CALC.estimateHelpRepayment(100000, 0).annualRepayment, 0);
});

test("STSL balances and repayments remain person-specific in the full plan", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
    { id: "salary-2", type: "salaryWages", owner: "person2", amount: 80000, frequency: "annually" },
  ];
  plan.income.person1HasStslDebt = true;
  plan.income.person2HasStslDebt = true;
  plan.liabilityItems = [
    { id: "liability-stsl-person1", type: "hecsHelp", owner: "person1", balance: 1000 },
    { id: "liability-stsl-person2", type: "hecsHelp", owner: "person2", balance: 50000 },
  ];
  const result = CALC.calculatePlan(plan);
  assert.equal(result.stslRepaymentEstimate.person1.annualRepayment, 1000);
  assert.equal(result.stslRepaymentEstimate.person1.projectedClosingBalance, 0);
  assert.equal(result.stslRepaymentEstimate.person2.annualRepayment, 1570.8);
  assert.equal(result.stslRepaymentEstimate.person2.projectedClosingBalance, 48429.2);
});

test("STSL repayment income includes allocated investment income, franking credits and rental taxable income", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary", type: "salaryWages", owner: "person1", amount: 65000, frequency: "annually" },
    { id: "interest", type: "interest", owner: "person1", amount: 5000, frequency: "annually" },
    { id: "dividend", type: "dividends", owner: "person1", amount: 4200, cashDividend: 4200, frankingCredits: 1800, frequency: "annually" },
    { id: "rental", type: "rentalNetCashIncome", owner: "person1", amount: 4000, frequency: "annually", rentalCashflowTreatment: "afterInterest" },
  ];
  plan.income.person1HasStslDebt = true;
  plan.liabilityItems = [
    { id: "stsl-person1", type: "stsl", owner: "person1", balance: 20000 },
  ];
  const result = CALC.calculatePlan(plan);
  assert.equal(result.stslRepaymentIncome.person1, 80000);
  assert.equal(result.stslRepaymentEstimate.person1.repaymentIncome, 80000);
  assert.equal(result.stslRepaymentEstimate.person1.annualRepayment, 1570.8);
  assert.equal(result.stslRepaymentEstimate.annualRepayment, 1570.8);
});

test("Medicare levy surcharge separates threshold income, surcharge base and whole-family cover", () => {
  const CALC = loadCalculator();
  assert.equal(CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 105000,
    person1CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: false,
  }).annualSurcharge, 0);
  assert.equal(CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 105001,
    person1CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: false,
  }).rate, 0.01);
  assert.equal(CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 123001,
    person1CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: false,
  }).rate, 0.0125);
  assert.equal(CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 164001,
    person1CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: false,
  }).rate, 0.015);

  const familyNoCover = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 120001,
    person2TaxableIncome: 90000,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: true,
  });
  assert.equal(familyNoCover.rate, 0.01);
  assert.equal(familyNoCover.annualSurcharge, 2100.01);

  const twoChildren = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 121000,
    person2TaxableIncome: 90000,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "no-cover",
    dependants: 2,
    hasPartner: true,
  });
  assert.equal(twoChildren.thresholds[0], 211500);
  assert.equal(twoChildren.annualSurcharge, 0);

  const fringeBenefitThreshold = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 95000,
    person1MLSIncomeForThreshold: 115000,
    person1MLSSurchargeBase: 95000,
    person1CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: false,
  });
  assert.equal(fringeBenefitThreshold.householdIncome, 115000);
  assert.equal(fringeBenefitThreshold.rate, 0.01);
  assert.equal(fringeBenefitThreshold.annualSurcharge, 950);

  const spouseUninsured = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 130000,
    person2TaxableIncome: 100000,
    person1CoverStatus: "full-year",
    person2CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: true,
  });
  assert.equal(spouseUninsured.person1Surcharge, 1300);
  assert.equal(spouseUninsured.person2Surcharge, 1000);
  assert.equal(spouseUninsured.annualSurcharge, 2300);

  const person1Uninsured = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 130000,
    person2TaxableIncome: 100000,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "full-year",
    dependants: 0,
    hasPartner: true,
  });
  assert.equal(person1Uninsured.person1Surcharge, 1300);
  assert.equal(person1Uninsured.person2Surcharge, 1000);

  const fullCover = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 150000,
    person2TaxableIncome: 100000,
    person1CoverStatus: "full-year",
    person2CoverStatus: "full-year",
    dependants: 0,
    hasPartner: true,
  });
  assert.equal(fullCover.annualSurcharge, 0);

  const childUncovered = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 150000,
    person2TaxableIncome: 100000,
    person1CoverStatus: "full-year",
    person2CoverStatus: "full-year",
    dependantsHospitalCoverStatus: "no-cover",
    dependants: 1,
    hasPartner: true,
  });
  assert.equal(childUncovered.person1Surcharge, 1875);
  assert.equal(childUncovered.person2Surcharge, 1250);
  assert.equal(childUncovered.annualSurcharge, 3125);

  const missingChildCover = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 150000,
    person2TaxableIncome: 100000,
    person1CoverStatus: "full-year",
    person2CoverStatus: "full-year",
    dependants: 1,
    hasPartner: true,
  });
  assert.equal(missingChildCover.status, "incomplete");
  assert.equal(missingChildCover.cannotConfirm, true);
  assert.equal(missingChildCover.annualSurcharge, null);

  const partYear = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 200000,
    person1CoverStatus: "partial-year",
    person1CoveredDays: 182,
    dependants: 0,
    hasPartner: false,
  });
  assert.equal(partYear.annualSurcharge, 1504.11);
  assert.match(partYear.note, /covered days overlap/);

  const person2LowIncome = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 230000,
    person2TaxableIncome: 27222,
    person1MLSIncomeForThreshold: 230000,
    person2MLSIncomeForThreshold: 27222,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: true,
    spouseForFullYear: true,
  });
  assert.equal(person2LowIncome.person1Surcharge, 2875);
  assert.equal(person2LowIncome.person2Surcharge, 0);
  assert.equal(person2LowIncome.person2LowIncomeSpouseExempt, true);
  assert.equal(person2LowIncome.annualSurcharge, 2875);

  const person1LowIncome = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 27222,
    person2TaxableIncome: 230000,
    person1MLSIncomeForThreshold: 27222,
    person2MLSIncomeForThreshold: 230000,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: true,
    spouseForFullYear: true,
  });
  assert.equal(person1LowIncome.person1Surcharge, 0);
  assert.equal(person1LowIncome.person2Surcharge, 2875);
  assert.equal(person1LowIncome.person1LowIncomeSpouseExempt, true);

  const notFullYearSpouse = CALC.calculateMedicareLevySurcharge({
    person1TaxableIncome: 27222,
    person2TaxableIncome: 230000,
    person1MLSIncomeForThreshold: 27222,
    person2MLSIncomeForThreshold: 230000,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "no-cover",
    dependants: 0,
    hasPartner: true,
    spouseForFullYear: false,
  });
  assert.equal(notFullYearSpouse.person1LowIncomeSpouseExempt, false);
  assert.equal(notFullYearSpouse.person1Surcharge, 340.28);
});

test("missing MLS cover information remains incomplete in the full plan rather than becoming a false zero", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary", type: "salaryWages", owner: "person1", amount: 150000, frequency: "annually" },
  ];
  const result = CALC.calculatePlan(plan);
  assert.equal(result.taxEstimate.medicareLevySurcharge, null);
  assert.equal(result.taxEstimate.medicareLevySurchargeEstimate.status, "incomplete");
  assert.equal(result.taxEstimate.medicareLevySurchargeEstimate.cannotConfirm, true);
  assert.match(result.taxEstimate.medicareLevySurchargeEstimate.note, /MLS not included/);
  assert.equal(result.estimatedTaxAndHelp, result.taxEstimate.incomeTax + result.taxEstimate.medicareLevy);
});

test("employer super is calculated from salary only and supports package-inclusive salary items", () => {
  const { CALC, plan } = basePlan();
  assert.equal(CALC.calculateEmployerSuperForPerson("person1", [
    { type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
  ]), 12000);
  assert.equal(CALC.calculateEmployerSuperForPerson("person1", [
    { type: "salaryWages", owner: "person1", amount: 80000, frequency: "annually" },
  ]), 9600);
  assert.equal(CALC.calculateEmployerSuperForPerson("person1", [
    { type: "salaryWages", owner: "person1", amount: 112000, frequency: "annually", salaryIncludesEmployerSuper: true },
  ]), 12000);
  assert.equal(CALC.calculateEmployerSuperForPerson("person1", [
    { type: "dividends", owner: "person1", amount: 20000, frequency: "annually" },
    { type: "rentalNetCashIncome", owner: "person1", amount: 15000, frequency: "annually" },
  ]), 0);
  assert.equal(CALC.calculateEmployerSuperForPerson("person1", [
    { type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually", qualifyingEarningsOverrideEnabled: true, qualifyingEarningsAmount: 90000 },
  ]), 10800);

  plan.incomeItems = [
    { id: "package", type: "salaryWages", owner: "person1", amount: 112000, frequency: "annually", salaryIncludesEmployerSuper: true },
    { id: "salary-2", type: "salaryWages", owner: "person2", amount: 80000, frequency: "annually" },
  ];
  const result = CALC.calculatePlan(plan);
  assert.equal(result.annualGrossIncome, 180000);
  assert.equal(result.person1SalaryWages, 100000);
  assert.equal(result.employerSuperContributions.person1Calculated, 12000);
  assert.equal(result.employerSuperContributions.person2Calculated, 9600);
});

test("passive income and dividend tax treatment do not double count franking credits or employment income", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary", type: "salaryWages", owner: "person1", amount: 200000, frequency: "annually" },
    { id: "interest", type: "interest", owner: "person1", amount: 2000, frequency: "annually" },
    { id: "dividend", type: "dividends", owner: "person2", amount: 4000, cashDividend: 4000, frankingCredits: 1714, frequency: "annually" },
    { id: "other-active", type: "other", owner: "person2", amount: 3000, frequency: "annually", isPassiveIncome: false },
    { id: "other-passive", type: "other", owner: "joint", amount: 1000, frequency: "annually", isPassiveIncome: true },
  ];
  const result = CALC.calculatePlan(plan);
  assert.equal(result.passiveIncomeBreakdown.interest, 2000);
  assert.equal(result.passiveIncomeBreakdown.dividends, 4000);
  assert.equal(result.passiveIncomeBreakdown.otherPassive, 1000);
  assert.equal(result.passiveIncomeBreakdown.total, 7000);
  assert.equal(result.person2AnnualIncome, 9214);
  assert.equal(result.annualGrossIncome, 210000);
});

test("rental cashflow uses linked loan treatment without deducting loan interest twice", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    {
      id: "rental-after-interest",
      type: "rentalNetCashIncome",
      owner: "joint",
      amount: 7000,
      frequency: "annually",
      rentalCashflowTreatment: "afterInterest",
      linkedLoanIds: ["rental-loan"],
    },
  ];
  plan.liabilityItems = [
    {
      id: "rental-loan",
      type: "rentalPropertyLoan",
      balance: 300000,
      interestRatePct: 5,
      repayment: 1250,
      repaymentFrequency: "monthly",
      repaymentType: "interestOnly",
      additionalPrincipalRepayment: 6000,
      additionalPrincipalFrequency: "annually",
      linkedRentalIncomeId: "rental-after-interest",
    },
  ];
  let result = CALC.calculatePlan(plan);
  assert.equal(result.rentalPropertyCashflow.annualLoanInterest, 15000);
  assert.equal(result.rentalPropertyCashflow.annualLoanPrincipal, 6000);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 6000);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdCashflowContribution, 1000);
  assert.equal(result.rentalPropertyCashflow.annualRentalPassiveIncomeBeforePrincipal, 7000);
  assert.equal(result.rentalPropertyCashflow.annualRentalPrincipalRepayments, 6000);
  assert.equal(result.rentalPropertyCashflow.annualRentalHouseholdCashflowAfterPrincipal, 1000);
  assert.equal(result.passiveIncomeBreakdown.rental, 7000);
  assert.equal(result.passiveIncomeBreakdown.rentalProperties[0].passiveRentalCashflow, 7000);
  assert.equal(result.passiveIncomeBreakdown.rentalProperties[0].rentalHouseholdCashflowAfterPrincipal, 1000);

  plan.incomeItems[0].amount = 22000;
  plan.incomeItems[0].rentalCashflowTreatment = "beforeInterest";
  result = CALC.calculatePlan(plan);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 21000);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdCashflowContribution, 1000);
  assert.equal(result.rentalPropertyCashflow.annualRentalPassiveIncomeBeforePrincipal, 7000);
  assert.equal(result.passiveIncomeBreakdown.rental, 7000);
});

test("FI asset categories separate liquid assets, property equity and superannuation", () => {
  const { CALC, plan } = basePlan();
  plan.personal.person1Age = 45;
  plan.assets.offsetBalance = 20000;
  plan.assets.cash = 30000;
  plan.assets.sharesEtfs = 100000;
  plan.assets.crypto = 5000;
  plan.assets.otherPropertyValue = 600000;
  plan.assets.superPerson1 = 150000;
  plan.assets.superPerson2 = 50000;
  plan.liabilityItems = [
    { id: "rental-loan", type: "rentalPropertyLoan", balance: 350000 },
  ];
  let result = CALC.calculatePlan(plan);
  assert.equal(result.liquidInvestmentAssets, 155000);
  assert.equal(result.investmentPropertyGrossValue, 600000);
  assert.equal(result.investmentPropertyDebt, 350000);
  assert.equal(result.investmentPropertyEquity, 250000);
  assert.equal(result.superannuationBalance, 200000);
  assert.equal(result.accessibleFICapital, 155000);
  assert.equal(result.totalIncomeProducingAssets, 605000);
  assert.equal(result.includeInvestmentPropertyEquityInFi, false);

  plan.assets.includeInvestmentPropertyEquityInFi = true;
  result = CALC.calculatePlan(plan);
  assert.equal(result.accessibleFICapital, 405000);
  assert.equal(result.financialIndependenceAssets, 405000);
});

test("saved records and snapshots retain calculation version metadata", () => {
  const appSource = readFileSync(APP_PATH, "utf8");
  assert.match(appSource, /const CALCULATION_VERSION = CALC\?\.CALCULATION_VERSION \|\| "2026\.27\.1"/);
  assert.match(appSource, /const FINANCIAL_YEAR = CALC\?\.FINANCIAL_YEAR \|\| "2026-27"/);
  assert.match(appSource, /calculationVersion: CALCULATION_VERSION/);
  assert.match(appSource, /snapshotSchemaVersion: FINANCIAL_SNAPSHOT_CALCULATION_VERSION/);
  assert.match(appSource, /financialYear: FINANCIAL_YEAR/);
});
