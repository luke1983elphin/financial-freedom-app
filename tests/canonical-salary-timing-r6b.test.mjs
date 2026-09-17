import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const context = { console };
context.globalThis = context;
for (const file of ["calculator.js", "weekly-plan.js"]) {
  vm.runInNewContext(readFileSync(new URL(file, rootUrl), "utf8"), context, { filename: file });
}

const CALC = context.FFSCalculator;
const WEEKLY = context.FFSWeeklyPlan;
const clone = (value) => JSON.parse(JSON.stringify(value));

function planWithSalaries({
  person1Frequency = "fortnightly",
  person2Frequency = "fortnightly",
  legacyPerson1Frequency = "annually",
  legacyPerson2Frequency = "annually",
  includePerson2 = true,
} = {}) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Taylor";
  plan.personal.person2Name = includePerson2 ? "Morgan" : "";
  plan.income.person1Frequency = legacyPerson1Frequency;
  plan.income.person2Frequency = legacyPerson2Frequency;
  plan.incomeItems = [{
    id: "income-person-1",
    name: "Taylor salary",
    type: "salaryWages",
    owner: "person1",
    amount: 104000,
    frequency: person1Frequency,
  }];
  if (includePerson2) {
    plan.incomeItems.push({
      id: "income-person-2",
      name: "Morgan salary",
      category: "salary_wages",
      owner: "person2",
      amount: 78000,
      frequency: person2Frequency,
    });
  }
  plan.expenseItems = [];
  plan.assetItems = [];
  plan.liabilityItems = [];
  plan.investing.annualInvestingTarget = 0;
  plan.investing.extraSuperContributions = 0;
  return plan;
}

function resultFor({ person1Net = 52000, person2Net = 39000 } = {}) {
  return {
    person1AnnualIncome: 104000,
    person2AnnualIncome: person2Net ? 78000 : 0,
    otherAnnualIncome: 0,
    annualGrossIncome: 182000,
    netIncomeAfterTaxHelp: person1Net + person2Net,
    payrollEstimates: {
      person1: { estimatedNetEmploymentIncome: person1Net },
      person2: { estimatedNetEmploymentIncome: person2Net },
      household: {},
    },
  };
}

function create(plan, result = resultFor(), existingPlan = null) {
  const options = {
    startDate: "2026-07-13",
    todayIso: "2026-07-13",
    durationWeeks: 52,
    openingBankBalance: 1000,
    minimumCashBuffer: 0,
  };
  return WEEKLY.createFromPlan(plan, result, existingPlan ? existingPlan.settings : options, existingPlan);
}

function salaryTiming(weeklyPlan, personNumber) {
  return weeklyPlan.settings.timingItems.find((item) => item.id === `timing-income-person-${personNumber}`);
}

test("R6B-A canonical person 1 fortnightly frequency overrides stale legacy annual frequency", () => {
  const plan = planWithSalaries();
  const weeklyPlan = create(plan);
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "fortnightly");
  assert.equal(salaryTiming(weeklyPlan, 1).amount, 2000);
  assert.equal(plan.income.person1Frequency, "annually");
});

test("R6B-B canonical person 2 fortnightly frequency overrides stale legacy annual frequency", () => {
  const plan = planWithSalaries();
  const weeklyPlan = create(plan);
  assert.equal(salaryTiming(weeklyPlan, 2).frequency, "fortnightly");
  assert.equal(salaryTiming(weeklyPlan, 2).amount, 1500);
  assert.equal(plan.income.person2Frequency, "annually");
});

test("R6B-C mixed person frequencies resolve independently", () => {
  const weeklyPlan = create(planWithSalaries({ person1Frequency: "weekly", person2Frequency: "monthly" }));
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "weekly");
  assert.equal(salaryTiming(weeklyPlan, 2).frequency, "monthly");
});

for (const [letter, frequency, occurrences] of [
  ["D", "weekly", 52],
  ["E", "fortnightly", 26],
  ["F", "monthly", 12],
  ["G", "annually", 1],
]) {
  test(`R6B-${letter} ${frequency} periodic amount reconciles to annual net`, () => {
    const weeklyPlan = create(planWithSalaries({ person1Frequency: frequency, includePerson2: false }), resultFor({ person1Net: 52000, person2Net: 0 }));
    const timing = salaryTiming(weeklyPlan, 1);
    assert.equal(timing.frequency, frequency);
    assert.ok(Math.abs(timing.amount * occurrences - 52000) <= 0.05);
  });
}

test("R6B-H missing structured salaries falls back to legacy frequency", () => {
  const plan = planWithSalaries({ includePerson2: false });
  delete plan.incomeItems;
  plan.income.person1Income = 2000;
  plan.income.person1Frequency = "monthly";
  const weeklyPlan = create(plan, resultFor({ person1Net: 24000, person2Net: 0 }));
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "monthly");
  assert.equal(salaryTiming(weeklyPlan, 1).amount, 2000);
});

test("R6B-I malformed canonical frequency uses valid legacy fallback", () => {
  const plan = planWithSalaries({ person1Frequency: "every-payday", includePerson2: false, legacyPerson1Frequency: "weekly" });
  const weeklyPlan = create(plan, resultFor({ person1Net: 52000, person2Net: 0 }));
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "weekly");
});

test("R6B-J unrelated records are not selected as a person's salary source", () => {
  const plan = planWithSalaries({ person1Frequency: "weekly", person2Frequency: "annually" });
  plan.incomeItems.unshift(
    { id: "rental", type: "rentalNetCashIncome", owner: "person1", amount: 500, frequency: "quarterly" },
    { id: "scenario", type: "other", owner: "person1", amount: 500, frequency: "monthly" },
  );
  const weeklyPlan = create(plan);
  assert.equal(salaryTiming(weeklyPlan, 1).sourceId, "income-person-1");
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "weekly");
  assert.equal(salaryTiming(weeklyPlan, 2).frequency, "annually");
});

