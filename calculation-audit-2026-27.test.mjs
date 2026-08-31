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
  assert.equal(lowIncome.medicareLevy, 0);

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

test("STSL repayment income includes allocated investment income and rental taxable income without treating franking credits as cash", () => {
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
  assert.equal(result.stslRepaymentIncome.person1, 78200);
  assert.equal(result.stslRepaymentEstimate.person1.repaymentIncome, 78200);
  assert.equal(result.stslRepaymentEstimate.person1.annualRepayment, 1300.8);
  assert.equal(result.stslRepaymentEstimate.annualRepayment, 1300.8);
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

test("dividend income migrates old franking fields into annual cash dividends only", () => {
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
  assert.equal(result.person2AnnualIncome, 7500);
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
      rentalCashIncomeAnnual: 7000,
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
  plan.incomeItems[0].rentalCashIncomeAnnual = 22000;
  plan.incomeItems[0].rentalCashflowTreatment = "beforeInterest";
  result = CALC.calculatePlan(plan);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 21000);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdCashflowContribution, 1000);
  assert.equal(result.rentalPropertyCashflow.annualRentalPassiveIncomeBeforePrincipal, 7000);
  assert.equal(result.passiveIncomeBreakdown.rental, 7000);
});

test("Financial Freedom progress uses net FI assets while passive income stays separate", () => {
  const { CALC, plan } = basePlan();
  plan.personal.person1Age = 45;
  plan.personal.fullRetirementAge = 55;
  plan.personal.targetAnnualSpending = 100000;
  plan.investing.safeWithdrawalRatePct = 4;
  plan.assets.homeValue = 900000;
  plan.liabilities.homeLoanBalance = 700000;
  plan.assets.offsetBalance = 0;
  plan.assets.cash = 0;
  plan.assets.sharesEtfs = 750000;
  plan.assets.crypto = 0;
  plan.assets.otherPropertyValue = 600000;
  plan.assets.superPerson1 = 400000;
  plan.assets.superPerson2 = 100000;
  plan.liabilityItems = [
    { id: "rental-loan", type: "rentalPropertyLoan", balance: 350000 },
  ];
  let result = CALC.calculatePlan(plan);
  assert.equal(result.targetAnnualLifestyleSpendingToday, 100000);
  assert.equal(result.targetAnnualLifestyleSpendingAtFinancialFreedomAge, 128008.45);
  assert.equal(result.currentYearTargetCapital, 2500000);
  assert.equal(result.targetCapital, 3200211.25);
  assert.equal(result.targetProjectionAge, 55);
  assert.equal(result.targetProjectionYear, 10);
  assert.equal(result.liquidInvestmentAssets, 750000);
  assert.equal(result.investmentPropertyGrossValue, 600000);
  assert.equal(result.investmentPropertyDebt, 350000);
  assert.equal(result.investmentPropertyEquity, 250000);
  assert.equal(result.accessibleInvestmentAssets, 750000);
  assert.equal(result.superannuationBalance, 500000);
  assert.equal(result.financialIndependenceAssets, 1000000);
  assert.equal(result.currentNetFiAssets, 1000000);
  assert.equal(result.financialFreedomProgressRaw, 31.2479);
  assert.equal(result.financialFreedomScore, 31.2479);
  assert.equal(result.lifestyleFundingPercent, 40);
  assert.equal(result.estimatedSustainableIncomeFromCurrentFiAssets, 40000);
  assert.equal(result.passiveIncomeCoveragePercent, 0);
  assert.equal(result.annualPassiveIncome, 0);
  assert.equal(result.projectedFinancialInvestmentGrowthBase, 750000);
  assert.equal(result.projectedFinancialInvestmentGrowth, 52500);
  assert.equal(result.projectedInvestmentGrowthBase, 750000);
  assert.equal(result.projectedInvestmentGrowth, 52500);
  assert.equal(result.projectedPropertyGrowthBase, 600000);
  assert.equal(result.projectedPropertyGrowth, 18000);
  assert.equal(result.combinedWealthCreation, 70500);
  assert.equal(result.totalIncomeProducingAssets, 1500000);
  assert.equal(result.includeInvestmentPropertyEquityInFi, true);
  assert.ok(result.financialFreedomProgressProjection[0].netFiAssets > result.financialIndependenceAssets);

  plan.liabilityItems.push({ id: "share-loan", type: "investmentLoan", balance: 100000 });
  result = CALC.calculatePlan(plan);
  assert.equal(result.otherInvestmentDebt, 100000);
  assert.equal(result.liquidInvestmentAssets, 650000);
  assert.equal(result.accessibleInvestmentAssets, 650000);
  assert.equal(result.financialIndependenceAssets, 900000);
  assert.equal(result.financialFreedomProgressRaw, 28.1231);
  assert.equal(result.projectedFinancialInvestmentGrowthBase, 750000);
  assert.equal(result.projectedFinancialInvestmentGrowth, 52500);
  assert.equal(result.projectedInvestmentGrowthBase, 750000);
  assert.equal(result.projectedInvestmentGrowth, 52500);
  assert.equal(result.projectedPropertyGrowth, 18000);
  assert.equal(result.combinedWealthCreation, 70500);

  plan.personal.person1Age = 61;
  result = CALC.calculatePlan(plan);
  assert.equal(result.fiAssetPolicy.superIncludedInCurrentNetFiAssets, true);
  assert.equal(result.financialIndependenceAssets, 1400000);
  assert.equal(result.financialFreedomProgressRaw, 56);

  plan.personal.targetAnnualSpending = 10000;
  result = CALC.calculatePlan(plan);
  assert.equal(result.financialFreedomProgressRaw, 560);
  assert.equal(result.financialFreedomScore, 100);

  plan.personal.targetAnnualSpending = 0;
  result = CALC.calculatePlan(plan);
  assert.equal(result.targetCapital, 0);
  assert.equal(result.financialFreedomProgressRaw, 0);
  assert.equal(result.financialFreedomProgressProjection[0].progress, 0);

  const futurePlan = CALC.emptyPlan();
  futurePlan.incomeItems = [];
  futurePlan.expenseItems = [];
  futurePlan.assetItems = [];
  futurePlan.liabilityItems = [];
  futurePlan.personal.person1Age = 58;
  futurePlan.personal.fullRetirementAge = 60;
  futurePlan.personal.targetAnnualSpending = 100000;
  futurePlan.investing.safeWithdrawalRatePct = 4;
  futurePlan.assets.superPerson1 = 300000;
  const futureResult = CALC.calculatePlan(futurePlan);
  assert.equal(futureResult.financialIndependenceAssets, 0);
  assert.equal(futureResult.financialFreedomProgressRaw, 0);
  assert.ok(futureResult.financialFreedomProgressProjection.find((row) => row.age >= 60).netFiAssets >= 300000);
  assert.ok(futureResult.targetAgeNetFiAssets >= 300000);
});

