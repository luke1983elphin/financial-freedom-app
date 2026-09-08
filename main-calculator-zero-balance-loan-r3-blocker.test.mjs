import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const CALCULATOR_PATH = new URL("../calculator.js", import.meta.url);
const WEEKLY_PLAN_PATH = new URL("../weekly-plan.js", import.meta.url);
const APP_PATH = new URL("../app.js", import.meta.url);

function loadCalculator() {
  const source = readFileSync(CALCULATOR_PATH, "utf8");
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.FFSCalculator;
}

function loadRuntime() {
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(CALCULATOR_PATH, "utf8"), context);
  vm.runInNewContext(readFileSync(WEEKLY_PLAN_PATH, "utf8"), context);
  return {
    CALC: context.FFSCalculator,
    WEEKLY: context.FFSWeeklyPlan,
  };
}

function loadWeeklyOnly() {
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(WEEKLY_PLAN_PATH, "utf8"), context);
  return context.FFSWeeklyPlan;
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    clear() {
      values.clear();
    },
  };
}

function createDocumentStub() {
  const classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const element = {
    classList,
    dataset: {},
    style: {},
    value: "",
    textContent: "",
    innerHTML: "",
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
    removeAttribute() {},
    scrollIntoView() {},
    focus() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return {
    body: { classList },
    documentElement: { classList },
    addEventListener() {},
    getElementById() { return element; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
      return { ...element, dataset: {}, style: {}, classList };
    },
  };
}

function loadAppUiHooks() {
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    localStorage: createMemoryStorage(),
    document: createDocumentStub(),
    navigator: { userAgent: "node-test" },
    location: { pathname: "/", search: "", hash: "" },
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    Blob: class Blob {},
    FileReader: class FileReader {},
    setTimeout() { return 0; },
    clearTimeout() {},
    requestAnimationFrame(callback) { return typeof callback === "function" ? callback() : 0; },
    confirm() { return true; },
    prompt() { return ""; },
    alert() {},
    innerWidth: 1200,
    FFS_DATA: { samplePlans: [], disclaimer: "" },
    FFS_TEST_HOOKS_ENABLED: true,
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(readFileSync(CALCULATOR_PATH, "utf8"), context);
  vm.runInNewContext(readFileSync(WEEKLY_PLAN_PATH, "utf8"), context);
  vm.runInNewContext(readFileSync(APP_PATH, "utf8"), context);
  return {
    context,
    hooks: context.FFSWeeklyPlanUiTestHooks,
    CALC: context.FFSCalculator,
    WEEKLY: context.FFSWeeklyPlan,
  };
}

function basePlan(CALC) {
  const plan = CALC.emptyPlan();
  plan.incomeItems = [
    { id: "salary", type: "salaryWages", owner: "person1", amount: 150000, frequency: "annually" },
  ];
  plan.expenseItems = [];
  plan.assetItems = [];
  plan.liabilityItems = [];
  plan.investing.annualInvestingTarget = 0;
  plan.investing.extraSuperContributions = 0;
  plan.liabilities.homeLoanBalance = 0;
  plan.liabilities.monthlyRepayment = 0;
  plan.liabilities.creditCardBalance = 0;
  plan.liabilities.creditCardMonthlyRepayment = 0;
  plan.liabilities.otherDebts = 0;
  plan.expenses.mortgageRepayments = 0;
  return plan;
}

function weeklyLoanPlan(CALC, loan = {}) {
  const plan = basePlan(CALC);
  plan.liabilityItems = [{
    id: "personal-loan",
    name: "Personal loan",
    type: "personalLoan",
    balance: 100000,
    repayment: 1000,
    repaymentFrequency: "weekly",
    ...loan,
  }];
  return plan;
}

function weeklyAmountForWeek(weeklyPlan, weekNumber, itemId = "timing-liability-personal-loan") {
  const week = weeklyPlan.weeks.find((candidate) => candidate.weekNumber === Number(weekNumber));
  return (week?.detail?.billItems || []).find((item) => item.id === itemId)?.amount || 0;
}

function weeklyLoanTiming(weeklyPlan, sourceId = "personal-loan") {
  return weeklyPlan.settings.timingItems.find((item) => item.sourceId === sourceId);
}

function createPositiveWeeklyLoanPlan(todayIso = "2026-07-13") {
  const { CALC, WEEKLY } = loadRuntime();
  const plan = weeklyLoanPlan(CALC);
  const result = CALC.calculatePlan(plan);
  const weeklyPlan = WEEKLY.createFromPlan(plan, result, {
    startDate: "2026-07-13",
    todayIso,
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  return { CALC, WEEKLY, plan, result, weeklyPlan };
}

function reforecastPaidOffLoan(CALC, WEEKLY, sourcePlan, existingWeeklyPlan, todayIso = "2026-07-20") {
  const paidOffPlan = JSON.parse(JSON.stringify(sourcePlan));
  paidOffPlan.liabilityItems = paidOffPlan.liabilityItems.map((loan) => loan.id === "personal-loan" ? { ...loan, balance: 0 } : loan);
  return WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...existingWeeklyPlan,
    settings: { ...existingWeeklyPlan.settings, todayIso },
  });
}

test("R3 blocker: main calculator should ignore stale mortgage repayments when home loan balance is zero", () => {
  const CALC = loadCalculator();
  const clearedPlan = basePlan(CALC);
  const stalePlan = basePlan(CALC);
  stalePlan.liabilities.monthlyRepayment = 1000;
  stalePlan.expenses.mortgageRepayments = 0;

  const cleared = CALC.calculatePlan(clearedPlan);
  const stale = CALC.calculatePlan(stalePlan);

  assert.equal(stale.annualMortgageRepayments, 0);
  assert.equal(stale.annualDebtRepayments, cleared.annualDebtRepayments);
  assert.equal(stale.finalProjectedCashSurplus, cleared.finalProjectedCashSurplus);
});

test("R3 blocker: annual loan breakdown should return zero repayments for a zero-balance loan", () => {
  const CALC = loadCalculator();
  const breakdown = CALC.getAnnualLoanBreakdown({
    id: "paid-off-loan",
    type: "investmentLoan",
    balance: 0,
    interestRatePct: 6,
    repayment: 1000,
    repaymentFrequency: "monthly",
  });

  assert.equal(breakdown.annualRepayments, 0);
  assert.equal(breakdown.regularAnnualRepayments, 0);
  assert.equal(breakdown.annualInterest, 0);
  assert.equal(breakdown.annualPrincipal, 0);
  assert.equal(breakdown.closingBalance, 0);
});

test("R3 blocker: before-interest rental cashflow should not deduct stale repayments for a paid-off linked loan", () => {
  const CALC = loadCalculator();
  const clearedPlan = basePlan(CALC);
  const stalePlan = basePlan(CALC);
  const rentalIncome = {
    id: "rental-income",
    type: "rentalNetCashIncome",
    owner: "joint",
    amount: 30000,
    rentalCashIncomeAnnual: 30000,
    frequency: "annually",
    rentalCashflowTreatment: "beforeInterest",
    linkedLoanIds: ["paid-off-rental-loan"],
  };
  clearedPlan.incomeItems.push({ ...rentalIncome });
  stalePlan.incomeItems.push({ ...rentalIncome });
  clearedPlan.liabilityItems = [
    {
      id: "paid-off-rental-loan",
      type: "rentalPropertyLoan",
      balance: 0,
      interestRatePct: 6,
      repayment: 0,
      repaymentFrequency: "monthly",
      investmentAssetCategory: "rentalProperty",
    },
  ];
  stalePlan.liabilityItems = [
    {
      id: "paid-off-rental-loan",
      type: "rentalPropertyLoan",
      balance: 0,
      interestRatePct: 6,
      repayment: 1000,
      repaymentFrequency: "monthly",
      investmentAssetCategory: "rentalProperty",
    },
  ];

  const cleared = CALC.calculatePlan(clearedPlan);
  const result = CALC.calculatePlan(stalePlan);
  const property = result.rentalPropertyCashflow.propertyResults.find((item) => item.id === "rental-income");

  assert.ok(property, "Expected the rental property result to be present.");
  assert.equal(property.linkedLoanCount, 1);
  assert.deepEqual(Array.from(property.linkedLoanIds), ["paid-off-rental-loan"]);

  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 0);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdCashflowContribution, 30000);
  assert.equal(result.annualDebtRepayments, cleared.annualDebtRepayments);
  assert.equal(result.finalProjectedCashSurplus, cleared.finalProjectedCashSurplus);
});

