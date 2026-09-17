import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateGoalProgress,
  calculateLifestyleFundingPercentage,
  calculateWeeklyStreak,
  deriveJourneyStage,
} from "../lib/engagement.ts";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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

test("workspace dashboard renders a simplified layer with details preserved", () => {
  assert.match(indexSource, /id="dashboardSimplified"/);
  assert.match(indexSource, /id="dashboardDetails"/);
  assert.match(appSource, /function renderDashboardSimplified/);
  assert.match(appSource, /This Week's Mission/);
  assert.match(appSource, /Continue Weekly Plan/);
  assert.match(appSource, /data-dashboard-detail-open/);
});

test("dashboard mission shows one current action before expanded task details", () => {
  assert.match(appSource, /const nextTask = mission\.tasks\.find\(\(task\) => !task\.completed\)/);
  assert.match(appSource, /const expandedTasks = \[\.\.\.remainingUnfinishedTasks, \.\.\.completedTasks\]/);
  assert.match(appSource, /engagementMissionExpanded && expandedTasks\.length/);
  assert.match(appSource, /dashboard-task-recommendation/);
  assert.doesNotMatch(appSource, /<button class="dashboard-task-button" type="button" data-engagement-action="weeklyplan">/);
  assert.match(appSource, /Weekly Mission complete/);
});

test("workspace dashboard keeps Future You prominent with a live age control", () => {
  assert.match(appSource, /function dashboardFutureYouHtml/);
  assert.match(appSource, /const inputId = `\$\{idPrefix\}FutureAgeInput`/);
  assert.match(appSource, /data-dashboard-future-age/);
  assert.match(appSource, /data-dashboard-future-age-label/);
  assert.match(appSource, /data-dashboard-future-results/);
  assert.match(appSource, /Projected FI assets/);
  assert.match(appSource, /Financial Freedom %/);
});

test("home page reuses dashboard mission and Future You components", () => {
  assert.match(appSource, /dashboardMissionHtml\(result, homeReadyState\)/);
  assert.match(appSource, /dashboardFutureYouHtml\(result, homeReadyState, \{ idPrefix: "home" \}\)/);
  assert.doesNotMatch(appSource, /engagement-future-compact/);
});

test("lifestyle spending field explains today's dollars and shows live inflation helper", () => {
  assert.match(appSource, /Annual Lifestyle Spending Needed for Financial Freedom \(Today's Dollars\)/);
  assert.match(appSource, /expressed in today's dollars/);
  assert.match(appSource, /data-lifestyle-spending-helper/);
  assert.match(appSource, /Estimated spending required at age/);
});

test("forecast retains milestone cards while dashboard defaults to the compact view", () => {
  assert.match(appSource, /dashboard\.innerHTML = ""/);
  assert.match(appSource, /forecast\.innerHTML = html/);
});

test("weekly plan keeps live balance check inside completion step only", () => {
  assert.doesNotMatch(appSource, /weeklyLiveBalanceSummaryHtml\(week, "top"\)/);
  assert.match(appSource, /weeklyLiveBalanceSummaryHtml\(week, "complete"\)/);
  assert.match(appSource, /function weeklyBalanceSummaryBodyHtml/);
});

test("workspace navigation includes the prominent dashboard destinations", () => {
  assert.match(indexSource, /data-view="dashboard">Dashboard/);
  assert.match(indexSource, /data-view="weeklyplan">Weekly Plan/);
  assert.match(indexSource, /data-view="investments">Investments/);
  assert.match(indexSource, /data-view="goals">Goals/);
  assert.doesNotMatch(indexSource, /data-view="ai"|>AI Coach<\/button>/);
  assert.match(appSource, /data-engagement-action="ai">Ask a Question/);
  assert.match(appSource, /data-engagement-action="ai">See Full Insight/);
});
