export const engagementJourneyStages = [
  "Getting Started",
  "Building Stability",
  "Emergency Ready",
  "Reducing Debt",
  "Building Wealth",
  "Growing Investment Income",
  "Approaching Independence",
  "Financial Independence",
  "Financial Freedom",
] as const;

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function calculateLifestyleFundingPercentage(input: {
  financialIndependenceAssets: number;
  safeWithdrawalRatePct: number;
  targetAnnualLifestyleSpending: number;
}): { rawPercent: number; displayPercent: number; sustainableAnnualIncome: number } {
  const assets = Math.max(0, Number(input.financialIndependenceAssets) || 0);
  const withdrawalRate = Math.max(0, Number(input.safeWithdrawalRatePct) || 0) / 100;
  const targetSpending = Math.max(0, Number(input.targetAnnualLifestyleSpending) || 0);
  const sustainableAnnualIncome = assets * withdrawalRate;
  const rawPercent = targetSpending > 0 ? (sustainableAnnualIncome / targetSpending) * 100 : 0;
  return {
    rawPercent,
    displayPercent: clampPercent(rawPercent),
    sustainableAnnualIncome,
  };
}

export function calculateGoalProgress(input: {
  currentAmount: number;
  targetAmount: number;
}): { rawPercent: number; displayPercent: number; remainingAmount: number } {
  const currentAmount = Math.max(0, Number(input.currentAmount) || 0);
  const targetAmount = Math.max(0, Number(input.targetAmount) || 0);
  const rawPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
  return {
    rawPercent,
    displayPercent: clampPercent(rawPercent),
    remainingAmount: Math.max(0, targetAmount - currentAmount),
  };
}

export function calculateWeeklyStreak(completedWeekNumbers: number[]): number {
  const weeks = [...new Set(completedWeekNumbers.map((week) => Math.round(Number(week))).filter((week) => week > 0))]
    .sort((a, b) => b - a);
  if (!weeks.length) return 0;
  let streak = 1;
  for (let index = 1; index < weeks.length; index += 1) {
    if (weeks[index] === weeks[index - 1] - 1) streak += 1;
    else break;
  }
  return streak;
}

export function deriveJourneyStage(input: {
  hasPlanData: boolean;
  finalProjectedCashSurplus: number;
  emergencyMonths: number;
  investmentBalance: number;
  annualInvestmentContributions: number;
  totalLiabilities: number;
  totalAssets: number;
  financialIndependenceProgressPct: number;
  financialFreedomProgressPct: number;
}): typeof engagementJourneyStages[number] {
  if (!input.hasPlanData) return "Getting Started";
  if ((Number(input.financialFreedomProgressPct) || 0) >= 100) return "Financial Freedom";
  if ((Number(input.financialIndependenceProgressPct) || 0) >= 100) return "Financial Independence";
  if ((Number(input.financialIndependenceProgressPct) || 0) >= 75) return "Approaching Independence";
  if ((Number(input.financialIndependenceProgressPct) || 0) >= 40) return "Growing Investment Income";
  if ((Number(input.investmentBalance) || 0) > 0 || (Number(input.annualInvestmentContributions) || 0) > 0) return "Building Wealth";
  if ((Number(input.totalLiabilities) || 0) > 0 && (Number(input.totalAssets) || 0) > 0) return "Reducing Debt";
  if ((Number(input.emergencyMonths) || 0) >= 3) return "Emergency Ready";
  if ((Number(input.finalProjectedCashSurplus) || 0) > 0 || (Number(input.emergencyMonths) || 0) > 0) return "Building Stability";
  return "Getting Started";
}