test("R3 blocker control: positive-balance linked rental debt is recognised and repayments remain counted", () => {
  const CALC = loadCalculator();
  const plan = basePlan(CALC);
  plan.incomeItems.push({
    id: "rental-income",
    type: "rentalNetCashIncome",
    owner: "joint",
    amount: 30000,
    rentalCashIncomeAnnual: 30000,
    frequency: "annually",
    rentalCashflowTreatment: "beforeInterest",
    linkedLoanIds: ["positive-rental-loan"],
  });
  plan.liabilityItems = [
    {
      id: "positive-rental-loan",
      type: "rentalPropertyLoan",
      balance: 100000,
      interestRatePct: 6,
      repayment: 1000,
      repaymentFrequency: "monthly",
      investmentAssetCategory: "rentalProperty",
    },
  ];

  const result = CALC.calculatePlan(plan);
  const property = result.rentalPropertyCashflow.propertyResults.find((item) => item.id === "rental-income");

  assert.ok(property, "Expected the positive-balance rental property result to be present.");
  assert.equal(property.linkedLoanCount, 1);
  assert.deepEqual(Array.from(property.linkedLoanIds), ["positive-rental-loan"]);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 12000);
  assert.equal(result.annualDebtRepayments, 12000);
});

test("R3B: numeric zero and supported string zero are explicit paid-off balances", () => {
  const CALC = loadCalculator();
  const numericZero = basePlan(CALC);
  const stringZero = basePlan(CALC);
  numericZero.liabilities.homeLoanBalance = 0;
  numericZero.liabilities.monthlyRepayment = 1000;
  stringZero.liabilities.homeLoanBalance = "0.00";
  stringZero.liabilities.monthlyRepayment = 1000;

  assert.equal(CALC.calculatePlan(numericZero).annualMortgageRepayments, 0);
  assert.equal(CALC.calculatePlan(stringZero).annualMortgageRepayments, 0);
  assert.equal(CALC.isLoanPaidOffForForwardCashflow({ balance: 0 }), true);
  assert.equal(CALC.isLoanPaidOffForForwardCashflow({ balance: "0.00" }), true);
});

test("R3B: zero-balance regular and additional principal are both removed from forward servicing", () => {
  const CALC = loadCalculator();
  const breakdown = CALC.getAnnualLoanBreakdown({
    id: "paid-off-regular-and-extra",
    type: "investmentLoan",
    balance: 0,
    interestRatePct: 6,
    repayment: 1000,
    repaymentFrequency: "monthly",
    additionalPrincipalRepayment: 500,
    additionalPrincipalFrequency: "monthly",
  });

  assert.equal(breakdown.annualRepayments, 0);
  assert.equal(breakdown.regularAnnualRepayments, 0);
  assert.equal(breakdown.annualInterest, 0);
  assert.equal(breakdown.annualPrincipal, 0);
  assert.equal(breakdown.additionalPrincipal, 0);
  assert.equal(breakdown.closingBalance, 0);
});

test("R3B: zero-balance interest-only loans do not keep stale extra principal", () => {
  const CALC = loadCalculator();
  const breakdown = CALC.getAnnualLoanBreakdown({
    id: "paid-off-interest-only",
    type: "rentalPropertyLoan",
    balance: "0",
    interestRatePct: 6,
    repaymentType: "interestOnly",
    repayment: 1000,
    repaymentFrequency: "monthly",
    additionalPrincipalRepayment: 500,
    additionalPrincipalFrequency: "monthly",
  });

  assert.equal(breakdown.repaymentType, "interestOnly");
  assert.equal(breakdown.annualRepayments, 0);
  assert.equal(breakdown.annualInterest, 0);
  assert.equal(breakdown.annualPrincipal, 0);
  assert.equal(breakdown.additionalPrincipal, 0);
});

