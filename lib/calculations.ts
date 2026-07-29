import type {
  AmortisationMonth,
  CashflowSummary,
  DashboardModel,
  DecisionOption,
  Frequency,
  HouseholdModel,
  LoanInput,
  LoanSummary,
  LoanType,
  LoanWarning,
  Milestone,
  OffsetBenefit,
  RetirementSustainability,
  Status,
  SuperProjectionPoint,
  YearProjection,
} from "./types.ts";

export const DISCLAIMER = "This tool is for education and modelling only and is not financial advice.";

const MONTHS_PER_YEAR = 12;
const DEFAULT_TERM_MONTHS = 360;
const CHECKPOINT_YEARS = [5, 10, 20, 30] as const;

function cleanNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function nonNegative(value: number): number {
  return Math.max(0, cleanNumber(value));
}

function roundCurrency(value: number): number {
  return Math.round((cleanNumber(value) + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((cleanNumber(value) + Number.EPSILON) * 10000) / 10000;
}

function resolveTermMonths(input: Pick<LoanInput, "termMonths" | "termYears">): number {
  const rawMonths = input.termMonths ?? (input.termYears ? input.termYears * MONTHS_PER_YEAR : DEFAULT_TERM_MONTHS);
  return Math.max(0, Math.floor(cleanNumber(rawMonths)));
}

function addMonthsIso(startDate: string, months: number): string {
  const date = new Date(`${startDate}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function monthlyRate(annualRate: number): number {
  return cleanNumber(annualRate) / MONTHS_PER_YEAR;
}

function annualize(amount: number, frequency: Frequency): number {
  const value = cleanNumber(amount);
  if (frequency === "weekly") return value * 52;
  if (frequency === "fortnightly") return value * 26;
  if (frequency === "monthly") return value * 12;
  if (frequency === "quarterly") return value * 4;
  return value;
}

function balanceAtMonth(summary: LoanSummary, month: number): number {
  if (month <= 0) return summary.schedule[0]?.openingBalance ?? summary.finalBalance;
  const row = summary.schedule[month - 1];
  if (row) return row.closingBalance;
  return summary.finalBalance;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + cleanNumber(value), 0);
}

export function calculateOffsetBenefit(input: Pick<LoanInput, "principal" | "annualInterestRate" | "offsetBalance">): OffsetBenefit {
  const grossLoanBalance = nonNegative(input.principal);
  const offsetBalance = Math.min(nonNegative(input.offsetBalance ?? 0), grossLoanBalance);
  const effectiveLoanBalance = Math.max(grossLoanBalance - offsetBalance, 0);
  const annualInterestSaved = roundCurrency(offsetBalance * cleanNumber(input.annualInterestRate));

  return {
    grossLoanBalance,
    offsetBalance,
    effectiveLoanBalance,
    annualInterestSaved,
    taxFreeEquivalentReturn: offsetBalance > 0 ? roundRatio(annualInterestSaved / offsetBalance) : 0,
  };
}

export function amortiseLoan(input: LoanInput): { schedule: AmortisationMonth[]; warnings: LoanWarning[] } {
  const termMonths = resolveTermMonths(input);
  const offsetBalance = nonNegative(input.offsetBalance ?? 0);
  const monthlyRepayment = nonNegative(input.monthlyRepayment);
  const warnings: LoanWarning[] = [];
  const schedule: AmortisationMonth[] = [];
  let balance = roundCurrency(nonNegative(input.principal));

  if (termMonths === 0 || balance === 0) {
    return { schedule, warnings };
  }

  const firstEffectiveBalance = Math.max(balance - offsetBalance, 0);
  const firstMonthInterest = roundCurrency(firstEffectiveBalance * monthlyRate(input.annualInterestRate));
  if (monthlyRepayment <= firstMonthInterest) {
    warnings.push({
      code: "REPAYMENT_TOO_LOW",
      message: "Repayment too low: monthly repayment does not cover the first month's interest.",
    });
  }

  for (let month = 1; month <= termMonths && balance > 0; month += 1) {
    const openingBalance = balance;
    const effectiveLoanBalance = Math.max(openingBalance - offsetBalance, 0);
    const interestCharged = roundCurrency(effectiveLoanBalance * monthlyRate(input.annualInterestRate));
    let repayment = monthlyRepayment;
    let principalRepaid = roundCurrency(repayment - interestCharged);

    if (principalRepaid > openingBalance) {
      principalRepaid = openingBalance;
      repayment = roundCurrency(interestCharged + principalRepaid);
    }

    const closingBalance = roundCurrency(Math.max(0, openingBalance - principalRepaid));

    schedule.push({
      month,
      openingBalance,
      grossLoanBalance: openingBalance,
      offsetBalance,
      effectiveLoanBalance,
      interestCharged,
      repayment,
      principalRepaid,
      closingBalance,
    });

    balance = closingBalance;
  }

  if (balance > 0) {
    warnings.push({
      code: "LOAN_NOT_REPAID_WITHIN_TERM",
      message: "Loan balance remains after the entered loan term.",
    });
  }

  return { schedule, warnings };
}

export function calculateLoanSummary(input: LoanInput, modelStartDate = "2026-07-01"): LoanSummary {
  const amortisation = amortiseLoan(input);
  const termMonths = resolveTermMonths(input);
  const finalBalance = amortisation.schedule.length
    ? amortisation.schedule[amortisation.schedule.length - 1].closingBalance
    : roundCurrency(nonNegative(input.principal));
  const monthsToRepay = finalBalance === 0 ? amortisation.schedule.length : null;
  const balanceAtYears = CHECKPOINT_YEARS.reduce((acc, year) => {
    acc[year] = roundCurrency(balanceAtMonth({
      ...summaryShell(input),
      schedule: amortisation.schedule,
      finalBalance,
    }, year * MONTHS_PER_YEAR));
    return acc;
  }, {} as Record<5 | 10 | 20 | 30, number>);

  return {
    id: input.id,
    name: input.name ?? "Loan",
    type: input.type ?? "other",
    schedule: amortisation.schedule,
    warnings: amortisation.warnings,
    payoffDate: monthsToRepay === null ? null : addMonthsIso(modelStartDate, monthsToRepay),
    yearsToRepay: monthsToRepay === null ? null : roundRatio(monthsToRepay / MONTHS_PER_YEAR),
    totalInterestPaid: roundCurrency(sum(amortisation.schedule.map((month) => month.interestCharged))),
    totalPrincipalRepaid: roundCurrency(sum(amortisation.schedule.map((month) => Math.max(0, month.principalRepaid)))),
    totalRepayments: roundCurrency(sum(amortisation.schedule.map((month) => month.repayment))),
    finalBalance,
    balanceAtYears,
    offsetBenefit: calculateOffsetBenefit(input),
  };
}

function summaryShell(input: LoanInput): LoanSummary {
  return {
    id: input.id,
    name: input.name ?? "Loan",
    type: input.type ?? "other",
    schedule: [],
    warnings: [],
    payoffDate: null,
    yearsToRepay: null,
    totalInterestPaid: 0,
    totalPrincipalRepaid: 0,
    totalRepayments: 0,
    finalBalance: nonNegative(input.principal),
    balanceAtYears: { 5: 0, 10: 0, 20: 0, 30: 0 },
    offsetBenefit: calculateOffsetBenefit(input),
  };
}

export function calculateCashflow(model: HouseholdModel, loanSummaries: LoanSummary[]): CashflowSummary {
  const annualNetIncome = roundCurrency(sum(model.incomes.map((income) => annualize(income.amount, income.frequency))));
  const annualExpenses = roundCurrency(sum(model.expenses.map((expense) => annualize(expense.amount, expense.frequency))));
  const annualMortgageRepayments = roundCurrency(sum(
    loanSummaries
      .filter((loan) => loan.type === "homeLoan")
      .flatMap((loan) => loan.schedule.slice(0, MONTHS_PER_YEAR).map((month) => month.repayment)),
  ));
  const annualInvestmentContributions = roundCurrency(model.investing.annualInvestingTarget + model.investing.annualExtraSuper);
  const cashSurplusBeforeInvesting = roundCurrency(annualNetIncome - annualExpenses - annualMortgageRepayments);
  const cashSurplusAfterInvesting = roundCurrency(cashSurplusBeforeInvesting - annualInvestmentContributions);

  return {
    annualNetIncome,
    weeklyNetIncome: roundCurrency(annualNetIncome / 52),
    annualExpenses,
    weeklyExpenses: roundCurrency(annualExpenses / 52),
    annualMortgageRepayments,
    weeklyMortgageRepayments: roundCurrency(annualMortgageRepayments / 52),
    annualInvestmentContributions,
    weeklyInvestmentContributions: roundCurrency(annualInvestmentContributions / 52),
    annualEmployerSuper: model.investing.annualEmployerSuper,
    annualExtraSuper: model.investing.annualExtraSuper,
    cashSurplusBeforeInvesting,
    cashSurplusAfterInvesting,
  };
}

export function projectInvestments(input: {
  startingBalance: number;
  annualContribution: number;
  expectedReturn: number;
  projectionYears: number;
  currentAge: number;
  safeWithdrawalRate: number;
  additionalMonthlyContributions?: number[];
}): YearProjection[] {
  const monthlyReturn = monthlyRate(input.expectedReturn);
  let balance = roundCurrency(nonNegative(input.startingBalance));
  const rows: YearProjection[] = [];

  for (let year = 1; year <= input.projectionYears; year += 1) {
    const openingBalance = balance;
    let annualContribution = 0;
    let investmentGrowth = 0;

    for (let month = 1; month <= MONTHS_PER_YEAR; month += 1) {
      const absoluteMonth = (year - 1) * MONTHS_PER_YEAR + month;
      const contribution = nonNegative(input.annualContribution) / MONTHS_PER_YEAR
        + nonNegative(input.additionalMonthlyContributions?.[absoluteMonth - 1] ?? 0);
      balance = roundCurrency(balance + contribution);
      annualContribution = roundCurrency(annualContribution + contribution);
      const growth = roundCurrency(balance * monthlyReturn);
      balance = roundCurrency(balance + growth);
      investmentGrowth = roundCurrency(investmentGrowth + growth);
    }

    rows.push({
      year,
      age: input.currentAge + year,
      openingBalance,
      annualContribution,
      investmentGrowth,
      closingBalance: balance,
      passiveIncome: roundCurrency(balance * input.safeWithdrawalRate),
    });
  }

  return rows;
}

export function projectSuper(input: {
  startingBalance: number;
  annualEmployerContribution: number;
  annualExtraContribution: number;
  expectedReturn: number;
  projectionYears: number;
  currentAge: number;
  safeWithdrawalRate: number;
}): SuperProjectionPoint[] {
  const monthlyReturn = monthlyRate(input.expectedReturn);
  let balance = roundCurrency(nonNegative(input.startingBalance));
  const rows: SuperProjectionPoint[] = [];

  for (let year = 1; year <= input.projectionYears; year += 1) {
    const openingBalance = balance;
    let employerContribution = 0;
    let extraContribution = 0;
    let investmentGrowth = 0;

    for (let month = 1; month <= MONTHS_PER_YEAR; month += 1) {
      const employer = nonNegative(input.annualEmployerContribution) / MONTHS_PER_YEAR;
      const extra = nonNegative(input.annualExtraContribution) / MONTHS_PER_YEAR;
      balance = roundCurrency(balance + employer + extra);
      employerContribution = roundCurrency(employerContribution + employer);
      extraContribution = roundCurrency(extraContribution + extra);
      const growth = roundCurrency(balance * monthlyReturn);
      balance = roundCurrency(balance + growth);
      investmentGrowth = roundCurrency(investmentGrowth + growth);
    }

    rows.push({
      year,
      age: input.currentAge + year,
      openingBalance,
      annualContribution: roundCurrency(employerContribution + extraContribution),
      employerContribution,
      extraContribution,
      investmentGrowth,
      closingBalance: balance,
      passiveIncome: roundCurrency(balance * input.safeWithdrawalRate),
    });
  }

  return rows;
}

function projectionAtAge<T extends { age: number; closingBalance: number }>(projection: T[], age: number): T {
  return projection.find((row) => row.age >= age) ?? projection[projection.length - 1];
}

function milestoneStatus(projectedAssets: number, requiredCapital: number): Status {
  if (projectedAssets >= requiredCapital) return "green";
  if (projectedAssets >= requiredCapital * 0.8) return "yellow";
  return "red";
}

export function calculateRetirementMilestones(input: {
  model: HouseholdModel;
  investmentProjection: YearProjection[];
  superProjection: SuperProjectionPoint[];
}): Milestone[] {
  const { model, investmentProjection, superProjection } = input;
  const spending = model.goals.targetAnnualSpending;
  const safeWithdrawalRate = model.assumptions.safeWithdrawalRate;
  const milestoneInputs = [
    { name: "Work Optional" as const, targetAge: model.goals.workOptionalAge, spendingCoverage: 0.5 },
    { name: "Semi-Retirement" as const, targetAge: model.goals.semiRetirementAge, spendingCoverage: 0.75 },
    { name: "Full Retirement" as const, targetAge: model.goals.fullRetirementAge, spendingCoverage: 1 },
  ];

  return milestoneInputs.map((milestone) => {
    const investment = projectionAtAge(investmentProjection, milestone.targetAge);
    const superAtAge = projectionAtAge(superProjection, milestone.targetAge);
    const accessibleSuper = milestone.targetAge >= model.assumptions.preservationAge ? superAtAge.closingBalance : 0;
    const projectedFiAssets = roundCurrency(investment.closingBalance + accessibleSuper);
    const requiredCapital = roundCurrency((spending * milestone.spendingCoverage) / safeWithdrawalRate);

    return {
      name: milestone.name,
      targetAge: milestone.targetAge,
      projectedFiAssets,
      requiredCapital,
      passiveIncomeEstimate: roundCurrency(projectedFiAssets * safeWithdrawalRate),
      status: milestoneStatus(projectedFiAssets, requiredCapital),
    };
  });
}

function simulateRetirementModel(input: {
  model: "Capital Preserved" | "Capital Slowly Declines" | "Maximum Lifestyle";
  startingAge: number;
  startingBalance: number;
  expectedReturn: number;
  inflation: number;
  firstYearDraw: number;
}): RetirementSustainability {
  let balance = roundCurrency(input.startingBalance);
  const balances: Record<60 | 70 | 80 | 90, number> = {
    60: roundCurrency(balance),
    70: 0,
    80: 0,
    90: 0,
  };
  let moneyLasts = true;

  for (let age = input.startingAge + 1; age <= 90; age += 1) {
    const yearsFromStart = age - input.startingAge - 1;
    const draw = roundCurrency(input.firstYearDraw * Math.pow(1 + input.inflation, yearsFromStart));
    balance = roundCurrency((balance - draw) * (1 + input.expectedReturn));
    if (balance < 0) {
      moneyLasts = false;
      balance = 0;
    }
    if (age === 70 || age === 80 || age === 90) {
      balances[age] = roundCurrency(balance);
    }
  }

  return {
    model: input.model,
    startingAge: input.startingAge,
    annualIncomeDrawn: roundCurrency(input.firstYearDraw),
    moneyLasts,
    balances,
  };
}

function maximumLifestyleDraw(startingBalance: number, expectedReturn: number, inflation: number): number {
  const years = 30;
  const realReturn = ((1 + expectedReturn) / (1 + inflation)) - 1;
  const targetEndingBalance = startingBalance * 0.25;
  if (realReturn === 0) return roundCurrency((startingBalance - targetEndingBalance) / years);
  const annuityFactor = (1 - Math.pow(1 + realReturn, -years)) / realReturn;
  const targetPresentValue = targetEndingBalance / Math.pow(1 + realReturn, years);
  return roundCurrency((startingBalance - targetPresentValue) / annuityFactor);
}

export function calculateRetirementSustainability(input: {
  startingAge: number;
  startingBalance: number;
  targetAnnualSpending: number;
  expectedReturn: number;
  inflation: number;
  safeWithdrawalRate: number;
}): RetirementSustainability[] {
  const preservedDraw = roundCurrency(input.startingBalance * input.safeWithdrawalRate);
  const maximumDraw = maximumLifestyleDraw(input.startingBalance, input.expectedReturn, input.inflation);

  return [
    simulateRetirementModel({
      model: "Capital Preserved",
      startingAge: input.startingAge,
      startingBalance: input.startingBalance,
      expectedReturn: input.expectedReturn,
      inflation: input.inflation,
      firstYearDraw: preservedDraw,
    }),
    simulateRetirementModel({
      model: "Capital Slowly Declines",
      startingAge: input.startingAge,
      startingBalance: input.startingBalance,
      expectedReturn: input.expectedReturn,
      inflation: input.inflation,
      firstYearDraw: input.targetAnnualSpending,
    }),
    simulateRetirementModel({
      model: "Maximum Lifestyle",
      startingAge: input.startingAge,
      startingBalance: input.startingBalance,
      expectedReturn: input.expectedReturn,
      inflation: input.inflation,
      firstYearDraw: maximumDraw,
    }),
  ];
}

export function rankNextDollarOptions(input: {
  mortgageRate: number;
  expectedInvestmentReturn: number;
  expectedSuperReturn: number;
  taxRate: number;
  liquidityPreference: "low" | "medium" | "high";
}): DecisionOption[] {
  const liquidity = input.liquidityPreference === "high" ? 1 : input.liquidityPreference === "medium" ? 0.5 : 0;
  const concessionalSuperTaxRate = 0.15;
  const options: DecisionOption[] = [
    {
      option: "offset account",
      score: roundRatio(input.mortgageRate + liquidity * 0.01),
      explanation: "Guaranteed interest saving, keeps cash accessible, and the benefit is tax-free.",
    },
    {
      option: "extra mortgage repayment",
      score: roundRatio(input.mortgageRate - liquidity * 0.015),
      explanation: "Guaranteed interest saving, but less flexible than keeping money in the offset account.",
    },
    {
      option: "ETF/share investing",
      score: roundRatio(input.expectedInvestmentReturn * (1 - input.taxRate * 0.5) - 0.01 + liquidity * 0.004),
      explanation: "Higher expected long-term return, but market risk means the result is not guaranteed.",
    },
    {
      option: "extra super",
      score: roundRatio(input.expectedSuperReturn + Math.max(0, input.taxRate - concessionalSuperTaxRate) * 0.35 - liquidity * 0.025),
      explanation: "Potential tax benefit and compounding, but access is restricted until preservation age.",
    },
  ];

  return options.sort((a, b) => b.score - a.score);
}

export function calculateFinancialModel(model: HouseholdModel): DashboardModel {
  const currentAge = model.people[0]?.age ?? 0;
  const assetValue = (category: string) => sum(model.assets.filter((asset) => asset.category === category).map((asset) => asset.value));
  const offsetBalance = assetValue("offset");
  let remainingOffset = offsetBalance;
  const loanSummaries = model.loans.map((loan) => {
    const offsetForLoan = loan.type === "homeLoan" ? Math.min(loan.principal, loan.offsetBalance ?? remainingOffset) : loan.offsetBalance ?? 0;
    if (loan.type === "homeLoan") remainingOffset = Math.max(0, remainingOffset - offsetForLoan);
    return calculateLoanSummary({ ...loan, offsetBalance: offsetForLoan }, model.assumptions.modelStartDate);
  });
  const homeLoan = loanSummaries.find((loan) => loan.type === "homeLoan");
  const totalAssets = roundCurrency(sum(model.assets.map((asset) => asset.value)));
  const totalLiabilities = roundCurrency(sum(model.loans.map((loan) => loan.principal)));
  const currentNetWorth = roundCurrency(totalAssets - totalLiabilities);
  const financialIndependenceAssets = roundCurrency(assetValue("shares") + assetValue("crypto") + assetValue("super") + assetValue("offset"));
  const effectiveMortgageBalance = homeLoan?.offsetBenefit.effectiveLoanBalance ?? 0;
  const cashflow = calculateCashflow(model, loanSummaries);
  const annualMortgagePrincipalReduction = roundCurrency(sum(
    homeLoan?.schedule.slice(0, MONTHS_PER_YEAR).map((month) => Math.max(0, month.principalRepaid)) ?? [],
  ));
  const wealthCreationRate = roundCurrency(
    model.investing.annualInvestingTarget
    + model.investing.annualEmployerSuper
    + model.investing.annualExtraSuper
    + annualMortgagePrincipalReduction,
  );

  const projectionMonths = 30 * MONTHS_PER_YEAR;
  const freedMonthlyRepayments = Array.from({ length: projectionMonths }, (_, monthIndex) => {
    return sum(loanSummaries.map((loan) => {
      if (loan.yearsToRepay === null) return 0;
      const payoffMonth = Math.round(loan.yearsToRepay * MONTHS_PER_YEAR);
      return monthIndex + 1 > payoffMonth ? loan.schedule[0]?.repayment ?? 0 : 0;
    }));
  });

  const investmentProjection = projectInvestments({
    startingBalance: assetValue("shares") + assetValue("crypto"),
    annualContribution: model.investing.annualInvestingTarget,
    expectedReturn: model.assumptions.expectedInvestmentReturn,
    projectionYears: 30,
    currentAge,
    safeWithdrawalRate: model.assumptions.safeWithdrawalRate,
    additionalMonthlyContributions: freedMonthlyRepayments,
  });
  const superProjection = projectSuper({
    startingBalance: assetValue("super"),
    annualEmployerContribution: model.investing.annualEmployerSuper,
    annualExtraContribution: model.investing.annualExtraSuper,
    expectedReturn: model.assumptions.expectedSuperReturn,
    projectionYears: 30,
    currentAge,
    safeWithdrawalRate: model.assumptions.safeWithdrawalRate,
  });
  const milestones = calculateRetirementMilestones({ model, investmentProjection, superProjection });
  const retirementAge = model.goals.fullRetirementAge;
  const investmentAtRetirement = projectionAtAge(investmentProjection, retirementAge);
  const superAtRetirement = projectionAtAge(superProjection, retirementAge);
  const totalRetirementAssets = roundCurrency(investmentAtRetirement.closingBalance + superAtRetirement.closingBalance);
  const retirementSustainability = calculateRetirementSustainability({
    startingAge: retirementAge,
    startingBalance: totalRetirementAssets,
    targetAnnualSpending: model.goals.targetAnnualSpending,
    expectedReturn: model.assumptions.expectedInvestmentReturn,
    inflation: model.assumptions.inflation,
    safeWithdrawalRate: model.assumptions.safeWithdrawalRate,
  });
  const fullRequiredCapital = model.goals.targetAnnualSpending / model.assumptions.safeWithdrawalRate;
  const financialFreedomScore = Math.min(100, roundRatio((financialIndependenceAssets / fullRequiredCapital) * 100));
  const decisionOptions = rankNextDollarOptions({
    mortgageRate: model.loans.find((loan) => loan.type === "homeLoan")?.annualInterestRate ?? 0,
    expectedInvestmentReturn: model.assumptions.expectedInvestmentReturn,
    expectedSuperReturn: model.assumptions.expectedSuperReturn,
    taxRate: model.assumptions.taxRate,
    liquidityPreference: model.assumptions.liquidityPreference,
  });
  const netWorthProjection = investmentProjection.map((investmentRow, index) => {
    const year = index + 1;
    const superRow = superProjection[index];
    const homeValue = assetValue("home") * Math.pow(1 + model.assumptions.propertyGrowth, year);
    const vehicleValue = assetValue("vehicle");
    const loanBalance = homeLoan ? balanceAtMonth(homeLoan, year * MONTHS_PER_YEAR) : 0;
    const closingBalance = roundCurrency(homeValue + vehicleValue + offsetBalance + investmentRow.closingBalance + superRow.closingBalance - loanBalance);
    return {
      year,
      age: currentAge + year,
      openingBalance: year === 1 ? currentNetWorth : 0,
      annualContribution: wealthCreationRate,
      investmentGrowth: 0,
      closingBalance,
      passiveIncome: roundCurrency(closingBalance * model.assumptions.safeWithdrawalRate),
    };
  });

  return {
    currentNetWorth,
    financialIndependenceAssets,
    effectiveMortgageBalance,
    annualNetIncome: cashflow.annualNetIncome,
    annualExpenses: cashflow.annualExpenses,
    annualCashSurplus: cashflow.cashSurplusAfterInvesting,
    wealthCreationRate,
    financialFreedomScore,
    loanSummaries,
    cashflow,
    investmentProjection,
    superProjection,
    milestones,
    retirementSustainability,
    decisionOptions,
    netWorthProjection,
    taxBenefitFromExtraSuper: roundCurrency(model.investing.annualExtraSuper * Math.max(0, model.assumptions.taxRate - model.assumptions.concessionalSuperTaxRate)),
    totalRetirementAssets,
  };
}
