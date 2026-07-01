(function bootFinancialFreedomApp() {
  const DATA = window.FFS_DATA;
  const CALC = window.FFSCalculator;
  const DRAFT_KEY = "ffs-current-plan-v3-mobile-dashboard-ux-test";
  const SCENARIO_KEY = "ffs-scenarios-v3-mobile-dashboard-ux-test";
  const frequencies = [
    ["weekly", "Weekly"],
    ["fortnightly", "Fortnightly"],
    ["monthly", "Monthly"],
    ["quarterly", "Quarterly"],
    ["annually", "Annually"],
  ];
  const wizardSteps = [
    {
      title: "About You",
      instruction: "Start with the household names and ages so the plan has the right personal context.",
    },
    {
      title: "Income",
      instruction: "Add each income source with its own name, amount and frequency.",
    },
    {
      title: "Assets",
      instruction: "Enter what the household owns today, including cash, investments, super and property.",
    },
    {
      title: "Liabilities / Loans",
      instruction: "Add the home loan, offset balance and other debts so repayments and interest can be modelled.",
    },
    {
      title: "Expenses",
      instruction: "Enter each spending item with its own amount and frequency.",
    },
    {
      title: "Goals",
      instruction: "Set target spending, assumptions and optional downsizing details.",
    },
    {
      title: "Results / Dashboard",
      instruction: "Review your Financial Freedom Progress and the next milestone.",
    },
  ];
  const assetCategoryOptions = [
    ["home", "Home"],
    ["otherProperty", "Other property"],
    ["offset", "Offset account"],
    ["cash", "Cash"],
    ["shares", "Shares / ETFs"],
    ["crypto", "Crypto"],
    ["super", "Super"],
    ["vehicle", "Vehicles / personal assets"],
  ];
  const liabilityTypeOptions = [
    ["homeLoan", "Home loan"],
    ["hecsHelp", "HECS / HELP"],
    ["creditCard", "Credit Card"],
    ["otherDebt", "Other debt"],
  ];
  const expenseCategoryOptions = [
    ["living", "Living costs"],
    ["food", "Food"],
    ["utilities", "Utilities"],
    ["insurance", "Insurance"],
    ["schoolChildren", "School / children"],
    ["ratesPropertyCosts", "Rates / property costs"],
    ["subscriptions", "Monthly Subscriptions"],
    ["phoneInternet", "Phone / Internet"],
    ["privateHealth", "Private Health Insurance"],
    ["petrol", "Petrol"],
    ["vehicleCosts", "Motor Vehicle Rego / Insurance"],
    ["other", "Other expenses"],
  ];
  const coreExpenseCategories = new Set(["living", "food", "utilities", "insurance", "schoolChildren", "ratesPropertyCosts"]);
  const defaultOtherExpenseItems = [
    { id: "expense-subscriptions", name: "Monthly subscriptions", category: "subscriptions", amount: 0, frequency: "monthly" },
    { id: "expense-phone", name: "Phone / Internet", category: "phoneInternet", amount: 0, frequency: "monthly" },
    { id: "expense-health", name: "Private health insurance", category: "privateHealth", amount: 0, frequency: "monthly" },
    { id: "expense-petrol", name: "Petrol", category: "petrol", amount: 0, frequency: "weekly" },
    { id: "expense-vehicle", name: "Motor vehicle rego / insurance", category: "vehicleCosts", amount: 0, frequency: "annually" },
  ];
  const comparisonDefaults = {
    incomeChange: 0,
    expenseChange: 0,
    loanRepaymentChangeMonthly: 0,
    loanInterestRateChangePct: 0,
    investmentContributionChange: 0,
    investmentReturnChangePct: 0,
    superContributionChange: 0,
    extraConcessionalSuperChange: 0,
    helpBalanceChange: 0,
    oneOffCosts: 0,
    oneOffSavings: 0,
  };
  const whatIfActions = [
    { id: "invest-100", label: "Invest an extra $100/week", adjustments: () => ({ investmentContributionChange: 5200 }) },
    { id: "invest-250", label: "Invest an extra $250/week", adjustments: () => ({ investmentContributionChange: 13000 }) },
    { id: "debt-500", label: "Pay an extra $500/month off debt", adjustments: () => ({ loanRepaymentChangeMonthly: 500 }) },
    { id: "income-5", label: "Increase income by 5%", adjustments: (result) => ({ incomeChange: Math.round(result.annualNetIncome * 0.05) }) },
    { id: "expenses-500", label: "Reduce expenses by $500/month", adjustments: () => ({ expenseChange: -6000 }) },
    { id: "super-10000", label: "Add $10,000 concessional super", adjustments: () => ({ extraConcessionalSuperChange: 10000 }) },
    { id: "car-50000", label: "Buy a $50,000 car", adjustments: () => ({ oneOffCosts: 50000 }) },
    { id: "four-days", label: "Work 4 days per week", adjustments: (result) => ({ incomeChange: -Math.round(result.annualNetIncome * 0.2) }) },
  ];

  let plan = CALC.clonePlan(loadDraft() || CALC.emptyPlan());
  let activeView = "dashboard";
  let activeWizardStep = 0;
  let hasOpenedWorkspace = Boolean(loadDraft());
  let activeWhatIfId = whatIfActions[0].id;

  const currency = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });

  function money(value) {
    return currency.format(Number.isFinite(Number(value)) ? Number(value) : 0);
  }

  function compactMoney(value) {
    const number = Number.isFinite(Number(value)) ? Number(value) : 0;
    if (Math.abs(number) >= 1000000) return `$${(number / 1000000).toFixed(1)}m`;
    if (Math.abs(number) >= 1000) return `$${Math.round(number / 1000)}k`;
    return money(number);
  }

  function percentFromRatio(value) {
    return `${((Number(value) || 0) * 100).toFixed(1)}%`;
  }

  function percentScore(value) {
    return `${Math.round(Number(value) || 0)}%`;
  }

  function plainPercent(value) {
    return `${Math.round(Number(value) || 0)}%`;
  }

  function dollarsPerDollar(value) {
    return `$${(Number(value) || 0).toFixed(2)}`;
  }

  const freedomStages = [
    {
      min: 0,
      nextAt: 25,
      name: "Foundation",
      explanation: "Low emergency savings or high debt.",
    },
    {
      min: 25,
      nextAt: 50,
      name: "Building Momentum",
      explanation: "Positive cashflow with growing investments.",
    },
    {
      min: 50,
      nextAt: 75,
      name: "Accelerating Wealth",
      explanation: "Investment growth is compounding and net worth is increasing strongly.",
    },
    {
      min: 75,
      nextAt: 100,
      name: "Financial Independence",
      explanation: "Investments are projected to cover a significant portion of future lifestyle costs.",
    },
    {
      min: 100,
      nextAt: null,
      name: "Financial Freedom",
      explanation: "Investments are projected to fully support the chosen lifestyle over the long term.",
    },
  ];

  function freedomPercent(result) {
    if (!result.targetCapital) return 0;
    return (Number(result.financialIndependenceAssets) || 0) / result.targetCapital * 100;
  }

  function currentFreedomStage(percent) {
    return [...freedomStages].reverse().find((stage) => percent >= stage.min) || freedomStages[0];
  }

  function safeWithdrawalRate() {
    return (Number(plan.investing.safeWithdrawalRatePct) || 0) / 100;
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function annualValue(amount, frequency) {
    return CALC.annualize(Number(amount) || 0, frequency || "annually");
  }

  function optionList(options, selected) {
    return options.map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
  }

  function addAmount(value, delta, min = 0) {
    return Math.max(min, (Number(value) || 0) + (Number(delta) || 0));
  }

  function applyScenarioAdjustments(basePlan, adjustments = {}) {
    const scenarioPlan = CALC.clonePlan(basePlan);
    const incomeChange = Number(adjustments.incomeChange) || 0;
    const expenseChange = (Number(adjustments.expenseChange) || 0) + (Number(adjustments.otherExpenseAnnualChange) || 0);
    const repaymentChange = Number(adjustments.loanRepaymentChangeMonthly) || 0;
    const loanRateChange = Number(adjustments.loanInterestRateChangePct) || 0;
    const helpBalanceChange = Number(adjustments.helpBalanceChange) || 0;
    const cashChange = (Number(adjustments.oneOffSavings) || 0) - (Number(adjustments.oneOffCosts) || 0);
    scenarioPlan.income.otherIncome = addAmount(scenarioPlan.income.otherIncome, incomeChange, -Infinity);
    if (incomeChange && Array.isArray(scenarioPlan.incomeItems)) {
      scenarioPlan.incomeItems.push({ id: makeId("scenario-income"), name: "Scenario income change", amount: incomeChange, frequency: "annually" });
    }
    scenarioPlan.expenses.otherExpenses = addAmount(scenarioPlan.expenses.otherExpenses, expenseChange, -Infinity);
    if (expenseChange && Array.isArray(scenarioPlan.expenseItems)) {
      scenarioPlan.expenseItems.push({ id: makeId("scenario-expense"), name: "Scenario expense change", category: "other", amount: expenseChange, frequency: "annually" });
    }
    scenarioPlan.liabilities.monthlyRepayment = addAmount(scenarioPlan.liabilities.monthlyRepayment, repaymentChange);
    scenarioPlan.expenses.mortgageRepayments = scenarioPlan.liabilities.monthlyRepayment;
    scenarioPlan.liabilities.homeLoanInterestRatePct = addAmount(scenarioPlan.liabilities.homeLoanInterestRatePct, loanRateChange);
    if (Array.isArray(scenarioPlan.liabilityItems)) {
      scenarioPlan.liabilityItems = scenarioPlan.liabilityItems.map((item) => {
        if (item.type === "homeLoan") {
          return { ...item, repayment: addAmount(item.repayment, repaymentChange), interestRatePct: addAmount(item.interestRatePct, loanRateChange) };
        }
        if (item.type === "hecsHelp") {
          return { ...item, balance: addAmount(item.balance, helpBalanceChange) };
        }
        return item;
      });
    }
    scenarioPlan.investing.annualInvestingTarget = addAmount(scenarioPlan.investing.annualInvestingTarget, adjustments.investmentContributionChange || adjustments.annualInvestingTarget || 0);
    scenarioPlan.investing.expectedInvestmentReturnPct = addAmount(scenarioPlan.investing.expectedInvestmentReturnPct, adjustments.investmentReturnChangePct || 0);
    scenarioPlan.investing.employerSuperContributions = addAmount(scenarioPlan.investing.employerSuperContributions, adjustments.superContributionChange || 0);
    scenarioPlan.investing.extraSuperContributions = addAmount(scenarioPlan.investing.extraSuperContributions, adjustments.extraConcessionalSuperChange || 0);
    scenarioPlan.liabilities.hecsHelpDebt = addAmount(scenarioPlan.liabilities.hecsHelpDebt, helpBalanceChange);
    scenarioPlan.assets.cash = addAmount(scenarioPlan.assets.cash, cashChange, -Infinity);
    if (cashChange && Array.isArray(scenarioPlan.assetItems)) {
      const cashItem = scenarioPlan.assetItems.find((item) => item.category === "cash");
      if (cashItem) cashItem.value = addAmount(cashItem.value, cashChange, -Infinity);
    }
    return scenarioPlan;
  }

  function buildComparisonPlan() {
    return applyScenarioAdjustments(plan, plan.comparison || {});
  }

  function estimatedCashflow(result) {
    return Number(result.cashSurplusAfterTaxHelpAndInvesting) || 0;
  }

  function netWorthAtYear(result, year) {
    return result.netWorthProjection[Math.max(0, year - 1)]?.closingBalance || result.currentNetWorth;
  }

  function investmentAtYear(result, year) {
    return result.investmentProjection[Math.max(0, year - 1)]?.closingBalance || 0;
  }

  function superAtYear(result, year) {
    return result.superProjection[Math.max(0, year - 1)]?.closingBalance || result.superannuationBalance || 0;
  }

  function loanBalanceAtYear(result, year) {
    const monthIndex = year * 12 - 1;
    return result.loan.schedule[Math.max(0, monthIndex)]?.closingBalance ?? result.loan.finalBalance ?? 0;
  }

  function longTermNetWorth(result) {
    return result.netWorthProjection.at(-1)?.closingBalance || result.currentNetWorth;
  }

  function targetAgeOutcome(result) {
    if (!result.targetCapital) return "Set target";
    const match = result.financialFreedomProgressProjection.find((row) => row.progress >= 100);
    return match ? `Age ${match.age}` : "Beyond 30 years";
  }

  function estimateDateFromYear(year) {
    if (!year) return "";
    const date = new Date();
    date.setMonth(date.getMonth() + Math.max(1, Math.round(year * 12)));
    return date.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
  }

  function investmentTargetMilestone(result) {
    const targetGoal = Array.isArray(plan.goalItems)
      ? plan.goalItems.find((goal) => /investment/i.test(goal.name || "") && Number(goal.target) > result.investmentBalance)
      : null;
    const target = Number(targetGoal?.target) || Math.max(300000, Math.ceil((result.investmentBalance + 100000) / 50000) * 50000);
    const row = result.investmentProjection.find((item) => item.closingBalance >= target);
    return {
      amount: `${money(target)}`,
      text: row
        ? `Investment portfolio reaches ${money(target)}. Estimated ${estimateDateFromYear(row.year)}.`
        : `${money(Math.max(0, target - result.investmentBalance))} more invested to reach ${money(target)}.`,
      shortText: row ? `${money(target)} by ${estimateDateFromYear(row.year)}` : `${money(target)} target`,
    };
  }

  function highestRecommendation(result) {
    const top = result.decisionOptions[0];
    if (!top) return "Load the demo or start a plan to see your next best step.";
    if (top.label === "Extra super") return "Consider extra super: the model shows a strong estimated tax and long-term wealth benefit.";
    if (top.label === "Offset account") return "Consider offset savings: it may reduce interest while keeping cash accessible.";
    if (top.label === "ETF/share investing") return "Consider investing more: it may improve long-term growth while staying accessible.";
    return "Consider extra debt repayments: it may reduce interest and strengthen your balance sheet.";
  }

  function celebrationItems(result) {
    const monthlySurplus = estimatedCashflow(result) / 12;
    const invested = (Number(plan.assets.sharesEtfs) || 0) + (Number(plan.assets.crypto) || 0);
    const emergencyTarget = Math.max(1, result.annualExpenses / 4);
    return [
      { label: "Emergency fund started", active: (Number(plan.assets.cash) || 0) > 0 },
      { label: "Emergency fund complete", active: (Number(plan.assets.cash) || 0) >= emergencyTarget },
      { label: "First $100,000 invested", active: invested >= 100000 },
      { label: "Investments exceed annual salary", active: invested >= result.annualNetIncome && result.annualNetIncome > 0 },
      { label: "Debt below 50% of assets", active: result.totalAssets > 0 && result.totalLiabilities <= result.totalAssets * 0.5 },
      { label: "Super exceeds $250,000", active: result.superannuationBalance >= 250000 },
      { label: "Super exceeds $500,000", active: result.superannuationBalance >= 500000 },
      { label: "Positive monthly surplus", active: monthlySurplus > 0 },
    ].filter((item) => item.active);
  }

  function scenarioScore(metrics) {
    return metrics.longTermNetWorth
      + metrics.oneYearNetWorth * 0.1
      + metrics.twoYearNetWorth * 0.15
      + metrics.investmentBalance * 0.25
      + metrics.superBalance * 0.2
      + metrics.debtReduction * 0.3
      + Math.max(-100000, metrics.annualCashflow) * 2;
  }

  function ensureCollectionData() {
    if (!Array.isArray(plan.incomeItems)) {
      plan.incomeItems = [
        { id: "income-person-1", name: plan.income.person1IncomeName || "Person 1 income", amount: plan.income.person1Income || 0, frequency: plan.income.person1Frequency || "fortnightly" },
        { id: "income-person-2", name: plan.income.person2IncomeName || "Person 2 income", amount: plan.income.person2Income || 0, frequency: plan.income.person2Frequency || "fortnightly" },
        { id: "income-other", name: plan.income.otherIncomeName || "Other Income", amount: plan.income.otherIncome || 0, frequency: plan.income.otherIncomeFrequency || "annually" },
      ];
    }
    if (!Array.isArray(plan.assetItems)) {
      plan.assetItems = [
        { id: "asset-home", name: "Home", category: "home", value: plan.assets.homeValue || 0 },
        { id: "asset-other-property", name: "Other property", category: "otherProperty", value: plan.assets.otherPropertyValue || 0 },
        { id: "asset-offset", name: "Offset account", category: "offset", value: plan.assets.offsetBalance || 0 },
        { id: "asset-cash", name: "Cash", category: "cash", value: plan.assets.cash || 0 },
        { id: "asset-shares", name: "Shares / ETFs", category: "shares", value: plan.assets.sharesEtfs || 0 },
        { id: "asset-crypto", name: "Crypto", category: "crypto", value: plan.assets.crypto || 0 },
        { id: "asset-super-1", name: "Super person 1", category: "super", value: plan.assets.superPerson1 || 0 },
        { id: "asset-super-2", name: "Super person 2", category: "super", value: plan.assets.superPerson2 || 0 },
        { id: "asset-vehicles", name: "Vehicles / personal assets", category: "vehicle", value: plan.assets.vehiclesPersonalAssets || 0 },
      ];
    }
    if (!Array.isArray(plan.liabilityItems)) {
      plan.liabilityItems = [
        {
          id: "liability-home-loan",
          name: "Home loan",
          type: "homeLoan",
          balance: plan.liabilities.homeLoanBalance || 0,
          interestRatePct: plan.liabilities.homeLoanInterestRatePct || 0,
          repayment: plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments || 0,
          repaymentFrequency: "monthly",
          termYears: plan.liabilities.remainingLoanTermYears || 0,
        },
        { id: "liability-hecs", name: "HECS / HELP", type: "hecsHelp", balance: plan.liabilities.hecsHelpDebt || 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0 },
        { id: "liability-credit-card", name: "Credit Card", type: "creditCard", balance: plan.liabilities.creditCardBalance || 0, interestRatePct: plan.liabilities.creditCardInterestRatePct || 19.99, repayment: plan.liabilities.creditCardMonthlyRepayment || 0, repaymentFrequency: "monthly", termYears: 0, creditLimit: plan.liabilities.creditCardLimit || 0 },
        { id: "liability-other", name: "Other debts", type: "otherDebt", balance: plan.liabilities.otherDebts || 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0 },
      ];
    }
    if (!plan.liabilityItems.some((item) => item.type === "creditCard")) {
      plan.liabilityItems.push({ id: "liability-credit-card", name: "Credit Card", type: "creditCard", balance: plan.liabilities.creditCardBalance || 0, interestRatePct: plan.liabilities.creditCardInterestRatePct || 19.99, repayment: plan.liabilities.creditCardMonthlyRepayment || 0, repaymentFrequency: "monthly", termYears: 0, creditLimit: plan.liabilities.creditCardLimit || 0 });
    }
    if (!Array.isArray(plan.expenseItems)) {
      plan.expenseItems = [
        { id: "expense-living", name: plan.expenses.livingName || "Living costs", category: "living", amount: plan.expenses.livingCosts || 0, frequency: plan.expenses.livingFrequency || "monthly" },
        { id: "expense-food", name: plan.expenses.foodName || "Food", category: "food", amount: plan.expenses.food || 0, frequency: plan.expenses.foodFrequency || "weekly" },
        { id: "expense-utilities", name: plan.expenses.utilitiesName || "Utilities", category: "utilities", amount: plan.expenses.utilities || 0, frequency: plan.expenses.utilitiesFrequency || "annually" },
        { id: "expense-insurance", name: plan.expenses.insuranceName || "Insurance", category: "insurance", amount: plan.expenses.insurance || 0, frequency: plan.expenses.insuranceFrequency || "annually" },
        { id: "expense-school", name: plan.expenses.schoolChildrenName || "School / children", category: "schoolChildren", amount: plan.expenses.schoolChildren || 0, frequency: plan.expenses.schoolChildrenFrequency || "annually" },
        { id: "expense-rates", name: plan.expenses.ratesPropertyCostsName || "Rates / property costs", category: "ratesPropertyCosts", amount: plan.expenses.ratesPropertyCosts || 0, frequency: plan.expenses.ratesPropertyCostsFrequency || "annually" },
        { id: "expense-other", name: plan.expenses.otherExpensesName || "Other expenses", category: "other", amount: plan.expenses.otherExpenses || 0, frequency: plan.expenses.otherFrequency || "monthly" },
      ];
    }
    defaultOtherExpenseItems.forEach((item) => {
      if (!plan.expenseItems.some((expense) => expense.category === item.category)) {
        plan.expenseItems.push({ ...item });
      }
    });
    if (!Array.isArray(plan.goalItems)) {
      const superBalance = (Number(plan.assets.superPerson1) || 0) + (Number(plan.assets.superPerson2) || 0);
      const debtBalance = (Number(plan.liabilities.homeLoanBalance) || 0) + (Number(plan.liabilities.hecsHelpDebt) || 0) + (Number(plan.liabilities.otherDebts) || 0);
      plan.goalItems = [
        { id: "goal-emergency", name: "Target emergency fund", current: Number(plan.assets.cash) || 0, target: 0 },
        { id: "goal-investments", name: "Investment portfolio target", current: Number(plan.assets.sharesEtfs) || 0, target: 0 },
        { id: "goal-super", name: "Super balance target", current: superBalance, target: 0 },
        { id: "goal-debt", name: "Debt reduction target", current: debtBalance, target: 0 },
        { id: "goal-net-worth", name: "Financial freedom net worth target", current: 0, target: 0 },
      ];
    }
    const oldComparison = plan.comparison || {};
    const incomeChange = Number(oldComparison.incomeChange) || (Number(oldComparison.increaseIncome) || 0) - (Number(oldComparison.reduceIncome) || 0);
    const expenseChange = Number(oldComparison.expenseChange) || (Number(oldComparison.increaseExpenses) || 0) - (Number(oldComparison.reduceExpenses) || 0);
    plan.comparison = { ...comparisonDefaults, ...oldComparison, incomeChange, expenseChange };
  }

  function sumBy(items, category, amountKey = "value") {
    return items
      .filter((item) => item.category === category || item.type === category)
      .reduce((total, item) => total + (Number(item[amountKey]) || 0), 0);
  }

  function syncCollectionsToLegacy() {
    ensureCollectionData();
    const incomes = plan.incomeItems;
    const firstIncome = incomes[0] || {};
    const secondIncome = incomes[1] || {};
    const otherAnnualIncome = incomes.slice(2).reduce((total, item) => total + annualValue(item.amount, item.frequency), 0);

    plan.income.person1IncomeName = firstIncome.name || "";
    plan.income.person1Income = Number(firstIncome.amount) || 0;
    plan.income.person1Frequency = firstIncome.frequency || "annually";
    plan.income.person2IncomeName = secondIncome.name || "";
    plan.income.person2Income = Number(secondIncome.amount) || 0;
    plan.income.person2Frequency = secondIncome.frequency || "annually";
    plan.income.otherIncomeName = "Other Income";
    plan.income.otherIncome = otherAnnualIncome;
    plan.income.otherIncomeFrequency = "annually";

    const assets = plan.assetItems;
    const superTotal = sumBy(assets, "super");
    plan.assets.homeValue = sumBy(assets, "home");
    plan.assets.otherPropertyValue = sumBy(assets, "otherProperty");
    plan.assets.offsetBalance = sumBy(assets, "offset");
    plan.assets.cash = sumBy(assets, "cash");
    plan.assets.sharesEtfs = sumBy(assets, "shares");
    plan.assets.crypto = sumBy(assets, "crypto");
    plan.assets.superPerson1 = superTotal;
    plan.assets.superPerson2 = 0;
    plan.assets.vehiclesPersonalAssets = sumBy(assets, "vehicle");

    const liabilities = plan.liabilityItems;
    const homeLoans = liabilities.filter((item) => item.type === "homeLoan");
    const homeLoanBalance = homeLoans.reduce((total, item) => total + (Number(item.balance) || 0), 0);
    const homeLoanRepaymentAnnual = homeLoans.reduce((total, item) => total + annualValue(item.repayment, item.repaymentFrequency || "monthly"), 0);
    const weightedRate = homeLoanBalance > 0
      ? homeLoans.reduce((total, item) => total + ((Number(item.balance) || 0) * (Number(item.interestRatePct) || 0)), 0) / homeLoanBalance
      : 0;
    plan.liabilities.homeLoanBalance = homeLoanBalance;
    plan.liabilities.homeLoanInterestRatePct = weightedRate;
    plan.liabilities.monthlyRepayment = homeLoanRepaymentAnnual / 12;
    plan.liabilities.remainingLoanTermYears = homeLoans.reduce((max, item) => Math.max(max, Number(item.termYears) || 0), 0);
    plan.liabilities.hecsHelpDebt = liabilities.filter((item) => item.type === "hecsHelp").reduce((total, item) => total + (Number(item.balance) || 0), 0);
    const creditCards = liabilities.filter((item) => item.type === "creditCard");
    plan.liabilities.creditCardBalance = creditCards.reduce((total, item) => total + (Number(item.balance) || 0), 0);
    plan.liabilities.creditCardInterestRatePct = plan.liabilities.creditCardBalance > 0
      ? creditCards.reduce((total, item) => total + ((Number(item.balance) || 0) * (Number(item.interestRatePct) || 0)), 0) / plan.liabilities.creditCardBalance
      : (creditCards[0]?.interestRatePct || 19.99);
    plan.liabilities.creditCardMonthlyRepayment = creditCards.reduce((total, item) => total + annualValue(item.repayment, item.repaymentFrequency || "monthly"), 0) / 12;
    plan.liabilities.creditCardLimit = creditCards.reduce((total, item) => total + (Number(item.creditLimit) || 0), 0);
    plan.liabilities.otherDebts = liabilities.filter((item) => item.type === "otherDebt").reduce((total, item) => total + (Number(item.balance) || 0), 0);
    plan.expenses.mortgageRepayments = plan.liabilities.monthlyRepayment;

    const expenseAnnual = (category) => plan.expenseItems
      .filter((item) => item.category === category)
      .reduce((total, item) => total + annualValue(item.amount, item.frequency), 0);
    plan.expenses.livingCosts = expenseAnnual("living");
    plan.expenses.livingFrequency = "annually";
    plan.expenses.food = expenseAnnual("food");
    plan.expenses.foodFrequency = "annually";
    plan.expenses.utilities = expenseAnnual("utilities");
    plan.expenses.utilitiesFrequency = "annually";
    plan.expenses.insurance = expenseAnnual("insurance");
    plan.expenses.insuranceFrequency = "annually";
    plan.expenses.schoolChildren = expenseAnnual("schoolChildren");
    plan.expenses.schoolChildrenFrequency = "annually";
    plan.expenses.ratesPropertyCosts = expenseAnnual("ratesPropertyCosts");
    plan.expenses.ratesPropertyCostsFrequency = "annually";
    plan.expenses.otherExpenses = plan.expenseItems
      .filter((item) => !coreExpenseCategories.has(item.category))
      .reduce((total, item) => total + annualValue(item.amount, item.frequency), 0);
    plan.expenses.otherFrequency = "annually";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getPath(object, path) {
    return path.split(".").reduce((cursor, key) => cursor?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((cursor, key) => {
      if (!cursor[key]) cursor[key] = {};
      return cursor[key];
    }, object);
    target[last] = value;
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
  }

  function loadScenarios() {
    try {
      const raw = localStorage.getItem(SCENARIO_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveScenarios(scenarios) {
    localStorage.setItem(SCENARIO_KEY, JSON.stringify(scenarios));
  }

  function isBlankPlan(currentPlan) {
    const ignoredText = new Set(["weekly", "fortnightly", "monthly", "quarterly", "annually"]);
    function hasValue(value) {
      if (Array.isArray(value)) return value.some(hasValue);
      if (value && typeof value === "object") return Object.values(value).some(hasValue);
      if (typeof value === "string") return value.trim() !== "" && !ignoredText.has(value);
      if (typeof value === "number") return value !== 0;
      if (typeof value === "boolean") return value;
      return false;
    }
    return !hasValue(currentPlan);
  }

  function showWorkspace(view = "dashboard") {
    hasOpenedWorkspace = true;
    document.getElementById("appWorkspace").classList.remove("hidden");
    setView(view);
    document.getElementById("appWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setView(view) {
    activeView = view;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.viewPanel !== view);
    });
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    if (view === "setup") renderWizardStep();
  }

  function optionsHtml(selected) {
    return frequencies.map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
  }

  function field(config) {
    const value = getPath(plan, config.path);
    const id = config.path.replaceAll(".", "-");
    let input = "";
    if (config.type === "select") {
      input = `<select class="field-input" id="${id}" data-path="${config.path}" data-type="text">${optionsHtml(value)}</select>`;
    } else if (config.type === "checkbox") {
      input = `<input class="toggle-input" id="${id}" data-path="${config.path}" data-type="boolean" type="checkbox"${value ? " checked" : ""}>`;
    } else {
      input = `<input class="field-input" id="${id}" data-path="${config.path}" data-type="${config.kind || "number"}" type="${config.kind === "text" ? "text" : "number"}" step="${config.step || "1"}" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(config.placeholder || "")}">`;
    }

    return `
      <label class="${config.type === "checkbox" ? "toggle-field" : ""}">
        <span class="field-label">${escapeHtml(config.label)}</span>
        ${input}
        ${config.help ? `<small class="field-help">${escapeHtml(config.help)}</small>` : ""}
      </label>
    `;
  }

  function renderForm(containerId, fields) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = fields.map(field).join("");
  }

  function renderGroupedForm(containerId, groups) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = groups.map((group) => `
      <article class="form-item-card">
        <div class="card-subheading">
          <h3>${escapeHtml(group.title)}</h3>
          ${group.description ? `<p>${escapeHtml(group.description)}</p>` : ""}
        </div>
        <div class="input-grid mt-4">${group.fields.map(field).join("")}</div>
      </article>
    `).join("");
  }

  function dynamicInput(collection, item, key, label, options = {}) {
    const value = item[key] ?? "";
    const common = `data-collection="${collection}" data-id="${item.id}" data-key="${key}"`;
    if (options.type === "select") {
      return `
        <label>
          <span class="field-label">${escapeHtml(label)}</span>
          <select class="field-input" ${common} data-type="text">${optionList(options.options, value)}</select>
        </label>
      `;
    }
    const inputType = options.kind === "text" ? "text" : "number";
    return `
      <label>
        <span class="field-label">${escapeHtml(label)}</span>
        <input class="field-input" ${common} data-type="${options.kind || "number"}" type="${inputType}" step="${options.step || "1"}" value="${escapeHtml(value)}" placeholder="${escapeHtml(options.placeholder || "")}">
      </label>
    `;
  }

  function collectionShell({ title, description, addLabel, collection, body }) {
    return `
      <section class="collection-section">
        <div class="collection-heading">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
          </div>
          <button class="btn btn-primary add-button" type="button" data-add-collection="${collection}">${escapeHtml(addLabel)}</button>
        </div>
        <div class="collection-list">${body}</div>
      </section>
    `;
  }

  function removeButton(collection, id) {
    return `<button class="btn remove-button" type="button" data-remove-collection="${collection}" data-id="${id}">Remove</button>`;
  }

  function incomeCard(item, index) {
    return `
      <article class="form-item-card dynamic-item-card">
        <div class="item-card-title">
          <div>
            <span>Income ${index + 1}</span>
            <h4>${escapeHtml(item.name || "Income")}</h4>
          </div>
          ${removeButton("incomeItems", item.id)}
        </div>
        <div class="input-grid mt-4">
          ${dynamicInput("incomeItems", item, "name", "Income name", { kind: "text", placeholder: "e.g. Salary, rent, dividends" })}
          ${dynamicInput("incomeItems", item, "amount", "Amount", { step: "100" })}
          ${dynamicInput("incomeItems", item, "frequency", "Frequency", { type: "select", options: frequencies })}
        </div>
      </article>
    `;
  }

  function assetCard(item, index) {
    return `
      <article class="form-item-card dynamic-item-card">
        <div class="item-card-title">
          <div>
            <span>Asset ${index + 1}</span>
            <h4>${escapeHtml(item.name || "Asset")}</h4>
          </div>
          ${removeButton("assetItems", item.id)}
        </div>
        <div class="input-grid mt-4">
          ${dynamicInput("assetItems", item, "name", "Asset name", { kind: "text", placeholder: "e.g. Offset account" })}
          ${dynamicInput("assetItems", item, "category", "Asset type", { type: "select", options: assetCategoryOptions })}
          ${dynamicInput("assetItems", item, "value", "Asset value", { step: "1000" })}
        </div>
      </article>
    `;
  }

  function liabilityCard(item, index) {
    if (item.type === "hecsHelp") {
      return `
        <article class="form-item-card dynamic-item-card">
          <div class="item-card-title">
            <div>
              <span>HELP estimate</span>
              <h4>Current HECS/HELP balance</h4>
            </div>
            ${removeButton("liabilityItems", item.id)}
          </div>
          <div class="input-grid mt-4">
            ${dynamicInput("liabilityItems", item, "balance", "Current HECS/HELP balance", { step: "1000" })}
          </div>
          <p class="field-help mt-3">Estimate only. The app estimates a minimum compulsory repayment from the income entered.</p>
        </article>
      `;
    }
    if (item.type === "creditCard") {
      return `
        <article class="form-item-card dynamic-item-card">
          <div class="item-card-title">
            <div>
              <span>Credit Card</span>
              <h4>${escapeHtml(item.name || "Credit Card")}</h4>
            </div>
            ${removeButton("liabilityItems", item.id)}
          </div>
          <div class="input-grid mt-4">
            ${dynamicInput("liabilityItems", item, "name", "Card name", { kind: "text", placeholder: "e.g. Main credit card" })}
            ${dynamicInput("liabilityItems", item, "balance", "Balance", { step: "100" })}
            ${dynamicInput("liabilityItems", item, "interestRatePct", "Interest rate (%)", { step: "0.01" })}
            ${dynamicInput("liabilityItems", item, "repayment", "Monthly repayment", { step: "50" })}
            ${dynamicInput("liabilityItems", item, "creditLimit", "Optional credit limit", { step: "500" })}
          </div>
          <p class="field-help mt-3">Credit cards are tracked separately from loans. The limit is optional and only used as context.</p>
        </article>
      `;
    }
    return `
      <article class="form-item-card dynamic-item-card">
        <div class="item-card-title">
          <div>
            <span>Liability ${index + 1}</span>
            <h4>${escapeHtml(item.name || "Liability")}</h4>
          </div>
          ${removeButton("liabilityItems", item.id)}
        </div>
        <div class="input-grid mt-4">
          ${dynamicInput("liabilityItems", item, "name", "Liability name", { kind: "text", placeholder: "e.g. Home loan" })}
          ${dynamicInput("liabilityItems", item, "type", "Liability type", { type: "select", options: liabilityTypeOptions })}
          ${dynamicInput("liabilityItems", item, "balance", "Balance", { step: "1000" })}
          ${dynamicInput("liabilityItems", item, "interestRatePct", "Interest rate (%)", { step: "0.1" })}
          ${dynamicInput("liabilityItems", item, "repayment", "Repayment amount", { step: "100" })}
          ${dynamicInput("liabilityItems", item, "repaymentFrequency", "Repayment frequency", { type: "select", options: frequencies })}
          ${dynamicInput("liabilityItems", item, "termYears", "Remaining term (years)", { step: "1" })}
        </div>
      </article>
    `;
  }

  function goalCard(item, index) {
    return `
      <article class="form-item-card dynamic-item-card">
        <div class="item-card-title">
          <div>
            <span>Goal ${index + 1}</span>
            <h4>${escapeHtml(item.name || "Goal")}</h4>
          </div>
          ${removeButton("goalItems", item.id)}
        </div>
        <div class="input-grid mt-4">
          ${dynamicInput("goalItems", item, "name", "Goal name", { kind: "text", placeholder: "e.g. Emergency fund target" })}
          ${dynamicInput("goalItems", item, "current", "Current amount", { step: "1000" })}
          ${dynamicInput("goalItems", item, "target", "Target amount", { step: "1000" })}
        </div>
      </article>
    `;
  }

  function expenseCard(item, index) {
    return `
      <article class="form-item-card dynamic-item-card">
        <div class="item-card-title">
          <div>
            <span>Expense ${index + 1}</span>
            <h4>${escapeHtml(item.name || "Expense")}</h4>
          </div>
          ${removeButton("expenseItems", item.id)}
        </div>
        <div class="input-grid mt-4">
          ${dynamicInput("expenseItems", item, "name", "Expense name", { kind: "text", placeholder: "e.g. Groceries" })}
          ${dynamicInput("expenseItems", item, "category", "Category", { type: "select", options: expenseCategoryOptions })}
          ${dynamicInput("expenseItems", item, "amount", "Amount", { step: "100" })}
          ${dynamicInput("expenseItems", item, "frequency", "Frequency", { type: "select", options: frequencies })}
        </div>
      </article>
    `;
  }

  function renderIncomeCollection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = collectionShell({
      title: "Income",
      description: "Add each income source separately. Use before-tax income if you want tax and HELP estimates to be useful.",
      addLabel: "Add income",
      collection: "incomeItems",
      body: plan.incomeItems.map(incomeCard).join(""),
    });
  }

  function renderAssetCollection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = collectionShell({
      title: "Assets",
      description: "List each asset and choose the category that best describes it.",
      addLabel: "Add asset",
      collection: "assetItems",
      body: plan.assetItems.map(assetCard).join(""),
    });
  }

  function renderLiabilityCollection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = collectionShell({
      title: "Liabilities / Loans",
      description: "Add each loan or liability. HECS/HELP only needs the current balance; repayment is estimated from income.",
      addLabel: "Add liability",
      collection: "liabilityItems",
      body: plan.liabilityItems.map(liabilityCard).join(""),
    });
  }

  function renderExpenseCollection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = collectionShell({
      title: "Expenses",
      description: "Add each recurring expense with its own category and frequency.",
      addLabel: "Add expense",
      collection: "expenseItems",
      body: plan.expenseItems.map(expenseCard).join(""),
    });
  }

  function renderGoalCollection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = collectionShell({
      title: "Example Goals",
      description: "Use these simple editable examples to show what the plan is aiming for.",
      addLabel: "Add goal",
      collection: "goalItems",
      body: plan.goalItems.map(goalCard).join(""),
    });
  }

  function renderCashflowInputs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      ${collectionShell({
        title: "Income",
        description: "Income items can include salary, Other Income, dividends, rent, interest or side payments. Use before-tax income for tax estimates.",
        addLabel: "Add income",
        collection: "incomeItems",
        body: plan.incomeItems.map(incomeCard).join(""),
      })}
      ${collectionShell({
        title: "Expenses",
        description: "Expense items stack cleanly on mobile and each one keeps its own frequency.",
        addLabel: "Add expense",
        collection: "expenseItems",
        body: plan.expenseItems.map(expenseCard).join(""),
      })}
    `;
  }

  function renderForms() {
    ensureCollectionData();
    const aboutFields = [
      { label: "Person 1 name", path: "personal.person1Name", kind: "text" },
      { label: "Person 2 name", path: "personal.person2Name", kind: "text" },
      { label: "Person 1 age", path: "personal.person1Age" },
      { label: "Person 2 age", path: "personal.person2Age" },
    ];
    const goalFields = [
      { label: "Building wealth target age", path: "personal.workOptionalAge", help: "Starting assumption only. You can change this any time." },
      { label: "Financial Independence target age", path: "personal.semiRetirementAge", help: "Starting assumption only. You can change this any time." },
      { label: "Financial Freedom target age", path: "personal.fullRetirementAge", help: "Starting assumption only. You can change this any time." },
      { label: "Target annual spending", path: "personal.targetAnnualSpending", step: "1000" },
      { label: "Annual investing target", path: "investing.annualInvestingTarget", step: "1000" },
      { label: "Employer super contributions", path: "investing.employerSuperContributions", step: "1000" },
      { label: "Extra super contributions", path: "investing.extraSuperContributions", step: "1000" },
      { label: "Expected investment return (%)", path: "investing.expectedInvestmentReturnPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Expected super return (%)", path: "investing.expectedSuperReturnPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Inflation (%)", path: "investing.inflationPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Wage growth (%)", path: "investing.wageGrowthPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Safe withdrawal rate (%)", path: "investing.safeWithdrawalRatePct", step: "0.1", help: "Starting assumption only. You can change this any time." },
    ];
    const downsizingFields = [
      { label: "Use downsizing strategy", path: "downsizing.enabled", type: "checkbox", help: "Off by default. Turn on only when you want the released equity included as investable money." },
      { label: "Current principal residence value", path: "downsizing.currentResidenceValue", step: "1000" },
      { label: "Estimated future downsized property value", path: "downsizing.futurePropertyValue", step: "1000" },
      { label: "Estimated selling costs", path: "downsizing.sellingCosts", step: "1000" },
      { label: "Estimated buying costs / stamp duty", path: "downsizing.buyingCosts", step: "1000" },
      { label: "Amount released for investment", path: "downsizing.releasedForInvestment", step: "1000" },
    ];

    renderForm("personalForm", [...aboutFields, ...goalFields]);
    renderAssetCollection("assetsForm");
    renderLiabilityCollection("liabilitiesForm");
    renderLiabilityCollection("loanForm");
    renderCashflowInputs("incomeExpenseForm");
    renderForm("investingForm", [
      { label: "Annual investing target", path: "investing.annualInvestingTarget", step: "1000" },
      { label: "Expected investment return (%)", path: "investing.expectedInvestmentReturnPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Inflation (%)", path: "investing.inflationPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Wage growth (%)", path: "investing.wageGrowthPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
      { label: "Safe withdrawal rate (%)", path: "investing.safeWithdrawalRatePct", step: "0.1", help: "Starting assumption only. You can change this any time." },
    ]);
    renderForm("superForm", [
      { label: "Super person 1", path: "assets.superPerson1", step: "1000" },
      { label: "Super person 2", path: "assets.superPerson2", step: "1000" },
      { label: "Employer super contributions", path: "investing.employerSuperContributions", step: "1000" },
      { label: "Extra super contributions", path: "investing.extraSuperContributions", step: "1000" },
      { label: "Expected super return (%)", path: "investing.expectedSuperReturnPct", step: "0.1", help: "Starting assumption only. You can change this any time." },
    ]);
    renderForm("wizardAboutForm", aboutFields);
    renderIncomeCollection("wizardIncomeForm");
    renderAssetCollection("wizardAssetsForm");
    renderLiabilityCollection("wizardLoansForm");
    renderExpenseCollection("wizardExpensesForm");
    renderForm("wizardGoalsForm", goalFields);
    renderGoalCollection("wizardGoalExamples");
    renderForm("wizardDownsizingForm", downsizingFields);
    renderForm("downsizingForm", downsizingFields);
    renderGoalCollection("goalExamples");
  }

  function metricCard(label, value, tone = "") {
    return `<article class="metric-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  }

  function summaryTile(label, value, tone = "") {
    return `<div class="summary-tile ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function lineChart(svgId, series, options = {}) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const width = 760;
    const height = options.height || 300;
    const margin = { top: 22, right: 28, bottom: 42, left: 76 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const points = series.flatMap((item) => item.points || []);
    if (!points.length) {
      svg.innerHTML = `<text class="chart-label" x="24" y="40">Enter data to build this chart.</text>`;
      return;
    }
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y), 1) * 1.08;
    const x = (value) => margin.left + ((value - minX) / Math.max(1, maxX - minX)) * chartWidth;
    const y = (value) => margin.top + chartHeight - (Math.max(0, value) / maxY) * chartHeight;
    const gridValues = [0.25, 0.5, 0.75, 1].map((factor) => maxY * factor);
    const xMarks = options.xMarks || [minX, Math.round((minX + maxX) / 2), maxX];

    svg.innerHTML = `
      ${gridValues.map((value) => `
        <line class="chart-grid" x1="${margin.left}" y1="${y(value)}" x2="${width - margin.right}" y2="${y(value)}"></line>
        <text class="chart-label" x="12" y="${y(value) + 4}">${options.yLabel ? options.yLabel(value) : compactMoney(value)}</text>
      `).join("")}
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}"></line>
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}"></line>
      ${xMarks.map((mark) => `<text class="chart-label" x="${x(mark)}" y="${height - 12}" text-anchor="middle">${options.xLabel ? options.xLabel(mark) : mark}</text>`).join("")}
      ${series.map((item) => {
        const path = item.points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)}`).join(" ");
        return `<path class="chart-line" style="stroke:${item.color}" d="${path}"></path>`;
      }).join("")}
      ${series.map((item, index) => `
        <circle cx="${width - 190}" cy="${24 + index * 20}" r="5" fill="${item.color}"></circle>
        <text class="chart-label" x="${width - 178}" y="${28 + index * 20}">${escapeHtml(item.label)}</text>
      `).join("")}
    `;
  }

  function updatePreview(result) {
    const percent = freedomPercent(result);
    const milestone = investmentTargetMilestone(result);
    document.getElementById("previewScore").textContent = plainPercent(percent);
    document.getElementById("previewStage").textContent = currentFreedomStage(percent).name;
    document.getElementById("previewNetWorth").textContent = money(result.currentNetWorth);
    document.getElementById("previewMonthlySurplus").textContent = money(estimatedCashflow(result) / 12);
    document.getElementById("previewNextMilestone").textContent = milestone.shortText;
    document.getElementById("previewRecommendation").textContent = highestRecommendation(result);
  }

  function lifestyleTarget(result) {
    return Number(plan.personal.targetAnnualSpending) || result.annualExpenses || 0;
  }

  function annualPassiveIncome(result) {
    return Math.round((Number(result.financialIndependenceAssets) || 0) * safeWithdrawalRate());
  }

  function nextMilestone(result, percent) {
    if (!result.targetCapital) {
      return {
        amount: "Set your target spending",
        text: "Add your annual lifestyle target to calculate the next stage.",
      };
    }
    const portfolioMilestone = investmentTargetMilestone(result);
    if (percent >= 100) {
      return {
        amount: "Financial Freedom",
        text: "Your investments are projected to fully support the chosen lifestyle over the long term.",
      };
    }
    return {
      amount: portfolioMilestone.amount,
      text: portfolioMilestone.text,
    };
  }

  function renderWizardResults(result) {
    const percent = freedomPercent(result);
    const stage = currentFreedomStage(percent);
    const passive = annualPassiveIncome(result);
    const target = lifestyleTarget(result);
    const milestone = nextMilestone(result, percent);
    const container = document.getElementById("wizardResultsSummary");
    if (!container) return;
    container.innerHTML = `
      <article class="freedom-stage-card">
        <span class="metric-label">Financial Freedom Percentage</span>
        <strong>${plainPercent(percent)}</strong>
        <p>${escapeHtml(stage.explanation)}</p>
        <div class="progress-track progress-track-large" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, percent))}%"></span></div>
      </article>
      <div class="dashboard-card-grid mt-4">
        ${metricCard("Current stage", stage.name)}
        ${metricCard("Annual passive income", money(passive))}
        ${metricCard("Annual lifestyle target", money(target))}
        ${metricCard("Next milestone", milestone.amount)}
      </div>
      <button class="btn btn-primary mt-4 w-full justify-center" type="button" data-view="dashboard">View Dashboard</button>
    `;
  }

  function renderWizardStep() {
    const step = wizardSteps[activeWizardStep];
    const percent = Math.round(((activeWizardStep + 1) / wizardSteps.length) * 100);
    document.getElementById("wizardStepLabel").textContent = `Step ${activeWizardStep + 1} of ${wizardSteps.length}`;
    document.getElementById("wizardStepTitle").textContent = step.title;
    document.getElementById("wizardHeading").textContent = step.title;
    document.getElementById("wizardInstruction").textContent = step.instruction;
    document.getElementById("wizardPercent").textContent = `${percent}% Complete`;
    document.getElementById("wizardProgressBar").style.width = `${percent}%`;
    document.querySelectorAll("[data-wizard-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", Number(panel.dataset.wizardPanel) !== activeWizardStep);
    });
    document.getElementById("wizardPrevButton").disabled = activeWizardStep === 0;
    document.getElementById("wizardNextButton").textContent = activeWizardStep === wizardSteps.length - 1 ? "View Dashboard" : "Next";
  }

  function renderDashboard(result) {
    const names = [plan.personal.person1Name, plan.personal.person2Name].filter(Boolean).join(" and ");
    const percent = freedomPercent(result);
    const stage = currentFreedomStage(percent);
    const passiveIncome = annualPassiveIncome(result);
    const target = lifestyleTarget(result);
    const monthlySurplus = estimatedCashflow(result) / 12;
    const milestone = nextMilestone(result, percent);
    const progressWidth = Math.min(100, Math.max(0, percent));

    document.getElementById("dashboardTitle").textContent = names ? `${names}'s Financial Freedom` : "Start a plan or load the demo.";
    document.getElementById("dashboardSubtitle").textContent = isBlankPlan(plan)
      ? "Enter your own details or try the fictional demo to see the dashboard come alive."
      : "See how today's decisions shape tomorrow's financial freedom.";
    document.getElementById("heroScore").textContent = plainPercent(percent);
    document.querySelector(".score-ring").style.borderColor = percent >= 100 ? "#bdebd7" : percent >= 75 ? "#f3d08c" : "#dbe4ee";
    document.getElementById("freedomStageLabel").textContent = stage.name;
    document.getElementById("freedomStageText").textContent = stage.explanation;
    document.getElementById("freedomProgressBar").style.width = `${progressWidth}%`;
    document.getElementById("freedomPassiveText").textContent = percent >= 100
      ? "Your investments are projected to fully support the chosen lifestyle over the long term."
      : `You are in the ${stage.name} stage with ${plainPercent(percent)} progress toward your long-term target.`;
    document.getElementById("nextMilestoneAmount").textContent = milestone.amount;
    document.getElementById("nextMilestoneText").textContent = milestone.text;

    const boostCard = document.getElementById("downsizingBoostCard");
    if (result.downsizingInvestmentBoost > 0) {
      boostCard.classList.remove("hidden");
      document.getElementById("downsizingBoostValue").textContent = money(result.downsizingInvestmentBoost);
      document.getElementById("downsizingBoostText").textContent = `By downsizing your home, you could release ${money(result.downsizingInvestmentBoost)} to invest toward financial freedom.`;
    } else {
      boostCard.classList.add("hidden");
    }

    document.getElementById("dashboardHeroMetrics").innerHTML = [
      metricCard("Current Financial Freedom Stage", stage.name),
      metricCard("Financial Freedom Progress", plainPercent(percent), percent >= 75 ? "status-green" : ""),
      metricCard("Net Worth", money(result.currentNetWorth)),
      metricCard("Investment Balance", money(result.investmentBalance)),
      metricCard("Super Balance", money(result.superannuationBalance), "status-green"),
      metricCard("Debt Balance", money(result.totalLiabilities), result.totalLiabilities <= result.totalAssets * 0.5 ? "status-green" : "status-amber"),
      metricCard("Monthly Surplus / Deficit", money(monthlySurplus), monthlySurplus >= 0 ? "status-green" : "status-amber"),
      metricCard("Next Milestone", milestone.amount),
    ].join("");
    document.getElementById("secondMetricGrid").innerHTML = [
      metricCard("Annual Passive Income Estimate", money(passiveIncome)),
      metricCard("Annual Living Expenses", money(target)),
      metricCard("Accessible Investments", money(result.accessibleInvestmentAssets)),
      metricCard("Highest Priority", highestRecommendation(result)),
    ].join("");
    document.getElementById("celebrationGrid").innerHTML = celebrationItems(result).slice(0, 6).map((item) => `
      <span class="celebration-pill">${escapeHtml(item.label)}</span>
    `).join("");
    document.getElementById("netWorthNote").textContent = result.netWorthProjection.at(-1) ? `Age ${result.netWorthProjection.at(-1).age}: ${money(result.netWorthProjection.at(-1).closingBalance)}` : "";
    lineChart("netWorthChart", [{
      label: "Net worth",
      color: "#2563eb",
      points: [{ x: 0, y: result.currentNetWorth }, ...result.netWorthProjection.map((row) => ({ x: row.year, y: row.closingBalance }))],
    }], { xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("dashboardInvestmentChart", [{
      label: "Investments",
      color: "#0f9f6e",
      points: [{ x: 0, y: result.investmentBalance }, ...result.investmentProjection.map((row) => ({ x: row.year, y: row.closingBalance }))],
    }], { xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("dashboardDebtChart", [{
      label: "Debt balance",
      color: "#dc4c3e",
      points: [0, 5, 10, 15, 20, 25, 30].map((year) => ({
        x: year,
        y: year === 0 ? result.totalLiabilities : loanBalanceAtYear(result, year) + result.helpRepaymentEstimate.balance + (result.plan.liabilities.otherDebts || 0) + (result.plan.liabilities.creditCardBalance || 0),
      })),
    }], { xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("dashboardSuperChart", [{
      label: "Super",
      color: "#7c3aed",
      points: [{ x: 0, y: result.superannuationBalance }, ...result.superProjection.map((row) => ({ x: row.year, y: row.closingBalance }))],
    }], { xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("dashboardProgressChart", [{
      label: "Progress",
      color: "#d99121",
      points: [{ x: 0, y: percent }, ...result.financialFreedomProgressProjection.map((row) => ({ x: row.year, y: row.progress }))],
    }], { xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y`, yLabel: (value) => `${Math.round(value)}%` });
    renderAssumptions(result);
  }

  function renderAssumptions(result) {
    const container = document.getElementById("assumptionsList");
    if (!container) return;
    const rows = [
      ["Tax year", result.taxEstimate.taxYear],
      ["Investment return", `${Number(plan.investing.expectedInvestmentReturnPct || 0).toFixed(1)}% per year estimate`],
      ["Super return", `${Number(plan.investing.expectedSuperReturnPct || 0).toFixed(1)}% per year estimate`],
      ["Inflation", `${Number(plan.investing.inflationPct || 0).toFixed(1)}% per year estimate`],
      ["Wage growth", `${Number(plan.investing.wageGrowthPct || 0).toFixed(1)}% per year estimate`],
      ["Medicare levy", `${Math.round((result.taxEstimate.medicareLevyRate || 0) * 100)}% estimate`],
      ["HELP repayment assumptions", `Estimated above $67,000 repayment income and capped by current balance`],
      ["Concessional contributions tax", "15% applied before money is invested in super"],
      ["Safe withdrawal rate", `${Number(plan.investing.safeWithdrawalRatePct || 0).toFixed(1)}% estimate`],
      ["Super access age", `Age ${result.superAccessAge} in this model`],
    ];
    container.innerHTML = rows.map(([label, value]) => summaryTile(label, value)).join("");
  }

  function renderCashflow(result) {
    const rows = [
      ["Annual net income", result.annualNetIncome],
      ["Annual expenses", result.annualExpenses],
      ["Mortgage repayments", result.annualMortgageRepayments],
      ["Credit card repayments", result.annualCreditCardRepayments],
      ["Cash surplus before investing", result.cashSurplusBeforeInvesting],
      ["Investment contributions", result.annualInvestmentContributions],
      ["Cash surplus after investing", result.cashSurplusAfterInvesting],
      [`Estimated tax (${result.taxEstimate.taxYear})`, result.taxEstimate.totalTax],
      ["Estimated HELP repayment", result.helpRepaymentEstimate.annualRepayment],
      ["Estimated after-tax cashflow", result.cashSurplusAfterTaxHelpAndInvesting],
    ];
    document.getElementById("cashflowTable").innerHTML = rows.map(([label, value]) => `
      <div class="table-row"><span>${escapeHtml(label)}</span><strong>${money(value)}</strong></div>
    `).join("");
  }

  function renderLoan(result) {
    const loan = result.loan;
    const warning = loan.warnings.find((item) => item.code === "REPAYMENT_TOO_LOW");
    document.getElementById("loanSummary").innerHTML = [
      summaryTile("Gross loan balance", money(loan.offsetBenefit.grossLoanBalance)),
      summaryTile("Offset balance", money(loan.offsetBenefit.offsetBalance)),
      summaryTile("Effective loan balance", money(loan.offsetBenefit.effectiveLoanBalance)),
      summaryTile("Annual interest saved", money(loan.offsetBenefit.annualInterestSaved)),
      summaryTile("Tax-free equivalent return", percentFromRatio(loan.offsetBenefit.taxFreeEquivalentReturn)),
      summaryTile("Years to repay", loan.yearsToRepay ? `${loan.yearsToRepay.toFixed(1)} years` : "Beyond term", warning ? "status-red" : ""),
      summaryTile("Total interest paid", money(loan.totalInterestPaid)),
      summaryTile("Total principal repaid", money(loan.totalPrincipalRepaid)),
      ...[5, 10, 20, 30].map((year) => summaryTile(`Balance at ${year} years`, money(loan.balanceAtYears[year]))),
    ].join("");
    const help = result.helpRepaymentEstimate;
    document.getElementById("helpEstimateSummary").innerHTML = `Estimated HELP repayment: ${money(help.annualRepayment)} per year (${percentFromRatio(help.rate)} of estimated repayment income). ${escapeHtml(help.note)}`;
    lineChart("loanChart", [{
      label: "Loan balance",
      color: "#dc4c3e",
      points: [0, 5, 10, 15, 20, 25, 30].map((year) => ({
        x: year,
        y: year === 0 ? loan.offsetBenefit.grossLoanBalance : loan.schedule[Math.min(loan.schedule.length - 1, year * 12 - 1)]?.closingBalance ?? loan.finalBalance,
      })),
    }], { height: 260, xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
  }

  function renderInvestments(result) {
    document.getElementById("investmentCards").innerHTML = [5, 10, 20, 30].map((year) => {
      const row = result.investmentProjection.find((item) => item.year === year) || result.investmentProjection.at(-1);
      return `<div class="mini-card"><span>${year} years</span><strong>${money(row?.closingBalance || 0)}</strong><small>${money(row?.passiveIncome || 0)} pa passive income</small></div>`;
    }).join("");
    lineChart("investmentChart", [{
      label: "Investment balance",
      color: "#0f9f6e",
      points: [{ x: 0, y: plan.assets.cash + plan.assets.sharesEtfs + plan.assets.crypto + (result.downsizingInvestmentBoost || 0) }, ...result.investmentProjection.map((row) => ({ x: row.year, y: row.closingBalance }))],
    }], { height: 260, xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
  }

  function renderSuper(result) {
    document.getElementById("superCards").innerHTML = [50, 55, 60, 65].map((age) => {
      const row = result.superProjection.find((item) => item.age >= age) || result.superProjection.at(-1);
      return `<div class="mini-card"><span>Age ${age}</span><strong>${money(row?.closingBalance || 0)}</strong><small>${money(row?.passiveIncome || 0)} pa at withdrawal rate</small></div>`;
    }).join("");
    const extra = result.taxEstimate.extraSuper;
    document.getElementById("superSummary").innerHTML = `
      <span class="text-sm font-bold text-slate-500">Additional concessional super estimate</span>
      <div class="summary-grid mt-3">
        ${summaryTile("Gross contribution", money(extra.grossContribution))}
        ${summaryTile("Estimated personal tax saving", money(extra.estimatedPersonalTaxSaving))}
        ${summaryTile("15% super contributions tax", money(extra.contributionsTax))}
        ${summaryTile("Net amount invested in super", money(extra.netAmountInvested))}
        ${summaryTile("Estimated after-tax cashflow cost", money(extra.afterTaxCashflowCost))}
      </div>
      <p class="mt-2 text-sm text-slate-600">Super is treated as available from age ${result.superAccessAge}. Age-${result.sustainabilityStartAge}+ sustainability assets: ${money(result.totalRetirementAssets)}</p>
      <p class="tax-note mt-3">Concessional super contributions are calculated net of 15% contributions tax.</p>
    `;
  }

  function renderMilestones(result) {
    document.getElementById("milestones").innerHTML = result.milestones.map((milestone) => `
      <article class="card status-${milestone.status}">
        <span class="text-sm font-bold text-slate-500">${escapeHtml(milestone.label)}</span>
        <strong class="mt-2 block text-3xl font-black text-navy">Age ${milestone.age || "-"}</strong>
        <p class="mt-3 text-sm leading-6 text-slate-600">${escapeHtml(milestone.description || "")}</p>
        <div class="mt-4 grid gap-2 text-sm">
          <div class="flex justify-between gap-4"><span>Projected FI assets</span><b>${money(milestone.projectedFiAssets)}</b></div>
          <div class="flex justify-between gap-4"><span>Required capital</span><b>${money(milestone.requiredCapital)}</b></div>
          <div class="flex justify-between gap-4"><span>Passive income</span><b>${money(milestone.passiveIncomeEstimate)}</b></div>
        </div>
        <span class="status-pill mt-4">${milestone.status}</span>
      </article>
    `).join("");
  }

  function renderForecast(result) {
    const cards = [
      ["1 year projected net worth", netWorthAtYear(result, 1)],
      ["2 year projected net worth", netWorthAtYear(result, 2)],
      ["5 year net worth", result.netWorthProjection[4]?.closingBalance || 0],
      ["10 year net worth", result.netWorthProjection[9]?.closingBalance || 0],
      ["20 year net worth", result.netWorthProjection[19]?.closingBalance || 0],
      ["30 year net worth", result.netWorthProjection[29]?.closingBalance || 0],
      ["Age-60+ sustainability assets", result.totalRetirementAssets],
      ["Target FI capital", result.targetCapital],
    ];
    document.getElementById("forecastCards").innerHTML = cards.map(([label, value]) => metricCard(label, money(value))).join("");
  }

  function renderDecision(result) {
    document.getElementById("decisionList").innerHTML = result.decisionOptions.map((option, index) => `
      <article class="card decision-coach-card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="text-sm font-bold text-success">${index === 0 ? "Highest Recommendation" : `Priority ${index + 1}`}</span>
            <h3 class="mt-1 text-xl font-black text-navy">${escapeHtml(option.label)}</h3>
          </div>
          <strong class="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">${index === 0 ? "High" : index === 1 ? "Medium" : "Watch"}</strong>
        </div>
        <p class="mt-3 text-sm font-bold text-navy">${index === 0 ? "This appears to be your highest-value opportunity." : "This may still help, depending on your priorities."}</p>
        <div class="coach-section">
          <span>Why it matters</span>
          <p>${escapeHtml(option.explanation)}</p>
        </div>
        <div class="summary-grid mt-4">
          ${summaryTile("Estimated tax impact", option.label === "Extra super" ? `May save about ${percentFromRatio(option.taxSaving)} of each extra dollar` : "No direct tax saving estimated")}
          ${summaryTile("Estimated cashflow impact", `${dollarsPerDollar(option.cashflowImpact)} cost per $1 modelled`)}
          ${summaryTile("Estimated wealth impact", `${percentFromRatio(option.afterTaxBenefit)} modelled benefit`)}
          ${summaryTile("Priority level", index === 0 ? "Highest" : index === 1 ? "Medium" : "Lower")}
        </div>
      </article>
    `).join("");
  }

  function renderReports(result) {
    document.getElementById("reportSummary").textContent = `Financial Freedom Progress ${plainPercent(freedomPercent(result))}, net worth ${money(result.currentNetWorth)}, monthly cashflow estimate ${money(estimatedCashflow(result) / 12)}.`;
    renderScenarioComparison(loadScenarios(), "reportScenarioComparison");
  }

  function renderSetupSummary(result) {
    const container = document.getElementById("setupSummary");
    if (!container) return;
    const percent = freedomPercent(result);
    const stage = currentFreedomStage(percent);
    container.innerHTML = [
      ["Freedom progress", plainPercent(percent)],
      ["Current stage", stage.name],
      ["Accessible investments", money(result.accessibleInvestmentAssets)],
      ["Super from age 60", money(result.superannuationBalance)],
      ["Annual net income", money(result.annualNetIncome)],
      ["Annual living expenses", money(lifestyleTarget(result))],
      ["Cash surplus after investing", money(result.cashSurplusAfterInvesting)],
    ].map(([label, value]) => `
      <div class="setup-summary-row">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");
  }

  function renderComparison(result) {
    const summary = document.getElementById("comparisonSummary");
    if (!summary) return;
    const comparison = { ...comparisonDefaults, ...(plan.comparison || {}) };
    document.querySelectorAll("[data-comparison]").forEach((input) => {
      const value = comparison[input.dataset.comparison] ?? 0;
      if (input.value !== String(value)) input.value = value;
    });
    const revisedPlan = buildComparisonPlan();
    const revisedResult = CALC.calculatePlan(revisedPlan);
    const current = estimatedCashflow(result);
    const revised = estimatedCashflow(revisedResult);
    const currentPercent = freedomPercent(result);
    const revisedPercent = freedomPercent(revisedResult);
    summary.innerHTML = [
      summaryTile("Current monthly cashflow estimate", money(current / 12), current >= 0 ? "status-green" : "status-amber"),
      summaryTile("Revised monthly cashflow estimate", money(revised / 12), revised >= 0 ? "status-green" : "status-amber"),
      summaryTile("Current annual cashflow estimate", money(current), current >= 0 ? "status-green" : "status-amber"),
      summaryTile("Revised annual cashflow estimate", money(revised), revised >= 0 ? "status-green" : "status-amber"),
      summaryTile("Taxable income estimate", `${money(result.taxEstimate.taxableIncomeAfterExtraSuper)} -> ${money(revisedResult.taxEstimate.taxableIncomeAfterExtraSuper)}`),
      summaryTile("Estimated tax", `${money(result.taxEstimate.totalTax)} -> ${money(revisedResult.taxEstimate.totalTax)}`),
      summaryTile("HELP repayment estimate", `${money(result.helpRepaymentEstimate.annualRepayment)} -> ${money(revisedResult.helpRepaymentEstimate.annualRepayment)}`),
      summaryTile("Super balance in 2 years", `${money(superAtYear(result, 2))} -> ${money(superAtYear(revisedResult, 2))}`),
      summaryTile("Investment balance in 2 years", `${money(investmentAtYear(result, 2))} -> ${money(investmentAtYear(revisedResult, 2))}`),
      summaryTile("Debt balance now", `${money(result.totalLiabilities)} -> ${money(revisedResult.totalLiabilities)}`),
      summaryTile("1-year net worth", `${money(netWorthAtYear(result, 1))} -> ${money(netWorthAtYear(revisedResult, 1))}`),
      summaryTile("2-year net worth", `${money(netWorthAtYear(result, 2))} -> ${money(netWorthAtYear(revisedResult, 2))}`),
      summaryTile("Long-term freedom progress", `${plainPercent(currentPercent)} -> ${plainPercent(revisedPercent)}`, revisedPercent >= currentPercent ? "status-green" : "status-amber"),
    ].join("");
  }

  function renderWhatIf(result) {
    const actions = document.getElementById("whatIfActions");
    const output = document.getElementById("whatIfResult");
    if (!actions || !output) return;
    actions.innerHTML = whatIfActions.map((action) => `
      <button class="btn what-if-button ${activeWhatIfId === action.id ? "btn-primary" : ""}" type="button" data-what-if="${action.id}">${escapeHtml(action.label)}</button>
    `).join("");
    const active = whatIfActions.find((action) => action.id === activeWhatIfId) || whatIfActions[0];
    const adjustedPlan = applyScenarioAdjustments(plan, active.adjustments(result));
    const adjustedResult = CALC.calculatePlan(adjustedPlan);
    const currentMonthly = estimatedCashflow(result) / 12;
    const adjustedMonthly = estimatedCashflow(adjustedResult) / 12;
    output.innerHTML = [
      summaryTile("Scenario simulation", active.label),
      summaryTile("Monthly cashflow", `${money(currentMonthly)} -> ${money(adjustedMonthly)}`, adjustedMonthly >= currentMonthly ? "status-green" : "status-amber"),
      summaryTile("1-year net worth", `${money(netWorthAtYear(result, 1))} -> ${money(netWorthAtYear(adjustedResult, 1))}`),
      summaryTile("2-year net worth", `${money(netWorthAtYear(result, 2))} -> ${money(netWorthAtYear(adjustedResult, 2))}`),
      summaryTile("Long-term net worth", `${money(longTermNetWorth(result))} -> ${money(longTermNetWorth(adjustedResult))}`),
      summaryTile("Financial Freedom Progress", `${plainPercent(freedomPercent(result))} -> ${plainPercent(freedomPercent(adjustedResult))}`),
    ].join("");
  }

  function scenarioComparisonMetrics(scenario) {
    const scenarioResult = CALC.calculatePlan(scenario.plan);
    const projectedNetWorth = netWorthAtYear(scenarioResult, 10);
    const investmentBalance = investmentAtYear(scenarioResult, 10);
    const superBalance = superAtYear(scenarioResult, 10);
    const helpBalanceIn10 = Math.max(0, scenarioResult.helpRepaymentEstimate.balance - scenarioResult.helpRepaymentEstimate.annualRepayment * 10);
    const debtIn10 = roundForDisplay(loanBalanceAtYear(scenarioResult, 10) + helpBalanceIn10 + (scenarioResult.plan.liabilities.otherDebts || 0));
    const debtReduction = roundForDisplay(Math.max(0, scenarioResult.totalLiabilities - debtIn10));
    const annualCashflow = estimatedCashflow(scenarioResult);
    const metrics = {
      scenario,
      result: scenarioResult,
      monthlyCashflow: estimatedCashflow(scenarioResult) / 12,
      oneYearNetWorth: netWorthAtYear(scenarioResult, 1),
      twoYearNetWorth: netWorthAtYear(scenarioResult, 2),
      longTermNetWorth: longTermNetWorth(scenarioResult),
      debtBalance: scenarioResult.totalLiabilities,
      projectedNetWorth,
      investmentBalance,
      superBalance,
      debtReduction,
      annualCashflow,
      freedomProgress: freedomPercent(scenarioResult),
      targetAge: targetAgeOutcome(scenarioResult),
    };
    metrics.score = scenarioScore(metrics);
    return metrics;
  }

  function roundForDisplay(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function renderScenarioComparison(scenarios, containerId = "scenarioComparisonReport") {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!scenarios.length) {
      container.innerHTML = `
        <div class="card-heading">
          <div>
            <h3>Scenario Comparison Report</h3>
            <span>Save two or more plans to compare them side-by-side.</span>
          </div>
        </div>
      `;
      return;
    }
    const metrics = scenarios.map(scenarioComparisonMetrics).sort((a, b) => b.score - a.score);
    const best = metrics[0];
    container.innerHTML = `
      <div class="card-heading">
        <div>
          <h3>Scenario Comparison Report</h3>
          <span>Simple side-by-side estimate across saved scenarios.</span>
        </div>
      </div>
      <p class="tax-note mt-4"><strong>Highest Recommendation:</strong> ${escapeHtml(best.scenario.name)}. This is the preferred scenario because it has the strongest estimated mix of monthly cashflow, projected net worth, debt level, investment balance, super balance and progress toward the long-term financial freedom target.</p>
      <div class="scenario-comparison-grid mt-4">
        ${metrics.map((item, index) => `
          <article class="scenario-compare-card ${index === 0 ? "best" : ""}">
            <span>${index === 0 ? "Best estimated outcome" : "Saved scenario"}</span>
            <h4>${escapeHtml(item.scenario.name)}</h4>
            <div class="table-list mt-3">
              <div class="table-row"><span>Monthly cashflow</span><strong>${money(item.monthlyCashflow)}</strong></div>
              <div class="table-row"><span>1-year net worth</span><strong>${money(item.oneYearNetWorth)}</strong></div>
              <div class="table-row"><span>2-year net worth</span><strong>${money(item.twoYearNetWorth)}</strong></div>
              <div class="table-row"><span>Long-term net worth</span><strong>${money(item.longTermNetWorth)}</strong></div>
              <div class="table-row"><span>Debt balance</span><strong>${money(item.debtBalance)}</strong></div>
              <div class="table-row"><span>Investment balance</span><strong>${money(item.investmentBalance)}</strong></div>
              <div class="table-row"><span>Super balance</span><strong>${money(item.superBalance)}</strong></div>
              <div class="table-row"><span>Freedom progress</span><strong>${plainPercent(item.freedomProgress)}</strong></div>
              <div class="table-row"><span>Target age outcome</span><strong>${escapeHtml(item.targetAge)}</strong></div>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderScenarios() {
    const scenarios = loadScenarios();
    document.getElementById("scenarioCount").textContent = `${scenarios.length} saved`;
    renderScenarioComparison(scenarios);
    const list = document.getElementById("scenarioList");
    if (!scenarios.length) {
      list.innerHTML = `<p class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No saved scenarios yet.</p>`;
      return;
    }
    list.innerHTML = scenarios.map((scenario) => {
      const scenarioResult = CALC.calculatePlan(scenario.plan);
      return `
        <article class="scenario-row">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="font-black text-navy">${escapeHtml(scenario.name)}</h3>
              <p>${escapeHtml(scenario.notes || "No notes")}</p>
              <p>Saved ${new Date(scenario.savedAt).toLocaleString()}</p>
              <p class="mt-2 font-bold text-slate-600">Freedom ${plainPercent(freedomPercent(scenarioResult))} · Net worth ${money(scenarioResult.currentNetWorth)}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn" type="button" data-load-scenario="${scenario.id}">Load</button>
              <button class="btn" type="button" data-delete-scenario="${scenario.id}">Delete</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function syncInputs(path, value) {
    document.querySelectorAll(`[data-path="${path}"]`).forEach((input) => {
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else if (input.value !== String(value ?? "")) {
        input.value = value ?? "";
      }
    });
  }

  function syncCollectionInputs(collection, id, key, value) {
    document.querySelectorAll(`[data-collection="${collection}"][data-id="${id}"][data-key="${key}"]`).forEach((input) => {
      if (input.value !== String(value ?? "")) input.value = value ?? "";
    });
  }

  function addCollectionItem(collection) {
    ensureCollectionData();
    const defaults = {
      incomeItems: { id: makeId("income"), name: "Other Income", amount: 0, frequency: "annually" },
      assetItems: { id: makeId("asset"), name: "New asset", category: "cash", value: 0 },
      liabilityItems: { id: makeId("liability"), name: "New liability", type: "otherDebt", balance: 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0 },
      expenseItems: { id: makeId("expense"), name: "New expense", category: "other", amount: 0, frequency: "monthly" },
      goalItems: { id: makeId("goal"), name: "New goal", current: 0, target: 0 },
    };
    if (!defaults[collection]) return;
    plan[collection].push(defaults[collection]);
    syncCollectionsToLegacy();
    saveDraft();
    renderAll();
  }

  function removeCollectionItem(collection, id) {
    ensureCollectionData();
    if (!Array.isArray(plan[collection])) return;
    plan[collection] = plan[collection].filter((item) => item.id !== id);
    syncCollectionsToLegacy();
    saveDraft();
    renderAll();
  }

  function renderOutputs() {
    syncCollectionsToLegacy();
    const result = CALC.calculatePlan(plan);
    updatePreview(result);
    renderDashboard(result);
    renderCashflow(result);
    renderLoan(result);
    renderInvestments(result);
    renderSuper(result);
    renderMilestones(result);
    renderForecast(result);
    renderDecision(result);
    renderScenarios();
    renderReports(result);
    renderWizardResults(result);
    renderWizardStep();
    renderSetupSummary(result);
    renderComparison(result);
    renderWhatIf(result);
    document.getElementById("disclaimer").textContent = DATA.disclaimer;
    if (hasOpenedWorkspace) document.getElementById("appWorkspace").classList.remove("hidden");
  }

  function renderAll() {
    renderForms();
    renderOutputs();
  }

  function loadDemo() {
    plan = CALC.clonePlan(DATA.demoPlan);
    seedDemoScenarios();
    saveDraft();
    renderAll();
    showWorkspace("dashboard");
  }

  function startMyPlan() {
    if (!plan) plan = CALC.emptyPlan();
    activeWizardStep = 0;
    renderAll();
    showWorkspace("setup");
  }

  function resetPlan() {
    if (!window.confirm("Clear the current plan and start again?")) return;
    plan = CALC.emptyPlan();
    localStorage.removeItem(DRAFT_KEY);
    document.getElementById("scenarioName").value = "";
    document.getElementById("scenarioNotes").value = "";
    activeWizardStep = 0;
    renderAll();
    showWorkspace("setup");
  }

  function saveScenario() {
    syncCollectionsToLegacy();
    const scenarios = loadScenarios();
    const nameInput = document.getElementById("scenarioName");
    const notesInput = document.getElementById("scenarioNotes");
    const name = nameInput.value.trim() || `Scenario ${scenarios.length + 1}`;
    const scenario = {
      id: `scenario-${Date.now()}`,
      name,
      notes: notesInput.value.trim(),
      savedAt: new Date().toISOString(),
      plan: CALC.clonePlan(plan),
    };
    scenarios.unshift(scenario);
    saveScenarios(scenarios);
    renderScenarios();
    showWorkspace("scenarios");
  }

  function duplicateScenario() {
    syncCollectionsToLegacy();
    const scenarios = loadScenarios();
    const scenario = {
      id: `scenario-${Date.now()}`,
      name: `Copy ${scenarios.length + 1}`,
      notes: "Duplicated from the current plan.",
      savedAt: new Date().toISOString(),
      plan: CALC.clonePlan(plan),
    };
    scenarios.unshift(scenario);
    saveScenarios(scenarios);
    renderScenarios();
    showWorkspace("scenarios");
  }

  function seedDemoScenarios() {
    if (!Array.isArray(DATA.demoScenarioAdjustments)) return;
    const existingUserScenarios = loadScenarios().filter((scenario) => scenario.source !== "demo");
    const demoScenarios = DATA.demoScenarioAdjustments.map((item, index) => ({
      id: `demo-scenario-${index + 1}`,
      source: "demo",
      name: item.name,
      notes: item.notes,
      savedAt: new Date().toISOString(),
      plan: applyScenarioAdjustments(DATA.demoPlan, item.adjustments || {}),
    }));
    saveScenarios([...demoScenarios, ...existingUserScenarios]);
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (target.dataset.collection) {
        ensureCollectionData();
        const item = plan[target.dataset.collection]?.find((entry) => entry.id === target.dataset.id);
        if (!item) return;
        const value = target.dataset.type === "text" ? target.value : Number(target.value);
        item[target.dataset.key] = value;
        syncCollectionInputs(target.dataset.collection, target.dataset.id, target.dataset.key, value);
        syncCollectionsToLegacy();
        document.getElementById("wizardSaveStatus").textContent = "Saved on this device.";
        saveDraft();
        if (target.dataset.collection === "liabilityItems" && target.dataset.key === "type") {
          renderAll();
          return;
        }
        renderOutputs();
        return;
      }
      if (target.dataset.comparison) {
        ensureCollectionData();
        plan.comparison[target.dataset.comparison] = Number(target.value) || 0;
        saveDraft();
        renderOutputs();
        return;
      }
      if (!target.dataset.path) return;
      const value = target.dataset.type === "boolean" ? target.checked : target.dataset.type === "text" ? target.value : Number(target.value);
      setPath(plan, target.dataset.path, value);
      syncInputs(target.dataset.path, value);
      if (target.dataset.path === "liabilities.monthlyRepayment") {
        setPath(plan, "expenses.mortgageRepayments", value);
        syncInputs("expenses.mortgageRepayments", value);
      }
      if (target.dataset.path === "expenses.mortgageRepayments") {
        setPath(plan, "liabilities.monthlyRepayment", value);
        syncInputs("liabilities.monthlyRepayment", value);
      }
      document.getElementById("wizardSaveStatus").textContent = "Saved on this device.";
      saveDraft();
      renderOutputs();
    });

    document.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add-collection]");
      if (addButton) {
        addCollectionItem(addButton.dataset.addCollection);
        return;
      }

      const removeButton = event.target.closest("[data-remove-collection]");
      if (removeButton) {
        removeCollectionItem(removeButton.dataset.removeCollection, removeButton.dataset.id);
        return;
      }

      const nav = event.target.closest("[data-view]");
      if (nav) setView(nav.dataset.view);

      const whatIfButton = event.target.closest("[data-what-if]");
      if (whatIfButton) {
        activeWhatIfId = whatIfButton.dataset.whatIf;
        renderOutputs();
        return;
      }

      const homeStep = event.target.closest("[data-home-step]");
      if (homeStep) {
        if (homeStep.dataset.homeStep === "setup") activeWizardStep = 0;
        showWorkspace(homeStep.dataset.homeStep);
      }

      const loadId = event.target.closest("[data-load-scenario]")?.dataset.loadScenario;
      if (loadId) {
        const scenario = loadScenarios().find((item) => item.id === loadId);
        if (scenario) {
          plan = CALC.clonePlan(scenario.plan);
          saveDraft();
          renderAll();
          showWorkspace("dashboard");
        }
      }

      const deleteId = event.target.closest("[data-delete-scenario]")?.dataset.deleteScenario;
      if (deleteId) {
        if (!window.confirm("Delete this saved scenario?")) return;
        saveScenarios(loadScenarios().filter((item) => item.id !== deleteId));
        renderScenarios();
      }
    });

    document.addEventListener("keydown", (event) => {
      const homeStep = event.target.closest?.("[data-home-step]");
      if (!homeStep || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      if (homeStep.dataset.homeStep === "setup") activeWizardStep = 0;
      showWorkspace(homeStep.dataset.homeStep);
    });

    document.getElementById("demoButton").addEventListener("click", loadDemo);
    document.getElementById("heroDemoButton").addEventListener("click", loadDemo);
    document.getElementById("enterDataButton").addEventListener("click", startMyPlan);
    document.getElementById("heroStartButton").addEventListener("click", startMyPlan);
    document.getElementById("planNewButton").addEventListener("click", resetPlan);
    document.getElementById("planSaveButton").addEventListener("click", () => showWorkspace("scenarios"));
    document.getElementById("saveScenarioPanelButton").addEventListener("click", saveScenario);
    document.getElementById("planLoadButton").addEventListener("click", () => showWorkspace("scenarios"));
    document.getElementById("planDuplicateButton").addEventListener("click", duplicateScenario);
    document.getElementById("wizardPrevButton").addEventListener("click", () => {
      activeWizardStep = Math.max(0, activeWizardStep - 1);
      saveDraft();
      renderOutputs();
    });
    document.getElementById("wizardNextButton").addEventListener("click", () => {
      saveDraft();
      if (activeWizardStep >= wizardSteps.length - 1) {
        showWorkspace("dashboard");
        return;
      }
      activeWizardStep = Math.min(wizardSteps.length - 1, activeWizardStep + 1);
      renderOutputs();
      document.querySelector('[data-view-panel="setup"]').scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("exportButton").addEventListener("click", () => window.print());
    document.getElementById("reportPrintButton").addEventListener("click", () => window.print());
  }

  renderAll();
  bindEvents();
  if (hasOpenedWorkspace) showWorkspace(activeView);
})();