test("R3B: after-interest rental cashflow ignores stale additional principal on paid-off linked loans", () => {
  const CALC = loadCalculator();
  const clearedPlan = basePlan(CALC);
  const stalePlan = basePlan(CALC);
  const rentalIncome = {
    id: "rental-income",
    type: "rentalNetCashIncome",
    owner: "joint",
    amount: 30000,
    rentalCashIncomeAnnual: 30000,
    frequency: "annually",
    rentalCashflowTreatment: "afterInterest",
    linkedLoanIds: ["paid-off-rental-loan"],
  };
  clearedPlan.incomeItems.push({ ...rentalIncome });
  stalePlan.incomeItems.push({ ...rentalIncome });
  clearedPlan.liabilityItems = [{
    id: "paid-off-rental-loan",
    type: "rentalPropertyLoan",
    balance: 0,
    repayment: 0,
    repaymentFrequency: "monthly",
  }];
  stalePlan.liabilityItems = [{
    id: "paid-off-rental-loan",
    type: "rentalPropertyLoan",
    balance: 0,
    interestRatePct: 6,
    repayment: 0,
    repaymentFrequency: "monthly",
    additionalPrincipalRepayment: 500,
    additionalPrincipalFrequency: "monthly",
  }];

  const cleared = CALC.calculatePlan(clearedPlan);
  const result = CALC.calculatePlan(stalePlan);
  const property = result.rentalPropertyCashflow.propertyResults.find((item) => item.id === "rental-income");

  assert.ok(property, "Expected the after-interest rental property result to be present.");
  assert.equal(property.linkedLoanCount, 1);
  assert.deepEqual(Array.from(property.linkedLoanIds), ["paid-off-rental-loan"]);
  assert.equal(property.annualLoanPrincipal, 0);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 0);
  assert.equal(result.finalProjectedCashSurplus, cleared.finalProjectedCashSurplus);
});

test("R3B: mixed active and paid-off linked rental loans count only active debt once", () => {
  const CALC = loadCalculator();
  const plan = basePlan(CALC);
  plan.incomeItems.push({
    id: "rental-income",
    type: "rentalNetCashIncome",
    owner: "joint",
    amount: 30000,
    rentalCashIncomeAnnual: 30000,
    frequency: "annually",
    rentalCashflowTreatment: "beforeInterest",
    linkedLoanIds: ["paid-off-rental-loan", "active-rental-loan"],
  });
  plan.liabilityItems = [
    {
      id: "paid-off-rental-loan",
      type: "rentalPropertyLoan",
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "monthly",
    },
    {
      id: "active-rental-loan",
      type: "rentalPropertyLoan",
      balance: 100000,
      interestRatePct: 6,
      repayment: 1000,
      repaymentFrequency: "monthly",
    },
  ];

  const result = CALC.calculatePlan(plan);
  const property = result.rentalPropertyCashflow.propertyResults.find((item) => item.id === "rental-income");

  assert.ok(property, "Expected the mixed rental property result to be present.");
  assert.equal(property.linkedLoanCount, 2);
  assert.deepEqual(Array.from(property.linkedLoanIds), ["paid-off-rental-loan", "active-rental-loan"]);
  assert.equal(result.rentalPropertyCashflow.annualHouseholdDebtDeduction, 12000);
  assert.equal(result.annualDebtRepayments, 12000);
});

test("R3B: fully offset positive-principal home loans keep required repayments", () => {
  const CALC = loadCalculator();
  const plan = basePlan(CALC);
  plan.liabilities.homeLoanBalance = 100000;
  plan.liabilities.homeLoanInterestRatePct = 6;
  plan.liabilities.monthlyRepayment = 1000;
  plan.liabilities.remainingLoanTermYears = 30;
  plan.assets.offsetBalance = 100000;

  const result = CALC.calculatePlan(plan);
  const firstYearRepayments = result.loan.schedule.slice(0, 12).reduce((total, row) => total + row.repayment, 0);
  const firstYearInterest = result.loan.schedule.slice(0, 12).reduce((total, row) => total + row.interestCharged, 0);

  assert.equal(result.annualMortgageRepayments, 12000);
  assert.equal(firstYearRepayments, 12000);
  assert.equal(firstYearInterest, 0);
});

test("R3D: small positive principal uses capped first-year schedule cash", () => {
  const CALC = loadCalculator();
  const plan = basePlan(CALC);
  plan.liabilities.homeLoanBalance = 5000;
  plan.liabilities.homeLoanInterestRatePct = 0;
  plan.liabilities.monthlyRepayment = 1000;
  plan.liabilities.remainingLoanTermYears = 30;

  const result = CALC.calculatePlan(plan);

  assert.equal(result.annualMortgageRepayments, 5000);
  assert.equal(result.loan.totalRepayments, 5000);
  assert.equal(result.loan.payoffMonth, 5);
});

test("R3D: positive home loans stop annual cash deductions at their actual payoff", () => {
  const CALC = loadCalculator();
  const cases = [
    { balance: 5000, rate: 0, repayment: 1000, expected: 5000, payoffMonth: 5 },
    { balance: 5000, rate: 12, repayment: 1000, expected: 5155.59, payoffMonth: 6 },
    { balance: 5000, rate: 0, repayment: 6000, expected: 5000, payoffMonth: 1 },
    { balance: 11000, rate: 0, repayment: 1000, expected: 11000, payoffMonth: 11 },
  ];
  cases.forEach(({ balance, rate, repayment, expected, payoffMonth }) => {
    const plan = basePlan(CALC);
    plan.liabilities.homeLoanBalance = balance;
    plan.liabilities.homeLoanInterestRatePct = rate;
    plan.liabilities.monthlyRepayment = repayment;
    plan.liabilities.remainingLoanTermYears = 30;
    const result = CALC.calculatePlan(plan);
    assert.equal(result.annualMortgageRepayments, expected);
    assert.equal(result.loan.payoffMonth, payoffMonth);
  });
});