test("projected financial investment growth uses gross financial assets before investment debt", () => {
  const { CALC, plan } = basePlan();
  plan.personal.person1Age = 45;
  plan.personal.targetAnnualSpending = 80000;
  plan.investing.safeWithdrawalRatePct = 4;
  plan.investing.expectedInvestmentReturnPct = 8;
  plan.investing.annualInvestingTarget = 12000;
  plan.assets.sharesEtfs = 150000;
  plan.assets.crypto = 50000;
  plan.liabilityItems = [
    {
      id: "share-loan",
      type: "investmentLoan",
      balance: 100000,
      interestRatePct: 7,
      repayment: 1000,
      repaymentFrequency: "monthly",
      termYears: 10,
      investmentAssetCategory: "shares",
    },
  ];

  const result = CALC.calculatePlan(plan);
  const loanBreakdown = CALC.getAnnualLoanBreakdown(plan.liabilityItems[0]);

  assert.equal(result.projectedFinancialInvestmentGrowthBase, 200000);
  assert.equal(result.projectedFinancialInvestmentGrowth, 16000);
  assert.equal(result.projectedInvestmentGrowthBase, 200000);
  assert.equal(result.projectedInvestmentGrowth, 16000);
  assert.equal(result.otherInvestmentDebt, 100000);
  assert.equal(result.grossLiquidInvestmentAssets, 200000);
  assert.equal(result.liquidInvestmentAssets, 100000);
  assert.equal(result.financialIndependenceAssets, 100000);
  assert.equal(result.projectedPropertyGrowth, 0);
  assert.equal(result.combinedWealthCreation, 16000);
  assert.equal(result.investmentProjection[0].openingBalance, 200000);
  assert.ok(result.investmentProjection[0].closingBalance > 212000);
  assert.ok(loanBreakdown.annualInterest > 0);
  assert.ok(loanBreakdown.annualPrincipal > 0);
  assert.ok(loanBreakdown.closingBalance < 100000);
});

