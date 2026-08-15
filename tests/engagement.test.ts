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
  assert.match(indexSource, /data-engagement-action="ai">AI Coach/);
});

test("F2 dashboard stage card updates the visible Dashboard card, not a hidden setup card", () => {
  assert.match(appSource, /const dashboardPanel = document\.querySelector\('\[data-view-panel="dashboard"\]'\)/);
  assert.match(appSource, /const dashboardStageCard = dashboardPanel\?\.querySelector\("\.freedom-stage-card"\)/);
  assert.match(appSource, /if \(dashboardStageCard\) dashboardStageCard\.innerHTML = `/);
  assert.doesNotMatch(appSource, /document\.querySelector\("\.freedom-stage-card"\)\.innerHTML/);
});

test("F2 opening balance input uses the same actual amount interaction path as other weekly fields", () => {
  assert.match(appSource, /weeklyActualField\(week, "openingBalance", "Actual opening bank balance"/);
  assert.match(appSource, /data-weekly-actual="\$\{escapeHtml\(key\)\}"/);
  assert.match(appSource, /data-weekly-opening-balance="\$\{week\.weekNumber\}"/);
  assert.match(appSource, /function updateWeeklyActualDraftFromInput/);
  assert.match(appSource, /refreshWeeklyActualClosingDisplay\(weekNumber\)/);
});

test("F2 opening balance editor is not hidden behind a native details disclosure", () => {
  assert.doesNotMatch(appSource, /<summary>Update opening balance<\/summary>/);
  assert.match(appSource, /weekly-opening-adjustment mt-4/);
  assert.match(appSource, /Save opening balance/);
});

test("F2 Home and workspace views are mutually exclusive in the primary layout", () => {
  assert.match(appSource, /function setHomeWorkspaceVisibility\(workspaceVisible\)/);
  assert.match(appSource, /home\.classList\.toggle\("hidden", workspaceVisible\)/);
  assert.match(appSource, /workspace\.classList\.toggle\("hidden", !workspaceVisible\)/);
  assert.match(appSource, /home\.setAttribute\("aria-hidden", workspaceVisible \? "true" : "false"\)/);
  assert.match(appSource, /workspace\.setAttribute\("aria-hidden", workspaceVisible \? "false" : "true"\)/);
});

test("F2 render output restores Home or workspace visibility after rerenders", () => {
  assert.match(appSource, /setHomeWorkspaceVisibility\(Boolean\(hasOpenedWorkspace\)\)/);
  assert.match(appSource, /function showHomeView\(options = \{\}\)/);
  assert.match(appSource, /if \(target === "home"\)/);
});

test("F2 dashboard readiness recognises structured income records", () => {
  assert.match(appSource, /function hasIncomeCollectionValue\(items\)/);
  assert.match(appSource, /\["amount", "annualAmount"\]/);
  assert.match(appSource, /const hasIncome = hasIncomeCollectionValue\(planCandidate\.incomeItems\)/);
});

test("F2 dashboard readiness does not force debt on valid no-debt plans", () => {
  assert.match(appSource, /hasDebtData \|\| positiveNumber\(result\.annualDebtRepayments\) \|\| result\.totalLiabilities === 0/);
  assert.match(appSource, /hasDebtData \|\| result\.totalLiabilities === 0/);
});

test("F2 mobile weekly stepper exposes all five steps without document-level horizontal scrolling", () => {
  assert.match(appSource, /const weeklyStepOrder = \["opening", "income", "bills", "transfers", "complete"\]/);
  assert.match(indexSource + appSource, /Savings & Transfers/);
  assert.match(indexSource + appSource, /Complete Week/);
  assert.match(readFileSync(new URL("../styles.css", import.meta.url), "utf8"), /@media \(max-width: 560px\)[\s\S]*\.weekly-step-nav \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*overflow-x: visible;/);
  assert.match(readFileSync(new URL("../styles.css", import.meta.url), "utf8"), /\.weekly-step-button:nth-child\(5\) \{[\s\S]*grid-column: 1 \/ -1;/);
});

test("F2 normal production console output does not include weekly render debug logs", () => {
  assert.match(appSource, /const DEBUG_WEEKLY_PLAN = window\.FFS_DEBUG_WEEKLY_PLAN === true/);
  assert.match(appSource, /if \(DEBUG_WEEKLY_PLAN\) console\.info\(`Weekly Plan editor build:/);
  assert.match(appSource, /if \(DEBUG_WEEKLY_PLAN\) console\.info\(`Weekly Plan render count:/);
  assert.doesNotMatch(appSource, /const APP_VERSION = "3\.0-test-weekly-planner"/);
});