test("R3D: annual loan breakdown applies regular schedule before capped additional principal", () => {
  const CALC = loadCalculator();
  const regularAndAdditional = CALC.getAnnualLoanBreakdown({
    id: "mixed", balance: 5000, interestRatePct: 0, repayment: 250,
    repaymentFrequency: "monthly", additionalPrincipalRepayment: 4000,
    additionalPrincipalFrequency: "annually",
  });
  assert.equal(regularAndAdditional.regularAnnualRepayments, 3000);
  assert.equal(regularAndAdditional.additionalPrincipal, 2000);
  assert.equal(regularAndAdditional.annualRepayments, 5000);
  assert.equal(regularAndAdditional.annualPrincipal, 5000);
  assert.equal(regularAndAdditional.closingBalance, 0);

  const additionalOnly = CALC.getAnnualLoanBreakdown({
    id: "additional-only", balance: 5000, interestRatePct: 0, repayment: 0,
    repaymentFrequency: "monthly", additionalPrincipalRepayment: 6000,
    additionalPrincipalFrequency: "annually",
  });
  assert.equal(additionalOnly.annualRepayments, 5000);
  assert.equal(additionalOnly.annualPrincipal, 5000);
  assert.equal(additionalOnly.closingBalance, 0);

  const interestOnly = CALC.getAnnualLoanBreakdown({
    id: "interest-only", balance: 5000, interestRatePct: 12,
    repaymentType: "interestOnly", repayment: 50, repaymentFrequency: "monthly",
    additionalPrincipalRepayment: 6000, additionalPrincipalFrequency: "annually",
  });
  assert.equal(interestOnly.regularAnnualRepayments, 600);
  assert.equal(interestOnly.annualInterest, 600);
  assert.equal(interestOnly.additionalPrincipal, 5000);
  assert.equal(interestOnly.annualRepayments, 5600);
  assert.equal(interestOnly.annualPrincipal, 5000);
  assert.equal(interestOnly.closingBalance, 0);
});

test("R3D: linked rental cashflow uses capped cash or principal according to treatment", () => {
  const CALC = loadCalculator();
  const loan = { id: "rental", type: "rentalPropertyLoan", balance: 5000, interestRatePct: 0, repayment: 1000, repaymentFrequency: "monthly" };
  const before = CALC.calculateRentalPropertyCashflow({ id: "before", rentalCashIncomeAnnual: 30000, rentalCashflowTreatment: "beforeInterest" }, [loan]);
  const after = CALC.calculateRentalPropertyCashflow({ id: "after", rentalCashIncomeAnnual: 30000, rentalCashflowTreatment: "afterInterest" }, [loan]);
  assert.equal(before.annualLoanRepayments, 5000);
  assert.equal(before.householdDebtDeduction, 5000);
  assert.equal(after.annualLoanPrincipal, 5000);
  assert.equal(after.householdDebtDeduction, 5000);
});

test("R3B: missing, blank, invalid, boolean and negative balances are not confirmed paid off", () => {
  const CALC = loadCalculator();
  const values = [undefined, null, "", "   ", "not-a-number", false, true, -100];

  values.forEach((balance) => {
    assert.equal(CALC.isLoanPaidOffForForwardCashflow({ balance }), false, `Balance ${String(balance)} must not be classified as paid off.`);
    const breakdown = CALC.getAnnualLoanBreakdown({
      id: `unknown-${String(balance)}`,
      type: "investmentLoan",
      balance,
      repayment: 1000,
      repaymentFrequency: "monthly",
    });
    assert.equal(breakdown.annualRepayments, 12000, `Unknown balance ${String(balance)} should preserve existing fallback treatment.`);
  });
});

test("R3B: raw missing home-loan balance preserves fallback while explicit zero suppresses it", () => {
  const CALC = loadCalculator();
  const missingBalancePlan = basePlan(CALC);
  delete missingBalancePlan.liabilities.homeLoanBalance;
  missingBalancePlan.liabilities.monthlyRepayment = 1000;
  missingBalancePlan.expenses.mortgageRepayments = 1000;
  const explicitZeroPlan = basePlan(CALC);
  explicitZeroPlan.liabilities.homeLoanBalance = 0;
  explicitZeroPlan.liabilities.monthlyRepayment = 1000;
  explicitZeroPlan.expenses.mortgageRepayments = 1000;

  assert.equal(CALC.calculatePlan(missingBalancePlan).annualMortgageRepayments, 12000);
  assert.equal(CALC.calculatePlan(explicitZeroPlan).annualMortgageRepayments, 0);
});

test("R3B: calculations do not mutate source repayment inputs", () => {
  const CALC = loadCalculator();
  const plan = basePlan(CALC);
  plan.liabilities.homeLoanBalance = 0;
  plan.liabilities.monthlyRepayment = 1000;
  plan.liabilityItems = [{
    id: "paid-off-rental-loan",
    type: "rentalPropertyLoan",
    balance: 0,
    repayment: 1000,
    repaymentFrequency: "monthly",
  }];
  const before = JSON.stringify(plan);

  CALC.calculatePlan(plan);
  CALC.getAnnualLoanBreakdown(plan.liabilityItems[0]);

  assert.equal(JSON.stringify(plan), before);
  assert.equal(plan.liabilities.monthlyRepayment, 1000);
  assert.equal(plan.liabilityItems[0].repayment, 1000);
});

test("R3B: fresh Weekly Plan skips auto-generated future servicing for explicit paid-off loans", () => {
  const { CALC, WEEKLY } = loadRuntime();
  const plan = basePlan(CALC);
  plan.liabilityItems = [{
    id: "paid-off-personal-loan",
    name: "Paid-off personal loan",
    type: "personalLoan",
    balance: 0,
    repayment: 1000,
    repaymentFrequency: "monthly",
  }];
  const result = CALC.calculatePlan(plan);
  const weeklyPlan = WEEKLY.createFromPlan(plan, result, {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });

  assert.equal(weeklyPlan.settings.timingItems.some((item) => item.sourceId === "paid-off-personal-loan"), false);
  assert.equal(weeklyPlan.weeks.some((week) => week.detail.billItems.some((item) => item.id === "timing-liability-paid-off-personal-loan")), false);
});

