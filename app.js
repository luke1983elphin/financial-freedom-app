(function bootApp() {
  const STORAGE_KEY = "financial-freedom-simulator-state-v1";
  const frequencies = ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Annually"];
  const assetCategories = [
    "Cash & Savings",
    "Offset Account",
    "Shares / ETFs",
    "Superannuation",
    "Property",
    "Vehicles",
    "Business Interests",
    "Other Assets",
  ];
  const liabilityTypes = [
    "Home Loan",
    "Investment Loan",
    "Vehicle Finance",
    "Personal Loan",
    "Credit Card",
    "BNPL",
    "HECS/HELP",
    "Other Debt",
  ];
  const expenseCategories = [
    "Housing",
    "Food & Groceries",
    "Utilities",
    "Transport",
    "Insurance",
    "Healthcare",
    "Education",
    "Subscriptions",
    "Entertainment",
    "Travel",
    "Debt Repayments",
    "Kids / Family",
    "Pets",
    "Other",
  ];

  const moneyFormatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });

  let state = loadState();
  let saveTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function money(value) {
    return moneyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
  }

  function compactMoney(value) {
    const number = Number.isFinite(Number(value)) ? Number(value) : 0;
    if (Math.abs(number) >= 1000000) return `$${(number / 1000000).toFixed(1)}m`;
    if (Math.abs(number) >= 1000) return `$${Math.round(number / 1000)}k`;
    return money(number);
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function getByPath(object, path) {
    return path.split(".").reduce((cursor, key) => cursor?.[key], object);
  }

  function setByPath(object, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((cursor, key) => {
      if (!cursor[key]) cursor[key] = {};
      return cursor[key];
    }, object);
    target[last] = value;
  }

  function normalizeState(saved) {
    const defaults = FreedomCalculator.defaultState();
    const next = {
      ...defaults,
      ...saved,
      assumptions: { ...defaults.assumptions, ...(saved?.assumptions || {}) },
      opportunities: { ...defaults.opportunities, ...(saved?.opportunities || {}) },
      assets: Array.isArray(saved?.assets) ? saved.assets : defaults.assets,
      debts: Array.isArray(saved?.debts) ? saved.debts : defaults.debts,
      incomes: Array.isArray(saved?.incomes) ? saved.incomes : defaults.incomes,
      expenses: Array.isArray(saved?.expenses) ? saved.expenses : defaults.expenses,
    };

    next.assets = next.assets.map((asset) => ({
      id: asset.id || uid("asset"),
      category: asset.category || "Other Assets",
      name: asset.name || "",
      value: numberValue(asset.value),
      include: asset.include !== false,
    }));
    next.debts = next.debts.map((debt) => ({
      id: debt.id || uid("debt"),
      type: debt.type || "Other Debt",
      description: debt.description || "",
      balance: numberValue(debt.balance),
      interestRatePct: numberValue(debt.interestRatePct),
      termYears: numberValue(debt.termYears),
      repaymentAmount: numberValue(debt.repaymentAmount),
      frequency: debt.frequency || "Monthly",
      extraWeeklyPayment: numberValue(debt.extraWeeklyPayment),
    }));
    next.incomes = next.incomes.map((income) => ({
      id: income.id || uid("income"),
      source: income.source || "",
      description: income.description || "",
      amount: numberValue(income.amount),
      frequency: income.frequency || "Monthly",
    }));
    next.expenses = next.expenses.map((expense) => ({
      id: expense.id || uid("expense"),
      category: expense.category || "Other",
      name: expense.name || "",
      essential: expense.essential !== false,
      amount: numberValue(expense.amount),
      frequency: expense.frequency || "Monthly",
      potentialCutWeekly: numberValue(expense.potentialCutWeekly),
    }));

    return next;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : normalizeState(null);
    } catch {
      return normalizeState(null);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const status = document.getElementById("saveStatus");
    status.textContent = "Saved locally";
  }

  function scheduleSave() {
    const status = document.getElementById("saveStatus");
    status.textContent = "Saving";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 120);
  }

  function options(values, selected) {
    return values
      .map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`)
      .join("");
  }

  function field(label, content, span = "span-3") {
    return `<label class="field ${span}"><span>${escapeHtml(label)}</span>${content}</label>`;
  }

  function input(item, list, prop, type = "number", extra = "") {
    const value = item[prop] ?? "";
    return `<input type="${type}" ${extra} data-list="${list}" data-id="${escapeHtml(item.id)}" data-field="${prop}" value="${escapeHtml(value)}">`;
  }

  function select(item, list, prop, values) {
    return `<select data-list="${list}" data-id="${escapeHtml(item.id)}" data-field="${prop}">${options(values, item[prop])}</select>`;
  }

  function checkbox(item, list, prop, label) {
    return `
      <label class="check-field span-2">
        <input type="checkbox" data-list="${list}" data-id="${escapeHtml(item.id)}" data-field="${prop}" ${item[prop] ? "checked" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function removeButton(list, id) {
    return `<button type="button" class="remove-button span-2" data-remove="${list}" data-id="${escapeHtml(id)}">Remove</button>`;
  }

  function renderAssets() {
    document.getElementById("assetList").innerHTML = state.assets.map((asset) => `
      <div class="item-row">
        ${field("Asset type", select(asset, "assets", "category", assetCategories), "span-3")}
        ${field("Name", input(asset, "assets", "name", "text"), "span-3")}
        ${field("Current value", input(asset, "assets", "value", "number", 'min="0" step="100"'), "span-3")}
        ${checkbox(asset, "assets", "include", "Count in net worth")}
        ${removeButton("assets", asset.id)}
      </div>
    `).join("");
  }

  function renderDebts() {
    document.getElementById("debtList").innerHTML = state.debts.map((debt) => `
      <div class="item-row">
        ${field("Debt type", select(debt, "debts", "type", liabilityTypes), "span-3")}
        ${field("Name", input(debt, "debts", "description", "text"), "span-3")}
        ${field("Balance", input(debt, "debts", "balance", "number", 'min="0" step="100"'), "span-2")}
        ${field("Interest %", input(debt, "debts", "interestRatePct", "number", 'min="0" max="60" step="0.1"'), "span-2")}
        ${field("Repayment", input(debt, "debts", "repaymentAmount", "number", 'min="0" step="10"'), "span-2")}
        ${field("Frequency", select(debt, "debts", "frequency", frequencies), "span-3")}
        ${field("Years left", input(debt, "debts", "termYears", "number", 'min="0" step="0.5"'), "span-2")}
        ${field("Extra weekly payment", input(debt, "debts", "extraWeeklyPayment", "number", 'min="0" step="10"'), "span-3")}
        ${removeButton("debts", debt.id)}
      </div>
    `).join("");
  }

  function renderIncomes() {
    document.getElementById("incomeList").innerHTML = state.incomes.map((income) => `
      <div class="item-row">
        ${field("Source", input(income, "incomes", "source", "text"), "span-3")}
        ${field("Description", input(income, "incomes", "description", "text"), "span-4")}
        ${field("Amount", input(income, "incomes", "amount", "number", 'min="0" step="10"'), "span-2")}
        ${field("Frequency", select(income, "incomes", "frequency", frequencies), "span-3")}
        ${removeButton("incomes", income.id)}
      </div>
    `).join("");
  }

  function renderExpenses() {
    document.getElementById("expenseList").innerHTML = state.expenses.map((expense) => `
      <div class="item-row">
        ${field("Category", select(expense, "expenses", "category", expenseCategories), "span-3")}
        ${field("Name", input(expense, "expenses", "name", "text"), "span-3")}
        ${field("Amount", input(expense, "expenses", "amount", "number", 'min="0" step="10"'), "span-2")}
        ${field("Frequency", select(expense, "expenses", "frequency", frequencies), "span-2")}
        ${field("Could reduce weekly by", input(expense, "expenses", "potentialCutWeekly", "number", 'min="0" step="5"'), "span-2")}
        ${checkbox(expense, "expenses", "essential", "Essential")}
        ${removeButton("expenses", expense.id)}
      </div>
    `).join("");
  }

  function renderLists() {
    renderAssets();
    renderDebts();
    renderIncomes();
    renderExpenses();
  }

  function populateStaticFields() {
    document.querySelectorAll("[data-model]").forEach((element) => {
      const value = getByPath(state, element.dataset.model);
      element.value = value ?? "";
    });
  }

  function setOutput(name, value, toneValue = null) {
    document.querySelectorAll(`[data-output="${name}"]`).forEach((element) => {
      element.textContent = value;
      element.classList.remove("tone-positive", "tone-warning", "tone-negative");
      if (toneValue !== null) {
        if (toneValue > 0) element.classList.add("tone-positive");
        if (toneValue < 0) element.classList.add("tone-negative");
      }
    });
  }

  function renderResults() {
    const result = FreedomCalculator.calculate(state);
    const progress = result.financialFreedomTarget > 0
      ? Math.max(0, Math.min(100, result.currentNetWorth / result.financialFreedomTarget * 100))
      : 0;

    setOutput("currentNetWorth", money(result.currentNetWorth), result.currentNetWorth);
    setOutput("totalAssets", money(result.totalAssets));
    setOutput("totalLiabilities", money(result.totalLiabilities));
    setOutput("weeklyIncome", money(result.weeklyIncome));
    setOutput("weeklyExpenses", money(result.weeklyExpenses));
    setOutput("weeklyDebtRepayments", money(result.weeklyDebtRepayments));
    setOutput("baseWeeklySurplus", money(result.baseWeeklySurplus), result.baseWeeklySurplus);
    setOutput("suggestedWeeklyInvestment", money(result.suggestedWeeklyInvestment));
    setOutput("financialFreedomTarget", money(result.financialFreedomTarget));
    setOutput("projectedPassiveIncome30Years", `${money(result.projectedPassiveIncome30Years)} / year`);
    setOutput("estimatedFreedomAge", result.estimatedFreedomAge ? String(Math.round(result.estimatedFreedomAge)) : "Beyond 30 years");
    setOutput("projection5", money(result.projectionByYear[5]?.closing || 0));
    setOutput("projection10", money(result.projectionByYear[10]?.closing || 0));
    setOutput("projection20", money(result.projectionByYear[20]?.closing || 0));
    setOutput("projection30", money(result.projectionByYear[30]?.closing || 0));
    setOutput(
      "projectionNote",
      result.estimatedFreedomAge
        ? `Target reached around age ${Math.round(result.estimatedFreedomAge)}`
        : "Target not reached within 30 years",
    );

    document.getElementById("freedomMeter").style.width = `${progress}%`;
    renderProjectionChart(result);
    renderOpportunityTable(result.opportunityRows);
    renderDebtTable(result.debtRows);
  }

  function renderProjectionChart(result) {
    const svg = document.getElementById("projectionChart");
    const width = 720;
    const height = 280;
    const margin = { top: 20, right: 28, bottom: 42, left: 66 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const points = [{ year: 0, closing: result.investableAssets }, ...result.projection];
    const maxValue = Math.max(result.financialFreedomTarget, ...points.map((point) => point.closing), 1);
    const niceMax = maxValue * 1.08;
    const x = (year) => margin.left + (year / 30) * chartWidth;
    const y = (value) => margin.top + chartHeight - (Math.max(0, value) / niceMax) * chartHeight;
    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.year).toFixed(1)} ${y(point.closing).toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L ${x(30)} ${margin.top + chartHeight} L ${x(0)} ${margin.top + chartHeight} Z`;
    const targetY = y(result.financialFreedomTarget);
    const gridValues = [0.25, 0.5, 0.75, 1].map((factor) => niceMax * factor);
    const yearMarks = [0, 5, 10, 20, 30];

    svg.innerHTML = `
      ${gridValues.map((value) => `
        <line class="chart-grid" x1="${margin.left}" y1="${y(value).toFixed(1)}" x2="${width - margin.right}" y2="${y(value).toFixed(1)}"></line>
        <text class="chart-label" x="12" y="${(y(value) + 4).toFixed(1)}">${compactMoney(value)}</text>
      `).join("")}
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}"></line>
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}"></line>
      ${yearMarks.map((year) => `
        <text class="chart-label" x="${x(year).toFixed(1)}" y="${height - 12}" text-anchor="middle">${year}y</text>
      `).join("")}
      <path class="chart-area" d="${areaPath}"></path>
      <path class="chart-line" d="${linePath}"></path>
      <line class="chart-target" x1="${margin.left}" y1="${targetY.toFixed(1)}" x2="${width - margin.right}" y2="${targetY.toFixed(1)}"></line>
      <text class="chart-label" x="${width - margin.right}" y="${(targetY - 8).toFixed(1)}" text-anchor="end">Target ${compactMoney(result.financialFreedomTarget)}</text>
    `;
  }

  function renderOpportunityTable(rows) {
    const table = document.getElementById("opportunityTable");
    table.innerHTML = `
      <div class="table-row header"><span>Scenario</span><span>Weekly</span><span>30 year</span></div>
      ${rows.map((row) => `
        <div class="table-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>${money(row.weekly)}</strong>
          <strong>${money(row.thirtyYearValue)}</strong>
        </div>
      `).join("")}
    `;
  }

  function renderDebtTable(rows) {
    const activeRows = rows.filter((row) => row.balance > 0);
    const table = document.getElementById("debtTable");

    if (!activeRows.length) {
      table.innerHTML = '<div class="table-row"><span>No active debts entered</span><strong>$0</strong><strong>-</strong></div>';
      return;
    }

    table.innerHTML = `
      <div class="table-row header"><span>Debt</span><span>Weekly</span><span>Payoff</span></div>
      ${activeRows.map((row) => `
        <div class="table-row">
          <span>${escapeHtml(row.description)}</span>
          <strong>${money(row.weeklyRepayment)}</strong>
          <strong>${row.yearsToRepay > 0 ? `${row.yearsToRepay.toFixed(1)} yrs` : "No payment"}</strong>
        </div>
      `).join("")}
    `;
  }

  function addItem(type) {
    if (type === "asset") {
      state.assets.push({ id: uid("asset"), category: "Other Assets", name: "", value: 0, include: true });
    }
    if (type === "debt") {
      state.debts.push({
        id: uid("debt"),
        type: "Other Debt",
        description: "",
        balance: 0,
        interestRatePct: 0,
        termYears: 0,
        repaymentAmount: 0,
        frequency: "Monthly",
        extraWeeklyPayment: 0,
      });
    }
    if (type === "income") {
      state.incomes.push({ id: uid("income"), source: "", description: "", amount: 0, frequency: "Monthly" });
    }
    if (type === "expense") {
      state.expenses.push({ id: uid("expense"), category: "Other", name: "", essential: true, amount: 0, frequency: "Monthly", potentialCutWeekly: 0 });
    }
    renderLists();
    renderResults();
    scheduleSave();
  }

  function removeItem(list, id) {
    state[list] = state[list].filter((item) => item.id !== id);
    renderLists();
    renderResults();
    scheduleSave();
  }

  function handleFieldChange(element) {
    if (element.dataset.model) {
      setByPath(state, element.dataset.model, numberValue(element.value));
      renderResults();
      scheduleSave();
      return;
    }

    if (!element.dataset.list || !element.dataset.id || !element.dataset.field) return;
    const list = state[element.dataset.list];
    const item = list.find((entry) => entry.id === element.dataset.id);
    if (!item) return;

    if (element.type === "checkbox") {
      item[element.dataset.field] = element.checked;
    } else if (element.type === "number") {
      item[element.dataset.field] = numberValue(element.value);
    } else {
      item[element.dataset.field] = element.value;
    }

    renderResults();
    scheduleSave();
  }

  function setActiveSection(id) {
    document.querySelectorAll("[data-section]").forEach((section) => {
      section.classList.toggle("active", section.id === id);
    });
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.target === id);
    });
  }

  function demoState() {
    const demo = FreedomCalculator.defaultState();
    demo.assumptions = {
      currentAge: 38,
      targetFreedomAge: 55,
      investmentReturnPct: 7,
      cashBuffer: 20000,
      passiveIncomeTarget: 90000,
      withdrawalRatePct: 4,
      extraWeeklyInvestment: 0,
      startingCashBalance: 15000,
    };
    demo.assets = [
      { id: uid("asset"), category: "Cash & Savings", name: "Bank accounts", value: 28000, include: true },
      { id: uid("asset"), category: "Shares / ETFs", name: "Index funds", value: 95000, include: true },
      { id: uid("asset"), category: "Superannuation", name: "Super", value: 185000, include: true },
      { id: uid("asset"), category: "Property", name: "Home", value: 760000, include: true },
      { id: uid("asset"), category: "Vehicles", name: "Car", value: 22000, include: true },
    ];
    demo.debts = [
      { id: uid("debt"), type: "Home Loan", description: "Home loan", balance: 485000, interestRatePct: 6.1, termYears: 24, repaymentAmount: 3180, frequency: "Monthly", extraWeeklyPayment: 0 },
      { id: uid("debt"), type: "Credit Card", description: "Credit card", balance: 3500, interestRatePct: 18, termYears: 1, repaymentAmount: 220, frequency: "Monthly", extraWeeklyPayment: 25 },
    ];
    demo.incomes = [
      { id: uid("income"), source: "Salary", description: "Main take-home pay", amount: 7600, frequency: "Monthly" },
      { id: uid("income"), source: "Partner salary", description: "Second take-home pay", amount: 4300, frequency: "Monthly" },
    ];
    demo.expenses = [
      { id: uid("expense"), category: "Food & Groceries", name: "Groceries", essential: true, amount: 340, frequency: "Weekly", potentialCutWeekly: 30 },
      { id: uid("expense"), category: "Utilities", name: "Utilities and internet", essential: true, amount: 620, frequency: "Quarterly", potentialCutWeekly: 10 },
      { id: uid("expense"), category: "Transport", name: "Fuel and transport", essential: true, amount: 160, frequency: "Weekly", potentialCutWeekly: 15 },
      { id: uid("expense"), category: "Insurance", name: "Insurance", essential: true, amount: 320, frequency: "Monthly", potentialCutWeekly: 0 },
      { id: uid("expense"), category: "Subscriptions", name: "Subscriptions", essential: false, amount: 95, frequency: "Monthly", potentialCutWeekly: 12 },
      { id: uid("expense"), category: "Entertainment", name: "Eating out and entertainment", essential: false, amount: 260, frequency: "Weekly", potentialCutWeekly: 60 },
    ];
    demo.opportunities = {
      plannedWeeklyInvestment: 100,
      payRiseAfterTax: 120,
      sideHustleIncome: 80,
      refinanceSaving: 45,
      otherWeekly: 0,
    };
    return demo;
  }

  function bindEvents() {
    document.addEventListener("input", (event) => handleFieldChange(event.target));
    document.addEventListener("change", (event) => handleFieldChange(event.target));
    document.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add]");
      if (addButton) addItem(addButton.dataset.add);

      const remove = event.target.closest("[data-remove]");
      if (remove) removeItem(remove.dataset.remove, remove.dataset.id);

      const nav = event.target.closest(".nav-item");
      if (nav) setActiveSection(nav.dataset.target);
    });

    document.getElementById("demoButton").addEventListener("click", () => {
      state = demoState();
      renderAll();
      saveState();
    });

    document.getElementById("printButton").addEventListener("click", () => {
      setActiveSection("results");
      window.print();
    });

    document.getElementById("resetButton").addEventListener("click", () => {
      if (!window.confirm("Reset the simulator and clear saved local data?")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = normalizeState(null);
      renderAll();
      saveState();
    });
  }

  function renderAll() {
    populateStaticFields();
    renderLists();
    renderResults();
  }

  renderAll();
  bindEvents();
})();