test("investment asset double-counting protections still use gross growth once", () => {
  const { CALC, plan } = basePlan();
  plan.investing.expectedInvestmentReturnPct = 8;
  plan.assets.sharesEtfs = 200000;
  plan.assetItems = [
    { id: "shares-a", category: "shares", value: 200000 },
    { id: "shares-a", category: "shares", value: 200000 },
  ];
  plan.liabilityItems = [
    { id: "share-loan", type: "investmentLoan", balance: 100000 },
  ];
  const result = CALC.calculatePlan(plan);

  assert.equal(result.canonicalAssetSource.sharesEtfs, "assetItems");
  assert.equal(result.projectedFinancialInvestmentGrowthBase, 200000);
  assert.equal(result.projectedFinancialInvestmentGrowth, 16000);
  assert.equal(result.financialIndependenceAssets, 100000);
});

test("property growth is calculated from gross investment property value and kept out of current cash income", () => {
  const { CALC, plan } = basePlan();
  plan.personal.person1Age = 45;
  plan.personal.targetAnnualSpending = 80000;
  plan.investing.safeWithdrawalRatePct = 4;
  plan.investing.expectedInvestmentReturnPct = 7;
  plan.assets.homeValue = 900000;
  plan.assets.otherPropertyValue = 500000;
  plan.liabilityItems = [
    { id: "rental-loan", type: "rentalPropertyLoan", balance: 300000 },
  ];
  const result = CALC.calculatePlan(plan);

  assert.equal(result.projectedPropertyGrowthBase, 500000);
  assert.equal(result.projectedPropertyGrowth, 15000);
  assert.equal(result.investmentPropertyEquity, 200000);
  assert.equal(result.financialIndependenceAssets, 200000);
  assert.equal(result.accessibleInvestmentAssets, 0);
  assert.equal(result.annualPassiveIncome, 0);
  assert.equal(result.cashSurplusBeforeInvesting, result.finalProjectedCashSurplus);
  assert.equal(result.combinedWealthCreation, 15000);
  assert.ok(result.financialFreedomProgressProjection[0].netFiAssets > result.financialIndependenceAssets);
});

test("investment property growth excludes the principal residence and totals multiple investment properties separately", () => {
  const { CALC, plan } = basePlan();
  plan.assets.homeValue = 1200000;
  plan.assets.otherPropertyValue = 0;
  plan.assetItems = [
    { id: "home", category: "home", value: 1200000 },
    { id: "rental-a", category: "otherProperty", value: 500000 },
    { id: "rental-b", category: "investmentProperty", value: 300000, propertyGrowthRatePct: 4 },
    { id: "holiday", category: "otherProperty", value: 200000, isPersonalUse: true },
  ];
  const result = CALC.calculatePlan(plan);

  assert.equal(result.projectedPropertyGrowthBase, 800000);
  assert.equal(result.projectedPropertyGrowth, 27000);
  assert.equal(result.projectedPropertyGrowthProperties.length, 2);
  assert.equal(result.projectedFinancialInvestmentGrowth, 0);
  assert.equal(result.combinedWealthCreation, 27000);
  assert.equal(result.accessibleInvestmentAssets, 0);
});

test("dividend franking credits do not increase passive cash income, gross income or surplus", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "dividend", type: "dividends", owner: "person1", amount: 7000, cashDividend: 7000, frankingCredits: 3000, frequency: "annually" },
  ];
  const withFranking = CALC.calculatePlan(plan);
  plan.incomeItems = [
    { id: "dividend", type: "dividends", owner: "person1", amount: 7000, frequency: "annually" },
  ];
  const simplified = CALC.calculatePlan(plan);

  assert.equal(withFranking.passiveIncomeBreakdown.dividends, 7000);
  assert.equal(withFranking.annualPassiveIncome, 7000);
  assert.equal(withFranking.annualGrossIncome, 7000);
  assert.equal(withFranking.cashSurplusBeforeInvesting, simplified.cashSurplusBeforeInvesting);
  assert.equal(withFranking.finalProjectedCashSurplus, simplified.finalProjectedCashSurplus);
  assert.equal(simplified.passiveIncomeBreakdown.dividends, 7000);
  assert.equal(simplified.annualGrossIncome, 7000);
  assert.equal(simplified.person1AnnualIncome, 7000);
});