test("R3B: existing saved Weekly Plan ends future auto-derived paid-off loan timing and preserves completed history", () => {
  const { CALC, WEEKLY } = loadRuntime();
  const activePlan = basePlan(CALC);
  activePlan.liabilityItems = [{
    id: "personal-loan",
    name: "Personal loan",
    type: "personalLoan",
    balance: 100000,
    repayment: 1000,
    repaymentFrequency: "monthly",
  }];
  const activeResult = CALC.calculatePlan(activePlan);
  const created = WEEKLY.createFromPlan(activePlan, activeResult, {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const originalTiming = created.settings.timingItems.find((item) => item.sourceId === "personal-loan");
  assert.ok(originalTiming, "Expected the positive-balance loan timing item to exist before payoff.");
  assert.equal(originalTiming.amount, 1000);

  const completed = WEEKLY.completeWeek(activePlan, activeResult, created, 1, {
    openingBalance: 5000,
    income: 0,
    essentialCosts: 1000,
    amountSetAside: 0,
    discretionarySpending: 0,
    investment: 0,
    extraSuper: 0,
    extraDebtRepayment: 0,
    offsetTransfer: 0,
    otherTransfers: 0,
    enteredBankBalance: 4000,
    notes: "Historical payment retained.",
  });
  const paidOffPlan = JSON.parse(JSON.stringify(activePlan));
  paidOffPlan.liabilityItems[0].balance = 0;
  const paidOffResult = CALC.calculatePlan(paidOffPlan);
  const reforecasted = WEEKLY.reforecast(paidOffPlan, paidOffResult, {
    ...completed,
    settings: { ...completed.settings, todayIso: "2026-07-20" },
  });
  const updatedTiming = reforecasted.settings.timingItems.find((item) => item.sourceId === "personal-loan");
  const week1 = reforecasted.weeks.find((week) => week.weekNumber === 1);
  const week2 = reforecasted.weeks.find((week) => week.weekNumber === 2);

  assert.ok(updatedTiming, "Expected saved source timing item to remain for auditability.");
  assert.equal(updatedTiming.endDate, "2026-07-19");
  assert.equal(updatedTiming.reviewRequired, true);
  assert.equal(reforecasted.settings.timingSetupNeedsReview, true);
  assert.equal(week1.isCompleted, true);
  assert.equal(week1.actual.notes, "Historical payment retained.");
  assert.equal(week1.actual.closingBalance, 4000);
  assert.equal(week2.detail.billItems.some((item) => item.id === "timing-liability-personal-loan"), false);
});

test("R3B: customised saved timing linked to paid-off source is preserved and marked for review", () => {
  const { CALC, WEEKLY } = loadRuntime();
  const plan = basePlan(CALC);
  plan.liabilityItems = [{
    id: "paid-off-personal-loan",
    name: "Paid-off personal loan",
    type: "personalLoan",
    balance: 0,
    repayment: 1000,
    repaymentFrequency: "monthly",
  }];
  const result = CALC.calculatePlan(plan);
  const existing = WEEKLY.createFromPlan(plan, result, {
    startDate: "2026-07-13",
    todayIso: "2026-07-20",
    durationWeeks: 12,
    openingBankBalance: 5000,
    timingItems: [{
      id: "custom-loan-payment",
      sourceId: "paid-off-personal-loan",
      description: "Custom loan timing",
      amount: 1000,
      frequency: "monthly",
      firstDate: "2026-07-13",
      type: "bill",
      active: true,
    }],
    oneOffItems: [{
      id: "manual-car-repair",
      description: "Manual car repair",
      amount: 300,
      frequency: "oneOff",
      firstDate: "2026-07-20",
      type: "bill",
      active: true,
    }],
  });
  const custom = existing.settings.timingItems.find((item) => item.id === "custom-loan-payment");
  const oneOff = existing.settings.oneOffItems.find((item) => item.id === "manual-car-repair");

  assert.ok(custom, "Expected custom linked timing item to be retained.");
  assert.equal(custom.amount, 1000);
  assert.equal(custom.reviewRequired, true);
  assert.match(custom.reviewReason, /zero balance/);
  assert.equal(existing.settings.timingSetupNeedsReview, true);
  assert.ok(oneOff, "Expected unrelated manual one-off item to be preserved.");
  assert.equal(oneOff.amount, 300);
});

test("R3B: positive-balance Weekly Plan controls keep timing amount and dates", () => {
  const { CALC, WEEKLY } = loadRuntime();
  const plan = basePlan(CALC);
  plan.liabilityItems = [{
    id: "active-personal-loan",
    name: "Active personal loan",
    type: "personalLoan",
    balance: 100000,
    repayment: 1000,
    repaymentFrequency: "monthly",
  }];
  const result = CALC.calculatePlan(plan);
  const weeklyPlan = WEEKLY.createFromPlan(plan, result, {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
    billDates: { "active-personal-loan": "2026-07-27" },
  });
  const timing = weeklyPlan.settings.timingItems.find((item) => item.sourceId === "active-personal-loan");

  assert.ok(timing, "Expected active loan timing item to remain.");
  assert.equal(timing.amount, 1000);
  assert.equal(timing.firstDate, "2026-07-27");
  assert.equal(timing.frequency, "monthly");
  assert.equal(timing.reviewRequired, false);
});

test("R3B follow-up: paid-off timing cessation boundary is stable across later reforecasts", () => {
  const { CALC, WEEKLY, plan, weeklyPlan } = createPositiveWeeklyLoanPlan();

  const first = reforecastPaidOffLoan(CALC, WEEKLY, plan, weeklyPlan, "2026-07-20");
  const second = reforecastPaidOffLoan(CALC, WEEKLY, plan, first, "2026-07-27");

  assert.equal(weeklyLoanTiming(first).endDate, "2026-07-19");
  assert.equal(weeklyLoanTiming(second).endDate, "2026-07-19");
  assert.equal(weeklyAmountForWeek(second, 2), 0);
});

test("R3B follow-up: an earlier manually established timing end date is not extended", () => {
  const { CALC, WEEKLY, plan, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const existing = {
    ...weeklyPlan,
    settings: {
      ...weeklyPlan.settings,
      timingItems: weeklyPlan.settings.timingItems.map((item) => item.sourceId === "personal-loan" ? { ...item, endDate: "2026-07-19" } : item),
    },
  };

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, existing, "2026-08-10");

  assert.equal(weeklyLoanTiming(reforecasted).endDate, "2026-07-19");
  assert.equal(weeklyAmountForWeek(reforecasted, 2), 0);
});

test("R3B follow-up: a split original timing segment is not extended into its replacement period", () => {
  const { CALC, WEEKLY, plan, result, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const split = WEEKLY.applyOccurrenceEdit(plan, result, weeklyPlan, "timing-liability-personal-loan", "2026-07-27", { amount: 1300 }, "future");

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, split, "2026-08-10");
  const original = reforecasted.settings.timingItems.find((item) => item.id === "timing-liability-personal-loan");
  const replacement = reforecasted.settings.timingItems.find((item) => item.replacementSeriesId);

  assert.equal(original.endDate, "2026-07-26");
  assert.equal(original.reviewRequired, true);
  assert.ok(replacement, "Expected the replacement timing segment to remain.");
  assert.equal(replacement.reviewRequired, true);
  assert.equal(replacement.amount, 1300);
});

test("R3B follow-up: direct timing-editor changes remain included for review after payoff", () => {
  const { CALC, WEEKLY, plan, result, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const edited = WEEKLY.updateTimingItem(plan, result, weeklyPlan, "timing-liability-personal-loan", {
    amount: 1250,
    firstDate: "2026-07-20",
    note: "Manual refinance test",
  });

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, edited, "2026-07-27");
  const item = weeklyLoanTiming(reforecasted);

  assert.equal(item.amount, 1250);
  assert.equal(item.firstDate, "2026-07-20");
  assert.equal(item.note, "Manual refinance test");
  assert.equal(item.endDate, "");
  assert.equal(item.reviewRequired, true);
  assert.match(item.reviewReason, /remains included/);
  assert.equal(weeklyAmountForWeek(reforecasted, 2), 1250);
});

test("R3B follow-up: all-occurrences edits remain included for review after payoff", () => {
  const { CALC, WEEKLY, plan, result, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const edited = WEEKLY.applyOccurrenceEdit(plan, result, weeklyPlan, "timing-liability-personal-loan", "2026-07-20", { amount: 1300 }, "all");

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, edited, "2026-07-27");
  const item = weeklyLoanTiming(reforecasted);

  assert.equal(item.amount, 1300);
  assert.equal(item.endDate, "");
  assert.equal(item.reviewRequired, true);
  assert.equal(weeklyAmountForWeek(reforecasted, 2), 1300);
});

test("R3B follow-up: a single-occurrence override survives and is described as still included", () => {
  const { CALC, WEEKLY, plan, result, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const overridden = WEEKLY.applyOccurrenceEdit(plan, result, weeklyPlan, "timing-liability-personal-loan", "2026-07-27", { amount: 2500 }, "this");

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, overridden, "2026-07-20");
  const item = weeklyLoanTiming(reforecasted);

  assert.equal(item.endDate, "2026-07-19");
  assert.equal(item.reviewRequired, true);
  assert.equal(item.paidOffLoanTimingHasCustomOverrides, true);
  assert.match(item.reviewReason, /Custom occurrence changes remain included/);
  assert.equal(weeklyAmountForWeek(reforecasted, 3), 2500);
});

test("R3B follow-up: legacy generated IDs without edit provenance are handled conservatively", () => {
  const { CALC, WEEKLY } = loadRuntime();
  const activePlan = weeklyLoanPlan(CALC);
  const weeklyPlan = WEEKLY.createFromPlan(activePlan, CALC.calculatePlan(activePlan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const legacyEdited = {
    ...weeklyPlan,
    settings: {
      ...weeklyPlan.settings,
      timingItems: [{
        id: "timing-liability-personal-loan",
        sourceId: "personal-loan",
        sourceKind: "liability",
        autoGenerated: true,
        description: "Personal loan manually adjusted before R3B metadata",
        amount: 1450,
        frequency: "weekly",
        firstDate: "2026-07-20",
        type: "bill",
        active: true,
        note: "Legacy saved manual value",
      }],
    },
  };

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, activePlan, legacyEdited, "2026-07-27");
  const item = weeklyLoanTiming(reforecasted);

  assert.equal(item.amount, 1450);
  assert.equal(item.endDate, "");
  assert.equal(item.reviewRequired, true);
  assert.match(item.reviewReason, /without enough edit history/);
  assert.equal(weeklyAmountForWeek(reforecasted, 2), 1450);
});

test("R3B follow-up: a midweek payoff review preserves an earlier-due current-week payment", () => {
  const { CALC, WEEKLY, plan, weeklyPlan } = createPositiveWeeklyLoanPlan("2026-07-13");

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, weeklyPlan, "2026-07-15");
  const item = weeklyLoanTiming(reforecasted);

  assert.equal(item.endDate, "2026-07-19");
  assert.equal(weeklyAmountForWeek(reforecasted, 1), 1000);
  assert.equal(weeklyAmountForWeek(reforecasted, 2), 0);
  assert.equal(item.reviewRequired, true);
});

test("R3B follow-up: open-week actuals and completed weeks remain unchanged during payoff review", () => {
  const { CALC, WEEKLY, plan, result, weeklyPlan } = createPositiveWeeklyLoanPlan("2026-07-13");
  const withOpenActual = WEEKLY.updateActual(weeklyPlan, 1, {
    openingBalance: 5000,
    income: 0,
    essentialCosts: 777,
    notes: "Open week note",
  });
  const reforecastedOpen = reforecastPaidOffLoan(CALC, WEEKLY, plan, withOpenActual, "2026-07-13");
  const openWeek = reforecastedOpen.weeks.find((week) => week.weekNumber === 1);

  assert.equal(openWeek.actual.essentialCosts, 777);
  assert.equal(openWeek.actual.notes, "Open week note");
  assert.equal(weeklyAmountForWeek(reforecastedOpen, 1), 1000);

  const completed = WEEKLY.completeWeek(plan, result, weeklyPlan, 1, {
    openingBalance: 5000,
    income: 0,
    essentialCosts: 1000,
    amountSetAside: 0,
    discretionarySpending: 0,
    investment: 0,
    extraSuper: 0,
    extraDebtRepayment: 0,
    offsetTransfer: 0,
    otherTransfers: 0,
    enteredBankBalance: 4000,
    notes: "Completed payment retained.",
  });
  const reforecastedCompleted = reforecastPaidOffLoan(CALC, WEEKLY, plan, completed, "2026-07-20");
  const completedWeek = reforecastedCompleted.weeks.find((week) => week.weekNumber === 1);

  assert.equal(completedWeek.isCompleted, true);
  assert.equal(completedWeek.actual.closingBalance, 4000);
  assert.equal(completedWeek.actual.notes, "Completed payment retained.");
  assert.equal(weeklyAmountForWeek(reforecastedCompleted, 2), 0);
});

test("R3B follow-up: inactive linked timing and unrelated one-off records are preserved", () => {
  const { CALC, WEEKLY, plan, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const existing = {
    ...weeklyPlan,
    settings: {
      ...weeklyPlan.settings,
      timingItems: weeklyPlan.settings.timingItems.map((item) => item.sourceId === "personal-loan" ? { ...item, active: false, endDate: "2026-07-19" } : item),
      oneOffItems: [{
        id: "manual-car-repair",
        description: "Manual car repair",
        amount: 300,
        frequency: "oneOff",
        firstDate: "2026-07-27",
        type: "bill",
        active: true,
      }],
    },
  };

  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, existing, "2026-07-27");
  const item = weeklyLoanTiming(reforecasted);
  const oneOff = reforecasted.settings.oneOffItems.find((candidate) => candidate.id === "manual-car-repair");

  assert.equal(item.active, false);
  assert.equal(item.endDate, "2026-07-19");
  assert.equal(item.reviewRequired, false);
  assert.ok(oneOff);
  assert.equal(oneOff.amount, 300);
  assert.equal(weeklyAmountForWeek(reforecasted, 3, "manual-car-repair"), 300);
});

test("R3B follow-up: item review reasons and stopped next-payment text are wired into the existing UI source", () => {
  const appSource = readFileSync(APP_PATH, "utf8");

  assert.ok(appSource.includes("function weeklyTimingReviewNoticeHtml"), "UI source should define the review notice renderer.");
  assert.ok(appSource.includes("weeklyTimingReviewNoticeHtml(item)"), "Timing rows should render item review notices.");
  assert.ok(appSource.includes("item.reviewRequired"), "UI source should inspect review-required timing items.");
  assert.ok(appSource.includes("paidOffLoanTimingEffectiveEndDate"), "UI source should display paid-off loan stop metadata.");
  assert.ok(appSource.includes("No further scheduled payments"), "Stopped timing items should not show stale next payment dates.");
  assert.ok(appSource.includes("weeklyTimingNextDateText(item)"), "Timing rows should use end-date-aware next-payment text.");
  assert.ok(appSource.includes("blocking.push(`${label} needs review"), "Timing validation should block unresolved review items.");
  assert.ok(appSource.includes("validation.blocking.length"), "Timing review completion should check blocking validation errors.");
});

test("R3B follow-up: backup export and import preserve review metadata and occurrence overrides", () => {
  const { CALC, WEEKLY, plan, result, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const overridden = WEEKLY.applyOccurrenceEdit(plan, result, weeklyPlan, "timing-liability-personal-loan", "2026-07-27", { amount: 2500 }, "this");
  const reforecasted = reforecastPaidOffLoan(CALC, WEEKLY, plan, overridden, "2026-07-20");

  const imported = WEEKLY.importPayload(WEEKLY.exportPayload(reforecasted));
  const item = weeklyLoanTiming(imported);

  assert.equal(item.reviewRequired, true);
  assert.equal(item.paidOffLoanTimingEffectiveEndDate, "2026-07-19");
  assert.equal(item.paidOffLoanTimingHasCustomOverrides, true);
  assert.equal(imported.settings.occurrenceOverrides.length, 1);
  assert.equal(imported.settings.occurrenceOverrides[0].amount, 2500);
});

test("R3B follow-up: missing shared classifier is explicit while normal load order still skips confirmed paid-off loans", () => {
  const WEEKLY_ONLY = loadWeeklyOnly();
  const plan = {
    incomeItems: [],
    expenseItems: [],
    liabilityItems: [{
      id: "personal-loan",
      name: "Personal loan",
      type: "personalLoan",
      balance: 0,
      repayment: 1000,
      repaymentFrequency: "weekly",
    }],
    investing: {},
    liabilities: {},
    expenses: {},
    assets: {},
  };
  const missingHelperPlan = WEEKLY_ONLY.createFromPlan(plan, {}, {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 4,
    openingBankBalance: 5000,
  });
  const reviewItem = weeklyLoanTiming(missingHelperPlan);

  assert.ok(reviewItem);
  assert.equal(reviewItem.reviewRequired, true);
  assert.match(reviewItem.reviewReason, /classifier is unavailable/);

  const { CALC, WEEKLY } = loadRuntime();
  const normalPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const normalWeeklyPlan = WEEKLY.createFromPlan(normalPlan, CALC.calculatePlan(normalPlan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 4,
    openingBankBalance: 5000,
  });

  assert.equal(weeklyLoanTiming(normalWeeklyPlan), undefined);
});

test("R3B follow-up: repeated reforecast does not mutate caller plan or weekly source objects", () => {
  const { CALC, WEEKLY, plan, weeklyPlan } = createPositiveWeeklyLoanPlan();
  const paidOffPlan = JSON.parse(JSON.stringify(plan));
  paidOffPlan.liabilityItems[0].balance = 0;
  const first = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...weeklyPlan,
    settings: { ...weeklyPlan.settings, todayIso: "2026-07-20" },
  });
  const planBefore = JSON.stringify(paidOffPlan);
  const weeklyBefore = JSON.stringify(first);

  WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...first,
    settings: { ...first.settings, todayIso: "2026-07-27" },
  });

  assert.equal(JSON.stringify(paidOffPlan), planBefore);
  assert.equal(JSON.stringify(first), weeklyBefore);
});

