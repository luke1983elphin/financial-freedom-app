import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateGoalProgress,
  calculateLifestyleFundingPercentage,
  calculateWeeklyStreak,
  deriveJourneyStage,
} from "../lib/engagement.ts";

test("Financial Freedom progress is capped for display but preserves raw progress", () => {
  const result = calculateLifestyleFundingPercentage({
    financialIndependenceAssets: 3_000_000,
    safeWithdrawalRatePct: 4,
    targetAnnualLifestyleSpending: 80_000,
  });

  assert.equal(result.rawPercent, 150);
  assert.equal(result.displayPercent, 100);
  assert.equal(result.sustainableAnnualIncome, 120_000);
});

test("goal progress handles zero targets and overfunded goals safely", () => {
  assert.deepEqual(calculateGoalProgress({ currentAmount: 500, targetAmount: 0 }), {
    rawPercent: 0,
    displayPercent: 0,
    remainingAmount: 0,
  });
  const overfunded = calculateGoalProgress({ currentAmount: 12_000, targetAmount: 10_000 });
  assert.equal(overfunded.rawPercent, 120);
  assert.equal(overfunded.displayPercent, 100);
  assert.equal(overfunded.remainingAmount, 0);
});

test("weekly streak counts consecutive completed weeks from the latest completed week", () => {
  assert.equal(calculateWeeklyStreak([]), 0);
  assert.equal(calculateWeeklyStreak([1, 2, 3, 5, 6, 7]), 3);
  assert.equal(calculateWeeklyStreak([2, 3, 4, 4, 5]), 4);
});

test("journey stage is derived from financial progress and practical readiness", () => {
  assert.equal(deriveJourneyStage({
    hasPlanData: false,
    finalProjectedCashSurplus: 0,
    emergencyMonths: 0,
    investmentBalance: 0,
    annualInvestmentContributions: 0,
    totalLiabilities: 0,
    totalAssets: 0,
    financialIndependenceProgressPct: 0,
    financialFreedomProgressPct: 0,
  }), "Getting Started");

  assert.equal(deriveJourneyStage({
    hasPlanData: true,
    finalProjectedCashSurplus: 5_000,
    emergencyMonths: 0.5,
    investmentBalance: 0,
    annualInvestmentContributions: 0,
    totalLiabilities: 0,
    totalAssets: 20_000,
    financialIndependenceProgressPct: 4,
    financialFreedomProgressPct: 4,
  }), "Building Stability");

  assert.equal(deriveJourneyStage({
    hasPlanData: true,
    finalProjectedCashSurplus: 20_000,
    emergencyMonths: 4,
    investmentBalance: 50_000,
    annualInvestmentContributions: 15_000,
    totalLiabilities: 200_000,
    totalAssets: 900_000,
    financialIndependenceProgressPct: 78,
    financialFreedomProgressPct: 78,
  }), "Approaching Independence");

  assert.equal(deriveJourneyStage({
    hasPlanData: true,
    finalProjectedCashSurplus: 30_000,
    emergencyMonths: 6,
    investmentBalance: 2_500_000,
    annualInvestmentContributions: 40_000,
    totalLiabilities: 0,
    totalAssets: 3_000_000,
    financialIndependenceProgressPct: 120,
    financialFreedomProgressPct: 105,
  }), "Financial Freedom");
});