test("R6B-K manual timing edits remain user-owned during reforecast", () => {
  const plan = planWithSalaries({ person1Frequency: "fortnightly", includePerson2: false });
  let weeklyPlan = create(plan, resultFor({ person1Net: 52000, person2Net: 0 }));
  weeklyPlan = WEEKLY.updateTimingItem(plan, resultFor({ person1Net: 52000, person2Net: 0 }), weeklyPlan, "timing-income-person-1", { frequency: "monthly", amount: 4300 });
  plan.incomeItems[0].frequency = "weekly";
  weeklyPlan = WEEKLY.reforecast(plan, resultFor({ person1Net: 52000, person2Net: 0 }), weeklyPlan);
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "monthly");
  assert.equal(salaryTiming(weeklyPlan, 1).amount, 4300);
  assert.equal(salaryTiming(weeklyPlan, 1).userEdited, true);
});

test("R6B-L completed-week history is frozen when canonical timing changes", () => {
  const plan = planWithSalaries({ includePerson2: false });
  const result = resultFor({ person1Net: 52000, person2Net: 0 });
  let weeklyPlan = create(plan, result);
  weeklyPlan = WEEKLY.completeWeek(plan, result, weeklyPlan, 1, { income: 1995, closingBalance: 2995 });
  const completedBefore = clone(weeklyPlan.weeks[0]);
  plan.incomeItems[0].frequency = "weekly";
  weeklyPlan = WEEKLY.reforecast(plan, result, weeklyPlan);
  assert.deepEqual(clone(weeklyPlan.weeks[0]), completedBefore);
});

test("R6B-M recorded actuals on an incomplete week are preserved", () => {
  const plan = planWithSalaries({ includePerson2: false });
  const result = resultFor({ person1Net: 52000, person2Net: 0 });
  let weeklyPlan = create(plan, result);
  weeklyPlan = WEEKLY.updateActual(weeklyPlan, 2, { income: 2010, notes: "Recorded early" });
  plan.incomeItems[0].frequency = "weekly";
  weeklyPlan = WEEKLY.reforecast(plan, result, weeklyPlan);
  assert.equal(weeklyPlan.weeks[1].actual.income, 2010);
  assert.equal(weeklyPlan.weeks[1].actual.notes, "Recorded early");
});

test("R6B-N untouched generated future timing updates through source-snapshot rules", () => {
  const plan = planWithSalaries({ includePerson2: false });
  const result = resultFor({ person1Net: 52000, person2Net: 0 });
  let weeklyPlan = create(plan, result);
  assert.equal(salaryTiming(weeklyPlan, 1).autoGenerated, true);
  assert.ok(salaryTiming(weeklyPlan, 1).sourceSnapshot);
  plan.incomeItems[0].frequency = "weekly";
  weeklyPlan = WEEKLY.reforecast(plan, result, weeklyPlan);
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "weekly");
  assert.equal(salaryTiming(weeklyPlan, 1).amount, 1000);
  assert.equal(salaryTiming(weeklyPlan, 1).reviewRequired, true);
  assert.equal(weeklyPlan.settings.timingSetupNeedsReview, true);
});

test("R6B-O Week 1 receives periodic, not annual, net salary", () => {
  const weeklyPlan = create(planWithSalaries({ includePerson2: false }), resultFor({ person1Net: 52000, person2Net: 0 }));
  assert.equal(weeklyPlan.weeks[0].planned.income, 2000);
  assert.notEqual(weeklyPlan.weeks[0].planned.income, 52000);
});

test("R6B-P Weekly Plan timing does not mutate plan data or annual financial metrics", () => {
  const plan = planWithSalaries();
  const beforePlan = clone(plan);
  const before = CALC.calculatePlan(clone(plan));
  create(plan, before);
  const after = CALC.calculatePlan(clone(plan));
  assert.deepEqual(clone(plan), beforePlan);
  for (const key of ["annualGrossIncome", "annualNetIncome", "annualExpenses", "currentNetFiAssets", "currentNetWorth", "annualPassiveIncome"]) {
    assert.equal(after[key], before[key], key);
  }
});

test("R6B saved rows without auto-generated provenance are not rewritten", () => {
  const plan = planWithSalaries({ includePerson2: false });
  const result = resultFor({ person1Net: 52000, person2Net: 0 });
  let weeklyPlan = create(plan, result);
  weeklyPlan.settings.timingItems[0] = {
    ...weeklyPlan.settings.timingItems[0],
    frequency: "annually",
    amount: 52000,
    autoGenerated: false,
    sourceKind: "",
    sourceSnapshot: null,
  };
  weeklyPlan = WEEKLY.reforecast(plan, result, weeklyPlan);
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "annually");
  assert.equal(salaryTiming(weeklyPlan, 1).amount, 52000);
});

test("R6B occurrence-edited generated timing is not rewritten", () => {
  const plan = planWithSalaries({ includePerson2: false });
  const result = resultFor({ person1Net: 52000, person2Net: 0 });
  let weeklyPlan = create(plan, result);
  weeklyPlan = WEEKLY.applyOccurrenceEdit(plan, result, weeklyPlan, "timing-income-person-1", "2026-07-13", { date: "2026-07-14", amount: 2100 }, "this");
  plan.incomeItems[0].frequency = "weekly";
  weeklyPlan = WEEKLY.reforecast(plan, result, weeklyPlan);
  assert.equal(salaryTiming(weeklyPlan, 1).frequency, "fortnightly");
  assert.equal(weeklyPlan.settings.occurrenceOverrides.length, 1);
});