test("R3B UI closure: unresolved timing review blocks global completion through the real UI review function", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.completeWeeklyTimingReview();

  const item = weeklyLoanTiming(hooks.getWeeklyPlan());
  assert.equal(item.reviewRequired, true);
  assert.equal(hooks.getWeeklyPlan().settings.timingSetupReviewed, false);
  assert.equal(hooks.weeklyTimingValidation().blocking.length, 1);
});

test("R3B UI closure: opening an unchanged editor then using global completion does not resolve review", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });
  const itemId = weeklyLoanTiming(reviewPlan).id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(itemId);
  assert.equal(hooks.getEditingTimingItemId(), itemId);
  hooks.completeWeeklyTimingReview();

  const item = weeklyLoanTiming(hooks.getWeeklyPlan());
  assert.equal(item.reviewRequired, true);
  assert.equal(item.reviewResolvedAt, "");
  assert.equal(hooks.getWeeklyPlan().settings.timingSetupReviewed, false);
  assert.equal(hooks.getEditingTimingItemId(), null);
});

test("R3B UI closure: cancelling after inspecting an item preserves the unresolved review", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });
  const itemId = weeklyLoanTiming(reviewPlan).id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(itemId);
  hooks.cancelWeeklyTimingDraft(itemId);

  const item = weeklyLoanTiming(hooks.getWeeklyPlan());
  assert.equal(item.reviewRequired, true);
  assert.equal(item.reviewResolvedAt, "");
});