test("legacy grossed-up-only dividend records use a conservative cash fallback", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "dividend", type: "dividends", owner: "person1", amount: 0, totalTaxableGrossedUpDividend: 10000, frequency: "annually" },
  ];
  const result = CALC.calculatePlan(plan);

  assert.equal(result.passiveIncomeBreakdown.dividends, 7000);
  assert.equal(result.annualGrossIncome, 7000);
  assert.equal(result.person1AnnualIncome, 7000);
});

test("Net FI assets count shares and crypto once across legacy fields and canonical asset records", () => {
  function resultFor({ legacyShares = 0, legacyCrypto = 0, assetItems = [] } = {}) {
    const { CALC, plan } = basePlan();
    plan.personal.person1Age = 45;
    plan.personal.targetAnnualSpending = 100000;
    plan.investing.safeWithdrawalRatePct = 4;
    plan.assets.cash = 30000;
    plan.assets.sharesEtfs = legacyShares;
    plan.assets.crypto = legacyCrypto;
    plan.assetItems = assetItems;
    return { CALC, plan, result: CALC.calculatePlan(plan) };
  }

  assert.equal(resultFor({ legacyShares: 100000 }).result.financialIndependenceAssets, 130000);
  assert.equal(resultFor({ assetItems: [{ id: "shares-a", category: "shares", value: 100000 }] }).result.financialIndependenceAssets, 130000);
  let duplicateShares = resultFor({
    legacyShares: 100000,
    assetItems: [{ id: "asset-shares", category: "shares", value: 100000 }],
  }).result;
  assert.equal(duplicateShares.financialIndependenceAssets, 130000);
  assert.equal(duplicateShares.canonicalAssetSource.sharesEtfs, "assetItems");

  assert.equal(resultFor({ legacyCrypto: 20000 }).result.financialIndependenceAssets, 50000);
  assert.equal(resultFor({ assetItems: [{ id: "crypto-a", category: "crypto", value: 20000 }] }).result.financialIndependenceAssets, 50000);
  let duplicateCrypto = resultFor({
    legacyCrypto: 20000,
    assetItems: [{ id: "asset-crypto", category: "crypto", value: 20000 }],
  }).result;
  assert.equal(duplicateCrypto.financialIndependenceAssets, 50000);
  assert.equal(duplicateCrypto.canonicalAssetSource.crypto, "assetItems");

  const bothLegacyAndRecords = resultFor({
    legacyShares: 100000,
    legacyCrypto: 20000,
    assetItems: [
      { id: "asset-shares", category: "shares", value: 100000 },
      { id: "asset-crypto", category: "crypto", value: 20000 },
    ],
  }).result;
  assert.equal(bothLegacyAndRecords.grossLiquidInvestmentAssets, 150000);
  assert.equal(bothLegacyAndRecords.financialIndependenceAssets, 150000);
  assert.equal(bothLegacyAndRecords.financialFreedomProgressRaw, 4.1428);

  const duplicateAssetRecord = resultFor({
    legacyShares: 100000,
    assetItems: [
      { id: "shares-same", category: "shares", value: 100000 },
      { id: "shares-same", category: "shares", value: 100000 },
    ],
  }).result;
  assert.equal(duplicateAssetRecord.financialIndependenceAssets, 130000);

  const separatePortfolios = resultFor({
    legacyShares: 100000,
    assetItems: [
      { id: "shares-vanguard", category: "shares", value: 60000 },
      { id: "shares-broker-2", category: "shares", value: 40000 },
    ],
  }).result;
  assert.equal(separatePortfolios.financialIndependenceAssets, 130000);

  const { CALC, plan } = resultFor({
    legacyShares: 100000,
    legacyCrypto: 20000,
    assetItems: [
      { id: "asset-shares", category: "shares", value: 100000 },
      { id: "asset-crypto", category: "crypto", value: 20000 },
    ],
  });
  assert.equal(CALC.calculateNetFIAssets({ plan, currentAge: 45 }), 150000);
});

test("saved records and snapshots retain calculation version metadata", () => {
  const appSource = readFileSync(APP_PATH, "utf8");
  assert.match(appSource, /const CALCULATION_VERSION = CALC\?\.CALCULATION_VERSION \|\| "2026\.27\.1"/);
  assert.match(appSource, /const FINANCIAL_YEAR = CALC\?\.FINANCIAL_YEAR \|\| "2026-27"/);
  assert.match(appSource, /calculationVersion: CALCULATION_VERSION/);
  assert.match(appSource, /snapshotSchemaVersion: FINANCIAL_SNAPSHOT_CALCULATION_VERSION/);
  assert.match(appSource, /financialYear: FINANCIAL_YEAR/);
});
