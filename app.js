(function bootFinancialFreedomApp() {
  const DATA = window.FFS_DATA;
  const CALC = window.FFSCalculator;
  const DRAFT_KEY = "ffs-current-plan-v3";
  const SCENARIO_KEY = "ffs-scenarios-v3";
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

  let plan = CALC.clonePlan(loadDraft() || CALC.emptyPlan());
  let activeView = "dashboard";
  let activeWizardStep = 0;
  let hasOpenedWorkspace = Boolean(loadDraft());

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

  const freedomStages = [
    {
      min: 0,
      nextAt: 25,
      name: "Starting Out",
      explanation: "You are setting the foundation: building savings, reducing pressure and getting the plan organised.",
    },
    {
      min: 25,
      nextAt: 50,
      name: "Building Wealth",
      explanation: "Your investments are beginning to carry part of your annual lifestyle costs.",
    },
    {
      min: 50,
      nextAt: 75,
      name: "Momentum",
      explanation: "Your investments now fund a meaningful share of your annual lifestyle.",
    },
    {
      min: 75,
      nextAt: 100,
      name: "Semi-Retirement",
      explanation: "Your investments cover a large portion of lifestyle costs, but employment income is still partly needed.",
    },
    {
      min: 100,
      nextAt: 150,
      name: "Work Optional",
      explanation: "Your investments are projected to cover your lifestyle costs. Work is now optional based on the assumptions used.",
    },
    {
      min: 150,
      nextAt: null,
      name: "Financial Freedom",
      explanation: "Your investments provide a strong surplus above lifestyle costs based on the assumptions used.",
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

  function renderForms() {
    const aboutFields = [
      { label: "Person 1 name", path: "personal.person1Name", kind: "text" },
      { label: "Person 2 name", path: "personal.person2Name", kind: "text" },
      { label: "Person 1 age", path: "personal.person1Age" },
      { label: "Person 2 age", path: "personal.person2Age" },
    ];
    const goalFields = [
      { label: "Work optional target age", path: "personal.workOptionalAge" },
      { label: "Semi-retirement target age", path: "personal.semiRetirementAge" },
      { label: "Full retirement target age", path: "personal.fullRetirementAge" },
      { label: "Target annual spending", path: "personal.targetAnnualSpending", step: "1000" },
      { label: "Annual investing target", path: "investing.annualInvestingTarget", step: "1000" },
      { label: "Employer super contributions", path: "investing.employerSuperContributions", step: "1000" },
      { label: "Extra super contributions", path: "investing.extraSuperContributions", step: "1000" },
      { label: "Expected investment return (%)", path: "investing.expectedInvestmentReturnPct", step: "0.1" },
      { label: "Expected super return (%)", path: "investing.expectedSuperReturnPct", step: "0.1" },
      { label: "Inflation (%)", path: "investing.inflationPct", step: "0.1" },
      { label: "Safe withdrawal rate (%)", path: "investing.safeWithdrawalRatePct", step: "0.1" },
    ];
    const assetFields = [
      { label: "Home value", path: "assets.homeValue", step: "1000" },
      { label: "Other property value", path: "assets.otherPropertyValue", step: "1000" },
      { label: "Offset balance", path: "assets.offsetBalance", step: "1000" },
      { label: "Cash", path: "assets.cash", step: "100" },
      { label: "Shares / ETFs", path: "assets.sharesEtfs", step: "100" },
      { label: "Crypto", path: "assets.crypto", step: "100" },
      { label: "Super person 1", path: "assets.superPerson1", step: "1000" },
      { label: "Super person 2", path: "assets.superPerson2", step: "1000" },
      { label: "Vehicles / personal assets", path: "assets.vehiclesPersonalAssets", step: "100" },
    ];
    const liabilityFields = [
      { label: "HECS / HELP debt", path: "liabilities.hecsHelpDebt", step: "100" },
      { label: "Other debts", path: "liabilities.otherDebts", step: "100" },
    ];
    const loanFields = [
      { label: "Home loan balance", path: "liabilities.homeLoanBalance", step: "1000" },
      { label: "Home loan interest rate (%)", path: "liabilities.homeLoanInterestRatePct", step: "0.1" },
      { label: "Monthly repayment", path: "liabilities.monthlyRepayment", step: "100" },
      { label: "Remaining loan term (years)", path: "liabilities.remainingLoanTermYears", step: "1" },
      { label: "Offset balance", path: "assets.offsetBalance", step: "1000" },
      { label: "Mortgage repayments in cashflow", path: "expenses.mortgageRepayments", step: "100" },
    ];
    const incomeGroups = [
      {
        title: "Person 1 income",
        description: "Salary, wages or regular take-home income.",
        fields: [
          { label: "Income name", path: "income.person1IncomeName", kind: "text", placeholder: "e.g. Person 1 salary" },
          { label: "Amount", path: "income.person1Income", step: "100" },
          { label: "Frequency", path: "income.person1Frequency", type: "select" },
        ],
      },
      {
        title: "Person 2 income",
        description: "Add the second regular income if relevant.",
        fields: [
          { label: "Income name", path: "income.person2IncomeName", kind: "text", placeholder: "e.g. Person 2 salary" },
          { label: "Amount", path: "income.person2Income", step: "100" },
          { label: "Frequency", path: "income.person2Frequency", type: "select" },
        ],
      },
      {
        title: "Other Income",
        description: "Use this for bonuses, side income, dividends, rent, interest or other payments.",
        fields: [
          { label: "Income name", path: "income.otherIncomeName", kind: "text", placeholder: "e.g. Side income or dividends" },
          { label: "Amount", path: "income.otherIncome", step: "100" },
          { label: "Frequency", path: "income.otherIncomeFrequency", type: "select" },
        ],
      },
    ];
    const expenseGroups = [
      {
        title: "Living costs",
        fields: [
          { label: "Expense name", path: "expenses.livingName", kind: "text", placeholder: "Living costs" },
          { label: "Amount", path: "expenses.livingCosts", step: "100" },
          { label: "Frequency", path: "expenses.livingFrequency", type: "select" },
        ],
      },
      {
        title: "Food",
        fields: [
          { label: "Expense name", path: "expenses.foodName", kind: "text", placeholder: "Food" },
          { label: "Amount", path: "expenses.food", step: "10" },
          { label: "Frequency", path: "expenses.foodFrequency", type: "select" },
        ],
      },
      {
        title: "Utilities",
        fields: [
          { label: "Expense name", path: "expenses.utilitiesName", kind: "text", placeholder: "Utilities" },
          { label: "Amount", path: "expenses.utilities", step: "100" },
          { label: "Frequency", path: "expenses.utilitiesFrequency", type: "select" },
        ],
      },
      {
        title: "Insurance",
        fields: [
          { label: "Expense name", path: "expenses.insuranceName", kind: "text", placeholder: "Insurance" },
          { label: "Amount", path: "expenses.insurance", step: "100" },
          { label: "Frequency", path: "expenses.insuranceFrequency", type: "select" },
        ],
      },
      {
        title: "School / children",
        fields: [
          { label: "Expense name", path: "expenses.schoolChildrenName", kind: "text", placeholder: "School / children" },
          { label: "Amount", path: "expenses.schoolChildren", step: "100" },
          { label: "Frequency", path: "expenses.schoolChildrenFrequency", type: "select" },
        ],
      },
      {
        title: "Rates / property costs",
        fields: [
          { label: "Expense name", path: "expenses.ratesPropertyCostsName", kind: "text", placeholder: "Rates / property costs" },
          { label: "Amount", path: "expenses.ratesPropertyCosts", step: "100" },
          { label: "Frequency", path: "expenses.ratesPropertyCostsFrequency", type: "select" },
        ],
      },
      {
        title: "Other expenses",
        fields: [
          { label: "Expense name", path: "expenses.otherExpensesName", kind: "text", placeholder: "Other expenses" },
          { label: "Amount", path: "expenses.otherExpenses", step: "100" },
          { label: "Frequency", path: "expenses.otherFrequency", type: "select" },
        ],
      },
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
    renderForm("assetsForm", assetFields);
    renderForm("liabilitiesForm", liabilityFields);
    renderForm("loanForm", loanFields);
    renderGroupedForm("incomeExpenseForm", [...incomeGroups, ...expenseGroups]);
    renderForm("investingForm", [
      { label: "Annual investing target", path: "investing.annualInvestingTarget", step: "1000" },
      { label: "Expected investment return (%)", path: "investing.expectedInvestmentReturnPct", step: "0.1" },
      { label: "Inflation (%)", path: "investing.inflationPct", step: "0.1" },
      { label: "Safe withdrawal rate (%)", path: "investing.safeWithdrawalRatePct", step: "0.1" },
    ]);
    renderForm("superForm", [
      { label: "Super person 1", path: "assets.superPerson1", step: "1000" },
      { label: "Super person 2", path: "assets.superPerson2", step: "1000" },
      { label: "Employer super contributions", path: "investing.employerSuperContributions", step: "1000" },
      { label: "Extra super contributions", path: "investing.extraSuperContributions", step: "1000" },
      { label: "Expected super return (%)", path: "investing.expectedSuperReturnPct", step: "0.1" },
    ]);
    renderForm("wizardAboutForm", aboutFields);
    renderGroupedForm("wizardIncomeForm", incomeGroups);
    renderForm("wizardAssetsForm", assetFields);
    renderForm("wizardLoansForm", [...loanFields, ...liabilityFields]);
    renderGroupedForm("wizardExpensesForm", expenseGroups);
    renderForm("wizardGoalsForm", goalFields);
    renderForm("wizardDownsizingForm", downsizingFields);
    renderForm("downsizingForm", downsizingFields);
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
        <text class="chart-label" x="12" y="${y(value) + 4}">${compactMoney(value)}</text>
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
    document.getElementById("previewScore").textContent = plainPercent(percent);
    document.getElementById("previewStage").textContent = currentFreedomStage(percent).name;
    document.getElementById("previewNetWorth").textContent = money(result.currentNetWorth);
    document.getElementById("previewWealthRate").textContent = money(result.wealthCreationRate);
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
        text: "Add your annual lifestyle target to calculate the next Financial Freedom stage.",
      };
    }
    const next = freedomStages.find((stage) => stage.min > percent);
    if (!next) {
      return {
        amount: "Financial Freedom",
        text: "Your investments are modelling a strong surplus above annual lifestyle costs.",
      };
    }
    const requiredAssets = result.targetCapital * (next.min / 100);
    const gap = Math.max(0, requiredAssets - result.financialIndependenceAssets);
    const passiveGap = Math.round(gap * safeWithdrawalRate());
    return {
      amount: `${money(gap)} more invested`,
      text: `${money(gap)} more invested to reach ${next.name}. Increase passive income by ${money(passiveGap)} per year.`,
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
    const surplus = passiveIncome - target;
    const milestone = nextMilestone(result, percent);
    const progressWidth = Math.min(100, Math.max(0, percent));

    document.getElementById("dashboardTitle").textContent = names ? `${names}'s Financial Freedom Progress` : "Start a plan or load the demo.";
    document.getElementById("dashboardSubtitle").textContent = isBlankPlan(plan)
      ? "Enter your own details or try the fictional demo to see the dashboard come alive."
      : "See how much of your annual lifestyle is currently funded by investable assets.";
    document.getElementById("heroScore").textContent = plainPercent(percent);
    document.querySelector(".score-ring").style.borderColor = percent >= 100 ? "#bdebd7" : percent >= 75 ? "#f3d08c" : "#dbe4ee";
    document.getElementById("freedomStageLabel").textContent = stage.name;
    document.getElementById("freedomStageText").textContent = stage.explanation;
    document.getElementById("freedomProgressBar").style.width = `${progressWidth}%`;
    document.getElementById("freedomPassiveText").textContent = percent >= 100
      ? "Your investments are projected to cover your lifestyle costs. Work is now optional based on the assumptions used."
      : `Your investments currently fund ${plainPercent(percent)} of your annual lifestyle. You are in the ${stage.name} stage.`;
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

    document.getElementById("secondMetricGrid").innerHTML = [
      metricCard("Current Net Worth", money(result.currentNetWorth)),
      metricCard("Financial Independence Assets", money(result.financialIndependenceAssets)),
      metricCard("Effective Mortgage", money(result.effectiveMortgageBalance)),
      metricCard("Wealth Creation Rate", money(result.wealthCreationRate)),
      metricCard("Annual Passive Income", money(passiveIncome)),
      metricCard("Annual Living Expenses", money(target)),
      metricCard("Annual Investment Surplus / Shortfall", money(surplus), surplus >= 0 ? "status-green" : "status-amber"),
    ].join("");
    document.getElementById("netWorthNote").textContent = result.netWorthProjection.at(-1) ? `Age ${result.netWorthProjection.at(-1).age}: ${money(result.netWorthProjection.at(-1).closingBalance)}` : "";
    lineChart("netWorthChart", [{
      label: "Net worth",
      color: "#2563eb",
      points: [{ x: 0, y: result.currentNetWorth }, ...result.netWorthProjection.map((row) => ({ x: row.year, y: row.closingBalance }))],
    }], { xMarks: [0, 10, 20, 30], xLabel: (mark) => `${mark}y` });
    lineChart("retirementChart", result.retirementSustainability.map((model, index) => ({
      label: model.label,
      color: ["#0f9f6e", "#2563eb", "#d99121"][index],
      points: [60, 70, 80, 90].map((age) => ({ x: age, y: model.balances[age] })),
    })), { xMarks: [60, 70, 80, 90], xLabel: (age) => String(age) });
  }

  function renderCashflow(result) {
    const rows = [
      ["Annual net income", result.annualNetIncome],
      ["Annual expenses", result.annualExpenses],
      ["Mortgage repayments", result.annualMortgageRepayments],
      ["Cash surplus before investing", result.cashSurplusBeforeInvesting],
      ["Investment contributions", result.annualInvestmentContributions],
      ["Cash surplus after investing", result.cashSurplusAfterInvesting],
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
    const taxBenefit = plan.investing.extraSuperContributions * Math.max(0, 0.345 - 0.15);
    document.getElementById("superSummary").innerHTML = `
      <span class="text-sm font-bold text-slate-500">Extra concessional tax benefit estimate</span>
      <strong class="mt-1 block text-2xl font-black text-navy">${money(taxBenefit)}</strong>
      <p class="mt-2 text-sm text-slate-600">Total retirement assets at full retirement: ${money(result.totalRetirementAssets)}</p>
    `;
  }

  function renderMilestones(result) {
    document.getElementById("milestones").innerHTML = result.milestones.map((milestone) => `
      <article class="card status-${milestone.status}">
        <span class="text-sm font-bold text-slate-500">${escapeHtml(milestone.label)}</span>
        <strong class="mt-2 block text-3xl font-black text-navy">Age ${milestone.age || "-"}</strong>
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
      ["5 year net worth", result.netWorthProjection[4]?.closingBalance || 0],
      ["10 year net worth", result.netWorthProjection[9]?.closingBalance || 0],
      ["20 year net worth", result.netWorthProjection[19]?.closingBalance || 0],
      ["30 year net worth", result.netWorthProjection[29]?.closingBalance || 0],
      ["Retirement assets", result.totalRetirementAssets],
      ["Target FI capital", result.targetCapital],
    ];
    document.getElementById("forecastCards").innerHTML = cards.map(([label, value]) => metricCard(label, money(value))).join("");
  }

  function renderDecision(result) {
    document.getElementById("decisionList").innerHTML = result.decisionOptions.map((option, index) => `
      <article class="card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="text-sm font-bold text-success">#${index + 1}</span>
            <h3 class="mt-1 text-xl font-black text-navy">${escapeHtml(option.label)}</h3>
          </div>
          <strong class="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">${percentFromRatio(option.score)}</strong>
        </div>
        <p class="mt-3 text-sm text-slate-600">${escapeHtml(option.explanation)}</p>
      </article>
    `).join("");
  }

  function renderReports(result) {
    document.getElementById("reportSummary").textContent = `Current Financial Freedom Percentage ${plainPercent(freedomPercent(result))}, net worth ${money(result.currentNetWorth)}, wealth creation rate ${money(result.wealthCreationRate)}.`;
  }

  function renderScenarios() {
    const scenarios = loadScenarios();
    document.getElementById("scenarioCount").textContent = `${scenarios.length} saved`;
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

  function renderOutputs() {
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
    document.getElementById("disclaimer").textContent = DATA.disclaimer;
    if (hasOpenedWorkspace) document.getElementById("appWorkspace").classList.remove("hidden");
  }

  function renderAll() {
    renderForms();
    renderOutputs();
  }

  function loadDemo() {
    plan = CALC.clonePlan(DATA.demoPlan);
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

  function bindEvents() {
    document.addEventListener("input", (event) => {
      const target = event.target;
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
      const nav = event.target.closest("[data-view]");
      if (nav) setView(nav.dataset.view);

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

    document.getElementById("demoButton").addEventListener("click", loadDemo);
    document.getElementById("heroDemoButton").addEventListener("click", loadDemo);
    document.getElementById("enterDataButton").addEventListener("click", startMyPlan);
    document.getElementById("heroStartButton").addEventListener("click", startMyPlan);
    document.getElementById("newPlanButton").addEventListener("click", resetPlan);
    document.getElementById("saveScenarioButton").addEventListener("click", () => showWorkspace("scenarios"));
    document.getElementById("saveScenarioPanelButton").addEventListener("click", saveScenario);
    document.getElementById("loadScenarioButton").addEventListener("click", () => showWorkspace("scenarios"));
    document.getElementById("duplicateButton").addEventListener("click", duplicateScenario);
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
