(function attachCalculator(global) {
  const FREQUENCY_FACTORS = {
    Weekly: 1,
    Fortnightly: 1 / 2,
    Monthly: 12 / 52,
    Quarterly: 4 / 52,
    Annually: 1 / 52,
  };

  const YEARS = [5, 10, 20, 30];

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function toRate(percent) {
    return toNumber(percent) / 100;
  }

  function weeklyEquivalent(amount, frequency) {
    return toNumber(amount) * (FREQUENCY_FACTORS[frequency] || 0);
  }

  function futureValueAnnuityDue(weeklyAmount, annualRate, years) {
    const payment = Math.max(0, toNumber(weeklyAmount));
    const weeklyRate = annualRate / 52;
    const periods = years * 52;

    if (payment === 0 || periods <= 0) return 0;
    if (weeklyRate === 0) return payment * periods;

    return payment * ((Math.pow(1 + weeklyRate, periods) - 1) / weeklyRate) * (1 + weeklyRate);
  }

  function sumBy(items, selector) {
    return (items || []).reduce((total, item) => total + toNumber(selector(item)), 0);
  }

  function calculateProjection(startingBalance, weeklyContribution, investmentReturn, withdrawalRate, years = 30) {
    const rows = [];
    let opening = Math.max(0, startingBalance);
    const weekly = Math.max(0, weeklyContribution);

    for (let year = 1; year <= years; year += 1) {
      const annualContribution = weekly * 52;
      const growth = (opening + annualContribution / 2) * investmentReturn;
      const closing = opening + annualContribution + growth;
      rows.push({
        year,
        opening,
        weeklyContribution: weekly,
        annualContribution,
        growth,
        closing,
        passiveIncome: closing * withdrawalRate,
      });
      opening = closing;
    }

    return rows;
  }

  function defaultState() {
    return {
      assumptions: {
        currentAge: 35,
        targetFreedomAge: 55,
        investmentReturnPct: 8,
        cashBuffer: 10000,
        passiveIncomeTarget: 80000,
        withdrawalRatePct: 4,
        extraWeeklyInvestment: 0,
        startingCashBalance: 0,
      },
      assets: [
        { id: uid("asset"), category: "Cash & Savings", name: "Bank accounts", value: 0, include: true },
        { id: uid("asset"), category: "Shares / ETFs", name: "Investments", value: 0, include: true },
        { id: uid("asset"), category: "Superannuation", name: "Super", value: 0, include: true },
        { id: uid("asset"), category: "Property", name: "Home or property", value: 0, include: true },
      ],
      debts: [
        {
          id: uid("debt"),
          type: "Home Loan",
          description: "Home loan",
          balance: 0,
          interestRatePct: 6,
          termYears: 25,
          repaymentAmount: 0,
          frequency: "Monthly",
          extraWeeklyPayment: 0,
        },
      ],
      incomes: [
        { id: uid("income"), source: "Salary", description: "Main income", amount: 0, frequency: "Monthly" },
      ],
      expenses: [
        { id: uid("expense"), category: "Housing", name: "Rent, rates or body corporate", essential: true, amount: 0, frequency: "Monthly", potentialCutWeekly: 0 },
        { id: uid("expense"), category: "Food & Groceries", name: "Groceries", essential: true, amount: 0, frequency: "Weekly", potentialCutWeekly: 0 },
        { id: uid("expense"), category: "Utilities", name: "Power, water, internet", essential: true, amount: 0, frequency: "Monthly", potentialCutWeekly: 0 },
        { id: uid("expense"), category: "Transport", name: "Fuel, public transport, parking", essential: true, amount: 0, frequency: "Weekly", potentialCutWeekly: 0 },
        { id: uid("expense"), category: "Subscriptions", name: "Subscriptions", essential: false, amount: 0, frequency: "Monthly", potentialCutWeekly: 0 },
      ],
      opportunities: {
        plannedWeeklyInvestment: 0,
        payRiseAfterTax: 0,
        sideHustleIncome: 0,
        refinanceSaving: 0,
        otherWeekly: 0,
      },
    };
  }

  function calculate(state) {
    const assumptions = state.assumptions || defaultState().assumptions;
    const investmentReturn = toRate(assumptions.investmentReturnPct);
    const withdrawalRate = toRate(assumptions.withdrawalRatePct);

    const totalAssets = sumBy(state.assets, (asset) => asset.include ? asset.value : 0);
    const investableAssets = sumBy(state.assets, (asset) => {
      return ["Shares / ETFs", "Superannuation"].includes(asset.category) ? asset.value : 0;
    });
    const totalLiabilities = sumBy(state.debts, (debt) => debt.balance);
    const weeklyDebtRepayments = sumBy(state.debts, (debt) => weeklyEquivalent(debt.repaymentAmount, debt.frequency));
    const weeklyIncome = sumBy(state.incomes, (income) => weeklyEquivalent(income.amount, income.frequency));
    const weeklyExpenses = sumBy(state.expenses, (expense) => weeklyEquivalent(expense.amount, expense.frequency));
    const potentialWeeklyExpenseCuts = sumBy(state.expenses, (expense) => expense.potentialCutWeekly);
    const opportunities = state.opportunities || {};
    const opportunityRows = [
      { label: "Expense cuts identified", weekly: potentialWeeklyExpenseCuts },
      { label: "Planned extra investing", weekly: opportunities.plannedWeeklyInvestment },
      { label: "Pay rise after tax", weekly: opportunities.payRiseAfterTax },
      { label: "Side income", weekly: opportunities.sideHustleIncome },
      { label: "Loan refinance saving", weekly: opportunities.refinanceSaving },
      { label: "Other opportunity", weekly: opportunities.otherWeekly },
    ].map((item) => ({
      ...item,
      annual: toNumber(item.weekly) * 52,
      tenYearValue: futureValueAnnuityDue(item.weekly, investmentReturn, 10),
      thirtyYearValue: futureValueAnnuityDue(item.weekly, investmentReturn, 30),
    }));

    const baseWeeklySurplus = weeklyIncome - weeklyExpenses - weeklyDebtRepayments;
    const potentialWeeklyImprovements = sumBy(opportunityRows, (item) => item.weekly);
    const suggestedWeeklyInvestment = Math.max(
      0,
      baseWeeklySurplus + potentialWeeklyImprovements + toNumber(assumptions.extraWeeklyInvestment),
    );
    const financialFreedomTarget = withdrawalRate > 0
      ? toNumber(assumptions.passiveIncomeTarget) / withdrawalRate
      : 0;

    const projection = calculateProjection(
      investableAssets,
      suggestedWeeklyInvestment,
      investmentReturn,
      withdrawalRate,
      30,
    );

    const projectionByYear = YEARS.reduce((map, year) => {
      map[year] = projection[year - 1] || null;
      return map;
    }, {});

    const freedomRow = financialFreedomTarget > 0
      ? projection.find((row) => row.closing >= financialFreedomTarget)
      : null;
    const debtRows = (state.debts || []).map((debt) => {
      const weeklyRepayment = weeklyEquivalent(debt.repaymentAmount, debt.frequency);
      const weeklyInterest = toNumber(debt.balance) * toRate(debt.interestRatePct) / 52;
      const effectivePayment = weeklyRepayment + toNumber(debt.extraWeeklyPayment);
      const principalPerWeek = Math.max(0, effectivePayment - weeklyInterest);
      const weeksToRepay = principalPerWeek > 0 ? toNumber(debt.balance) / principalPerWeek : 0;
      const yearsToRepay = weeksToRepay / 52;
      const totalPaid = weeksToRepay > 0 ? effectivePayment * weeksToRepay : 0;

      return {
        id: debt.id,
        description: debt.description || debt.type || "Debt",
        balance: toNumber(debt.balance),
        weeklyRepayment,
        weeklyInterest,
        principalPerWeek,
        yearsToRepay,
        estimatedInterest: Math.max(0, totalPaid - toNumber(debt.balance)),
      };
    });

    return {
      totalAssets,
      investableAssets,
      totalLiabilities,
      currentNetWorth: totalAssets - totalLiabilities,
      weeklyIncome,
      weeklyExpenses,
      weeklyDebtRepayments,
      baseWeeklySurplus,
      potentialWeeklyExpenseCuts,
      potentialWeeklyImprovements,
      suggestedWeeklyInvestment,
      financialFreedomTarget,
      projectedPassiveIncome30Years: projectionByYear[30]?.passiveIncome || 0,
      estimatedFreedomAge: freedomRow ? toNumber(assumptions.currentAge) + freedomRow.year : null,
      targetFreedomAge: toNumber(assumptions.targetFreedomAge),
      projection,
      projectionByYear,
      opportunityRows,
      debtRows,
    };
  }

  global.FreedomCalculator = {
    defaultState,
    calculate,
    futureValueAnnuityDue,
    weeklyEquivalent,
    toNumber,
  };
})(globalThis);
