import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadCalculator() {
  const source = readFileSync(new URL("../calculator.js", import.meta.url), "utf8");
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.FFSCalculator;
}

function basePlan() {
  const CALC = loadCalculator();
  const plan = CALC.emptyPlan();
  plan.incomeItems = [];
  plan.liabilityItems = [];
  plan.investing.extraSuperContributions = 0;
  plan.investing.person1EmployerSuperOverrideEnabled = false;
  plan.investing.person2EmployerSuperOverrideEnabled = false;
  return { CALC, plan };
}

test("STSL repayments are person-specific and capped by remaining balance", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
    { id: "salary-2", type: "salaryWages", owner: "person2", amount: 80000, frequency: "annually" },
  ];
  plan.income.person1HasStslDebt = true;
  plan.income.person2HasStslDebt = false;
  plan.liabilityItems = [
    { id: "liability-stsl-person1", type: "hecsHelp", owner: "person1", balance: 1000 },
    { id: "liability-stsl-person2", type: "hecsHelp", owner: "person2", balance: 50000 },
  ];

  const result = CALC.calculatePlan(plan);

  assert.equal(result.stslRepaymentEstimate.person1.annualRepayment, 1000);
  assert.equal(result.stslRepaymentEstimate.person1.projectedClosingBalance, 0);
  assert.equal(result.stslRepaymentEstimate.person2.annualRepayment, 0);
  assert.equal(result.stslRepaymentEstimate.person2.projectedClosingBalance, 50000);
});

test("joint income allocation uses the entered ownership percentages", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    {
      id: "interest-1",
      type: "interest",
      owner: "joint",
      amount: 10000,
      frequency: "annually",
      person1AllocationPercentage: 70,
      person2AllocationPercentage: 30,
    },
  ];

  const result = CALC.calculatePlan(plan);

  assert.equal(result.person1AnnualIncome, 7000);
  assert.equal(result.person2AnnualIncome, 3000);
  assert.equal(result.annualGrossIncome, 10000);
});

test("legacy dividend franking fields migrate to the annual cash dividend received only", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    {
      id: "dividend-1",
      type: "dividends",
      owner: "person1",
      amount: 7000,
      cashDividend: 7000,
      frankingCredits: 3000,
      frequency: "annually",
    },
  ];

  const result = CALC.calculatePlan(plan);

  assert.equal(result.annualGrossIncome, 7000);
  assert.equal(result.person1AnnualIncome, 7000);
  assert.equal(result.passiveIncomeBreakdown.dividends, 7000);
  assert.equal(result.passiveIncomeBreakdown.total, 7000);
});

test("employer super is calculated from salary and wages only and uses the configured cap", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 300000, frequency: "annually" },
    { id: "interest-1", type: "interest", owner: "person1", amount: 50000, frequency: "annually" },
    { id: "salary-2", type: "salaryWages", owner: "person2", amount: 100000, frequency: "annually" },
  ];

  const result = CALC.calculatePlan(plan);

  assert.equal(result.employerSuperContributions.person1Calculated, 32499.6);
  assert.equal(result.employerSuperContributions.person2Calculated, 12000);
  assert.equal(result.employerSuperContributions.maximumContributionBase, 270830);
});

test("manual employer super override is preserved until reset by the user", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
  ];
  plan.investing.person1EmployerSuperOverrideEnabled = true;
  plan.investing.person1EmployerSuperOverride = 15000;

  const result = CALC.calculatePlan(plan);

  assert.equal(result.employerSuperContributions.person1Calculated, 12000);
  assert.equal(result.employerSuperContributions.person1Amount, 15000);
});

test("Medicare levy surcharge is separate and depends on cover status", () => {
  const { CALC, plan } = basePlan();
  plan.personal.person2Name = "Person 2";
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 120000, frequency: "annually" },
    { id: "salary-2", type: "salaryWages", owner: "person2", amount: 100000, frequency: "annually" },
  ];
  plan.income.person1HospitalCoverStatus = "no-cover";
  plan.income.person2HospitalCoverStatus = "no-cover";

  const noCover = CALC.calculatePlan(plan);
  assert.equal(noCover.taxEstimate.medicareLevySurcharge, 2200);

  plan.income.person1HospitalCoverStatus = "full-year";
  plan.income.person2HospitalCoverStatus = "full-year";
  const covered = CALC.calculatePlan(plan);
  assert.equal(covered.taxEstimate.medicareLevySurcharge, 0);
});

test("passive income includes only passive categories and flagged other income", () => {
  const { CALC, plan } = basePlan();
  plan.incomeItems = [
    { id: "salary-1", type: "salaryWages", owner: "person1", amount: 100000, frequency: "annually" },
    { id: "interest-1", type: "interest", owner: "person1", amount: 2000, frequency: "annually" },
    { id: "other-1", type: "other", owner: "person2", amount: 3000, frequency: "annually", isPassiveIncome: false },
    { id: "other-2", type: "other", owner: "joint", amount: 4000, frequency: "annually", isPassiveIncome: true },
  ];

  const result = CALC.calculatePlan(plan);

  assert.equal(result.passiveIncomeBreakdown.interest, 2000);
  assert.equal(result.passiveIncomeBreakdown.otherPassive, 4000);
  assert.equal(result.passiveIncomeBreakdown.total, 6000);
});
