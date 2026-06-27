(function attachCalculator(global) {
  const MONTHS_PER_YEAR = 12;
  const CHECKPOINT_YEARS = [5, 10, 20, 30];
  const STATUS = { GREEN: "green", AMBER: "amber", RED: "red" };

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function nonNegative(value) {
    return Math.max(0, number(value));
  }

  function roundCurrency(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function roundRatio(value) {
    return Math.round((number(value) + Number.EPSILON) * 10000) / 10000;
  }

  function annualRate(percentValue) {
    return number(percentValue) / 100;
  }

  function annualize(amount, frequency) {
    const value = number(amount);
    if (frequency === "weekly") return value * 52;
    if (frequency === "fortnightly") return value * 26;
    if (frequency === "monthly") return value * 12;
    return value;
  }

  function emptyPlan() {
    return {
      personal: {
        person1Name: "",
        person2Name: "",
        person1Age: 0,
        person2Age: 0,
        workOptionalAge: 0,
        semiRetirementAge: 0,
        fullRetirementAge: 0,
        targetAnnualSpending: 0,
      },
      assets: {
        homeValue: 0,
        otherPropertyValue: 0,
        offsetBalance: 0,
        cash: 0,
        sharesEtfs: 0,
        crypto: 0,
        superPerson1: 0,
        superPerson2: 0,
        vehiclesPersonalAssets: 0,
      },
      liabilities: {
        homeLoanBalance: 0,
        homeLoanInterestRatePct: 0,
        monthlyRepayment: 0,
        remainingLoanTermYears: 0,
        hecsHelpDebt: 0,
        otherDebts: 0,
      },
      income: {
        person1Income: 0,
        person1Frequency: "fortnightly",
        person2Income: 0,
        person2Frequency: "fortnightly",
        bonusIncome: 0,
      },
      expenses: {
        livingCosts: 0,
        livingFrequency: "monthly",
        mortgageRepayments: 0,
        food: 0,
        foodFrequency: "weekly",
        utilities: 0,
        insurance: 0,
        schoolChildren: 0,
        ratesPropertyCosts: 0,
        otherExpenses: 0,
        otherFrequency: "monthly",
      },
      investing: {
        annualInvestingTarget: 0,
        employerSuperContributions: 0,
        extraSuperContributions: 0,
        expectedInvestmentReturnPct: 0,
        expectedSuperReturnPct: 0,
        inflationPct: 0,
        safeWithdrawalRatePct: 0,
      },
    };
  }

  function clonePlan(plan) {
    return JSON.parse(JSON.stringify(plan || emptyPlan()));
  }

  function calculateOffsetBenefit({ principal, annualInterestRate, offsetBalance }) {
    const grossLoanBalance = nonNegative(principal);
    const offset = Math.min(nonNegative(offsetBalance), grossLoanBalance);
    const effectiveLoanBalance = roundCurrency(Math.max(grossLoanBalance - offset, 0));
    const annualInterestSaved = roundCurrency(offset * number(annualInterestRate));

    return {
      grossLoanBalance,
      offsetBalance: offset,
      effectiveLoanBalance,
      annualInterestSaved,
      taxFreeEquivalentReturn: offset > 0 ? roundRatio(annualInterestSaved / offset) : 0,
    };
  }

  function amortiseLoan({ principal, annualInterestRate, monthlyRepayment, termYears, offsetBalance = 0 }) {
    const termMonths = Math.max(0, Math.floor(number(termYears) * MONTHS_PER_YEAR));
    const repayment = nonNegative(monthlyRepayment);
    const monthlyRate = number(annualInterestRate) / MONTHS_PER_YEAR;
    const offset = nonNegative(offsetBalance);
    const schedule = [];
    const warnings = [];
    let balance = roundCurrency(nonNegative(principal));

    if (balance === 0 || termMonths === 0) {
      return { schedule, warnings };
    }

    const firstInterest = roundCurrency(Math.max(balance - offset, 0) * monthlyRate);
    if (repayment <= firstInterest) {
      warnings.push({
        code: "REPAYMENT_TOO_LOW",
        message: "Repayment too low: monthly repayment does not cover monthly interest.",
      });
    }

    for (let month = 1; month <= termMonths && balance > 0; month += 1) {
      const openingBalance = balance;
      const effectiveLoanBalance = roundCurrency(Math.max(openingBalance - offset, 0));
      const interestCharged = roundCurrency(effectiveLoanBalance * monthlyRate);
      let principalRepaid = roundCurrency(repayment - interestCharged);
      let actualRepayment = repayment;

      if (principalRepaid > openingBalance) {
        principalRepaid = openingBalance;
        actualRepayment = roundCurrency(interestCharged + principalRepaid);
      }

      balance = roundCurrency(Math.max(0, openingBalance - principalRepaid));
      schedule.push({
        month,
        openingBalance,
        interestCharged,
        principalRepaid,
        repayment: actualRepayment,
        closingBalance: balance,
        grossLoanBalance: openingBalance,
        offsetBalance: offset,
        effectiveLoanBalance,
      });
    }

    if (balance > 0) {
      warnings.push({
        code: "LOAN_NOT_REPAID_WITHIN_TERM",
        message: "Loan balance remains after the entered loan term.",
      });
    }

    return { schedule, warnings };
  }

  function balanceAtMonth(schedule, finalBalance, month) {
    if (month <= 0) return schedule[0]?.openingBalance || finalBalance;
    return schedule[month - 1]?.closingBalance ?? finalBalance;
  }

  function calculateLoanSummary(plan) {
    const principal = nonNegative(plan.liabilities.homeLoanBalance);
    const annualInterestRate = annualRate(plan.liabilities.homeLoanInterestRatePct);
    const monthlyRepayment = nonNegative(plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments);
    const termYears = nonNegative(plan.liabilities.remainingLoanTermYears);
    const offsetBalance = nonNegative(plan.assets.offsetBalance);
    const amortisation = amortiseLoan({ principal, annualInterestRate, monthlyRepayment, termYears, offsetBalance });
    const finalBalance = amortisation.schedule.at(-1)?.closingBalance ?? principal;
    const totalInterestPaid = roundCurrency(amortisation.schedule.reduce((total, row) => total + row.interestCharged, 0));
    const totalPrincipalRepaid = roundCurrency(amortisation.schedule.reduce((total, row) => total + Math.max(0, row.principalRepaid), 0));
    const totalRepayments = roundCurrency(amortisation.schedule.reduce((total, row) => total + row.repayment, 0));
    const monthsToRepay = finalBalance === 0 ? amortisation.schedule.length : null;
    const balanceAtYears = {};
    CHECKPOINT_YEARS.forEach((year) => {
      balanceAtYears[year] = roundCurrency(balanceAtMonth(amortisation.schedule, finalBalance, year * MONTHS_PER_YEAR));
    });

    return {
      schedule: amortisation.schedule,
      warnings: amortisation.warnings,
      offsetBenefit: calculateOffsetBenefit({ principal, annualInterestRate, offsetBalance }),
      payoffMonth: monthsToRepay,
      yearsToRepay: monthsToRepay === null ? null : roundRatio(monthsToRepay / MONTHS_PER_YEAR),
      totalInterestPaid,
      totalPrincipalRepaid,
      totalRepayments,
      finalBalance,
      balanceAtYears,
    };
  }

  function projectBalance({ startingBalance, annualContribution, expectedReturn, years, currentAge, safeWithdrawalRate, extraMonthlyContributions = [] }) {
    const monthlyReturn = number(expectedReturn) / MONTHS_PER_YEAR;
    const rows = [];
    let balance = roundCurrency(nonNegative(startingBalance));

    for (let year = 1; year <= years; year += 1) {
      const openingBalance = balance;
      let contributions = 0;
      let growth = 0;
      for (let month = 1; month <= MONTHS_PER_YEAR; month += 1) {
        const absoluteMonth = (year - 1) * MONTHS_PER_YEAR + month;
        const contribution = nonNegative(annualContribution) / MONTHS_PER_YEAR + nonNegative(extraMonthlyContributions[absoluteMonth - 1]);
        balance = roundCurrency(balance + contribution);
        contributions = roundCurrency(contributions + contribution);
        const monthGrowth = roundCurrency(balance * monthlyReturn);
        balance = roundCurrency(balance + monthGrowth);
        growth = roundCurrency(growth + monthGrowth);
      }
      rows.push({
        year,
        age: nonNegative(currentAge) + year,
        openingBalance,
        annualContribution: contributions,
        investmentGrowth: growth,
        closingBalance: balance,
        passiveIncome: roundCurrency(balance * number(safeWithdrawalRate)),
      });
    }
    return rows;
  }

  function milestoneStatus(projected, required) {
    if (required <= 0) return STATUS.AMBER;
    if (projected >= required) return STATUS.GREEN;
    if (projected >= required * 0.8) return STATUS.AMBER;
    return STATUS.RED;
  }

  function rowAtAge(rows, age) {
    return rows.find((row) => row.age >= age) || rows.at(-1) || { closingBalance: 0, passiveIncome: 0, age };
  }

  function simulateRetirement({ label, startingAge, startingBalance, expectedReturn, inflation, firstYearDraw }) {
    let balance = roundCurrency(nonNegative(startingBalance));
    const balances = { 60: roundCurrency(balance), 70: 0, 80: 0, 90: 0 };
    let moneyLasts = true;
    for (let age = startingAge + 1; age <= 90; age += 1) {
      const draw = roundCurrency(nonNegative(firstYearDraw) * Math.pow(1 + number(inflation), age - startingAge - 1));
      balance = roundCurrency((balance - draw) * (1 + number(expectedReturn)));
      if (balance < 0) {
        moneyLasts = false;
        balance = 0;
      }
      if (age === 70 || age === 80 || age === 90) balances[age] = balance;
    }
    return { label, startingAge, annualIncomeDrawn: roundCurrency(firstYearDraw), moneyLasts, balances };
  }

  function maximumLifestyleDraw(startingBalance, expectedReturn, inflation) {
    const realReturn = ((1 + number(expectedReturn)) / (1 + number(inflation))) - 1;
    const years = 30;
    const targetEndingBalance = nonNegative(startingBalance) * 0.25;
    if (realReturn === 0) return roundCurrency((startingBalance - targetEndingBalance) / years);
    const annuityFactor = (1 - Math.pow(1 + realReturn, -years)) / realReturn;
    const targetPresentValue = targetEndingBalance / Math.pow(1 + realReturn, years);
    return roundCurrency((startingBalance - targetPresentValue) / annuityFactor);
  }

  function rankDecisionOptions({ mortgageRate, expectedInvestmentReturn, expectedSuperReturn, taxRate, liquidityPreference }) {
    const liquidity = liquidityPreference === "high" ? 1 : liquidityPreference === "low" ? 0 : 0.5;
    const options = [
      {
        label: "Extra super",
        score: roundRatio(expectedSuperReturn + Math.max(0, taxRate - 0.15) * 0.35 - liquidity * 0.025),
        explanation: "Potential tax benefit and compounding, but access is restricted until preservation age.",
      },
      {
        label: "Offset account",
        score: roundRatio(mortgageRate + liquidity * 0.01),
        explanation: "Guaranteed interest saving, cash remains accessible, and the benefit is tax-free.",
      },
      {
        label: "ETF/share investing",
        score: roundRatio(expectedInvestmentReturn * (1 - taxRate * 0.5) - 0.01 + liquidity * 0.004),
        explanation: "Higher expected return, but with market volatility and no guarantee.",
      },
      {
        label: "Extra mortgage repayment",
        score: roundRatio(mortgageRate - liquidity * 0.015),
        explanation: "Guaranteed interest saving, but less flexible than keeping funds in offset.",
      },
    ];
    return options.sort((a, b) => b.score - a.score);
  }

  function calculatePlan(planInput) {
    const plan = clonePlan(planInput);
    const loan = calculateLoanSummary(plan);
    const currentAge = nonNegative(plan.personal.person1Age);
    const totalAssets = roundCurrency(
      nonNegative(plan.assets.homeValue)
      + nonNegative(plan.assets.otherPropertyValue)
      + nonNegative(plan.assets.offsetBalance)
      + nonNegative(plan.assets.cash)
      + nonNegative(plan.assets.sharesEtfs)
      + nonNegative(plan.assets.crypto)
      + nonNegative(plan.assets.superPerson1)
      + nonNegative(plan.assets.superPerson2)
      + nonNegative(plan.assets.vehiclesPersonalAssets),
    );
    const totalLiabilities = roundCurrency(nonNegative(plan.liabilities.homeLoanBalance) + nonNegative(plan.liabilities.hecsHelpDebt) + nonNegative(plan.liabilities.otherDebts));
    const currentNetWorth = roundCurrency(totalAssets - totalLiabilities);
    const financialIndependenceAssets = roundCurrency(
      nonNegative(plan.assets.offsetBalance)
      + nonNegative(plan.assets.cash)
      + nonNegative(plan.assets.sharesEtfs)
      + nonNegative(plan.assets.crypto)
      + nonNegative(plan.assets.superPerson1)
      + nonNegative(plan.assets.superPerson2),
    );
    const annualNetIncome = roundCurrency(
      annualize(plan.income.person1Income, plan.income.person1Frequency)
      + annualize(plan.income.person2Income, plan.income.person2Frequency)
      + nonNegative(plan.income.bonusIncome),
    );
    const annualExpenses = roundCurrency(
      annualize(plan.expenses.livingCosts, plan.expenses.livingFrequency)
      + annualize(plan.expenses.food, plan.expenses.foodFrequency)
      + nonNegative(plan.expenses.utilities)
      + nonNegative(plan.expenses.insurance)
      + nonNegative(plan.expenses.schoolChildren)
      + nonNegative(plan.expenses.ratesPropertyCosts)
      + annualize(plan.expenses.otherExpenses, plan.expenses.otherFrequency),
    );
    const annualMortgageRepayments = roundCurrency(nonNegative(plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments) * MONTHS_PER_YEAR);
    const annualInvestmentContributions = roundCurrency(nonNegative(plan.investing.annualInvestingTarget) + nonNegative(plan.investing.extraSuperContributions));
    const cashSurplusBeforeInvesting = roundCurrency(annualNetIncome - annualExpenses - annualMortgageRepayments);
    const cashSurplusAfterInvesting = roundCurrency(cashSurplusBeforeInvesting - annualInvestmentContributions);
    const firstYearMortgagePrincipalReduction = roundCurrency(loan.schedule.slice(0, 12).reduce((total, row) => total + Math.max(0, row.principalRepaid), 0));
    const wealthCreationRate = roundCurrency(
      nonNegative(plan.investing.annualInvestingTarget)
      + nonNegative(plan.investing.employerSuperContributions)
      + nonNegative(plan.investing.extraSuperContributions)
      + firstYearMortgagePrincipalReduction,
    );
    const safeWithdrawalRate = annualRate(plan.investing.safeWithdrawalRatePct);
    const expectedInvestmentReturn = annualRate(plan.investing.expectedInvestmentReturnPct);
    const expectedSuperReturn = annualRate(plan.investing.expectedSuperReturnPct);
    const inflation = annualRate(plan.investing.inflationPct);
    const freedMonthlyRepayments = Array.from({ length: 360 }, (_, monthIndex) => {
      if (!loan.payoffMonth) return 0;
      return monthIndex + 1 > loan.payoffMonth ? nonNegative(plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments) : 0;
    });
    const investmentProjection = projectBalance({
      startingBalance: nonNegative(plan.assets.cash) + nonNegative(plan.assets.sharesEtfs) + nonNegative(plan.assets.crypto),
      annualContribution: plan.investing.annualInvestingTarget,
      expectedReturn: expectedInvestmentReturn,
      years: 30,
      currentAge,
      safeWithdrawalRate,
      extraMonthlyContributions: freedMonthlyRepayments,
    });
    const superProjection = projectBalance({
      startingBalance: nonNegative(plan.assets.superPerson1) + nonNegative(plan.assets.superPerson2),
      annualContribution: nonNegative(plan.investing.employerSuperContributions) + nonNegative(plan.investing.extraSuperContributions),
      expectedReturn: expectedSuperReturn,
      years: 30,
      currentAge,
      safeWithdrawalRate,
    });
    const targetCapital = safeWithdrawalRate > 0 ? nonNegative(plan.personal.targetAnnualSpending) / safeWithdrawalRate : 0;
    const milestones = [
      { label: "Work Optional", age: nonNegative(plan.personal.workOptionalAge), coverage: 0.5 },
      { label: "Semi-Retirement", age: nonNegative(plan.personal.semiRetirementAge), coverage: 0.75 },
      { label: "Full Retirement", age: nonNegative(plan.personal.fullRetirementAge), coverage: 1 },
    ].map((item) => {
      const investment = rowAtAge(investmentProjection, item.age);
      const superRow = rowAtAge(superProjection, item.age);
      const superAccessible = item.age >= 60 ? superRow.closingBalance : 0;
      const projectedFiAssets = roundCurrency(investment.closingBalance + superAccessible);
      const requiredCapital = roundCurrency(targetCapital * item.coverage);
      return {
        ...item,
        projectedFiAssets,
        requiredCapital,
        passiveIncomeEstimate: roundCurrency(projectedFiAssets * safeWithdrawalRate),
        status: milestoneStatus(projectedFiAssets, requiredCapital),
      };
    });
    const fullRetirementAge = nonNegative(plan.personal.fullRetirementAge) || 60;
    const retirementInvestments = rowAtAge(investmentProjection, fullRetirementAge);
    const retirementSuper = rowAtAge(superProjection, fullRetirementAge);
    const totalRetirementAssets = roundCurrency(retirementInvestments.closingBalance + retirementSuper.closingBalance);
    const retirementSustainability = [
      simulateRetirement({
        label: "Capital preserved",
        startingAge: fullRetirementAge,
        startingBalance: totalRetirementAssets,
        expectedReturn: expectedInvestmentReturn,
        inflation,
        firstYearDraw: totalRetirementAssets * safeWithdrawalRate,
      }),
      simulateRetirement({
        label: "Capital slowly declines",
        startingAge: fullRetirementAge,
        startingBalance: totalRetirementAssets,
        expectedReturn: expectedInvestmentReturn,
        inflation,
        firstYearDraw: plan.personal.targetAnnualSpending,
      }),
      simulateRetirement({
        label: "Maximum lifestyle",
        startingAge: fullRetirementAge,
        startingBalance: totalRetirementAssets,
        expectedReturn: expectedInvestmentReturn,
        inflation,
        firstYearDraw: maximumLifestyleDraw(totalRetirementAssets, expectedInvestmentReturn, inflation),
      }),
    ];
    const financialFreedomScore = targetCapital > 0 ? Math.min(100, roundRatio(financialIndependenceAssets / targetCapital * 100)) : 0;
    const netWorthProjection = investmentProjection.map((row, index) => {
      const year = index + 1;
      const homeValue = (nonNegative(plan.assets.homeValue) + nonNegative(plan.assets.otherPropertyValue)) * Math.pow(1 + 0.03, year);
      const loanBalance = balanceAtMonth(loan.schedule, loan.finalBalance, year * MONTHS_PER_YEAR);
      const closingBalance = roundCurrency(homeValue + nonNegative(plan.assets.vehiclesPersonalAssets) + nonNegative(plan.assets.offsetBalance) + row.closingBalance + superProjection[index].closingBalance - loanBalance - nonNegative(plan.liabilities.hecsHelpDebt) - nonNegative(plan.liabilities.otherDebts));
      return { year, age: currentAge + year, closingBalance };
    });

    return {
      plan,
      loan,
      totalAssets,
      totalLiabilities,
      currentNetWorth,
      financialIndependenceAssets,
      effectiveMortgageBalance: loan.offsetBenefit.effectiveLoanBalance,
      annualNetIncome,
      annualExpenses,
      annualMortgageRepayments,
      annualInvestmentContributions,
      cashSurplusBeforeInvesting,
      cashSurplusAfterInvesting,
      firstYearMortgagePrincipalReduction,
      wealthCreationRate,
      financialFreedomScore,
      investmentProjection,
      superProjection,
      milestones,
      retirementSustainability,
      totalRetirementAssets,
      targetCapital,
      decisionOptions: rankDecisionOptions({
        mortgageRate: annualRate(plan.liabilities.homeLoanInterestRatePct),
        expectedInvestmentReturn,
        expectedSuperReturn,
        taxRate: 0.345,
        liquidityPreference: "medium",
      }),
      netWorthProjection,
    };
  }

  global.FFSCalculator = {
    emptyPlan,
    clonePlan,
    annualize,
    amortiseLoan,
    calculateOffsetBenefit,
    calculateLoanSummary,
    calculatePlan,
  };
})(globalThis);