test("R3B UI closure: explicit item acknowledgement resolves just that item and allows global completion", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });
  const itemId = weeklyLoanTiming(reviewPlan).id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(itemId);
  hooks.saveWeeklyTimingDraft(itemId);
  let item = weeklyLoanTiming(hooks.getWeeklyPlan());
  assert.equal(item.reviewRequired, false);
  assert.equal(item.reviewResolution, "timing-reviewed");

  hooks.completeWeeklyTimingReview();
  item = weeklyLoanTiming(hooks.getWeeklyPlan());
  assert.equal(item.reviewRequired, false);
  assert.equal(hooks.getWeeklyPlan().settings.timingSetupReviewed, true);
});

test("R3B UI closure: acknowledging one of two review items does not waive the other", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  plan.liabilityItems.push({
    id: "second-loan",
    name: "Second loan",
    type: "personalLoan",
    balance: 50000,
    repayment: 800,
    repaymentFrequency: "weekly",
  });
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = JSON.parse(JSON.stringify(plan));
  paidOffPlan.liabilityItems = paidOffPlan.liabilityItems.map((loan) => ({ ...loan, balance: 0 }));
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });
  const firstId = weeklyLoanTiming(reviewPlan, "personal-loan").id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(firstId);
  hooks.saveWeeklyTimingDraft(firstId);
  hooks.completeWeeklyTimingReview();

  assert.equal(weeklyLoanTiming(hooks.getWeeklyPlan(), "personal-loan").reviewRequired, false);
  assert.equal(weeklyLoanTiming(hooks.getWeeklyPlan(), "second-loan").reviewRequired, true);
  assert.equal(hooks.getWeeklyPlan().settings.timingSetupReviewed, false);
  assert.equal(hooks.weeklyTimingValidation().blocking.length, 1);
});

