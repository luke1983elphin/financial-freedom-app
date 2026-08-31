export type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";

export type AssetCategory =
  | "home"
  | "offset"
  | "shares"
  | "crypto"
  | "super"
  | "vehicle"
  | "other";

export type LoanType = "homeLoan" | "investmentLoan" | "personalLoan" | "creditCard" | "other";

export type Status = "green" | "yellow" | "red";

export type IncomeInput = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
};

export type ExpenseInput = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
};

export type AssetInput = {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
};

export type LoanInput = {
  id?: string;
  name?: string;
  type?: LoanType;
  principal: number;
  annualInterestRate: number;
  monthlyRepayment: number;
  termMonths?: number;
  termYears?: number;
  offsetBalance?: number;
};

export type HouseholdGoals = {
  workOptionalAge: number;
  semiRetirementAge: number;
  fullRetirementAge: number;
  targetAnnualSpending: number;
};

export type ModelAssumptions = {
  modelStartDate: string;
  expectedInvestmentReturn: number;
  expectedSuperReturn: number;
  propertyGrowth: number;
  inflation: number;
  safeWithdrawalRate: number;
  taxRate: number;
  concessionalSuperTaxRate: number;
  preservationAge: number;
  retirementAge: number;
  liquidityPreference: "low" | "medium" | "high";
};

export type InvestingInputs = {
  annualInvestingTarget: number;
  annualEmployerSuper: number;
  annualExtraSuper: number;
};

export type HouseholdModel = {
  householdName: string;
  people: { name: string; age: number }[];
  goals: HouseholdGoals;
  assets: AssetInput[];
  loans: LoanInput[];
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  investing: InvestingInputs;
  assumptions: ModelAssumptions;
};

export type LoanWarningCode = "REPAYMENT_TOO_LOW" | "LOAN_NOT_REPAID_WITHIN_TERM";

export type LoanWarning = {
  code: LoanWarningCode;
  message: string;
};

export type AmortisationMonth = {
  month: number;
  openingBalance: number;
  grossLoanBalance: number;
  offsetBalance: number;
  effectiveLoanBalance: number;
  interestCharged: number;
  repayment: number;
  principalRepaid: number;
  closingBalance: number;
};

export type OffsetBenefit = {
  grossLoanBalance: number;
  offsetBalance: number;
  effectiveLoanBalance: number;
  annualInterestSaved: number;
  taxFreeEquivalentReturn: number;
};

export type LoanSummary = {
  id?: string;
  name: string;
  type: LoanType;
  schedule: AmortisationMonth[];
  warnings: LoanWarning[];
  payoffDate: string | null;
  yearsToRepay: number | null;
  totalInterestPaid: number;
  totalPrincipalRepaid: number;
  totalRepayments: number;
  finalBalance: number;
  balanceAtYears: Record<5 | 10 | 20 | 30, number>;
  offsetBenefit: OffsetBenefit;
};

export type CashflowSummary = {
  annualNetIncome: number;
  weeklyNetIncome: number;
  annualExpenses: number;
  weeklyExpenses: number;
  annualMortgageRepayments: number;
  weeklyMortgageRepayments: number;
  annualInvestmentContributions: number;
  weeklyInvestmentContributions: number;
  annualEmployerSuper: number;
  annualExtraSuper: number;
  cashSurplusBeforeInvesting: number;
  cashSurplusAfterInvesting: number;
};

export type YearProjection = {
  year: number;
  age: number;
  openingBalance: number;
  annualContribution: number;
  investmentGrowth: number;
  closingBalance: number;
  passiveIncome: number;
};

export type SuperProjectionPoint = YearProjection & {
  employerContribution: number;
  extraContribution: number;
};

export type Milestone = {
  name: "Work Optional" | "Semi-Retirement" | "Full Retirement";
  targetAge: number;
  projectedFiAssets: number;
  requiredCapital: number;
  passiveIncomeEstimate: number;
  status: Status;
};

export type RetirementModelName =
  | "Capital Preserved"
  | "Capital Slowly Declines"
  | "Maximum Lifestyle";

export type RetirementSustainability = {
  model: RetirementModelName;
  startingAge: number;
  annualIncomeDrawn: number;
  moneyLasts: boolean;
  balances: Record<60 | 70 | 80 | 90, number>;
};

export type DecisionOption = {
  option: "extra super" | "ETF/share investing" | "offset account" | "extra mortgage repayment";
  score: number;
  explanation: string;
};

export type DashboardModel = {
  currentNetWorth: number;
  financialIndependenceAssets: number;
  effectiveMortgageBalance: number;
  annualNetIncome: number;
  annualExpenses: number;
  annualCashSurplus: number;
  wealthCreationRate: number;
  financialFreedomScore: number;
  loanSummaries: LoanSummary[];
  cashflow: CashflowSummary;
  investmentProjection: YearProjection[];
  superProjection: SuperProjectionPoint[];
  milestones: Milestone[];
  retirementSustainability: RetirementSustainability[];
  decisionOptions: DecisionOption[];
  netWorthProjection: YearProjection[];
  taxBenefitFromExtraSuper: number;
  totalRetirementAssets: number;
};
