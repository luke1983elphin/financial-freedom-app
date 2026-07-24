(function bootFinancialFreedomApp() {
  const DATA = window.FFS_DATA;
  const CALC = window.FFSCalculator;
  const DRAFT_KEY = "ffs-current-plan-v3-mobile-dashboard-ux-test";
  const LAST_SAVED_KEY = "ffs-current-plan-last-saved-v3-mobile-dashboard-ux-test";
  const SCENARIO_KEY = "ffs-scenarios-v3-mobile-dashboard-ux-test";
  const WEEKLY_PLAN_KEY = "ffs-weekly-plan-v1-v3-mobile-dashboard-ux-test";
  const USER_STATE_KEY = "ffs-user-state-v3-mobile-dashboard-ux-test";
  const APP_VERSION = "3.0-test-weekly-planner";
  const WEEKLY_EDITOR_BUILD_ID = "2026-07-17-02";
  const EXPORT_SCHEMA_VERSION = 1;
  const AI_INSIGHTS_ENDPOINT = "/api/ai-insights";
  const AI_INSIGHTS_DEFAULT_MAX_GENERATIONS = 5;
  const AI_INSIGHTS_DEFAULT_COOLDOWN_MS = 60000;
  const ENGAGEMENT_JOURNEY_ENABLED = window.FFS_ENGAGEMENT_JOURNEY_ENABLED !== false;
  console.info(`Weekly Plan editor build: ${WEEKLY_EDITOR_BUILD_ID}`);
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
      instruction: "Add each income source as gross income before tax, with its own name, amount and frequency.",
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
      instruction: "Set target spending and optional downsizing details.",
    },
    {
      title: "Assumptions Review",
      instruction: "Review the key assumptions before viewing results or reports.",
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
    ["other", "Other"],
  ];
  const liabilityTypeOptions = [
    ["homeLoan", "Home loan"],
    ["investmentLoan", "Investment Loan"],
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
    ["petCosts", "Pet Costs"],
    ["other", "Other expenses"],
  ];
  const goalInfoCopy = {
    annualLifestyleSpending: {
      title: "Annual Lifestyle Spending Needed for Financial Freedom",
      body: "This is how much you want your investments to fund each year. It is one of the most important numbers in your plan because it helps calculate your Financial Freedom Target.",
    },
    financialFreedomTarget: {
      title: "Financial Freedom Target",
      body: "This is the investment portfolio amount you are aiming for. It is calculated based on your annual lifestyle spending and withdrawal rate.",
    },
    targetFiCapital: {
      title: "Target FI Capital",
      body: "This is the amount of income-producing assets needed to support your desired annual lifestyle spending.",
    },
    targetFiAssets: {
      title: "Target FI Assets",
      body: "FI assets are income-producing assets used in the Financial Independence calculation. These may include investments, savings and other assets that can help fund your lifestyle. They generally exclude personal-use assets such as your home, cars or lifestyle assets.",
    },
    currentFiAssets: {
      title: "Current FI Assets",
      body: "Current FI assets are the income-producing assets you already have today. These are used to measure your progress toward financial independence.",
    },
    withdrawalRate: {
      title: "Withdrawal Rate",
      body: "This is the percentage of your investment portfolio you plan to withdraw each year. A lower rate usually means a safer but higher target.",
    },
    buildingWealthTargetAge: {
      title: "Building Wealth Target Age",
      body: "Your investments are beginning to benefit from compounding and are creating long-term momentum.",
    },
    financialIndependenceTargetAge: {
      title: "Financial Independence Target Age",
      body: "Your investments are projected to cover a significant portion of your future lifestyle costs.",
    },
    financialFreedomTargetAge: {
      title: "Financial Freedom Target Age",
      body: "Your investments are projected to fully support your chosen lifestyle over the long term.",
    },
    annualInvestingTarget: {
      title: "Annual Investing Target",
      body: "This is the amount of spare cashflow you want to invest into income-producing investments to build extra passive income over time.",
    },
    extraSuperContributions: {
      title: "Extra Super Contributions",
      body: "This is extra tax-deductible personal concessional super contributions you plan to make to help grow your super balance.",
    },
    cashflowAllocation: {
      title: "Spare Cashflow Allocation",
      body: "These amounts are deducted from available cashflow because you have chosen to allocate that spare cash toward wealth-building instead of leaving it as unused surplus.",
    },
    financialStage: {
      title: "Financial stages",
      body: "The stage shows where your plan appears to sit today. Stage progress looks at practical steps such as positive cashflow, emergency savings, debt control and investment progress. Lifestyle funding is separate: it compares passive income or FI assets with your target annual lifestyle cost.",
    },
    investmentReturn: {
      title: "Investment Return",
      body: "This is the expected average yearly return on your investments before inflation. It helps estimate how your portfolio may grow over time.",
    },
    inflationRate: {
      title: "Inflation Rate",
      body: "This estimates how much living costs may increase each year. The app uses this to keep future spending targets realistic.",
    },
  };
  const coreExpenseCategories = new Set(["living", "food", "utilities", "insurance", "schoolChildren", "ratesPropertyCosts"]);
  const incomeHelperText = "Enter your gross income before tax. The simulator estimates tax and HELP repayments separately.";
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
    surplusAllocationTarget: "none",
    surplusAllocationAmount: 0,
    surplusAllocationFrequency: "annually",
    surplusAllocationUseFull: false,
  };
  const whatIfActions = [
    { id: "invest-100", label: "Invest an extra $100/week", adjustments: () => ({ investmentContributionChange: 5200 }) },
    { id: "invest-250", label: "Invest an extra $250/week", adjustments: () => ({ investmentContributionChange: 13000 }) },
    { id: "debt-500", label: "Pay an extra $500/month off debt", adjustments: () => ({ loanRepaymentChangeMonthly: 500 }) },
    { id: "income-5", label: "Increase income by 5%", adjustments: (result) => ({ incomeChange: Math.round((result.annualGrossIncome || result.annualNetIncome) * 0.05) }) },
    { id: "expenses-500", label: "Reduce expenses by $500/month", adjustments: () => ({ expenseChange: -6000 }) },
    { id: "super-10000", label: "Add $10,000 concessional super", adjustments: () => ({ extraConcessionalSuperChange: 10000 }) },
    { id: "car-50000", label: "Buy a $50,000 car", adjustments: () => ({ oneOffCosts: 50000 }) },
    { id: "four-days", label: "Work 4 days per week", adjustments: (result) => ({ incomeChange: -Math.round((result.annualGrossIncome || result.annualNetIncome) * 0.2) }) },
  ];

  let restoredDraftUi = {};
  let saveStatusTimer = null;
  const savedDraft = loadDraft();
  let userState = loadUserState(savedDraft);
  let plan = CALC.clonePlan(savedDraft || CALC.emptyPlan());
  let activeView = restoredDraftUi.activeView || "dashboard";
  let activeWizardStep = normaliseWizardStep(restoredDraftUi.activeWizardStep);
  let hasOpenedWorkspace = Boolean(savedDraft) || Boolean(restoredDraftUi.hasOpenedWorkspace);
  let activeWhatIfId = whatIfActions[0].id;
  let selectedSamplePlanId = DATA.samplePlans?.[1]?.id || DATA.samplePlans?.[0]?.id || "";
  let generatedWeeklyPlanner = null;
  let weeklyPlan = loadWeeklyPlan();
  let activeWeeklyPlanTab = restoredDraftUi.activeWeeklyPlanTab || "thisWeek";
  let weeklyEditingWeek = null;
  let weeklyViewedWeekNumber = null;
  let activeWeeklyStep = "opening";
  const weeklyPlanUiState = {
    isTimingSetupExpanded: null,
  };
  let editingTimingItemId = null;
  let timingEditDraft = null;
  let weeklyPlanRenderCount = 0;
  const weeklyActualDrafts = new Map();
  let aiInsightsConfig = {
    enabled: Boolean(window.FFS_ENABLE_AI_INSIGHTS),
    configLoaded: Boolean(window.FFS_ENABLE_AI_INSIGHTS),
    maxGenerations: AI_INSIGHTS_DEFAULT_MAX_GENERATIONS,
    cooldownMs: AI_INSIGHTS_DEFAULT_COOLDOWN_MS,
  };
  const aiInsightsUi = {
    isOpen: false,
    consentAccepted: false,
    isLoading: false,
    error: "",
  };

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
      name: "Building the Foundation",
      explanation: "Establishing positive cashflow, building emergency savings and gaining control over debt.",
    },
    {
      min: 25,
      nextAt: 75,
      name: "Building Wealth",
      explanation: "Regularly reducing debt, investing and increasing long-term financial assets.",
    },
    {
      min: 75,
      nextAt: 100,
      name: "Financial Independence",
      explanation: "Investments and passive income can fund a meaningful portion of the household's lifestyle.",
    },
    {
      min: 100,
      nextAt: null,
      name: "Financial Freedom",
      explanation: "Investments and passive income are projected to fund the household's target lifestyle.",
    },
  ];

  function freedomPercent(result) {
    if (!result.targetCapital) return 0;
    return (Number(result.financialIndependenceAssets) || 0) / result.targetCapital * 100;
  }

  function currentFreedomStage(percent) {
    return [...freedomStages].reverse().find((stage) => percent >= stage.min) || freedomStages[0];
  }

  function stageDisplayName(name) {
    return name === "Foundation" ? "Building the Foundation" : name;
  }

  function financialStageInfo(result) {
    const lifestylePercent = Math.max(0, freedomPercent(result));
    const cash = Number(result.plan.assets.cash || 0) + Number(result.plan.assets.offsetBalance || 0);
    const annualLifestyle = Number(result.annualLivingExpenses || result.plan.personal.targetAnnualSpending || 0);
    const emergencyTarget = Math.max(0, annualLifestyle / 4);
    const surplus = Number(result.finalProjectedCashSurplus) || 0;
    const totalAssets = Number(result.totalAssets) || 0;
    const totalDebt = Number(result.totalLiabilities) || 0;
    const debtRatio = totalAssets > 0 ? totalDebt / totalAssets : totalDebt > 0 ? 1 : 0;
    const investmentAssets = Number(result.accessibleInvestmentAssets || 0);
    const insufficient = !annualLifestyle && !result.targetCapital && !result.annualGrossIncome && !totalAssets;
    let stageIndex = 0;
    if (insufficient) stageIndex = 0;
    else if (lifestylePercent >= 100) stageIndex = 3;
    else if (lifestylePercent >= 75) stageIndex = 2;
    else if (surplus > 0 && investmentAssets > 0 && (cash >= emergencyTarget * 0.5 || debtRatio <= 0.75)) stageIndex = 1;
    const stage = freedomStages[stageIndex];
    const nextStage = freedomStages[stageIndex + 1] || null;
    let progressToNext = 100;
    if (insufficient) {
      progressToNext = 0;
    } else if (stageIndex === 0) {
      const emergencyProgress = emergencyTarget > 0 ? Math.min(1, cash / emergencyTarget) : cash > 0 ? 1 : 0;
      const cashflowProgress = surplus > 0 ? 1 : 0;
      const debtProgress = debtRatio <= 0.5 ? 1 : debtRatio <= 0.75 ? 0.65 : debtRatio <= 1 ? 0.35 : 0;
      const investmentProgress = investmentAssets > 0 ? 1 : 0;
      progressToNext = Math.round((emergencyProgress * 0.35 + cashflowProgress * 0.3 + debtProgress * 0.2 + investmentProgress * 0.15) * 100);
    } else if (stageIndex === 1) {
      progressToNext = Math.round(Math.min(100, Math.max(0, lifestylePercent / 75 * 100)));
    } else if (stageIndex === 2) {
      progressToNext = Math.round(Math.min(100, Math.max(0, (lifestylePercent - 75) / 25 * 100)));
    }
    const actions = [];
    if (insufficient) {
      actions.push("Complete the remaining plan information to calculate your financial stage.");
    } else {
      if (emergencyTarget > 0 && cash < emergencyTarget) actions.push(`Build your emergency reserve to ${money(emergencyTarget)}.`);
      if (surplus <= 0) actions.push("Maintain positive annual spare cashflow.");
      if (investmentAssets <= 0) actions.push("Start building income-producing FI assets.");
      if (debtRatio > 0.5 && totalDebt > 0) actions.push("Reduce debt to below 50% of total assets.");
      if (lifestylePercent < 100 && investmentAssets > 0) actions.push(`Continue building FI assets toward ${money(result.targetCapital || 0)}.`);
    }
    if (!actions.length) actions.push("Keep reviewing cashflow, debt and investment contributions so progress stays on track.");
    return {
      stage,
      stageIndex,
      nextStage,
      progressToNext: Math.min(100, Math.max(0, progressToNext)),
      lifestylePercent,
      emergencyTarget,
      actions: actions.slice(0, 3),
      insufficient,
    };
  }

  function stageJourneyHtml(stageInfo) {
    return `
      <div class="stage-journey" role="list" aria-label="Financial stage journey">
        ${freedomStages.map((stage, index) => {
          const completed = index < stageInfo.stageIndex;
          const current = index === stageInfo.stageIndex;
          return `
            <div class="stage-journey-step ${completed ? "complete" : ""} ${current ? "current" : ""}" role="listitem" aria-current="${current ? "step" : "false"}">
              <span>${completed ? "✓" : index + 1}</span>
              <strong>${escapeHtml(stage.name)}</strong>
              <small>${current ? "Current stage" : completed ? "Completed" : index === stageInfo.stageIndex + 1 ? "Next stage" : "Future stage"}</small>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  const engagementJourneyStages = [
    {
      name: "Getting Started",
      purpose: "Complete the plan details and confirm the household's current position.",
      priority: "Finish the Financial Plan so progress can be measured.",
    },
    {
      name: "Building Stability",
      purpose: "Create positive cashflow and start building reliable cash reserves.",
      priority: "Keep regular spending below income and confirm the weekly plan.",
    },
    {
      name: "Emergency Ready",
      purpose: "Build a cash buffer so unexpected costs do not derail the plan.",
      priority: "Increase cash or offset savings toward three months of expenses.",
    },
    {
      name: "Reducing Debt",
      purpose: "Reduce pressure from loans, credit cards and other debts.",
      priority: "Keep repayments on track and consider extra debt reduction scenarios.",
    },
    {
      name: "Building Wealth",
      purpose: "Invest regularly and grow income-producing assets.",
      priority: "Maintain planned investment and super contributions.",
    },
    {
      name: "Growing Investment Income",
      purpose: "Build enough investments for passive income to cover more lifestyle costs.",
      priority: "Review whether current investing is enough for the target age.",
    },
    {
      name: "Approaching Independence",
      purpose: "Close the gap between investment income and the target lifestyle cost.",
      priority: "Model the highest-impact scenarios before changing the plan.",
    },
    {
      name: "Financial Independence",
      purpose: "Investments and passive income can fund a meaningful portion of lifestyle costs.",
      priority: "Review accessibility, super timing and risk before relying on the result.",
    },
    {
      name: "Financial Freedom",
      purpose: "Investments and passive income are projected to fund the chosen lifestyle.",
      priority: "Keep the plan reviewed and stress-test assumptions regularly.",
    },
  ];

  function engagementData(targetPlan = plan) {
    ensurePlanSettings(targetPlan);
    return targetPlan.reportSettings.engagement;
  }

  function engagementJourneyIsEnabled() {
    return ENGAGEMENT_JOURNEY_ENABLED && engagementData().engagementJourneyEnabled !== false;
  }

  function engagementProgress(result) {
    const targetSpending = Number(plan.personal.targetAnnualSpending || result.annualLivingExpenses) || 0;
    const withdrawalRate = safeWithdrawalRate();
    const sustainableIncome = (Number(result.financialIndependenceAssets) || 0) * withdrawalRate;
    const fiRaw = targetSpending > 0 ? sustainableIncome / targetSpending * 100 : 0;
    const ffRaw = Number(result.targetCapital) > 0
      ? (Number(result.financialIndependenceAssets) || 0) / Number(result.targetCapital) * 100
      : fiRaw;
    return {
      targetSpending,
      sustainableIncome,
      financialIndependenceRaw: Math.max(0, fiRaw),
      financialFreedomRaw: Math.max(0, ffRaw),
      financialIndependence: Math.min(100, Math.max(0, fiRaw)),
      financialFreedom: Math.min(100, Math.max(0, ffRaw)),
    };
  }

  function emergencyMonths(result) {
    const cash = (Number(plan.assets.cash) || 0) + (Number(plan.assets.offsetBalance) || 0);
    const monthlyCosts = (Number(result.annualLivingExpenses) || 0) / 12;
    return monthlyCosts > 0 ? cash / monthlyCosts : 0;
  }

  function engagementStageInfo(result) {
    const progress = engagementProgress(result);
    const emergency = emergencyMonths(result);
    const surplus = Number(result.finalProjectedCashSurplus) || 0;
    const invested = Number(result.investmentBalance) || 0;
    const debt = Number(result.totalLiabilities) || 0;
    const hasPlanData = Boolean(result.annualGrossIncome || result.totalAssets || result.annualLivingExpenses);
    let index = 0;
    if (!hasPlanData) index = 0;
    else if (progress.financialFreedomRaw >= 100) index = 8;
    else if (progress.financialIndependenceRaw >= 100) index = 7;
    else if (progress.financialIndependenceRaw >= 75) index = 6;
    else if (progress.financialIndependenceRaw >= 40) index = 5;
    else if (invested > 0 || result.annualInvestmentContributions > 0) index = 4;
    else if (debt > 0 && result.totalAssets > 0) index = 3;
    else if (emergency >= 3) index = 2;
    else if (surplus > 0 || emergency > 0) index = 1;
    const stage = engagementJourneyStages[index];
    const nextStage = engagementJourneyStages[index + 1] || null;
    const actions = [];
    if (!hasPlanData) actions.push("Complete the Financial Plan to calculate your journey.");
    if (surplus <= 0 && hasPlanData) actions.push("Create positive final projected surplus.");
    if (emergency < 3 && hasPlanData) actions.push(`Build cash or offset reserves toward ${emergency.toFixed(1)} of 3 months covered.`);
    if ((invested <= 0 && result.annualInvestmentContributions <= 0) && hasPlanData) actions.push("Start building income-producing investments.");
    if (debt > 0 && result.totalAssets > 0 && debt > result.totalAssets * 0.5) actions.push("Reduce debt pressure below 50% of total assets.");
    if (progress.financialIndependenceRaw < 100 && invested > 0) actions.push(`Grow FI assets toward ${money(result.targetCapital || 0)}.`);
    if (!actions.length) actions.push(stage.priority);
    return {
      index,
      stage,
      nextStage,
      progress,
      emergency,
      actions: actions.slice(0, 3),
    };
  }

  function engagementJourneyMapHtml(stageInfo) {
    return `
      <div class="engagement-stage-map" role="list" aria-label="Financial journey stages">
        ${engagementJourneyStages.map((stage, index) => {
          const complete = index < stageInfo.index;
          const current = index === stageInfo.index;
          return `
            <div class="engagement-stage-step ${complete ? "complete" : ""} ${current ? "current" : ""}" role="listitem" aria-current="${current ? "step" : "false"}">
              <span>${complete ? "OK" : index + 1}</span>
              <strong>${escapeHtml(stage.name)}</strong>
              <small>${current ? "Current" : complete ? "Completed" : index === stageInfo.index + 1 ? "Next" : "Later"}</small>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function engagementGreetingName() {
    return String(plan.personal.person1Name || "").trim() || "there";
  }

  function engagementGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function storedShortTermGoals() {
    return engagementData().shortTermGoals;
  }

  function normalisedShortTermGoals(result) {
    const stored = storedShortTermGoals()
      .filter((goal) => goal.status !== "cancelled")
      .map((goal) => ({
        id: goal.id || makeId("goal"),
        name: goal.name || "Short-term goal",
        category: goal.category || "custom",
        targetAmount: Number(goal.targetAmount) || 0,
        currentAmount: Number(goal.currentAmount) || 0,
        targetDate: goal.targetDate || "",
        recurringAmount: Number(goal.recurringAmount) || 0,
        recurringFrequency: goal.recurringFrequency || "weekly",
        priority: goal.priority || "medium",
        status: goal.status || "active",
        source: "engagement",
      }));
    const legacyGoals = Array.isArray(plan.goalItems) ? plan.goalItems
      .filter((goal) => (Number(goal.target) || 0) > 0)
      .map((goal) => ({
        id: goal.id || makeId("legacy-goal"),
        name: goal.name || "Goal",
        category: /emergency/i.test(goal.name || "") ? "emergency fund" : "custom",
        targetAmount: Number(goal.target) || 0,
        currentAmount: Number(goal.current) || 0,
        targetDate: "",
        recurringAmount: 0,
        recurringFrequency: "weekly",
        priority: "medium",
        status: (Number(goal.current) || 0) >= (Number(goal.target) || 0) ? "completed" : "active",
        source: "legacy",
      })) : [];
    const fallbackTarget = Math.max(1000, Math.round((Number(result.annualLivingExpenses) || Number(plan.personal.targetAnnualSpending) || 0) / 4));
    const fallbackCurrent = Math.min(fallbackTarget, (Number(plan.assets.cash) || 0) + (Number(plan.assets.offsetBalance) || 0));
    const fallback = fallbackTarget > 1000 ? [{
      id: "fallback-emergency-fund",
      name: "Emergency fund",
      category: "emergency fund",
      targetAmount: fallbackTarget,
      currentAmount: fallbackCurrent,
      targetDate: "",
      recurringAmount: Math.max(50, Math.round(Math.max(0, fallbackTarget - fallbackCurrent) / 26)),
      recurringFrequency: "fortnightly",
      priority: "high",
      status: fallbackCurrent >= fallbackTarget ? "completed" : "active",
      source: "calculated",
    }] : [];
    return [...stored, ...legacyGoals, ...fallback];
  }

  function primaryShortTermGoal(result) {
    const goals = normalisedShortTermGoals(result);
    return goals.find((goal) => goal.status === "active" && goal.targetAmount > goal.currentAmount)
      || goals.find((goal) => goal.targetAmount > 0)
      || null;
  }

  function goalProgressPercent(goal) {
    if (!goal?.targetAmount) return 0;
    return Math.min(100, Math.max(0, (Number(goal.currentAmount) || 0) / Number(goal.targetAmount) * 100));
  }

  function goalRemaining(goal) {
    return Math.max(0, (Number(goal?.targetAmount) || 0) - (Number(goal?.currentAmount) || 0));
  }

  function goalTimeRemaining(goal) {
    if (!goal?.targetDate) return "Target date not set";
    const today = new Date();
    const date = new Date(`${goal.targetDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Target date not set";
    const weeks = Math.ceil((date.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeks <= 0) return "Due now";
    if (weeks < 9) return `${weeks} week${weeks === 1 ? "" : "s"} remaining`;
    const months = Math.ceil(weeks / 4.345);
    return `${months} month${months === 1 ? "" : "s"} remaining`;
  }

  function weeklyCompletionStreak() {
    if (!weeklyPlan?.weeks?.length) return 0;
    const completed = weeklyPlan.weeks
      .filter((week) => week.isCompleted)
      .map((week) => week.weekNumber)
      .sort((a, b) => b - a);
    if (!completed.length) return 0;
    let streak = 1;
    for (let index = 1; index < completed.length; index += 1) {
      if (completed[index] === completed[index - 1] - 1) streak += 1;
      else break;
    }
    return streak;
  }

  function currentWeeklyMission(result) {
    const week = weeklyCurrentWeek();
    const streak = weeklyCompletionStreak();
    const plannedInvestment = week?.planned?.investment || (Number(result.annualInvestmentContributions) || 0) / 52;
    const plannedSuper = week?.planned?.extraSuper || (Number(result.annualExtraSuperContributions) || 0) / 52;
    const tasks = [
      {
        id: "review",
        title: "Complete this week's financial review",
        amount: 0,
        completed: Boolean(week?.isCompleted),
      },
      {
        id: "balance",
        title: "Confirm your opening bank balance",
        amount: 0,
        completed: Boolean(week?.actual && week.actual.openingBalance !== null && week.actual.openingBalance !== undefined),
      },
      {
        id: "invest",
        title: plannedInvestment > 0 ? `Record planned investing of ${money(plannedInvestment)}` : "Review investment plan",
        amount: plannedInvestment,
        completed: Boolean(week?.actual?.investment !== null && week?.actual?.investment !== undefined),
      },
      {
        id: "super",
        title: plannedSuper > 0 ? `Record extra super of ${money(plannedSuper)}` : "Review super contributions",
        amount: plannedSuper,
        completed: plannedSuper <= 0 || Boolean(week?.actual?.extraSuper !== null && week?.actual?.extraSuper !== undefined),
      },
      {
        id: "bills",
        title: "Check bills and spending against plan",
        amount: 0,
        completed: Boolean(week?.actual?.essentialCosts !== null && week?.actual?.essentialCosts !== undefined),
      },
    ];
    const completedCount = tasks.filter((task) => task.completed).length;
    return {
      week,
      tasks,
      completedCount,
      totalTasks: tasks.length,
      percent: tasks.length ? Math.round(completedCount / tasks.length * 100) : 0,
      streak,
      plannedWealthAmount: tasks.reduce((total, task) => total + (Number(task.amount) || 0), 0),
    };
  }

  function engagementOpeningMessage(result, stageInfo, goal, mission) {
    if (mission.week && !mission.week.isCompleted && mission.streak > 0) {
      return `Completing this week's plan keeps your ${mission.streak}-week streak alive.`;
    }
    if (goal && goalRemaining(goal) > 0 && goalRemaining(goal) <= Math.max(500, goal.targetAmount * 0.1)) {
      return `You are only ${money(goalRemaining(goal))} away from ${goal.name}.`;
    }
    if (result.investmentBalance >= 100000) return "Your investments have now passed $100,000.";
    if (stageInfo.emergency > 0) return `Your emergency fund is now covering ${stageInfo.emergency.toFixed(1)} months.`;
    if (mission.plannedWealthAmount > 0) return `This week you have ${money(mission.plannedWealthAmount)} planned toward your financial future.`;
    return "Complete this week's review to update your journey.";
  }

  function engagementTodayWin(result, goal, mission) {
    if (mission.week && !mission.week.isCompleted) {
      return {
        title: "Complete this week's financial review",
        text: "Confirm income, bills, transfers and your closing balance so the plan stays current.",
        action: "weeklyplan",
        actionLabel: "Open Weekly Plan",
      };
    }
    if (goal && goalRemaining(goal) > 0) {
      const suggested = Math.min(goalRemaining(goal), Math.max(50, Number(goal.recurringAmount) || 100));
      return {
        title: `Add progress to ${goal.name}`,
        text: `Recording ${money(suggested)} would move this goal closer. Only record money you have actually set aside.`,
        action: "add-goal-progress",
        actionLabel: "Add Progress",
        goalId: goal.id,
      };
    }
    if ((Number(result.annualInvestmentContributions) || 0) > 0) {
      return {
        title: "Review your investment contribution",
        text: "Check that this week's planned investing is still affordable after bills and spending.",
        action: "investments",
        actionLabel: "Review Investments",
      };
    }
    return {
      title: "No urgent action today",
      text: "You are ready to review goals, weekly cashflow or AI Insights when you have a moment.",
      action: "dashboard",
      actionLabel: "View Dashboard",
    };
  }

  function syncEngagementAchievements(result) {
    const data = engagementData();
    if (data.preferences?.achievementsEnabled === false) return data.achievements;
    const existing = new Set(data.achievements.map((item) => item.id));
    const emergency = emergencyMonths(result);
    const definitions = [
      { id: "first-weekly-review", active: Boolean(weeklyPlan?.weeks?.some((week) => week.isCompleted)), title: "First Weekly Review", description: "You completed your first weekly money review." },
      { id: "four-week-streak", active: weeklyCompletionStreak() >= 4, title: "Four Consecutive Weeks", description: "You completed four weekly reviews in a row." },
      { id: "emergency-started", active: ((Number(plan.assets.cash) || 0) + (Number(plan.assets.offsetBalance) || 0)) > 0, title: "Emergency Fund Started", description: "You have started building cash or offset reserves." },
      { id: "one-month-covered", active: emergency >= 1, title: "One Month Covered", description: "Your cash and offset reserves cover about one month of living costs." },
      { id: "three-months-covered", active: emergency >= 3, title: "Three Months Covered", description: "Your cash and offset reserves cover about three months of living costs." },
      { id: "first-investment-contribution", active: (Number(result.annualInvestmentContributions) || 0) > 0, title: "First Investment Contribution", description: "Your plan includes regular investment contributions." },
      { id: "invested-100k", active: (Number(result.investmentBalance) || 0) >= 100000, title: "$100,000 Invested", description: "Your investment balance has passed $100,000." },
      { id: "positive-surplus", active: (Number(result.finalProjectedCashSurplus) || 0) > 0, title: "Positive Monthly Surplus", description: "Your plan keeps a cash buffer after planned spending and wealth-building contributions." },
      { id: "financial-independence-reached", active: engagementProgress(result).financialIndependenceRaw >= 100, title: "Financial Independence Reached", description: "The app estimates your FI assets can fund the target lifestyle." },
    ];
    definitions.forEach((definition) => {
      if (!definition.active || existing.has(definition.id)) return;
      data.achievements.unshift({
        id: definition.id,
        achievementType: definition.id,
        title: definition.title,
        description: definition.description,
        unlockedAt: new Date().toISOString(),
        metadata: {},
      });
      existing.add(definition.id);
    });
    return data.achievements;
  }

  function logProgressEvent(event) {
    const data = engagementData();
    const duplicateKey = event.metadata?.dedupeKey || `${event.eventType}-${event.goalId || ""}-${event.amount || ""}-${new Date().toDateString()}`;
    const exists = data.progressEvents.some((item) => item.metadata?.dedupeKey === duplicateKey);
    if (exists) return;
    data.progressEvents.unshift({
      id: makeId("progress"),
      planId: "local-plan",
      createdAt: new Date().toISOString(),
      source: "manual",
      ...event,
      metadata: {
        ...(event.metadata || {}),
        dedupeKey: duplicateKey,
      },
    });
    data.progressEvents = data.progressEvents.slice(0, 80);
  }

  function latestProgressEvents(limit = 4) {
    return engagementData().progressEvents.slice(0, limit);
  }

  function latestAchievement(result) {
    const achievements = syncEngagementAchievements(result);
    return achievements[0] || null;
  }

  function projectionRowAtAge(projection, age) {
    if (!Array.isArray(projection) || !projection.length) return null;
    return projection.find((row) => Number(row.age) >= Number(age)) || projection.at(-1);
  }

  function futureYouPreview(result) {
    const targetAge = Number(plan.personal.fullRetirementAge || plan.personal.semiRetirementAge || plan.personal.workOptionalAge) || ((Number(plan.personal.person1Age) || 0) + 10);
    const investment = projectionRowAtAge(result.investmentProjection, targetAge);
    const superRow = projectionRowAtAge(result.superProjection, targetAge);
    const progressRow = projectionRowAtAge(result.financialFreedomProgressProjection, targetAge);
    return {
      age: targetAge,
      investmentBalance: Number(investment?.closingBalance) || result.investmentBalance || 0,
      superBalance: Number(superRow?.closingBalance) || result.superannuationBalance || 0,
      passiveIncome: annualPassiveIncome(result),
      progress: Number(progressRow?.progress) || engagementProgress(result).financialFreedomRaw || 0,
    };
  }

  function aiOpeningInsightHtml() {
    const settings = currentAiInsightsSettings();
    const report = validateAiInsightsReport(settings.report);
    if (!aiInsightsConfig.enabled) {
      return `
        <article class="engagement-card engagement-ai-card">
          <span class="metric-label">AI Coach</span>
          <h3>Private beta switched off</h3>
          <p>AI Insights can be enabled for selected testers without changing the financial plan.</p>
        </article>
      `;
    }
    if (!report || engagementData().preferences?.aiOpeningInsightsEnabled === false) {
      return `
        <article class="engagement-card engagement-ai-card">
          <span class="metric-label">AI Coach</span>
          <h3>AI Financial Freedom Insights</h3>
          <p>Generate private beta insights after completing your plan to see a personalised coaching-style summary.</p>
          <button class="btn btn-primary" type="button" data-engagement-action="ai">Open AI Insights</button>
        </article>
      `;
    }
    return `
      <article class="engagement-card engagement-ai-card">
        <span class="metric-label">AI-generated insight</span>
        <h3>${escapeHtml(report.overallPosition.rating)}</h3>
        <p>${escapeHtml(report.overallPosition.summary)}</p>
        <small>Uses the anonymous financial summary from your current saved plan.</small>
        <button class="btn mt-3" type="button" data-engagement-action="ai">Review AI Insights</button>
      </article>
    `;
  }

  function ensureStoredGoal(goal) {
    const data = engagementData();
    let stored = data.shortTermGoals.find((item) => item.id === goal.id);
    if (!stored) {
      stored = {
        id: goal.id === "fallback-emergency-fund" ? makeId("goal-emergency") : goal.id,
        name: goal.name,
        category: goal.category || "custom",
        targetAmount: Number(goal.targetAmount) || 0,
        currentAmount: Number(goal.currentAmount) || 0,
        targetDate: goal.targetDate || "",
        recurringAmount: Number(goal.recurringAmount) || 0,
        recurringFrequency: goal.recurringFrequency || "weekly",
        priority: goal.priority || "medium",
        status: goal.status || "active",
        createdAt: new Date().toISOString(),
        notes: "",
      };
      data.shortTermGoals.unshift(stored);
    }
    return stored;
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

  function infoButtonHtml(infoKey, label) {
    return infoKey ? `<button class="field-info-button" type="button" data-info-key="${escapeHtml(infoKey)}" aria-label="More information about ${escapeHtml(label)}">&#9432;</button>` : "";
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

  function comparisonSurplusAllocationAmount(baseResult, comparison = {}) {
    if (!["investments", "debt"].includes(comparison.surplusAllocationTarget)) return 0;
    if (comparison.surplusAllocationUseFull) return Math.max(0, estimatedCashflow(baseResult));
    return Math.max(0, annualValue(comparison.surplusAllocationAmount, comparison.surplusAllocationFrequency || "annually"));
  }

  function comparisonAdjustmentsWithSurplus(baseResult, comparison = {}) {
    const adjusted = { ...comparison };
    const annualAllocation = comparisonSurplusAllocationAmount(baseResult, comparison);
    if (annualAllocation > 0 && comparison.surplusAllocationTarget === "investments") {
      adjusted.investmentContributionChange = (Number(adjusted.investmentContributionChange) || 0) + annualAllocation;
    }
    if (annualAllocation > 0 && comparison.surplusAllocationTarget === "debt") {
      adjusted.loanRepaymentChangeMonthly = (Number(adjusted.loanRepaymentChangeMonthly) || 0) + annualAllocation / 12;
    }
    return adjusted;
  }

  function buildComparisonPlan(baseResult = CALC.calculatePlan(plan)) {
    return applyScenarioAdjustments(plan, comparisonAdjustmentsWithSurplus(baseResult, plan.comparison || {}));
  }

  function estimatedCashflow(result) {
    return Number(result.finalProjectedCashSurplus ?? result.cashSurplusAfterTaxHelpAndInvesting) || 0;
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

  function progressAtYear(result, year) {
    return result.financialFreedomProgressProjection[Math.max(0, year - 1)]?.progress || freedomPercent(result);
  }

  function projectedFiAssetsAtYear(result, year) {
    const row = result.investmentProjection[Math.max(0, year - 1)];
    const superAccessible = row?.age >= result.superAccessAge ? superAtYear(result, year) : 0;
    return roundForDisplay((row?.closingBalance || 0) + (Number(result.plan.assets.offsetBalance) || 0) + superAccessible);
  }

  function projectedDebtAtYear(result, year) {
    const helpBalance = Math.max(0, result.helpRepaymentEstimate.balance - result.helpRepaymentEstimate.annualRepayment * year);
    return roundForDisplay(
      loanBalanceAtYear(result, year)
      + helpBalance
      + (Number(result.plan.liabilities.otherDebts) || 0)
      + (Number(result.plan.liabilities.creditCardBalance) || 0)
    );
  }

  function formatLoanTiming(loan) {
    if (!loan?.offsetBenefit?.grossLoanBalance) return "No home loan timing estimated";
    return loan.yearsToRepay ? `${loan.yearsToRepay.toFixed(1)} years` : "Beyond current loan term";
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
    if (!top) return "Load a sample plan or start a plan to see your next best step.";
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
      { label: "Investments exceed annual salary", active: invested >= result.annualGrossIncome && result.annualGrossIncome > 0 },
      { label: "Debt below 50% of assets", active: result.totalAssets > 0 && result.totalLiabilities <= result.totalAssets * 0.5 },
      { label: "Super exceeds $250,000", active: result.superannuationBalance >= 250000 },
      { label: "Super exceeds $500,000", active: result.superannuationBalance >= 500000 },
      { label: "Positive monthly surplus", active: monthlySurplus > 0 },
    ].filter((item) => item.active);
  }

  function sumWeeklyActual(weeks, selector) {
    return weeks.reduce((total, week) => total + (Number(selector(week)) || 0), 0);
  }

  function plannedLoanRepaymentsForWeek(week) {
    return (week.detail?.billItems || [])
      .filter((item) => /loan|mortgage|debt|credit card/i.test(item.name || ""))
      .reduce((total, item) => total + (Number(item.amount) || 0), 0);
  }

  function weeklyHealthCheckCard(result) {
    const completed = (weeklyPlan?.weeks || []).filter((week) => week.isCompleted && week.actual);
    if (!completed.length) {
      return `
        <article class="metric-card weekly-health-check-card">
          <span>Financial Health Check</span>
          <strong>Start weekly tracking</strong>
          <p>Complete a week in the Weekly Plan to compare planned vs actual income, expenses and wealth-building actions.</p>
        </article>
      `;
    }
    const plannedIncome = sumWeeklyActual(completed, (week) => week.planned?.income);
    const actualIncome = sumWeeklyActual(completed, (week) => week.actual?.income);
    const plannedExpenses = sumWeeklyActual(completed, (week) => weeklyForecastExpenses(week.planned));
    const actualExpenses = sumWeeklyActual(completed, (week) => weeklyActualExpenses(week.actual));
    const plannedLoans = sumWeeklyActual(completed, plannedLoanRepaymentsForWeek);
    const actualLoans = sumWeeklyActual(completed, (week) => week.actual?.checks?.billsPaid ? plannedLoanRepaymentsForWeek(week) : 0);
    const plannedInvesting = sumWeeklyActual(completed, (week) => week.planned?.investment);
    const actualInvesting = sumWeeklyActual(completed, (week) => week.actual?.investment);
    const plannedSuper = sumWeeklyActual(completed, (week) => week.planned?.extraSuper);
    const actualSuper = sumWeeklyActual(completed, (week) => week.actual?.extraSuper);
    const plannedDebt = sumWeeklyActual(completed, (week) => week.planned?.extraDebtRepayment);
    const actualDebt = sumWeeklyActual(completed, (week) => week.actual?.extraDebtRepayment);
    const latest = completed.at(-1);
    const cashBuffer = Number(weeklyPlan.minimumCashBuffer || 0);
    const currentBank = Number(latest?.actual?.closingBalance || 0);
    const expenseVariancePct = plannedExpenses > 0 ? ((actualExpenses - plannedExpenses) / plannedExpenses) * 100 : 0;
    const missedInvestments = completed.filter((week) => (Number(week.planned?.investment) || 0) > 0 && (Number(week.actual?.investment) || 0) + 1 < (Number(week.planned?.investment) || 0)).length;
    const incomeTrendPct = plannedIncome > 0 ? ((actualIncome - plannedIncome) / plannedIncome) * 100 : 0;
    const healthTone = currentBank < cashBuffer || expenseVariancePct > 5 || missedInvestments >= 2 ? "status-amber" : "status-green";
    const summary = expenseVariancePct < -1
      ? `You're spending ${Math.abs(expenseVariancePct).toFixed(1)}% less than planned.`
      : expenseVariancePct > 1
        ? `You're spending ${expenseVariancePct.toFixed(1)}% more than planned.`
        : "Your spending is close to plan.";
    const recommendation = Math.abs(expenseVariancePct) >= 5
      ? `Your actual spending trend differs from the Financial Plan. Review whether the strategic spending assumption should be updated.`
      : Math.abs(incomeTrendPct) >= 5
        ? `Your income trend differs from the Financial Plan. Review whether your strategic income assumption should be updated.`
        : missedInvestments >= 2
          ? `Investment contributions have been missed ${missedInvestments} times. Review whether the weekly transfer target is still realistic.`
          : `You're still projected to achieve Financial Freedom at ${targetAgeOutcome(result).toLowerCase()}, based on the current Financial Plan assumptions.`;
    const row = (label, plannedValue, actualValue, reverseGood = false) => {
      const diff = Number(actualValue || 0) - Number(plannedValue || 0);
      const toneDiff = reverseGood ? -diff : diff;
      return `<div><span>${escapeHtml(label)}</span><strong>${money(actualValue)}</strong><small class="${weeklyDifferenceClass(toneDiff)}">${money(diff)} vs planned</small></div>`;
    };
    return `
      <article class="metric-card weekly-health-check-card ${healthTone}">
        <span>Financial Health Check</span>
        <strong>${escapeHtml(summary)}</strong>
        <div class="weekly-health-grid">
          ${row("Income", plannedIncome, actualIncome)}
          ${row("Living Expenses", plannedExpenses, actualExpenses, true)}
          ${row("Loan Repayments", plannedLoans, actualLoans)}
          ${row("Investment Contributions", plannedInvesting, actualInvesting)}
          ${row("Super Contributions", plannedSuper, actualSuper)}
          ${row("Mortgage Reduction", plannedDebt, actualDebt)}
          ${row("Cash Buffer", cashBuffer, currentBank)}
          <div><span>Emergency Fund</span><strong>${currentBank >= cashBuffer ? "On target" : "Below buffer"}</strong><small>${money(currentBank)} current bank balance</small></div>
        </div>
        <p>${escapeHtml(recommendation)}</p>
        ${Math.abs(expenseVariancePct) >= 5 || Math.abs(incomeTrendPct) >= 5 ? `
          <div class="weekly-health-actions">
            <button class="btn btn-primary" type="button" data-weekly-health-action="update-plan">Update Plan</button>
            <button class="btn" type="button" data-weekly-health-action="keep-plan">Keep Current Plan</button>
            <button class="btn" type="button" data-weekly-health-action="remind-later">Remind Me Later</button>
          </div>
        ` : ""}
      </article>
    `;
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

  function personDisplayName(personNumber) {
    const key = personNumber === 2 ? "person2Name" : "person1Name";
    const name = String(plan.personal?.[key] || "").trim();
    return name || `Person ${personNumber}`;
  }

  function superDisplayName(personNumber) {
    return `${personDisplayName(personNumber)} Super`;
  }

  function isDefaultIncomeName(value, personNumber) {
    const text = String(value || "").trim();
    if (!text) return true;
    return text === `Person ${personNumber} income` || text === `${personDisplayName(personNumber)} income`;
  }

  function syncDefaultPersonCollectionLabels() {
    const firstIncome = plan.incomeItems?.find((item) => item.id === "income-person-1");
    const secondIncome = plan.incomeItems?.find((item) => item.id === "income-person-2");
    if (firstIncome && isDefaultIncomeName(firstIncome.name, 1)) firstIncome.name = `${personDisplayName(1)} income`;
    if (secondIncome && isDefaultIncomeName(secondIncome.name, 2)) secondIncome.name = `${personDisplayName(2)} income`;

    const firstSuper = plan.assetItems?.find((item) => item.id === "asset-super-1");
    const secondSuper = plan.assetItems?.find((item) => item.id === "asset-super-2");
    if (firstSuper) firstSuper.name = superDisplayName(1);
    if (secondSuper) secondSuper.name = superDisplayName(2);
  }

  function hasFinancialPlanData(currentPlan = plan) {
    const hasNumber = (value) => Number(value) > 0;
    const hasCollectionValue = (items, amountKey = "amount") => Array.isArray(items) && items.some((item) => {
      const hasAmount = hasNumber(item?.[amountKey] ?? item?.value ?? item?.balance);
      const hasCustomName = String(item?.name || "").trim() && !/^New |^Other Income$/i.test(String(item.name));
      return hasAmount || hasCustomName;
    });
    return Boolean(
      String(currentPlan.personal?.person1Name || "").trim()
      || String(currentPlan.personal?.person2Name || "").trim()
      || hasNumber(currentPlan.personal?.person1Age)
      || hasNumber(currentPlan.personal?.person2Age)
      || hasNumber(currentPlan.personal?.targetAnnualSpending)
      || hasCollectionValue(currentPlan.incomeItems)
      || hasCollectionValue(currentPlan.assetItems, "value")
      || hasCollectionValue(currentPlan.liabilityItems, "balance")
      || hasCollectionValue(currentPlan.expenseItems)
      || hasNumber(currentPlan.assets?.homeValue)
      || hasNumber(currentPlan.assets?.sharesEtfs)
      || hasNumber(currentPlan.assets?.superPerson1)
      || hasNumber(currentPlan.assets?.superPerson2)
      || hasNumber(currentPlan.liabilities?.homeLoanBalance)
      || hasNumber(currentPlan.income?.person1Income)
      || hasNumber(currentPlan.income?.person2Income)
      || hasNumber(currentPlan.expenses?.livingCosts)
    );
  }

  function updateSetupNavigationLabel() {
    const button = document.getElementById("setupNavButton");
    if (button) button.textContent = hasFinancialPlanData() ? "Financial Plan" : "Setup Wizard";
  }

  function updateFieldLabel(path, label) {
    const input = document.querySelector(`[data-path="${path}"]`);
    const labelElement = input?.closest("label")?.querySelector(".field-label");
    if (labelElement) labelElement.textContent = label;
  }

  function updateCollectionItemDisplay(collection, id, name) {
    document.querySelectorAll(`[data-collection="${collection}"][data-id="${id}"][data-key="name"]`).forEach((input) => {
      if (document.activeElement !== input && input.value !== name) input.value = name;
      const card = input.closest(".dynamic-item-card");
      const heading = card?.querySelector(".item-card-title h4");
      if (heading) heading.textContent = name;
    });
  }

  function updatePersonDependentLabels() {
    updateFieldLabel("assets.superPerson1", superDisplayName(1));
    updateFieldLabel("assets.superPerson2", superDisplayName(2));
    updateCollectionItemDisplay("assetItems", "asset-super-1", superDisplayName(1));
    updateCollectionItemDisplay("assetItems", "asset-super-2", superDisplayName(2));
  }

  function ensureCollectionData() {
    if (!Array.isArray(plan.incomeItems)) {
      plan.incomeItems = [
        { id: "income-person-1", name: plan.income.person1IncomeName || `${personDisplayName(1)} income`, amount: plan.income.person1Income || 0, frequency: plan.income.person1Frequency || "fortnightly" },
        { id: "income-person-2", name: plan.income.person2IncomeName || `${personDisplayName(2)} income`, amount: plan.income.person2Income || 0, frequency: plan.income.person2Frequency || "fortnightly" },
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
        { id: "asset-super-1", name: superDisplayName(1), category: "super", value: plan.assets.superPerson1 || 0 },
        { id: "asset-super-2", name: superDisplayName(2), category: "super", value: plan.assets.superPerson2 || 0 },
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
    if (plan.liabilityItems.length && !plan.liabilityItems.some((item) => item.type === "creditCard") && (Number(plan.liabilities.creditCardBalance) || Number(plan.liabilities.creditCardLimit))) {
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
        ...defaultOtherExpenseItems.map((item) => ({ ...item })),
      ];
    }
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
    ensurePlanSettings(plan);
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

    syncDefaultPersonCollectionLabels();
    const assets = plan.assetItems;
    const superItems = assets.filter((item) => item.category === "super");
    const superPerson1Item = assets.find((item) => item.id === "asset-super-1")
      || superItems.find((item) => item.id !== "asset-super-2")
      || null;
    const superPerson2Item = assets.find((item) => item.id === "asset-super-2")
      || superItems.find((item) => item !== superPerson1Item)
      || null;
    const otherSuper = superItems
      .filter((item) => item !== superPerson1Item && item !== superPerson2Item)
      .reduce((total, item) => total + (Number(item.value) || 0), 0);
    plan.assets.homeValue = sumBy(assets, "home");
    plan.assets.otherPropertyValue = sumBy(assets, "otherProperty");
    plan.assets.offsetBalance = sumBy(assets, "offset");
    plan.assets.cash = sumBy(assets, "cash");
    plan.assets.sharesEtfs = sumBy(assets, "shares");
    plan.assets.crypto = sumBy(assets, "crypto");
    plan.assets.superPerson1 = (Number(superPerson1Item?.value) || 0) + otherSuper;
    plan.assets.superPerson2 = Number(superPerson2Item?.value) || 0;
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

  function normaliseWizardStep(value) {
    const step = Number(value);
    if (!Number.isFinite(step)) return 0;
    return Math.max(0, Math.min(wizardSteps.length - 1, Math.round(step)));
  }

  function defaultEngagementData() {
    return {
      version: 1,
      engagementJourneyEnabled: true,
      shortTermGoals: [],
      progressEvents: [],
      achievements: [],
      cachedInsights: [],
      weeklyMissionOverrides: {},
      preferences: {
        celebrationsEnabled: true,
        achievementsEnabled: true,
        aiOpeningInsightsEnabled: true,
        reducedMotion: false,
        reminderPreferences: {
          enabled: false,
        },
      },
    };
  }

  function ensurePlanSettings(targetPlan = plan) {
    if (!targetPlan.reportSettings || typeof targetPlan.reportSettings !== "object") targetPlan.reportSettings = {};
    if (!targetPlan.reportSettings.weeklyPlanner || typeof targetPlan.reportSettings.weeklyPlanner !== "object") {
      targetPlan.reportSettings.weeklyPlanner = {};
    }
    if (!targetPlan.reportSettings.engagement || typeof targetPlan.reportSettings.engagement !== "object") {
      targetPlan.reportSettings.engagement = defaultEngagementData();
    } else {
      const defaults = defaultEngagementData();
      targetPlan.reportSettings.engagement = {
        ...defaults,
        ...targetPlan.reportSettings.engagement,
        shortTermGoals: Array.isArray(targetPlan.reportSettings.engagement.shortTermGoals) ? targetPlan.reportSettings.engagement.shortTermGoals : [],
        progressEvents: Array.isArray(targetPlan.reportSettings.engagement.progressEvents) ? targetPlan.reportSettings.engagement.progressEvents : [],
        achievements: Array.isArray(targetPlan.reportSettings.engagement.achievements) ? targetPlan.reportSettings.engagement.achievements : [],
        cachedInsights: Array.isArray(targetPlan.reportSettings.engagement.cachedInsights) ? targetPlan.reportSettings.engagement.cachedInsights : [],
        weeklyMissionOverrides: targetPlan.reportSettings.engagement.weeklyMissionOverrides || {},
        preferences: {
          ...defaults.preferences,
          ...(targetPlan.reportSettings.engagement.preferences || {}),
          reminderPreferences: {
            ...defaults.preferences.reminderPreferences,
            ...(targetPlan.reportSettings.engagement.preferences?.reminderPreferences || {}),
          },
        },
      };
    }
    if (!targetPlan.reportSettings.aiInsights || typeof targetPlan.reportSettings.aiInsights !== "object") {
      targetPlan.reportSettings.aiInsights = {
        report: null,
        generatedAt: "",
        planHash: "",
        usage: {
          count: 0,
          lastGeneratedAt: "",
        },
      };
    }
    if (!targetPlan.reportSettings.aiInsights.usage || typeof targetPlan.reportSettings.aiInsights.usage !== "object") {
      targetPlan.reportSettings.aiInsights.usage = { count: 0, lastGeneratedAt: "" };
    }
    return targetPlan.reportSettings.weeklyPlanner;
  }

  function migratePlanData(planInput) {
    const migrated = CALC.clonePlan(planInput || {});
    ensurePlanSettings(migrated);
    if (!migrated.comparison || typeof migrated.comparison !== "object") migrated.comparison = { ...comparisonDefaults };
    migrated.comparison = { ...comparisonDefaults, ...migrated.comparison };
    return migrated;
  }

  function migrateScenarioData(scenario) {
    if (!scenario || typeof scenario !== "object") return null;
    return {
      ...scenario,
      savedAt: scenario.savedAt || new Date().toISOString(),
      plan: migratePlanData(scenario.plan || scenario),
    };
  }

  function migrateScenarioList(scenarios) {
    if (!Array.isArray(scenarios)) return [];
    return scenarios.map(migrateScenarioData).filter(Boolean);
  }

  function collectDraftUi() {
    return {
      activeView,
      activeWizardStep,
      activeWeeklyPlanTab,
      hasOpenedWorkspace,
      hasCreatedPersonalPlan: Boolean(userState.hasCreatedPersonalPlan),
      scenarioName: document.getElementById("scenarioName")?.value ?? restoredDraftUi.scenarioName ?? "",
      scenarioNotes: document.getElementById("scenarioNotes")?.value ?? restoredDraftUi.scenarioNotes ?? "",
    };
  }

  function restoreDraftUiInputs() {
    const nameInput = document.getElementById("scenarioName");
    const notesInput = document.getElementById("scenarioNotes");
    if (nameInput && restoredDraftUi.scenarioName !== undefined) nameInput.value = restoredDraftUi.scenarioName || "";
    if (notesInput && restoredDraftUi.scenarioNotes !== undefined) notesInput.value = restoredDraftUi.scenarioNotes || "";
  }

  function stablePlanJson(planData) {
    try {
      return JSON.stringify(migratePlanData(planData));
    } catch {
      return "";
    }
  }

  function isBundledSamplePlan(planData) {
    if (!planData) return false;
    const current = stablePlanJson(planData);
    if (!current) return false;
    return (DATA.samplePlans || [])
      .some((sample) => stablePlanJson(sample.plan) === current);
  }

  function hasMeaningfulPersonalPlanData(planData) {
    if (!planData || isBundledSamplePlan(planData)) return false;
    const personal = planData.personal || {};
    const personalEntered = [
      personal.person1Name,
      personal.person2Name,
      personal.person1Age,
      personal.person2Age,
    ].some((value) => String(value || "").trim() && Number(value) !== 0);
    const collectionHasValues = (items, amountKeys) => Array.isArray(items) && items.some((item) => (
      String(item?.name || "").trim() && amountKeys.some((key) => Number(item?.[key]) > 0)
    ));
    return Boolean(
      personalEntered ||
      collectionHasValues(planData.incomeItems, ["amount"]) ||
      collectionHasValues(planData.assetItems, ["value"]) ||
      collectionHasValues(planData.liabilityItems, ["balance", "repaymentAmount"]) ||
      collectionHasValues(planData.expenseItems, ["amount"]) ||
      collectionHasValues(planData.goalItems, ["targetAmount"]) ||
      Number(planData.goals?.annualLifestyleSpending || planData.goals?.targetAnnualSpending) > 0 ||
      Number(planData.investments?.annualContribution || planData.investments?.annualInvestingTarget) > 0 ||
      Number(planData.super?.person1Balance || planData.super?.person2Balance || planData.super?.extraContributions) > 0
    );
  }

  function hasUserSavedScenario() {
    try {
      const raw = localStorage.getItem(SCENARIO_KEY);
      if (!raw) return false;
      return migrateScenarioList(JSON.parse(raw)).some((scenario) => (
        scenario.source !== "sample" && hasMeaningfulPersonalPlanData(scenario.plan)
      ));
    } catch {
      return false;
    }
  }

  function inferHasCreatedPersonalPlan(savedPlan) {
    return Boolean(
      restoredDraftUi.hasCreatedPersonalPlan ||
      hasMeaningfulPersonalPlanData(savedPlan) ||
      hasUserSavedScenario()
    );
  }

  function loadUserState(savedPlan) {
    let loaded = {};
    try {
      const raw = localStorage.getItem(USER_STATE_KEY);
      loaded = raw ? JSON.parse(raw) : {};
    } catch {
      loaded = {};
    }
    const hasCreatedPersonalPlan = Boolean(loaded.hasCreatedPersonalPlan || inferHasCreatedPersonalPlan(savedPlan));
    const state = {
      version: 1,
      hasCreatedPersonalPlan,
      createdAt: loaded.createdAt || (hasCreatedPersonalPlan ? new Date().toISOString() : ""),
      updatedAt: loaded.updatedAt || "",
    };
    if (hasCreatedPersonalPlan !== Boolean(loaded.hasCreatedPersonalPlan)) persistUserState(state);
    return state;
  }

  function persistUserState(nextState = userState) {
    try {
      localStorage.setItem(USER_STATE_KEY, JSON.stringify({
        version: 1,
        ...nextState,
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      // The app can still run without browser storage; the intro simply behaves like a first visit.
    }
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function positiveNumber(value) {
    return numberValue(value) > 0;
  }

  function nonEmptyText(value) {
    return String(value || "").trim().length > 0;
  }

  function collectionTotal(items, amountKey = "amount") {
    return Array.isArray(items)
      ? items.reduce((total, item) => total + numberValue(item?.[amountKey]), 0)
      : 0;
  }

  function annualCollectionTotal(items, amountKey = "amount") {
    return Array.isArray(items)
      ? items.reduce((total, item) => total + annualValue(item?.[amountKey], item?.frequency || item?.repaymentFrequency || "annually"), 0)
      : 0;
  }

  function categoryTotal(items, categories, amountKey = "value") {
    const categorySet = new Set(categories);
    return Array.isArray(items)
      ? items.reduce((total, item) => total + (categorySet.has(item?.category || item?.type) ? numberValue(item?.[amountKey]) : 0), 0)
      : 0;
  }

  function hasCollectionValue(items, keys = ["amount"]) {
    return Array.isArray(items) && items.some((item) => keys.some((key) => positiveNumber(item?.[key])));
  }

  function firstProjectedAgeAtProgress(result, threshold) {
    const row = (result.financialFreedomProgressProjection || []).find((item) => numberValue(item.progress) >= threshold);
    return row?.age ? `Age ${row.age}` : "Not yet projected by the app";
  }

  function isFinancialPlanComplete(planData, resultInput) {
    const planCandidate = migratePlanData(planData || plan);
    const result = resultInput || CALC.calculatePlan(planCandidate);
    const personal = planCandidate.personal || {};
    const investing = planCandidate.investing || {};
    const assets = planCandidate.assets || {};
    const liabilities = planCandidate.liabilities || {};
    const hasAnyAge = positiveNumber(personal.person1Age) || positiveNumber(personal.person2Age);
    const hasTargetAge = positiveNumber(personal.fullRetirementAge) || positiveNumber(personal.semiRetirementAge) || positiveNumber(personal.workOptionalAge);
    const hasIncome = hasCollectionValue(planCandidate.incomeItems, ["amount"]) || positiveNumber(result.annualGrossIncome);
    const hasExpenses = hasCollectionValue(planCandidate.expenseItems, ["amount"]) || positiveNumber(result.annualLivingExpenses);
    const hasDebtData = hasCollectionValue(planCandidate.liabilityItems, ["balance", "repaymentAmount", "repayment"])
      || positiveNumber(liabilities.homeLoanBalance)
      || positiveNumber(liabilities.monthlyRepayment)
      || positiveNumber(liabilities.otherDebts)
      || positiveNumber(liabilities.creditCardBalance)
      || positiveNumber(liabilities.hecsHelpDebt)
      || positiveNumber(result.annualDebtRepayments);
    const hasAssets = hasCollectionValue(planCandidate.assetItems, ["value"]) || positiveNumber(result.totalAssets);
    const hasCashOrOffset = categoryTotal(planCandidate.assetItems, ["cash", "offset"]) > 0
      || positiveNumber(assets.cash)
      || positiveNumber(assets.offsetBalance);
    const hasInvestmentsOutsideSuper = categoryTotal(planCandidate.assetItems, ["shares", "crypto", "other"], "value") > 0
      || positiveNumber(assets.sharesEtfs)
      || positiveNumber(assets.crypto)
      || positiveNumber(result.investmentBalance);
    const hasSuper = categoryTotal(planCandidate.assetItems, ["super"]) > 0
      || positiveNumber(assets.superPerson1)
      || positiveNumber(assets.superPerson2)
      || positiveNumber(result.superannuationBalance);
    const hasProjections = positiveNumber(result.targetCapital)
      && Array.isArray(result.netWorthProjection)
      && result.netWorthProjection.length > 0
      && Array.isArray(result.financialFreedomProgressProjection)
      && result.financialFreedomProgressProjection.length > 0;
    const hasAssumptions = positiveNumber(investing.expectedInvestmentReturnPct)
      && positiveNumber(investing.expectedSuperReturnPct)
      && positiveNumber(investing.inflationPct)
      && positiveNumber(investing.safeWithdrawalRatePct);
    const checks = [
      { label: "Household ages", complete: hasAnyAge, message: "Add at least one household age." },
      { label: "Financial Freedom target age", complete: hasTargetAge, message: "Add your target Financial Freedom age." },
      { label: "Annual lifestyle spending", complete: positiveNumber(personal.targetAnnualSpending), message: "Add the annual lifestyle spending needed for Financial Freedom." },
      { label: "Income", complete: hasIncome, message: "Add household income." },
      { label: "Lifestyle expenses", complete: hasExpenses, message: "Add lifestyle expenses." },
      { label: "Mortgage and debt repayments", complete: hasDebtData, message: "Add mortgage, debt or repayment details." },
      { label: "Assets", complete: hasAssets, message: "Add current assets." },
      { label: "Liabilities", complete: hasDebtData, message: "Confirm liabilities and debts, even if they are low." },
      { label: "Cash or offset balances", complete: hasCashOrOffset, message: "Add cash or offset balances." },
      { label: "Investments outside super", complete: hasInvestmentsOutsideSuper, message: "Add investments outside super." },
      { label: "Superannuation", complete: hasSuper, message: "Add superannuation balances." },
      { label: "Current projections", complete: hasProjections, message: "Complete enough plan details for projections to calculate." },
      { label: "Investment and inflation assumptions", complete: hasAssumptions, message: "Review investment, super, inflation and withdrawal-rate assumptions." },
    ];
    const missing = checks.filter((item) => !item.complete);
    return {
      complete: missing.length === 0,
      missingSections: missing.map((item) => item.label),
      message: missing.length
        ? `Complete these sections to unlock AI Insights: ${missing.map((item) => item.label).join(", ")}.`
        : "Your plan has enough information to generate AI Insights.",
      missingMessages: missing.map((item) => item.message),
    };
  }

  function buildFinancialPlanSummary(planData) {
    const planCandidate = migratePlanData(planData || plan);
    const result = CALC.calculatePlan(planCandidate);
    const personal = planCandidate.personal || {};
    const incomeItems = Array.isArray(planCandidate.incomeItems) ? planCandidate.incomeItems : [];
    const expenseItems = Array.isArray(planCandidate.expenseItems) ? planCandidate.expenseItems : [];
    const assetItems = Array.isArray(planCandidate.assetItems) ? planCandidate.assetItems : [];
    const liabilityItems = Array.isArray(planCandidate.liabilityItems) ? planCandidate.liabilityItems : [];
    const assets = planCandidate.assets || {};
    const liabilities = planCandidate.liabilities || {};
    const investing = planCandidate.investing || {};
    const homeLoan = liabilityItems.find((item) => item.type === "homeLoan") || {};
    const creditCard = liabilityItems.find((item) => item.type === "creditCard") || {};
    const otherDebtsFromCollections = liabilityItems
      .filter((item) => !["homeLoan", "creditCard", "hecsHelp"].includes(item.type))
      .reduce((total, item) => total + numberValue(item.balance), 0);
    const cashAndOffsets = numberValue(assets.cash)
      + numberValue(assets.offsetBalance)
      + categoryTotal(assetItems, ["cash", "offset"]);
    const investmentsOutsideSuper = numberValue(assets.sharesEtfs)
      + numberValue(assets.crypto)
      + categoryTotal(assetItems, ["shares", "crypto", "other"]);
    const superannuation = numberValue(assets.superPerson1)
      + numberValue(assets.superPerson2)
      + categoryTotal(assetItems, ["super"]);
    const estimatedFreedomAge = targetAgeOutcome(result);
    return {
      version: 1,
      appVersion: APP_VERSION,
      household: {
        source: "user-entered",
        person1Age: numberValue(personal.person1Age),
        person2Age: numberValue(personal.person2Age),
        numberOfDependants: numberValue(personal.dependants || personal.children || 0),
      },
      goals: {
        source: "user-entered and app-calculated",
        targetFinancialFreedomAge: numberValue(personal.fullRetirementAge || personal.semiRetirementAge || personal.workOptionalAge),
        targetAnnualRetirementSpending: numberValue(personal.targetAnnualSpending),
        emergencyFundTarget: numberValue((planCandidate.goalItems || []).find((item) => /emergency/i.test(item.name || ""))?.targetAmount || result.annualLivingExpenses / 4 || 0),
        primaryGoal: "Financial Freedom",
        targetFiCapitalCalculatedByApp: numberValue(result.targetCapital),
      },
      income: {
        source: "user-entered income, app-calculated tax and cashflow",
        combinedGrossIncome: numberValue(result.annualGrossIncome || annualCollectionTotal(incomeItems)),
        estimatedCombinedNetIncomeAfterTaxAndHelp: numberValue(result.netIncomeAfterTaxHelp),
        expectedIncomeGrowth: numberValue(investing.incomeGrowthPct || 0),
      },
      expenses: {
        source: "user-entered expenses and app-calculated annual cashflow",
        annualLifestyleExpenses: numberValue(result.annualLivingExpenses || annualCollectionTotal(expenseItems)),
        mortgageRepayments: numberValue(result.annualMortgageRepayments),
        otherDebtRepayments: numberValue(result.annualDebtRepayments - result.annualMortgageRepayments),
        calculatedAnnualSurplusBeforeInvesting: numberValue(result.cashSurplusBeforeInvesting),
        calculatedFinalAnnualSurplus: numberValue(result.finalProjectedCashSurplus),
      },
      assets: {
        source: "user-entered",
        home: numberValue(assets.homeValue || categoryTotal(assetItems, ["home"])),
        otherProperty: numberValue(assets.otherPropertyValue || categoryTotal(assetItems, ["otherProperty"])),
        cashAndOffsets,
        investmentsOutsideSuper,
        superannuation,
        totalAssetsCalculatedByApp: numberValue(result.totalAssets),
      },
      liabilities: {
        source: "user-entered and app-calculated",
        homeLoan: numberValue(liabilities.homeLoanBalance || homeLoan.balance),
        otherDebts: numberValue(liabilities.otherDebts) + otherDebtsFromCollections,
        creditCardDebt: numberValue(liabilities.creditCardBalance || creditCard.balance),
        hecsHelpDebt: numberValue(liabilities.hecsHelpDebt),
        totalLiabilitiesCalculatedByApp: numberValue(result.totalLiabilities),
        homeLoanInterestRatePct: numberValue(liabilities.homeLoanInterestRatePct || homeLoan.interestRatePct),
        homeLoanRemainingTermYears: numberValue(liabilities.loanTermYears || homeLoan.termYears),
      },
      currentProjections: {
        source: "app-calculated",
        currentNetWorth: numberValue(result.currentNetWorth),
        currentFinancialIndependenceAssets: numberValue(result.financialIndependenceAssets),
        accessibleInvestmentAssets: numberValue(result.accessibleInvestmentAssets),
        estimatedAnnualPassiveIncome: numberValue(result.financialIndependenceAssets * (numberValue(investing.safeWithdrawalRatePct) / 100)),
        financialFreedomProgressPct: numberValue(result.financialFreedomScore),
        estimatedFinancialIndependenceAge: firstProjectedAgeAtProgress(result, 75),
        estimatedFinancialFreedomAge: estimatedFreedomAge,
        projectedRetirementAssets: numberValue(result.totalRetirementAssets),
        emergencyFundCoverageMonths: result.annualLivingExpenses ? Math.round((cashAndOffsets / result.annualLivingExpenses) * 12) : 0,
      },
      assumptions: {
        source: "user-entered assumptions and app tax assumptions",
        investmentReturnPct: numberValue(investing.expectedInvestmentReturnPct),
        inflationPct: numberValue(investing.inflationPct),
        superReturnPct: numberValue(investing.expectedSuperReturnPct),
        employerSuperContributions: numberValue(investing.employerSuperContributions),
        safeWithdrawalRatePct: numberValue(investing.safeWithdrawalRatePct),
        taxYear: "2026-27",
        medicareLevyPct: 2,
        concessionalSuperContributionsTaxPct: 15,
      },
    };
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function simpleHash(value) {
    const input = typeof value === "string" ? value : stableStringify(value);
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function currentAiInsightsSettings() {
    ensurePlanSettings(plan);
    return plan.reportSettings.aiInsights;
  }

  function currentPlanInsightsHash() {
    return simpleHash(buildFinancialPlanSummary(plan));
  }

  function validateAiInsightsReport(report) {
    if (!report || typeof report !== "object") return null;
    const allowedRatings = new Set(["Strong", "Stable", "Needs Attention", "Insufficient Information"]);
    const normaliseList = (items, mapper) => Array.isArray(items) ? items.map(mapper).filter(Boolean).slice(0, 8) : [];
    const stringList = (items) => Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8) : [];
    const strengths = normaliseList(report.strengths, (item) => ({
      title: String(item?.title || "").trim(),
      explanation: String(item?.explanation || "").trim(),
    })).filter((item) => item.title && item.explanation);
    const pressurePoints = normaliseList(report.pressurePoints, (item) => ({
      title: String(item?.title || "").trim(),
      explanation: String(item?.explanation || "").trim(),
      importance: ["High", "Medium", "Low"].includes(item?.importance) ? item.importance : "Medium",
    })).filter((item) => item.title && item.explanation);
    const rankedOpportunities = normaliseList(report.rankedOpportunities, (item, index) => ({
      rank: Number(item?.rank) || index + 1,
      title: String(item?.title || "").trim(),
      explanation: String(item?.explanation || "").trim(),
      potentialImpact: ["High", "Medium", "Low"].includes(item?.potentialImpact) ? item.potentialImpact : "Medium",
      complexity: ["Low", "Medium", "High"].includes(item?.complexity) ? item.complexity : "Medium",
      tradeOffs: stringList(item?.tradeOffs),
    })).filter((item) => item.title && item.explanation);
    const suggestedScenarios = normaliseList(report.suggestedScenarios, (item) => ({
      title: String(item?.title || "").trim(),
      reason: String(item?.reason || "").trim(),
      scenarioInputs: stringList(item?.scenarioInputs),
      disclaimer: String(item?.disclaimer || "").trim(),
    })).filter((item) => item.title && item.reason);
    const actionPlan = {
      next30Days: stringList(report.actionPlan?.next30Days),
      next12Months: stringList(report.actionPlan?.next12Months),
      longerTerm: stringList(report.actionPlan?.longerTerm),
    };
    const rating = allowedRatings.has(report.overallPosition?.rating) ? report.overallPosition.rating : "Stable";
    const summary = String(report.overallPosition?.summary || "").trim();
    if (!summary) return null;
    return {
      generatedAt: report.generatedAt || new Date().toISOString(),
      overallPosition: { rating, summary },
      strengths,
      pressurePoints,
      rankedOpportunities,
      suggestedScenarios,
      actionPlan,
      missingInformation: stringList(report.missingInformation),
      importantConsiderations: stringList(report.importantConsiderations),
      disclaimer: String(report.disclaimer || "This report provides general educational information and scenario guidance based on the information and assumptions entered into the app. It does not take into account all matters that may be relevant to your circumstances and does not constitute personal financial product, taxation, legal or credit advice. Projections are estimates only and actual outcomes may vary. Consider obtaining advice from an appropriately licensed professional before acting on financial decisions.").trim(),
    };
  }

  function markPersonalPlanCreated() {
    if (userState.hasCreatedPersonalPlan) return;
    userState = {
      ...userState,
      hasCreatedPersonalPlan: true,
      createdAt: userState.createdAt || new Date().toISOString(),
    };
    persistUserState();
  }

  function hasSavedDraft() {
    try {
      return Boolean(localStorage.getItem(DRAFT_KEY));
    } catch {
      return false;
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        restoredDraftUi = {};
        return null;
      }
      const saved = JSON.parse(raw);
      if (saved?.plan) {
        restoredDraftUi = saved.ui || {};
        return migratePlanData(saved.plan);
      }
      restoredDraftUi = {};
      return migratePlanData(saved);
    } catch {
      restoredDraftUi = {};
      return null;
    }
  }

  function persistDraft() {
    const savedAt = new Date().toISOString();
    const ui = collectDraftUi();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      version: 3,
      appVersion: APP_VERSION,
      savedAt,
      plan: migratePlanData(plan),
      ui,
    }));
    localStorage.setItem(LAST_SAVED_KEY, savedAt);
    restoredDraftUi = ui;
    return savedAt;
  }

  function saveDraft(message = "") {
    persistDraft();
    updateSaveStatus(message);
  }

  function autosavePlan() {
    markPersonalPlanCreated();
    updateSaveStatus("Saving...");
    persistDraft();
    renderSamplePlanOptions();
    window.clearTimeout(saveStatusTimer);
    saveStatusTimer = window.setTimeout(() => {
      updateSaveStatus("All changes saved");
      saveStatusTimer = window.setTimeout(() => updateSaveStatus(), 1800);
    }, 180);
  }

  function formatLastSaved(value) {
    if (!value) return "Not saved yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not saved yet";
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return `${isToday ? "Today" : date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function updateSaveStatus(message = "") {
    const lastSaved = localStorage.getItem(LAST_SAVED_KEY);
    const formatted = formatLastSaved(lastSaved);
    const text = message || (lastSaved ? `Last saved: ${formatted}` : "Not saved yet.");
    const status = document.getElementById("wizardSaveStatus");
    if (status) status.textContent = text;
    const headerStatus = document.getElementById("headerSaveStatus");
    if (headerStatus) headerStatus.textContent = text;
    const lastSavedLabel = document.getElementById("lastSavedLabel");
    if (lastSavedLabel) lastSavedLabel.textContent = `Last Saved: ${formatted}`;
  }

  function manualSavePlan() {
    syncCollectionsToLegacy();
    saveCurrentPlanAsScenario({ promptForName: true });
  }

  function loadScenarios() {
    try {
      const raw = localStorage.getItem(SCENARIO_KEY);
      return raw ? migrateScenarioList(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  function saveScenarios(scenarios) {
    localStorage.setItem(SCENARIO_KEY, JSON.stringify(migrateScenarioList(scenarios)));
  }

  function loadWeeklyPlan() {
    try {
      const raw = localStorage.getItem(WEEKLY_PLAN_KEY);
      return raw ? window.FFSWeeklyPlan.migrate(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function saveWeeklyPlan(message = "") {
    if (!weeklyPlan) {
      localStorage.removeItem(WEEKLY_PLAN_KEY);
      return;
    }
    weeklyPlan.updatedAt = new Date().toISOString();
    localStorage.setItem(WEEKLY_PLAN_KEY, JSON.stringify(window.FFSWeeklyPlan.migrate(weeklyPlan)));
    if (message) updateSaveStatus(message);
  }

  function resetWeeklyPlanStorage(message = "Weekly Plan reset.") {
    weeklyPlan = null;
    generatedWeeklyPlanner = null;
    weeklyEditingWeek = null;
    weeklyViewedWeekNumber = null;
    weeklyPlanUiState.isTimingSetupExpanded = null;
    editingTimingItemId = null;
    timingEditDraft = null;
    localStorage.removeItem(WEEKLY_PLAN_KEY);
    updateSaveStatus(message);
  }

  function householdNameForFile() {
    const names = [plan.personal?.person1Name, plan.personal?.person2Name]
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    return names.length ? names.join("-and-") : "Current-Plan";
  }

  function safeFilename(value, extension) {
    const base = String(value || "Financial-Freedom")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "Financial-Freedom";
    return `${base}.${extension}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function exportPlanJson() {
    syncCollectionsToLegacy();
    const payload = {
      app: "Financial Freedom",
      type: "financial-freedom-plan-export",
      appVersion: APP_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      storageKeys: {
        draft: DRAFT_KEY,
        scenarios: SCENARIO_KEY,
        weeklyPlan: WEEKLY_PLAN_KEY,
        userState: USER_STATE_KEY,
      },
      plan: migratePlanData(plan),
      scenarios: loadScenarios(),
      weeklyPlan: weeklyPlan ? window.FFSWeeklyPlan.migrate(weeklyPlan) : null,
      ui: collectDraftUi(),
      userState,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    downloadBlob(blob, safeFilename(`Financial-Freedom-Plan-${householdNameForFile()}`, "json"));
    updateSaveStatus("Plan exported as a JSON backup.");
  }

  function validateImportedPlanPayload(payload) {
    if (!payload || typeof payload !== "object") throw new Error("The selected file is not a valid Financial Freedom plan export.");
    const rawPlan = payload.plan || (payload.personal || payload.assets ? payload : null);
    if (!rawPlan || typeof rawPlan !== "object") throw new Error("No plan data was found in the selected file.");
    return {
      plan: migratePlanData(rawPlan),
      scenarios: migrateScenarioList(payload.scenarios || []),
      weeklyPlan: payload.weeklyPlan ? window.FFSWeeklyPlan.migrate(payload.weeklyPlan) : null,
      ui: payload.ui && typeof payload.ui === "object" ? payload.ui : {},
      userState: payload.userState && typeof payload.userState === "object" ? payload.userState : {},
      exportedAt: payload.exportedAt || "",
    };
  }

  function importPlanPayload(payload) {
    let imported;
    try {
      imported = validateImportedPlanPayload(payload);
    } catch (error) {
      updateSaveStatus(error.message || "Import failed. The file was not changed.");
      return;
    }
    const confirmed = window.confirm("Import this plan backup? This will replace the current plan and saved scenarios on this device.");
    if (!confirmed) {
      updateSaveStatus("Import cancelled.");
      return;
    }
    plan = imported.plan;
    generatedWeeklyPlanner = null;
    weeklyPlan = imported.weeklyPlan;
    restoredDraftUi = imported.ui || {};
    if (imported.userState?.hasCreatedPersonalPlan || restoredDraftUi.hasCreatedPersonalPlan || !isBundledSamplePlan(imported.plan)) {
      markPersonalPlanCreated();
    }
    saveScenarios(imported.scenarios);
    if (weeklyPlan) saveWeeklyPlan();
    else localStorage.removeItem(WEEKLY_PLAN_KEY);
    saveDraft("Plan imported successfully.");
    renderAll();
    showWorkspace(activeView || "dashboard");
    updateSaveStatus("Plan imported successfully.");
  }

  function importPlanJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPlanPayload(JSON.parse(String(reader.result || "")));
      } catch {
        updateSaveStatus("Import failed. Choose a valid Financial Freedom JSON export.");
      }
    };
    reader.onerror = () => updateSaveStatus("Import failed. The selected file could not be read.");
    reader.readAsText(file);
  }

  function triggerImportPlanJson() {
    const input = document.getElementById("planImportJsonInput");
    if (!input) return;
    input.value = "";
    input.click();
  }

  function selectedSamplePlan() {
    const plans = DATA.samplePlans || [{ id: "sample", name: "Sample Plan", plan: DATA.demoPlan }];
    return plans.find((item) => item.id === selectedSamplePlanId) || plans[0];
  }

  function renderSamplePlanOptions() {
    const plans = DATA.samplePlans || [];
    const options = plans.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === selectedSamplePlanId ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    const menuOptions = plans
      .map((item) => `<button type="button" data-sample-plan-choice="${escapeHtml(item.id)}"${item.id === selectedSamplePlanId ? ' aria-current="true"' : ""}>${escapeHtml(item.name)}</button>`)
      .join("");
    document.querySelectorAll("[data-sample-plan-select]").forEach((select) => {
      select.innerHTML = options;
      select.value = selectedSamplePlanId;
    });
    document.querySelectorAll("[data-sample-plan-menu]").forEach((panel) => {
      panel.innerHTML = menuOptions;
    });
    const summary = document.getElementById("samplePlanSummary");
    const sample = selectedSamplePlan();
    if (summary) summary.textContent = sample?.description || "Explore realistic examples before creating your own plan.";
    const introSampleActions = document.getElementById("introSampleActions");
    if (introSampleActions) introSampleActions.classList.toggle("hidden", Boolean(userState.hasCreatedPersonalPlan));
    const continuePanel = document.getElementById("continuePanel");
    if (continuePanel) continuePanel.classList.toggle("hidden", !hasSavedDraft());
  }

  async function loadAiInsightsConfig() {
    if (aiInsightsConfig.configLoaded && aiInsightsConfig.enabled) {
      renderOutputs();
      return;
    }
    try {
      const response = await fetch(AI_INSIGHTS_ENDPOINT, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        aiInsightsConfig = { ...aiInsightsConfig, enabled: false, configLoaded: true };
        renderOutputs();
        return;
      }
      const config = await response.json();
      aiInsightsConfig = {
        enabled: Boolean(config.enabled),
        configLoaded: true,
        maxGenerations: Number(config.maxGenerations) || AI_INSIGHTS_DEFAULT_MAX_GENERATIONS,
        cooldownMs: Number(config.cooldownMs) || AI_INSIGHTS_DEFAULT_COOLDOWN_MS,
      };
    } catch {
      aiInsightsConfig = { ...aiInsightsConfig, enabled: Boolean(window.FFS_ENABLE_AI_INSIGHTS), configLoaded: true };
    }
    renderOutputs();
  }

  function renderAiInsightsHomeCard(result) {
    const card = document.getElementById("aiInsightsHomeCard");
    if (!card) return;
    if (!aiInsightsConfig.enabled) {
      card.classList.add("hidden");
      return;
    }
    const completion = isFinancialPlanComplete(plan, result);
    card.classList.remove("hidden");
    card.classList.toggle("ai-insights-card-locked", !completion.complete);
    card.classList.toggle("ai-insights-card-active", completion.complete);
    card.setAttribute("aria-disabled", completion.complete ? "false" : "true");
    card.setAttribute("role", completion.complete ? "button" : "group");
    card.tabIndex = completion.complete ? 0 : -1;
    const missingPreview = completion.missingSections.slice(0, 3).join(", ");
    card.innerHTML = `
      <span class="ai-beta-label">Private Beta</span>
      <h3>AI Financial Freedom Insights</h3>
      <p>Receive a personalised explanation of your financial position, identify your biggest opportunities and explore strategies that may help you reach financial freedom sooner.</p>
      ${completion.complete
        ? `<button class="btn btn-primary mt-4" type="button" data-ai-insights-action="open">Open AI Insights</button>`
        : `<div class="ai-locked-note">
            <strong>Complete your financial plan to unlock AI Insights.</strong>
            <small>${escapeHtml(missingPreview ? `Still needed: ${missingPreview}.` : completion.message)}</small>
          </div>`}
    `;
  }

  function ensureAiInsightsModal() {
    let modal = document.getElementById("aiInsightsModal");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="ai-insights-modal hidden" id="aiInsightsModal" role="dialog" aria-modal="true" aria-labelledby="aiInsightsTitle">
        <button class="ai-insights-backdrop" type="button" data-ai-insights-action="close" aria-label="Close AI insights"></button>
        <article class="ai-insights-panel">
          <button class="goal-info-close" type="button" data-ai-insights-action="close" aria-label="Close">X</button>
          <div id="aiInsightsModalBody"></div>
        </article>
      </div>
    `);
    return document.getElementById("aiInsightsModal");
  }

  function aiUsageLimitMessage() {
    const settings = currentAiInsightsSettings();
    const usage = settings.usage || {};
    const maxGenerations = Number(aiInsightsConfig.maxGenerations) || AI_INSIGHTS_DEFAULT_MAX_GENERATIONS;
    const cooldownMs = Number(aiInsightsConfig.cooldownMs) || AI_INSIGHTS_DEFAULT_COOLDOWN_MS;
    const count = Number(usage.count) || 0;
    if (count >= maxGenerations) return `Private beta limit reached for this plan. You can still review your saved insights.`;
    if (usage.lastGeneratedAt) {
      const elapsed = Date.now() - new Date(usage.lastGeneratedAt).getTime();
      if (Number.isFinite(elapsed) && elapsed < cooldownMs) {
        const seconds = Math.ceil((cooldownMs - elapsed) / 1000);
        return `Please wait ${seconds} seconds before generating another review.`;
      }
    }
    return "";
  }

  function aiScenarioTarget(title, inputs = []) {
    const text = `${title} ${inputs.join(" ")}`.toLowerCase();
    if (/super|salary sacrifice|concessional/.test(text)) return "super";
    if (/mortgage|loan|debt|offset|repay/.test(text)) return "decision";
    if (/spend|retirement spending|lifestyle|target age|age/.test(text)) return "goals";
    if (/income|work|salary/.test(text)) return "setup";
    if (/invest|share|etf|portfolio/.test(text)) return "investments";
    return "decision";
  }

  function renderAiInsightList(items, className = "") {
    if (!items?.length) return `<p class="ai-empty-note">No specific items were returned for this section.</p>`;
    return `<div class="ai-card-list ${className}">${items.map((item) => `
      <article class="ai-result-card">
        <div class="ai-result-card-heading">
          <h4>${escapeHtml(item.title)}</h4>
          ${item.importance ? `<span class="ai-chip">${escapeHtml(item.importance)}</span>` : ""}
          ${item.potentialImpact ? `<span class="ai-chip">${escapeHtml(item.potentialImpact)} impact</span>` : ""}
        </div>
        <p>${escapeHtml(item.explanation || item.reason || "")}</p>
        ${item.tradeOffs?.length ? `<ul>${item.tradeOffs.map((tradeOff) => `<li>${escapeHtml(tradeOff)}</li>`).join("")}</ul>` : ""}
      </article>
    `).join("")}</div>`;
  }

  function renderAiInsightsReport(report) {
    if (!report) return "";
    return `
      <section class="ai-results">
        <div class="ai-report-section">
          <span class="metric-label">Overall Position</span>
          <article class="ai-overall-card">
            <span class="ai-rating">${escapeHtml(report.overallPosition.rating)}</span>
            <p>${escapeHtml(report.overallPosition.summary)}</p>
          </article>
        </div>
        <div class="ai-report-section">
          <h3>Your Financial Strengths</h3>
          ${renderAiInsightList(report.strengths)}
        </div>
        <div class="ai-report-section">
          <h3>What May Be Slowing Your Progress</h3>
          ${renderAiInsightList(report.pressurePoints)}
        </div>
        <div class="ai-report-section">
          <h3>Highest-Priority Opportunities</h3>
          ${renderAiInsightList(report.rankedOpportunities)}
        </div>
        <div class="ai-report-section">
          <h3>Scenarios Worth Exploring</h3>
          ${report.suggestedScenarios?.length ? report.suggestedScenarios.map((scenario) => {
            const target = aiScenarioTarget(scenario.title, scenario.scenarioInputs);
            return `
              <article class="ai-result-card">
                <div class="ai-result-card-heading">
                  <h4>${escapeHtml(scenario.title)}</h4>
                  <span class="ai-chip">Scenario</span>
                </div>
                <p>${escapeHtml(scenario.reason)}</p>
                ${scenario.scenarioInputs?.length ? `<ul>${scenario.scenarioInputs.map((input) => `<li>${escapeHtml(input)}</li>`).join("")}</ul>` : ""}
                ${scenario.disclaimer ? `<small>${escapeHtml(scenario.disclaimer)}</small>` : ""}
                <button class="btn mt-3" type="button" data-ai-scenario-target="${escapeHtml(target)}">Explore This Scenario</button>
              </article>
            `;
          }).join("") : `<p class="ai-empty-note">No scenario suggestions were returned.</p>`}
        </div>
        <div class="ai-report-section">
          <h3>Suggested Action Plan</h3>
          <div class="ai-action-grid">
            <article><h4>Next 30 Days</h4><ul>${report.actionPlan.next30Days.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Review your plan details.</li>"}</ul></article>
            <article><h4>Next 12 Months</h4><ul>${report.actionPlan.next12Months.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Model one practical scenario.</li>"}</ul></article>
            <article><h4>Longer Term</h4><ul>${report.actionPlan.longerTerm.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Review assumptions regularly.</li>"}</ul></article>
          </div>
        </div>
        <div class="ai-report-section">
          <h3>Important Considerations</h3>
          <ul>${[...(report.missingInformation || []), ...(report.importantConsiderations || [])].map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Actual outcomes may vary from the assumptions used.</li>"}</ul>
        </div>
        <div class="ai-disclaimer">
          <h3>General Information Disclaimer</h3>
          <p>${escapeHtml(report.disclaimer)}</p>
        </div>
      </section>
    `;
  }

  function renderAiInsightsModal() {
    const modal = ensureAiInsightsModal();
    modal.classList.toggle("hidden", !aiInsightsUi.isOpen);
    if (!aiInsightsUi.isOpen) return;
    const body = document.getElementById("aiInsightsModalBody");
    if (!body) return;
    const result = CALC.calculatePlan(plan);
    const completion = isFinancialPlanComplete(plan, result);
    const settings = currentAiInsightsSettings();
    const report = validateAiInsightsReport(settings.report);
    const currentHash = currentPlanInsightsHash();
    const isStale = Boolean(report && settings.planHash && settings.planHash !== currentHash);
    const limitMessage = aiUsageLimitMessage();
    const canGenerate = completion.complete
      && aiInsightsUi.consentAccepted
      && !aiInsightsUi.isLoading
      && !limitMessage;
    body.innerHTML = `
      <div class="ai-modal-header">
        <div>
          <span class="ai-beta-label">Private Beta</span>
          <h2 id="aiInsightsTitle">Your Financial Freedom Insights</h2>
          <p>Your financial plan will be securely analysed to provide educational insights, highlight financial pressure points and suggest scenarios you may wish to explore.</p>
        </div>
      </div>
      <div class="ai-privacy-note">
        <strong>Privacy notice</strong>
        <p>Only an anonymous financial summary is sent for review. Names, contact details, account numbers, tax file numbers and unrelated personal notes are not included.</p>
        <p>For your privacy, do not enter names, account numbers, tax file numbers or other identifying information into free-text fields.</p>
      </div>
      ${completion.complete ? "" : `<div class="ai-warning"><strong>Complete your financial plan to unlock AI Insights.</strong><p>${escapeHtml(completion.message)}</p></div>`}
      ${isStale ? `<div class="ai-warning"><strong>Your financial plan has changed since these insights were generated.</strong><p>Generate a new review to reflect your updated position.</p></div>` : ""}
      ${aiInsightsUi.error ? `<div class="ai-error"><strong>AI Insights could not be generated.</strong><p>${escapeHtml(aiInsightsUi.error)}</p></div>` : ""}
      <label class="ai-consent">
        <input id="aiInsightsConsent" type="checkbox"${aiInsightsUi.consentAccepted ? " checked" : ""}>
        <span>I understand that this report provides general educational information and scenario guidance only. It does not provide personal financial product advice or replace advice from a licensed financial adviser.</span>
      </label>
      <div class="ai-actions">
        <button class="btn btn-primary" type="button" data-ai-insights-action="generate" ${canGenerate ? "" : "disabled"}>
          ${aiInsightsUi.isLoading ? "Generating..." : report ? "Regenerate My Insights" : "Generate My Insights"}
        </button>
        ${limitMessage ? `<small>${escapeHtml(limitMessage)}</small>` : ""}
      </div>
      ${aiInsightsUi.isLoading ? `<div class="ai-loading" role="status">Reviewing your plan and preparing your private beta insights...</div>` : ""}
      ${report ? `<p class="ai-generated-time">Generated ${escapeHtml(formatLastSaved(report.generatedAt))}</p>${renderAiInsightsReport(report)}` : ""}
    `;
  }

  function openAiInsights() {
    if (!aiInsightsConfig.enabled) return;
    const completion = isFinancialPlanComplete(plan, CALC.calculatePlan(plan));
    if (!completion.complete) {
      updateSaveStatus(completion.message);
      renderAiInsightsHomeCard(CALC.calculatePlan(plan));
      return;
    }
    aiInsightsUi.isOpen = true;
    aiInsightsUi.error = "";
    renderAiInsightsModal();
  }

  function closeAiInsightsModal() {
    aiInsightsUi.isOpen = false;
    renderAiInsightsModal();
  }

  async function generateAiInsights() {
    if (aiInsightsUi.isLoading) return;
    const result = CALC.calculatePlan(plan);
    const completion = isFinancialPlanComplete(plan, result);
    if (!completion.complete) {
      aiInsightsUi.error = completion.message;
      renderAiInsightsModal();
      return;
    }
    const limitMessage = aiUsageLimitMessage();
    if (limitMessage) {
      aiInsightsUi.error = limitMessage;
      renderAiInsightsModal();
      return;
    }
    const summary = buildFinancialPlanSummary(plan);
    const planHash = simpleHash(summary);
    aiInsightsUi.isLoading = true;
    aiInsightsUi.error = "";
    renderAiInsightsModal();
    try {
      const response = await fetch(AI_INSIGHTS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          planSummary: summary,
          planHash,
          requestedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The AI service was not available. Please try again later.");
      const validated = validateAiInsightsReport(payload.insights);
      if (!validated) throw new Error("The AI response could not be read safely. Please try again.");
      const settings = currentAiInsightsSettings();
      settings.report = validated;
      settings.generatedAt = validated.generatedAt;
      settings.planHash = planHash;
      settings.usage = {
        count: (Number(settings.usage?.count) || 0) + 1,
        lastGeneratedAt: new Date().toISOString(),
      };
      saveDraft("AI Insights generated.");
      updateSaveStatus("AI Insights generated.");
    } catch (error) {
      aiInsightsUi.error = error.message || "The review could not be generated. Please try again later.";
    } finally {
      aiInsightsUi.isLoading = false;
      renderAiInsightsModal();
      renderAiInsightsHomeCard(result);
    }
  }

  function blankUserPlan() {
    const blank = CALC.emptyPlan();
    blank.incomeItems = [];
    blank.assetItems = [];
    blank.liabilityItems = [];
    blank.expenseItems = [];
    blank.goalItems = [];
    blank.comparison = { ...comparisonDefaults };
    ensurePlanSettings(blank);
    return blank;
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
    const viewAliases = {
      cashflow: "setup",
      assets: "setup",
      loans: "setup",
      forecast: "dashboard",
    };
    view = viewAliases[view] || view;
    activeView = view;
    document.body.dataset.activeView = view;
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
    const infoButton = infoButtonHtml(config.infoKey, config.label);
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
        <span class="field-label field-label-with-info">${escapeHtml(config.label)}${infoButton}</span>
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
    const rawValue = item[key] ?? "";
    const isBlankNumber = options.kind !== "text" && options.type !== "select" && Number(rawValue) === 0 && rawValue !== "0";
    const value = isBlankNumber ? "" : rawValue;
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
        <div class="collection-list">${body || `<p class="empty-collection-note">No items added yet. Use ${escapeHtml(addLabel)} to start this section.</p>`}</div>
        <div class="collection-footer">
          <button class="btn btn-primary add-button" type="button" data-add-collection="${collection}">${escapeHtml(addLabel)}</button>
        </div>
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
      const help = CALC.calculatePlan(plan).helpRepaymentEstimate;
      return `
        <article class="form-item-card dynamic-item-card">
          <div class="item-card-title">
            <div>
              <span>HELP estimate</span>
              <h4>Outstanding HELP Balance</h4>
            </div>
            ${removeButton("liabilityItems", item.id)}
          </div>
          <div class="input-grid mt-4">
            ${dynamicInput("liabilityItems", item, "balance", "Outstanding HELP Balance", { step: "1000" })}
          </div>
          <div class="summary-grid mt-4">
            ${summaryTile("Estimated Repayment Income", money(help.repaymentIncome))}
            ${summaryTile("Estimated Annual Repayment", money(help.annualRepayment))}
            ${summaryTile("Estimated Years Until Loan Repaid", help.estimatedYearsToRepay ? `${help.estimatedYearsToRepay.toFixed(1)} years` : "No compulsory repayment estimated")}
          </div>
          <p class="field-help mt-3">Estimate updates from income and current balance.</p>
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
      description: incomeHelperText,
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
        description: `Income items can include salary, Other Income, dividends, rent, interest or side payments. ${incomeHelperText}`,
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
      { label: "Building Wealth target age", path: "personal.workOptionalAge", infoKey: "buildingWealthTargetAge" },
      { label: "Financial Independence target age", path: "personal.semiRetirementAge", infoKey: "financialIndependenceTargetAge" },
      { label: "Financial Freedom target age", path: "personal.fullRetirementAge", infoKey: "financialFreedomTargetAge" },
      { label: "Annual Lifestyle Spending Needed for Financial Freedom", path: "personal.targetAnnualSpending", step: "1000", infoKey: "annualLifestyleSpending" },
      { label: "Annual investing target", path: "investing.annualInvestingTarget", step: "1000", infoKey: "annualInvestingTarget" },
      { label: "Employer super contributions", path: "investing.employerSuperContributions", step: "1000" },
      { label: "Extra super contributions", path: "investing.extraSuperContributions", step: "1000", infoKey: "extraSuperContributions" },
    ];
    const assumptionFields = [
      { label: "Expected investment return (%)", path: "investing.expectedInvestmentReturnPct", step: "0.1", infoKey: "investmentReturn" },
      { label: "Expected super return (%)", path: "investing.expectedSuperReturnPct", step: "0.1" },
      { label: "Inflation (%)", path: "investing.inflationPct", step: "0.1", infoKey: "inflationRate" },
      { label: "Wage growth (%)", path: "investing.wageGrowthPct", step: "0.1" },
      { label: "Safe withdrawal rate (%)", path: "investing.safeWithdrawalRatePct", step: "0.1", infoKey: "withdrawalRate" },
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
      { label: "Annual investing target", path: "investing.annualInvestingTarget", step: "1000", infoKey: "annualInvestingTarget" },
      { label: "Expected investment return (%)", path: "investing.expectedInvestmentReturnPct", step: "0.1" },
      { label: "Inflation (%)", path: "investing.inflationPct", step: "0.1" },
      { label: "Wage growth (%)", path: "investing.wageGrowthPct", step: "0.1" },
      { label: "Safe withdrawal rate (%)", path: "investing.safeWithdrawalRatePct", step: "0.1" },
    ]);
    renderForm("superForm", [
      { label: superDisplayName(1), path: "assets.superPerson1", step: "1000" },
      { label: superDisplayName(2), path: "assets.superPerson2", step: "1000" },
      { label: "Employer super contributions", path: "investing.employerSuperContributions", step: "1000" },
      { label: "Extra super contributions", path: "investing.extraSuperContributions", step: "1000", infoKey: "extraSuperContributions" },
      { label: "Expected super return (%)", path: "investing.expectedSuperReturnPct", step: "0.1" },
    ]);
    renderForm("wizardAboutForm", aboutFields);
    renderIncomeCollection("wizardIncomeForm");
    renderAssetCollection("wizardAssetsForm");
    renderLiabilityCollection("wizardLoansForm");
    renderExpenseCollection("wizardExpensesForm");
    renderForm("wizardGoalsForm", goalFields);
    renderGoalCollection("wizardGoalExamples");
    renderForm("wizardDownsizingForm", downsizingFields);
    renderForm("wizardAssumptionsReview", assumptionFields);
    renderForm("reportAssumptionsForm", assumptionFields);
    renderForm("downsizingForm", downsizingFields);
    renderGoalCollection("goalExamples");
  }

  function metricCard(label, value, tone = "", why = "", infoKey = "") {
    return `
      <article class="metric-card ${tone}">
        <span class="${infoKey ? "field-label-with-info" : ""}">${escapeHtml(label)}${infoButtonHtml(infoKey, label)}</span>
        <strong>${escapeHtml(value)}</strong>
        ${why ? `<small class="why-this-matters">${escapeHtml(why)}</small>` : ""}
      </article>
    `;
  }

  function summaryTile(label, value, tone = "", infoKey = "") {
    return `<div class="summary-tile ${tone}"><span class="${infoKey ? "field-label-with-info" : ""}">${escapeHtml(label)}${infoButtonHtml(infoKey, label)}</span><strong>${escapeHtml(value)}</strong></div>`;
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
    const meaningfulThreshold = Number(options.meaningfulThreshold ?? 1);
    const hasMeaningfulData = points.some((point) => Math.abs(Number(point.y) || 0) > meaningfulThreshold);
    if (!points.length || !hasMeaningfulData) {
      const message = options.emptyMessage || "Add your income, expenses, assets and investment assumptions to generate this chart.";
      svg.innerHTML = `
        <text class="chart-label chart-empty-label" x="${width / 2}" y="${height / 2 - 8}" text-anchor="middle">Add your income, expenses, assets and</text>
        <text class="chart-label chart-empty-label" x="${width / 2}" y="${height / 2 + 14}" text-anchor="middle">investment assumptions to generate this chart.</text>
        <title>${escapeHtml(message)}</title>
      `;
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
    const stageInfo = financialStageInfo(result);
    document.getElementById("previewScore").textContent = plainPercent(percent);
    document.getElementById("previewStage").textContent = stageInfo.stage.name;
    document.getElementById("previewNetWorth").textContent = money(result.currentNetWorth);
    document.getElementById("previewMonthlySurplus").textContent = money(estimatedCashflow(result) / 12);
    document.getElementById("previewNextMilestone").textContent = stageInfo.insufficient ? "Complete plan information" : stageInfo.actions[0];
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

  function milestoneReachEstimate(result, threshold) {
    const currentAge = Number(result.plan.personal.person1Age) || 0;
    const percent = freedomPercent(result);
    if (percent >= threshold) {
      return {
        years: 0,
        age: currentAge || null,
        label: currentAge ? `Reached now at age ${currentAge}` : "Reached now",
      };
    }
    const row = result.financialFreedomProgressProjection.find((item) => item.progress >= threshold);
    if (!row) return { years: null, age: null, label: "Beyond the 30-year forecast" };
    return {
      years: row.year,
      age: row.age,
      label: `Estimated in ${row.year} ${row.year === 1 ? "year" : "years"} at age ${row.age}`,
    };
  }

  function milestoneSuggestion(result, milestone, isCurrent, achieved) {
    const gap = Math.max(0, (Number(milestone.requiredCapital) || 0) - (Number(result.financialIndependenceAssets) || 0));
    const surplus = Number(result.finalProjectedCashSurplus) || 0;
    if (achieved) {
      return `This milestone is currently reached based on the assumptions used. Keep checking cashflow, debt and investment contributions so progress stays on track.`;
    }
    if (surplus > 0) {
      return `${money(gap)} more financial independence assets are estimated for this milestone. Your model shows ${money(surplus)} final annual surplus, so directing part of that surplus to investments, offset or debt reduction may help you move faster.`;
    }
    if (isCurrent) {
      return `${money(gap)} more financial independence assets are estimated for this milestone. The current plan shows a cashflow shortfall, so reviewing expenses, loan repayments or gross income assumptions may be the first practical step.`;
    }
    return `${money(gap)} more financial independence assets are estimated for this milestone. This is a future target; focus first on the highlighted current milestone.`;
  }

  function milestoneCards(result) {
    const percent = freedomPercent(result);
    const nextIndex = result.milestones.findIndex((milestone) => percent < milestone.coverage * 100);
    const currentIndex = nextIndex === -1 ? Math.max(0, result.milestones.length - 1) : nextIndex;
    return result.milestones.map((milestone, index) => {
      const threshold = milestone.coverage * 100;
      const progress = threshold > 0 ? Math.min(100, Math.max(0, percent / threshold * 100)) : 0;
      const achieved = percent >= threshold;
      const isCurrent = index === currentIndex;
      const reach = milestoneReachEstimate(result, threshold);
      const stageLabel = achieved ? "Milestone reached" : isCurrent ? "Current milestone" : "Future milestone";
      return `
        <details class="milestone-card card status-${milestone.status} ${isCurrent ? "current-stage" : ""} ${achieved ? "achieved" : ""}" ${isCurrent ? "open" : ""}>
          <summary>
            <div>
              <span class="metric-label">${stageLabel}</span>
              <h3>${escapeHtml(milestone.label)}</h3>
              <p>${escapeHtml(milestone.description || "")}</p>
            </div>
            <strong>${plainPercent(progress)}</strong>
          </summary>
          <div class="progress-track" aria-hidden="true"><span style="width:${progress}%"></span></div>
          <div class="summary-grid mt-4">
            ${summaryTile("Progress to this milestone", plainPercent(progress))}
            ${summaryTile("Estimated timing", reach.label)}
            ${summaryTile("Target FI Assets", money(milestone.requiredCapital), "", "targetFiAssets")}
            ${summaryTile("Current FI Assets", money(result.financialIndependenceAssets), "", "currentFiAssets")}
            ${summaryTile("Projected assets at target age", money(milestone.projectedFiAssets))}
            ${summaryTile("Passive income estimate", money(milestone.passiveIncomeEstimate))}
          </div>
          <p class="milestone-explanation">${escapeHtml(milestoneSuggestion(result, milestone, isCurrent, achieved))}</p>
        </details>
      `;
    }).join("");
  }

  function renderWizardResults(result) {
    const percent = freedomPercent(result);
    const stageInfo = financialStageInfo(result);
    const stage = stageInfo.stage;
    const passive = annualPassiveIncome(result);
    const target = lifestyleTarget(result);
    const milestone = nextMilestone(result, percent);
    const container = document.getElementById("wizardResultsSummary");
    if (!container) return;
    container.innerHTML = `
      <article class="freedom-stage-card">
        <span class="metric-label">Your current financial stage</span>
        <strong>${escapeHtml(stage.name)}</strong>
        <p>${escapeHtml(stage.explanation)}</p>
        <p><strong>${stageInfo.nextStage ? plainPercent(stageInfo.progressToNext) : "100%"}</strong> ${stageInfo.nextStage ? `toward ${escapeHtml(stageInfo.nextStage.name)}` : "Financial Freedom achieved"}.</p>
        <div class="progress-track progress-track-large" aria-label="${stageInfo.nextStage ? `${plainPercent(stageInfo.progressToNext)} progress toward ${stageInfo.nextStage.name}` : "Financial Freedom achieved"}"><span style="width:${stageInfo.nextStage ? stageInfo.progressToNext : 100}%"></span></div>
      </article>
      <div class="dashboard-card-grid mt-4">
        ${metricCard("Current stage", stage.name)}
        ${metricCard("Annual passive income", money(passive))}
        ${metricCard("Annual lifestyle target", money(target))}
        ${metricCard("Target lifestyle funded", plainPercent(percent))}
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
    document.getElementById("wizardNextButton").textContent = activeWizardStep === wizardSteps.length - 1 ? "View Dashboard ->" : "Next Step ->";
    const chips = document.getElementById("wizardStepChips");
    if (chips) {
      chips.innerHTML = wizardSteps.map((item, index) => `
        <button class="wizard-step-chip ${index === activeWizardStep ? "active" : ""}" type="button" data-wizard-step="${index}">
          <span>${index + 1}</span>${escapeHtml(item.title)}
        </button>
      `).join("");
    }
  }

  function renderDashboard(result) {
    const names = [plan.personal.person1Name, plan.personal.person2Name].filter(Boolean).join(" and ");
    const percent = freedomPercent(result);
    const stageInfo = financialStageInfo(result);
    const stage = stageInfo.stage;
    const passiveIncome = annualPassiveIncome(result);
    const target = lifestyleTarget(result);
    const livingExpenses = result.annualLivingExpenses;
    const annualSurplus = estimatedCashflow(result);
    const monthlySurplus = estimatedCashflow(result) / 12;
    const milestone = nextMilestone(result, percent);
    const progressWidth = Math.min(100, Math.max(0, percent));

    document.getElementById("dashboardTitle").textContent = names ? `${names}'s Financial Freedom` : "Start a plan or load a sample plan.";
    document.getElementById("dashboardSubtitle").textContent = isBlankPlan(plan)
      ? "Enter your own details or load a fictional sample plan to see the dashboard come alive."
      : "See how today's decisions shape tomorrow's financial freedom.";
    document.getElementById("heroScore").textContent = plainPercent(percent);
    document.querySelector(".score-ring span").textContent = "Lifestyle funded";
    document.querySelector(".score-ring").style.borderColor = percent >= 100 ? "#bdebd7" : percent >= 75 ? "#f3d08c" : "#dbe4ee";
    document.querySelector(".freedom-stage-card").innerHTML = `
      <div class="stage-heading-row">
        <span class="metric-label">Your current financial stage</span>
        ${infoButtonHtml("financialStage", "financial stages")}
      </div>
      <strong id="freedomStageLabel">${escapeHtml(stage.name)}</strong>
      <p id="freedomStageText">${escapeHtml(stageInfo.insufficient ? "Complete the remaining plan information to calculate your financial stage." : stage.explanation)}</p>
      ${stageJourneyHtml(stageInfo)}
      <div class="stage-progress-block">
        <div>
          <span class="metric-label">${stageInfo.nextStage ? `Progress toward ${escapeHtml(stageInfo.nextStage.name)}` : "Financial Freedom achieved"}</span>
          <strong>${stageInfo.nextStage ? plainPercent(stageInfo.progressToNext) : "100%"}</strong>
        </div>
        <div class="progress-track progress-track-large" aria-label="${stageInfo.nextStage ? `${plainPercent(stageInfo.progressToNext)} progress toward ${stageInfo.nextStage.name}` : "Financial Freedom achieved"}"><span id="freedomProgressBar" style="width:${stageInfo.nextStage ? stageInfo.progressToNext : 100}%"></span></div>
      </div>
      <div class="stage-progress-block">
        <div>
          <span class="metric-label">Target lifestyle funded</span>
          <strong>${plainPercent(percent)} of target lifestyle funded</strong>
        </div>
        <p id="freedomPassiveText" class="progress-caption">Based on projected investment and passive income compared with your target annual lifestyle cost.</p>
      </div>
      <div class="stage-actions">
        <span class="metric-label">What moves you forward</span>
        <ul>${stageInfo.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    `;
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
      metricCard("Net Worth", money(result.currentNetWorth), "", "What you own minus what you owe."),
      metricCard("Final Projected Surplus", money(annualSurplus), annualSurplus >= 0 ? "status-green" : "status-amber", "Estimated money left after tax, Medicare, HELP, living costs, loan repayments, investing and extra super."),
      metricCard("Investments", money(result.investmentBalance), "", "Projected investment balance includes contributions and earnings over time."),
      metricCard("Super", money(result.superannuationBalance), "status-green", "Tracked separately from other investments."),
      metricCard("Target Lifestyle Funded", plainPercent(percent), percent >= 75 ? "status-green" : "", "Based on projected investment and passive income compared with your target annual lifestyle cost."),
    ].join("");
    document.getElementById("secondMetricGrid").innerHTML = [
      metricCard("Your Current Financial Stage", stage.name),
      metricCard(stageInfo.nextStage ? `Progress Toward ${stageInfo.nextStage.name}` : "Financial Freedom Achieved", stageInfo.nextStage ? plainPercent(stageInfo.progressToNext) : "100%"),
      metricCard("Debt Balance", money(result.totalLiabilities), result.totalLiabilities <= result.totalAssets * 0.5 ? "status-green" : "status-amber"),
      metricCard("Monthly Surplus / Deficit", money(monthlySurplus), monthlySurplus >= 0 ? "status-green" : "status-amber"),
      metricCard("Annual Passive Income Estimate", money(passiveIncome), "", "This estimates the annual income your investments may generate without selling assets."),
      metricCard("Annual Living Expenses", money(livingExpenses), "", "This is calculated from your recurring expense items and excludes investing and loan principal repayments."),
      metricCard("Accessible Investments", money(result.accessibleInvestmentAssets)),
      metricCard("Highest Priority", highestRecommendation(result)),
      weeklyHealthCheckCard(result),
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

  function thisWeekProgressAmount() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() + 1);
    return latestProgressEvents(20)
      .filter((event) => new Date(event.createdAt) >= start)
      .reduce((total, event) => total + (Number(event.amount) || 0), 0);
  }

  function engagementMetricCard(label, value, note = "") {
    return `
      <article class="engagement-metric-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        ${note ? `<small>${escapeHtml(note)}</small>` : ""}
      </article>
    `;
  }

  function engagementProgressCard(title, percent, actualPercent, note, info) {
    const width = Math.min(100, Math.max(0, percent));
    return `
      <article class="engagement-progress-card">
        <div class="engagement-progress-card-heading">
          <span class="metric-label">${escapeHtml(title)}</span>
          <button class="field-info-button" type="button" data-info-key="financialStage" aria-label="More information about ${escapeHtml(title)}">&#9432;</button>
        </div>
        <strong>${plainPercent(width)}</strong>
        <div class="engagement-progress-track" aria-label="${escapeHtml(title)} ${plainPercent(width)}">
          <span style="width:${width}%"></span>
        </div>
        <p>${escapeHtml(note)}</p>
        <small>${escapeHtml(info || `${plainPercent(actualPercent)} calculated before display cap.`)}</small>
      </article>
    `;
  }

  function missionTaskHtml(task) {
    return `
      <li class="${task.completed ? "complete" : ""}">
        <span aria-hidden="true">${task.completed ? "OK" : ""}</span>
        <strong>${escapeHtml(task.title)}</strong>
      </li>
    `;
  }

  function renderEngagementHome(result) {
    const container = document.getElementById("engagementHome");
    const snapshotHeading = document.querySelector(".home-snapshot-heading");
    const snapshotGrid = document.querySelector(".home-snapshot-grid");
    const oldSteps = document.querySelector("#homeView > .steps-grid");
    const enabled = engagementJourneyIsEnabled();
    if (snapshotHeading) snapshotHeading.classList.toggle("hidden", enabled);
    if (snapshotGrid) snapshotGrid.classList.toggle("hidden", enabled);
    if (oldSteps) oldSteps.classList.toggle("hidden", enabled);
    if (!container) return;
    container.classList.toggle("hidden", !enabled);
    if (!enabled) return;

    const progress = engagementProgress(result);
    const stageInfo = engagementStageInfo(result);
    const goal = primaryShortTermGoal(result);
    const mission = currentWeeklyMission(result);
    const todayWin = engagementTodayWin(result, goal, mission);
    const openingMessage = engagementOpeningMessage(result, stageInfo, goal, mission);
    const weeklyAmount = thisWeekProgressAmount();
    const achievement = latestAchievement(result);
    const future = futureYouPreview(result);
    const recentEvents = latestProgressEvents(4);
    const goalPercent = goalProgressPercent(goal);
    const goalRequiredWeekly = goal && goal.targetDate
      ? Math.max(0, goalRemaining(goal) / Math.max(1, Math.ceil((new Date(`${goal.targetDate}T00:00:00`).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))))
      : Number(goal?.recurringAmount) || 0;
    const displayName = engagementGreetingName();

    container.innerHTML = `
      <section class="engagement-welcome-card">
        <div>
          <span class="metric-label">Financial journey</span>
          <h2>${escapeHtml(engagementGreeting())}, ${escapeHtml(displayName)}</h2>
          <p>${escapeHtml(openingMessage)}</p>
        </div>
        <div class="engagement-welcome-stats" aria-label="Financial journey snapshot">
          ${engagementMetricCard("Financial Independence", `${plainPercent(progress.financialIndependence)} funded`, "Based on FI assets and withdrawal rate.")}
          ${engagementMetricCard("Financial Freedom", `${plainPercent(progress.financialFreedom)} funded`, "Compared with target FI capital.")}
          ${engagementMetricCard("This week added", money(weeklyAmount), "Recorded progress events only.")}
        </div>
      </section>

      <section class="engagement-primary-progress">
        ${engagementProgressCard(
          "Financial Independence",
          progress.financialIndependence,
          progress.financialIndependenceRaw,
          `${money(progress.sustainableIncome)} estimated annual sustainable income toward ${money(progress.targetSpending)} target spending.`,
          "Uses current FI assets multiplied by the selected withdrawal rate."
        )}
        ${engagementProgressCard(
          "Financial Freedom",
          progress.financialFreedom,
          progress.financialFreedomRaw,
          `${money(result.financialIndependenceAssets)} current FI assets toward ${money(result.targetCapital || 0)} target FI capital.`,
          "Uses the app's existing FI assets and target capital calculation."
        )}
      </section>

      <section class="engagement-card-grid">
        <article class="engagement-card engagement-today-card">
          <span class="metric-label">Today's Win</span>
          <h3>${escapeHtml(todayWin.title)}</h3>
          <p>${escapeHtml(todayWin.text)}</p>
          <button class="btn btn-primary" type="button" data-engagement-action="${escapeHtml(todayWin.action)}"${todayWin.goalId ? ` data-goal-id="${escapeHtml(todayWin.goalId)}"` : ""}>${escapeHtml(todayWin.actionLabel)}</button>
        </article>

        <article class="engagement-card">
          <span class="metric-label">Weekly Mission</span>
          <h3>${mission.completedCount} of ${mission.totalTasks} complete</h3>
          <div class="engagement-progress-track" aria-label="Weekly mission ${mission.percent}% complete"><span style="width:${mission.percent}%"></span></div>
          <ul class="engagement-task-list">${mission.tasks.map(missionTaskHtml).join("")}</ul>
          <p>${mission.streak ? `${mission.streak}-week consistency streak.` : "Complete your first weekly review to start a streak."}</p>
          <button class="btn mt-3" type="button" data-engagement-action="weeklyplan">Open Weekly Plan</button>
        </article>

        <article class="engagement-card">
          <span class="metric-label">Primary Short-Term Goal</span>
          ${goal ? `
            <h3>${escapeHtml(goal.name)}</h3>
            <p>${money(goal.currentAmount)} saved of ${money(goal.targetAmount)}. ${money(goalRemaining(goal))} remaining.</p>
            <div class="engagement-progress-track" aria-label="${escapeHtml(goal.name)} ${plainPercent(goalPercent)} complete"><span style="width:${goalPercent}%"></span></div>
            <small>${escapeHtml(goalTimeRemaining(goal))}${goalRequiredWeekly ? ` - about ${money(goalRequiredWeekly)} per week required.` : ""}</small>
            <button class="btn mt-3" type="button" data-engagement-action="add-goal-progress" data-goal-id="${escapeHtml(goal.id)}">Add Progress</button>
          ` : `
            <h3>Create your first goal</h3>
            <p>Add a savings, investing, debt-reduction or emergency-fund goal to make progress visible.</p>
            <button class="btn mt-3" type="button" data-engagement-action="goals">Open Goals</button>
          `}
        </article>

        <article class="engagement-card engagement-stage-card">
          <span class="metric-label">Current Journey Stage</span>
          <h3>${escapeHtml(stageInfo.stage.name)}</h3>
          <p>${escapeHtml(stageInfo.stage.purpose)}</p>
          <div class="engagement-stage-actions">
            <strong>What moves you forward</strong>
            <ul>${stageInfo.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        </article>
      </section>

      <section class="engagement-journey-section">
        <div>
          <span class="metric-label">Journey map</span>
          <h3>Your financial stages</h3>
        </div>
        ${engagementJourneyMapHtml(stageInfo)}
      </section>

      <section class="engagement-card-grid engagement-secondary-grid">
        ${aiOpeningInsightHtml()}

        <article class="engagement-card">
          <span class="metric-label">Recent Progress</span>
          <h3>${recentEvents.length ? "Latest recorded actions" : "No progress recorded yet"}</h3>
          ${recentEvents.length ? `
            <ul class="engagement-event-list">
              ${recentEvents.map((event) => `<li><strong>${escapeHtml(event.title)}</strong><span>${event.amount ? money(event.amount) : ""}</span></li>`).join("")}
            </ul>
          ` : `<p>Record goal contributions or complete weekly reviews to build your progress history.</p>`}
        </article>

        <article class="engagement-card">
          <span class="metric-label">Latest Achievement</span>
          ${achievement ? `
            <h3>${escapeHtml(achievement.title)}</h3>
            <p>${escapeHtml(achievement.description)}</p>
            <small>Unlocked ${escapeHtml(formatLastSaved(achievement.unlockedAt))}</small>
          ` : `
            <h3>First milestone waiting</h3>
            <p>Complete a weekly review, start emergency savings or add an investment contribution to unlock the first milestone.</p>
          `}
        </article>

        <article class="engagement-card">
          <span class="metric-label">Future You Preview</span>
          <h3>Your future at age ${escapeHtml(future.age)}</h3>
          <div class="engagement-mini-table">
            <div><span>Investments</span><strong>${money(future.investmentBalance)}</strong></div>
            <div><span>Super</span><strong>${money(future.superBalance)}</strong></div>
            <div><span>Estimated passive income</span><strong>${money(future.passiveIncome)}</strong></div>
            <div><span>Target lifestyle funded</span><strong>${plainPercent(Math.min(100, future.progress))}</strong></div>
          </div>
          <small>Projected based on the current assumptions. Outcomes may vary.</small>
        </article>
      </section>

      <section class="engagement-quick-links">
        <button class="btn" type="button" data-engagement-action="setup">Financial Plan</button>
        <button class="btn" type="button" data-engagement-action="weeklyplan">Weekly Plan</button>
        <button class="btn" type="button" data-engagement-action="goals">Goals</button>
        <button class="btn" type="button" data-engagement-action="decision">Decision Engine</button>
        <button class="btn" type="button" data-engagement-action="reports">Reports</button>
        <button class="btn btn-primary" type="button" data-engagement-action="ai">AI Coach</button>
      </section>
    `;
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
      ["HELP repayment assumptions", `Estimated above $69,528 repayment income and capped by current balance`],
      ["Concessional contributions tax", "15% applied before money is invested in super"],
      ["Safe withdrawal rate", `${Number(plan.investing.safeWithdrawalRatePct || 0).toFixed(1)}% estimate`],
      ["Super access age", `Age ${result.superAccessAge} in this model`],
    ];
    container.innerHTML = rows.map(([label, value]) => summaryTile(label, value)).join("");
  }

  function renderHelpReview(result) {
    const help = result.helpRepaymentEstimate;
    const tiles = [
      summaryTile("Outstanding HELP Balance", money(help.balance)),
      summaryTile("Estimated Repayment Income", money(help.repaymentIncome)),
      summaryTile("Estimated Annual HELP Repayment", money(help.annualRepayment)),
      summaryTile("Estimated Years Until Loan Repaid", help.estimatedYearsToRepay ? `${help.estimatedYearsToRepay.toFixed(1)} years` : "No compulsory repayment estimated"),
    ].join("") + `<p class="tax-note mt-4">HELP estimate uses repayment income and is capped at the current balance.</p>`;
    ["wizardHelpReview", "reportHelpSummary"].forEach((id) => {
      const container = document.getElementById(id);
      if (container) container.innerHTML = tiles;
    });
  }

  function cashflowRows(result) {
    return [
      ["Gross income", result.annualGrossIncome],
      [`Less: Estimated income tax (${result.taxEstimate.taxYear})`, -result.taxEstimate.incomeTax],
      ["Less: Medicare levy", -result.taxEstimate.medicareLevy],
      ["Less: Estimated HECS/HELP repayment", -result.helpRepaymentEstimate.annualRepayment],
      ["Net income after tax and HELP", result.netIncomeAfterTaxHelp],
      ["Less: Living expenses", -result.annualCoreLivingExpenses],
      ["Less: Loan repayments", -result.annualDebtRepayments],
      ["Less: Other regular expenses", -result.annualOtherRegularExpenses],
      ["Cash surplus before investing", result.cashSurplusBeforeInvesting],
      ["Less: Investment contributions", -result.annualInvestmentContributions],
      ["Less: Extra super contributions / salary sacrifice", -result.annualExtraSuperContributions],
      ["Final projected cash surplus", result.finalProjectedCashSurplus],
    ];
  }

  function cashflowRowHtml(label, value) {
    const finalClass = label === "Final projected cash surplus" ? " cashflow-row-final" : "";
    return `
      <div class="table-row cashflow-row${finalClass}">
        <span>${escapeHtml(label)}</span>
        <strong>${money(value)}</strong>
      </div>
    `;
  }

  function renderCashflow(result) {
    document.getElementById("cashflowTable").innerHTML = cashflowRows(result).map(([label, value]) => `
      ${cashflowRowHtml(label, value)}
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
    document.getElementById("helpEstimateSummary").innerHTML = `
      <strong>HELP estimate:</strong> ${money(help.annualRepayment)} per year from estimated repayment income of ${money(help.repaymentIncome)}.
      ${help.estimatedYearsToRepay ? `Estimated time to repay: ${help.estimatedYearsToRepay.toFixed(1)} years.` : "No compulsory repayment estimated."}
      ${escapeHtml(help.note)}
    `;
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
    `;
  }

  function renderMilestones(result) {
    const html = milestoneCards(result);
    ["dashboardMilestones", "forecastMilestones"].forEach((id) => {
      const container = document.getElementById(id);
      if (container) container.innerHTML = html;
    });
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
      ["Target FI Capital", result.targetCapital],
    ];
    document.getElementById("forecastCards").innerHTML = cards.map(([label, value]) => metricCard(label, money(value), "", "", label === "Target FI Capital" ? "targetFiCapital" : "")).join("");
  }

  function renderGoalsSummary(result) {
    const container = document.getElementById("goalsFiSummary");
    if (!container) return;
    container.innerHTML = [
      summaryTile("Target FI Capital", money(result.targetCapital), "", "targetFiCapital"),
      summaryTile("Current FI Assets", money(result.financialIndependenceAssets), "", "currentFiAssets"),
      summaryTile("Annual Lifestyle Spending Needed for Financial Freedom", money(plan.personal.targetAnnualSpending), "", "annualLifestyleSpending"),
    ].join("");
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

  function plannerDateIso(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
  }

  function nextMondayIso() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
    date.setDate(date.getDate() + daysUntilMonday);
    return plannerDateIso(date);
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function addMonths(date, months) {
    const copy = new Date(date);
    const day = copy.getDate();
    copy.setMonth(copy.getMonth() + months, 1);
    const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
    copy.setDate(Math.min(day, lastDay));
    return copy;
  }

  function plannerShortDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  }

  function plannerFrequencyLabel(frequency) {
    return frequencies.find(([value]) => value === frequency)?.[1] || "Annually";
  }

  function plannerRound(value) {
    return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
  }

  function defaultPlannerStartingBalance() {
    ensureCollectionData();
    const cashItems = (plan.assetItems || []).filter((item) => item.category === "cash");
    if (cashItems.length) return cashItems.reduce((total, item) => total + (Number(item.value) || 0), 0);
    return Number(plan.assets.cash) || 0;
  }

  function readPlannerSettingsFromInputs() {
    ensurePlanSettings(plan);
    const startInput = document.getElementById("plannerStartDate");
    const balanceInput = document.getElementById("plannerStartingBalance");
    const periodInput = document.getElementById("plannerPeriod");
    const period = Number(periodInput?.value || plan.reportSettings.weeklyPlanner.periodWeeks || 52);
    const periodWeeks = [12, 26, 52].includes(period) ? period : 52;
    const settings = {
      startDate: startInput?.value || plan.reportSettings.weeklyPlanner.startDate || nextMondayIso(),
      startingBalance: Number(balanceInput?.value ?? plan.reportSettings.weeklyPlanner.startingBalance ?? defaultPlannerStartingBalance()) || 0,
      periodWeeks,
    };
    plan.reportSettings.weeklyPlanner = { ...plan.reportSettings.weeklyPlanner, ...settings };
    return settings;
  }

  function scheduleWeeklyProvision(amount, frequency, weeks) {
    const weekly = plannerRound(annualValue(amount, frequency || "annually") / 52);
    return Array.from({ length: weeks.length }, () => weekly);
  }

  function weekIndexForDate(date, startDate, weeksCount) {
    const index = Math.floor((date.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return index >= 0 && index < weeksCount ? index : -1;
  }

  function scheduleKnownFrequency(amount, frequency, weeks, startDate) {
    const value = plannerRound(Number(amount) || 0);
    const values = Array.from({ length: weeks.length }, () => 0);
    if (value <= 0) return values;
    if (frequency === "weekly") return values.map(() => value);
    if (frequency === "fortnightly") return values.map((_, index) => (index % 2 === 0 ? value : 0));
    if (frequency === "monthly" || frequency === "quarterly") {
      const interval = frequency === "quarterly" ? 3 : 1;
      for (let month = 0; month <= 12; month += interval) {
        const paymentDate = addMonths(startDate, month);
        const weekIndex = weekIndexForDate(paymentDate, startDate, weeks.length);
        if (weekIndex >= 0) values[weekIndex] = plannerRound(values[weekIndex] + value);
      }
      return values;
    }
    return scheduleWeeklyProvision(value, frequency, weeks);
  }

  function totalValues(values) {
    return plannerRound((values || []).reduce((total, value) => total + (Number(value) || 0), 0));
  }

  function addPlannerItem(section, item) {
    const values = (item.values || []).map(plannerRound);
    if (totalValues(values) <= 0) return;
    section.push({
      name: item.name,
      frequency: item.frequency,
      frequencyLabel: item.frequencyLabel,
      values,
      rowKey: item.rowKey,
    });
  }

  function plannerExpenseName(item) {
    const label = expenseCategoryOptions.find(([value]) => value === item.category)?.[1] || "Expense";
    return item.name || label;
  }

  function isEssentialPlannerExpense(item) {
    return new Set([
      "living",
      "food",
      "utilities",
      "insurance",
      "schoolChildren",
      "ratesPropertyCosts",
      "phoneInternet",
      "privateHealth",
      "petrol",
      "vehicleCosts",
      "petCosts",
    ]).has(item.category);
  }

  function buildPlannerSections(weeks, startDate) {
    ensureCollectionData();
    const sections = { receipts: [], essential: [], provisions: [], discretionary: [], transfers: [] };
    (plan.incomeItems || []).forEach((item, index) => {
      const frequency = item.frequency || "annually";
      const knownTiming = ["weekly", "fortnightly", "monthly", "quarterly"].includes(frequency);
      const values = knownTiming
        ? scheduleKnownFrequency(item.amount, frequency, weeks, startDate)
        : scheduleWeeklyProvision(item.amount, frequency, weeks);
      addPlannerItem(sections.receipts, {
        name: item.name || `Income ${index + 1}`,
        frequency,
        frequencyLabel: knownTiming ? plannerFrequencyLabel(frequency) : `${plannerFrequencyLabel(frequency)} - weekly estimate`,
        values,
      });
    });

    (plan.expenseItems || []).forEach((item) => {
      const frequency = item.frequency || "annually";
      const precise = frequency === "weekly" || frequency === "fortnightly";
      const values = precise
        ? scheduleKnownFrequency(item.amount, frequency, weeks, startDate)
        : scheduleWeeklyProvision(item.amount, frequency, weeks);
      const targetSection = !precise && frequency === "annually" ? sections.provisions : isEssentialPlannerExpense(item) ? sections.essential : sections.discretionary;
      addPlannerItem(targetSection, {
        name: precise ? plannerExpenseName(item) : `${plannerExpenseName(item)} amount set aside`,
        frequency,
        frequencyLabel: precise ? plannerFrequencyLabel(frequency) : `${plannerFrequencyLabel(frequency)} - weekly amount set aside`,
        values,
      });
    });

    (plan.liabilityItems || []).forEach((item) => {
      if (item.type === "hecsHelp") return;
      const frequency = item.repaymentFrequency || "monthly";
      addPlannerItem(sections.essential, {
        name: item.name ? `${item.name} repayment` : "Debt repayment",
        frequency,
        frequencyLabel: plannerFrequencyLabel(frequency),
        values: scheduleKnownFrequency(item.repayment, frequency, weeks, startDate),
      });
    });

    addPlannerItem(sections.transfers, {
      name: "Investment contribution",
      frequency: "annually",
      frequencyLabel: "Annual target - weekly transfer",
      values: scheduleWeeklyProvision(plan.investing.annualInvestingTarget, "annually", weeks),
      rowKey: "investmentTransfer",
    });

    addPlannerItem(sections.transfers, {
      name: "Additional super contribution",
      frequency: "annually",
      frequencyLabel: "Annual target - weekly transfer",
      values: scheduleWeeklyProvision(plan.investing.extraSuperContributions, "annually", weeks),
      rowKey: "superTransfer",
    });

    addPlannerItem(sections.transfers, {
      name: "Extra debt repayment",
      frequency: "annually",
      frequencyLabel: "Annual target - weekly transfer",
      values: scheduleWeeklyProvision(plan.reportSettings?.weeklyPlanner?.extraDebtRepaymentTarget || 0, "annually", weeks),
      rowKey: "debtTransfer",
    });

    return sections;
  }

  function buildPlannerSectionsFromWeeklyPlan(weeks) {
    const sourceWeeks = weeklyPlan?.weeks || [];
    const values = (key) => weeks.map((_, index) => Number(sourceWeeks[index]?.planned?.[key]) || 0);
    return {
      receipts: [{
        name: "Money coming in",
        frequency: "weekly",
        frequencyLabel: "Weekly Plan",
        values: values("income"),
      }],
      essential: [{
        name: "Bills and spending",
        frequency: "weekly",
        frequencyLabel: "Weekly Plan",
        values: values("essentialCosts"),
      }],
      provisions: [{
        name: "Provisions",
        frequency: "weekly",
        frequencyLabel: "Weekly Plan",
        values: values("provisions"),
      }],
      discretionary: [{
        name: "Spending allowance",
        frequency: "weekly",
        frequencyLabel: "Weekly Plan",
        values: values("discretionaryAllowance"),
      }],
      transfers: [
        {
          name: "Transfer to offset",
          frequency: "weekly",
          frequencyLabel: "Weekly Plan",
          values: values("offsetTransfer"),
          rowKey: "offsetTransfer",
        },
        {
          name: "Invest",
          frequency: "weekly",
          frequencyLabel: "Weekly Plan",
          values: values("investment"),
          rowKey: "investmentTransfer",
        },
        {
          name: "Add to super",
          frequency: "weekly",
          frequencyLabel: "Weekly Plan",
          values: values("extraSuper"),
          rowKey: "superTransfer",
        },
        {
          name: "Pay extra off debt",
          frequency: "weekly",
          frequencyLabel: "Weekly Plan",
          values: values("extraDebtRepayment"),
          rowKey: "debtTransfer",
        },
      ].filter((item) => totalValues(item.values) > 0),
    };
  }

  function plannerSectionTotal(section, weekIndex) {
    return plannerRound(section.reduce((total, item) => total + (Number(item.values[weekIndex]) || 0), 0));
  }

  function plannerTransferTotal(section, rowKey, weekIndex) {
    return plannerRound(section
      .filter((item) => item.rowKey === rowKey)
      .reduce((total, item) => total + (Number(item.values[weekIndex]) || 0), 0));
  }

  function weeklyPriority(week) {
    const actions = [];
    if (week.receiptsTotal > 0) actions.push(`${money(week.receiptsTotal)} of estimated net income is expected`);
    if (week.essentialTotal > 0) actions.push(`pay ${money(week.essentialTotal)} of bills and spending`);
    if (week.provisionsTotal > 0) actions.push(`set aside ${money(week.provisionsTotal)} for future expenses`);
    if (week.offsetTransferTotal > 0) actions.push(`transfer ${money(week.offsetTransferTotal)} to offset`);
    if (week.debtTransferTotal > 0) actions.push(`pay ${money(week.debtTransferTotal)} extra off debt`);
    if (week.investmentTransferTotal > 0) actions.push(`invest ${money(week.investmentTransferTotal)}`);
    if (week.superTransferTotal > 0) actions.push(`contribute ${money(week.superTransferTotal)} to super`);
    if (!actions.length) return "Review expected money in, bills and the closing bank balance for this week.";
    return `This week, ${actions.join(", ")}.`;
  }

  function plannerAssumptions(result) {
    return [
      { label: "Planner start date", value: plannerShortDate(plan.reportSettings.weeklyPlanner.startDate), note: "Beginning of Week 1." },
      { label: "Annual Lifestyle Spending Needed for Financial Freedom", value: money(plan.personal.targetAnnualSpending), note: "Used in the Financial Freedom target." },
      { label: "Investment return", value: `${Number(plan.investing.expectedInvestmentReturnPct || 0).toFixed(1)}%`, note: "Not applied to the weekly bank schedule." },
      { label: "Super return", value: `${Number(plan.investing.expectedSuperReturnPct || 0).toFixed(1)}%`, note: "Not applied to the weekly bank schedule." },
      { label: "Inflation", value: `${Number(plan.investing.inflationPct || 0).toFixed(1)}%`, note: "Shown as a plan assumption only." },
      { label: "Safe withdrawal rate", value: `${Number(plan.investing.safeWithdrawalRatePct || 0).toFixed(1)}%`, note: "Used to estimate target FI capital." },
      { label: "Current net worth", value: money(result.currentNetWorth), note: "From the currently loaded plan." },
      { label: "Final projected annual surplus", value: money(result.finalProjectedCashSurplus), note: "From the app cashflow model before planner timing." },
      { label: "Estimated amounts set aside", value: "Used where no due date is stored", note: "Annual or irregular bills are spread evenly across 52 weeks." },
    ];
  }

  function buildWeeklyPlannerData(result) {
    syncCollectionsToLegacy();
    const settings = readPlannerSettingsFromInputs();
    const startDate = new Date(`${settings.startDate}T00:00:00`);
    const weeks = Array.from({ length: settings.periodWeeks }, (_, index) => ({
      week: index + 1,
      startDateIso: plannerDateIso(addDays(startDate, index * 7)),
    }));
    const sections = weeklyPlan?.weeks?.length === weeks.length
      ? buildPlannerSectionsFromWeeklyPlan(weeks)
      : buildPlannerSections(weeks, startDate);
    let opening = plannerRound(settings.startingBalance);
    weeks.forEach((week, index) => {
      const activeWeek = weeklyPlan?.weeks?.[index];
      const planned = activeWeek?.planned || {};
      const actualData = activeWeek ? weeklyActualClosingData(activeWeek) : null;
      const useActualForBalance = Boolean(activeWeek?.isCompleted && activeWeek.actual);
      const receiptsTotal = useActualForBalance ? plannerRound(actualData.income + actualData.transfersIn) : activeWeek?.planned ? planned.income : plannerSectionTotal(sections.receipts, index);
      const essentialTotal = useActualForBalance ? weeklyActualValue(activeWeek.actual, "essentialCosts", planned.essentialCosts) : activeWeek?.planned ? planned.essentialCosts : plannerSectionTotal(sections.essential, index);
      const provisionsTotal = useActualForBalance ? weeklyActualSetAside(activeWeek.actual, planned) : activeWeek?.planned ? (planned.provisions || planned.amountSetAside || 0) : plannerSectionTotal(sections.provisions || [], index);
      const discretionaryTotal = useActualForBalance ? weeklyActualValue(activeWeek.actual, "discretionarySpending", planned.discretionaryAllowance) : activeWeek?.planned ? planned.discretionaryAllowance : plannerSectionTotal(sections.discretionary, index);
      const transfersTotal = useActualForBalance
        ? actualData.transfersOut
        : activeWeek?.planned
          ? planned.investment + planned.extraSuper + planned.extraDebtRepayment + (planned.offsetTransfer || 0) + (planned.otherTransfers || 0)
        : plannerSectionTotal(sections.transfers, index);
      const investmentTransferTotal = useActualForBalance ? weeklyActualValue(activeWeek.actual, "investment", planned.investment) : plannerTransferTotal(sections.transfers, "investmentTransfer", index);
      const superTransferTotal = useActualForBalance ? weeklyActualValue(activeWeek.actual, "extraSuper", planned.extraSuper) : plannerTransferTotal(sections.transfers, "superTransfer", index);
      const debtTransferTotal = useActualForBalance ? weeklyActualValue(activeWeek.actual, "extraDebtRepayment", planned.extraDebtRepayment) : plannerTransferTotal(sections.transfers, "debtTransfer", index);
      const offsetTransferTotal = useActualForBalance ? weeklyActualValue(activeWeek.actual, "offsetTransfer", planned.offsetTransfer) : plannerTransferTotal(sections.transfers, "offsetTransfer", index);
      const closingBalance = useActualForBalance ? actualData.calculatedClosing : activeWeek?.planned ? planned.closingBalance : plannerRound(opening + receiptsTotal - essentialTotal - provisionsTotal - discretionaryTotal - transfersTotal);
      const actual = activeWeek?.actual || null;
      Object.assign(week, {
        openingBalance: useActualForBalance ? actualData.opening : activeWeek?.planned ? planned.openingBalance : opening,
        plannedOpeningBalance: activeWeek?.planned ? planned.expectedOpeningBalance ?? planned.openingBalance : opening,
        plannedClosingBalance: activeWeek?.planned ? planned.expectedClosingBalance ?? planned.forecastClosingBalance ?? planned.closingBalance : closingBalance,
        receiptsTotal,
        essentialTotal,
        provisionsTotal,
        discretionaryTotal,
        transfersTotal,
        investmentTransferTotal,
        superTransferTotal,
        debtTransferTotal,
        offsetTransferTotal,
        closingBalance,
        isCompleted: Boolean(activeWeek?.isCompleted),
        actualOpeningBalance: actual && weeklyHasActualAmount(actual, "openingBalance") ? actual.openingBalance : null,
        actualReceiptsTotal: actual ? plannerRound(weeklyActualValue(actual, "income", planned.income) + weeklyActualValue(actual, "transfersIn", 0)) : null,
        actualEssentialTotal: actual && weeklyHasActualAmount(actual, "essentialCosts") ? actual.essentialCosts : null,
        actualProvisionsTotal: actual && (weeklyHasActualAmount(actual, "amountSetAside") || weeklyHasActualAmount(actual, "provisions")) ? weeklyActualSetAside(actual, planned) : null,
        actualDiscretionaryTotal: actual && weeklyHasActualAmount(actual, "discretionarySpending") ? actual.discretionarySpending : null,
        actualTransfersTotal: actual ? weeklyActualTransfers(actual, planned) : null,
        actualClosingBalance: actual ? actualData.calculatedClosing : null,
        enteredBankBalance: actual && weeklyHasActualAmount(actual, "enteredBankBalance") ? actual.enteredBankBalance : null,
        reconciliationDifference: actual && weeklyHasActualAmount(actual, "enteredBankBalance") ? plannerRound(actual.enteredBankBalance - actualData.calculatedClosing) : null,
        statusLabel: activeWeek?.isCompleted ? "Completed" : activeWeek ? weeklyCalendarStatusText(activeWeek) : "Forecast",
      });
      week.priority = weeklyPriority(week);
      opening = closingBalance;
    });
    const summary = {
      totalIncome: plannerRound(weeks.reduce((total, week) => total + week.receiptsTotal, 0)),
      totalEssential: plannerRound(weeks.reduce((total, week) => total + week.essentialTotal, 0)),
      totalProvisions: plannerRound(weeks.reduce((total, week) => total + (week.provisionsTotal || 0), 0)),
      totalLifestyle: plannerRound(weeks.reduce((total, week) => total + week.discretionaryTotal, 0)),
      totalOffset: plannerRound(weeks.reduce((total, week) => total + week.offsetTransferTotal, 0)),
      totalDebt: plannerRound(weeks.reduce((total, week) => total + week.debtTransferTotal, 0)),
      totalInvesting: plannerRound(weeks.reduce((total, week) => total + week.investmentTransferTotal, 0)),
      totalSuper: plannerRound(weeks.reduce((total, week) => total + week.superTransferTotal, 0)),
      startingCash: plannerRound(settings.startingBalance),
      endingCash: plannerRound(weeks.at(-1)?.closingBalance || 0),
      weeksNegative: weeks.filter((week) => week.closingBalance < 0).length,
    };
    summary.estimatedImprovement = plannerRound((summary.endingCash - summary.startingCash) + summary.totalOffset + summary.totalDebt + summary.totalInvesting + summary.totalSuper);
    summary.savingsRate = summary.totalIncome > 0 ? plannerRound((summary.totalOffset + summary.totalDebt + summary.totalInvesting + summary.totalSuper) / summary.totalIncome) : 0;
    return {
      appVersion: APP_VERSION,
      householdName: [plan.personal.person1Name, plan.personal.person2Name].filter(Boolean).join(" and ") || "Current plan",
      planName: householdNameForFile(),
      startDateIso: settings.startDate,
      generatedAtIso: new Date().toISOString(),
      startingBalance: plannerRound(settings.startingBalance),
      weeks,
      sections,
      lookupRows: {},
      summary,
      assumptions: plannerAssumptions(result),
      snapshot: {
        offsetBalance: Number(plan.assets.offsetBalance) || 0,
        cashSavings: Number(plan.assets.cash) || 0,
        investmentBalance: (Number(plan.assets.sharesEtfs) || 0) + (Number(plan.assets.crypto) || 0),
        superBalance: result.superannuationBalance || 0,
        totalDebtBalance: result.totalLiabilities || 0,
        endingBankBalance: summary.endingCash,
        offsetChange: summary.totalOffset,
        investmentChange: summary.totalInvesting,
        superChange: summary.totalSuper,
        debtChange: summary.totalDebt,
      },
      negativeWeeks: weeks.filter((week) => week.closingBalance < 0).map((week) => week.week),
    };
  }

  function renderWeeklyPlannerPreview(planner) {
    const preview = document.getElementById("weeklyPlannerPreview");
    const warning = document.getElementById("plannerWarning");
    const excelButton = document.getElementById("plannerDownloadExcelButton");
    const pdfButton = document.getElementById("plannerDownloadPdfButton");
    if (!preview) return;
    const firstWeek = planner.weeks[0];
    const finalWeek = planner.weeks.at(-1);
    const totalReceipts = plannerRound(planner.weeks.reduce((total, week) => total + week.receiptsTotal, 0));
    const totalProvisions = plannerRound(planner.weeks.reduce((total, week) => total + (week.provisionsTotal || 0), 0));
    const totalTransfers = plannerRound(planner.weeks.reduce((total, week) => total + week.transfersTotal, 0));
    const totalInvesting = plannerRound(planner.weeks.reduce((total, week) => total + week.investmentTransferTotal, 0));
    const totalSuper = plannerRound(planner.weeks.reduce((total, week) => total + week.superTransferTotal, 0));
    if (warning) {
      warning.classList.remove("hidden");
      warning.classList.toggle("planner-warning-negative", planner.negativeWeeks.length > 0);
      warning.classList.toggle("planner-warning-positive", planner.negativeWeeks.length === 0);
      warning.innerHTML = planner.negativeWeeks.length
        ? `<strong>Weekly Plan warning:</strong> Your current plan produces a negative projected bank balance in ${planner.negativeWeeks.length} week${planner.negativeWeeks.length === 1 ? "" : "s"}. Review the timing of planned transfers, spending or bills before relying on the planner.`
        : `<strong>Planner ready:</strong> No negative weekly closing bank balances are projected from the current schedule.`;
    }
    if (excelButton) excelButton.disabled = false;
    if (pdfButton) pdfButton.disabled = false;
    preview.innerHTML = `
      <div class="summary-grid planner-summary-grid">
        ${summaryTile("Planner period", `${planner.weeks.length} weeks`)}
        ${summaryTile("Week 1 starts", plannerShortDate(firstWeek.startDateIso))}
        ${summaryTile("Starting bank balance", money(planner.startingBalance))}
        ${summaryTile("Projected ending balance", money(finalWeek.closingBalance), finalWeek.closingBalance >= 0 ? "status-green" : "status-amber")}
        ${summaryTile("Estimated net money in", money(totalReceipts))}
        ${summaryTile("Provisions", money(totalProvisions))}
        ${summaryTile("Planned transfers", money(totalTransfers))}
        ${summaryTile("Investing scheduled", money(totalInvesting))}
        ${summaryTile("Extra super scheduled", money(totalSuper))}
      </div>
      <div class="planner-print-section mt-4">
        <div class="planner-print-heading">
          <h3>Weekly Money Plan</h3>
          <p>Use this as a practical weekly guide. The Excel file remains editable after download.</p>
        </div>
        <div class="planner-week-grid">
          ${planner.weeks.map((week) => `
            <article class="planner-week-card ${week.closingBalance < 0 ? "planner-week-warning" : ""}">
              <div class="planner-week-title">
                <div>
                  <span>Week ${week.week}</span>
                  <h4>${plannerShortDate(week.startDateIso)}</h4>
                </div>
                <strong>${money(week.closingBalance)}</strong>
              </div>
              <div class="planner-week-lines">
                <div><span>Estimated net money in</span><strong>${money(week.receiptsTotal)}</strong></div>
                <div><span>Bills and spending</span><strong>${money(week.essentialTotal + week.discretionaryTotal)}</strong></div>
                <div><span>Provisions</span><strong>${money(week.provisionsTotal || 0)}</strong></div>
                <div><span>Planned transfers</span><strong>${money(week.transfersTotal)}</strong></div>
                <div><span>Opening balance</span><strong>${money(week.openingBalance)}</strong></div>
                <div><span>Expected closing balance</span><strong>${money(week.closingBalance)}</strong></div>
              </div>
              <p>${escapeHtml(week.priority)}</p>
              <div class="planner-checkbox-list">
                <span>&#9633; Income received</span>
                <span>&#9633; Bills paid</span>
                <span>&#9633; Investing done</span>
                <span>&#9633; Super done</span>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderWeeklyPlannerControls(result) {
    const startInput = document.getElementById("plannerStartDate");
    const balanceInput = document.getElementById("plannerStartingBalance");
    const periodInput = document.getElementById("plannerPeriod");
    const preview = document.getElementById("weeklyPlannerPreview");
    const excelButton = document.getElementById("plannerDownloadExcelButton");
    const pdfButton = document.getElementById("plannerDownloadPdfButton");
    if (!startInput || !balanceInput || !periodInput || !preview) return;
    ensurePlanSettings(plan);
    const settings = plan.reportSettings.weeklyPlanner;
    if (!startInput.value) startInput.value = settings.startDate || nextMondayIso();
    if (balanceInput.value === "") balanceInput.value = settings.startingBalance ?? defaultPlannerStartingBalance();
    if (!periodInput.value) periodInput.value = String(settings.periodWeeks || 52);
    plan.reportSettings.weeklyPlanner = {
      ...settings,
      startDate: startInput.value,
      startingBalance: Number(balanceInput.value) || 0,
      periodWeeks: Number(periodInput.value) || 52,
    };
    if (generatedWeeklyPlanner) {
      renderWeeklyPlannerPreview(generatedWeeklyPlanner);
      return;
    }
    if (excelButton) excelButton.disabled = true;
    if (pdfButton) pdfButton.disabled = true;
    const warning = document.getElementById("plannerWarning");
    if (warning) warning.classList.add("hidden");
    preview.innerHTML = `
      <div class="planner-empty-state">
        <strong>Generate the planner when your plan is ready.</strong>
        <p>The Excel workbook will include Start Here, Weekly Planner, Weekly Money Plan, Wealth Snapshot and Annual Summary worksheets.</p>
      </div>
    `;
  }

  function generateWeeklyPlanner() {
    const result = CALC.calculatePlan(plan);
    generatedWeeklyPlanner = buildWeeklyPlannerData(result);
    saveDraft("Weekly planner settings saved.");
    renderWeeklyPlannerPreview(generatedWeeklyPlanner);
    updateSaveStatus("Weekly planner generated.");
  }

  function downloadWeeklyPlannerExcel() {
    if (!generatedWeeklyPlanner) generateWeeklyPlanner();
    if (!window.FFSWeeklyPlannerExport?.createWorkbookBlob) {
      updateSaveStatus("Excel export is not available in this browser.");
      return;
    }
    const blob = window.FFSWeeklyPlannerExport.createWorkbookBlob(generatedWeeklyPlanner);
    downloadBlob(blob, safeFilename(`Financial-Freedom-Weekly-Planner-${generatedWeeklyPlanner.planName}`, "xlsx"));
    updateSaveStatus("Weekly planner Excel downloaded.");
  }

  function printWithMode(mode) {
    document.body.dataset.printMode = mode;
    window.print();
    window.setTimeout(() => {
      if (document.body.dataset.printMode === mode) delete document.body.dataset.printMode;
    }, 1000);
  }

  function printWeeklyPlannerPdf() {
    if (!generatedWeeklyPlanner) generateWeeklyPlanner();
    updateSaveStatus("Use the print dialog to save the weekly planner as PDF.");
    printWithMode("weekly-planner");
  }

  function updatePlannerSettingsFromInput(target) {
    ensurePlanSettings(plan);
    if (target.id === "plannerStartDate") plan.reportSettings.weeklyPlanner.startDate = target.value || nextMondayIso();
    if (target.id === "plannerStartingBalance") plan.reportSettings.weeklyPlanner.startingBalance = Number(target.value) || 0;
    if (target.id === "plannerPeriod") plan.reportSettings.weeklyPlanner.periodWeeks = Number(target.value) || 52;
    generatedWeeklyPlanner = null;
    autosavePlan();
    renderWeeklyPlannerControls(CALC.calculatePlan(plan));
  }

  function syncWeeklyPlanExportSettings() {
    if (!weeklyPlan) return;
    ensurePlanSettings(plan);
    plan.reportSettings.weeklyPlanner = {
      ...plan.reportSettings.weeklyPlanner,
      startDate: weeklyPlan.startDate,
      startingBalance: weeklyPlan.openingBankBalance,
      periodWeeks: weeklyPlan.durationWeeks,
      extraDebtRepaymentTarget: weeklyPlan.settings?.extraDebtRepaymentTarget || 0,
    };
    const startInput = document.getElementById("plannerStartDate");
    const balanceInput = document.getElementById("plannerStartingBalance");
    const periodInput = document.getElementById("plannerPeriod");
    if (startInput) startInput.value = weeklyPlan.startDate;
    if (balanceInput) balanceInput.value = weeklyPlan.openingBankBalance;
    if (periodInput) periodInput.value = String(weeklyPlan.durationWeeks);
  }

  function weeklyDateLabel(startDate, endDate = "") {
    const start = new Date(`${startDate}T00:00:00`);
    const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
    if (Number.isNaN(start.getTime())) return startDate || "";
    const startText = start.toLocaleDateString("en-AU", { day: "numeric", month: "long" });
    if (!end || Number.isNaN(end.getTime())) return startText;
    const endText = end.toLocaleDateString("en-AU", { day: "numeric", month: "long" });
    return `${startText} to ${endText}`;
  }

  function weeklyStatusClass(status) {
    if (status === "on-track") return "weekly-status-on-track";
    if (status === "tight") return "weekly-status-tight";
    return "weekly-status-action";
  }

  function weeklyStatusLabel(status) {
    if (status === "on-track") return "On track";
    if (status === "tight") return "Tight week";
    return "Action needed";
  }

  function weeklyProgressPercent(actual, target) {
    if (!target) return 0;
    return Math.min(100, Math.max(0, (Number(actual) || 0) / target * 100));
  }

  function weeklyInputValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : "0";
  }

  function weeklyTimingRows(items, type, values = {}) {
    if (!items.length) return `<p class="weekly-muted">No ${type === "payDates" ? "income" : "bill"} items available yet.</p>`;
    return `
      <div class="weekly-timing-list">
        ${items.map((item) => `
          <label>
            <span class="field-label">${escapeHtml(item.name || item.label || "Item")}</span>
            <input class="field-input" type="date" data-weekly-setup-date="${type}" data-weekly-id="${escapeHtml(item.id)}" value="${escapeHtml(values[item.id] || "")}">
          </label>
        `).join("")}
      </div>
    `;
  }

  function weeklyDateSettingsRows(items, type, values = {}) {
    if (!items.length) return `<p class="weekly-muted">No ${type === "payDates" ? "income" : "bill"} items available yet.</p>`;
    return `
      <div class="weekly-timing-list">
        ${items.map((item) => `
          <label>
            <span class="field-label">${escapeHtml(item.name || item.label || "Item")}</span>
            <input class="field-input" type="date" data-weekly-date="${type}" data-weekly-id="${escapeHtml(item.id)}" value="${escapeHtml(values[item.id] || "")}">
          </label>
        `).join("")}
      </div>
    `;
  }

  const weeklyTimingFrequencyOptions = [
    ["weekly", "Weekly"],
    ["fortnightly", "Fortnightly"],
    ["monthly", "Monthly"],
    ["quarterly", "Quarterly"],
    ["annually", "Annually"],
    ["oneOff", "One-off"],
    ["weeklyProvision", "Weekly provision"],
  ];

  const weeklyTimingTypeOptions = [
    ["money-in", "Money in"],
    ["bill", "Bills and spending"],
    ["provision", "Provisions"],
    ["transfer", "Financial Freedom transfers"],
  ];

  function weeklyTimingTypeLabel(type) {
    return weeklyTimingTypeOptions.find(([value]) => value === type)?.[1] || "Bills and spending";
  }

  function weeklyTimingNextDate(item) {
    const start = new Date(`${weeklyPlan?.weeks?.[(weeklyPlan?.currentWeekNumber || 1) - 1]?.startDate || weeklyPlan?.startDate || item.firstDate}T00:00:00`);
    let date = new Date(`${item.firstDate || weeklyPlan?.startDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return item.firstDate || weeklyPlan?.startDate || "";
    const anchorDay = date.getDate();
    const addMonths = (source, months) => {
      const target = new Date(source.getFullYear(), source.getMonth() + months, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(anchorDay, lastDay));
      return target;
    };
    const advance = () => {
      if (item.frequency === "fortnightly") date.setDate(date.getDate() + 14);
      else if (item.frequency === "monthly") date = addMonths(date, 1);
      else if (item.frequency === "quarterly") date = addMonths(date, 3);
      else if (item.frequency === "annually") date = addMonths(date, 12);
      else date.setDate(date.getDate() + 7);
    };
    let guard = 0;
    while (date < start && item.frequency !== "oneOff" && guard < 160) {
      advance();
      guard += 1;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function weeklyTimingFrequencyText(item) {
    const frequency = item.type === "money-in" && item.frequency === "weeklyProvision" ? "weekly" : item.frequency;
    return (weeklyTimingFrequencyOptions.find(([value]) => value === frequency)?.[1] || frequency || "Weekly").toLowerCase();
  }

  function beginWeeklyTimingEdit(itemId) {
    const item = (weeklyPlan?.settings?.timingItems || []).find((candidate) => candidate.id === itemId);
    if (!item) return;
    editingTimingItemId = item.id;
    timingEditDraft = {
      ...JSON.parse(JSON.stringify(item)),
      amountInput: weeklyInputValue(item.amount),
    };
    weeklyPlanUiState.isTimingSetupExpanded = true;
    renderOutputs();
    window.setTimeout(() => {
      const editor = [...document.querySelectorAll("[data-timing-editor]")].find((node) => node.dataset.weeklyTimingId === item.id);
      editor?.querySelector('[data-key="amountInput"]')?.focus();
    }, 50);
  }

  function weeklyTimingEditorHtml(item) {
    const draft = editingTimingItemId === item.id && timingEditDraft ? timingEditDraft : { ...item, amountInput: weeklyInputValue(item.amount) };
    const amountValue = draft.amountInput ?? weeklyInputValue(draft.amount);
    return `
      <div class="weekly-timing-editor" data-timing-editor data-weekly-timing-id="${escapeHtml(item.id)}">
        <div class="weekly-setup-grid mt-3">
          <label>
            <span class="field-label">Description</span>
            <input class="field-input" type="text" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="description" data-type="text" value="${escapeHtml(draft.description || "")}">
            ${item.isNetPay ? `<small class="field-help">Estimated net pay is based on income, tax, Medicare levy, HELP and salary-sacrifice information entered in the Financial Plan.</small>` : ""}
          </label>
          <label>
            <span class="field-label">Amount</span>
            <input class="field-input" type="text" inputmode="decimal" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="amountInput" data-type="text" value="${escapeHtml(amountValue)}">
          </label>
          <label>
            <span class="field-label">Frequency</span>
            <select class="field-input" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="frequency" data-type="text">${optionList(weeklyTimingFrequencyOptions, draft.frequency)}</select>
          </label>
          <label>
            <span class="field-label">First date</span>
            <input class="field-input" type="date" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="firstDate" data-type="text" value="${escapeHtml(draft.firstDate || weeklyPlan.startDate)}">
          </label>
          <label>
            <span class="field-label">End date</span>
            <input class="field-input" type="date" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="endDate" data-type="text" value="${escapeHtml(draft.endDate || "")}">
          </label>
          <label>
            <span class="field-label">Type</span>
            <select class="field-input" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="type" data-type="text">${optionList(weeklyTimingTypeOptions, draft.type)}</select>
          </label>
          <label>
            <span class="field-label">Treatment</span>
            <select class="field-input" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="treatment" data-type="text"${draft.type === "money-in" ? " disabled" : ""}>
              <option value="pay-on-date"${draft.treatment !== "set-aside" ? " selected" : ""}>Pay on due date</option>
              <option value="set-aside"${draft.treatment === "set-aside" ? " selected" : ""}>Set aside progressively</option>
            </select>
          </label>
          <label>
            <span class="field-label">Transfer category</span>
            <select class="field-input" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="transferType" data-type="text">
              ${optionList([["", "Other"], ["offset", "Offset"], ["extraDebt", "Debt repayment"], ["investment", "Investing"], ["extraSuper", "Extra super"]], draft.transferType || "")}
            </select>
          </label>
          <label class="weekly-active-toggle">
            <span class="field-label">Active</span>
            <input type="checkbox" data-weekly-timing-draft="${escapeHtml(item.id)}" data-key="active" data-type="boolean"${draft.active !== false ? " checked" : ""}>
          </label>
        </div>
        <div class="weekly-action-row mt-3">
          <button class="btn btn-primary" type="button" data-weekly-action="save-timing-item" data-weekly-timing-id="${escapeHtml(item.id)}">Save Changes</button>
          <button class="btn" type="button" data-weekly-action="cancel-timing-item" data-weekly-timing-id="${escapeHtml(item.id)}">Cancel</button>
        </div>
        <div class="weekly-occurrence-editor mt-4">
          <h4>Adjust a payment or receipt</h4>
          <p class="weekly-muted mt-2">Move, skip or update one expected occurrence without rebuilding the whole plan.</p>
          <div class="weekly-setup-grid mt-3">
            <label>
              <span class="field-label">Occurrence date</span>
              <input class="field-input" type="date" data-weekly-occurrence-date value="${escapeHtml(item.firstDate || weeklyPlan.startDate)}">
            </label>
            <label>
              <span class="field-label">New amount</span>
              <input class="field-input" type="number" step="0.01" data-weekly-occurrence-amount placeholder="${weeklyInputValue(item.amount)}">
            </label>
            <label>
              <span class="field-label">Move to date</span>
              <input class="field-input" type="date" data-weekly-occurrence-new-date>
            </label>
            <label>
              <span class="field-label">New frequency</span>
              <select class="field-input" data-weekly-occurrence-frequency>
                <option value="">Keep current frequency</option>
                ${optionList(weeklyTimingFrequencyOptions, "")}
              </select>
            </label>
            <label class="weekly-active-toggle weekly-skip-toggle">
              <span class="field-label">Skip this occurrence</span>
              <input type="checkbox" data-weekly-occurrence-skip>
            </label>
          </div>
          <fieldset class="weekly-scope-options mt-3">
            <legend>Apply this change to</legend>
            <label><input type="radio" name="weekly-scope-${escapeHtml(item.id)}" value="this" data-weekly-occurrence-scope checked><span><strong>This occurrence only</strong>Change only this payment or receipt.</span></label>
            <label><input type="radio" name="weekly-scope-${escapeHtml(item.id)}" value="future" data-weekly-occurrence-scope><span><strong>This and future occurrences</strong>Use the new timing or amount from this occurrence onward.</span></label>
            <label><input type="radio" name="weekly-scope-${escapeHtml(item.id)}" value="all" data-weekly-occurrence-scope><span><strong>Every occurrence</strong>Replace the recurring setup across the whole planner period.</span></label>
          </fieldset>
          <p class="weekly-device-note mt-3">This updates your Weekly Plan only. If this is a permanent pay rise or ongoing lifestyle change, also update your main Financial Plan so your long-term projections remain accurate.</p>
          <button class="btn mt-3" type="button" data-weekly-action="apply-occurrence-edit" data-weekly-timing-id="${escapeHtml(item.id)}">Apply timing change</button>
        </div>
      </div>
    `;
  }

  function weeklyTimingRowsHtml() {
    const items = weeklyPlan?.settings?.timingItems || [];
    if (!items.length) return `<p class="weekly-muted">Create or rebuild the Weekly Plan to prefill income, bills, provisions and transfers from the current financial plan.</p>`;
    const groups = [
      ["Income", items.filter((item) => item.type === "money-in")],
      ["Bills", items.filter((item) => item.type === "bill")],
      ["Provisions", items.filter((item) => item.type === "provision")],
      ["Planned transfers", items.filter((item) => item.type === "transfer")],
    ].filter(([, groupItems]) => groupItems.length);
    return `
      <div class="weekly-timing-table" aria-label="Cashflow timing setup">
        ${groups.map(([label, groupItems]) => `
          <section class="weekly-timing-group" aria-label="${escapeHtml(label)}">
            <h4>${escapeHtml(label)}</h4>
            ${groupItems.map((item) => {
              const isEditing = editingTimingItemId === item.id;
              return `
                <article class="weekly-timing-row${isEditing ? " editing" : ""}">
                  <div class="weekly-timing-summary">
                    <div>
                      <strong>${escapeHtml(item.description || "Cashflow item")}</strong>
                      <span>${money(item.amount)} ${escapeHtml(weeklyTimingFrequencyText(item))} · Next ${plannerShortDate(weeklyTimingNextDate(item))}</span>
                      ${item.isNetPay ? `<small>Estimated net pay</small>` : ""}
                    </div>
                    <div class="weekly-timing-summary-meta">
                      ${item.active === false ? `<span>Inactive</span>` : ""}
                      ${isEditing ? `<span>Editing draft</span>` : ""}
                      <button class="btn btn-small" type="button" data-weekly-action="begin-timing-edit" data-weekly-timing-id="${escapeHtml(item.id)}">${isEditing ? "Editing" : "Edit"}</button>
                    </div>
                  </div>
                  ${isEditing ? weeklyTimingEditorHtml(item) : ""}
                </article>
              `;
            }).join("")}
          </section>
        `).join("")}
      </div>
    `;
  }

  function weeklyOneOffFormHtml() {
    return `
      <details class="weekly-setup-details mt-4">
        <summary>Add one-off item</summary>
        <p class="weekly-muted mt-2">Add a once-only receipt, bill, provision or transfer to the weekly schedule. This does not change your long-term Financial Freedom plan.</p>
        <div class="weekly-setup-grid mt-4">
          <label>
            <span class="field-label">Description</span>
            <input class="field-input" id="weeklyOneOffDescription" type="text" placeholder="e.g. Car repair">
          </label>
          <label>
            <span class="field-label">Amount</span>
            <input class="field-input" id="weeklyOneOffAmount" type="number" step="0.01">
          </label>
          <label>
            <span class="field-label">Date</span>
            <input class="field-input" id="weeklyOneOffDate" type="date" value="${escapeHtml(weeklyPlan?.startDate || "")}">
          </label>
          <label>
            <span class="field-label">Type</span>
            <select class="field-input" id="weeklyOneOffType">${optionList(weeklyTimingTypeOptions, "bill")}</select>
          </label>
        </div>
        <button class="btn btn-primary mt-4" type="button" data-weekly-action="add-one-off">Add one-off item</button>
      </details>
    `;
  }

  function weeklyTimingValidation() {
    const items = weeklyPlan?.settings?.timingItems || [];
    const oneOffItems = weeklyPlan?.settings?.oneOffItems || [];
    const frequencies = new Set(weeklyTimingFrequencyOptions.map(([value]) => value));
    const blocking = [];
    const warnings = [];
    const seen = new Set();
    const start = new Date(`${weeklyPlan?.startDate || ""}T00:00:00`);
    const end = weeklyPlan?.weeks?.length ? new Date(`${weeklyPlan.weeks.at(-1).endDate}T00:00:00`) : start;
    const activeItems = items.filter((item) => item.active !== false);
    activeItems.forEach((item) => {
      const label = item.description || "Timing item";
      const amount = Number(item.amount);
      if (!String(item.description || "").trim()) blocking.push("A timing item is missing a description.");
      if (!Number.isFinite(amount) || amount < 0) blocking.push(`${label} has an invalid amount.`);
      if (!item.firstDate) blocking.push(`${label} needs a first date.`);
      if (!frequencies.has(item.frequency)) blocking.push(`${label} has an invalid frequency.`);
      const firstDate = new Date(`${item.firstDate || ""}T00:00:00`);
      if (Number.isNaN(firstDate.getTime())) blocking.push(`${label} has an invalid first date.`);
      else if (firstDate < start || firstDate > end) warnings.push(`${label} starts outside the current planner period.`);
      const duplicateKey = [item.type, item.description, item.amount, item.frequency, item.firstDate].join("|").toLowerCase();
      if (seen.has(duplicateKey)) warnings.push(`${label} appears to duplicate another active timing item.`);
      seen.add(duplicateKey);
    });
    if (!activeItems.some((item) => item.type === "money-in")) warnings.push("No active income item is currently included.");
    return {
      blocking: [...new Set(blocking)],
      warnings: [...new Set(warnings)],
      activeCount: activeItems.length,
      incomeCount: activeItems.filter((item) => item.type === "money-in").length,
      billCount: activeItems.filter((item) => item.type === "bill").length,
      provisionCount: activeItems.filter((item) => item.type === "provision").length,
      transferCount: activeItems.filter((item) => item.type === "transfer").length,
      oneOffCount: oneOffItems.filter((item) => item.active !== false).length,
    };
  }

  function weeklyTimingSummaryText(validation) {
    const parts = [
      `${validation.incomeCount} income item${validation.incomeCount === 1 ? "" : "s"}`,
      `${validation.billCount} bill${validation.billCount === 1 ? "" : "s"}`,
      `${validation.provisionCount} provision${validation.provisionCount === 1 ? "" : "s"}`,
      `${validation.transferCount} planned transfer${validation.transferCount === 1 ? "" : "s"}`,
    ];
    if (validation.oneOffCount) parts.push(`${validation.oneOffCount} one-off item${validation.oneOffCount === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }

  function weeklyTimingStatusText(validation) {
    const settings = weeklyPlan?.settings || {};
    if (validation.blocking.length) return "Review required";
    if (settings.timingSetupNeedsReview || settings.timingSetupRequiresReview) return "Timing updated - review recommended";
    if (settings.timingSetupReviewed) return "Timing reviewed";
    return "Review timing";
  }

  function weeklyTimingSetupHtml() {
    const validation = weeklyTimingValidation();
    const settings = weeklyPlan?.settings || {};
    const needsReview = Boolean(settings.timingSetupNeedsReview || settings.timingSetupRequiresReview);
    const expanded = weeklyPlanUiState.isTimingSetupExpanded === null
      ? (!settings.timingSetupReviewed || needsReview || validation.blocking.length > 0)
      : weeklyPlanUiState.isTimingSetupExpanded;
    const lastReviewedAt = settings.timingSetupLastReviewedAt || settings.timingSetupReviewedAt;
    const reviewedAt = lastReviewedAt ? `Last reviewed ${formatLastSaved(lastReviewedAt).toLowerCase()}` : "Not reviewed yet";
    if (!expanded) {
      return `
        <article class="card weekly-step-card weekly-timing-collapsed">
          <button class="weekly-accordion-toggle" type="button" data-weekly-action="toggle-timing-setup" aria-expanded="false" aria-controls="weeklyTimingSetupPanel">
            <div>
              <span class="metric-label">Step 1 - Review timing</span>
              <h3>Cashflow Timing Setup</h3>
              <strong>${escapeHtml(weeklyTimingStatusText(validation))}</strong>
              <span>${escapeHtml(weeklyTimingSummaryText(validation))}</span>
              <small>${validation.blocking.length + validation.warnings.length ? `${validation.blocking.length + validation.warnings.length} item${validation.blocking.length + validation.warnings.length === 1 ? "" : "s"} need attention` : reviewedAt}</small>
            </div>
            <b>Expand</b>
          </button>
        </article>
      `;
    }
    return `
      <article class="card weekly-step-card" id="weeklyTimingSetupPanel">
        <div class="card-heading">
          <div>
            <span class="metric-label">Step 1 - Review timing</span>
            <h3>Cashflow Timing Setup</h3>
            <span>Review when your income, bills and planned transfers are expected to occur. The app has prefilled this information from your financial plan. Adjust only the timing or amounts that differ.</span>
          </div>
          <button class="btn" type="button" data-weekly-action="toggle-timing-setup" aria-expanded="true" aria-controls="weeklyTimingSetupPanel">Collapse</button>
        </div>
        <p class="weekly-review-status mt-4"><strong>${escapeHtml(weeklyTimingStatusText(validation))}</strong> · ${escapeHtml(weeklyTimingSummaryText(validation))}</p>
        ${validation.blocking.length ? `<p class="weekly-warning mt-3">Please correct the highlighted timing items before continuing. ${escapeHtml(validation.blocking.join(" "))}</p>` : ""}
        ${!validation.blocking.length && validation.warnings.length ? `<p class="weekly-warning mt-3">Some timing details are estimated. ${escapeHtml(validation.warnings.join(" "))}</p>` : ""}
        <p class="weekly-device-note mt-4">Estimated net pay is based on the income, tax, Medicare levy, HELP and salary-sacrifice information entered in the Financial Plan. Actual payroll amounts may differ.</p>
        <p class="weekly-device-note mt-3">Changes made here update your weekly schedule only. They do not automatically change your long-term Financial Freedom plan.</p>
        <div class="mt-4">${weeklyTimingRowsHtml()}</div>
        ${weeklyOneOffFormHtml()}
        <div class="weekly-action-row mt-4">
          <button class="btn btn-primary" type="button" data-weekly-action="complete-timing-review">${settings.timingSetupReviewed ? "Finish Reviewing Timing" : "Timing Setup Complete"}</button>
        </div>
        <p class="weekly-device-note mt-3">You can return and update your timing whenever your income, expenses or payment dates change.</p>
      </article>
    `;
  }

  function weeklyBillTimingItems() {
    ensureCollectionData();
    return [
      ...(plan.expenseItems || []).map((item) => ({ id: item.id, name: item.name || "Expense" })),
      ...(plan.liabilityItems || []).filter((item) => item.type !== "hecsHelp").map((item) => ({ id: item.id, name: `${item.name || "Debt"} repayment` })),
    ];
  }

  function weeklyPlanSetupHtml(result) {
    ensureCollectionData();
    const savedSetup = plan.reportSettings?.weeklyPlanSetup || {};
    const defaults = window.FFSWeeklyPlan.defaultSettings(plan, result, savedSetup);
    return `
      <article class="weekly-setup-card card">
        <div class="card-heading">
          <div>
            <span class="metric-label">First-time setup</span>
            <h3>Create your Weekly Plan</h3>
            <span>Your Weekly Money Plan turns your financial strategy into practical weekly actions. Review the information below, confirm your opening balance and select when you want the plan to begin.</span>
          </div>
        </div>
        <div class="weekly-setup-grid mt-4">
          <label>
            <span class="field-label">Planner start date</span>
            <input class="field-input" type="date" data-weekly-setup="startDate" data-type="text" value="${escapeHtml(defaults.startDate)}">
          </label>
          <label>
            <span class="field-label">Everyday bank opening balance</span>
            <input class="field-input" type="number" step="100" data-weekly-setup="openingBankBalance" value="${weeklyInputValue(defaults.openingBankBalance)}">
            <small class="field-help">Main account used for income and normal spending.</small>
          </label>
          <label>
            <span class="field-label">Planner duration</span>
            <select class="field-input" data-weekly-setup="durationWeeks" data-type="number">
              <option value="12"${defaults.durationWeeks === 12 ? " selected" : ""}>12 weeks</option>
              <option value="26"${defaults.durationWeeks === 26 ? " selected" : ""}>26 weeks</option>
              <option value="52"${defaults.durationWeeks === 52 ? " selected" : ""}>52 weeks</option>
            </select>
          </label>
          <label>
            <span class="field-label">Minimum cash buffer</span>
            <input class="field-input" type="number" step="100" data-weekly-setup="minimumCashBuffer" value="${weeklyInputValue(defaults.minimumCashBuffer)}">
          </label>
          <label>
            <span class="field-label">Weekly spending limit</span>
            <input class="field-input" type="number" step="25" data-weekly-setup="weeklyDiscretionaryLimit" value="${weeklyInputValue(defaults.weeklyDiscretionaryLimit)}">
          </label>
          <label>
            <span class="field-label">Preferred surplus allocation</span>
            <select class="field-input" data-weekly-setup="allocationMode" data-type="text">
              <option value="priority"${defaults.allocationSettings.mode === "priority" ? " selected" : ""}>Use priority order</option>
              <option value="split"${defaults.allocationSettings.mode === "split" ? " selected" : ""}>Split by percentage</option>
              <option value="cash"${defaults.allocationSettings.mode === "cash" ? " selected" : ""}>Keep surplus as cash</option>
            </select>
          </label>
          <label>
            <span class="field-label">Optional transfer priority</span>
            <select class="field-input" data-weekly-setup="priorityFirst" data-type="text">
              <option value="extraDebt"${defaults.allocationSettings.priority[0] === "extraDebt" ? " selected" : ""}>Extra debt repayment first</option>
              <option value="investment"${defaults.allocationSettings.priority[0] === "investment" ? " selected" : ""}>Invest first</option>
              <option value="extraSuper"${defaults.allocationSettings.priority[0] === "extraSuper" ? " selected" : ""}>Extra super first</option>
            </select>
          </label>
          <label>
            <span class="field-label">Missed wealth transfers</span>
            <select class="field-input" data-weekly-setup="missedTransferTreatment" data-type="text">
              <option value="carry-forward"${defaults.missedTransferTreatment === "carry-forward" ? " selected" : ""}>Carry forward when affordable</option>
              <option value="spread"${defaults.missedTransferTreatment === "spread" ? " selected" : ""}>Spread across remaining weeks</option>
              <option value="none"${defaults.missedTransferTreatment === "none" ? " selected" : ""}>Do not carry forward</option>
            </select>
          </label>
        </div>
        <details class="weekly-setup-details mt-4">
          <summary>Optional pay dates and bill dates</summary>
          <p class="weekly-muted mt-2">Add dates where you know them. If dates are not entered, the app uses the frequency and labels annual or irregular costs as amounts set aside.</p>
          <div class="weekly-timing-grid mt-4">
            <div>
              <h4>Pay dates</h4>
              ${weeklyTimingRows(plan.incomeItems || [], "payDates", defaults.payDates)}
            </div>
            <div>
              <h4>Bill dates</h4>
              ${weeklyTimingRows(weeklyBillTimingItems(), "billDates", defaults.billDates)}
            </div>
          </div>
        </details>
        <div class="weekly-setup-actions mt-4">
          <button class="btn btn-primary" type="button" data-weekly-action="create-plan">Create My Weekly Plan</button>
        </div>
      </article>
    `;
  }

  function readWeeklySetupOptions() {
    const options = {
      payDates: {},
      billDates: {},
    };
    document.querySelectorAll("[data-weekly-setup]").forEach((input) => {
      const key = input.dataset.weeklySetup;
      const value = input.dataset.type === "text" ? input.value : Number(input.value) || 0;
      if (key === "allocationMode") {
        options.allocationSettings = { ...(options.allocationSettings || {}), mode: input.value };
      } else if (key === "priorityFirst") {
        const rest = ["extraDebt", "investment", "extraSuper"].filter((item) => item !== input.value);
        options.allocationSettings = { ...(options.allocationSettings || {}), priority: [input.value, ...rest] };
      } else {
        options[key] = value;
      }
    });
    document.querySelectorAll("[data-weekly-setup-date]").forEach((input) => {
      if (!input.value) return;
      options[input.dataset.weeklySetupDate][input.dataset.weeklyId] = input.value;
    });
    plan.reportSettings.weeklyPlanSetup = options;
    return options;
  }

  function createWeeklyPlanFromSetup() {
    syncCollectionsToLegacy();
    const result = CALC.calculatePlan(plan);
    weeklyPlan = window.FFSWeeklyPlan.createFromPlan(plan, result, readWeeklySetupOptions(), null);
    activeWeeklyPlanTab = "thisWeek";
    weeklyEditingWeek = null;
    weeklyViewedWeekNumber = null;
    weeklyPlanUiState.isTimingSetupExpanded = true;
    editingTimingItemId = null;
    timingEditDraft = null;
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Weekly Plan created.");
    saveDraft();
    renderAll();
    showWorkspace("weeklyplan");
  }

  function weeklyTabsHtml() {
    const tabs = [
      ["thisWeek", "This Week"],
      ["upcoming", "Upcoming Weeks"],
      ["progress", "Progress"],
      ["settings", "Settings"],
    ];
    return `
      <div class="weekly-tabs" role="tablist" aria-label="Weekly Plan sections">
        ${tabs.map(([id, label]) => `<button class="weekly-tab${activeWeeklyPlanTab === id ? " active" : ""}" type="button" data-weekly-tab="${id}" role="tab" aria-selected="${activeWeeklyPlanTab === id}">${label}</button>`).join("")}
      </div>
    `;
  }

  function weeklyPlanCurrentCalendarWeekNumber() {
    if (!weeklyPlan?.weeks?.length) return 0;
    if (window.FFSWeeklyPlan?.currentCalendarWeekNumberFor) {
      return window.FFSWeeklyPlan.currentCalendarWeekNumberFor(weeklyPlan.weeks, weeklyPlan.startDate, weeklyPlan.settings?.todayIso || "");
    }
    return Number(weeklyPlan.currentCalendarWeekNumber || weeklyPlan.currentWeekNumber || 0);
  }

  function clampWeeklyWeekNumber(value) {
    if (!weeklyPlan?.weeks?.length) return 1;
    return Math.max(1, Math.min(weeklyPlan.weeks.length, Math.round(Number(value) || 1)));
  }

  function weeklyViewedWeek() {
    if (!weeklyPlan?.weeks?.length) return null;
    const currentCalendarWeek = weeklyPlanCurrentCalendarWeekNumber();
    const targetWeekNumber = clampWeeklyWeekNumber(weeklyViewedWeekNumber || currentCalendarWeek || 1);
    return weeklyPlan.weeks.find((week) => week.weekNumber === targetWeekNumber) || weeklyPlan.weeks[0];
  }

  function weeklyCurrentWeek() {
    return weeklyViewedWeek();
  }

  function daysUntilWeeklyPlanStarts() {
    if (!weeklyPlan?.startDate) return 0;
    const start = new Date(`${weeklyPlan.startDate}T00:00:00`);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.ceil((start.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000)));
  }

  function weeklyCalendarStatusParts(week) {
    const currentCalendarWeek = weeklyPlanCurrentCalendarWeekNumber();
    if (!week) return ["Future week"];
    const parts = [];
    if (currentCalendarWeek === 0) {
      if (week.isCompleted) parts.push("Completed");
      parts.push("Future week");
      return [...new Set(parts)];
    }
    if (week.weekNumber === currentCalendarWeek) parts.push("Current week");
    if (week.isCompleted) parts.push("Completed");
    else if (week.weekNumber > currentCalendarWeek) parts.push("Future week");
    else if (week.weekNumber < currentCalendarWeek) parts.push("Past week - not completed");
    if (!parts.length) parts.push("Future week");
    return parts;
  }

  function weeklyCalendarStatusText(week) {
    return weeklyCalendarStatusParts(week).join(" · ");
  }

  function weeklyWeekHasStarted(week) {
    const currentCalendarWeek = weeklyPlanCurrentCalendarWeekNumber();
    return currentCalendarWeek > 0 && week.weekNumber <= currentCalendarWeek;
  }

  function weeklyNavigationHtml(week) {
    const currentCalendarWeek = weeklyPlanCurrentCalendarWeekNumber();
    const currentButtonDisabled = currentCalendarWeek < 1 || week.weekNumber === currentCalendarWeek;
    const startInDays = currentCalendarWeek === 0 ? daysUntilWeeklyPlanStarts() : 0;
    return `
      <div class="weekly-week-navigation" aria-label="Weekly Plan week navigation">
        <button class="btn" type="button" data-weekly-action="view-week" data-weekly-week="${week.weekNumber - 1}"${week.weekNumber <= 1 ? " disabled" : ""}>Previous week</button>
        <div class="weekly-week-navigation-center">
          <strong>Week ${week.weekNumber} of ${weeklyPlan.weeks.length}</strong>
          <span>${escapeHtml(weeklyDateLabel(week.startDate, week.endDate))}</span>
          <em>${escapeHtml(weeklyCalendarStatusText(week))}</em>
          ${startInDays ? `<small>Planner starts in ${startInDays} day${startInDays === 1 ? "" : "s"}.</small>` : ""}
        </div>
        <button class="btn" type="button" data-weekly-action="go-current-week"${currentButtonDisabled ? " disabled" : ""}>Go to current week</button>
        <button class="btn" type="button" data-weekly-action="view-week" data-weekly-week="${week.weekNumber + 1}"${week.weekNumber >= weeklyPlan.weeks.length ? " disabled" : ""}>Next week</button>
      </div>
    `;
  }

  function weeklySummaryCard(label, value, help = "") {
    return `
      <article class="weekly-summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        ${help ? `<small>${escapeHtml(help)}</small>` : ""}
      </article>
    `;
  }

  function weeklyPlannedTransfers(planned = {}) {
    return (Number(planned.investment) || 0)
      + (Number(planned.extraSuper) || 0)
      + (Number(planned.extraDebtRepayment) || 0)
      + (Number(planned.offsetTransfer) || 0)
      + (Number(planned.otherTransfers) || 0);
  }

  function weeklyHasActualAmount(actual = {}, key) {
    return Object.prototype.hasOwnProperty.call(actual, key)
      && actual[key] !== null
      && actual[key] !== undefined
      && actual[key] !== "";
  }

  function weeklyActualValue(actual = {}, key, fallback = 0) {
    if (!weeklyHasActualAmount(actual, key)) return Number(fallback) || 0;
    return Number(actual[key]) || 0;
  }

  function weeklyActualWithDraft(week, draft = null) {
    return { ...(week?.actual || {}), ...(draft || weeklyActualDrafts.get(Number(week?.weekNumber)) || {}) };
  }

  function weeklyActualSetAside(actual = {}, planned = {}) {
    if (weeklyHasActualAmount(actual, "amountSetAside")) return Number(actual.amountSetAside) || 0;
    if (weeklyHasActualAmount(actual, "provisions")) return Number(actual.provisions) || 0;
    return Number(planned.provisions || planned.amountSetAside) || 0;
  }

  function weeklyActualTransfers(actual = {}, planned = null) {
    return weeklyActualValue(actual, "investment", planned?.investment)
      + weeklyActualValue(actual, "extraSuper", planned?.extraSuper)
      + weeklyActualValue(actual, "extraDebtRepayment", planned?.extraDebtRepayment)
      + weeklyActualValue(actual, "offsetTransfer", planned?.offsetTransfer)
      + weeklyActualValue(actual, "otherTransfers", planned?.otherTransfers);
  }

  function weeklyActualExpenses(actual = {}, planned = null) {
    return weeklyActualValue(actual, "essentialCosts", planned?.essentialCosts)
      + weeklyActualSetAside(actual, planned || {})
      + weeklyActualValue(actual, "discretionarySpending", planned?.discretionaryAllowance);
  }

  function weeklyForecastExpenses(planned = {}) {
    return (Number(planned.essentialCosts) || 0)
      + (Number(planned.provisions || planned.amountSetAside) || 0)
      + (Number(planned.discretionaryAllowance) || 0);
  }

  function weeklyActualClosingData(week, draft = null) {
    const planned = week?.planned || {};
    const actual = weeklyActualWithDraft(week, draft);
    const opening = weeklyActualValue(actual, "openingBalance", planned.openingBalance);
    const income = weeklyActualValue(actual, "income", planned.income);
    const transfersIn = weeklyActualValue(actual, "transfersIn", 0);
    const expenses = weeklyActualExpenses(actual, planned);
    const transfersOut = weeklyActualTransfers(actual, planned);
    const netMovement = income + transfersIn - expenses - transfersOut;
    const calculatedClosing = opening + netMovement;
    const bankBalanceEntered = weeklyHasActualAmount(actual, "enteredBankBalance") ? Number(actual.enteredBankBalance) || 0 : null;
    const reconciliationDifference = bankBalanceEntered === null ? null : bankBalanceEntered - calculatedClosing;
    const missingCount = weeklyActualMissingCount(week, actual);
    return {
      actual,
      opening,
      income,
      transfersIn,
      expenses,
      transfersOut,
      netMovement,
      calculatedClosing,
      bankBalanceEntered,
      reconciliationDifference,
      missingCount,
      label: week?.isCompleted || missingCount === 0 ? "Actual Closing Balance" : "Current Estimated Closing Balance",
    };
  }

  function weeklyActualMissingCount(week, actual = {}) {
    const planned = week?.planned || {};
    const fields = [
      ["openingBalance", planned.openingBalance, true],
      ["income", planned.income],
      ["essentialCosts", planned.essentialCosts],
      ["amountSetAside", planned.provisions || planned.amountSetAside],
      ["discretionarySpending", planned.discretionaryAllowance],
      ["investment", planned.investment],
      ["extraSuper", planned.extraSuper],
      ["extraDebtRepayment", planned.extraDebtRepayment],
      ["offsetTransfer", planned.offsetTransfer],
      ["otherTransfers", planned.otherTransfers],
      ["transfersIn", 0],
    ];
    return fields.filter(([key, fallback, alwaysRequired]) => {
      const expected = Math.abs(Number(fallback) || 0) > 0.005;
      const touched = weeklyHasActualAmount(actual, key);
      return (alwaysRequired || expected || touched) && !touched;
    }).length;
  }

  function weeklyBalanceSummaryBodyHtml(week, draft = null) {
    const data = weeklyActualClosingData(week, draft);
    const diff = data.reconciliationDifference;
    const reconciled = diff !== null && Math.abs(diff) < 0.01;
    const differenceText = diff === null
      ? "Enter your bank balance to check reconciliation."
      : reconciled
        ? "Balance reconciled"
        : `Difference to review: ${money(diff)}`;
    const differenceClass = diff === null || reconciled ? "neutral" : weeklyDifferenceClass(diff);
    return `
      <div><span>Actual opening balance</span><strong>${money(data.opening)}</strong></div>
      <div><span>Net recorded movement</span><strong class="${weeklyDifferenceClass(data.netMovement)}">${money(data.netMovement)}</strong></div>
      <div><span>${escapeHtml(data.label)}</span><strong>${money(data.calculatedClosing)}</strong></div>
      <div><span>Bank balance entered by user</span><strong>${data.bankBalanceEntered === null ? "Not entered" : money(data.bankBalanceEntered)}</strong></div>
      <div><span>Unreconciled difference</span><strong class="${differenceClass}">${escapeHtml(differenceText)}</strong></div>
    `;
  }

  function weeklyLiveBalanceSummaryHtml(week, location = "top") {
    return `
      <article class="card mt-4 weekly-live-balance-card ${location === "bottom" ? "weekly-live-balance-card-bottom" : ""}">
        <div class="card-heading">
          <div>
            <h3>Live balance check</h3>
            <span>Updates as you record actual income, spending and transfers.</span>
          </div>
        </div>
        <div class="weekly-opening-lines mt-4" data-weekly-balance-summary="${week.weekNumber}">
          ${weeklyBalanceSummaryBodyHtml(week)}
        </div>
      </article>
    `;
  }

  function weeklyDifferenceClass(value) {
    return value < 0 ? "negative" : value > 0 ? "positive" : "neutral";
  }

  function weeklyVarianceRow(label, forecast, actual, options = {}) {
    const difference = Number(actual || 0) - Number(forecast || 0);
    const displayDifference = options.reverseGood ? -difference : difference;
    return `
      <div class="weekly-variance-row">
        <span>${escapeHtml(label)}</span>
        <strong>${money(forecast)}</strong>
        <strong>${money(actual)}</strong>
        <strong class="${weeklyDifferenceClass(displayDifference)}">${money(difference)}</strong>
      </div>
    `;
  }

  function weeklyForecastActualGrid(week) {
    const planned = week.planned || {};
    const actual = weeklyActualWithDraft(week);
    const actualData = weeklyActualClosingData(week);
    const forecastClosing = Number(planned.expectedClosingBalance ?? planned.forecastClosingBalance ?? planned.closingBalance) || 0;
    return `
      <article class="card mt-4 weekly-variance-card">
        <div class="card-heading">
          <div>
            <h3>Forecast vs Actual</h3>
            <span>Forecast is your plan. Actual is what happened and drives future weekly balances.</span>
          </div>
        </div>
        <div class="weekly-variance-table mt-4">
          <div class="weekly-variance-row weekly-variance-header">
            <span>Item</span><strong>Forecast</strong><strong>Actual</strong><strong>Difference</strong>
          </div>
          ${weeklyVarianceRow("Opening Balance", planned.expectedOpeningBalance ?? planned.openingBalance, actualData.opening)}
          ${weeklyVarianceRow("Income", planned.income, actualData.income)}
          ${weeklyVarianceRow("Expenses", weeklyForecastExpenses(planned), actualData.expenses, { reverseGood: true })}
          ${weeklyVarianceRow("Savings & Transfers", weeklyPlannedTransfers(planned), actualData.transfersOut)}
          ${weeklyVarianceRow("Closing Balance", forecastClosing, actualData.calculatedClosing)}
        </div>
      </article>
    `;
  }

  const weeklyStepOrder = ["opening", "income", "bills", "transfers", "complete"];
  const weeklyStepLabels = {
    opening: "Opening Balance",
    income: "Income",
    bills: "Bills",
    transfers: "Savings & Transfers",
    complete: "Complete Week",
  };

  function weeklyStepReviewed(week, step) {
    const actual = week.actual || {};
    if (step === "opening") return weeklyHasActualAmount(actual, "openingBalance");
    if (step === "income") return weeklyHasActualAmount(actual, "income") || weeklyHasActualAmount(actual, "transfersIn");
    if (step === "bills") return weeklyHasActualAmount(actual, "essentialCosts") || weeklyHasActualAmount(actual, "amountSetAside") || weeklyHasActualAmount(actual, "discretionarySpending");
    if (step === "transfers") return ["investment", "extraSuper", "extraDebtRepayment", "offsetTransfer", "otherTransfers"].some((key) => weeklyHasActualAmount(actual, key));
    if (step === "complete") return Boolean(week.isCompleted);
    return false;
  }

  function weeklyStepStateText(week, step, isActive) {
    if (week.isCompleted && step === "complete") return "Completed";
    if (isActive) return "Current";
    if (weeklyStepReviewed(week, step)) return "Reviewed";
    return "Not reviewed";
  }

  function weeklyWorkflowHtml(week) {
    if (!weeklyStepOrder.includes(activeWeeklyStep)) activeWeeklyStep = "opening";
    return `
      <div class="weekly-step-nav mt-4" role="tablist" aria-label="Weekly steps">
        ${weeklyStepOrder.map((step, index) => {
          const reviewed = weeklyStepReviewed(week, step);
          const active = activeWeeklyStep === step;
          const stateText = weeklyStepStateText(week, step, active);
          return `
          <button
            class="weekly-step-button${active ? " active" : ""}${reviewed ? " reviewed" : ""}"
            type="button"
            role="tab"
            aria-selected="${active}"
            ${active ? "aria-current=\"step\"" : ""}
            data-weekly-step-button="${step}">
            <span>${reviewed ? "✓" : index + 1}</span>
            <strong>${escapeHtml(weeklyStepLabels[step])}</strong>
            <small>${escapeHtml(stateText)}</small>
          </button>
        `;
        }).join("")}
      </div>
    `;
  }

  function weeklyWarningPanelHtml(week) {
    const planned = week?.planned || {};
    if (!planned.adjustmentReason) return "";
    return `
      <article class="weekly-warning-panel mt-4">
        <div>
          <strong>Action needed</strong>
          <p>This week falls below your minimum cash buffer. Review bills, income or planned transfers.</p>
          <details>
            <summary>More detail</summary>
            <span>${escapeHtml(planned.adjustmentReason)}</span>
          </details>
        </div>
        <div class="weekly-warning-actions">
          <button class="btn" type="button" data-weekly-step-button="bills">Review bills</button>
          <button class="btn" type="button" data-weekly-step-button="transfers">Review transfers</button>
          <button class="btn" type="button" data-weekly-action="toggle-timing-setup">Review timing</button>
        </div>
      </article>
    `;
  }

  function weeklyStepRow(label, plannedValue, actualValue, options = {}) {
    const hasActual = actualValue !== null && actualValue !== undefined && actualValue !== "";
    const status = hasActual ? "Recorded" : "Using planned estimate";
    return `
      <div class="weekly-step-row">
        <span>${escapeHtml(label)}</span>
        <strong>${money(plannedValue)}</strong>
        <strong>${hasActual ? money(actualValue) : "Not recorded"}</strong>
        <em>${escapeHtml(options.status || status)}</em>
      </div>
    `;
  }

  function weeklyStepDetailRows(title, items) {
    if (!items?.length) return `<p class="weekly-muted">No ${escapeHtml(title.toLowerCase())} scheduled this week.</p>`;
    return `
      <div class="weekly-step-subrows">
        ${items.map((item) => `
          <div>
            <span>${escapeHtml(item.name)}${item.timing === "set-aside" ? " (set aside)" : ""}</span>
            <strong>${money(item.amount)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function weeklyVarianceSummaryHtml(week) {
    if (!week?.actual) return "";
    const planned = week.planned || {};
    const actualData = weeklyActualClosingData(week);
    const incomeDiff = actualData.income - (Number(planned.income) || 0);
    const expenseDiff = weeklyForecastExpenses(planned) - actualData.expenses;
    const transferDiff = actualData.transfersOut - weeklyPlannedTransfers(planned);
    const closingDiff = actualData.calculatedClosing - (Number(planned.expectedClosingBalance ?? planned.forecastClosingBalance ?? planned.closingBalance) || 0);
    const line = (label, diff, positiveText, negativeText, neutralText = "On target") => {
      const text = Math.abs(diff) < 1 ? neutralText : diff > 0 ? positiveText(diff) : negativeText(Math.abs(diff));
      return `<li><span>${escapeHtml(label)}</span><strong class="${weeklyDifferenceClass(diff)}">${escapeHtml(text)}</strong></li>`;
    };
    return `
      <article class="card mt-4 weekly-complete-summary-card">
        <div class="card-heading">
          <div>
            <h3>${week.isCompleted ? "Week Complete" : "Weekly Variance Summary"}</h3>
            <span>Quick feedback from the actual amounts entered for this week.</span>
          </div>
        </div>
        <ul class="weekly-variance-summary mt-4">
          ${line("Income", incomeDiff, (d) => `${money(d)} above forecast`, (d) => `${money(d)} below forecast`)}
          ${line("Living expenses", expenseDiff, (d) => `${money(d)} under budget`, (d) => `${money(d)} over budget`)}
          ${line("Savings", transferDiff, (d) => `${money(d)} above target`, (d) => `${money(d)} below target`)}
          ${line("Closing balance", closingDiff, (d) => `${money(d)} higher than forecast`, (d) => `${money(d)} lower than forecast`)}
        </ul>
      </article>
    `;
  }

  function weeklyOpeningBalanceHtml(week, canAdjust) {
    const planned = week.planned || {};
    const expectedOpening = Number(planned.expectedOpeningBalance ?? planned.openingBalance) || 0;
    const actualOpening = Number(week.actual?.openingBalance ?? planned.actualOpeningBalance ?? planned.openingBalance) || 0;
    const difference = actualOpening - expectedOpening;
    const differenceClass = weeklyDifferenceClass(difference);
    const helper = canAdjust
      ? "Update this amount if your actual bank balance differs from the balance carried into this week."
      : week.weekNumber > weeklyPlanCurrentCalendarWeekNumber()
        ? "Future weeks inherit the prior week's actual closing balance once available, otherwise the projected closing balance."
        : "Reopen this completed week to adjust the opening balance.";
    return `
      <article class="card weekly-opening-balance-card weekly-step-section mt-4" id="weekly-step-opening" data-weekly-step-section="opening">
        <div class="card-heading">
          <div>
            <h3>Opening bank balance</h3>
            <span>${escapeHtml(helper)}</span>
          </div>
        </div>
        <div class="weekly-opening-lines mt-4">
          <div><span>Expected opening balance</span><strong>${money(expectedOpening)}</strong></div>
          <div><span>Actual opening balance</span><strong>${money(actualOpening)}</strong></div>
          <div><span>Reconciliation Adjustment</span><strong class="${differenceClass}">${money(difference)}</strong></div>
        </div>
        ${canAdjust ? `
          <details class="weekly-setup-details mt-4">
            <summary>Update opening balance</summary>
            <div class="weekly-opening-adjustment mt-3">
              <label>
                <span class="field-label">Actual opening bank balance</span>
                <input class="field-input" type="number" step="0.01" data-weekly-opening-balance="${week.weekNumber}" value="${weeklyInputValue(actualOpening)}">
                <small class="field-help">This is a reconciliation adjustment only. It does not change last week or your long-term Financial Freedom plan.</small>
              </label>
              <button class="btn btn-primary" type="button" data-weekly-action="save-opening-balance" data-weekly-week="${week.weekNumber}">Save opening balance</button>
            </div>
          </details>
        ` : ""}
      </article>
    `;
  }

  function weeklyCompletedWeekHtml(week) {
    const planned = week.planned || {};
    const actual = week.actual || {};
    const plannedClosing = Number(planned.closingBalance) || 0;
    const actualClosing = Number(actual.closingBalance ?? planned.closingBalance) || 0;
    const difference = actualClosing - plannedClosing;
    return `
      <article class="card mt-4 weekly-completed-card">
        <details class="weekly-completed-details">
          <summary>
            <div>
              <span class="metric-label">Week ${week.weekNumber} · Completed</span>
              <h3>${escapeHtml(weeklyDateLabel(week.startDate, week.endDate))}</h3>
            </div>
            <div class="weekly-completed-summary-grid">
              <span>Planned closing balance <strong>${money(plannedClosing)}</strong></span>
              <span>Actual closing balance <strong>${money(actualClosing)}</strong></span>
              <span>Difference <strong class="${difference < 0 ? "negative" : difference > 0 ? "positive" : "neutral"}">${money(difference)}</strong></span>
            </div>
            <b>View</b>
          </summary>
          <div class="weekly-completed-body">
            <div class="weekly-opening-lines mt-4">
              <div><span>Actual opening balance</span><strong>${money(actual.openingBalance ?? planned.openingBalance)}</strong></div>
              <div><span>Actual income received</span><strong>${money(actual.income)}</strong></div>
              <div><span>Other money in / transfers in</span><strong>${money(actual.transfersIn || 0)}</strong></div>
              <div><span>Actual bills and essentials</span><strong>${money(actual.essentialCosts)}</strong></div>
              <div><span>Actual amount set aside</span><strong>${money(actual.amountSetAside ?? actual.provisions ?? 0)}</strong></div>
              <div><span>Actual spending</span><strong>${money(actual.discretionarySpending)}</strong></div>
              <div><span>Actual invested</span><strong>${money(actual.investment)}</strong></div>
              <div><span>Actual extra super</span><strong>${money(actual.extraSuper)}</strong></div>
              <div><span>Actual extra debt repayment</span><strong>${money(actual.extraDebtRepayment)}</strong></div>
              <div><span>Actual offset transfer</span><strong>${money(actual.offsetTransfer || 0)}</strong></div>
              <div><span>Other actual transfers</span><strong>${money(actual.otherTransfers || 0)}</strong></div>
              <div><span>Bank balance entered by user</span><strong>${weeklyHasActualAmount(actual, "enteredBankBalance") ? money(actual.enteredBankBalance) : "Not entered"}</strong></div>
            </div>
            ${weeklyLiveBalanceSummaryHtml(week, "completed")}
            ${weeklyVarianceSummaryHtml(week)}
            ${actual.notes ? `<p class="weekly-device-note mt-3">${escapeHtml(actual.notes)}</p>` : ""}
            <div class="weekly-action-row mt-4">
              ${weeklyPlan.settings.allowCompletedWeekEditing ? `<button class="btn" type="button" data-weekly-action="edit-week" data-weekly-week="${week.weekNumber}">Edit Completed Week</button>` : ""}
              <button class="btn" type="button" data-weekly-action="mark-week-incomplete" data-weekly-week="${week.weekNumber}">Mark as incomplete</button>
              ${week.weekNumber < weeklyPlan.weeks.length ? `<button class="btn" type="button" data-weekly-action="view-week" data-weekly-week="${week.weekNumber + 1}">View next week</button>` : ""}
            </div>
          </div>
        </details>
      </article>
    `;
  }

  function weeklyActualField(week, key, label, defaultValue, options = {}) {
    const actual = week.actual || {};
    const hasValue = weeklyHasActualAmount(actual, key);
    const value = hasValue ? actual[key] : "";
    const disabled = options.disabled ? " disabled" : "";
    const placeholder = options.type === "text" || defaultValue === "" || defaultValue === undefined
      ? ""
      : ` placeholder="${weeklyInputValue(defaultValue || 0)}"`;
    return `
      <label>
        <span class="field-label">${escapeHtml(label)}</span>
        <input class="field-input" type="${options.type || "number"}" step="${options.step || "1"}" data-weekly-actual="${escapeHtml(key)}" data-weekly-week="${week.weekNumber}" value="${options.type === "text" ? escapeHtml(value || "") : hasValue ? weeklyInputValue(value) : ""}"${placeholder}${disabled}>
      </label>
    `;
  }

  function weeklyOpeningStepHtml(week, canEdit) {
    return weeklyOpeningBalanceHtml(week, canEdit);
  }

  function weeklyIncomeStepHtml(week, canEdit) {
    const planned = week.planned || {};
    const actual = weeklyActualWithDraft(week);
    return `
      <article class="card weekly-step-section" id="weekly-step-income" data-weekly-step-section="income">
        <div class="card-heading">
          <div>
            <h3>Money in</h3>
            <span>Record income received this week. Planned amounts stay visible for comparison.</span>
          </div>
        </div>
        <div class="weekly-step-table mt-4">
          <div class="weekly-step-row weekly-step-row-header"><span>Item</span><strong>Planned</strong><strong>Recorded</strong><em>Status</em></div>
          ${weeklyStepRow("Total money in", planned.income, weeklyHasActualAmount(actual, "income") ? actual.income : null)}
          ${weeklyStepRow("Other money in / transfers in", 0, weeklyHasActualAmount(actual, "transfersIn") ? actual.transfersIn : null)}
        </div>
        <details class="weekly-setup-details mt-4">
          <summary>Scheduled income details</summary>
          ${weeklyStepDetailRows("Income", week.detail?.incomeItems || [])}
        </details>
        <div class="weekly-actual-grid mt-4 ${canEdit ? "" : "weekly-readonly"}">
          ${weeklyActualField(week, "income", "Money in", planned.income, { disabled: !canEdit })}
          ${weeklyActualField(week, "transfersIn", "Other money in / transfers in", 0, { disabled: !canEdit })}
        </div>
      </article>
    `;
  }

  function weeklyBillsStepHtml(week, canEdit) {
    const planned = week.planned || {};
    const actual = weeklyActualWithDraft(week);
    return `
      <article class="card weekly-step-section" id="weekly-step-bills" data-weekly-step-section="bills">
        <div class="card-heading">
          <div>
            <h3>Bills</h3>
            <span>Record bills, spending and amounts set aside for future bills.</span>
          </div>
        </div>
        <div class="weekly-step-table mt-4">
          <div class="weekly-step-row weekly-step-row-header"><span>Item</span><strong>Planned</strong><strong>Recorded</strong><em>Status</em></div>
          ${weeklyStepRow("Bills and spending", planned.essentialCosts, weeklyHasActualAmount(actual, "essentialCosts") ? actual.essentialCosts : null)}
          ${weeklyStepRow("Amounts set aside", planned.provisions || planned.amountSetAside || 0, weeklyHasActualAmount(actual, "amountSetAside") ? actual.amountSetAside : null)}
          ${weeklyStepRow("Lifestyle spending", planned.discretionaryAllowance, weeklyHasActualAmount(actual, "discretionarySpending") ? actual.discretionarySpending : null)}
        </div>
        <details class="weekly-setup-details mt-4">
          <summary>Bill and provision details</summary>
          ${weeklyStepDetailRows("Bills", week.detail?.billItems || [])}
          ${weeklyStepDetailRows("Provisions", week.detail?.provisionItems || week.detail?.setAsideItems || [])}
        </details>
        <div class="weekly-actual-grid mt-4 ${canEdit ? "" : "weekly-readonly"}">
          ${weeklyActualField(week, "essentialCosts", "Bills and spending", planned.essentialCosts, { disabled: !canEdit })}
          ${weeklyActualField(week, "amountSetAside", "Amounts set aside", planned.provisions || planned.amountSetAside || 0, { disabled: !canEdit })}
          ${weeklyActualField(week, "discretionarySpending", "Lifestyle spending", planned.discretionaryAllowance, { disabled: !canEdit })}
        </div>
      </article>
    `;
  }

  function weeklyTransfersStepHtml(week, canEdit) {
    const planned = week.planned || {};
    const actual = weeklyActualWithDraft(week);
    return `
      <article class="card weekly-step-section" id="weekly-step-transfers" data-weekly-step-section="transfers">
        <div class="card-heading">
          <div>
            <h3>Savings and transfers</h3>
            <span>Keep wealth-building transfers separate from ordinary bills.</span>
          </div>
        </div>
        <div class="weekly-step-table mt-4">
          <div class="weekly-step-row weekly-step-row-header"><span>Item</span><strong>Planned</strong><strong>Recorded</strong><em>Status</em></div>
          ${weeklyStepRow("Offset transfer", planned.offsetTransfer || 0, weeklyHasActualAmount(actual, "offsetTransfer") ? actual.offsetTransfer : null)}
          ${weeklyStepRow("Investing", planned.investment, weeklyHasActualAmount(actual, "investment") ? actual.investment : null)}
          ${weeklyStepRow("Extra debt repayment", planned.extraDebtRepayment, weeklyHasActualAmount(actual, "extraDebtRepayment") ? actual.extraDebtRepayment : null)}
          ${weeklyStepRow("Additional super", planned.extraSuper, weeklyHasActualAmount(actual, "extraSuper") ? actual.extraSuper : null)}
          ${weeklyStepRow("Other transfers", planned.otherTransfers || 0, weeklyHasActualAmount(actual, "otherTransfers") ? actual.otherTransfers : null)}
        </div>
        <details class="weekly-setup-details mt-4">
          <summary>Transfer details</summary>
          ${weeklyStepDetailRows("Transfers", week.detail?.transferItems || [])}
        </details>
        <div class="weekly-actual-grid mt-4 ${canEdit ? "" : "weekly-readonly"}">
          ${weeklyActualField(week, "offsetTransfer", "Offset transfer", planned.offsetTransfer || 0, { disabled: !canEdit })}
          ${weeklyActualField(week, "investment", "Investing", planned.investment, { disabled: !canEdit })}
          ${weeklyActualField(week, "extraDebtRepayment", "Extra debt repayment", planned.extraDebtRepayment, { disabled: !canEdit })}
          ${weeklyActualField(week, "extraSuper", "Additional super", planned.extraSuper, { disabled: !canEdit })}
          ${weeklyActualField(week, "otherTransfers", "Other transfers", planned.otherTransfers || 0, { disabled: !canEdit })}
        </div>
      </article>
    `;
  }

  function weeklyCompleteStepHtml(week, canEdit, isEditableCompleted, completedReadOnly, isFutureWeek) {
    const planned = week.planned || {};
    return `
      <article class="card weekly-step-section" id="weekly-step-complete" data-weekly-step-section="complete">
        <div class="card-heading">
          <div>
            <h3>Complete week</h3>
            <span>Check the closing balance, reconcile the bank balance and save the week.</span>
          </div>
        </div>
        ${weeklyLiveBalanceSummaryHtml(week, "complete")}
        <div class="weekly-actual-grid mt-4 ${canEdit ? "" : "weekly-readonly"}">
          ${weeklyActualField(week, "enteredBankBalance", "Bank balance entered by user", "", { disabled: !canEdit })}
          ${weeklyActualField(week, "notes", "Notes", week.actual?.notes || "", { type: "text", disabled: !canEdit })}
        </div>
        <div class="weekly-calculated-closing mt-4">
          <span data-weekly-actual-closing-label="${week.weekNumber}">${escapeHtml(weeklyActualClosingData(week).label)}</span>
          <strong data-weekly-actual-closing="${week.weekNumber}">${money(weeklyActualClosingData(week).calculatedClosing)}</strong>
          <small>Calculated from opening balance, money in, bills and transfers.</small>
        </div>
        ${weeklyForecastActualGrid(week)}
        ${weeklyVarianceSummaryHtml(week)}
        <div class="weekly-check-grid mt-4">
          ${weeklyCheckbox(week, "incomeReceived", "Income received", { disabled: !canEdit })}
          ${weeklyCheckbox(week, "billsPaid", "Bills paid", { disabled: !canEdit })}
          ${weeklyCheckbox(week, "investmentCompleted", "Investing completed", { disabled: !canEdit })}
          ${weeklyCheckbox(week, "superCompleted", "Super completed", { disabled: !canEdit })}
          ${weeklyCheckbox(week, "debtCompleted", "Debt repayment completed", { disabled: !canEdit })}
        </div>
        <div class="weekly-action-row mt-4">
          ${canEdit && !isEditableCompleted ? `<button class="btn btn-primary" type="button" data-weekly-action="complete-week" data-weekly-week="${week.weekNumber}">Complete Week</button>` : ""}
          ${canEdit ? `<button class="btn" type="button" data-weekly-action="save-week" data-weekly-week="${week.weekNumber}">${isEditableCompleted ? "Save completed week" : "Save Progress"}</button>` : ""}
          ${isEditableCompleted ? `<button class="btn" type="button" data-weekly-action="cancel-week-edit" data-weekly-week="${week.weekNumber}">Cancel</button>` : ""}
          ${completedReadOnly ? `<button class="btn" type="button" data-weekly-action="mark-week-incomplete" data-weekly-week="${week.weekNumber}">Mark as incomplete</button>` : ""}
          ${week.isCompleted && week.weekNumber < weeklyPlan.weeks.length ? `<button class="btn" type="button" data-weekly-action="view-week" data-weekly-week="${week.weekNumber + 1}">View next week</button>` : ""}
          ${isFutureWeek ? `<p class="weekly-warning">This week has not started yet.</p>` : ""}
        </div>
      </article>
    `;
  }

  function weeklyActiveStepSectionHtml(week, canEdit, isEditableCompleted, completedReadOnly, isFutureWeek) {
    if (!weeklyStepOrder.includes(activeWeeklyStep)) activeWeeklyStep = "opening";
    if (activeWeeklyStep === "income") return weeklyIncomeStepHtml(week, canEdit);
    if (activeWeeklyStep === "bills") return weeklyBillsStepHtml(week, canEdit);
    if (activeWeeklyStep === "transfers") return weeklyTransfersStepHtml(week, canEdit);
    if (activeWeeklyStep === "complete") return weeklyCompleteStepHtml(week, canEdit, isEditableCompleted, completedReadOnly, isFutureWeek);
    return weeklyOpeningStepHtml(week, canEdit);
  }

  function weeklyCheckbox(week, key, label, options = {}) {
    const checked = week.actual?.checks?.[key] ? " checked" : "";
    const disabled = options.disabled ? " disabled" : "";
    return `
      <label class="weekly-check">
        <input type="checkbox" data-weekly-actual-check="${escapeHtml(key)}" data-weekly-week="${week.weekNumber}"${checked}${disabled}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function weeklyDetailList(title, items) {
    return `
      <div class="weekly-detail-list">
        <h4>${escapeHtml(title)}</h4>
        ${items?.length ? items.map((item) => `
          <div>
            <span>${escapeHtml(item.name)}${item.timing === "set-aside" ? " (set aside)" : ""}</span>
            <strong>${money(item.amount)}</strong>
          </div>
        `).join("") : `<p class="weekly-muted">No items this week.</p>`}
      </div>
    `;
  }

  function weeklyThisWeekHtml() {
    const week = weeklyCurrentWeek();
    if (!week) return "";
    const planned = week.planned;
    const statusClass = weeklyStatusClass(planned.status);
    const isFutureWeek = !weeklyWeekHasStarted(week);
    const isEditableCompleted = week.isCompleted && weeklyEditingWeek === week.weekNumber;
    const canEdit = (!week.isCompleted && !isFutureWeek) || isEditableCompleted;
    const completedReadOnly = week.isCompleted && !isEditableCompleted;
    return `
      ${weeklyNavigationHtml(week)}
      <article class="weekly-hero card ${statusClass}">
        <div>
          <span class="metric-label">${week.weekNumber === weeklyPlanCurrentCalendarWeekNumber() ? "This Week's Money Plan" : "Weekly Money Plan"}</span>
          <h3>Week ${week.weekNumber}: ${escapeHtml(weeklyDateLabel(week.startDate, week.endDate))}</h3>
          <p><strong>${escapeHtml(weeklyCalendarStatusText(week))}</strong></p>
          <p>${escapeHtml(week.isCompleted ? "This completed week is saved. Open a step to review details or edit if needed." : planned.statusMessage)}</p>
        </div>
        <div class="weekly-status-badge">
          <span>Current status</span>
          <strong>${escapeHtml(planned.statusLabel || weeklyStatusLabel(planned.status))}</strong>
        </div>
      </article>

      ${weeklyLiveBalanceSummaryHtml(week, "top")}

      ${weeklyWarningPanelHtml(week)}

      ${completedReadOnly ? weeklyCompletedWeekHtml(week) : ""}

      ${weeklyWorkflowHtml(week)}

      ${weeklyActiveStepSectionHtml(week, canEdit, isEditableCompleted, completedReadOnly, isFutureWeek)}
    `;
  }

  function weeklyUpcomingHtml() {
    const visibleWeeks = weeklyPlan.settings?.showAllUpcoming ? weeklyPlan.weeks : weeklyPlan.weeks.slice(Math.max(0, weeklyPlan.currentWeekNumber - 1), weeklyPlan.currentWeekNumber + 7);
    return `
      <article class="card">
        <div class="card-heading">
          <div>
            <h3>Upcoming Weeks</h3>
            <span>Forecast view showing this week, next week and the following six weeks by default.</span>
          </div>
          <button class="btn" type="button" data-weekly-action="toggle-upcoming">${weeklyPlan.settings?.showAllUpcoming ? "Show fewer weeks" : "View more weeks"}</button>
        </div>
        <div class="weekly-upcoming-list mt-4">
          ${visibleWeeks.map((week) => {
            const planned = week.planned;
            const transfers = planned.investment + planned.extraSuper + planned.extraDebtRepayment;
            return `
              <details class="weekly-upcoming-card ${weeklyStatusClass(planned.status)}" ${week.weekNumber === weeklyPlan.currentWeekNumber ? "open" : ""}>
                <summary>
                  <div>
                    <span>Week ${week.weekNumber}</span>
                    <strong>${escapeHtml(weeklyDateLabel(week.startDate, week.endDate))}</strong>
                  </div>
                  <div class="weekly-upcoming-metrics">
                    <span>${money(planned.income)}</span>
                    <span>${money(planned.essentialCosts)}</span>
                    <span>${money(planned.discretionaryAllowance)}</span>
                    <span>${money(transfers)}</span>
                    <span>${money(planned.closingBalance)}</span>
                    <em>${escapeHtml(planned.statusLabel || weeklyStatusLabel(planned.status))}</em>
                  </div>
                </summary>
                <div class="weekly-expanded-detail">
                  ${weeklyDetailList("Money coming in", week.detail?.incomeItems || [])}
                  ${weeklyDetailList("Bills and spending", week.detail?.billItems || [])}
                  ${weeklyDetailList("Provisions", week.detail?.provisionItems || week.detail?.setAsideItems || [])}
                  ${weeklyDetailList("Financial Freedom transfers", week.detail?.transferItems || [])}
                  <div class="weekly-detail-list">
                    <h4>Weekly plan</h4>
                    <div><span>Opening balance</span><strong>${money(planned.openingBalance)}</strong></div>
                    <div><span>Provisions</span><strong>${money(planned.provisions || planned.amountSetAside || 0)}</strong></div>
                    <div><span>Offset transfer</span><strong>${money(planned.offsetTransfer || 0)}</strong></div>
                    <div><span>Investment amount</span><strong>${money(planned.investment)}</strong></div>
                    <div><span>Super amount</span><strong>${money(planned.extraSuper)}</strong></div>
                    <div><span>Extra debt repayment</span><strong>${money(planned.extraDebtRepayment)}</strong></div>
                    <div><span>Expected closing balance</span><strong>${money(planned.closingBalance)}</strong></div>
                  </div>
                  ${planned.adjustmentReason ? `<p class="weekly-adjustment">${escapeHtml(planned.adjustmentReason)}</p>` : ""}
                </div>
              </details>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }

  function weeklyProgressBar(label, actual, target) {
    const pct = weeklyProgressPercent(actual, target);
    return `
      <article class="weekly-progress-card">
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${money(actual)} of ${money(target)}</strong>
        </div>
        <div class="progress-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <small>${plainPercent(pct)} complete</small>
      </article>
    `;
  }

  function weeklyProgressHtml() {
    const progress = weeklyPlan.progress || {};
    const remaining = weeklyPlan.weeks.length - (progress.weeksCompleted || 0);
    const spendingMessage = progress.weeksCompleted
      ? `Your average discretionary spending is ${money(progress.averageWeeklyDiscretionarySpending)} per completed week.`
      : "Complete your first week to start tracking actual spending against your weekly limit.";
    return `
      <article class="card">
        <div class="card-heading">
          <div>
            <h3>Progress</h3>
            <span>Actual completed results are separated from remaining planned amounts.</span>
          </div>
        </div>
        <div class="summary-grid mt-4">
          ${summaryTile("Weeks completed", `${progress.weeksCompleted || 0} of ${weeklyPlan.weeks.length}`)}
          ${summaryTile("Income received this year", money(progress.incomeReceived))}
          ${summaryTile("Essential costs paid", money(progress.essentialCostsPaid))}
          ${summaryTile("Average weekly spending", money(progress.averageWeeklyDiscretionarySpending))}
          ${summaryTile("Amount invested this year", money(progress.amountInvested))}
          ${summaryTile("Extra super contributed", money(progress.extraSuperContributed))}
          ${summaryTile("Extra debt repaid", money(progress.extraDebtRepaid))}
          ${summaryTile("Current bank balance", money(progress.currentBankBalance))}
          ${summaryTile("Annual savings rate", `${Number(progress.annualSavingsRate || 0).toFixed(1)}%`)}
          ${summaryTile("Planned wealth transfers remaining", money(progress.plannedWealthTransfersRemaining))}
          ${summaryTile("Estimated improvement", money(progress.estimatedImprovementInFinancialPosition))}
          ${summaryTile("Weeks below buffer", `${progress.weeksBelowBuffer || 0}`)}
        </div>
        <div class="weekly-progress-grid mt-4">
          ${weeklyProgressBar("Invested this year", progress.amountInvested || 0, progress.investmentTarget || 0)}
          ${weeklyProgressBar("Extra super this year", progress.extraSuperContributed || 0, progress.extraSuperTarget || 0)}
          ${weeklyProgressBar("Extra debt repaid this year", progress.extraDebtRepaid || 0, progress.extraDebtRepaymentTarget || 0)}
          ${weeklyProgressBar("Emergency fund or cash buffer", progress.currentBankBalance || 0, weeklyPlan.minimumCashBuffer || 0)}
        </div>
        <p class="weekly-progress-summary mt-4">You have completed ${progress.weeksCompleted || 0} week${progress.weeksCompleted === 1 ? "" : "s"} with ${remaining} week${remaining === 1 ? "" : "s"} remaining in this plan. ${escapeHtml(spendingMessage)} Remaining wealth transfers are estimated from the current plan and may change as actual results are entered.</p>
      </article>
    `;
  }

  function weeklySettingsHtml() {
    const settings = weeklyPlan.settings || {};
    const allocation = weeklyPlan.allocationSettings || settings.allocationSettings || {};
    const payDates = settings.payDates || {};
    const billDates = settings.billDates || {};
    return `
      <article class="card">
        <div class="card-heading">
          <div>
            <h3>Settings</h3>
            <span>Update how the Weekly Plan protects your cash buffer and allocates available surplus.</span>
          </div>
        </div>
        <div class="weekly-setup-grid mt-4">
          <label>
            <span class="field-label">Plan name</span>
            <input class="field-input" type="text" data-weekly-setting="planName" data-type="text" value="${escapeHtml(weeklyPlan.planName || "")}">
          </label>
          <label>
            <span class="field-label">Planner start date</span>
            <input class="field-input" type="date" data-weekly-setting="startDate" data-type="text" value="${escapeHtml(weeklyPlan.startDate)}">
          </label>
          <label>
            <span class="field-label">Planner duration</span>
            <select class="field-input" data-weekly-setting="durationWeeks">
              <option value="12"${weeklyPlan.durationWeeks === 12 ? " selected" : ""}>12 weeks</option>
              <option value="26"${weeklyPlan.durationWeeks === 26 ? " selected" : ""}>26 weeks</option>
              <option value="52"${weeklyPlan.durationWeeks === 52 ? " selected" : ""}>52 weeks</option>
            </select>
          </label>
          <label>
            <span class="field-label">Minimum cash buffer</span>
            <input class="field-input" type="number" step="100" data-weekly-setting="minimumCashBuffer" value="${weeklyInputValue(weeklyPlan.minimumCashBuffer)}">
          </label>
          <label>
            <span class="field-label">Opening or current bank balance</span>
            <input class="field-input" type="number" step="100" data-weekly-setting="openingBankBalance" value="${weeklyInputValue(weeklyPlan.openingBankBalance)}">
          </label>
          <label>
            <span class="field-label">Weekly spending limit</span>
            <input class="field-input" type="number" step="25" data-weekly-setting="weeklyDiscretionaryLimit" value="${weeklyInputValue(settings.weeklyDiscretionaryLimit)}">
          </label>
          <label>
            <span class="field-label">Investment target</span>
            <input class="field-input" type="number" step="100" data-weekly-setting="investmentTarget" value="${weeklyInputValue(settings.investmentTarget)}">
          </label>
          <label>
            <span class="field-label">Extra super target</span>
            <input class="field-input" type="number" step="100" data-weekly-setting="extraSuperTarget" value="${weeklyInputValue(settings.extraSuperTarget)}">
          </label>
          <label>
            <span class="field-label">Extra debt repayment target</span>
            <input class="field-input" type="number" step="100" data-weekly-setting="extraDebtRepaymentTarget" value="${weeklyInputValue(settings.extraDebtRepaymentTarget)}">
          </label>
          <label>
            <span class="field-label">Allocation priority</span>
            <select class="field-input" data-weekly-setting="priorityFirst" data-type="text">
              <option value="extraDebt"${allocation.priority?.[0] === "extraDebt" ? " selected" : ""}>Extra debt repayment first</option>
              <option value="investment"${allocation.priority?.[0] === "investment" ? " selected" : ""}>Invest first</option>
              <option value="extraSuper"${allocation.priority?.[0] === "extraSuper" ? " selected" : ""}>Extra super first</option>
            </select>
          </label>
          <label>
            <span class="field-label">Surplus allocation method</span>
            <select class="field-input" data-weekly-setting="allocationMode" data-type="text">
              <option value="priority"${allocation.mode === "priority" ? " selected" : ""}>Priority order</option>
              <option value="split"${allocation.mode === "split" ? " selected" : ""}>Split by percentage</option>
              <option value="cash"${allocation.mode === "cash" ? " selected" : ""}>Keep as cash</option>
            </select>
          </label>
          <label>
            <span class="field-label">Investments split %</span>
            <input class="field-input" type="number" step="1" data-weekly-setting="splitInvestment" value="${weeklyInputValue(allocation.split?.investment)}">
          </label>
          <label>
            <span class="field-label">Extra debt split %</span>
            <input class="field-input" type="number" step="1" data-weekly-setting="splitExtraDebt" value="${weeklyInputValue(allocation.split?.extraDebt)}">
          </label>
          <label>
            <span class="field-label">Extra super split %</span>
            <input class="field-input" type="number" step="1" data-weekly-setting="splitExtraSuper" value="${weeklyInputValue(allocation.split?.extraSuper)}">
          </label>
          <label>
            <span class="field-label">Missed-transfer treatment</span>
            <select class="field-input" data-weekly-setting="missedTransferTreatment" data-type="text">
              <option value="carry-forward"${settings.missedTransferTreatment === "carry-forward" ? " selected" : ""}>Carry forward when affordable</option>
              <option value="spread"${settings.missedTransferTreatment === "spread" ? " selected" : ""}>Spread across remaining weeks</option>
              <option value="none"${settings.missedTransferTreatment === "none" ? " selected" : ""}>Do not carry forward</option>
            </select>
          </label>
          <label class="toggle-field">
            <span><span class="field-label">Allow completed weeks to be edited</span></span>
            <input class="toggle-input" type="checkbox" data-weekly-setting="allowCompletedWeekEditing" data-type="boolean"${settings.allowCompletedWeekEditing !== false ? " checked" : ""}>
          </label>
          <label class="toggle-field">
            <span><span class="field-label">Show reminders inside the app</span></span>
            <input class="toggle-input" type="checkbox" data-weekly-setting="showInAppReminders" data-type="boolean"${settings.showInAppReminders !== false ? " checked" : ""}>
          </label>
        </div>
        ${allocation.mode === "split" && !allocation.splitIsValid ? `<p class="weekly-warning mt-4">Custom percentage split must total 100% before it can be used reliably.</p>` : ""}
        <details class="weekly-setup-details mt-4">
          <summary>Pay dates and bill dates</summary>
          <p class="weekly-muted mt-2">Some annual and irregular costs have been spread across the year because exact payment dates were not entered.</p>
          <div class="weekly-timing-grid mt-4">
            <div>
              <h4>Pay dates</h4>
              ${weeklyDateSettingsRows(plan.incomeItems || [], "payDates", payDates)}
            </div>
            <div>
              <h4>Bill dates</h4>
              ${weeklyDateSettingsRows(weeklyBillTimingItems(), "billDates", billDates)}
            </div>
          </div>
        </details>
        <div class="weekly-action-row mt-4">
          <button class="btn btn-primary" type="button" data-weekly-action="rebuild-plan">Rebuild Future Plan</button>
          <button class="btn" type="button" data-weekly-action="reset-plan">Reset Weekly Plan</button>
        </div>
        <p class="weekly-device-note mt-4">Your Weekly Plan is currently saved in this browser on this device. Export a backup before clearing browser data or changing devices.</p>
      </article>
    `;
  }

  function renderWeeklyPlan(result) {
    weeklyPlanRenderCount += 1;
    console.info(`Weekly Plan render count: ${weeklyPlanRenderCount}`);
    const root = document.getElementById("weeklyPlanRoot");
    const exportPanel = document.getElementById("weeklyPlanExportPrint");
    if (!root) return;
    if (!weeklyPlan) {
      if (exportPanel) exportPanel.classList.add("hidden");
      root.innerHTML = weeklyPlanSetupHtml(result);
      return;
    }
    weeklyPlan = window.FFSWeeklyPlan.reforecast(plan, result, weeklyPlan);
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan();
    if (!["thisWeek", "upcoming", "progress", "settings"].includes(activeWeeklyPlanTab)) activeWeeklyPlanTab = "thisWeek";
    const currentCalendarWeek = weeklyPlanCurrentCalendarWeekNumber();
    const tabHtml = activeWeeklyPlanTab === "thisWeek"
      ? weeklyThisWeekHtml()
      : activeWeeklyPlanTab === "upcoming"
        ? weeklyUpcomingHtml()
        : activeWeeklyPlanTab === "progress"
          ? weeklyProgressHtml()
          : weeklySettingsHtml();
    root.innerHTML = `
      <div class="weekly-plan-shell">
        <article class="weekly-plan-header card">
          <div>
            <span class="metric-label">Ongoing Weekly Money Plan</span>
            <h3>${escapeHtml(weeklyPlan.planName || "Weekly Plan")}</h3>
            <p>Use this each week to check money coming in, bills, spending, investments, super and extra debt repayments.</p>
          </div>
          <div class="weekly-plan-header-stat">
            <span>Current week</span>
            <strong>${currentCalendarWeek ? `Week ${currentCalendarWeek}` : "Not started"}</strong>
          </div>
        </article>
        ${weeklyTimingSetupHtml()}
        <article class="card weekly-step-card" data-weekly-step="view-plan">
          <div class="card-heading">
            <div>
              <span class="metric-label">Step 2 - View weekly plan</span>
              <h3>Weekly Plan</h3>
              <span>Review expected opening balance, cash movements and closing balance for each week.</span>
            </div>
          </div>
          <div class="mt-4">
        ${weeklyTabsHtml()}
        <div class="weekly-tab-panel">${tabHtml}</div>
          </div>
        </article>
      </div>
    `;
    if (exportPanel) exportPanel.classList.remove("hidden");
    renderWeeklyPlannerControls(result);
  }

  function readWeekActual(weekNumber) {
    const actual = { checks: {} };
    document.querySelectorAll(`[data-weekly-actual][data-weekly-week="${weekNumber}"]`).forEach((input) => {
      const key = input.dataset.weeklyActual;
      actual[key] = input.type === "text" ? input.value : readWeeklyNullableAmount(input.value);
    });
    const openingInput = document.querySelector(`[data-weekly-opening-balance="${weekNumber}"]`);
    if (openingInput) actual.openingBalance = readWeeklyNullableAmount(openingInput.value);
    document.querySelectorAll(`[data-weekly-actual-check][data-weekly-week="${weekNumber}"]`).forEach((input) => {
      actual.checks[input.dataset.weeklyActualCheck] = input.checked;
    });
    return actual;
  }

  function readWeeklyNullableAmount(value) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function updateWeeklyActualDraftFromInput(target) {
    if (!weeklyPlan) return;
    const weekNumber = Number(target.dataset.weeklyWeek || target.dataset.weeklyOpeningBalance) || weeklyPlan.currentWeekNumber;
    const draft = { ...(weeklyActualDrafts.get(weekNumber) || {}) };
    if (target.dataset.weeklyOpeningBalance !== undefined) {
      draft.openingBalance = readWeeklyNullableAmount(target.value);
    } else if (target.dataset.weeklyActual !== undefined) {
      const key = target.dataset.weeklyActual;
      draft[key] = target.type === "text" ? target.value : readWeeklyNullableAmount(target.value);
    } else if (target.dataset.weeklyActualCheck !== undefined) {
      draft.checks = { ...(draft.checks || {}), [target.dataset.weeklyActualCheck]: target.checked };
    }
    weeklyActualDrafts.set(weekNumber, draft);
    refreshWeeklyActualClosingDisplay(weekNumber);
    updateSaveStatus("Weekly changes not saved yet.");
  }

  function refreshWeeklyActualClosingDisplay(weekNumber) {
    const week = weeklyPlan?.weeks?.find((item) => item.weekNumber === Number(weekNumber));
    if (!week) return;
    const draft = weeklyActualDrafts.get(Number(weekNumber)) || {};
    const data = weeklyActualClosingData(week, draft);
    document.querySelectorAll(`[data-weekly-actual-closing="${weekNumber}"]`).forEach((target) => {
      target.textContent = money(data.calculatedClosing);
    });
    document.querySelectorAll(`[data-weekly-actual-closing-label="${weekNumber}"]`).forEach((target) => {
      target.textContent = data.label;
    });
    document.querySelectorAll(`[data-weekly-balance-summary="${weekNumber}"]`).forEach((target) => {
      target.innerHTML = weeklyBalanceSummaryBodyHtml(week, draft);
    });
  }

  function commitWeeklyActualDraft(weekNumber, status = "Weekly progress saved.") {
    if (!weeklyPlan || !weeklyActualDrafts.has(Number(weekNumber))) return;
    const week = weeklyPlan.weeks.find((item) => item.weekNumber === Number(weekNumber));
    if (!week || (week.isCompleted && weeklyEditingWeek !== week.weekNumber)) return;
    weeklyPlan = window.FFSWeeklyPlan.updateActual(weeklyPlan, weekNumber, {
      ...(week.actual || {}),
      ...weeklyActualDrafts.get(Number(weekNumber)),
    });
    weeklyActualDrafts.delete(Number(weekNumber));
    generatedWeeklyPlanner = null;
    saveWeeklyPlan(status);
    refreshWeeklyActualClosingDisplay(weekNumber);
  }

  function saveWeekProgress(weekNumber, complete = false) {
    if (!weeklyPlan) return;
    const result = CALC.calculatePlan(plan);
    const week = weeklyPlan.weeks.find((item) => item.weekNumber === Number(weekNumber));
    if (!week) return;
    if (complete && !weeklyWeekHasStarted(week)) {
      updateSaveStatus("This week has not started yet.");
      return;
    }
    const actual = { ...(week.actual || {}), ...readWeekActual(weekNumber), ...(weeklyActualDrafts.get(Number(weekNumber)) || {}) };
    const editingCompletedWeek = week.isCompleted && weeklyEditingWeek === week.weekNumber;
    weeklyPlan = complete
      ? window.FFSWeeklyPlan.completeWeek(plan, result, weeklyPlan, weekNumber, actual)
      : editingCompletedWeek
        ? window.FFSWeeklyPlan.completeWeek(plan, result, weeklyPlan, weekNumber, actual)
        : window.FFSWeeklyPlan.updateActual(weeklyPlan, weekNumber, actual);
    if (complete || editingCompletedWeek) weeklyEditingWeek = null;
    weeklyActualDrafts.delete(Number(weekNumber));
    weeklyViewedWeekNumber = weekNumber;
    generatedWeeklyPlanner = null;
    saveWeeklyPlan(complete ? `Week ${weekNumber} has been marked complete.` : editingCompletedWeek ? `Week ${weekNumber} has been updated.` : "Weekly progress saved.");
    renderAll();
    showWorkspace("weeklyplan");
  }

  function saveWeeklyOpeningBalance(weekNumber) {
    if (!weeklyPlan || !window.FFSWeeklyPlan?.updateOpeningBalance) return;
    const result = CALC.calculatePlan(plan);
    const week = weeklyPlan.weeks.find((item) => item.weekNumber === Number(weekNumber));
    if (!week) return;
    const isFutureWeek = !weeklyWeekHasStarted(week);
    const isEditableCompleted = week.isCompleted && weeklyEditingWeek === week.weekNumber;
    const canAdjust = (!week.isCompleted && !isFutureWeek) || isEditableCompleted;
    if (!canAdjust) {
      updateSaveStatus("Opening balance can only be updated for the current week, a past incomplete week or a reopened completed week.");
      return;
    }
    const input = document.querySelector(`[data-weekly-opening-balance="${weekNumber}"]`);
    const amount = readWeeklyNullableAmount(input?.value);
    if (amount === null) {
      updateSaveStatus("Enter a valid opening bank balance.");
      return;
    }
    weeklyPlan = window.FFSWeeklyPlan.updateOpeningBalance(plan, result, weeklyPlan, weekNumber, amount);
    weeklyActualDrafts.delete(Number(weekNumber));
    weeklyViewedWeekNumber = weekNumber;
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Opening balance updated.");
    renderAll();
    showWorkspace("weeklyplan");
  }

  function cancelCompletedWeekEdit(weekNumber) {
    weeklyEditingWeek = null;
    weeklyViewedWeekNumber = weekNumber;
    updateSaveStatus("Completed week edit cancelled.");
    renderOutputs();
  }

  function markWeeklyWeekIncomplete(weekNumber) {
    if (!weeklyPlan || !window.FFSWeeklyPlan?.markWeekIncomplete) return;
    if (!window.confirm("Mark this week as incomplete? Existing actual values will be kept unless you edit or reset them separately.")) return;
    weeklyPlan = window.FFSWeeklyPlan.markWeekIncomplete(plan, CALC.calculatePlan(plan), weeklyPlan, weekNumber);
    weeklyEditingWeek = null;
    weeklyViewedWeekNumber = weekNumber;
    generatedWeeklyPlanner = null;
    saveWeeklyPlan(`Week ${weekNumber} has been marked incomplete.`);
    renderAll();
    showWorkspace("weeklyplan");
  }

  function setActiveWeeklyStep(step) {
    if (!weeklyStepOrder.includes(step)) return;
    activeWeeklyStep = step;
    renderOutputs();
    window.requestAnimationFrame(() => {
      const section = document.querySelector(`[data-weekly-step-section="${step}"]`);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateWeeklySettingFromInput(target) {
    if (!weeklyPlan) return;
    const key = target.dataset.weeklySetting;
    const value = target.dataset.type === "boolean" ? target.checked : target.dataset.type === "text" ? target.value : Number(target.value) || 0;
    const settings = { ...(weeklyPlan.settings || {}) };
    if (key === "planName") {
      weeklyPlan.planName = String(value || "Weekly Plan");
      settings.planName = weeklyPlan.planName;
    } else if (key === "allocationMode") {
      settings.allocationSettings = { ...(settings.allocationSettings || {}), mode: value };
    } else if (key === "priorityFirst") {
      const rest = ["extraDebt", "investment", "extraSuper"].filter((item) => item !== value);
      settings.allocationSettings = { ...(settings.allocationSettings || {}), priority: [value, ...rest] };
    } else if (key === "splitInvestment" || key === "splitExtraDebt" || key === "splitExtraSuper") {
      const splitKey = key === "splitInvestment" ? "investment" : key === "splitExtraDebt" ? "extraDebt" : "extraSuper";
      settings.allocationSettings = {
        ...(settings.allocationSettings || {}),
        split: { ...(settings.allocationSettings?.split || {}), [splitKey]: value },
      };
    } else {
      settings[key] = value;
    }
    weeklyPlan = window.FFSWeeklyPlan.updateSettings(plan, CALC.calculatePlan(plan), weeklyPlan, settings);
    if (["startDate", "durationWeeks", "openingBankBalance", "minimumCashBuffer", "weeklyDiscretionaryLimit", "investmentTarget", "extraSuperTarget", "extraDebtRepaymentTarget"].includes(key)) {
      markWeeklyTimingReviewRequired();
    }
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Weekly Plan settings saved.");
  }

  function updateWeeklyDateFromInput(target) {
    if (!weeklyPlan) return;
    const type = target.dataset.weeklyDate;
    const id = target.dataset.weeklyId;
    const settings = { ...(weeklyPlan.settings || {}) };
    settings[type] = { ...(settings[type] || {}) };
    if (target.value) settings[type][id] = target.value;
    else delete settings[type][id];
    weeklyPlan = window.FFSWeeklyPlan.updateSettings(plan, CALC.calculatePlan(plan), weeklyPlan, settings);
    markWeeklyTimingReviewRequired();
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Weekly Plan timing saved.");
  }

  function updateWeeklyTimingFromInput(target) {
    if (!weeklyPlan) return;
    const itemId = target.dataset.weeklyTiming;
    const key = target.dataset.key;
    const value = target.dataset.type === "boolean" ? target.checked : target.dataset.type === "text" ? target.value : Number(target.value) || 0;
    weeklyPlan = window.FFSWeeklyPlan.updateTimingItem(plan, CALC.calculatePlan(plan), weeklyPlan, itemId, { [key]: value });
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Weekly timing saved.");
    renderOutputs();
  }

  function parseWeeklyTimingAmountInput(value) {
    const text = String(value ?? "").replace(/[$,\s]/g, "");
    if (!text) return NaN;
    return Number(text);
  }

  function updateWeeklyTimingDraftFromInput(target) {
    if (!weeklyPlan || !timingEditDraft || editingTimingItemId !== target.dataset.weeklyTimingDraft) return;
    const key = target.dataset.key;
    const value = target.dataset.type === "boolean" ? target.checked : target.value;
    timingEditDraft = { ...timingEditDraft, [key]: value };
  }

  function markWeeklyTimingReviewRequired() {
    if (!weeklyPlan?.settings) return;
    weeklyPlan.settings.timingSetupNeedsReview = true;
    weeklyPlan.settings.timingSetupRequiresReview = true;
    weeklyPlan.settings.timingSetupReviewed = Boolean(weeklyPlan.settings.timingSetupReviewed);
    weeklyPlan.timingSetupReviewed = weeklyPlan.settings.timingSetupReviewed;
    weeklyPlan.timingSetupNeedsReview = true;
    weeklyPlan.timingSetupLastReviewedAt = weeklyPlan.settings.timingSetupLastReviewedAt || weeklyPlan.settings.timingSetupReviewedAt || "";
  }

  function saveWeeklyTimingDraft(itemId) {
    if (!weeklyPlan || !timingEditDraft || editingTimingItemId !== itemId) {
      updateSaveStatus("No timing changes to save.");
      return;
    }
    const amount = parseWeeklyTimingAmountInput(timingEditDraft.amountInput ?? timingEditDraft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      updateSaveStatus("Enter a valid amount before saving this timing item.");
      return;
    }
    const patch = { ...timingEditDraft, amount };
    delete patch.amountInput;
    if (patch.type === "money-in") {
      patch.treatment = "pay-on-date";
      if (patch.frequency === "weeklyProvision") patch.frequency = "weekly";
    }
    weeklyPlan = window.FFSWeeklyPlan.updateTimingItem(plan, CALC.calculatePlan(plan), weeklyPlan, itemId, patch);
    markWeeklyTimingReviewRequired();
    weeklyPlanUiState.isTimingSetupExpanded = true;
    editingTimingItemId = null;
    timingEditDraft = null;
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Timing updated - review recommended.");
    renderAll();
    showWorkspace("weeklyplan");
  }

  function cancelWeeklyTimingDraft(itemId) {
    if (editingTimingItemId !== itemId) return;
    editingTimingItemId = null;
    timingEditDraft = null;
    updateSaveStatus("Timing edit cancelled.");
    renderOutputs();
  }

  function savePendingWeeklyTimingDrafts() {
    if (!editingTimingItemId || !timingEditDraft) return true;
    const amount = parseWeeklyTimingAmountInput(timingEditDraft.amountInput ?? timingEditDraft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      updateSaveStatus("Enter a valid amount before finishing timing review.");
      return false;
    }
    const patch = { ...timingEditDraft, amount };
    delete patch.amountInput;
    if (patch.type === "money-in") {
      patch.treatment = "pay-on-date";
      if (patch.frequency === "weeklyProvision") patch.frequency = "weekly";
    }
    weeklyPlan = window.FFSWeeklyPlan.updateTimingItem(plan, CALC.calculatePlan(plan), weeklyPlan, editingTimingItemId, patch);
    editingTimingItemId = null;
    timingEditDraft = null;
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    return true;
  }

  function completeWeeklyTimingReview() {
    if (!weeklyPlan) return;
    if (!savePendingWeeklyTimingDrafts()) return;
    let validation = weeklyTimingValidation();
    weeklyPlanUiState.isTimingSetupExpanded = true;
    if (validation.blocking.length) {
      saveWeeklyPlan("Please correct the highlighted timing items before continuing.");
      renderOutputs();
      return;
    }
    if (validation.warnings.length && !window.confirm("Some timing details are estimated. You can continue and update them later.")) {
      renderOutputs();
      return;
    }
    weeklyPlan.settings.timingSetupReviewed = true;
    weeklyPlan.settings.timingSetupNeedsReview = false;
    weeklyPlan.settings.timingSetupRequiresReview = false;
    weeklyPlan.settings.timingSetupLastReviewedAt = new Date().toISOString();
    weeklyPlan.settings.timingSetupReviewedAt = weeklyPlan.settings.timingSetupLastReviewedAt;
    weeklyPlan.timingSetupReviewed = true;
    weeklyPlan.timingSetupNeedsReview = false;
    weeklyPlan.timingSetupLastReviewedAt = weeklyPlan.settings.timingSetupLastReviewedAt;
    weeklyPlanUiState.isTimingSetupExpanded = false;
    generatedWeeklyPlanner = null;
    saveWeeklyPlan("Timing setup reviewed.");
    renderAll();
    showWorkspace("weeklyplan");
    window.setTimeout(() => document.querySelector("[data-weekly-step='view-plan']")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function addWeeklyOneOffItem() {
    if (!weeklyPlan) return;
    const description = document.getElementById("weeklyOneOffDescription")?.value || "One-off item";
    const amount = Number(document.getElementById("weeklyOneOffAmount")?.value) || 0;
    const date = document.getElementById("weeklyOneOffDate")?.value || weeklyPlan.startDate;
    const type = document.getElementById("weeklyOneOffType")?.value || "bill";
    if (!amount) {
      updateSaveStatus("Enter an amount before adding a one-off item.");
      return;
    }
    weeklyPlan = window.FFSWeeklyPlan.addOneOffItem(plan, CALC.calculatePlan(plan), weeklyPlan, { description, amount, date, type });
    markWeeklyTimingReviewRequired();
    weeklyPlanUiState.isTimingSetupExpanded = true;
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("One-off item added to the Weekly Plan.");
    renderAll();
    showWorkspace("weeklyplan");
  }

  function applyWeeklyOccurrenceEdit(button) {
    if (!weeklyPlan || !window.FFSWeeklyPlan) return;
    const row = button.closest(".weekly-timing-row");
    const itemId = button.dataset.weeklyTimingId;
    const occurrenceDate = row?.querySelector("[data-weekly-occurrence-date]")?.value || "";
    if (!itemId || !occurrenceDate) {
      updateSaveStatus("Choose the occurrence date to adjust.");
      return;
    }
    const amountRaw = row.querySelector("[data-weekly-occurrence-amount]")?.value;
    const newDate = row.querySelector("[data-weekly-occurrence-new-date]")?.value || "";
    const newFrequency = row.querySelector("[data-weekly-occurrence-frequency]")?.value || "";
    const scope = row.querySelector("[data-weekly-occurrence-scope]:checked")?.value || "this";
    const skip = row.querySelector("[data-weekly-occurrence-skip]")?.checked || false;
    const patch = {};
    if (amountRaw !== "") patch.amount = Number(amountRaw) || 0;
    if (newDate) patch.date = newDate;
    if (newFrequency) patch.frequency = newFrequency;
    if (skip) patch.active = false;
    if (!Object.keys(patch).length) {
      updateSaveStatus("Enter a new amount, date, or select skip before applying.");
      return;
    }
    weeklyPlan = window.FFSWeeklyPlan.applyOccurrenceEdit(plan, CALC.calculatePlan(plan), weeklyPlan, itemId, occurrenceDate, patch, scope);
    markWeeklyTimingReviewRequired();
    weeklyPlanUiState.isTimingSetupExpanded = true;
    generatedWeeklyPlanner = null;
    syncWeeklyPlanExportSettings();
    saveWeeklyPlan("Weekly timing updated.");
    renderAll();
    showWorkspace("weeklyplan");
  }

  function exportWeeklyPlanBackup() {
    if (!weeklyPlan) {
      updateSaveStatus("Create a Weekly Plan before exporting a backup.");
      return;
    }
    const payload = window.FFSWeeklyPlan.exportPayload(weeklyPlan);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, safeFilename(`Financial-Freedom-Weekly-Plan-${weeklyPlan.planName || householdNameForFile()}`, "json"));
    updateSaveStatus("Weekly Plan backup exported.");
  }

  function triggerWeeklyPlanImport() {
    const input = document.getElementById("weeklyPlanImportInput");
    if (!input) return;
    input.value = "";
    input.click();
  }

  function importWeeklyPlanBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = window.FFSWeeklyPlan.importPayload(JSON.parse(String(reader.result || "")));
        if (!window.confirm("Import this Weekly Plan backup? This will replace the current Weekly Plan history on this device, but not your full Financial Freedom plan.")) {
          updateSaveStatus("Weekly Plan import cancelled.");
          return;
        }
        weeklyPlan = imported;
        generatedWeeklyPlanner = null;
        activeWeeklyPlanTab = "thisWeek";
        weeklyEditingWeek = null;
        weeklyViewedWeekNumber = null;
        weeklyPlanUiState.isTimingSetupExpanded = null;
        editingTimingItemId = null;
        timingEditDraft = null;
        saveWeeklyPlan("Weekly Plan backup imported.");
        renderAll();
        showWorkspace("weeklyplan");
      } catch (error) {
        updateSaveStatus(error.message || "Weekly Plan import failed.");
      }
    };
    reader.onerror = () => updateSaveStatus("Weekly Plan import failed. The selected file could not be read.");
    reader.readAsText(file);
  }

  function reportSection(title, intro, body, extraClass = "") {
    return `
      <section class="report-stage ${extraClass}">
        <div class="report-stage-heading">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(intro)}</p>
        </div>
        ${body}
      </section>
    `;
  }

  function reportExplainer(title, value, body) {
    return `
      <article class="report-explainer">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <strong>${escapeHtml(value)}</strong>
        </div>
        <p>${escapeHtml(body)}</p>
      </article>
    `;
  }

  function reportProgressBar(percent) {
    const capped = Math.min(100, Math.max(0, Number(percent) || 0));
    return `
      <div class="report-progress-bar" aria-label="Target lifestyle funding progress">
        <span style="width:${capped}%"></span>
      </div>
      <p class="report-small-note">Visual progress is capped at 100%. The calculated progress shown in the figures may be higher where projected Financial Independence assets exceed the selected target.</p>
    `;
  }

  function reportMilestoneRows(result) {
    const percent = freedomPercent(result);
    const milestoneDefinitions = [
      {
        label: "Building the Foundation",
        coverage: 0.25,
        targetAge: plan.personal.person1Age,
        description: "Establishing positive cashflow, building emergency savings and gaining control over debt.",
      },
      {
        label: "Building Wealth",
        coverage: 0.5,
        targetAge: plan.personal.workOptionalAge,
        description: "Regularly reducing debt, investing and increasing long-term financial assets.",
      },
      {
        label: "Financial Independence",
        coverage: 0.75,
        targetAge: plan.personal.semiRetirementAge,
        description: "Investments and passive income can fund a meaningful portion of the household's lifestyle.",
      },
      {
        label: "Financial Freedom",
        coverage: 1,
        targetAge: plan.personal.fullRetirementAge,
        description: "Investments and passive income are projected to fund the household's target lifestyle.",
      },
    ];
    return milestoneDefinitions.map((milestone) => {
      const threshold = milestone.coverage * 100;
      const progress = threshold > 0 ? Math.min(100, Math.max(0, percent / threshold * 100)) : 0;
      const reach = milestoneReachEstimate(result, threshold);
      const reached = percent >= threshold;
      const status = reached ? "Reached" : reach.years ? "On track" : "Not yet reached";
      const estimatedYear = reach.years === 0 ? "Reached now" : reach.years ? String(new Date().getFullYear() + reach.years) : "Beyond forecast";
      return `
        <article class="report-milestone-card ${reached ? "status-green" : reach.years ? "status-amber" : ""}">
          <div class="report-milestone-title">
            <h3>${escapeHtml(milestone.label)}</h3>
            <span>${escapeHtml(status)}</span>
          </div>
          <p>${escapeHtml(milestone.description)}</p>
          <div class="report-mini-table">
            <div><span>Target age</span><strong>${milestone.targetAge ? `Age ${milestone.targetAge}` : "Not set"}</strong></div>
            <div><span>Estimated year</span><strong>${escapeHtml(estimatedYear)}</strong></div>
            <div><span>Estimated age</span><strong>${reach.age ? `Age ${reach.age}` : "Not estimated"}</strong></div>
            <div><span>Progress to milestone</span><strong>${plainPercent(progress)}</strong></div>
          </div>
        </article>
      `;
    }).join("");
  }

  function reportRecommendations(result) {
    const recommendations = [];
    const finalSurplus = Number(result.finalProjectedCashSurplus) || 0;
    const monthlySurplus = finalSurplus / 12;
    const gap = Math.max(0, (Number(result.targetCapital) || 0) - (Number(result.financialIndependenceAssets) || 0));
    const creditCardBalance = Number(result.plan.liabilities.creditCardBalance) || 0;
    const creditCardRate = Number(result.plan.liabilities.creditCardInterestRatePct) || 0;
    const accessibleAssets = Number(result.accessibleInvestmentAssets) || 0;

    if (finalSurplus < 0) {
      recommendations.push({
        priority: "High",
        title: "Review the projected cashflow shortfall",
        why: `The current model shows an estimated annual shortfall of ${money(Math.abs(finalSurplus))}.`,
        impact: "Reducing planned spending, reducing contributions, increasing income or using available reserves may improve affordability.",
      });
    } else {
      recommendations.push({
        priority: "Medium",
        title: "Decide how to use the remaining cash buffer",
        why: `The current model shows an estimated monthly final surplus of ${money(monthlySurplus)} after planned spending and wealth-building contributions.`,
        impact: "The Quick Scenario Test can model directing this surplus toward investments or debt repayment.",
      });
    }

    if (creditCardBalance > 0) {
      recommendations.push({
        priority: "High",
        title: "Review high-interest debt",
        why: `The plan includes credit card debt of ${money(creditCardBalance)} at an estimated interest rate of ${creditCardRate.toFixed(2)}%.`,
        impact: "The model can estimate debt reduction effects where repayment, balance and rate information has been entered.",
      });
    }

    if (gap > 0) {
      recommendations.push({
        priority: "Medium",
        title: "Continue building Financial Independence assets",
        why: `The estimated gap to the Financial Freedom target is ${money(gap)}.`,
        impact: `Current planned annual investing is ${money(result.annualInvestmentContributions)} and extra super contributions are ${money(result.annualExtraSuperContributions)}.`,
      });
    }

    if (accessibleAssets <= 0 && result.targetCapital > 0) {
      recommendations.push({
        priority: "High",
        title: "Build accessible investments outside superannuation",
        why: "The model currently shows little or no accessible Financial Independence assets before superannuation access age.",
        impact: "Building accessible investments may improve flexibility before age 60, based on the assumptions entered.",
      });
    } else if (result.superannuationBalance > accessibleAssets * 2 && result.plan.personal.person1Age < result.superAccessAge) {
      recommendations.push({
        priority: "Medium",
        title: "Balance superannuation and accessible investments",
        why: "A large part of wealth is held in superannuation, which this model treats as accessible from age 60.",
        impact: "Additional accessible investments may improve flexibility before superannuation access age.",
      });
    }

    return recommendations.slice(0, 5);
  }

  function reportRecommendationCards(recommendations) {
    return recommendations.map((item) => `
      <article class="report-recommendation-card">
        <span class="priority-pill priority-${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p><strong>Why it has been identified:</strong> ${escapeHtml(item.why)}</p>
        <p><strong>Estimated modelling impact:</strong> ${escapeHtml(item.impact)}</p>
      </article>
    `).join("");
  }

  function reportTopActionList(recommendations) {
    return `
      <ol class="report-top-action-list">
        ${recommendations.slice(0, 3).map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.why)}</span></li>`).join("")}
      </ol>
    `;
  }

  function reportScenarioMetrics(name, notes, scenarioPlan, source = "saved") {
    const scenarioResult = CALC.calculatePlan(scenarioPlan);
    const ageLabel = targetAgeOutcome(scenarioResult);
    const ageMatch = /Age\s+(\d+)/i.exec(ageLabel);
    const ageNumber = ageMatch ? Number(ageMatch[1]) : Infinity;
    return {
      source,
      name,
      notes,
      result: scenarioResult,
      monthlyCashflow: estimatedCashflow(scenarioResult) / 12,
      financialFreedomAge: ageLabel,
      financialFreedomAgeNumber: ageNumber,
      netWorth10: netWorthAtYear(scenarioResult, 10),
      netWorthLongTerm: longTermNetWorth(scenarioResult),
      investments10: investmentAtYear(scenarioResult, 10),
      super10: superAtYear(scenarioResult, 10),
      debt10: projectedDebtAtYear(scenarioResult, 10),
      debtNow: scenarioResult.totalLiabilities,
      progress: freedomPercent(scenarioResult),
      warning: estimatedCashflow(scenarioResult) < 0,
    };
  }

  function pickWinner(metrics, selector, lowerIsBetter = false) {
    return metrics.reduce((best, item) => {
      const itemValue = selector(item);
      const bestValue = selector(best);
      if (!Number.isFinite(itemValue) && Number.isFinite(bestValue)) return best;
      if (Number.isFinite(itemValue) && !Number.isFinite(bestValue)) return item;
      return lowerIsBetter ? (itemValue < bestValue ? item : best) : (itemValue > bestValue ? item : best);
    }, metrics[0]);
  }

  function reportCategoryWinners(metrics) {
    if (!metrics.length) return {};
    return {
      "Best cashflow": pickWinner(metrics, (item) => item.monthlyCashflow),
      "Earliest Financial Freedom": pickWinner(metrics, (item) => item.financialFreedomAgeNumber, true),
      "Highest projected net worth": pickWinner(metrics, (item) => item.netWorth10),
      "Highest accessible investments": pickWinner(metrics, (item) => item.investments10),
      "Highest super balance": pickWinner(metrics, (item) => item.super10),
      "Lowest debt": pickWinner(metrics, (item) => item.debt10, true),
    };
  }

  function reportBestOverall(metrics, winners) {
    const nonNegative = metrics.filter((item) => !item.warning);
    const candidates = nonNegative.length ? nonNegative : metrics;
    return candidates.reduce((best, item) => {
      const wins = Object.values(winners).filter((winner) => winner.name === item.name).length;
      const bestWins = Object.values(winners).filter((winner) => winner.name === best.name).length;
      if (wins !== bestWins) return wins > bestWins ? item : best;
      if (item.warning !== best.warning) return item.warning ? best : item;
      return item.netWorthLongTerm > best.netWorthLongTerm ? item : best;
    }, candidates[0]);
  }

  function reportMoneyDifference(current, compared, lowerIsBetter = false) {
    const diff = roundForDisplay((Number(compared) || 0) - (Number(current) || 0));
    const better = diff === 0 ? "Similar" : lowerIsBetter ? (diff < 0 ? "Compared scenario" : "Current plan") : (diff > 0 ? "Compared scenario" : "Current plan");
    return {
      diff: money(diff),
      better,
    };
  }

  function reportAgeDifference(current, compared) {
    if (!Number.isFinite(current.financialFreedomAgeNumber) && !Number.isFinite(compared.financialFreedomAgeNumber)) {
      return { diff: "Not estimated", better: "Similar" };
    }
    if (!Number.isFinite(compared.financialFreedomAgeNumber)) return { diff: "Later than current", better: "Current plan" };
    if (!Number.isFinite(current.financialFreedomAgeNumber)) return { diff: "Earlier than current", better: "Compared scenario" };
    const diff = compared.financialFreedomAgeNumber - current.financialFreedomAgeNumber;
    return {
      diff: diff === 0 ? "Same age" : `${Math.abs(diff)} ${Math.abs(diff) === 1 ? "year" : "years"} ${diff < 0 ? "earlier" : "later"}`,
      better: diff === 0 ? "Similar" : diff < 0 ? "Compared scenario" : "Current plan",
    };
  }

  function reportComparisonRow(label, currentValue, comparedValue, difference) {
    return `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${escapeHtml(currentValue)}</td>
        <td>${escapeHtml(comparedValue)}</td>
        <td>${escapeHtml(difference.diff)}</td>
        <td>${escapeHtml(difference.better)}</td>
      </tr>
    `;
  }

  function reportScenarioComparisonHtml(currentResult, scenarios) {
    if (!scenarios.length) {
      return `
        <div class="report-note">
          <strong>No saved scenarios yet.</strong>
          <p>Save at least one scenario to compare trade-offs between cashflow, investments, debt, superannuation and long-term outcomes.</p>
        </div>
      `;
    }
    const currentMetrics = reportScenarioMetrics("Current Plan", "Current unsaved working plan.", CALC.clonePlan(plan), "current");
    const savedMetrics = scenarios.map((scenario) => reportScenarioMetrics(scenario.name || "Saved scenario", scenario.notes || "", scenario.plan, "saved"));
    const allMetrics = [currentMetrics, ...savedMetrics];
    const winners = reportCategoryWinners(allMetrics);
    const bestOverall = reportBestOverall(allMetrics, winners);
    const compared = bestOverall.source === "current" ? savedMetrics[0] : bestOverall;
    const cashflowDiff = reportMoneyDifference(currentMetrics.monthlyCashflow, compared.monthlyCashflow);
    const ageDiff = reportAgeDifference(currentMetrics, compared);
    const netWorthDiff = reportMoneyDifference(currentMetrics.netWorth10, compared.netWorth10);
    const investmentDiff = reportMoneyDifference(currentMetrics.investments10, compared.investments10);
    const superDiff = reportMoneyDifference(currentMetrics.super10, compared.super10);
    const debtDiff = reportMoneyDifference(currentMetrics.debt10, compared.debt10, true);
    const longTermDiff = reportMoneyDifference(currentMetrics.netWorthLongTerm, compared.netWorthLongTerm);
    const winnerCards = [
      ...Object.entries(winners).map(([label, winner]) => summaryTile(label, winner?.name || "Not estimated")),
      summaryTile("Best overall balance", bestOverall.name),
    ].join("");
    const comparedDebtChange = compared.debt10 - currentMetrics.debt10;
    const comparedWealthChange = compared.netWorthLongTerm - currentMetrics.netWorthLongTerm;
    const tradeoff = `${compared.name} is compared with the current plan below. It ${ageDiff.better === "Compared scenario" ? "reaches the modelled Financial Freedom age earlier" : "does not reach the modelled Financial Freedom age earlier"} and shows ${money(Math.abs(comparedDebtChange))} ${comparedDebtChange > 0 ? "more" : "less"} estimated debt in 10 years, with ${money(Math.abs(comparedWealthChange))} ${comparedWealthChange > 0 ? "higher" : "lower"} long-term net worth. The preferred option may depend on whether the user values stronger cashflow, earlier accessibility, lower debt or maximum long-term wealth.`;
    const warning = bestOverall.warning
      ? `<p class="report-warning"><strong>Cashflow warning:</strong> The selected overall scenario has a negative final projected surplus, so it may not be affordable without other changes.</p>`
      : "";
    return `
      <div class="report-note">
        <strong>Scenario comparison approach</strong>
        <p>The report compares saved scenarios using visible category winners rather than relying only on a hidden score. Negative cashflow is treated as a warning before describing a scenario as preferable.</p>
      </div>
      <div class="summary-grid mt-4">${winnerCards}</div>
      ${warning}
      <div class="comparison-table-wrap report-table-wrap mt-4">
        <table class="comparison-table report-comparison-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Current Plan</th>
              <th>${escapeHtml(compared.name)}</th>
              <th>Difference</th>
              <th>Better Result</th>
            </tr>
          </thead>
          <tbody>
            ${reportComparisonRow("Monthly final surplus", money(currentMetrics.monthlyCashflow), money(compared.monthlyCashflow), cashflowDiff)}
            ${reportComparisonRow("Financial Freedom age", currentMetrics.financialFreedomAge, compared.financialFreedomAge, ageDiff)}
            ${reportComparisonRow("10-year net worth", money(currentMetrics.netWorth10), money(compared.netWorth10), netWorthDiff)}
            ${reportComparisonRow("10-year investments", money(currentMetrics.investments10), money(compared.investments10), investmentDiff)}
            ${reportComparisonRow("10-year super", money(currentMetrics.super10), money(compared.super10), superDiff)}
            ${reportComparisonRow("10-year debt", money(currentMetrics.debt10), money(compared.debt10), debtDiff)}
            ${reportComparisonRow("Long-term net worth", money(currentMetrics.netWorthLongTerm), money(compared.netWorthLongTerm), longTermDiff)}
          </tbody>
        </table>
      </div>
      <p class="report-narrative">${escapeHtml(tradeoff)}</p>
    `;
  }

  function reportScenarioCardsHtml(scenarios) {
    if (!scenarios.length) {
      return `<div class="report-note"><strong>No saved scenario details to show.</strong><p>Saved scenarios will appear here as separate cards once created.</p></div>`;
    }
    return scenarios.map((scenario) => {
      const metrics = reportScenarioMetrics(scenario.name || "Saved scenario", scenario.notes || "", scenario.plan, "saved");
      return `
        <article class="report-scenario-card">
          <div class="report-scenario-heading">
            <div>
              <h3>${escapeHtml(metrics.name)}</h3>
              <p>${escapeHtml(metrics.notes || "No scenario description entered.")}</p>
            </div>
            <span>${metrics.warning ? "Cashflow warning" : "Scenario estimate"}</span>
          </div>
          <div class="report-mini-table report-mini-table-two">
            <div><span>Monthly final surplus</span><strong>${money(metrics.monthlyCashflow)}</strong></div>
            <div><span>1-year net worth</span><strong>${money(netWorthAtYear(metrics.result, 1))}</strong></div>
            <div><span>2-year net worth</span><strong>${money(netWorthAtYear(metrics.result, 2))}</strong></div>
            <div><span>10-year net worth</span><strong>${money(metrics.netWorth10)}</strong></div>
            <div><span>Long-term net worth</span><strong>${money(metrics.netWorthLongTerm)}</strong></div>
            <div><span>Debt balance</span><strong>${money(metrics.debtNow)}</strong></div>
            <div><span>Investment balance</span><strong>${money(metrics.investments10)}</strong></div>
            <div><span>Superannuation balance</span><strong>${money(metrics.super10)}</strong></div>
            <div><span>Target lifestyle funded</span><strong>${plainPercent(metrics.progress)}</strong></div>
            <div><span>Estimated Financial Freedom age</span><strong>${escapeHtml(metrics.financialFreedomAge)}</strong></div>
          </div>
        </article>
      `;
    }).join("");
  }

  function reportActionPlan(result, recommendations) {
    const immediate = [];
    const nextYear = [];
    const longTerm = [];
    const finalSurplus = Number(result.finalProjectedCashSurplus) || 0;
    const gap = Math.max(0, (Number(result.targetCapital) || 0) - (Number(result.financialIndependenceAssets) || 0));
    const creditCardBalance = Number(result.plan.liabilities.creditCardBalance) || 0;

    if (finalSurplus < 0) immediate.push("Review the projected cashflow shortfall before increasing wealth-building contributions.");
    if (creditCardBalance > 0) immediate.push("Review high-interest debt and test whether extra repayments improve the modelled outcome.");
    if (result.accessibleInvestmentAssets <= 0 && result.targetCapital > 0) immediate.push("Start building accessible investments outside superannuation for flexibility before age 60.");
    if (!immediate.length) immediate.push("Keep the positive monthly cash buffer visible and decide whether it should support investments, debt reduction or reserves.");

    nextYear.push(...recommendations.slice(0, 2).map((item) => item.title));
    if (Number(result.annualInvestmentContributions) > 0) nextYear.push("Check that the annual investing target remains affordable after tax, HELP, expenses and debt repayments.");
    if (Number(result.annualExtraSuperContributions) > 0) nextYear.push("Review extra super contributions for affordability and access timing.");
    if (!nextYear.length) nextYear.push("Update the plan with income, expenses, assets and debt details, then regenerate this report.");

    if (gap > 0) longTerm.push(`Continue building Financial Independence assets toward the estimated target gap of ${money(gap)}.`);
    longTerm.push("Review assumptions at least annually or after major changes to income, expenses, interest rates or investment returns.");
    longTerm.push("Use saved scenarios inside the app to compare trade-offs, while keeping this report focused on the current plan.");

    const list = (items) => `<ul class="report-action-list">${items.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    return `
      <div class="report-action-plan-grid">
        <article class="report-action-column">
          <h3>Immediate priorities</h3>
          ${list(immediate)}
        </article>
        <article class="report-action-column">
          <h3>Next 12 months</h3>
          ${list(nextYear)}
        </article>
        <article class="report-action-column">
          <h3>Long-term strategy</h3>
          ${list(longTerm)}
        </article>
      </div>
    `;
  }

  function renderReports(result) {
    const container = document.getElementById("financialReportBody");
    if (!container) return;
    const percent = freedomPercent(result);
    const stage = financialStageInfo(result).stage;
    const gap = Math.max(0, (Number(result.targetCapital) || 0) - (Number(result.financialIndependenceAssets) || 0));
    const monthlyFinalSurplus = estimatedCashflow(result) / 12;
    const annualFinalSurplus = estimatedCashflow(result);
    const fiReach = milestoneReachEstimate(result, 75);
    const estimatedFiAge = fiReach.age ? `Age ${fiReach.age}` : "Beyond 30 years";
    const estimatedFreedomAge = targetAgeOutcome(result);
    const recommendations = reportRecommendations(result);
    const generatedDate = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
    const cashflowTone = result.finalProjectedCashSurplus < 0 ? "report-warning" : "report-positive";
    const cashflowHeading = result.finalProjectedCashSurplus < 0 ? "Cashflow warning" : "Positive cashflow";
    const cashflowText = result.finalProjectedCashSurplus < 0
      ? "Your current plan allocates more money than the estimated cash available. The plan may need to be adjusted by reducing expenses, reducing contributions, increasing income or using available cash reserves."
      : "Your plan currently retains an estimated cash buffer after all entered spending and wealth-building contributions.";
    const financialHealth = result.finalProjectedCashSurplus < 0
      ? "The model shows a cashflow shortfall after tax, HELP repayments, spending, debt repayments and planned wealth-building contributions."
      : "The model shows a positive cash buffer after tax, HELP repayments, spending, debt repayments and planned wealth-building contributions.";
    const tenYearProgress = progressAtYear(result, 10);
    const tenYearProgressText = tenYearProgress > 100
      ? "Projected FI assets exceed the selected target in the 10-year view, based on the assumptions entered."
      : `Projected target lifestyle funding is ${plainPercent(tenYearProgress)} in 10 years, based on the assumptions entered.`;

    const summaryNarrative = `
      <div class="report-narrative-box">
        <p>Your current net worth is approximately <strong>${money(result.currentNetWorth)}</strong>. Of this amount, approximately <strong>${money(result.financialIndependenceAssets)}</strong> is currently counted as Financial Independence (FI) assets capable of supporting your future lifestyle.</p>
        <p>Based on annual lifestyle spending of <strong>${money(plan.personal.targetAnnualSpending)}</strong>, your estimated Financial Freedom target is <strong>${money(result.targetCapital)}</strong>. You are currently <strong>${plainPercent(percent)}</strong> of the way toward this target.</p>
        <p>${escapeHtml(financialHealth)}</p>
      </div>
    `;

    container.innerHTML = `
      <article class="report-title-card">
        <p class="brand-kicker">Financial Freedom Report</p>
        <h1>Your Financial Freedom Report</h1>
        <p>Generated ${escapeHtml(generatedDate)}. This report is an educational modelling summary based on the information and assumptions entered.</p>
      </article>

      ${reportSection("Executive Summary", "A concise overview of your current financial position, progress and estimated future outcome.", `
        ${summaryNarrative}
        <div class="summary-grid mt-4">
          ${summaryTile("Target lifestyle funded", plainPercent(percent))}
          ${summaryTile("Current financial stage", stage.name)}
          ${summaryTile("Current annual surplus", money(annualFinalSurplus), annualFinalSurplus >= 0 ? "status-green" : "status-amber")}
          ${summaryTile("Current investment amount", money(result.investmentBalance))}
          ${summaryTile("Current debt", money(result.totalLiabilities))}
          ${summaryTile("Target FI assets", money(result.targetCapital))}
          ${summaryTile("Estimated FI age", estimatedFiAge)}
          ${summaryTile("Estimated Financial Freedom age", estimatedFreedomAge)}
        </div>
        <div class="report-top-actions mt-4">
          <h3>Top recommended actions</h3>
          ${reportTopActionList(recommendations)}
        </div>
      `, "report-executive")}

      ${reportSection("Current Financial Position", "A clean summary of income, expenses, assets, liabilities and the assets currently counted toward Financial Independence.", `
        <div class="summary-grid">
          ${summaryTile("Income", money(result.annualGrossIncome))}
          ${summaryTile("Expenses", money(result.annualLivingExpenses))}
          ${summaryTile("Net cashflow", money(result.finalProjectedCashSurplus), result.finalProjectedCashSurplus >= 0 ? "status-green" : "status-amber")}
          ${summaryTile("Total assets", money(result.totalAssets))}
          ${summaryTile("Total liabilities", money(result.totalLiabilities))}
          ${summaryTile("Net worth", money(result.currentNetWorth))}
          ${summaryTile("Current FI assets", money(result.financialIndependenceAssets))}
          ${summaryTile("Current investment portfolio", money(result.investmentBalance))}
          ${summaryTile("Superannuation balance", money(result.superannuationBalance))}
        </div>
        <p class="report-narrative">You currently have total assets of ${money(result.totalAssets)} and total liabilities of ${money(result.totalLiabilities)}, resulting in net worth of approximately ${money(result.currentNetWorth)}.</p>
        <p class="report-narrative">Your current FI assets may be lower than total net worth because some assets, such as your home, vehicles or personal-use assets, may not currently be treated as available to fund living costs.</p>
      `, "report-page-break")}

      ${reportSection("Cashflow Analysis", "A step-by-step view of how gross income is reduced by estimated tax, HELP repayments, living costs, debt repayments and planned wealth-building contributions.", `
        <div class="table-list cashflow-list report-waterfall">
          ${[
            ["Gross income", result.annualGrossIncome],
            [`Less: Estimated income tax (${result.taxEstimate.taxYear})`, -result.taxEstimate.incomeTax],
            ["Less: Medicare levy", -result.taxEstimate.medicareLevy],
            ...(Number(result.helpRepaymentEstimate.annualRepayment) > 0 ? [["Less: Estimated HECS/HELP repayment", -result.helpRepaymentEstimate.annualRepayment]] : []),
            ["Less: Living expenses", -result.annualLivingExpenses],
            ["Less: Debt repayments", -result.annualDebtRepayments],
            ["Less: Annual investing", -result.annualInvestmentContributions],
            ["Less: Extra super contributions", -result.annualExtraSuperContributions],
            ["Remaining cash surplus", result.finalProjectedCashSurplus],
          ].map(([label, value]) => cashflowRowHtml(label, value)).join("")}
        </div>
        <p class="report-narrative">Cashflow is estimated from gross income, then reduced by tax, Medicare levy, HELP repayments where applicable, living expenses, debt repayments, investing and extra super contributions.</p>
        <p class="report-narrative">The remaining cash surplus is the amount left after the planned spending and wealth-building amounts entered in the app.</p>
        <div class="${cashflowTone}"><strong>${cashflowHeading}</strong><p>${cashflowText}</p></div>
      `, "report-page-break report-compact-section")}

      ${reportSection("Target Lifestyle Funding", "This section estimates how close your current FI assets are to funding your chosen lifestyle.", `
        <div class="summary-grid">
          ${summaryTile("Current FI assets", money(result.financialIndependenceAssets))}
          ${summaryTile("Target FI assets", money(result.targetCapital))}
          ${summaryTile("Gap to target", money(gap))}
          ${summaryTile("Target lifestyle funded", plainPercent(percent))}
          ${summaryTile("Estimated annual passive income", money(annualPassiveIncome(result)))}
          ${summaryTile("10-year investment balance", money(investmentAtYear(result, 10)))}
          ${summaryTile("10-year debt estimate", money(projectedDebtAtYear(result, 10)))}
        </div>
        ${reportProgressBar(percent)}
        <div class="report-chart-grid mt-4">
          <article class="report-chart-card report-chart-wide">
            <h3>Target lifestyle funding</h3>
            <svg id="reportProgressChart" class="chart" viewBox="0 0 760 280" role="img" aria-label="Report target lifestyle funding progress"></svg>
            <p>Progress compares current FI assets with the estimated target FI assets. The visual chart is capped at 100% where projected FI assets exceed the selected target.</p>
          </article>
        </div>
      `, "report-page-break")}

      ${reportSection("Future Projections", "Estimated changes in net worth, FI assets and debt if the current assumptions continue.", `
        <div class="summary-grid">
          ${summaryTile("1-year projected net worth", money(netWorthAtYear(result, 1)))}
          ${summaryTile("2-year projected net worth", money(netWorthAtYear(result, 2)))}
          ${summaryTile("10-year projected net worth", money(netWorthAtYear(result, 10)))}
          ${summaryTile("30-year projected net worth", money(netWorthAtYear(result, 30)))}
          ${summaryTile("10-year FI assets", money(projectedFiAssetsAtYear(result, 10)))}
          ${summaryTile("10-year investment portfolio", money(investmentAtYear(result, 10)))}
          ${summaryTile("10-year debt estimate", money(projectedDebtAtYear(result, 10)))}
          ${summaryTile("Estimated Financial Freedom age", estimatedFreedomAge)}
        </div>
        <p class="report-narrative">Over the next 10 years, your net worth is projected to grow to approximately ${money(netWorthAtYear(result, 10))}.</p>
        <p class="report-narrative">During the same period, your investment portfolio is projected to grow to approximately ${money(investmentAtYear(result, 10))}, while debt may reduce to approximately ${money(projectedDebtAtYear(result, 10))}.</p>
        <p class="report-narrative">These projections depend heavily on the assumptions entered and actual investment returns, inflation, tax, income and spending will vary.</p>
        <p class="report-note"><strong>10-year progress:</strong> ${escapeHtml(tenYearProgressText)}</p>
        <div class="report-chart-grid mt-4">
          <article class="report-chart-card">
            <h3>Net worth projection</h3>
            <svg id="reportNetWorthChart" class="chart" viewBox="0 0 760 280" role="img" aria-label="Report net worth forecast"></svg>
            <p>Estimated net worth over time based on the current assumptions.</p>
          </article>
          <article class="report-chart-card">
            <h3>FI assets projection</h3>
            <svg id="reportFiAssetsChart" class="chart" viewBox="0 0 760 280" role="img" aria-label="Report FI assets forecast"></svg>
            <p>Estimated FI assets, including superannuation only from the modelled access age.</p>
          </article>
          <article class="report-chart-card">
            <h3>Debt reduction</h3>
            <svg id="reportDebtChart" class="chart" viewBox="0 0 760 280" role="img" aria-label="Report debt reduction forecast"></svg>
            <p>Estimated total debt balance over time using the plan information entered.</p>
          </article>
        </div>
      `, "report-page-break")}

      ${reportSection("Milestones", "Compact milestones showing target age, estimated timing and what each stage means.", `
        <div class="report-milestone-grid">${reportMilestoneRows(result)}</div>
      `, "report-page-break report-compact-section")}

      ${reportSection("Personalised Action Plan", "Modelling observations to help decide what to review or test next. This is not personal financial advice.", `
        <p class="report-note">These actions are based only on the information entered and the app's modelling outputs. They are intended as prompts for review, not instructions to implement a strategy.</p>
        ${reportActionPlan(result, recommendations)}
        <div class="report-recommendation-grid mt-4">${reportRecommendationCards(recommendations)}</div>
      `, "report-page-break")}

      ${reportSection("Important Assumptions", "The major assumptions that drive the projected results.", `
        <div class="report-assumption-grid">
          ${reportExplainer("Investment return", `${Number(plan.investing.expectedInvestmentReturnPct || 0).toFixed(1)}%`, "Estimated average annual return for non-super investments.")}
          ${reportExplainer("Inflation", `${Number(plan.investing.inflationPct || 0).toFixed(1)}%`, "Estimated annual increase in lifestyle costs.")}
          ${reportExplainer("Loan interest", `${Number(plan.liabilities.homeLoanInterestRatePct || 0).toFixed(2)}%`, "Entered home loan interest rate used by the loan model.")}
          ${reportExplainer("Super growth", `${Number(plan.investing.expectedSuperReturnPct || 0).toFixed(1)}%`, "Estimated average annual return for superannuation.")}
          ${reportExplainer("Retirement assumptions", `Age ${plan.personal.fullRetirementAge || "not set"}`, "Target age entered for long-term financial freedom planning.")}
          ${reportExplainer("Withdrawal assumptions", `${Number(plan.investing.safeWithdrawalRatePct || 0).toFixed(1)}%`, "Percentage of FI assets assumed to fund annual lifestyle spending.")}
          ${reportExplainer("Annual lifestyle spending needed for Financial Freedom", money(plan.personal.targetAnnualSpending), "Annual spending target used to estimate required FI assets.")}
          ${reportExplainer("Projection period", "30 years", "Long-term projection period currently shown by the app.")}
        </div>
      `, "report-page-break report-compact-section")}

      ${reportSection("Disclaimer", "Important limits of this educational modelling report.", `
        <div class="report-outcome-box">
          <h3>Current estimated outcome</h3>
          <div class="summary-grid mt-4">
            ${summaryTile("Target lifestyle funded", plainPercent(percent))}
            ${summaryTile("Estimated Financial Freedom age", estimatedFreedomAge)}
            ${summaryTile("Target FI capital", money(result.targetCapital))}
            ${summaryTile("Current FI assets", money(result.financialIndependenceAssets))}
            ${summaryTile("Gap remaining", money(gap))}
            ${summaryTile("Monthly projected surplus", money(monthlyFinalSurplus), monthlyFinalSurplus >= 0 ? "status-green" : "status-amber")}
          </div>
        </div>
        <div class="report-disclaimer">
          <h3>Important disclaimer</h3>
          <p>This report is provided for education and financial modelling purposes only. It is not personal financial, taxation, legal or investment advice.</p>
          <p>The results are estimates based on the information and assumptions entered. Actual outcomes may vary due to changes in income, expenses, investment returns, inflation, interest rates, taxation, legislation and personal circumstances.</p>
          <p>Consider obtaining professional advice before making significant financial decisions.</p>
        </div>
        <footer class="report-footer">
          <span>Financial Freedom Report</span>
          <span>Generated ${escapeHtml(generatedDate)}</span>
          <span>Education and modelling only. Not financial advice.</span>
        </footer>
      `, "report-page-break report-compact-section")}
    `;

    renderWeeklyPlannerControls(result);
    const projectionYears = [0, 1, 2, 5, 10, 20, 30];
    lineChart("reportNetWorthChart", [{
      label: "Net worth",
      color: "#2563eb",
      points: [{ x: 0, y: result.currentNetWorth }, ...result.netWorthProjection.map((row) => ({ x: row.year, y: row.closingBalance }))],
    }], { height: 280, xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("reportProgressChart", [{
      label: "Progress",
      color: "#0f9f6e",
      points: [{ x: 0, y: Math.min(100, percent) }, ...result.financialFreedomProgressProjection.map((row) => ({ x: row.year, y: Math.min(100, row.progress) }))],
    }], { height: 280, xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y`, yLabel: (value) => `${Math.round(value)}%` });
    lineChart("reportFiAssetsChart", [{
      label: "FI assets",
      color: "#0f9f6e",
      points: projectionYears.map((year) => ({ x: year, y: year === 0 ? result.financialIndependenceAssets : projectedFiAssetsAtYear(result, year) })),
    }], { height: 280, xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("reportDebtChart", [{
      label: "Debt",
      color: "#dc4c3e",
      points: projectionYears.map((year) => ({ x: year, y: year === 0 ? result.totalLiabilities : projectedDebtAtYear(result, year) })),
    }], { height: 280, xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
  }

  function renderSetupSummary(result) {
    const container = document.getElementById("setupSummary");
    if (!container) return;
    const percent = freedomPercent(result);
    const stage = financialStageInfo(result).stage;
    const rows = [
      { label: "Target lifestyle funded", value: plainPercent(percent) },
      { label: "Current stage", value: stage.name },
      { label: "Accessible investments", value: money(result.accessibleInvestmentAssets) },
      { label: "Super from age 60", value: money(result.superannuationBalance) },
      { label: "Annual Income", value: money(result.annualGrossIncome) },
      { label: "Net income after tax and HELP", value: money(result.netIncomeAfterTaxHelp) },
      { label: "Annual Living Expenses", value: money(result.annualLivingExpenses) },
      { label: "Annual Loan Repayments", value: money(result.annualDebtRepayments) },
      { label: "Annual Surplus", value: money(result.cashSurplusBeforeInvesting) },
      {
        label: "Spare cashflow used to invest",
        value: money(result.annualInvestmentContributions),
        infoKey: "cashflowAllocation",
        view: "investments",
        path: "investing.annualInvestingTarget",
      },
      {
        label: "Spare cashflow invested in extra super",
        value: money(result.annualExtraSuperContributions),
        infoKey: "cashflowAllocation",
        view: "super",
        path: "investing.extraSuperContributions",
      },
      { label: "Final projected cash surplus", value: money(result.finalProjectedCashSurplus) },
      { label: "Investment return", value: `${Number(plan.investing.expectedInvestmentReturnPct || 0).toFixed(1)}%` },
      { label: "1-year net worth", value: money(netWorthAtYear(result, 1)) },
    ];
    container.innerHTML = rows.map((row) => {
      const jumpAttrs = row.path ? ` role="button" tabindex="0" data-summary-jump data-summary-view="${escapeHtml(row.view)}" data-summary-path="${escapeHtml(row.path)}" aria-label="Edit ${escapeHtml(row.label)}"` : "";
      const label = row.infoKey
        ? `<span class="summary-label-with-info">${escapeHtml(row.label)}${infoButtonHtml(row.infoKey, row.label)}</span>`
        : `<span>${escapeHtml(row.label)}</span>`;
      return `
        <div class="setup-summary-row${row.path ? " setup-summary-row-clickable" : ""}"${jumpAttrs}>
          ${label}
          <strong>${escapeHtml(row.value)}</strong>
        </div>
      `;
    }).join("");
  }

  function jumpToSummaryTarget(trigger) {
    const view = trigger.dataset.summaryView || "dashboard";
    const path = trigger.dataset.summaryPath;
    showWorkspace(view);
    window.setTimeout(() => {
      const panel = document.querySelector(`[data-view-panel="${view}"]`);
      const input = panel?.querySelector(`[data-path="${path}"]`) || document.querySelector(`[data-path="${path}"]`);
      if (!input) return;
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    }, 160);
  }

  function comparisonSurplusImpactTiles(result, revisedResult, comparison, annualAllocation) {
    if (!annualAllocation || !["investments", "debt"].includes(comparison.surplusAllocationTarget)) return [];
    const allocationLabel = comparison.surplusAllocationTarget === "investments" ? "investments" : "debt repayment";
    const tiles = [
      summaryTile("Surplus allocation modelled", `${money(annualAllocation)} per year to ${allocationLabel}`),
    ];
    if (comparison.surplusAllocationTarget === "investments") {
      const currentFiAssets10 = projectedFiAssetsAtYear(result, 10);
      const revisedFiAssets10 = projectedFiAssetsAtYear(revisedResult, 10);
      const currentPassive10 = Math.round(currentFiAssets10 * safeWithdrawalRate());
      const revisedPassive10 = Math.round(revisedFiAssets10 * safeWithdrawalRate());
      const revisedMilestone = nextMilestone(revisedResult, freedomPercent(revisedResult));
      tiles.push(
        summaryTile("Projected investment balance in 10 years", `${money(investmentAtYear(result, 10))} -> ${money(investmentAtYear(revisedResult, 10))}`),
        summaryTile("Projected FI assets in 10 years", `${money(currentFiAssets10)} -> ${money(revisedFiAssets10)}`),
        summaryTile("Projected passive income in 10 years", `${money(currentPassive10)} -> ${money(revisedPassive10)}`),
        summaryTile("Target lifestyle funded", `${plainPercent(freedomPercent(result))} -> ${plainPercent(freedomPercent(revisedResult))}`),
        summaryTile("Target age outcome", `${targetAgeOutcome(result)} -> ${targetAgeOutcome(revisedResult)}`),
        summaryTile("Relevant milestone", revisedMilestone.text)
      );
      return tiles;
    }

    const currentDebt10 = projectedDebtAtYear(result, 10);
    const revisedDebt10 = projectedDebtAtYear(revisedResult, 10);
    const canEstimateInterest = Number(result.loan?.offsetBenefit?.grossLoanBalance) > 0 && Number(result.loan?.totalInterestPaid) > 0;
    const interestSaved = canEstimateInterest ? Math.max(0, result.loan.totalInterestPaid - revisedResult.loan.totalInterestPaid) : null;
    const futureAnnualCashflow = revisedResult.annualDebtRepayments > 0
      ? revisedResult.finalProjectedCashSurplus + revisedResult.annualDebtRepayments
      : revisedResult.finalProjectedCashSurplus;
    tiles.push(
      summaryTile("Remaining debt estimate in 10 years", `${money(currentDebt10)} -> ${money(revisedDebt10)}`),
      summaryTile("Estimated debt repayment timing", `${formatLoanTiming(result.loan)} -> ${formatLoanTiming(revisedResult.loan)}`),
      summaryTile("Estimated interest saved", interestSaved === null ? "Add loan balance, rate and repayment to estimate" : money(interestSaved)),
      summaryTile("Future annual cashflow after debt is repaid", money(futureAnnualCashflow)),
      summaryTile("Target lifestyle funded", `${plainPercent(freedomPercent(result))} -> ${plainPercent(freedomPercent(revisedResult))}`),
      summaryTile("Target age outcome", `${targetAgeOutcome(result)} -> ${targetAgeOutcome(revisedResult)}`)
    );
    return tiles;
  }

  function renderComparison(result) {
    const summary = document.getElementById("comparisonSummary");
    if (!summary) return;
    const comparison = { ...comparisonDefaults, ...(plan.comparison || {}) };
    document.querySelectorAll("[data-comparison]").forEach((input) => {
      const value = comparison[input.dataset.comparison] ?? 0;
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else if (input.value !== String(value)) {
        input.value = value;
      }
    });
    const annualAllocation = comparisonSurplusAllocationAmount(result, comparison);
    const revisedPlan = buildComparisonPlan(result);
    const revisedResult = CALC.calculatePlan(revisedPlan);
    const current = estimatedCashflow(result);
    const revised = estimatedCashflow(revisedResult);
    const currentPercent = freedomPercent(result);
    const revisedPercent = freedomPercent(revisedResult);
    const tiles = [
      summaryTile("Current monthly final surplus", money(current / 12), current >= 0 ? "status-green" : "status-amber"),
      summaryTile("Revised monthly final surplus", money(revised / 12), revised >= 0 ? "status-green" : "status-amber"),
      summaryTile("Current annual final surplus", money(current), current >= 0 ? "status-green" : "status-amber"),
      summaryTile("Revised annual final surplus", money(revised), revised >= 0 ? "status-green" : "status-amber"),
      summaryTile("Taxable income estimate", `${money(result.taxEstimate.taxableIncomeAfterExtraSuper)} -> ${money(revisedResult.taxEstimate.taxableIncomeAfterExtraSuper)}`),
      summaryTile("Estimated income tax", `${money(result.taxEstimate.incomeTax)} -> ${money(revisedResult.taxEstimate.incomeTax)}`),
      summaryTile("Estimated Medicare levy", `${money(result.taxEstimate.medicareLevy)} -> ${money(revisedResult.taxEstimate.medicareLevy)}`),
      summaryTile("HELP repayment estimate", `${money(result.helpRepaymentEstimate.annualRepayment)} -> ${money(revisedResult.helpRepaymentEstimate.annualRepayment)}`),
      summaryTile("Super balance in 2 years", `${money(superAtYear(result, 2))} -> ${money(superAtYear(revisedResult, 2))}`),
      summaryTile("Investment balance in 2 years", `${money(investmentAtYear(result, 2))} -> ${money(investmentAtYear(revisedResult, 2))}`),
      summaryTile("Debt balance now", `${money(result.totalLiabilities)} -> ${money(revisedResult.totalLiabilities)}`),
      summaryTile("1-year net worth", `${money(netWorthAtYear(result, 1))} -> ${money(netWorthAtYear(revisedResult, 1))}`),
      summaryTile("2-year net worth", `${money(netWorthAtYear(result, 2))} -> ${money(netWorthAtYear(revisedResult, 2))}`),
      summaryTile("Long-term freedom progress", `${plainPercent(currentPercent)} -> ${plainPercent(revisedPercent)}`, revisedPercent >= currentPercent ? "status-green" : "status-amber"),
      ...comparisonSurplusImpactTiles(result, revisedResult, comparison, annualAllocation),
    ];
    summary.innerHTML = tiles.join("");
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
      summaryTile("Monthly final surplus", `${money(currentMonthly)} -> ${money(adjustedMonthly)}`, adjustedMonthly >= currentMonthly ? "status-green" : "status-amber"),
      summaryTile("1-year net worth", `${money(netWorthAtYear(result, 1))} -> ${money(netWorthAtYear(adjustedResult, 1))}`),
      summaryTile("2-year net worth", `${money(netWorthAtYear(result, 2))} -> ${money(netWorthAtYear(adjustedResult, 2))}`),
      summaryTile("Long-term net worth", `${money(longTermNetWorth(result))} -> ${money(longTermNetWorth(adjustedResult))}`),
      summaryTile("Target lifestyle funded", `${plainPercent(freedomPercent(result))} -> ${plainPercent(freedomPercent(adjustedResult))}`),
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
      annualPassiveIncome: annualPassiveIncome(scenarioResult),
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

  function comparisonDiff(currentValue, scenarioValue, lowerIsBetter = false) {
    const diff = roundForDisplay((Number(scenarioValue) || 0) - (Number(currentValue) || 0));
    const better = lowerIsBetter ? diff < 0 : diff > 0;
    const worse = lowerIsBetter ? diff > 0 : diff < 0;
    return {
      text: `${diff >= 0 ? "+" : ""}${money(diff)}`,
      tone: better ? "better" : worse ? "worse" : "",
    };
  }

  function comparisonTableRow(label, currentValue, scenarioValue, options = {}) {
    if (options.textOnly) {
      const changed = currentValue !== scenarioValue;
      return `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(currentValue)}</td>
          <td>${escapeHtml(scenarioValue)}</td>
          <td class="${changed ? "better" : ""}">${changed ? "Changed" : "No change"}</td>
        </tr>
      `;
    }
    const diff = comparisonDiff(currentValue, scenarioValue, options.lowerIsBetter);
    return `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${money(currentValue)}</td>
        <td>${money(scenarioValue)}</td>
        <td class="${diff.tone}">${diff.text}</td>
      </tr>
    `;
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
    const currentMetrics = scenarioComparisonMetrics({ name: "Current Plan", notes: "", plan: CALC.clonePlan(plan) });
    container.innerHTML = `
      <div class="card-heading">
        <div>
          <h3>Scenario Comparison Report</h3>
          <span>Simple side-by-side estimate across saved scenarios.</span>
        </div>
      </div>
      <p class="tax-note mt-4"><strong>Recommended Scenario:</strong> ${escapeHtml(best.scenario.name)}. This is preferred because it has the strongest estimated mix of final surplus, projected net worth, debt level, investment balance, super balance and progress toward the long-term financial freedom target.</p>
      <div class="comparison-table-wrap mt-4">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Current Plan</th>
              <th>Scenario</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonTableRow("Monthly final surplus", currentMetrics.monthlyCashflow, best.monthlyCashflow)}
            ${comparisonTableRow("Financial Freedom Age", currentMetrics.targetAge, best.targetAge, { textOnly: true })}
            ${comparisonTableRow("Investment Balance", currentMetrics.investmentBalance, best.investmentBalance)}
            ${comparisonTableRow("Super Balance", currentMetrics.superBalance, best.superBalance)}
            ${comparisonTableRow("Net Worth", currentMetrics.projectedNetWorth, best.projectedNetWorth)}
            ${comparisonTableRow("Annual Passive Income", currentMetrics.annualPassiveIncome, best.annualPassiveIncome)}
            ${comparisonTableRow("Lifetime Wealth", currentMetrics.longTermNetWorth, best.longTermNetWorth)}
            ${comparisonTableRow("Debt Balance", currentMetrics.debtBalance, best.debtBalance, { lowerIsBetter: true })}
          </tbody>
        </table>
      </div>
      <div class="scenario-comparison-grid mt-4">
        ${metrics.map((item, index) => `
          <article class="scenario-compare-card ${index === 0 ? "best" : ""}">
            <span>${index === 0 ? "Best estimated outcome" : "Saved scenario"}</span>
            <h4>${escapeHtml(item.scenario.name)}</h4>
            <div class="table-list mt-3">
              <div class="table-row"><span>Monthly final surplus</span><strong>${money(item.monthlyCashflow)}</strong></div>
              <div class="table-row"><span>1-year net worth</span><strong>${money(item.oneYearNetWorth)}</strong></div>
              <div class="table-row"><span>2-year net worth</span><strong>${money(item.twoYearNetWorth)}</strong></div>
              <div class="table-row"><span>Long-term net worth</span><strong>${money(item.longTermNetWorth)}</strong></div>
              <div class="table-row"><span>Debt balance</span><strong>${money(item.debtBalance)}</strong></div>
              <div class="table-row"><span>Investment balance</span><strong>${money(item.investmentBalance)}</strong></div>
              <div class="table-row"><span>Super balance</span><strong>${money(item.superBalance)}</strong></div>
              <div class="table-row"><span>Target lifestyle funded</span><strong>${plainPercent(item.freedomProgress)}</strong></div>
              <div class="table-row"><span>Target age outcome</span><strong>${escapeHtml(item.targetAge)}</strong></div>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function defaultScenarioName() {
    const date = new Date();
    return `Saved plan - ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function scenarioSummary(planSnapshot, result = CALC.calculatePlan(planSnapshot)) {
    const personal = planSnapshot.personal || {};
    const ages = [personal.person1Age, personal.person2Age].filter((age) => Number(age) > 0).join(" / ") || "Not entered";
    const targetAge = Number(personal.fullRetirementAge) || Number(personal.semiRetirementAge) || Number(personal.workOptionalAge) || 0;
    return {
      currentAge: ages,
      targetAge: targetAge ? `Age ${targetAge}` : "Not entered",
      income: result.annualGrossIncome || result.annualNetIncome || 0,
      livingExpenses: result.annualLivingExpenses || ((result.annualCoreLivingExpenses || 0) + (result.annualOtherRegularExpenses || 0)),
      netAssets: result.currentNetWorth || 0,
      projectedFreedomAge: targetAgeOutcome(result),
      freedomProgress: freedomPercent(result),
    };
  }

  function saveCurrentPlanAsScenario(options = {}) {
    syncCollectionsToLegacy();
    const scenarios = loadScenarios();
    const nameInput = document.getElementById("scenarioName");
    const notesInput = document.getElementById("scenarioNotes");
    const fallbackName = defaultScenarioName();
    let scenarioName = options.useScenarioFields ? (nameInput?.value || "").trim() : "";
    const notes = (notesInput?.value || "").trim();

    if (options.promptForName) {
      const response = window.prompt("Name this saved scenario", scenarioName || fallbackName);
      if (response === null) return;
      scenarioName = response.trim();
    }

    const name = scenarioName || fallbackName;
    const planSnapshot = CALC.clonePlan(plan);
    if (!isBundledSamplePlan(planSnapshot)) markPersonalPlanCreated();
    const resultSnapshot = CALC.calculatePlan(planSnapshot);
    const scenario = {
      id: `scenario-${Date.now()}`,
      source: "user",
      name,
      notes,
      savedAt: new Date().toISOString(),
      plan: planSnapshot,
      summary: scenarioSummary(planSnapshot, resultSnapshot),
    };

    const existingIndex = scenarios.findIndex((item) => (item.name || "").trim().toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) {
      const confirmed = window.confirm(`A saved scenario named "${name}" already exists. Overwrite it?`);
      if (!confirmed) {
        updateSaveStatus("Save cancelled.");
        return;
      }
      scenario.id = scenarios[existingIndex].id;
      scenarios[existingIndex] = scenario;
    } else {
      scenarios.unshift(scenario);
    }

    saveScenarios(scenarios);
    saveDraft();
    renderAll();
    showWorkspace("scenarios");
    updateSaveStatus("Plan saved to Saved Scenarios.");
  }

  function openSavedScenarios() {
    renderScenarios();
    showWorkspace("scenarios");
    updateSaveStatus("Choose a saved scenario to load.");
  }

  function renderScenarios() {
    const scenarios = loadScenarios();
    document.getElementById("scenarioCount").textContent = `${scenarios.length} saved`;
    renderScenarioComparison(scenarios);
    const list = document.getElementById("scenarioList");
    if (!scenarios.length) {
      list.innerHTML = `<p class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No saved scenarios yet. Click Save Plan to store the current plan here.</p>`;
      return;
    }
    list.innerHTML = scenarios.map((scenario) => {
      const scenarioResult = CALC.calculatePlan(scenario.plan);
      const summary = scenario.summary || scenarioSummary(scenario.plan, scenarioResult);
      return `
        <article class="scenario-row">
          <div class="flex flex-col gap-4">
            <div>
              <h3 class="font-black text-navy">${escapeHtml(scenario.name)}</h3>
              <p>${escapeHtml(scenario.notes || "No notes")}</p>
              <p>Saved ${new Date(scenario.savedAt).toLocaleString()}</p>
              <p class="mt-2 font-bold text-slate-600">Target lifestyle funded ${plainPercent(freedomPercent(scenarioResult))} · Net worth ${money(scenarioResult.currentNetWorth)}</p>
            </div>
            <div class="summary-grid">
              ${summaryTile("Current age", summary.currentAge)}
              ${summaryTile("Target age", summary.targetAge)}
              ${summaryTile("Income", money(summary.income))}
              ${summaryTile("Living expenses", money(summary.livingExpenses))}
              ${summaryTile("Net assets", money(summary.netAssets))}
              ${summaryTile("Projected financial freedom age", summary.projectedFreedomAge)}
              ${summaryTile("Target lifestyle funded", plainPercent(summary.freedomProgress))}
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn" type="button" data-load-scenario="${scenario.id}">Load</button>
              <button class="btn" type="button" data-rename-scenario="${scenario.id}">Rename</button>
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
    if (weeklyPlan) {
      markWeeklyTimingReviewRequired();
      saveWeeklyPlan();
    }
    autosavePlan();
    renderAll();
  }

  function removeCollectionItem(collection, id) {
    ensureCollectionData();
    if (!Array.isArray(plan[collection])) return;
    plan[collection] = plan[collection].filter((item) => item.id !== id);
    syncCollectionsToLegacy();
    if (weeklyPlan) {
      markWeeklyTimingReviewRequired();
      saveWeeklyPlan();
    }
    autosavePlan();
    renderAll();
  }

  function addGoalProgress(goalId) {
    const result = CALC.calculatePlan(plan);
    const goal = normalisedShortTermGoals(result).find((item) => item.id === goalId) || primaryShortTermGoal(result);
    if (!goal) {
      showWorkspace("goals");
      return;
    }
    const response = window.prompt(`How much progress did you add to ${goal.name}? Only record money you have actually set aside.`, "");
    if (response === null) return;
    const amount = Number(String(response).replace(/[$,]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      updateSaveStatus("Progress was not recorded. Enter a positive amount.");
      return;
    }
    const stored = goal.source === "legacy"
      ? null
      : ensureStoredGoal(goal);
    const previousAmount = Number(goal.currentAmount) || 0;
    if (stored) {
      stored.currentAmount = Math.max(0, Number(stored.currentAmount) || 0) + amount;
      if (stored.targetAmount > 0 && stored.currentAmount >= stored.targetAmount) {
        stored.status = "completed";
        stored.completedAt = stored.completedAt || new Date().toISOString();
      }
    } else {
      const legacyGoal = Array.isArray(plan.goalItems) ? plan.goalItems.find((item) => item.id === goal.id) : null;
      if (legacyGoal) legacyGoal.current = Math.max(0, Number(legacyGoal.current) || 0) + amount;
    }
    logProgressEvent({
      eventType: "goal-contribution-recorded",
      title: `Added progress to ${goal.name}`,
      description: `Goal progress increased from ${plainPercent(goalProgressPercent({ ...goal, currentAmount: previousAmount }))} to ${plainPercent(goalProgressPercent({ ...goal, currentAmount: previousAmount + amount }))}.`,
      amount,
      goalId: stored?.id || goal.id,
      source: "manual",
      metadata: {
        dedupeKey: `goal-${goal.id}-${Date.now()}`,
      },
    });
    syncEngagementAchievements(CALC.calculatePlan(plan));
    saveDraft(`Added ${money(amount)} to ${goal.name}.`);
    renderAll();
  }

  function handleEngagementAction(actionElement) {
    const action = actionElement.dataset.engagementAction;
    if (action === "add-goal-progress") {
      addGoalProgress(actionElement.dataset.goalId);
      return;
    }
    if (action === "ai") {
      if (aiInsightsConfig.enabled) openAiInsights();
      else updateSaveStatus("AI Insights private beta is not enabled in this environment.");
      return;
    }
    const viewMap = {
      dashboard: "dashboard",
      setup: "setup",
      weeklyplan: "weeklyplan",
      goals: "goals",
      investments: "investments",
      decision: "decision",
      reports: "reports",
    };
    showWorkspace(viewMap[action] || "dashboard");
  }

  function renderOutputs() {
    syncCollectionsToLegacy();
    const result = CALC.calculatePlan(plan);
    renderSamplePlanOptions();
    updateSetupNavigationLabel();
    updatePersonDependentLabels();
    updateSaveStatus();
    renderEngagementHome(result);
    updatePreview(result);
    renderAiInsightsHomeCard(result);
    renderDashboard(result);
    renderCashflow(result);
    renderLoan(result);
    renderInvestments(result);
    renderSuper(result);
    renderMilestones(result);
    renderForecast(result);
    renderGoalsSummary(result);
    renderDecision(result);
    renderScenarios();
    renderReports(result);
    renderWeeklyPlan(result);
    renderWizardResults(result);
    renderWizardStep();
    renderHelpReview(result);
    renderSetupSummary(result);
    renderComparison(result);
    renderWhatIf(result);
    renderAiInsightsModal();
    document.getElementById("disclaimer").textContent = DATA.disclaimer;
    if (hasOpenedWorkspace) document.getElementById("appWorkspace").classList.remove("hidden");
  }

  function renderAll() {
    renderForms();
    renderOutputs();
    restoreDraftUiInputs();
  }

  function loadSamplePlan() {
    const sample = selectedSamplePlan();
    plan = CALC.clonePlan(sample.plan);
    generatedWeeklyPlanner = null;
    resetWeeklyPlanStorage("");
    seedSampleScenarios(sample.plan);
    saveDraft("All changes saved");
    renderAll();
    showWorkspace("dashboard");
  }

  function startMyPlan() {
    const saved = loadDraft();
    if (saved) {
      plan = CALC.clonePlan(saved);
      generatedWeeklyPlanner = null;
      restoreDraftUiInputs();
      updateSaveStatus("Existing saved plan restored.");
    } else if (isBlankPlan(plan)) {
      plan = blankUserPlan();
      generatedWeeklyPlanner = null;
      restoredDraftUi = {};
      const nameInput = document.getElementById("scenarioName");
      const notesInput = document.getElementById("scenarioNotes");
      if (nameInput) nameInput.value = "";
      if (notesInput) notesInput.value = "";
      updateSaveStatus();
    }
    activeWizardStep = 0;
    renderAll();
    showWorkspace("setup");
  }

  function resetPlan() {
    if (!window.confirm("Clear the current plan and start again?")) return;
    plan = blankUserPlan();
    generatedWeeklyPlanner = null;
    resetWeeklyPlanStorage("");
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LAST_SAVED_KEY);
    document.getElementById("scenarioName").value = "";
    document.getElementById("scenarioNotes").value = "";
    activeWizardStep = 0;
    renderAll();
    showWorkspace("setup");
  }

  function clearSavedPlan() {
    if (!window.confirm("Clear the saved plan and all current entries? This cannot be undone.")) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LAST_SAVED_KEY);
    restoredDraftUi = {};
    plan = blankUserPlan();
    generatedWeeklyPlanner = null;
    resetWeeklyPlanStorage("");
    activeWizardStep = 0;
    const nameInput = document.getElementById("scenarioName");
    const notesInput = document.getElementById("scenarioNotes");
    if (nameInput) nameInput.value = "";
    if (notesInput) notesInput.value = "";
    renderAll();
    showWorkspace("setup");
    updateSaveStatus("Saved plan cleared.");
  }

  function closeMobileActionMenu() {
    const menu = document.getElementById("mobileActionMenu");
    const planGroup = document.getElementById("mobilePlanGroup");
    if (menu) menu.open = false;
    if (planGroup) planGroup.open = false;
  }

  function closeSamplePlanMenus() {
    document.querySelectorAll(".sample-plan-menu").forEach((menu) => {
      menu.open = false;
    });
  }

  function ensureGoalInfoModal() {
    let modal = document.getElementById("goalInfoModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "goalInfoModal";
    modal.className = "goal-info-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "goalInfoTitle");
    modal.innerHTML = `
      <div class="goal-info-backdrop" data-info-close></div>
      <article class="goal-info-card">
        <button class="goal-info-close" type="button" data-info-close aria-label="Close information popup">X</button>
        <h3 id="goalInfoTitle"></h3>
        <p id="goalInfoBody"></p>
      </article>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function openGoalInfo(key) {
    const copy = goalInfoCopy[key];
    if (!copy) return;
    const modal = ensureGoalInfoModal();
    modal.querySelector("#goalInfoTitle").textContent = copy.title;
    modal.querySelector("#goalInfoBody").textContent = copy.body;
    modal.classList.remove("hidden");
    modal.querySelector(".goal-info-close").focus();
  }

  function closeGoalInfo() {
    const modal = document.getElementById("goalInfoModal");
    if (modal) modal.classList.add("hidden");
  }

  function saveScenario() {
    saveCurrentPlanAsScenario({ useScenarioFields: true });
  }

  function duplicateScenario() {
    syncCollectionsToLegacy();
    const scenarios = loadScenarios();
    const planSnapshot = CALC.clonePlan(plan);
    if (!isBundledSamplePlan(planSnapshot)) markPersonalPlanCreated();
    const scenario = {
      id: `scenario-${Date.now()}`,
      name: `Copy ${scenarios.length + 1}`,
      notes: "Duplicated from the current plan.",
      savedAt: new Date().toISOString(),
      plan: planSnapshot,
      summary: scenarioSummary(planSnapshot),
    };
    scenarios.unshift(scenario);
    saveScenarios(scenarios);
    renderScenarios();
    showWorkspace("scenarios");
  }

  function renameScenario(id) {
    const scenarios = loadScenarios();
    const index = scenarios.findIndex((item) => item.id === id);
    if (index < 0) return;
    const currentName = scenarios[index].name || "Saved scenario";
    const response = window.prompt("Rename this saved scenario", currentName);
    if (response === null) return;
    const name = response.trim();
    if (!name) {
      updateSaveStatus("Scenario name was not changed.");
      return;
    }
    const duplicate = scenarios.find((item) => item.id !== id && (item.name || "").trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      updateSaveStatus("A saved scenario with that name already exists.");
      return;
    }
    scenarios[index] = { ...scenarios[index], name };
    saveScenarios(scenarios);
    renderScenarios();
    updateSaveStatus("Scenario renamed.");
  }

  function seedSampleScenarios(basePlan = DATA.demoPlan) {
    if (!Array.isArray(DATA.demoScenarioAdjustments)) return;
    const existingUserScenarios = loadScenarios().filter((scenario) => scenario.source !== "sample");
    const sampleScenarios = DATA.demoScenarioAdjustments.map((item, index) => ({
      id: `sample-scenario-${index + 1}`,
      source: "sample",
      name: item.name,
      notes: item.notes,
      savedAt: new Date().toISOString(),
      plan: applyScenarioAdjustments(basePlan, item.adjustments || {}),
    }));
    saveScenarios([...sampleScenarios, ...existingUserScenarios]);
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (target.closest("[data-timing-editor]")) {
        updateWeeklyTimingDraftFromInput(target);
        return;
      }
      if (target.dataset.weeklySetup !== undefined) {
        ensurePlanSettings(plan);
        const current = plan.reportSettings.weeklyPlanSetup || {};
        const key = target.dataset.weeklySetup;
        const value = target.dataset.type === "text" ? target.value : Number(target.value) || 0;
        if (key === "allocationMode") {
          current.allocationSettings = { ...(current.allocationSettings || {}), mode: target.value };
        } else if (key === "priorityFirst") {
          const rest = ["extraDebt", "investment", "extraSuper"].filter((item) => item !== target.value);
          current.allocationSettings = { ...(current.allocationSettings || {}), priority: [target.value, ...rest] };
        } else {
          current[key] = value;
        }
        plan.reportSettings.weeklyPlanSetup = current;
        autosavePlan();
        return;
      }
      if (target.dataset.weeklySetupDate !== undefined) {
        ensurePlanSettings(plan);
        const current = plan.reportSettings.weeklyPlanSetup || {};
        const type = target.dataset.weeklySetupDate;
        current[type] = { ...(current[type] || {}) };
        if (target.value) current[type][target.dataset.weeklyId] = target.value;
        else delete current[type][target.dataset.weeklyId];
        plan.reportSettings.weeklyPlanSetup = current;
        autosavePlan();
        return;
      }
      if (target.dataset.weeklyActual !== undefined || target.dataset.weeklyActualCheck !== undefined || target.dataset.weeklyOpeningBalance !== undefined) {
        if (!weeklyPlan) return;
        const weekNumber = Number(target.dataset.weeklyWeek || target.dataset.weeklyOpeningBalance) || weeklyPlan.currentWeekNumber;
        const week = weeklyPlan.weeks.find((item) => item.weekNumber === weekNumber);
        if (week?.isCompleted && weeklyEditingWeek !== weekNumber) return;
        updateWeeklyActualDraftFromInput(target);
        if (week?.isCompleted && weeklyEditingWeek === weekNumber) {
          updateSaveStatus("Editing completed week. Select Save completed week when ready.");
          return;
        }
        return;
      }
      if (target.dataset.weeklySetting !== undefined) {
        updateWeeklySettingFromInput(target);
        return;
      }
      if (target.dataset.weeklyTiming !== undefined) {
        updateWeeklyTimingFromInput(target);
        return;
      }
      if (target.dataset.weeklyDate !== undefined) {
        updateWeeklyDateFromInput(target);
        return;
      }
      if (target.dataset.samplePlanSelect !== undefined) {
        selectedSamplePlanId = target.value;
        renderSamplePlanOptions();
        return;
      }
      if (target.id === "scenarioName" || target.id === "scenarioNotes") {
        autosavePlan();
        return;
      }
      if (["plannerStartDate", "plannerStartingBalance", "plannerPeriod"].includes(target.id)) {
        updatePlannerSettingsFromInput(target);
        return;
      }
      if (target.dataset.collection) {
        ensureCollectionData();
        const item = plan[target.dataset.collection]?.find((entry) => entry.id === target.dataset.id);
        if (!item) return;
        const value = target.dataset.type === "text" ? target.value : Number(target.value);
        item[target.dataset.key] = value;
        generatedWeeklyPlanner = null;
        if (weeklyPlan) {
          markWeeklyTimingReviewRequired();
          saveWeeklyPlan();
        }
        syncCollectionInputs(target.dataset.collection, target.dataset.id, target.dataset.key, value);
        syncCollectionsToLegacy();
        autosavePlan();
        if (target.dataset.collection === "liabilityItems" && target.dataset.key === "type") {
          renderAll();
          return;
        }
        renderOutputs();
        return;
      }
      if (target.dataset.comparison) {
        ensureCollectionData();
        const value = target.dataset.type === "boolean" ? target.checked : target.dataset.type === "text" ? target.value : Number(target.value) || 0;
        plan.comparison[target.dataset.comparison] = value;
        generatedWeeklyPlanner = null;
        autosavePlan();
        renderOutputs();
        return;
      }
      if (!target.dataset.path) return;
      const value = target.dataset.type === "boolean" ? target.checked : target.dataset.type === "text" ? target.value : Number(target.value);
      setPath(plan, target.dataset.path, value);
      generatedWeeklyPlanner = null;
      if (weeklyPlan) {
        markWeeklyTimingReviewRequired();
        saveWeeklyPlan();
      }
      syncInputs(target.dataset.path, value);
      if (target.dataset.path === "liabilities.monthlyRepayment") {
        setPath(plan, "expenses.mortgageRepayments", value);
        syncInputs("expenses.mortgageRepayments", value);
      }
      if (target.dataset.path === "expenses.mortgageRepayments") {
        setPath(plan, "liabilities.monthlyRepayment", value);
        syncInputs("liabilities.monthlyRepayment", value);
      }
      autosavePlan();
      renderOutputs();
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target.id === "aiInsightsConsent") {
        aiInsightsUi.consentAccepted = Boolean(target.checked);
        renderAiInsightsModal();
        return;
      }
      if (target.closest("[data-timing-editor]")) {
        updateWeeklyTimingDraftFromInput(target);
      }
      if (target.dataset.weeklyActual !== undefined || target.dataset.weeklyActualCheck !== undefined || target.dataset.weeklyOpeningBalance !== undefined) {
        const weekNumber = Number(target.dataset.weeklyWeek || target.dataset.weeklyOpeningBalance) || weeklyPlan?.currentWeekNumber || 1;
        commitWeeklyActualDraft(weekNumber);
      }
    });

    document.addEventListener("focusout", (event) => {
      const target = event.target;
      if (target.dataset.weeklyActual !== undefined || target.dataset.weeklyOpeningBalance !== undefined) {
        const weekNumber = Number(target.dataset.weeklyWeek || target.dataset.weeklyOpeningBalance) || weeklyPlan?.currentWeekNumber || 1;
        commitWeeklyActualDraft(weekNumber);
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (event.key === "Enter" && (target.dataset.weeklyActual !== undefined || target.dataset.weeklyOpeningBalance !== undefined)) {
        event.preventDefault();
        const weekNumber = Number(target.dataset.weeklyWeek || target.dataset.weeklyOpeningBalance) || weeklyPlan?.currentWeekNumber || 1;
        commitWeeklyActualDraft(weekNumber);
        target.blur();
      }
    });

    document.addEventListener("click", (event) => {
      const infoButton = event.target.closest("[data-info-key]");
      if (infoButton) {
        event.preventDefault();
        openGoalInfo(infoButton.dataset.infoKey);
        return;
      }

      if (event.target.closest("[data-info-close]")) {
        closeGoalInfo();
        return;
      }

      const engagementAction = event.target.closest("[data-engagement-action]");
      if (engagementAction) {
        event.preventDefault();
        handleEngagementAction(engagementAction);
        return;
      }

      const aiAction = event.target.closest("[data-ai-insights-action]");
      if (aiAction) {
        event.preventDefault();
        const action = aiAction.dataset.aiInsightsAction;
        if (action === "open") openAiInsights();
        if (action === "close") closeAiInsightsModal();
        if (action === "generate") generateAiInsights();
        return;
      }

      const aiCard = event.target.closest("[data-ai-insights-card]");
      if (aiCard) {
        event.preventDefault();
        if (aiCard.getAttribute("aria-disabled") !== "true") openAiInsights();
        return;
      }

      const aiScenarioTarget = event.target.closest("[data-ai-scenario-target]");
      if (aiScenarioTarget) {
        event.preventDefault();
        closeAiInsightsModal();
        showWorkspace(aiScenarioTarget.dataset.aiScenarioTarget || "decision");
        return;
      }

      const summaryJump = event.target.closest("[data-summary-jump]");
      if (summaryJump) {
        event.preventDefault();
        jumpToSummaryTarget(summaryJump);
        return;
      }

      const sampleChoice = event.target.closest("[data-sample-plan-choice]");
      if (sampleChoice) {
        selectedSamplePlanId = sampleChoice.dataset.samplePlanChoice;
        renderSamplePlanOptions();
        closeSamplePlanMenus();
        loadSamplePlan();
        return;
      }

      if (document.querySelector(".sample-plan-menu[open]") && !event.target.closest(".sample-plan-menu")) {
        closeSamplePlanMenus();
      }

      const mobileAction = event.target.closest("[data-mobile-action]");
      if (mobileAction) {
        const action = mobileAction.dataset.mobileAction;
        closeMobileActionMenu();
        if (action === "load-sample") loadSamplePlan();
        if (action === "enter-data") startMyPlan();
        if (action === "save-plan") manualSavePlan();
        if (action === "new-plan") resetPlan();
        if (action === "load-plan") openSavedScenarios();
        if (action === "duplicate-plan") duplicateScenario();
        if (action === "export-plan-json") exportPlanJson();
        if (action === "import-plan-json") triggerImportPlanJson();
        if (action === "clear-saved-plan") clearSavedPlan();
        if (action === "export") window.print();
        return;
      }

      const mobileMenu = document.getElementById("mobileActionMenu");
      if (mobileMenu?.open && (event.target === mobileMenu || !event.target.closest("#mobileActionMenu"))) {
        closeMobileActionMenu();
        return;
      }

      const weeklyTab = event.target.closest("[data-weekly-tab]");
      if (weeklyTab) {
        activeWeeklyPlanTab = weeklyTab.dataset.weeklyTab;
        saveDraft();
        renderOutputs();
        return;
      }

      const weeklyHealthAction = event.target.closest("[data-weekly-health-action]");
      if (weeklyHealthAction) {
        const action = weeklyHealthAction.dataset.weeklyHealthAction;
        if (action === "update-plan") {
          activeWizardStep = 1;
          showWorkspace("setup");
          updateSaveStatus("Review the Financial Plan and update strategic assumptions only if you choose to.");
        } else if (action === "keep-plan") {
          updateSaveStatus("Financial Plan unchanged.");
        } else {
          updateSaveStatus("Reminder noted. Financial Plan unchanged.");
        }
        return;
      }

      const weeklyStepButton = event.target.closest("[data-weekly-step-button]");
      if (weeklyStepButton) {
        event.preventDefault();
        setActiveWeeklyStep(weeklyStepButton.dataset.weeklyStepButton);
        return;
      }

      const weeklyAction = event.target.closest("[data-weekly-action]");
      if (weeklyAction) {
        const action = weeklyAction.dataset.weeklyAction;
        const weekNumber = Number(weeklyAction.dataset.weeklyWeek) || weeklyCurrentWeek()?.weekNumber || weeklyPlan?.currentWeekNumber || 1;
        if (action === "create-plan") createWeeklyPlanFromSetup();
        if (action === "add-one-off") addWeeklyOneOffItem();
        if (action === "apply-occurrence-edit") applyWeeklyOccurrenceEdit(weeklyAction);
        if (action === "save-timing-item") saveWeeklyTimingDraft(weeklyAction.dataset.weeklyTimingId);
        if (action === "cancel-timing-item") cancelWeeklyTimingDraft(weeklyAction.dataset.weeklyTimingId);
        if (action === "toggle-timing-setup" && weeklyPlan) {
          const needsReview = Boolean(weeklyPlan.settings?.timingSetupNeedsReview || weeklyPlan.settings?.timingSetupRequiresReview);
          weeklyPlanUiState.isTimingSetupExpanded = !(weeklyPlanUiState.isTimingSetupExpanded === null
            ? (!weeklyPlan.settings?.timingSetupReviewed || needsReview)
            : weeklyPlanUiState.isTimingSetupExpanded);
          renderOutputs();
        }
        if (action === "begin-timing-edit") beginWeeklyTimingEdit(weeklyAction.dataset.weeklyTimingId);
        if (action === "complete-timing-review") completeWeeklyTimingReview();
        if (action === "view-week" && weeklyPlan) {
          weeklyViewedWeekNumber = clampWeeklyWeekNumber(weekNumber);
          activeWeeklyPlanTab = "thisWeek";
          weeklyEditingWeek = null;
          renderOutputs();
        }
        if (action === "go-current-week" && weeklyPlan) {
          weeklyViewedWeekNumber = weeklyPlanCurrentCalendarWeekNumber() || 1;
          activeWeeklyPlanTab = "thisWeek";
          weeklyEditingWeek = null;
          renderOutputs();
        }
        if (action === "save-week") saveWeekProgress(weekNumber, false);
        if (action === "complete-week") saveWeekProgress(weekNumber, true);
        if (action === "save-opening-balance") saveWeeklyOpeningBalance(weekNumber);
        if (action === "edit-week") {
          if (!window.confirm("Editing a completed week may change the balances shown in later weeks.")) return;
          weeklyEditingWeek = weekNumber;
          weeklyViewedWeekNumber = weekNumber;
          renderOutputs();
        }
        if (action === "cancel-week-edit") cancelCompletedWeekEdit(weekNumber);
        if (action === "mark-week-incomplete") markWeeklyWeekIncomplete(weekNumber);
        if (action === "toggle-upcoming" && weeklyPlan) {
          weeklyPlan.settings.showAllUpcoming = !weeklyPlan.settings.showAllUpcoming;
          saveWeeklyPlan();
          renderOutputs();
        }
        if (action === "rebuild-plan" && weeklyPlan) {
          weeklyPlan = window.FFSWeeklyPlan.reforecast(plan, CALC.calculatePlan(plan), weeklyPlan);
          generatedWeeklyPlanner = null;
          saveWeeklyPlan("Future weeks rebuilt. Completed week history was preserved.");
          renderAll();
        }
        if (action === "reset-plan") {
          if (!window.confirm("Reset the Weekly Plan? This will delete Weekly Plan history, but it will not reset your full Financial Freedom plan.")) return;
          resetWeeklyPlanStorage("Weekly Plan reset.");
          renderAll();
        }
        return;
      }

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

      const wizardStep = event.target.closest("[data-wizard-step]");
      if (wizardStep) {
        activeWizardStep = Number(wizardStep.dataset.wizardStep) || 0;
        saveDraft();
        renderOutputs();
        document.querySelector('[data-view-panel="setup"]').scrollIntoView({ behavior: "smooth", block: "start" });
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
          generatedWeeklyPlanner = null;
          resetWeeklyPlanStorage("");
          saveDraft();
          renderAll();
          showWorkspace("dashboard");
          updateSaveStatus("Scenario loaded successfully.");
        }
      }

      const renameId = event.target.closest("[data-rename-scenario]")?.dataset.renameScenario;
      if (renameId) {
        renameScenario(renameId);
      }

      const deleteId = event.target.closest("[data-delete-scenario]")?.dataset.deleteScenario;
      if (deleteId) {
        if (!window.confirm("Delete this saved scenario?")) return;
        saveScenarios(loadScenarios().filter((item) => item.id !== deleteId));
        renderScenarios();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMobileActionMenu();
        closeSamplePlanMenus();
        closeGoalInfo();
        closeAiInsightsModal();
      }

      const aiCard = event.target.closest?.("[data-ai-insights-card]");
      if (aiCard && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        if (aiCard.getAttribute("aria-disabled") !== "true") openAiInsights();
        return;
      }

      const summaryJump = event.target.closest?.("[data-summary-jump]");
      if (summaryJump && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        jumpToSummaryTarget(summaryJump);
        return;
      }

      const homeStep = event.target.closest?.("[data-home-step]");
      if (!homeStep || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      if (homeStep.dataset.homeStep === "setup") activeWizardStep = 0;
      showWorkspace(homeStep.dataset.homeStep);
    });

    document.addEventListener("focusin", (event) => {
      if (!event.target.classList?.contains("field-input") || window.innerWidth > 760) return;
      window.setTimeout(() => event.target.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    });

    document.getElementById("heroDemoButton").addEventListener("click", loadSamplePlan);
    document.getElementById("continueSampleButton").addEventListener("click", loadSamplePlan);
    document.getElementById("continuePlanButton").addEventListener("click", () => showWorkspace("dashboard"));
    document.getElementById("continueNewPlanButton").addEventListener("click", resetPlan);
    document.getElementById("enterDataButton").addEventListener("click", startMyPlan);
    document.getElementById("heroStartButton").addEventListener("click", startMyPlan);
    document.getElementById("planNewButton").addEventListener("click", resetPlan);
    document.getElementById("planSaveButton").addEventListener("click", manualSavePlan);
    document.getElementById("saveScenarioPanelButton").addEventListener("click", saveScenario);
    document.getElementById("planLoadButton").addEventListener("click", openSavedScenarios);
    document.getElementById("planDuplicateButton").addEventListener("click", duplicateScenario);
    document.getElementById("planExportJsonButton").addEventListener("click", exportPlanJson);
    document.getElementById("planImportJsonButton").addEventListener("click", triggerImportPlanJson);
    document.getElementById("planImportJsonInput").addEventListener("change", (event) => importPlanJsonFile(event.target.files?.[0]));
    document.getElementById("planClearSavedButton").addEventListener("click", clearSavedPlan);
    document.getElementById("wizardPrevButton").addEventListener("click", () => {
      activeWizardStep = Math.max(0, activeWizardStep - 1);
      saveDraft();
      renderOutputs();
      document.querySelector('[data-view-panel="setup"]').scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("wizardNextButton").addEventListener("click", () => {
      saveDraft();
      if (activeWizardStep >= wizardSteps.length - 1) {
        if (!isBundledSamplePlan(plan)) {
          markPersonalPlanCreated();
          saveDraft();
        }
        showWorkspace("dashboard");
        return;
      }
      activeWizardStep = Math.min(wizardSteps.length - 1, activeWizardStep + 1);
      renderOutputs();
      document.querySelector('[data-view-panel="setup"]').scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("exportButton").addEventListener("click", () => window.print());
    document.getElementById("reportPrintButton").addEventListener("click", () => printWithMode("financial-report"));
    document.getElementById("plannerGenerateButton").addEventListener("click", generateWeeklyPlanner);
    document.getElementById("plannerRegenerateButton").addEventListener("click", generateWeeklyPlanner);
    document.getElementById("plannerDownloadExcelButton").addEventListener("click", downloadWeeklyPlannerExcel);
    document.getElementById("plannerDownloadPdfButton").addEventListener("click", printWeeklyPlannerPdf);
    document.getElementById("weeklyPlanBackupExportButton").addEventListener("click", exportWeeklyPlanBackup);
    document.getElementById("weeklyPlanBackupImportButton").addEventListener("click", triggerWeeklyPlanImport);
    document.getElementById("weeklyPlanImportInput").addEventListener("change", (event) => importWeeklyPlanBackup(event.target.files?.[0]));
  }

  renderAll();
  bindEvents();
  loadAiInsightsConfig();
  if (hasOpenedWorkspace) showWorkspace(activeView);
})();