test("R3B UI closure: explicit deactivation decision survives backup, import and later reforecast", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });
  const itemId = weeklyLoanTiming(reviewPlan).id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(itemId);
  hooks.updateWeeklyTimingDraft({ active: false });
  hooks.saveWeeklyTimingDraft(itemId);

  const imported = WEEKLY.importPayload(WEEKLY.exportPayload(hooks.getWeeklyPlan()));
  const reforecasted = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...imported,
    settings: { ...imported.settings, todayIso: "2026-08-03" },
  });
  const item = weeklyLoanTiming(reforecasted);

  assert.equal(item.active, false);
  assert.equal(item.reviewRequired, false);
  assert.equal(item.reviewResolution, "deactivated");
});

test("R3B UI closure: custom retained payments are reflected by next-payment text and unresolved notice", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const overridden = WEEKLY.applyOccurrenceEdit(plan, CALC.calculatePlan(plan), active, "timing-liability-personal-loan", "2026-07-27", { amount: 2500 }, "this");
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...overridden,
    settings: { ...overridden.settings, todayIso: "2026-07-20" },
  });
  const item = weeklyLoanTiming(reviewPlan);

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);

  assert.match(hooks.weeklyTimingNextDateText(item), /Regular payments stopped; next custom payment/);
  assert.doesNotMatch(hooks.weeklyTimingNextDateText(item), /No further scheduled payments/);
  const notice = hooks.weeklyTimingReviewNoticeHtml(item);
  assert.match(notice, /Review required/);
  assert.match(notice, /Custom occurrence changes remain included until you review this item/);
  assert.match(notice, /2,500/);
  assert.equal(weeklyAmountForWeek(reviewPlan, 3), 2500);
});

test("R3B UI closure: resolved custom-payment notice no longer describes the decision as pending", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const overridden = WEEKLY.applyOccurrenceEdit(plan, CALC.calculatePlan(plan), active, "timing-liability-personal-loan", "2026-07-27", { amount: 2500 }, "this");
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...overridden,
    settings: { ...overridden.settings, todayIso: "2026-07-20" },
  });
  const itemId = weeklyLoanTiming(reviewPlan).id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(itemId);
  hooks.saveWeeklyTimingDraft(itemId);

  const resolved = weeklyLoanTiming(hooks.getWeeklyPlan());
  const notice = hooks.weeklyTimingReviewNoticeHtml(resolved);
  assert.match(notice, /Review recorded/);
  assert.match(notice, /under your reviewed timing decision/);
  assert.doesNotMatch(notice, /until you review this item/);
  assert.equal(weeklyAmountForWeek(hooks.getWeeklyPlan(), 3), 2500);
});

test("R3B UI closure: inactive or cancelled items without future overrides show a stopped state", () => {
  const { hooks, CALC, WEEKLY } = loadAppUiHooks();
  const plan = weeklyLoanPlan(CALC);
  const active = WEEKLY.createFromPlan(plan, CALC.calculatePlan(plan), {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 12,
    openingBankBalance: 5000,
  });
  const paidOffPlan = weeklyLoanPlan(CALC, { balance: 0 });
  const reviewPlan = WEEKLY.reforecast(paidOffPlan, CALC.calculatePlan(paidOffPlan), {
    ...active,
    settings: { ...active.settings, todayIso: "2026-07-20" },
  });
  const itemId = weeklyLoanTiming(reviewPlan).id;

  hooks.setPlan(paidOffPlan);
  hooks.setWeeklyPlan(reviewPlan);
  hooks.beginWeeklyTimingEdit(itemId);
  hooks.updateWeeklyTimingDraft({ active: false });
  hooks.saveWeeklyTimingDraft(itemId);

  const inactive = weeklyLoanTiming(hooks.getWeeklyPlan());
  assert.equal(hooks.weeklyTimingNextDateText(inactive), "No further scheduled payments");
  assert.match(hooks.weeklyTimingReviewNoticeHtml(inactive), /This item is inactive under your reviewed timing decision/);
});
