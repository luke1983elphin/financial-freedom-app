(function attachCalculator(global) {
  const MONTHS_PER_YEAR = 12;
  const CHECKPOINT_YEARS = [5, 10, 20, 30];
  const SUPER_ACCESS_AGE = 60;
  const SUPER_CONTRIBUTIONS_TAX_RATE = 0.15;
  const MEDICARE_LEVY_RATE = 0.02;
  const TAX_YEAR = "2026-27";
  const HELP_THRESHOLD = 69528;
  const TAX_BRACKETS_2026_27 = [
    { threshold: 0, rate: 0 },
    { threshold: 18200, rate: 0.15 },
    { threshold: 45000, rate: 0.30 },
    { threshold: 135000, rate: 0.37 },
    { threshold: 190000, rate: 0.45 },
  ];
  const HELP_REPAYMENT_BRACKETS_2026_27 = [
    { threshold: 69528, upper: 129717, baseRepayment: 0, marginalRate: 0.15 },
    { threshold: 129717, upper: 186050, baseRepayment: 9028.5, marginalRate: 0.17 },
    { threshold: 186050, totalIncomeRate: 0.10 },
  ];
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

  function netConcessionalSuperContribution(value) {
    return roundCurrency(nonNegative(value) * (1 - SUPER_CONTRIBUTIONS_TAX_RATE));
  }

  function taxBeforeMedicare(taxableIncome) {
    const income = nonNegative(taxableIncome);
    return roundCurrency(TAX_BRACKETS_2026_27.reduce((tax, bracket, index) => {
      const next = TAX_BRACKETS_2026_27[index + 1]?.threshold ?? Infinity;
      const taxableInBand = Math.max(0, Math.min(income, next) - bracket.threshold);
      return tax + taxableInBand * bracket.rate;
    }, 0));
  }

  function individualTaxEstimate(taxableIncome, includeMedicare = true) {
    const income = nonNegative(taxableIncome);
    const baseTax = taxBeforeMedicare(income);
    const medicareLevy = includeMedicare ? roundCurrency(income * MEDICARE_LEVY_RATE) : 0;
    return roundCurrency(baseTax + medicareLevy);
  }

  function individualTaxBreakdown(taxableIncome) {
    const income = nonNegative(taxableIncome);
    const incomeTax = taxBeforeMedicare(income);
    const medicareLevy = roundCurrency(income * MEDICARE_LEVY_RATE);
    return {
      incomeTax,
      medicareLevy,
      totalTax: roundCurrency(incomeTax + medicareLevy),
    };
  }

  function marginalTaxRate(taxableIncome, includeMedicare = true) {
    const income = nonNegative(taxableIncome);
    const bracket = [...TAX_BRACKETS_2026_27].reverse().find((item) => income > item.threshold) || TAX_BRACKETS_2026_27[0];
    return roundRatio(bracket.rate + (includeMedicare ? MEDICARE_LEVY_RATE : 0));
  }

  function splitAdditionalContribution(amount, person1Income, person2Income) {
    const gross = nonNegative(amount);
    const p1Capacity = nonNegative(person1Income);
    const p2Capacity = nonNegative(person2Income);
    const totalCapacity = p1Capacity + p2Capacity;
    if (gross === 0 || totalCapacity === 0) return { person1: 0, person2: 0 };
    const person1 = roundCurrency(Math.min(p1Capacity, gross * (p1Capacity / totalCapacity)));
    const person2 = roundCurrency(Math.min(p2Capacity, gross - person1));
    return { person1, person2 };
  }

  function estimateHelpRepayment(repaymentIncome, balance) {
    const income = nonNegative(repaymentIncome);
    const currentBalance = nonNegative(balance);
    let calculatedRepayment = 0;
    let marginalRate = 0;

    if (income > HELP_REPAYMENT_BRACKETS_2026_27[2].threshold) {
      calculatedRepayment = income * HELP_REPAYMENT_BRACKETS_2026_27[2].totalIncomeRate;
      marginalRate = HELP_REPAYMENT_BRACKETS_2026_27[2].totalIncomeRate;
    } else if (income > HELP_REPAYMENT_BRACKETS_2026_27[1].threshold) {
      const band = HELP_REPAYMENT_BRACKETS_2026_27[1];
      calculatedRepayment = band.baseRepayment + (income - band.threshold) * band.marginalRate;
      marginalRate = band.marginalRate;
    } else if (income > HELP_THRESHOLD) {
      const band = HELP_REPAYMENT_BRACKETS_2026_27[0];
      calculatedRepayment = band.baseRepayment + (income - band.threshold) * band.marginalRate;
      marginalRate = band.marginalRate;
    }

    const annualRepayment = roundCurrency(Math.min(currentBalance, Math.max(0, calculatedRepayment)));
    const effectiveRate = income > 0 ? roundRatio(annualRepayment / income) : 0;
    return {
      balance: currentBalance,
      repaymentIncome: income,
      rate: effectiveRate,
      marginalRate,
      annualRepayment,
      monthlyRepayment: roundCurrency(annualRepayment / MONTHS_PER_YEAR),
      estimatedYearsToRepay: annualRepayment > 0 ? roundRatio(currentBalance / annualRepayment) : null,
      note: "Estimate only. HELP repayments use repayment income, marginal 2026-27 rates and are capped at the current balance.",
    };
  }

  function calculateHelpRepaymentIncome({ person1Income, person2Income, otherIncome, extraConcessionalSuper }) {
    const sharedOtherIncome = nonNegative(otherIncome) / 2;
    const person1Before = roundCurrency(nonNegative(person1Income) + sharedOtherIncome);
    const person2Before = roundCurrency(nonNegative(person2Income) + sharedOtherIncome);
    const split = splitAdditionalContribution(extraConcessionalSuper, person1Before, person2Before);
    const person1TaxableAfter = roundCurrency(Math.max(0, person1Before - split.person1));
    const person2TaxableAfter = roundCurrency(Math.max(0, person2Before - split.person2));
    const person1RepaymentIncome = roundCurrency(person1TaxableAfter + split.person1);
    const person2RepaymentIncome = roundCurrency(person2TaxableAfter + split.person2);
    return {
      person1RepaymentIncome,
      person2RepaymentIncome,
      estimatedRepaymentIncome: roundCurrency(Math.max(person1RepaymentIncome, person2RepaymentIncome)),
      note: "Concessional contributions are added back for this simple HELP repayment-income estimate where applicable.",
    };
  }

  function annualize(amount, frequency) {
    const value = number(amount);
    if (frequency === "weekly") return value * 52;
    if (frequency === "fortnightly") return value * 26;
    if (frequency === "monthly") return value * 12;
    if (frequency === "quarterly") return value * 4;
    return value;
  }

  function annualRecurringExpenses(plan) {
    return annualExpenseBreakdown(plan).total;
  }

  function annualExpenseBreakdown(plan) {
    const coreCategories = new Set(["living", "food", "utilities", "insurance", "schoolChildren", "ratesPropertyCosts"]);
    if (Array.isArray(plan.expenseItems) && plan.expenseItems.length) {
      return plan.expenseItems.reduce((breakdown, item) => {
        const amount = annualize(item.amount, item.frequency);
        if (coreCategories.has(item.category)) {
          breakdown.living = roundCurrency(breakdown.living + amount);
        } else {
          breakdown.otherRegular = roundCurrency(breakdown.otherRegular + amount);
        }
        breakdown.total = roundCurrency(breakdown.living + breakdown.otherRegular);
        return breakdown;
      }, { living: 0, otherRegular: 0, total: 0 });
    }
    const living = roundCurrency(
      annualize(plan.expenses.livingCosts, plan.expenses.livingFrequency)
      + annualize(plan.expenses.food, plan.expenses.foodFrequency)
      + annualize(plan.expenses.utilities, plan.expenses.utilitiesFrequency)
      + annualize(plan.expenses.insurance, plan.expenses.insuranceFrequency)
      + annualize(plan.expenses.schoolChildren, plan.expenses.schoolChildrenFrequency)
      + annualize(plan.expenses.ratesPropertyCosts, plan.expenses.ratesPropertyCostsFrequency)
    );
    const otherRegular = roundCurrency(annualize(plan.expenses.otherExpenses, plan.expenses.otherFrequency));
    return { living, otherRegular, total: roundCurrency(living + otherRegular) };
  }

  function emptyPlan() {
    return {
      personal: {
        person1Name: "",
        person2Name: "",
        person1Age: 0,
        person2Age: 0,
        workOptionalAge: 50,
        semiRetirementAge: 55,
        fullRetirementAge: 60,
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
        creditCardBalance: 0,
        creditCardInterestRatePct: 19.99,
        creditCardMonthlyRepayment: 0,
        creditCardLimit: 0,
      },
      income: {
        person1IncomeName: "",
        person1Income: 0,
        person1Frequency: "fortnightly",
        person2IncomeName: "",
        person2Income: 0,
        person2Frequency: "fortnightly",
        otherIncomeName: "",
        otherIncome: 0,
        otherIncomeFrequency: "annually",
      },
      expenses: {
        livingName: "",
        livingCosts: 0,
        livingFrequency: "monthly",
        mortgageRepayments: 0,
        foodName: "",
        food: 0,
        foodFrequency: "weekly",
        utilitiesName: "",
        utilities: 0,
        utilitiesFrequency: "annually",
        insuranceName: "",
        insurance: 0,
        insuranceFrequency: "annually",
        schoolChildrenName: "",
        schoolChildren: 0,
        schoolChildrenFrequency: "annually",
        ratesPropertyCostsName: "",
        ratesPropertyCosts: 0,
        ratesPropertyCostsFrequency: "annually",
        otherExpensesName: "",
        otherExpenses: 0,
        otherFrequency: "monthly",
      },
      investing: {
        annualInvestingTarget: 0,
        employerSuperContributions: 0,
        extraSuperContributions: 0,
        expectedInvestmentReturnPct: 7,
        expectedSuperReturnPct: 6.5,
        inflationPct: 2.5,
        wageGrowthPct: 3,
        safeWithdrawalRatePct: 4,
      },
      downsizing: {
        enabled: false,
        currentResidenceValue: 0,
        futurePropertyValue: 0,
        sellingCosts: 0,
        buyingCosts: 0,
        releasedForInvestment: 0,
      },
    };
  }

  function clonePlan(plan) {
    const base = emptyPlan();
    const source = JSON.parse(JSON.stringify(plan || {}));
    const merged = {
      ...base,
      ...source,
      personal: { ...base.personal, ...(source.personal || {}) },
      assets: { ...base.assets, ...(source.assets || {}) },
      liabilities: { ...base.liabilities, ...(source.liabilities || {}) },
      income: { ...base.income, ...(source.income || {}) },
      expenses: { ...base.expenses, ...(source.expenses || {}) },
      investing: { ...base.investing, ...(source.investing || {}) },
      downsizing: { ...base.downsizing, ...(source.downsizing || {}) },
    };
    if (source.income && source.income.bonusIncome && !source.income.otherIncome) {
      merged.income.otherIncome = source.income.bonusIncome;
      merged.income.otherIncomeFrequency = "annually";
      merged.income.otherIncomeName = source.income.otherIncomeName || "Other Income";
    }
    return merged;
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

  function downsizingInvestmentBoost(plan) {
    const strategy = plan.downsizing || {};
    if (!strategy.enabled) return 0;
    const manualRelease = nonNegative(strategy.releasedForInvestment);
    if (manualRelease > 0) return manualRelease;
    return roundCurrency(Math.max(
      0,
      nonNegative(strategy.currentResidenceValue)
        - nonNegative(strategy.futurePropertyValue)
        - nonNegative(strategy.sellingCosts)
        - nonNegative(strategy.buyingCosts),
    ));
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

  function householdTaxEstimate({ person1Income, person2Income, otherIncome, extraConcessionalSuper }) {
    const sharedOtherIncome = nonNegative(otherIncome) / 2;
    const person1TaxableBefore = roundCurrency(nonNegative(person1Income) + sharedOtherIncome);
    const person2TaxableBefore = roundCurrency(nonNegative(person2Income) + sharedOtherIncome);
    const split = splitAdditionalContribution(extraConcessionalSuper, person1TaxableBefore, person2TaxableBefore);
    const person1TaxableAfter = roundCurrency(Math.max(0, person1TaxableBefore - split.person1));
    const person2TaxableAfter = roundCurrency(Math.max(0, person2TaxableBefore - split.person2));
    const person1TaxBefore = individualTaxBreakdown(person1TaxableBefore);
    const person2TaxBefore = individualTaxBreakdown(person2TaxableBefore);
    const person1TaxAfter = individualTaxBreakdown(person1TaxableAfter);
    const person2TaxAfter = individualTaxBreakdown(person2TaxableAfter);
    const totalTaxBefore = roundCurrency(person1TaxBefore.totalTax + person2TaxBefore.totalTax);
    const totalTaxAfter = roundCurrency(person1TaxAfter.totalTax + person2TaxAfter.totalTax);
    const incomeTax = roundCurrency(person1TaxAfter.incomeTax + person2TaxAfter.incomeTax);
    const medicareLevy = roundCurrency(person1TaxAfter.medicareLevy + person2TaxAfter.medicareLevy);
    const grossContribution = nonNegative(extraConcessionalSuper);
    const contributionsTax = roundCurrency(grossContribution * SUPER_CONTRIBUTIONS_TAX_RATE);
    const netInvested = roundCurrency(grossContribution - contributionsTax);
    const personalTaxSaving = roundCurrency(Math.max(0, totalTaxBefore - totalTaxAfter));
    const afterTaxCashflowCost = roundCurrency(Math.max(0, grossContribution - personalTaxSaving));
    const marginalRate = Math.max(marginalTaxRate(person1TaxableBefore), marginalTaxRate(person2TaxableBefore));
    return {
      taxYear: TAX_YEAR,
      person1TaxableBefore,
      person2TaxableBefore,
      person1TaxableAfter,
      person2TaxableAfter,
      taxableIncomeBeforeExtraSuper: roundCurrency(person1TaxableBefore + person2TaxableBefore),
      taxableIncomeAfterExtraSuper: roundCurrency(person1TaxableAfter + person2TaxableAfter),
      totalTaxBefore,
      totalTaxAfter,
      totalTax: totalTaxAfter,
      incomeTax,
      medicareLevy,
      marginalTaxRate: marginalRate,
      medicareLevyRate: MEDICARE_LEVY_RATE,
      extraSuper: {
        grossContribution,
        estimatedPersonalTaxSaving: personalTaxSaving,
        contributionsTax,
        netAmountInvested: netInvested,
        afterTaxCashflowCost,
      },
    };
  }

  function rankDecisionOptions({ mortgageRate, expectedInvestmentReturn, expectedSuperReturn, taxRate, liquidityPreference }) {
    const liquidity = liquidityPreference === "high" ? 1 : liquidityPreference === "low" ? 0 : 0.5;
    const superTaxSavingRate = Math.max(0, number(taxRate) - SUPER_CONTRIBUTIONS_TAX_RATE);
    const etfAfterTaxReturn = Math.max(0, number(expectedInvestmentReturn) * (1 - number(taxRate) * 0.5));
    const options = [
      {
        label: "Extra super",
        score: roundRatio(number(expectedSuperReturn) + superTaxSavingRate * 0.35 - liquidity * 0.025),
        afterTaxBenefit: roundRatio(number(expectedSuperReturn) + superTaxSavingRate),
        cashflowImpact: roundRatio(1 - superTaxSavingRate),
        taxSaving: roundRatio(superTaxSavingRate),
        explanation: "May reduce personal tax now and invest the net amount in super after 15% contributions tax. Access is from age 60 in this model.",
      },
      {
        label: "Offset account",
        score: roundRatio(mortgageRate + liquidity * 0.01),
        afterTaxBenefit: roundRatio(mortgageRate),
        cashflowImpact: 1,
        taxSaving: 0,
        explanation: "Saves mortgage interest, remains accessible, and the interest saving is not taxed.",
      },
      {
        label: "ETF/share investing",
        score: roundRatio(etfAfterTaxReturn - 0.01 + liquidity * 0.004),
        afterTaxBenefit: roundRatio(etfAfterTaxReturn),
        cashflowImpact: 1,
        taxSaving: 0,
        explanation: "Keeps money accessible and uses the expected return after a simple marginal-tax adjustment.",
      },
      {
        label: "Extra mortgage repayment",
        score: roundRatio(mortgageRate - liquidity * 0.015),
        afterTaxBenefit: roundRatio(mortgageRate),
        cashflowImpact: 1,
        taxSaving: 0,
        explanation: "Saves mortgage interest, but the money is less flexible than keeping it in offset.",
      },
    ];
    return options.sort((a, b) => b.score - a.score);
  }

  function calculatePlan(planInput) {
    const plan = clonePlan(planInput);
    const loan = calculateLoanSummary(plan);
    const currentAge = nonNegative(plan.personal.person1Age);
    const downsizingBoost = downsizingInvestmentBoost(plan);
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
    const creditCardBalance = nonNegative(plan.liabilities.creditCardBalance);
    const totalLiabilities = roundCurrency(
      nonNegative(plan.liabilities.homeLoanBalance)
      + nonNegative(plan.liabilities.hecsHelpDebt)
      + nonNegative(plan.liabilities.otherDebts)
      + creditCardBalance,
    );
    const currentNetWorth = roundCurrency(totalAssets - totalLiabilities);
    const superannuationBalance = roundCurrency(
      nonNegative(plan.assets.superPerson1)
      + nonNegative(plan.assets.superPerson2),
    );
    const accessibleInvestmentAssets = roundCurrency(
      nonNegative(plan.assets.offsetBalance)
      + nonNegative(plan.assets.cash)
      + nonNegative(plan.assets.sharesEtfs)
      + nonNegative(plan.assets.crypto)
      + downsizingBoost,
    );
    const investmentBalance = roundCurrency(
      nonNegative(plan.assets.cash)
      + nonNegative(plan.assets.sharesEtfs)
      + nonNegative(plan.assets.crypto)
      + downsizingBoost,
    );
    const superAccessibleToday = currentAge >= SUPER_ACCESS_AGE ? superannuationBalance : 0;
    const financialIndependenceAssets = roundCurrency(accessibleInvestmentAssets + superAccessibleToday);
    const person1AnnualIncome = roundCurrency(annualize(plan.income.person1Income, plan.income.person1Frequency));
    const person2AnnualIncome = roundCurrency(annualize(plan.income.person2Income, plan.income.person2Frequency));
    const otherAnnualIncome = roundCurrency(annualize(plan.income.otherIncome, plan.income.otherIncomeFrequency));
    const annualGrossIncome = roundCurrency(person1AnnualIncome + person2AnnualIncome + otherAnnualIncome);
    const taxEstimate = householdTaxEstimate({
      person1Income: person1AnnualIncome,
      person2Income: person2AnnualIncome,
      otherIncome: otherAnnualIncome,
      extraConcessionalSuper: plan.investing.extraSuperContributions,
    });
    const helpRepaymentIncome = calculateHelpRepaymentIncome({
      person1Income: person1AnnualIncome,
      person2Income: person2AnnualIncome,
      otherIncome: otherAnnualIncome,
      extraConcessionalSuper: plan.investing.extraSuperContributions,
    });
    const helpRepaymentEstimate = estimateHelpRepayment(helpRepaymentIncome.estimatedRepaymentIncome, plan.liabilities.hecsHelpDebt);
    const expenseBreakdown = annualExpenseBreakdown(plan);
    const annualCoreLivingExpenses = expenseBreakdown.living;
    const annualOtherRegularExpenses = expenseBreakdown.otherRegular;
    const annualExpenses = expenseBreakdown.total;
    const annualLivingExpenses = annualExpenses;
    const annualMortgageRepayments = roundCurrency(nonNegative(plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments) * MONTHS_PER_YEAR);
    const annualCreditCardRepayments = roundCurrency(nonNegative(plan.liabilities.creditCardMonthlyRepayment) * MONTHS_PER_YEAR);
    const annualDebtRepayments = roundCurrency(annualMortgageRepayments + annualCreditCardRepayments);
    const estimatedTaxAndHelp = roundCurrency(taxEstimate.totalTax + helpRepaymentEstimate.annualRepayment);
    const netIncomeAfterTaxHelp = roundCurrency(annualGrossIncome - taxEstimate.incomeTax - taxEstimate.medicareLevy - helpRepaymentEstimate.annualRepayment);
    const annualInvestmentContributions = roundCurrency(nonNegative(plan.investing.annualInvestingTarget));
    const annualExtraSuperContributions = roundCurrency(nonNegative(plan.investing.extraSuperContributions));
    const cashSurplusBeforeInvesting = roundCurrency(netIncomeAfterTaxHelp - annualCoreLivingExpenses - annualDebtRepayments - annualOtherRegularExpenses);
    const cashSurplusAfterInvesting = roundCurrency(cashSurplusBeforeInvesting - annualInvestmentContributions - annualExtraSuperContributions);
    const finalProjectedCashSurplus = cashSurplusAfterInvesting;
    const cashSurplusAfterTaxHelpAndInvesting = finalProjectedCashSurplus;
    const firstYearMortgagePrincipalReduction = roundCurrency(loan.schedule.slice(0, 12).reduce((total, row) => total + Math.max(0, row.principalRepaid), 0));
    const grossEmployerSuperContributions = nonNegative(plan.investing.employerSuperContributions);
    const grossExtraSuperContributions = nonNegative(plan.investing.extraSuperContributions);
    const grossConcessionalSuperContributions = roundCurrency(grossEmployerSuperContributions + grossExtraSuperContributions);
    const netEmployerSuperContributions = netConcessionalSuperContribution(grossEmployerSuperContributions);
    const netExtraSuperContributions = netConcessionalSuperContribution(grossExtraSuperContributions);
    const netConcessionalSuperContributions = roundCurrency(netEmployerSuperContributions + netExtraSuperContributions);
    const superContributionsTaxPaid = roundCurrency(grossConcessionalSuperContributions - netConcessionalSuperContributions);
    const wealthCreationRate = roundCurrency(
      nonNegative(plan.investing.annualInvestingTarget)
      + netEmployerSuperContributions
      + netExtraSuperContributions
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
      startingBalance: nonNegative(plan.assets.cash) + nonNegative(plan.assets.sharesEtfs) + nonNegative(plan.assets.crypto) + downsizingBoost,
      annualContribution: plan.investing.annualInvestingTarget,
      expectedReturn: expectedInvestmentReturn,
      years: 30,
      currentAge,
      safeWithdrawalRate,
      extraMonthlyContributions: freedMonthlyRepayments,
    });
    const superProjection = projectBalance({
      startingBalance: superannuationBalance,
      annualContribution: netConcessionalSuperContributions,
      expectedReturn: expectedSuperReturn,
      years: 30,
      currentAge,
      safeWithdrawalRate,
    });
    const targetCapital = safeWithdrawalRate > 0 ? nonNegative(plan.personal.targetAnnualSpending) / safeWithdrawalRate : 0;
    const milestones = [
      {
        label: "Building Wealth",
        description: "Your investments are beginning to benefit from compounding and are creating long-term momentum.",
        age: nonNegative(plan.personal.workOptionalAge),
        coverage: 0.5,
      },
      {
        label: "Financial Independence",
        description: "Your investments are projected to cover a significant portion of your future lifestyle costs.",
        age: nonNegative(plan.personal.semiRetirementAge),
        coverage: 0.75,
      },
      {
        label: "Financial Freedom",
        description: "Your investments are projected to fully support your chosen lifestyle over the long term.",
        age: nonNegative(plan.personal.fullRetirementAge),
        coverage: 1,
      },
    ].map((item) => {
      const investment = rowAtAge(investmentProjection, item.age);
      const superRow = rowAtAge(superProjection, item.age);
      const superAccessible = item.age >= SUPER_ACCESS_AGE ? superRow.closingBalance : 0;
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
    const sustainabilityStartAge = Math.max(fullRetirementAge, SUPER_ACCESS_AGE);
    const retirementInvestments = rowAtAge(investmentProjection, sustainabilityStartAge);
    const retirementSuper = rowAtAge(superProjection, sustainabilityStartAge);
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
      const residenceValue = plan.downsizing?.enabled && nonNegative(plan.downsizing.futurePropertyValue) > 0
        ? nonNegative(plan.downsizing.futurePropertyValue)
        : nonNegative(plan.assets.homeValue);
      const homeValue = (residenceValue + nonNegative(plan.assets.otherPropertyValue)) * Math.pow(1 + 0.03, year);
      const loanBalance = balanceAtMonth(loan.schedule, loan.finalBalance, year * MONTHS_PER_YEAR);
      const closingBalance = roundCurrency(homeValue + nonNegative(plan.assets.vehiclesPersonalAssets) + nonNegative(plan.assets.offsetBalance) + row.closingBalance + superProjection[index].closingBalance - loanBalance - nonNegative(plan.liabilities.hecsHelpDebt) - nonNegative(plan.liabilities.otherDebts) - creditCardBalance);
      return { year, age: currentAge + year, closingBalance };
    });
    const financialFreedomProgressProjection = investmentProjection.map((row, index) => {
      const superAccessible = row.age >= SUPER_ACCESS_AGE ? superProjection[index].closingBalance : 0;
      const projectedAssets = roundCurrency(row.closingBalance + nonNegative(plan.assets.offsetBalance) + superAccessible);
      return {
        year: row.year,
        age: row.age,
        progress: targetCapital > 0 ? Math.min(200, roundRatio(projectedAssets / targetCapital * 100)) : 0,
      };
    });

    return {
      plan,
      loan,
      totalAssets,
      totalLiabilities,
      currentNetWorth,
      investmentBalance,
      accessibleInvestmentAssets,
      superannuationBalance,
      superAccessibleToday,
      superAccessAge: SUPER_ACCESS_AGE,
      financialIndependenceAssets,
      effectiveMortgageBalance: loan.offsetBenefit.effectiveLoanBalance,
      annualGrossIncome,
      annualNetIncome: annualGrossIncome,
      person1AnnualIncome,
      person2AnnualIncome,
      otherAnnualIncome,
      annualExpenses,
      annualLivingExpenses,
      annualCoreLivingExpenses,
      annualOtherRegularExpenses,
      annualMortgageRepayments,
      annualCreditCardRepayments,
      annualDebtRepayments,
      annualInvestmentContributions,
      annualExtraSuperContributions,
      netIncomeAfterTaxHelp,
      cashSurplusBeforeInvesting,
      cashSurplusAfterInvesting,
      finalProjectedCashSurplus,
      estimatedTaxAndHelp,
      cashSurplusAfterTaxHelpAndInvesting,
      firstYearMortgagePrincipalReduction,
      wealthCreationRate,
      grossConcessionalSuperContributions,
      netConcessionalSuperContributions,
      netEmployerSuperContributions,
      netExtraSuperContributions,
      superContributionsTaxPaid,
      superContributionsTaxRate: SUPER_CONTRIBUTIONS_TAX_RATE,
      taxEstimate,
      helpRepaymentEstimate,
      helpRepaymentIncome,
      financialFreedomScore,
      investmentProjection,
      superProjection,
      milestones,
      retirementSustainability,
      totalRetirementAssets,
      sustainabilityStartAge,
      targetCapital,
      downsizingInvestmentBoost: downsizingBoost,
      decisionOptions: rankDecisionOptions({
        mortgageRate: annualRate(plan.liabilities.homeLoanInterestRatePct),
        expectedInvestmentReturn,
        expectedSuperReturn,
        taxRate: taxEstimate.marginalTaxRate,
        liquidityPreference: "medium",
      }),
      netWorthProjection,
      financialFreedomProgressProjection,
    };
  }

  global.FFSCalculator = {
    emptyPlan,
    clonePlan,
    annualize,
    annualRecurringExpenses,
    individualTaxEstimate,
    marginalTaxRate,
    estimateHelpRepayment,
    calculateHelpRepaymentIncome,
    amortiseLoan,
    calculateOffsetBenefit,
    calculateLoanSummary,
    calculatePlan,
  };
})(globalThis);
