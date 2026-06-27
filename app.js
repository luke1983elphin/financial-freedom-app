(function renderV2App() {
  const data = window.FFS_V2;
  if (!data) {
    document.body.innerHTML = "<p>Dashboard data could not be loaded.</p>";
    return;
  }

  const { sampleHousehold: sample, dashboard, disclaimer } = data;
  const moneyFormatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
  const numberFormatter = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

  function money(value) {
    return moneyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
  }

  function compactMoney(value) {
    const number = Number.isFinite(Number(value)) ? Number(value) : 0;
    if (Math.abs(number) >= 1000000) return `$${(number / 1000000).toFixed(1)}m`;
    if (Math.abs(number) >= 1000) return `$${Math.round(number / 1000)}k`;
    return money(number);
  }

  function percent(value, digits = 1) {
    return `${((Number(value) || 0) * 100).toFixed(digits)}%`;
  }

  function scorePercent(value) {
    return `${Math.round(Number(value) || 0)}%`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function byAge(projection, age) {
    return projection.find((row) => row.age >= age) || projection[projection.length - 1];
  }

  function byYear(projection, year) {
    return projection.find((row) => row.year === year) || projection[projection.length - 1];
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function renderMetricGrid() {
    const metrics = [
      ["Current net worth", money(dashboard.currentNetWorth)],
      ["FI assets", money(dashboard.financialIndependenceAssets)],
      ["Effective mortgage", money(dashboard.effectiveMortgageBalance)],
      ["Annual net income", money(dashboard.annualNetIncome)],
      ["Annual expenses", money(dashboard.annualExpenses)],
      ["Annual surplus", money(dashboard.annualCashSurplus)],
      ["Wealth creation rate", money(dashboard.wealthCreationRate)],
      ["Retirement assets at 60", money(dashboard.totalRetirementAssets)],
    ];

    document.getElementById("metricGrid").innerHTML = metrics.map(([label, value]) => `
      <article class="metric-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `).join("");
  }

  function lineChart(svgId, series, options = {}) {
    const svg = document.getElementById(svgId);
    const width = 760;
    const height = options.height || 300;
    const margin = { top: 22, right: 28, bottom: 42, left: 76 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const points = series.flatMap((item) => item.points);
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
      ${xMarks.map((mark) => `
        <text class="chart-label" x="${x(mark)}" y="${height - 12}" text-anchor="middle">${options.xLabel ? options.xLabel(mark) : mark}</text>
      `).join("")}
      ${series.map((item) => {
        const path = item.points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)}`).join(" ");
        return `<path class="chart-line" style="stroke:${item.color}" d="${path}"></path>`;
      }).join("")}
      ${series.map((item, index) => `
        <circle cx="${width - 170}" cy="${24 + index * 20}" r="5" fill="${item.color}"></circle>
        <text class="chart-label" x="${width - 158}" y="${28 + index * 20}">${escapeHtml(item.label)}</text>
      `).join("")}
    `;
  }

  function renderLoan() {
    const loan = dashboard.loanSummaries[0];
    const warning = loan.warnings.find((item) => item.code === "REPAYMENT_TOO_LOW");
    const checkpointRows = [5, 10, 20, 30].map((year) => `
      <div><span>Balance at ${year} years</span><strong>${money(loan.balanceAtYears[year])}</strong></div>
    `).join("");

    document.getElementById("loanSummary").innerHTML = `
      <div><span>Gross loan balance</span><strong>${money(loan.offsetBenefit.grossLoanBalance)}</strong></div>
      <div><span>Offset balance</span><strong>${money(loan.offsetBenefit.offsetBalance)}</strong></div>
      <div><span>Effective loan balance</span><strong>${money(loan.offsetBenefit.effectiveLoanBalance)}</strong></div>
      <div><span>Annual interest saved</span><strong>${money(loan.offsetBenefit.annualInterestSaved)}</strong></div>
      <div><span>Tax-free equivalent return</span><strong>${percent(loan.offsetBenefit.taxFreeEquivalentReturn)}</strong></div>
      <div><span>Estimated payoff date</span><strong>${loan.payoffDate || "Beyond term"}</strong></div>
      <div><span>Years to repay</span><strong>${loan.yearsToRepay ? loan.yearsToRepay.toFixed(1) : "Not repaid"}</strong></div>
      <div><span>Total interest paid</span><strong>${money(loan.totalInterestPaid)}</strong></div>
      <div><span>Total principal repaid</span><strong>${money(loan.totalPrincipalRepaid)}</strong></div>
      ${warning ? `<div class="warning-row"><span>Status</span><strong>${escapeHtml(warning.message)}</strong></div>` : ""}
      ${checkpointRows}
    `;

    const loanPoints = [0, 5, 10, 15, 20, 25, 30].map((year) => ({
      x: year,
      y: year === 0 ? loan.offsetBenefit.grossLoanBalance : loan.schedule[Math.min(loan.schedule.length - 1, year * 12 - 1)]?.closingBalance ?? loan.finalBalance,
    }));
    lineChart("loanChart", [{ label: "Loan balance", color: "#c9563d", points: loanPoints }], {
      height: 240,
      xMarks: [0, 10, 20, 30],
      xLabel: (mark) => `${mark}y`,
    });
  }

  function renderCashflow() {
    const rows = [
      ["Annual net income", dashboard.cashflow.annualNetIncome],
      ["Annual expenses", dashboard.cashflow.annualExpenses],
      ["Mortgage repayments", dashboard.cashflow.annualMortgageRepayments],
      ["Cash surplus before investing", dashboard.cashflow.cashSurplusBeforeInvesting],
      ["Investment contributions", dashboard.cashflow.annualInvestmentContributions],
      ["Employer super", dashboard.cashflow.annualEmployerSuper],
      ["Extra super", dashboard.cashflow.annualExtraSuper],
      ["Cash surplus after investing", dashboard.cashflow.cashSurplusAfterInvesting],
    ];

    document.getElementById("cashflowTable").innerHTML = rows.map(([label, value]) => `
      <div class="table-row">
        <span>${escapeHtml(label)}</span>
        <strong>${money(value)}</strong>
      </div>
    `).join("");
  }

  function renderInvestmentAndSuper() {
    const investmentYears = [5, 10, 20, 30];
    document.getElementById("investmentCards").innerHTML = investmentYears.map((year) => {
      const row = byYear(dashboard.investmentProjection, year);
      return `<div><span>${year} years</span><strong>${money(row.closingBalance)}</strong><small>${money(row.passiveIncome)} pa passive</small></div>`;
    }).join("");

    lineChart("investmentChart", [{
      label: "Non-super investments",
      color: "#0f766e",
      points: [
        {
          x: 0,
          y: sample.assets
            .filter((asset) => asset.category === "shares" || asset.category === "crypto")
            .reduce((total, asset) => total + asset.value, 0),
        },
        ...dashboard.investmentProjection.map((row) => ({ x: row.year, y: row.closingBalance })),
      ],
    }], {
      height: 240,
      xMarks: [0, 10, 20, 30],
      xLabel: (mark) => `${mark}y`,
    });

    const superAges = [50, 55, 60, 65];
    document.getElementById("superCards").innerHTML = superAges.map((age) => {
      const row = byAge(dashboard.superProjection, age);
      return `<div><span>Age ${age}</span><strong>${money(row.closingBalance)}</strong><small>${money(row.passiveIncome)} pa at 4%</small></div>`;
    }).join("");
    document.getElementById("superSummary").innerHTML = `
      <span>Extra concessional tax benefit estimate</span>
      <strong>${money(dashboard.taxBenefitFromExtraSuper)}</strong>
      <p>Total retirement assets at age ${sample.assumptions.retirementAge}: ${money(dashboard.totalRetirementAssets)}</p>
    `;
  }

  function renderMilestones() {
    document.getElementById("milestones").innerHTML = dashboard.milestones.map((milestone) => `
      <article class="milestone ${milestone.status}">
        <span>${escapeHtml(milestone.name)}</span>
        <strong>Age ${milestone.targetAge}</strong>
        <dl>
          <div><dt>Projected FI assets</dt><dd>${money(milestone.projectedFiAssets)}</dd></div>
          <div><dt>Required capital</dt><dd>${money(milestone.requiredCapital)}</dd></div>
          <div><dt>Passive income</dt><dd>${money(milestone.passiveIncomeEstimate)}</dd></div>
        </dl>
        <b>${milestone.status.toUpperCase()}</b>
      </article>
    `).join("");
  }

  function renderRetirement() {
    const colors = ["#0f766e", "#315d89", "#b7791f"];
    lineChart("retirementChart", dashboard.retirementSustainability.map((model, index) => ({
      label: model.model,
      color: colors[index],
      points: [60, 70, 80, 90].map((age) => ({ x: age, y: model.balances[age] })),
    })), {
      xMarks: [60, 70, 80, 90],
      xLabel: (age) => String(age),
    });

    document.getElementById("retirementTable").innerHTML = dashboard.retirementSustainability.map((model) => `
      <div class="retirement-row">
        <span>${escapeHtml(model.model)}</span>
        <strong>${money(model.annualIncomeDrawn)} pa</strong>
        <small>${model.moneyLasts ? "Money lasts to age 90" : "Runs out before age 90"}</small>
      </div>
    `).join("");
  }

  function renderDecisionEngine() {
    document.getElementById("decisionList").innerHTML = dashboard.decisionOptions.map((option, index) => `
      <article>
        <span>#${index + 1}</span>
        <strong>${escapeHtml(option.option)}</strong>
        <b>${percent(option.score)}</b>
        <p>${escapeHtml(option.explanation)}</p>
      </article>
    `).join("");
  }

  function renderSampleInputs() {
    const incomes = sample.incomes.map((income) => `${income.name}: ${money(income.amount)} ${income.frequency}`).join("<br>");
    const expenses = sample.expenses.map((expense) => `${expense.name}: ${money(expense.amount)} ${expense.frequency}`).join("<br>");
    document.getElementById("sampleInputs").innerHTML = `
      <div><span>People</span><strong>${sample.people.map((person) => `${person.name}, ${person.age}`).join(" and ")}</strong></div>
      <div><span>Goals</span><strong>Optional ${sample.goals.workOptionalAge}, semi ${sample.goals.semiRetirementAge}, full ${sample.goals.fullRetirementAge}</strong></div>
      <div><span>Target spending</span><strong>${money(sample.goals.targetAnnualSpending)} pa</strong></div>
      <div><span>Income</span><strong>${incomes}</strong></div>
      <div><span>Expenses</span><strong>${expenses}</strong></div>
      <div><span>Assumptions</span><strong>${percent(sample.assumptions.expectedInvestmentReturn)} return, ${percent(sample.assumptions.safeWithdrawalRate)} withdrawal rate, ${percent(sample.assumptions.inflation)} inflation</strong></div>
    `;
  }

  function init() {
    const people = sample.people.map((person) => `${person.name} (${person.age})`).join(" and ");
    setText("householdSummary", `${sample.householdName}: ${people}. Fictional sample data only.`);
    setText("financialFreedomScore", scorePercent(dashboard.financialFreedomScore));
    document.getElementById("scoreMeter").style.width = `${Math.min(100, dashboard.financialFreedomScore)}%`;
    setText("headlineMetric", `${money(dashboard.wealthCreationRate)} annual wealth creation rate`);
    setText("headlineDetail", `Includes investing, employer super, extra super and the first-year mortgage principal reduction.`);
    setText("netWorthChartNote", `Projected age ${dashboard.netWorthProjection.at(-1).age}: ${money(dashboard.netWorthProjection.at(-1).closingBalance)}`);
    setText("disclaimer", disclaimer);

    renderMetricGrid();
    lineChart("netWorthChart", [{
      label: "Net worth",
      color: "#315d89",
      points: [
        { x: 0, y: dashboard.currentNetWorth },
        ...dashboard.netWorthProjection.map((row) => ({ x: row.year, y: row.closingBalance })),
      ],
    }], {
      xMarks: [0, 10, 20, 30],
      xLabel: (mark) => `${mark}y`,
    });
    renderDecisionEngine();
    renderLoan();
    renderCashflow();
    renderInvestmentAndSuper();
    renderMilestones();
    renderRetirement();
    renderSampleInputs();

    document.getElementById("printButton").addEventListener("click", () => window.print());
  }

  init();
})();
