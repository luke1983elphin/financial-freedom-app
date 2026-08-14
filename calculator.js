(function attachCalculator(global) {
  const CALCULATION_VERSION = "2026.27.1";
  const FINANCIAL_YEAR = "2026-27";
  const MONTHS_PER_YEAR = 12;
  const CHECKPOINT_YEARS = [5, 10, 20, 30];
  const SUPER_ACCESS_AGE = 60;
  const SUPER_CONTRIBUTIONS_TAX_RATE = 0.15;
  const DAYS_PER_YEAR = 365;
  const DEFAULT_TAX_YEAR = FINANCIAL_YEAR;
  const DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE = 0.03;
  const DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE = 0.03;
  const FINANCIAL_YEAR_CONFIGS = {
    "2026-27": {
      taxYear: "2026-27",
      employerSuperRate: 0.12,
      employerSuperMaximumContributionBase: 270830,
      concessionalSuperCap: 32500,
      medicareLevyRate: 0.02,
      taxBrackets: [
        { threshold: 0, rate: 0 },
        { threshold: 18200, rate: 0.15 },
        { threshold: 45000, rate: 0.30 },
        { threshold: 135000, rate: 0.37 },
        { threshold: 190000, rate: 0.45 },
      ],
      stsl: {
        threshold: 69528,
        brackets: [
          { threshold: 69528, upper: 129717, baseRepayment: 0, marginalRate: 0.15 },
          { threshold: 129717, upper: 186050, baseRepayment: 9028, marginalRate: 0.17 },
          { threshold: 186050, totalIncomeRate: 0.10 },
        ],
      },
      medicareLevySurcharge: {
        single: [105000, 123000, 164000],
        family: [210000, 246000, 328000],
        dependentChildIncrement: 1500,
        individualLowIncomeSpouseThreshold: 27222,
        rates: [0, 0.01, 0.0125, 0.015],
      },
    },
  };
  const TAX_YEAR = DEFAULT_TAX_YEAR;
  const ACTIVE_CONFIG = FINANCIAL_YEAR_CONFIGS[TAX_YEAR];
  const EMPLOYER_SUPER_RATE = ACTIVE_CONFIG.employerSuperRate;
  const EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE = ACTIVE_CONFIG.employerSuperMaximumContributionBase;
  const CONCESSIONAL_SUPER_CAP = ACTIVE_CONFIG.concessionalSuperCap;
  const MEDICARE_LEVY_RATE = ACTIVE_CONFIG.medicareLevyRate;
  const HELP_THRESHOLD = ACTIVE_CONFIG.stsl.threshold;
  const MLS_THRESHOLDS_2026_27 = ACTIVE_CONFIG.medicareLevySurcharge;
  const TAX_BRACKETS_2026_27 = ACTIVE_CONFIG.taxBrackets;
  const HELP_REPAYMENT_BRACKETS_2026_27 = ACTIVE_CONFIG.stsl.brackets;
  const STATUS = { GREEN: "green", AMBER: "amber", RED: "red" };
  const INVESTMENT_PROPERTY_ASSET_CATEGORIES = [
    "otherProperty",
    "rentalInvestmentProperty",
    "rentalProperty",
    "investmentProperty",
    "residentialInvestmentProperty",
    "commercialInvestmentProperty",
    "incomeProducingProperty",
  ];

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

  function calculateLITO(taxableIncome) {
    const income = nonNegative(taxableIncome);
    if (income <= 37500) return 700;
    if (income <= 45000) return roundCurrency(Math.max(0, 700 - (income - 37500) * 0.05));
    if (income <= 66667) return roundCurrency(Math.max(0, 325 - (income - 45000) * 0.015));
    return 0;
  }

  function individualTaxEstimate(taxableIncome, includeMedicare = true) {
    const breakdown = individualTaxBreakdown(taxableIncome);
    return roundCurrency(breakdown.incomeTax + (includeMedicare ? breakdown.medicareLevy : 0));
  }

  function individualTaxBreakdown(taxableIncome) {
    const income = nonNegative(taxableIncome);
    const incomeTaxBeforeOffsets = taxBeforeMedicare(income);
    const lito = roundCurrency(Math.min(calculateLITO(income), incomeTaxBeforeOffsets));
    const incomeTax = roundCurrency(Math.max(0, incomeTaxBeforeOffsets - lito));
    const medicareLevy = roundCurrency(income * MEDICARE_LEVY_RATE);
    return {
      incomeTaxBeforeOffsets,
      lito,
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

  function estimateStudyLoanRepayment(repaymentIncome, balance, hasDebt = true) {
    const income = nonNegative(repaymentIncome);
    const currentBalance = nonNegative(balance);
    if (!hasDebt) {
      return {
        balance: currentBalance,
        repaymentIncome: income,
        rate: 0,
        marginalRate: 0,
        annualRepayment: 0,
        monthlyRepayment: 0,
        estimatedYearsToRepay: null,
        balanceKnown: currentBalance > 0,
        note: "Estimate only. No STSL compulsory repayment is modelled because no Study and Training Support Loan debt is selected.",
      };
    }
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

    const uncappedRepayment = Math.max(0, calculatedRepayment);
    const annualRepayment = roundCurrency(hasDebt && currentBalance > 0 ? Math.min(currentBalance, uncappedRepayment) : 0);
    const projectedClosingBalance = roundCurrency(Math.max(0, currentBalance - annualRepayment));
    const effectiveRate = income > 0 ? roundRatio(annualRepayment / income) : 0;
    return {
      openingBalance: currentBalance,
      balance: currentBalance,
      repaymentIncome: income,
      rate: effectiveRate,
      marginalRate,
      annualRepayment,
      monthlyRepayment: roundCurrency(annualRepayment / MONTHS_PER_YEAR),
      projectedClosingBalance,
      estimatedYearsToRepay: annualRepayment > 0 ? roundRatio(currentBalance / annualRepayment) : null,
      balanceKnown: currentBalance > 0,
      note: "Estimate only. STSL compulsory repayments use repayment income, marginal 2026-27 rates and are capped at the current balance when a balance is entered.",
    };
  }

  function estimateHelpRepayment(repaymentIncome, balance) {
    return estimateStudyLoanRepayment(repaymentIncome, balance, nonNegative(balance) > 0);
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
      note: "Concessional contributions are added back for this simple STSL repayment-income estimate where applicable.",
    };
  }

  function booleanWithLegacy(value, legacyValue, fallback = false) {
    if (value !== undefined && value !== null) return Boolean(value);
    if (legacyValue !== undefined && legacyValue !== null) return Boolean(legacyValue);
    return Boolean(fallback);
  }

  function hospitalCoverDays(status, days) {
    if (status === "full-year") return DAYS_PER_YEAR;
    if (status === "no-cover") return 0;
    if (status === "partial-year") return Math.max(0, Math.min(DAYS_PER_YEAR, number(days)));
    return null;
  }

  function hasValue(value) {
    return value !== undefined && value !== null && value !== "";
  }

  function calculatePersonSTSLRepaymentIncome({
    taxableIncomeBeforeFHSSAdjustments,
    reportableFringeBenefits,
    reportableEmployerSuperContributions,
    personalDeductibleSuperContributions,
    totalNetInvestmentLosses,
    exemptForeignEmploymentIncome,
  } = {}) {
    return roundCurrency(
      nonNegative(taxableIncomeBeforeFHSSAdjustments)
      + nonNegative(reportableFringeBenefits)
      + nonNegative(reportableEmployerSuperContributions)
      + nonNegative(personalDeductibleSuperContributions)
      + nonNegative(totalNetInvestmentLosses)
      + nonNegative(exemptForeignEmploymentIncome),
    );
  }

  function calculatePersonMLSIncomeForThreshold({
    taxableIncome,
    reportableFringeBenefits,
    reportableEmployerSuperContributions,
    totalNetInvestmentLosses,
    familyTrustDistributionTax,
    otherMLSAdjustments,
  } = {}) {
    return roundCurrency(
      nonNegative(taxableIncome)
      + nonNegative(reportableFringeBenefits)
      + nonNegative(reportableEmployerSuperContributions)
      + nonNegative(totalNetInvestmentLosses)
      + nonNegative(familyTrustDistributionTax)
      + nonNegative(otherMLSAdjustments),
    );
  }

  function calculatePersonMLSSurchargeBase({ taxableIncome, explicitSurchargeBase } = {}) {
    return roundCurrency(hasValue(explicitSurchargeBase) ? nonNegative(explicitSurchargeBase) : nonNegative(taxableIncome));
  }

  function calculateMedicareLevySurcharge({
    person1TaxableIncome,
    person2TaxableIncome,
    person1MLSIncomeForThreshold,
    person2MLSIncomeForThreshold,
    person1MLSSurchargeBase,
    person2MLSSurchargeBase,
    person1CoverStatus,
    person2CoverStatus,
    dependantsHospitalCoverStatus,
    person1CoveredDays,
    person2CoveredDays,
    dependantsCoveredDays,
    dependants,
    hasPartner,
    spouseForFullYear,
  }) {
    const p1Taxable = nonNegative(person1TaxableIncome);
    const p2Taxable = nonNegative(person2TaxableIncome);
    const p1ThresholdIncome = hasValue(person1MLSIncomeForThreshold) ? nonNegative(person1MLSIncomeForThreshold) : p1Taxable;
    const p2ThresholdIncome = hasValue(person2MLSIncomeForThreshold) ? nonNegative(person2MLSIncomeForThreshold) : p2Taxable;
    const p1Base = calculatePersonMLSSurchargeBase({ taxableIncome: p1Taxable, explicitSurchargeBase: person1MLSSurchargeBase });
    const p2Base = calculatePersonMLSSurchargeBase({ taxableIncome: p2Taxable, explicitSurchargeBase: person2MLSSurchargeBase });
    const childCount = Math.max(0, Math.round(nonNegative(dependants)));
    const family = Boolean(hasPartner || p2ThresholdIncome > 0 || childCount > 0);
    const spouseFullYear = Boolean(hasPartner) && spouseForFullYear !== false;
    const householdIncome = roundCurrency(p1ThresholdIncome + p2ThresholdIncome);
    const childIncrement = family ? Math.max(0, childCount - 1) * MLS_THRESHOLDS_2026_27.dependentChildIncrement : 0;
    const thresholds = (family ? MLS_THRESHOLDS_2026_27.family : MLS_THRESHOLDS_2026_27.single).map((value) => value + childIncrement);
    const tier = householdIncome > thresholds[2] ? 3
      : householdIncome > thresholds[1] ? 2
        : householdIncome > thresholds[0] ? 1
          : 0;
    const rate = MLS_THRESHOLDS_2026_27.rates[tier] || 0;
    const p1Days = hospitalCoverDays(person1CoverStatus, person1CoveredDays);
    const p2Days = family && hasPartner ? hospitalCoverDays(person2CoverStatus, person2CoveredDays) : DAYS_PER_YEAR;
    const dependantsDays = family && childCount > 0 ? hospitalCoverDays(dependantsHospitalCoverStatus, dependantsCoveredDays) : DAYS_PER_YEAR;
    const requiredCoverInputs = [p1Days, p2Days, dependantsDays];
    const incomplete = rate > 0 && requiredCoverInputs.some((value) => value === null);
    if (incomplete) {
      return {
        taxYear: TAX_YEAR,
        status: "incomplete",
        cannotConfirm: true,
        family,
        householdIncome,
        person1MLSIncomeForThreshold: roundCurrency(p1ThresholdIncome),
        person2MLSIncomeForThreshold: roundCurrency(p2ThresholdIncome),
        person1MLSSurchargeBase: roundCurrency(p1Base),
        person2MLSSurchargeBase: roundCurrency(p2Base),
        thresholds,
        tier,
        rate,
        person1Surcharge: null,
        person2Surcharge: null,
        annualSurcharge: null,
        uncoveredFraction: null,
        note: "MLS not included - complete private hospital cover information.",
      };
    }
    const wholeFamilyCoveredDays = Math.min(p1Days ?? 0, p2Days ?? DAYS_PER_YEAR, dependantsDays ?? DAYS_PER_YEAR);
    const uncoveredFraction = rate > 0 ? Math.max(0, DAYS_PER_YEAR - wholeFamilyCoveredDays) / DAYS_PER_YEAR : 0;
    const lowIncomeSpouseThreshold = nonNegative(MLS_THRESHOLDS_2026_27.individualLowIncomeSpouseThreshold);
    const person1LowIncomeSpouseExempt = Boolean(family && hasPartner && spouseFullYear && p1ThresholdIncome <= lowIncomeSpouseThreshold);
    const person2LowIncomeSpouseExempt = Boolean(family && hasPartner && spouseFullYear && p2ThresholdIncome <= lowIncomeSpouseThreshold);
    const person1Surcharge = person1LowIncomeSpouseExempt ? 0 : roundCurrency(p1Base * rate * uncoveredFraction);
    const person2Surcharge = person2LowIncomeSpouseExempt ? 0 : roundCurrency((family && hasPartner ? p2Base : 0) * rate * uncoveredFraction);
    const hasPartYearCover = person1CoverStatus === "partial-year"
      || person2CoverStatus === "partial-year"
      || dependantsHospitalCoverStatus === "partial-year";
    const partYearOverlapNote = "Part-year MLS estimates assume the entered family members' covered days overlap unless actual coverage dates are collected.";
    return {
      taxYear: TAX_YEAR,
      status: "complete",
      family,
      spouseForFullYear: spouseFullYear,
      householdIncome,
      person1MLSIncomeForThreshold: roundCurrency(p1ThresholdIncome),
      person2MLSIncomeForThreshold: roundCurrency(p2ThresholdIncome),
      person1MLSSurchargeBase: roundCurrency(p1Base),
      person2MLSSurchargeBase: roundCurrency(p2Base),
      individualLowIncomeSpouseThreshold: lowIncomeSpouseThreshold,
      person1LowIncomeSpouseExempt,
      person2LowIncomeSpouseExempt,
      thresholds,
      tier,
      rate,
      person1Surcharge,
      person2Surcharge,
      annualSurcharge: roundCurrency(person1Surcharge + person2Surcharge),
      cannotConfirm: incomplete,
      uncoveredFraction: roundRatio(uncoveredFraction),
      partYearOverlapAssumption: hasPartYearCover ? partYearOverlapNote : "",
      note: [
        "Estimated using eligible private patient hospital cover status, household income and 2026-27 thresholds.",
        hasPartYearCover ? partYearOverlapNote : "",
      ].filter(Boolean).join(" "),
    };
  }

  function calculatePayrollEstimate({
    person1Income,
    person2Income,
    extraConcessionalSuper,
    helpDebt,
    person1HelpDebt,
    person2HelpDebt,
    person1SalarySacrifice,
    person2SalarySacrifice,
    person1PayrollDeductions,
    person2PayrollDeductions,
    person1HasStslDebt,
    person2HasStslDebt,
    person1HasHelpDebt,
    person2HasHelpDebt,
    person1StslRepaymentIncome,
    person2StslRepaymentIncome,
  }) {
    const gross1 = nonNegative(person1Income);
    const gross2 = nonNegative(person2Income);
    const explicitSacrifice1 = nonNegative(person1SalarySacrifice);
    const explicitSacrifice2 = nonNegative(person2SalarySacrifice);
    const split = explicitSacrifice1 || explicitSacrifice2
      ? { person1: Math.min(gross1, explicitSacrifice1), person2: Math.min(gross2, explicitSacrifice2) }
      : splitAdditionalContribution(extraConcessionalSuper, gross1, gross2);
    const p1Sacrifice = roundCurrency(Math.min(gross1, split.person1));
    const p2Sacrifice = roundCurrency(Math.min(gross2, split.person2));
    const p1OtherDeductions = nonNegative(person1PayrollDeductions);
    const p2OtherDeductions = nonNegative(person2PayrollDeductions);
    const p1Taxable = roundCurrency(Math.max(0, gross1 - p1Sacrifice));
    const p2Taxable = roundCurrency(Math.max(0, gross2 - p2Sacrifice));
    const p1PayrollRepaymentIncome = roundCurrency(p1Taxable + p1Sacrifice);
    const p2PayrollRepaymentIncome = roundCurrency(p2Taxable + p2Sacrifice);
    const p1RepaymentIncome = hasValue(person1StslRepaymentIncome) ? nonNegative(person1StslRepaymentIncome) : p1PayrollRepaymentIncome;
    const p2RepaymentIncome = hasValue(person2StslRepaymentIncome) ? nonNegative(person2StslRepaymentIncome) : p2PayrollRepaymentIncome;
    const helpBalance = nonNegative(helpDebt);
    const explicitHelp1 = nonNegative(person1HelpDebt);
    const explicitHelp2 = nonNegative(person2HelpDebt);
    let p1HelpDebt = explicitHelp1;
    let p2HelpDebt = explicitHelp2;
    if (helpBalance > 0 && explicitHelp1 === 0 && explicitHelp2 === 0) {
      if (p2RepaymentIncome > p1RepaymentIncome) p2HelpDebt = helpBalance;
      else p1HelpDebt = helpBalance;
    }
    const p1HasStsl = booleanWithLegacy(person1HasStslDebt, person1HasHelpDebt, p1HelpDebt > 0);
    const p2HasStsl = booleanWithLegacy(person2HasStslDebt, person2HasHelpDebt, p2HelpDebt > 0);
    const p1Help = estimateStudyLoanRepayment(p1RepaymentIncome, p1HelpDebt, p1HasStsl).annualRepayment;
    const p2Help = estimateStudyLoanRepayment(p2RepaymentIncome, p2HelpDebt, p2HasStsl).annualRepayment;
    const buildPerson = (gross, taxableIncome, repaymentIncome, allocatedExtraSuper, otherPayrollDeductions, helpRepayment, openingStslBalance) => {
      const tax = individualTaxBreakdown(taxableIncome);
      const stslOpeningBalance = nonNegative(openingStslBalance);
      const stslProjectedClosingBalance = roundCurrency(Math.max(0, stslOpeningBalance - nonNegative(helpRepayment)));
      return {
        grossEmploymentIncome: roundCurrency(gross),
        taxableIncome: roundCurrency(taxableIncome),
        taxableEmploymentIncome: roundCurrency(taxableIncome),
        repaymentIncome: roundCurrency(repaymentIncome),
        incomeTax: tax.incomeTax,
        medicareLevy: tax.medicareLevy,
        helpRepayment: roundCurrency(helpRepayment),
        stslCompulsoryRepayment: roundCurrency(helpRepayment),
        stslOpeningBalance,
        stslProjectedClosingBalance,
        allocatedExtraSuper: roundCurrency(allocatedExtraSuper),
        salarySacrifice: roundCurrency(allocatedExtraSuper),
        otherPayrollDeductions: roundCurrency(otherPayrollDeductions),
        estimatedNetEmploymentIncome: roundCurrency(Math.max(0, gross - tax.incomeTax - tax.medicareLevy - helpRepayment - allocatedExtraSuper - otherPayrollDeductions)),
      };
    };
    const person1 = buildPerson(gross1, p1Taxable, p1RepaymentIncome, p1Sacrifice, p1OtherDeductions, p1Help, p1HelpDebt);
    const person2 = buildPerson(gross2, p2Taxable, p2RepaymentIncome, p2Sacrifice, p2OtherDeductions, p2Help, p2HelpDebt);
    return {
      person1,
      person2,
      household: {
        grossEmploymentIncome: roundCurrency(gross1 + gross2),
        incomeTax: roundCurrency(person1.incomeTax + person2.incomeTax),
        medicareLevy: roundCurrency(person1.medicareLevy + person2.medicareLevy),
        helpRepayment: roundCurrency(person1.helpRepayment + person2.helpRepayment),
        stslCompulsoryRepayment: roundCurrency(person1.helpRepayment + person2.helpRepayment),
        allocatedExtraSuper: roundCurrency(person1.allocatedExtraSuper + person2.allocatedExtraSuper),
        totalTax: roundCurrency(person1.incomeTax + person2.incomeTax),
        totalMedicareLevy: roundCurrency(person1.medicareLevy + person2.medicareLevy),
        totalHelpRepayments: roundCurrency(person1.helpRepayment + person2.helpRepayment),
        totalStslCompulsoryRepayments: roundCurrency(person1.helpRepayment + person2.helpRepayment),
        totalSalarySacrifice: roundCurrency(person1.salarySacrifice + person2.salarySacrifice),
        totalOtherPayrollDeductions: roundCurrency(person1.otherPayrollDeductions + person2.otherPayrollDeductions),
        estimatedNetEmploymentIncome: roundCurrency(person1.estimatedNetEmploymentIncome + person2.estimatedNetEmploymentIncome),
        note: "Estimated net employment income uses the app's 2026-27 income tax, Medicare levy and STSL compulsory repayment helpers. Legacy study-loan ownership is estimated from the higher repayment income when only one household study-loan balance is available.",
      },
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

  function normaliseIncomeType(value, index = 0) {
    const text = String(value || "").trim();
    if (["salaryWages", "salary_wages", "salary", "wages", "employment"].includes(text)) return "salaryWages";
    if (["rentalNetCashIncome", "rental_net_profit", "rentalNetProfit", "rental"].includes(text)) return "rentalNetCashIncome";
    if (["distribution_income", "distributionIncome", "distributions"].includes(text)) return "distributions";
    if (["other_taxable_income", "otherTaxableIncome", "other"].includes(text)) return "other";
    if (["interest", "dividends"].includes(text)) return text;
    return index < 2 ? "salaryWages" : "other";
  }

  function normaliseIncomeOwner(value, type = "other", index = 0) {
    const text = String(value || "").trim();
    if (text === "person1" || text === "person2") return text;
    if (text === "joint" && type !== "salaryWages") return "joint";
    if (index === 1) return "person2";
    if (index === 0 || type === "salaryWages") return "person1";
    return "joint";
  }

  function migratedDividendAnnualAmount(item = {}) {
    const frequency = item.frequency || "annually";
    const cashDividend = nonNegative(item.cashDividend);
    if (cashDividend > 0) return roundCurrency(annualize(cashDividend, frequency));
    const grossedUp = nonNegative(item.totalTaxableGrossedUpDividend ?? item.grossedUpDividend);
    const enteredAmount = nonNegative(item.amount);
    if (grossedUp > 0 && enteredAmount <= 0) return roundCurrency(annualize(grossedUp * 0.7, frequency));
    return roundCurrency(annualize(item.amount, frequency));
  }

  function normalisedIncomeItems(plan = {}) {
    const items = Array.isArray(plan.incomeItems) ? plan.incomeItems : [];
    if (items.length) {
      return items.map((item, index) => {
        const type = normaliseIncomeType(item.type || item.incomeType, index);
        const owner = normaliseIncomeOwner(item.owner || item.incomeOwner, type, index);
        const person1AllocationPercentage = number(item.person1AllocationPercentage ?? item.person1AllocationPct);
        const person2AllocationPercentage = number(item.person2AllocationPercentage ?? item.person2AllocationPct);
        const migratedAmount = type === "dividends" ? migratedDividendAnnualAmount(item) : number(item.amount);
        return {
          ...item,
          type,
          owner,
          amount: migratedAmount,
          cashDividend: number(item.cashDividend),
          frankingCredits: number(item.frankingCredits),
          totalTaxableGrossedUpDividend: number(item.totalTaxableGrossedUpDividend ?? item.grossedUpDividend),
          person1AllocationPercentage,
          person2AllocationPercentage,
          frequency: type === "rentalNetCashIncome" || type === "dividends" ? "annually" : item.frequency || "annually",
        };
      });
    }
    return [
      { id: "income-person-1", name: plan.income?.person1IncomeName || "Person 1 salary", type: "salaryWages", owner: "person1", amount: number(plan.income?.person1Income), frequency: plan.income?.person1Frequency || "annually" },
      { id: "income-person-2", name: plan.income?.person2IncomeName || "Person 2 salary", type: "salaryWages", owner: "person2", amount: number(plan.income?.person2Income), frequency: plan.income?.person2Frequency || "annually" },
      { id: "income-other", name: plan.income?.otherIncomeName || "Other Income", type: "other", owner: "joint", amount: number(plan.income?.otherIncome), frequency: plan.income?.otherIncomeFrequency || "annually" },
    ];
  }

  function incomeCashAnnualAmount(item = {}) {
    const type = normaliseIncomeType(item.type || item.incomeType);
    if (type === "salaryWages") return salaryCashEarningsAnnualAmount(item);
    return roundCurrency(annualize(item.amount, item.frequency || "annually"));
  }

  function salaryPackageIncludesEmployerSuper(item = {}) {
    return item.salaryIncludesEmployerSuper === true
      || item.salaryPackageIncludesSuper === true
      || item.packageIncludesEmployerSuper === true;
  }

  function salaryCashEarningsAnnualAmount(item = {}, superRate = EMPLOYER_SUPER_RATE) {
    const packageAmount = roundCurrency(annualize(item.amount, item.frequency || "annually"));
    if (!salaryPackageIncludesEmployerSuper(item)) return packageAmount;
    return roundCurrency(packageAmount / (1 + nonNegative(superRate)));
  }

  function qualifyingEarningsAnnualAmount(item = {}, superRate = EMPLOYER_SUPER_RATE) {
    if (item.qualifyingEarningsOverrideEnabled === true || item.useQualifyingEarningsOverride === true) {
      return roundCurrency(annualize(item.qualifyingEarningsAmount, item.qualifyingEarningsFrequency || item.frequency || "annually"));
    }
    return salaryCashEarningsAnnualAmount(item, superRate);
  }

  function employerSuperForSalaryItem(item = {}, superRate = EMPLOYER_SUPER_RATE, maximumContributionBase = EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE) {
    const qualifyingEarnings = qualifyingEarningsAnnualAmount(item, superRate);
    if (salaryPackageIncludesEmployerSuper(item) && item.qualifyingEarningsOverrideEnabled !== true && item.useQualifyingEarningsOverride !== true) {
      const cashEarnings = salaryCashEarningsAnnualAmount(item, superRate);
      const packageAmount = roundCurrency(annualize(item.amount, item.frequency || "annually"));
      return roundCurrency(Math.max(0, packageAmount - cashEarnings));
    }
    const cappedEarnings = maximumContributionBase > 0 ? Math.min(nonNegative(qualifyingEarnings), nonNegative(maximumContributionBase)) : nonNegative(qualifyingEarnings);
    return roundCurrency(cappedEarnings * nonNegative(superRate));
  }

  function incomeTaxableAnnualAmount(item = {}) {
    const type = normaliseIncomeType(item.type || item.incomeType);
    if (type === "salaryWages") return salaryCashEarningsAnnualAmount(item);
    return incomeCashAnnualAmount(item);
  }

  function rentalCashIncomeAnnualAmount(item = {}) {
    const explicitCashSource = rentalCashIncomeSource(item);
    if (explicitCashSource !== undefined && explicitCashSource !== null && explicitCashSource !== "") {
      return roundCurrency(annualize(explicitCashSource, item.rentalCashIncomeFrequency || item.cashIncomeFrequency || item.frequency || "annually"));
    }
    return null;
  }

  function rentalCashIncomeSource(item = {}) {
    const candidates = [
      item.rentalCashIncomeAnnual,
      item.annualRentalCashIncome,
      item.annualCashIncome,
      item.cashIncome,
      item.annualNetRentalCashIncome,
    ];
    return candidates.find((value) => value !== undefined && value !== null && value !== "");
  }

  function hasRentalCashIncomeAnnualAmount(item = {}) {
    return rentalCashIncomeSource(item) !== undefined;
  }

  function rentalCashIncomeRequiredWarning(propertyIncome = {}) {
    const propertyName = propertyIncome.propertyName || propertyIncome.name || "Rental property";
    return {
      code: "RENTAL_CASH_INCOME_REQUIRED",
      incomeId: String(propertyIncome.id || ""),
      linkedAssetId: String(propertyIncome.linkedAssetId || propertyIncome.linkedPropertyAssetId || propertyIncome.assetId || ""),
      propertyName,
      message: `Rental cash income required for ${propertyName}. The entered taxable rental profit cannot be used as the property's cash income. Enter the annual rental cash income used for cashflow projections.`,
    };
  }

  function incomeAllocation(item = {}) {
    const type = normaliseIncomeType(item.type || item.incomeType);
    const owner = normaliseIncomeOwner(item.owner || item.incomeOwner, type);
    if (owner === "person1") return { person1: 1, person2: 0 };
    if (owner === "person2") return { person1: 0, person2: 1 };
    let p1 = number(item.person1AllocationPercentage ?? item.person1AllocationPct);
    let p2 = number(item.person2AllocationPercentage ?? item.person2AllocationPct);
    if (p1 <= 0 && p2 <= 0) {
      p1 = 50;
      p2 = 50;
    } else if (p1 > 0 && p2 <= 0) {
      p2 = Math.max(0, 100 - p1);
    } else if (p2 > 0 && p1 <= 0) {
      p1 = Math.max(0, 100 - p2);
    }
    const total = p1 + p2;
    if (total <= 0) return { person1: 0.5, person2: 0.5 };
    return {
      person1: roundRatio(p1 / total),
      person2: roundRatio(p2 / total),
    };
  }

  function addIncomeToBreakdown(summary, {
    annualAmount = 0,
    taxableAmount = annualAmount,
    owner = "joint",
    type = "other",
    allocation = { person1: 0.5, person2: 0.5 },
  } = {}) {
    const amount = roundCurrency(annualAmount);
    const taxable = roundCurrency(taxableAmount);
    summary.total = roundCurrency(summary.total + amount);
    summary.taxableTotal = roundCurrency(summary.taxableTotal + taxable);
    if (type === "salaryWages") {
      if (owner === "person2") summary.person2Salary = roundCurrency(summary.person2Salary + amount);
      else summary.person1Salary = roundCurrency(summary.person1Salary + amount);
    } else if (owner === "person1") {
      summary.person1Other = roundCurrency(summary.person1Other + amount);
      summary.person1TaxableOther = roundCurrency(summary.person1TaxableOther + taxable);
    } else if (owner === "person2") {
      summary.person2Other = roundCurrency(summary.person2Other + amount);
      summary.person2TaxableOther = roundCurrency(summary.person2TaxableOther + taxable);
    } else {
      summary.jointOther = roundCurrency(summary.jointOther + amount);
      summary.jointOtherTaxable = roundCurrency(summary.jointOtherTaxable + taxable);
      summary.person1TaxableOther = roundCurrency(summary.person1TaxableOther + taxable * allocation.person1);
      summary.person2TaxableOther = roundCurrency(summary.person2TaxableOther + taxable * allocation.person2);
    }
    summary.person1Taxable = roundCurrency(summary.person1Salary + summary.person1TaxableOther);
    summary.person2Taxable = roundCurrency(summary.person2Salary + summary.person2TaxableOther);
    summary.otherIncome = roundCurrency(summary.person1Other + summary.person2Other + summary.jointOther);
    return summary;
  }

  function incomeBreakdown(plan = {}, rentalCashflow = null) {
    const summary = {
      person1Salary: 0,
      person2Salary: 0,
      person1Other: 0,
      person2Other: 0,
      person1TaxableOther: 0,
      person2TaxableOther: 0,
      jointOther: 0,
      jointOtherTaxable: 0,
      person1Taxable: 0,
      person2Taxable: 0,
      otherIncome: 0,
      total: 0,
      taxableTotal: 0,
    };
    normalisedIncomeItems(plan).forEach((item) => {
      if (normaliseIncomeType(item.type) === "rentalNetCashIncome") return;
      const annualAmount = incomeCashAnnualAmount(item);
      const taxableAmount = incomeTaxableAnnualAmount(item);
      const owner = normaliseIncomeOwner(item.owner, item.type);
      const type = normaliseIncomeType(item.type);
      const allocation = incomeAllocation(item);
      addIncomeToBreakdown(summary, { annualAmount, taxableAmount, owner, type, allocation });
    });
    const rentalSummary = rentalCashflow || calculateRentalCashflowSummary(plan);
    (rentalSummary.propertyResults || []).forEach((property) => {
      const taxableAmount = roundCurrency(property.currentTaxableRentalProfit ?? property.taxableRentalProfit ?? property.rentalPassiveIncomeBeforePrincipal);
      const owner = normaliseIncomeOwner(property.owner, "rentalNetCashIncome");
      addIncomeToBreakdown(summary, {
        annualAmount: taxableAmount,
        taxableAmount,
        owner,
        type: "rentalNetCashIncome",
        allocation: incomeAllocation({
          owner,
          type: "rentalNetCashIncome",
          person1AllocationPercentage: property.person1AllocationPercentage,
          person2AllocationPercentage: property.person2AllocationPercentage,
        }),
      });
    });
    return summary;
  }

  function calculateEmployerSuperForPerson(personId, incomes = [], superRate = EMPLOYER_SUPER_RATE, maximumContributionBase = EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE) {
    const owner = personId === "person2" ? "person2" : "person1";
    return roundCurrency((Array.isArray(incomes) ? incomes : []).reduce((total, item, index) => {
      const type = normaliseIncomeType(item.type || item.incomeType, index);
      const incomeOwner = normaliseIncomeOwner(item.owner || item.incomeOwner, type, index);
      if (type !== "salaryWages" || incomeOwner !== owner) return total;
      return total + employerSuperForSalaryItem(item, superRate, maximumContributionBase);
    }, 0));
  }

  function employerSuperSummary(plan = {}) {
    const incomes = normalisedIncomeItems(plan);
    const person1Calculated = calculateEmployerSuperForPerson("person1", incomes, EMPLOYER_SUPER_RATE, EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE);
    const person2Calculated = calculateEmployerSuperForPerson("person2", incomes, EMPLOYER_SUPER_RATE, EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE);
    const person1OverrideEnabled = Boolean(plan.investing?.person1EmployerSuperOverrideEnabled);
    const person2OverrideEnabled = Boolean(plan.investing?.person2EmployerSuperOverrideEnabled);
    const person1Amount = person1OverrideEnabled ? nonNegative(plan.investing?.person1EmployerSuperOverride) : person1Calculated;
    const person2Amount = person2OverrideEnabled ? nonNegative(plan.investing?.person2EmployerSuperOverride) : person2Calculated;
    return {
      rate: EMPLOYER_SUPER_RATE,
      person1Calculated,
      person2Calculated,
      person1Amount: roundCurrency(person1Amount),
      person2Amount: roundCurrency(person2Amount),
      totalCalculated: roundCurrency(person1Calculated + person2Calculated),
      totalEffective: roundCurrency(person1Amount + person2Amount),
      person1OverrideEnabled,
      person2OverrideEnabled,
      hasOverride: person1OverrideEnabled || person2OverrideEnabled,
      concessionalCap: CONCESSIONAL_SUPER_CAP,
      maximumContributionBase: EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE,
      note: "Estimated employer super contributions are calculated from salary and wages only and capped at the selected financial year's maximum contribution base where applicable.",
    };
  }

  function normaliseLinkedLoanIds(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
    return [];
  }

  function linkedAssetIdFromLiability(item = {}) {
    return String(item.linkedAssetId || item.investmentLink?.linkedAssetId || "");
  }

  function rentalPropertyAssetId(asset = {}, index = 0) {
    return String(asset.id || asset.assetId || asset.canonicalAssetId || `rental-property-${index + 1}`);
  }

  function isRentalInvestmentPropertyAsset(asset = {}) {
    const category = asset.category || asset.type || asset.assetCategory;
    return INVESTMENT_PROPERTY_ASSET_CATEGORIES.includes(category) || ["rentalProperty", "rentalInvestmentProperty", "investmentProperty"].includes(category);
  }

  function firstPresentNumber(candidates = []) {
    for (const value of candidates) {
      if (value === undefined || value === null || value === "") continue;
      const parsed = number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function hasPresentNumber(candidates = []) {
    return firstPresentNumber(candidates) !== null;
  }

  function grossRentalIncomeSource(source = {}) {
    return firstPresentNumber([
      source.annualGrossRentalIncome,
      source.grossRentalIncomeAnnual,
      source.grossRentAnnual,
      source.annualRentalGrossIncome,
      source.rentalGrossIncomeAnnual,
    ]);
  }

  function propertyOperatingExpensesSource(source = {}) {
    return firstPresentNumber([
      source.annualPropertyOperatingExpenses,
      source.propertyOperatingExpensesAnnual,
      source.annualPropertyExpenses,
      source.propertyExpensesAnnual,
      source.operatingExpensesAnnual,
      source.annualOperatingExpenses,
    ]);
  }

  function hasPropertyOperatingExpensesSource(source = {}) {
    return hasPresentNumber([
      source.annualPropertyOperatingExpenses,
      source.propertyOperatingExpensesAnnual,
      source.annualPropertyExpenses,
      source.propertyExpensesAnnual,
      source.operatingExpensesAnnual,
      source.annualOperatingExpenses,
    ]);
  }

  function legacyTaxableRentalProfitSource(source = {}) {
    const explicit = firstPresentNumber([
      source.legacyTaxableRentalProfitAnnual,
      source.existingTaxableRentalProfitAnnual,
      source.taxableRentalIncomeAnnual,
      source.annualTaxableIncome,
      source.taxableIncome,
    ]);
    if (explicit !== null) return explicit;
    if (normaliseIncomeType(source.type || source.incomeType) === "rentalNetCashIncome") {
      return incomeTaxableAnnualAmount(source);
    }
    return null;
  }

  function rentalOwnershipAllocation(source = {}, fallback = {}) {
    const owner = normaliseIncomeOwner(source.owner || source.incomeOwner || fallback.owner || fallback.incomeOwner, "rentalNetCashIncome");
    const allocationSource = {
      person1AllocationPercentage: source.person1AllocationPercentage ?? source.person1AllocationPct ?? fallback.person1AllocationPercentage ?? fallback.person1AllocationPct,
      person2AllocationPercentage: source.person2AllocationPercentage ?? source.person2AllocationPct ?? fallback.person2AllocationPercentage ?? fallback.person2AllocationPct,
    };
    return { owner, allocation: incomeAllocation({ ...allocationSource, owner, type: "rentalNetCashIncome" }) };
  }

  function rentalPropertyAssetRecords(plan = {}) {
    const items = Array.isArray(plan.assetItems) ? plan.assetItems : [];
    return items
      .filter(isRentalInvestmentPropertyAsset)
      .map((asset, index) => ({
        ...asset,
        id: rentalPropertyAssetId(asset, index),
        name: asset.name || asset.description || `Rental property ${index + 1}`,
        category: asset.category || asset.type || "rentalInvestmentProperty",
        value: assetRecordValue(asset),
      }));
  }

  function rentalIncomeItemsFromPlan(plan = {}) {
    return normalisedIncomeItems(plan).filter((item) => item.type === "rentalNetCashIncome");
  }

  function rentalPropertyLoansFromPlan(plan = {}) {
    return (Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [])
      .filter((item) => item.type === "rentalPropertyLoan");
  }

  function rentalIncomeForAsset(incomeItems = [], assetId = "") {
    return incomeItems.find((income) => String(income.linkedAssetId || income.linkedPropertyAssetId || "") === String(assetId));
  }

  function rentalLoansForProperty({ assetId = "", income = {}, loans = [], usedLoanIds = null } = {}) {
    const linkedIds = new Set(normaliseLinkedLoanIds(income.linkedLoanIds || income.linkedLoanId));
    return loans.filter((loan) => {
      const loanId = String(loan.id || "");
      if (!loanId) return false;
      if (usedLoanIds?.has(loanId) && !loan.allowMultipleRentalLinks) return false;
      const loanLinkedAssetId = linkedAssetIdFromLiability(loan);
      const linkedFromAsset = assetId && loanLinkedAssetId && loanLinkedAssetId === String(assetId);
      const linkedFromIncome = income.id && String(loan.linkedRentalIncomeId || "") === String(income.id);
      const linkedFromIncomeList = linkedIds.has(loanId);
      if (!linkedFromAsset && !linkedFromIncome && !linkedFromIncomeList) return false;
      if (assetId && loanLinkedAssetId && loanLinkedAssetId !== String(assetId) && !linkedFromIncome) return false;
      if (usedLoanIds) usedLoanIds.add(loanId);
      return true;
    });
  }

  function calculateRentalPropertyFromFacts(propertyAsset = {}, linkedIncome = {}, linkedLoans = []) {
    const propertyName = propertyAsset.name || linkedIncome.propertyName || linkedIncome.name || "Rental property";
    const assetId = rentalPropertyAssetId(propertyAsset);
    const grossSource = grossRentalIncomeSource(propertyAsset) ?? grossRentalIncomeSource(linkedIncome);
    const expenseSource = propertyOperatingExpensesSource(propertyAsset) ?? propertyOperatingExpensesSource(linkedIncome);
    const hasGrossRentalIncome = grossSource !== null;
    const hasOperatingExpenses = hasPropertyOperatingExpensesSource(propertyAsset) || hasPropertyOperatingExpensesSource(linkedIncome);
    const annualGrossRentalIncome = hasGrossRentalIncome ? roundCurrency(Math.max(0, grossSource)) : null;
    const annualPropertyOperatingExpenses = hasOperatingExpenses ? roundCurrency(Math.max(0, expenseSource || 0)) : null;
    const loanBreakdowns = linkedLoans.map(getAnnualLoanBreakdown);
    const annualLoanRepayments = roundCurrency(loanBreakdowns.reduce((total, item) => total + item.annualRepayments, 0));
    const annualLoanInterest = roundCurrency(loanBreakdowns.reduce((total, item) => total + item.annualInterest, 0));
    const annualLoanPrincipal = roundCurrency(loanBreakdowns.reduce((total, item) => total + item.annualPrincipal, 0));
    const hasRentalPropertyDetails = hasGrossRentalIncome && hasOperatingExpenses;
    const legacyTaxableRentalProfitAnnual = legacyTaxableRentalProfitSource(propertyAsset) ?? legacyTaxableRentalProfitSource(linkedIncome);
    const ownership = rentalOwnershipAllocation(propertyAsset, linkedIncome);
    const warnings = [];
    if (!hasRentalPropertyDetails) {
      warnings.push({
        code: "RENTAL_PROPERTY_DETAILS_REQUIRED",
        incomeId: String(linkedIncome.id || ""),
        linkedAssetId: assetId,
        propertyName,
        message: `${propertyName} needs gross rental income and annual property expenses before the new rental projection can be calculated.`,
      });
    }
    const currentTaxableRentalProfit = hasRentalPropertyDetails
      ? roundCurrency(annualGrossRentalIncome - annualPropertyOperatingExpenses - annualLoanInterest)
      : roundCurrency(legacyTaxableRentalProfitAnnual || 0);
    const currentNetPropertyCashflow = hasRentalPropertyDetails
      ? roundCurrency(annualGrossRentalIncome - annualPropertyOperatingExpenses - annualLoanRepayments)
      : 0;
    return {
      id: String(linkedIncome.id || `property-income-${assetId}`),
      incomeId: String(linkedIncome.id || ""),
      propertyId: assetId,
      linkedAssetId: assetId,
      name: propertyName,
      owner: ownership.owner,
      person1AllocationPercentage: roundRatio(ownership.allocation.person1 * 100),
      person2AllocationPercentage: roundRatio(ownership.allocation.person2 * 100),
      treatment: "grossRent",
      rentalCashflowTreatment: "grossRent",
      hasRentalPropertyDetails,
      hasGrossRentalIncome,
      hasOperatingExpenses,
      annualGrossRentalIncome,
      annualPropertyOperatingExpenses,
      grossRentalIncome: annualGrossRentalIncome,
      propertyOperatingExpenses: annualPropertyOperatingExpenses,
      legacyTaxableRentalProfitAnnual: legacyTaxableRentalProfitAnnual === null ? null : roundCurrency(legacyTaxableRentalProfitAnnual),
      annualNetRentalCashIncome: hasRentalPropertyDetails ? roundCurrency(annualGrossRentalIncome - annualPropertyOperatingExpenses - annualLoanInterest) : null,
      linkedLoanCount: linkedLoans.length,
      linkedLoanIds: linkedLoans.map((loan) => loan.id).filter(Boolean),
      loanBreakdowns,
      annualLoanRepayments,
      annualLoanInterest,
      annualLoanPrincipal,
      householdDebtDeduction: hasRentalPropertyDetails ? annualLoanPrincipal : 0,
      currentTaxableRentalProfit,
      taxableRentalProfit: currentTaxableRentalProfit,
      currentNetPropertyCashflow,
      netPropertyCashflow: currentNetPropertyCashflow,
      rentalPassiveIncomeBeforePrincipal: currentTaxableRentalProfit,
      rentalPrincipalRepayments: hasRentalPropertyDetails ? annualLoanPrincipal : 0,
      rentalHouseholdCashflowAfterPrincipal: currentNetPropertyCashflow,
      householdCashflowContribution: currentNetPropertyCashflow,
      hasRentalCashIncome: hasRentalPropertyDetails,
      missingRentalCashIncome: !hasRentalPropertyDetails,
      warnings,
    };
  }

  function liabilityAnnualRepayment(item = {}) {
    return roundCurrency(annualize(item.repayment, item.repaymentFrequency || "monthly"));
  }

  function getAnnualLoanBreakdown(loan = {}) {
    const balance = nonNegative(loan.balance);
    const annualInterestRate = annualRate(loan.interestRatePct);
    const repaymentType = loan.repaymentType === "interestOnly" ? "interestOnly" : "principalAndInterest";

    if (balance <= 0) {
      return {
        loanId: loan.id || "",
        annualRepayments: 0,
        regularAnnualRepayments: 0,
        annualInterest: 0,
        annualPrincipal: 0,
        additionalPrincipal: 0,
        closingBalance: 0,
        repaymentType,
        paidOff: true,
      };
    }

    const regularAnnualRepayments = liabilityAnnualRepayment(loan);
    const additionalPrincipal = roundCurrency(annualize(loan.additionalPrincipalRepayment, loan.additionalPrincipalFrequency || "annually"));

    if (repaymentType === "interestOnly") {
      const annualInterest = roundCurrency(balance * annualInterestRate);
      return {
        loanId: loan.id || "",
        annualRepayments: roundCurrency(regularAnnualRepayments + additionalPrincipal),
        regularAnnualRepayments,
        annualInterest,
        annualPrincipal: additionalPrincipal,
        additionalPrincipal,
        closingBalance: roundCurrency(Math.max(0, balance - additionalPrincipal)),
        repaymentType,
      };
    }

    const monthlyRepayment = roundCurrency(regularAnnualRepayments / MONTHS_PER_YEAR);
    const termYears = nonNegative(loan.termYears) || 30;
    const amortisation = amortiseLoan({
      principal: balance,
      annualInterestRate,
      monthlyRepayment,
      termYears,
      offsetBalance: 0,
    });
    const firstYear = amortisation.schedule.slice(0, MONTHS_PER_YEAR);
    let annualInterest = roundCurrency(firstYear.reduce((total, row) => total + row.interestCharged, 0));
    let annualPrincipal = roundCurrency(firstYear.reduce((total, row) => total + Math.max(0, row.principalRepaid), 0));
    let closingBalance = firstYear.at(-1)?.closingBalance;

    if (!firstYear.length && regularAnnualRepayments > 0) {
      annualInterest = roundCurrency(balance * annualInterestRate);
      annualPrincipal = roundCurrency(Math.max(0, regularAnnualRepayments - annualInterest));
      closingBalance = roundCurrency(Math.max(0, balance - annualPrincipal));
    }

    annualPrincipal = roundCurrency(annualPrincipal + additionalPrincipal);
    closingBalance = roundCurrency(Math.max(0, (closingBalance ?? balance) - additionalPrincipal));

    return {
      loanId: loan.id || "",
      annualRepayments: roundCurrency(regularAnnualRepayments + additionalPrincipal),
      regularAnnualRepayments,
      annualInterest,
      annualPrincipal,
      additionalPrincipal,
      closingBalance,
      repaymentType,
    };
  }

  function calculateRentalPropertyCashflow(propertyIncome = {}, linkedLoans = []) {
    const treatment = propertyIncome.rentalCashflowTreatment === "beforeInterest" ? "beforeInterest" : "afterInterest";
    const hasRentalCashIncome = hasRentalCashIncomeAnnualAmount(propertyIncome);
    const annualNetRentalCashIncome = hasRentalCashIncome ? rentalCashIncomeAnnualAmount(propertyIncome) : null;
    const loanBreakdowns = linkedLoans.map(getAnnualLoanBreakdown);
    const annualLoanRepayments = roundCurrency(loanBreakdowns.reduce((total, item) => total + item.annualRepayments, 0));
    const annualLoanInterest = roundCurrency(loanBreakdowns.reduce((total, item) => total + item.annualInterest, 0));
    const annualLoanPrincipal = roundCurrency(loanBreakdowns.reduce((total, item) => total + item.annualPrincipal, 0));
    const cashIncomeWarnings = hasRentalCashIncome ? [] : [rentalCashIncomeRequiredWarning(propertyIncome)];
    if (!hasRentalCashIncome) {
      return {
        id: propertyIncome.id || "",
        name: propertyIncome.propertyName || propertyIncome.name || "Rental property",
        owner: normaliseIncomeOwner(propertyIncome.owner, propertyIncome.type),
        treatment,
        hasRentalCashIncome: false,
        annualNetRentalCashIncome,
        linkedLoanCount: linkedLoans.length,
        linkedLoanIds: linkedLoans.map((loan) => loan.id).filter(Boolean),
        loanBreakdowns,
        annualLoanRepayments,
        annualLoanInterest,
        annualLoanPrincipal,
        householdDebtDeduction: 0,
        rentalPassiveIncomeBeforePrincipal: 0,
        rentalPrincipalRepayments: 0,
        rentalHouseholdCashflowAfterPrincipal: 0,
        householdCashflowContribution: 0,
        warnings: cashIncomeWarnings,
      };
    }
    const householdDebtDeduction = treatment === "beforeInterest" ? annualLoanRepayments : annualLoanPrincipal;
    const rentalPassiveIncomeBeforePrincipal = roundCurrency(treatment === "beforeInterest"
      ? annualNetRentalCashIncome - annualLoanInterest
      : annualNetRentalCashIncome);
    const rentalPrincipalRepayments = roundCurrency(annualLoanPrincipal);
    const rentalHouseholdCashflowAfterPrincipal = roundCurrency(rentalPassiveIncomeBeforePrincipal - rentalPrincipalRepayments);
    return {
      id: propertyIncome.id || "",
      name: propertyIncome.propertyName || propertyIncome.name || "Rental property",
      owner: normaliseIncomeOwner(propertyIncome.owner, propertyIncome.type),
      treatment,
      annualNetRentalCashIncome,
      linkedLoanCount: linkedLoans.length,
      linkedLoanIds: linkedLoans.map((loan) => loan.id).filter(Boolean),
      loanBreakdowns,
      annualLoanRepayments,
      annualLoanInterest,
      annualLoanPrincipal,
      householdDebtDeduction: roundCurrency(householdDebtDeduction),
      rentalPassiveIncomeBeforePrincipal,
      rentalPrincipalRepayments,
      rentalHouseholdCashflowAfterPrincipal,
      householdCashflowContribution: rentalHouseholdCashflowAfterPrincipal,
      hasRentalCashIncome: true,
      warnings: [],
    };
  }

  function calculateRentalCashflowSummary(plan = {}) {
    const rentalAssets = rentalPropertyAssetRecords(plan);
    const incomeItems = rentalIncomeItemsFromPlan(plan);
    const rentalLoans = rentalPropertyLoansFromPlan(plan);
    const usedLoanIds = new Set();
    const usedIncomeIds = new Set();
    const warnings = [];
    const propertyResults = rentalAssets.map((asset) => {
      const income = rentalIncomeForAsset(incomeItems, asset.id) || {};
      if (income.id) usedIncomeIds.add(String(income.id));
      const linkedLoans = rentalLoansForProperty({
        assetId: asset.id,
        income,
        loans: rentalLoans,
        usedLoanIds,
      });
      return calculateRentalPropertyFromFacts(asset, income, linkedLoans);
    });
    const legacyIncomeResults = incomeItems
      .filter((income) => !usedIncomeIds.has(String(income.id || "")))
      .map((income) => {
      const linkedIds = normaliseLinkedLoanIds(income.linkedLoanIds || income.linkedLoanId);
      const linkedLoans = rentalLoans.filter((loan) => {
        const linkedFromIncome = linkedIds.includes(String(loan.id || ""));
        const linkedFromLoan = loan.linkedRentalIncomeId && String(loan.linkedRentalIncomeId) === String(income.id || "");
        const linkedFromAsset = String(income.linkedAssetId || "") && linkedAssetIdFromLiability(loan) === String(income.linkedAssetId || "");
        if (!linkedFromIncome && !linkedFromLoan) return false;
        if (linkedFromAsset && usedLoanIds.has(String(loan.id || ""))) return false;
        if (usedLoanIds.has(loan.id) && !loan.allowMultipleRentalLinks) {
          warnings.push(`${loan.name || "A rental property loan"} is linked to more than one rental income entry. It has only been counted once.`);
          return false;
        }
        usedLoanIds.add(loan.id);
        return true;
      });
      return hasRentalCashIncomeAnnualAmount(income)
        ? calculateRentalPropertyCashflow(income, linkedLoans)
        : calculateRentalPropertyFromFacts({}, income, linkedLoans);
    });
    const allPropertyResults = [...propertyResults, ...legacyIncomeResults];
    allPropertyResults.forEach((property) => {
      (property.warnings || []).forEach((warning) => warnings.push(warning.message || warning.code || String(warning)));
    });

    const unlinkedRentalLoans = rentalLoans.filter((loan) => loan.id && !usedLoanIds.has(loan.id));
    const confirmedUnlinked = unlinkedRentalLoans
      .filter((loan) => loan.unlinkedRentalCashflowTreatment === "afterInterest" || loan.unlinkedRentalCashflowTreatment === "beforeInterest")
      .map((loan) => {
        const breakdown = getAnnualLoanBreakdown(loan);
        const treatment = loan.unlinkedRentalCashflowTreatment === "beforeInterest" ? "beforeInterest" : "afterInterest";
      return {
        loan,
        breakdown,
        treatment,
        householdDebtDeduction: treatment === "beforeInterest" ? breakdown.annualRepayments : breakdown.annualPrincipal,
        rentalPassiveIncomeBeforePrincipal: treatment === "beforeInterest" ? -breakdown.annualInterest : 0,
        rentalPrincipalRepayments: breakdown.annualPrincipal,
        rentalHouseholdCashflowAfterPrincipal: treatment === "beforeInterest" ? -breakdown.annualRepayments : -breakdown.annualPrincipal,
      };
      });
    unlinkedRentalLoans
      .filter((loan) => !loan.unlinkedRentalCashflowTreatment || loan.unlinkedRentalCashflowTreatment === "unconfirmed")
      .forEach((loan) => warnings.push(`${loan.name || "A rental property loan"} is not linked to a rental property income entry. Confirm whether loan interest is already included in the rental cashflow amount.`));

    const propertyDebtDeduction = roundCurrency(propertyResults.reduce((total, item) => total + item.householdDebtDeduction, 0));
    const legacyDebtDeduction = roundCurrency(legacyIncomeResults.reduce((total, item) => total + item.householdDebtDeduction, 0));
    const confirmedUnlinkedDebtDeduction = roundCurrency(confirmedUnlinked.reduce((total, item) => total + item.householdDebtDeduction, 0));
    const annualLoanInterest = roundCurrency(
      allPropertyResults.reduce((total, item) => total + item.annualLoanInterest, 0)
      + confirmedUnlinked.reduce((total, item) => total + item.breakdown.annualInterest, 0),
    );
    const annualLoanPrincipal = roundCurrency(
      allPropertyResults.reduce((total, item) => total + item.annualLoanPrincipal, 0)
      + confirmedUnlinked.reduce((total, item) => total + item.breakdown.annualPrincipal, 0),
    );

    return {
      propertyResults: allPropertyResults,
      unlinkedRentalLoans: unlinkedRentalLoans.map((loan) => ({ id: loan.id, name: loan.name || "Rental property loan" })),
      confirmedUnlinked,
      warnings,
      annualGrossRentalIncome: roundCurrency(allPropertyResults.reduce((total, item) => total + nonNegative(item.annualGrossRentalIncome), 0)),
      annualPropertyOperatingExpenses: roundCurrency(allPropertyResults.reduce((total, item) => total + nonNegative(item.annualPropertyOperatingExpenses), 0)),
      annualCurrentTaxableRentalProfit: roundCurrency(allPropertyResults.reduce((total, item) => total + number(item.currentTaxableRentalProfit ?? item.taxableRentalProfit ?? item.rentalPassiveIncomeBeforePrincipal), 0)),
      annualCurrentNetPropertyCashflow: roundCurrency(allPropertyResults.reduce((total, item) => total + number(item.currentNetPropertyCashflow ?? item.netPropertyCashflow ?? item.rentalHouseholdCashflowAfterPrincipal), 0)),
      annualNetRentalIncome: roundCurrency(allPropertyResults.reduce((total, item) => total + number(item.annualNetRentalCashIncome), 0)),
      annualLoanRepayments: roundCurrency(allPropertyResults.reduce((total, item) => total + item.annualLoanRepayments, 0) + confirmedUnlinked.reduce((total, item) => total + item.breakdown.annualRepayments, 0)),
      annualLoanInterest,
      annualLoanPrincipal,
      annualRentalPassiveIncomeBeforePrincipal: roundCurrency(allPropertyResults.reduce((total, item) => total + item.rentalPassiveIncomeBeforePrincipal, 0) + confirmedUnlinked.reduce((total, item) => total + item.rentalPassiveIncomeBeforePrincipal, 0)),
      annualRentalPrincipalRepayments: roundCurrency(allPropertyResults.reduce((total, item) => total + item.rentalPrincipalRepayments, 0) + confirmedUnlinked.reduce((total, item) => total + item.rentalPrincipalRepayments, 0)),
      annualRentalHouseholdCashflowAfterPrincipal: roundCurrency(allPropertyResults.reduce((total, item) => total + item.rentalHouseholdCashflowAfterPrincipal, 0) + confirmedUnlinked.reduce((total, item) => total + item.rentalHouseholdCashflowAfterPrincipal, 0)),
      annualHouseholdDebtDeduction: roundCurrency(propertyDebtDeduction + legacyDebtDeduction + confirmedUnlinkedDebtDeduction),
      annualHouseholdCashflowContribution: roundCurrency(allPropertyResults.reduce((total, item) => total + item.householdCashflowContribution, 0) - confirmedUnlinkedDebtDeduction),
    };
  }

  function hasPassiveOtherIncomeFlag(item = {}) {
    return item.isPassiveIncome === true || item.passiveIncome === true || item.isPassive === true;
  }

  function createPassiveIncomeSummary() {
    return {
      interest: 0,
      dividends: 0,
      distributions: 0,
      rental: 0,
      otherPassive: 0,
      person1: 0,
      person2: 0,
      joint: 0,
      total: 0,
      rentalProperties: [],
    };
  }

  function addPassiveIncomeAmount(summary, category, amount, owner = "joint") {
    const annualAmount = roundCurrency(amount);
    if (!summary[category]) summary[category] = 0;
    summary[category] = roundCurrency(summary[category] + annualAmount);
    if (owner === "person1") summary.person1 = roundCurrency(summary.person1 + annualAmount);
    else if (owner === "person2") summary.person2 = roundCurrency(summary.person2 + annualAmount);
    else summary.joint = roundCurrency(summary.joint + annualAmount);
    summary.total = roundCurrency(summary.interest + summary.dividends + summary.distributions + summary.rental + summary.otherPassive);
  }

  function passiveIncomeBreakdown(plan = {}, rentalCashflow = null) {
    const summary = createPassiveIncomeSummary();
    const rentalSummary = rentalCashflow || calculateRentalCashflowSummary(plan);
    normalisedIncomeItems(plan).forEach((item) => {
      const type = normaliseIncomeType(item.type || item.incomeType);
      if (type === "salaryWages" || type === "rentalNetCashIncome") return;
      const owner = normaliseIncomeOwner(item.owner || item.incomeOwner, type);
      const annualAmount = incomeCashAnnualAmount(item);
      if (type === "interest") addPassiveIncomeAmount(summary, "interest", annualAmount, owner);
      else if (type === "dividends") addPassiveIncomeAmount(summary, "dividends", annualAmount, owner);
      else if (type === "distributions") addPassiveIncomeAmount(summary, "distributions", annualAmount, owner);
      else if (type === "other" && hasPassiveOtherIncomeFlag(item)) addPassiveIncomeAmount(summary, "otherPassive", annualAmount, owner);
    });
    (rentalSummary.propertyResults || []).forEach((property) => {
      const passiveAmount = roundCurrency(property.rentalPassiveIncomeBeforePrincipal);
      addPassiveIncomeAmount(summary, "rental", passiveAmount, normaliseIncomeOwner(property.owner, "rentalNetCashIncome"));
      summary.rentalProperties.push({
        id: property.id,
        name: property.name,
        owner: property.owner,
        treatment: property.treatment,
        annualNetRentalCashIncome: property.annualNetRentalCashIncome,
        annualLoanRepayments: property.annualLoanRepayments,
        annualLoanInterest: property.annualLoanInterest,
        annualLoanPrincipal: property.annualLoanPrincipal,
        householdDebtDeduction: property.householdDebtDeduction,
        rentalPassiveIncomeBeforePrincipal: property.rentalPassiveIncomeBeforePrincipal,
        rentalPrincipalRepayments: property.rentalPrincipalRepayments,
        rentalHouseholdCashflowAfterPrincipal: property.rentalHouseholdCashflowAfterPrincipal,
        passiveRentalCashflow: passiveAmount,
      });
    });
    summary.total = roundCurrency(summary.interest + summary.dividends + summary.distributions + summary.rental + summary.otherPassive);
    return summary;
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
        dependants: 0,
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
        person1HecsHelpDebt: 0,
        person2HecsHelpDebt: 0,
        person1StslBalance: 0,
        person2StslBalance: 0,
        unassignedStslBalance: 0,
        stslOwnerConfirmationNeeded: false,
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
        person1HasStslDebt: null,
        person2HasStslDebt: null,
        person1HospitalCoverStatus: "",
        person2HospitalCoverStatus: "",
        person1HospitalCoverDays: 0,
        person2HospitalCoverDays: 0,
        dependantsHospitalCoverStatus: "",
        dependantsHospitalCoverDays: 0,
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
        person1EmployerSuperOverrideEnabled: false,
        person1EmployerSuperOverride: 0,
        person2EmployerSuperOverrideEnabled: false,
        person2EmployerSuperOverride: 0,
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

  function inflatedLifestyleSpending(baseAnnualSpending, inflation, years) {
    const yearCount = Math.max(0, Math.round(number(years)));
    return roundCurrency(nonNegative(baseAnnualSpending) * Math.pow(1 + number(inflation), yearCount));
  }

  function personAdjustmentValue(plan = {}, personKey = "person1", suffixes = []) {
    const prefixes = personKey === "person2" ? ["person2", "p2"] : ["person1", "p1"];
    const sources = [plan.income || {}, plan.tax || {}, plan.assumptions || {}, plan.investing || {}];
    for (const source of sources) {
      for (const prefix of prefixes) {
        for (const suffix of suffixes) {
          const key = `${prefix}${suffix}`;
          if (hasValue(source[key])) return nonNegative(source[key]);
        }
      }
    }
    return 0;
  }

  function optionalPersonAdjustmentValue(plan = {}, personKey = "person1", suffixes = []) {
    const prefixes = personKey === "person2" ? ["person2", "p2"] : ["person1", "p1"];
    const sources = [plan.income || {}, plan.tax || {}, plan.assumptions || {}, plan.investing || {}];
    for (const source of sources) {
      for (const prefix of prefixes) {
        for (const suffix of suffixes) {
          const key = `${prefix}${suffix}`;
          if (hasValue(source[key])) return nonNegative(source[key]);
        }
      }
    }
    return undefined;
  }

  function personTaxAdjustmentInputs(plan = {}, personKey = "person1") {
    return {
      reportableFringeBenefits: personAdjustmentValue(plan, personKey, ["ReportableFringeBenefits", "FringeBenefits"]),
      reportableEmployerSuperContributions: personAdjustmentValue(plan, personKey, ["ReportableEmployerSuperContributions", "ReportableSuperContributions"]),
      personalDeductibleSuperContributions: personAdjustmentValue(plan, personKey, ["PersonalDeductibleSuperContributions", "DeductibleSuperContributions"]),
      totalNetInvestmentLosses: personAdjustmentValue(plan, personKey, ["TotalNetInvestmentLosses", "NetInvestmentLosses"]),
      exemptForeignEmploymentIncome: personAdjustmentValue(plan, personKey, ["ExemptForeignEmploymentIncome"]),
      familyTrustDistributionTax: personAdjustmentValue(plan, personKey, ["FamilyTrustDistributionTax"]),
      otherMLSAdjustments: personAdjustmentValue(plan, personKey, ["OtherMLSAdjustments", "MlsAdjustments", "MLSAdjustments"]),
      mlsSurchargeBase: optionalPersonAdjustmentValue(plan, personKey, ["MLSSurchargeBase", "MlsSurchargeBase"]),
    };
  }

  function householdTaxEstimate({
    person1Income,
    person2Income,
    otherIncome,
    extraConcessionalSuper,
    dependants,
    hasPartner,
    person1MLSIncomeForThreshold,
    person2MLSIncomeForThreshold,
    person1MLSSurchargeBase,
    person2MLSSurchargeBase,
    person1HospitalCoverStatus,
    person2HospitalCoverStatus,
    dependantsHospitalCoverStatus,
    person1HospitalCoverDays,
    person2HospitalCoverDays,
    dependantsHospitalCoverDays,
    spouseForFullYear,
  }) {
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
    const medicareLevySurcharge = calculateMedicareLevySurcharge({
      person1TaxableIncome: person1TaxableAfter,
      person2TaxableIncome: person2TaxableAfter,
      person1MLSIncomeForThreshold,
      person2MLSIncomeForThreshold,
      person1MLSSurchargeBase,
      person2MLSSurchargeBase,
      person1CoverStatus: person1HospitalCoverStatus,
      person2CoverStatus: person2HospitalCoverStatus,
      dependantsHospitalCoverStatus,
      person1CoveredDays: person1HospitalCoverDays,
      person2CoveredDays: person2HospitalCoverDays,
      dependantsCoveredDays: dependantsHospitalCoverDays,
      dependants,
      hasPartner,
      spouseForFullYear,
    });
    const mlsAnnualSurcharge = medicareLevySurcharge.cannotConfirm ? null : medicareLevySurcharge.annualSurcharge;
    const mlsForTotals = nonNegative(mlsAnnualSurcharge);
    const grossContribution = nonNegative(extraConcessionalSuper);
    const contributionsTax = roundCurrency(grossContribution * SUPER_CONTRIBUTIONS_TAX_RATE);
    const netInvested = roundCurrency(grossContribution - contributionsTax);
    const personalTaxSaving = roundCurrency(Math.max(0, totalTaxBefore - totalTaxAfter));
    const afterTaxCashflowCost = roundCurrency(Math.max(0, grossContribution - personalTaxSaving));
    const marginalRate = Math.max(marginalTaxRate(person1TaxableBefore), marginalTaxRate(person2TaxableBefore));
    return {
      calculationVersion: CALCULATION_VERSION,
      financialYear: FINANCIAL_YEAR,
      taxYear: TAX_YEAR,
      person1TaxableBefore,
      person2TaxableBefore,
      person1TaxableAfter,
      person2TaxableAfter,
      taxableIncomeBeforeExtraSuper: roundCurrency(person1TaxableBefore + person2TaxableBefore),
      taxableIncomeAfterExtraSuper: roundCurrency(person1TaxableAfter + person2TaxableAfter),
      totalTaxBefore,
      totalTaxAfter,
      totalTax: roundCurrency(totalTaxAfter + mlsForTotals),
      incomeTax,
      medicareLevy,
      medicareLevyEstimateType: "simplified-2-percent",
      medicareLevyNote: "Estimated Medicare levy - simplified 2% calculation. Low-income reductions, family reductions and exemptions are not fully modelled in this audit copy.",
      medicareLevySurcharge: mlsAnnualSurcharge,
      medicareLevySurchargeEstimate: medicareLevySurcharge,
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

  function assetRecordCategory(item = {}) {
    return String(item.category || item.type || "").trim();
  }

  function assetRecordValue(item = {}) {
    return nonNegative(item.currentValue ?? item.value ?? item.balance ?? item.amount);
  }

  function assetRecordIncludesInFi(item = {}) {
    return item.includeInFI !== false
      && item.includeInFi !== false
      && item.includeInFiAssets !== false
      && item.excludeFromFI !== true
      && item.excludeFromFi !== true
      && item.isPersonalUse !== true;
  }

  function canonicalAssetRecords(plan = {}, categories = []) {
    const wanted = new Set(categories);
    const records = new Map();
    (Array.isArray(plan.assetItems) ? plan.assetItems : []).forEach((item, index) => {
      const category = assetRecordCategory(item);
      if (!wanted.has(category) || !assetRecordIncludesInFi(item)) return;
      const value = assetRecordValue(item);
      const stableId = item.assetId || item.id || item.uid || item.key || `${category}:${String(item.name || item.description || "").trim().toLowerCase()}:${index}`;
      const existing = records.get(stableId);
      if (!existing || value > 0 || assetRecordValue(existing) <= 0) {
        records.set(stableId, { ...item, category, value, canonicalAssetId: String(stableId) });
      }
    });
    return Array.from(records.values());
  }

  function assetItemTotal(plan = {}, categories = []) {
    return roundCurrency(canonicalAssetRecords(plan, categories)
      .reduce((total, item) => total + assetRecordValue(item), 0));
  }

  function canonicalAssetAmount(plan = {}, categories = [], legacyAmount = 0) {
    const records = canonicalAssetRecords(plan, categories);
    const detailedTotal = roundCurrency(records.reduce((total, item) => total + assetRecordValue(item), 0));
    const hasDetailedValue = records.some((item) => assetRecordValue(item) > 0);
    return {
      amount: hasDetailedValue ? detailedTotal : nonNegative(legacyAmount),
      detailedTotal,
      legacyAmount: nonNegative(legacyAmount),
      source: hasDetailedValue ? "assetItems" : "legacy",
      records,
    };
  }

  function rateFromPercentageField(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = number(value);
    if (!Number.isFinite(parsed)) return null;
    const rate = parsed / 100;
    return rate < -1 ? null : rate;
  }

  function rateFromDecimalField(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed < -1 ? null : parsed;
  }

  function firstFieldContractRate(candidates = []) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const rate = candidate.unit === "percent"
        ? rateFromPercentageField(candidate.value)
        : rateFromDecimalField(candidate.value);
      if (rate !== null) return rate;
    }
    return null;
  }

  function propertyGrowthRateForAsset(plan = {}, asset = {}) {
    const candidates = [
      { value: asset.propertyGrowthRatePct, unit: "percent" },
      { value: asset.capitalGrowthRatePct, unit: "percent" },
      { value: asset.expectedGrowthRatePct, unit: "percent" },
      { value: asset.growthRatePct, unit: "percent" },
      { value: asset.propertyGrowthRate, unit: "decimal" },
      { value: asset.capitalGrowthRate, unit: "decimal" },
      { value: asset.expectedGrowthRate, unit: "decimal" },
      { value: asset.growthRate, unit: "decimal" },
      { value: plan.investing?.investmentPropertyGrowthRatePct, unit: "percent" },
      { value: plan.investing?.propertyGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.investmentPropertyGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.propertyGrowthRatePct, unit: "percent" },
      { value: plan.investing?.investmentPropertyGrowthRate, unit: "decimal" },
      { value: plan.investing?.propertyGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.investmentPropertyGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.propertyGrowthRate, unit: "decimal" },
    ];
    const configuredRate = firstFieldContractRate(candidates);
    return configuredRate ?? DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE;
  }

  function principalResidenceGrowthRateForAsset(plan = {}, asset = {}) {
    const candidates = [
      { value: asset.principalResidenceGrowthRatePct, unit: "percent" },
      { value: asset.homeGrowthRatePct, unit: "percent" },
      { value: asset.propertyGrowthRatePct, unit: "percent" },
      { value: asset.capitalGrowthRatePct, unit: "percent" },
      { value: asset.expectedGrowthRatePct, unit: "percent" },
      { value: asset.growthRatePct, unit: "percent" },
      { value: asset.principalResidenceGrowthRate, unit: "decimal" },
      { value: asset.homeGrowthRate, unit: "decimal" },
      { value: asset.propertyGrowthRate, unit: "decimal" },
      { value: asset.capitalGrowthRate, unit: "decimal" },
      { value: asset.expectedGrowthRate, unit: "decimal" },
      { value: asset.growthRate, unit: "decimal" },
      { value: plan.investing?.principalResidenceGrowthRatePct, unit: "percent" },
      { value: plan.investing?.homeGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.principalResidenceGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.homeGrowthRatePct, unit: "percent" },
      { value: plan.investing?.principalResidenceGrowthRate, unit: "decimal" },
      { value: plan.investing?.homeGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.principalResidenceGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.homeGrowthRate, unit: "decimal" },
    ];
    const configuredRate = firstFieldContractRate(candidates);
    return configuredRate ?? DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE;
  }

  function investmentPropertyRecords(plan = {}) {
    const records = canonicalAssetRecords(plan, INVESTMENT_PROPERTY_ASSET_CATEGORIES);
    if (records.some((item) => assetRecordValue(item) > 0)) return records;
    const legacyValue = nonNegative(plan.assets?.otherPropertyValue);
    return legacyValue > 0
      ? [{ id: "legacy-other-property", category: "otherProperty", name: "Investment property", value: legacyValue, canonicalAssetId: "legacy-other-property" }]
      : [];
  }

  function projectedInvestmentPropertyGrossValue(plan = {}, years = 0) {
    const projectionYears = Math.max(0, number(years));
    return roundCurrency(investmentPropertyRecords(plan).reduce((total, asset) => {
      const value = assetRecordValue(asset);
      const growthRate = propertyGrowthRateForAsset(plan, asset);
      return total + value * Math.pow(1 + growthRate, projectionYears);
    }, 0));
  }

  function projectedPropertyGrowthSummary(plan = {}) {
    const properties = investmentPropertyRecords(plan)
      .map((asset) => {
        const grossValue = assetRecordValue(asset);
        const growthRate = propertyGrowthRateForAsset(plan, asset);
        return {
          id: asset.canonicalAssetId || asset.assetId || asset.id || "",
          name: asset.name || asset.description || "Investment property",
          grossValue,
          growthRate,
          annualGrowth: roundCurrency(grossValue * growthRate),
        };
      })
      .filter((asset) => asset.grossValue > 0);
    const grossValue = roundCurrency(properties.reduce((total, asset) => total + asset.grossValue, 0));
    const annualGrowth = roundCurrency(properties.reduce((total, asset) => total + asset.annualGrowth, 0));
    return {
      grossValue,
      annualGrowth,
      defaultRate: DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE,
      blendedGrowthRate: grossValue > 0 ? roundRatio(annualGrowth / grossValue) : DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE,
      properties,
    };
  }

  function liabilityItemTotal(plan = {}, categories = []) {
    const wanted = new Set(categories);
    return (Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [])
      .filter((item) => wanted.has(item.type) || wanted.has(item.category))
      .reduce((total, item) => total + nonNegative(item.balance ?? item.value ?? item.amount), 0);
  }

  function calculateNetFiAssetSummary({
    plan = {},
    currentAge = 0,
    superBalance,
    rentalPropertyDebt,
    downsizingBoost = 0,
    projectedInvestmentBalance,
    projectedInvestmentPropertyGrossValue,
    projectedSuperBalance,
    includeSuperOverride,
  } = {}) {
    const assets = plan.assets || {};
    const cashAsset = canonicalAssetAmount(plan, ["cash"], assets.cash);
    const offsetAsset = canonicalAssetAmount(plan, ["offset"], assets.offsetBalance);
    const sharesAsset = canonicalAssetAmount(plan, ["shares", "share", "etf"], assets.sharesEtfs);
    const cryptoAsset = canonicalAssetAmount(plan, ["crypto", "cryptocurrency"], assets.crypto ?? assets.cryptocurrency);
    const managedFundAsset = canonicalAssetAmount(plan, ["managedFund", "managedFunds"], assets.managedFunds);
    const investmentBondAsset = canonicalAssetAmount(plan, ["investmentBond", "investmentBonds"], assets.investmentBonds);
    const otherInvestableAsset = canonicalAssetAmount(
      plan,
      ["businessInvestment", "privateInvestment", "otherInvestment", "other"],
      nonNegative(assets.businessInvestments) + nonNegative(assets.privateInvestments) + nonNegative(assets.otherInvestmentAssets),
    );
    const investmentProjectionStartingBalance = roundCurrency(Number.isFinite(Number(projectedInvestmentBalance))
      ? nonNegative(projectedInvestmentBalance)
      : cashAsset.amount
        + sharesAsset.amount
        + cryptoAsset.amount
        + managedFundAsset.amount
        + investmentBondAsset.amount
        + otherInvestableAsset.amount
        + downsizingBoost);
    const grossLiquidInvestmentAssets = roundCurrency(investmentProjectionStartingBalance + offsetAsset.amount);
    const otherInvestmentDebt = liabilityItemTotal(plan, ["investmentLoan", "shareInvestmentLoan", "managedFundLoan"]);
    const liquidInvestmentAssets = roundCurrency(Math.max(0, grossLiquidInvestmentAssets - otherInvestmentDebt));
    const investmentPropertyAsset = canonicalAssetAmount(plan, INVESTMENT_PROPERTY_ASSET_CATEGORIES, assets.otherPropertyValue);
    const investmentPropertyGrossValue = roundCurrency(Number.isFinite(Number(projectedInvestmentPropertyGrossValue))
      ? nonNegative(projectedInvestmentPropertyGrossValue)
      : investmentPropertyAsset.amount);
    const investmentPropertyDebt = roundCurrency(nonNegative(rentalPropertyDebt) || liabilityItemTotal(plan, ["rentalPropertyLoan"]));
    const investmentPropertyEquity = roundCurrency(Math.max(0, investmentPropertyGrossValue - investmentPropertyDebt));
    const availableSuperBalance = roundCurrency(Number.isFinite(Number(projectedSuperBalance))
      ? nonNegative(projectedSuperBalance)
      : Number.isFinite(Number(superBalance))
        ? nonNegative(superBalance)
        : nonNegative(assets.superPerson1) + nonNegative(assets.superPerson2));
    const superIncludedInNetFiAssets = includeSuperOverride ?? (nonNegative(currentAge) >= SUPER_ACCESS_AGE);
    const superIncludedAmount = superIncludedInNetFiAssets ? availableSuperBalance : 0;
    const netFiAssets = roundCurrency(liquidInvestmentAssets + investmentPropertyEquity + superIncludedAmount);
    return {
      canonicalAssetSource: {
        cash: cashAsset.source,
        offset: offsetAsset.source,
        sharesEtfs: sharesAsset.source,
        crypto: cryptoAsset.source,
        investmentProperty: investmentPropertyAsset.source,
      },
      cashFiAssets: cashAsset.amount,
      offsetFiAssets: offsetAsset.amount,
      sharesEtfsFiAssets: sharesAsset.amount,
      cryptoFiAssets: cryptoAsset.amount,
      managedFundFiAssets: managedFundAsset.amount,
      investmentBondFiAssets: investmentBondAsset.amount,
      otherInvestableFiAssets: otherInvestableAsset.amount,
      investmentProjectionStartingBalance,
      grossLiquidInvestmentAssets,
      liquidInvestmentAssets,
      otherInvestmentDebt,
      investmentPropertyGrossValue,
      investmentPropertyDebt,
      investmentPropertyEquity,
      superBalance: availableSuperBalance,
      superIncludedInNetFiAssets,
      superIncludedAmount,
      netFiAssets,
      totalIncomeProducingAssets: roundCurrency(liquidInvestmentAssets + investmentPropertyEquity + availableSuperBalance),
    };
  }

  function calculateNetFIAssets(financialData = {}) {
    return calculateNetFiAssetSummary(financialData).netFiAssets;
  }

  function calculatePlan(planInput) {
    const plan = clonePlan(planInput);
    const loan = calculateLoanSummary(plan);
    const currentAge = nonNegative(plan.personal.person1Age);
    const downsizingBoost = downsizingInvestmentBoost(plan);
    const stslItems = Array.isArray(plan.liabilityItems)
      ? plan.liabilityItems.filter((item) => item.type === "hecsHelp" || item.type === "stsl")
      : [];
    const stslOwnedBy = (owner) => stslItems
      .filter((item) => item.owner === owner)
      .reduce((total, item) => total + nonNegative(item.balance), 0);
    const unassignedStslBalance = stslItems
      .filter((item) => !item.owner || item.owner === "joint")
      .reduce((total, item) => total + nonNegative(item.balance), 0);
    const person1StslItemBalance = stslOwnedBy("person1");
    const person2StslItemBalance = stslOwnedBy("person2");
    const person1LegacyStslBalance = nonNegative(plan.liabilities.person1HecsHelpDebt || plan.liabilities.person1StslBalance);
    const person2LegacyStslBalance = nonNegative(plan.liabilities.person2HecsHelpDebt || plan.liabilities.person2StslBalance);
    const person1StslBalance = roundCurrency(person1StslItemBalance > 0 ? person1StslItemBalance : person1LegacyStslBalance);
    const person2StslBalance = roundCurrency(person2StslItemBalance > 0 ? person2StslItemBalance : person2LegacyStslBalance);
    const ownedStudyLoanBalance = roundCurrency(person1StslBalance + person2StslBalance + unassignedStslBalance);
    const legacyStudyLoanBalance = nonNegative(plan.liabilities.hecsHelpDebt);
    const totalStudyLoanBalance = roundCurrency(Math.max(legacyStudyLoanBalance, ownedStudyLoanBalance));
    const rentalPropertyLoanBalance = roundCurrency((Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [])
      .filter((item) => item.type === "rentalPropertyLoan")
      .reduce((total, item) => total + nonNegative(item.balance), 0));
    const rentalPropertyCashflow = calculateRentalCashflowSummary(plan);
    const passiveIncomeSummary = passiveIncomeBreakdown(plan, rentalPropertyCashflow);
    const annualPassiveIncome = roundCurrency(passiveIncomeSummary.total);
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
      + totalStudyLoanBalance
      + rentalPropertyLoanBalance
      + nonNegative(plan.liabilities.otherDebts)
      + creditCardBalance,
    );
    const currentNetWorth = roundCurrency(totalAssets - totalLiabilities);
    const superannuationBalance = roundCurrency(
      nonNegative(plan.assets.superPerson1)
      + nonNegative(plan.assets.superPerson2),
    );
    const currentFiAssetSummary = calculateNetFiAssetSummary({
      plan,
      currentAge,
      superBalance: superannuationBalance,
      rentalPropertyDebt: rentalPropertyLoanBalance,
      downsizingBoost,
    });
    const accessibleInvestmentAssets = currentFiAssetSummary.liquidInvestmentAssets;
    const investmentBalance = roundCurrency(
      currentFiAssetSummary.investmentProjectionStartingBalance,
    );
    const liquidInvestmentAssets = currentFiAssetSummary.liquidInvestmentAssets;
    const grossLiquidInvestmentAssets = currentFiAssetSummary.grossLiquidInvestmentAssets;
    const otherInvestmentDebt = currentFiAssetSummary.otherInvestmentDebt;
    const investmentPropertyGrossValue = currentFiAssetSummary.investmentPropertyGrossValue;
    const investmentPropertyDebt = currentFiAssetSummary.investmentPropertyDebt;
    const investmentPropertyEquity = currentFiAssetSummary.investmentPropertyEquity;
    const includeInvestmentPropertyEquityInFi = investmentPropertyEquity > 0;
    const superAccessibleToday = currentFiAssetSummary.superIncludedAmount;
    const accessibleFICapital = currentFiAssetSummary.netFiAssets;
    const totalIncomeProducingAssets = currentFiAssetSummary.totalIncomeProducingAssets;
    const financialIndependenceAssets = accessibleFICapital;
    const incomeSummary = incomeBreakdown(plan, rentalPropertyCashflow);
    const person1AnnualIncome = incomeSummary.person1Taxable;
    const person2AnnualIncome = incomeSummary.person2Taxable;
    const person1SalaryWages = incomeSummary.person1Salary;
    const person2SalaryWages = incomeSummary.person2Salary;
    const otherAnnualIncome = incomeSummary.otherIncome;
    const annualGrossIncome = incomeSummary.total;
    const stslSelectionValues = [plan.income.person1HasStslDebt, plan.income.person2HasStslDebt, plan.income.person1HasHelpDebt, plan.income.person2HasHelpDebt];
    const hasExplicitStslSelection = stslSelectionValues.some((value) => value === true)
      || (stslItems.length > 0 && stslSelectionValues.some((value) => value === false));
    const legacyOwnerFallback = legacyStudyLoanBalance > 0 && ownedStudyLoanBalance === 0 && !hasExplicitStslSelection;
    const legacyPersonBalanceFallback = !stslItems.length && !hasExplicitStslSelection;
    const fallbackPerson1HasStsl = legacyOwnerFallback
      ? person1AnnualIncome >= person2AnnualIncome
      : legacyPersonBalanceFallback && person1StslBalance > 0;
    const fallbackPerson2HasStsl = legacyOwnerFallback
      ? person2AnnualIncome > person1AnnualIncome
      : legacyPersonBalanceFallback && person2StslBalance > 0;
    const person1HasStsl = !hasExplicitStslSelection && (legacyOwnerFallback || legacyPersonBalanceFallback)
      ? fallbackPerson1HasStsl
      : booleanWithLegacy(plan.income.person1HasStslDebt, plan.income.person1HasHelpDebt, false);
    const person2HasStsl = !hasExplicitStslSelection && (legacyOwnerFallback || legacyPersonBalanceFallback)
      ? fallbackPerson2HasStsl
      : booleanWithLegacy(plan.income.person2HasStslDebt, plan.income.person2HasHelpDebt, false);
    const extraSuperSplitForTax = splitAdditionalContribution(plan.investing.extraSuperContributions, person1AnnualIncome, person2AnnualIncome);
    const person1TaxableAfterExtraSuper = roundCurrency(Math.max(0, person1AnnualIncome - extraSuperSplitForTax.person1));
    const person2TaxableAfterExtraSuper = roundCurrency(Math.max(0, person2AnnualIncome - extraSuperSplitForTax.person2));
    const person1TaxAdjustments = personTaxAdjustmentInputs(plan, "person1");
    const person2TaxAdjustments = personTaxAdjustmentInputs(plan, "person2");
    const person1MLSIncomeForThreshold = calculatePersonMLSIncomeForThreshold({
      taxableIncome: person1TaxableAfterExtraSuper,
      ...person1TaxAdjustments,
    });
    const person2MLSIncomeForThreshold = calculatePersonMLSIncomeForThreshold({
      taxableIncome: person2TaxableAfterExtraSuper,
      ...person2TaxAdjustments,
    });
    const person1MLSSurchargeBase = calculatePersonMLSSurchargeBase({
      taxableIncome: person1TaxableAfterExtraSuper,
      explicitSurchargeBase: person1TaxAdjustments.mlsSurchargeBase,
    });
    const person2MLSSurchargeBase = calculatePersonMLSSurchargeBase({
      taxableIncome: person2TaxableAfterExtraSuper,
      explicitSurchargeBase: person2TaxAdjustments.mlsSurchargeBase,
    });
    const stslRepaymentIncome = {
      person1: calculatePersonSTSLRepaymentIncome({
        taxableIncomeBeforeFHSSAdjustments: person1TaxableAfterExtraSuper,
        ...person1TaxAdjustments,
        personalDeductibleSuperContributions: roundCurrency(person1TaxAdjustments.personalDeductibleSuperContributions + extraSuperSplitForTax.person1),
      }),
      person2: calculatePersonSTSLRepaymentIncome({
        taxableIncomeBeforeFHSSAdjustments: person2TaxableAfterExtraSuper,
        ...person2TaxAdjustments,
        personalDeductibleSuperContributions: roundCurrency(person2TaxAdjustments.personalDeductibleSuperContributions + extraSuperSplitForTax.person2),
      }),
    };
    const person1StslRepayment = estimateStudyLoanRepayment(stslRepaymentIncome.person1, person1StslBalance, person1HasStsl);
    const person2StslRepayment = estimateStudyLoanRepayment(stslRepaymentIncome.person2, person2StslBalance, person2HasStsl);
    const taxEstimate = householdTaxEstimate({
      person1Income: person1AnnualIncome,
      person2Income: person2AnnualIncome,
      otherIncome: 0,
      extraConcessionalSuper: plan.investing.extraSuperContributions,
      dependants: plan.personal.dependants,
      hasPartner: Boolean(plan.personal.person2Name || plan.personal.person2Age || person2AnnualIncome),
      person1MLSIncomeForThreshold,
      person2MLSIncomeForThreshold,
      person1MLSSurchargeBase,
      person2MLSSurchargeBase,
      person1HospitalCoverStatus: plan.income.person1HospitalCoverStatus,
      person2HospitalCoverStatus: plan.income.person2HospitalCoverStatus,
      dependantsHospitalCoverStatus: plan.income.dependantsHospitalCoverStatus,
      person1HospitalCoverDays: plan.income.person1HospitalCoverDays,
      person2HospitalCoverDays: plan.income.person2HospitalCoverDays,
      dependantsHospitalCoverDays: plan.income.dependantsHospitalCoverDays,
      spouseForFullYear: plan.personal.spouseForFullYear ?? plan.income.spouseForFullYear ?? true,
    });
    const helpRepaymentIncome = calculateHelpRepaymentIncome({
      person1Income: person1AnnualIncome,
      person2Income: person2AnnualIncome,
      otherIncome: 0,
      extraConcessionalSuper: plan.investing.extraSuperContributions,
    });
    const payrollEstimate = calculatePayrollEstimate({
      person1Income: person1SalaryWages,
      person2Income: person2SalaryWages,
      extraConcessionalSuper: plan.investing.extraSuperContributions,
      helpDebt: plan.liabilities.hecsHelpDebt,
      person1HelpDebt: person1StslBalance,
      person2HelpDebt: person2StslBalance,
      person1SalarySacrifice: plan.investing.person1SalarySacrifice,
      person2SalarySacrifice: plan.investing.person2SalarySacrifice,
      person1PayrollDeductions: plan.income.person1PayrollDeductions,
      person2PayrollDeductions: plan.income.person2PayrollDeductions,
      person1HasStslDebt: person1HasStsl,
      person2HasStslDebt: person2HasStsl,
      person1HasHelpDebt: plan.income.person1HasHelpDebt,
      person2HasHelpDebt: plan.income.person2HasHelpDebt,
      person1StslRepaymentIncome: stslRepaymentIncome.person1,
      person2StslRepaymentIncome: stslRepaymentIncome.person2,
    });
    payrollEstimate.person1.stslCompulsoryRepayment = person1StslRepayment.annualRepayment;
    payrollEstimate.person1.helpRepayment = person1StslRepayment.annualRepayment;
    payrollEstimate.person1.repaymentIncome = stslRepaymentIncome.person1;
    payrollEstimate.person1.stslProjectedClosingBalance = roundCurrency(Math.max(0, person1StslBalance - person1StslRepayment.annualRepayment));
    payrollEstimate.person2.stslCompulsoryRepayment = person2StslRepayment.annualRepayment;
    payrollEstimate.person2.helpRepayment = person2StslRepayment.annualRepayment;
    payrollEstimate.person2.repaymentIncome = stslRepaymentIncome.person2;
    payrollEstimate.person2.stslProjectedClosingBalance = roundCurrency(Math.max(0, person2StslBalance - person2StslRepayment.annualRepayment));
    payrollEstimate.household.stslCompulsoryRepayment = roundCurrency(person1StslRepayment.annualRepayment + person2StslRepayment.annualRepayment);
    payrollEstimate.household.helpRepayment = payrollEstimate.household.stslCompulsoryRepayment;
    payrollEstimate.household.totalStslCompulsoryRepayments = payrollEstimate.household.stslCompulsoryRepayment;
    const helpRepaymentEstimate = {
      balance: totalStudyLoanBalance,
      repaymentIncome: roundCurrency(stslRepaymentIncome.person1 + stslRepaymentIncome.person2),
      annualRepayment: roundCurrency(person1StslRepayment.annualRepayment + person2StslRepayment.annualRepayment),
      monthlyRepayment: roundCurrency((person1StslRepayment.annualRepayment + person2StslRepayment.annualRepayment) / MONTHS_PER_YEAR),
      personLevelRepaymentIncome: stslRepaymentIncome,
      person1: {
        hasDebt: person1HasStsl,
        openingBalance: person1StslBalance,
        balance: person1StslBalance,
        repaymentIncome: stslRepaymentIncome.person1,
        annualRepayment: person1StslRepayment.annualRepayment,
        projectedClosingBalance: roundCurrency(Math.max(0, person1StslBalance - person1StslRepayment.annualRepayment)),
        effectOnNetIncome: person1StslRepayment.annualRepayment,
      },
      person2: {
        hasDebt: person2HasStsl,
        openingBalance: person2StslBalance,
        balance: person2StslBalance,
        repaymentIncome: stslRepaymentIncome.person2,
        annualRepayment: person2StslRepayment.annualRepayment,
        projectedClosingBalance: roundCurrency(Math.max(0, person2StslBalance - person2StslRepayment.annualRepayment)),
        effectOnNetIncome: person2StslRepayment.annualRepayment,
      },
      projectedClosingBalance: roundCurrency(Math.max(0, totalStudyLoanBalance - person1StslRepayment.annualRepayment - person2StslRepayment.annualRepayment)),
      estimatedYearsToRepay: (person1StslRepayment.annualRepayment + person2StslRepayment.annualRepayment) > 0 && totalStudyLoanBalance > 0
        ? roundRatio(totalStudyLoanBalance / (person1StslRepayment.annualRepayment + person2StslRepayment.annualRepayment))
        : null,
      note: "Estimate only. STSL compulsory repayments use each selected person's repayment income, including allocated taxable investment income and available reportable adjustments, and are capped by entered balances when available.",
    };
    const expenseBreakdown = annualExpenseBreakdown(plan);
    const annualCoreLivingExpenses = expenseBreakdown.living;
    const annualOtherRegularExpenses = expenseBreakdown.otherRegular;
    const annualExpenses = expenseBreakdown.total;
    const annualLivingExpenses = annualExpenses;
    const annualMortgageRepayments = roundCurrency(nonNegative(plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments) * MONTHS_PER_YEAR);
    const annualCreditCardRepayments = roundCurrency(nonNegative(plan.liabilities.creditCardMonthlyRepayment) * MONTHS_PER_YEAR);
    const annualRentalLoanCashflowRepayments = roundCurrency(rentalPropertyCashflow.annualHouseholdDebtDeduction);
    const annualDebtRepayments = roundCurrency(annualMortgageRepayments + annualCreditCardRepayments + annualRentalLoanCashflowRepayments);
    const medicareLevySurchargeForCashflow = nonNegative(taxEstimate.medicareLevySurcharge);
    const estimatedTaxAndHelp = roundCurrency(taxEstimate.incomeTax + taxEstimate.medicareLevy + medicareLevySurchargeForCashflow + helpRepaymentEstimate.annualRepayment);
    const netIncomeAfterTaxHelp = roundCurrency(annualGrossIncome - taxEstimate.incomeTax - taxEstimate.medicareLevy - medicareLevySurchargeForCashflow - helpRepaymentEstimate.annualRepayment);
    const annualInvestmentContributions = roundCurrency(nonNegative(plan.investing.annualInvestingTarget));
    const annualExtraSuperContributions = roundCurrency(nonNegative(plan.investing.extraSuperContributions));
    const cashSurplusBeforeInvesting = roundCurrency(netIncomeAfterTaxHelp - annualCoreLivingExpenses - annualDebtRepayments - annualOtherRegularExpenses);
    const cashSurplusAfterInvesting = roundCurrency(cashSurplusBeforeInvesting - annualInvestmentContributions - annualExtraSuperContributions);
    const finalProjectedCashSurplus = cashSurplusAfterInvesting;
    const cashSurplusAfterTaxHelpAndInvesting = finalProjectedCashSurplus;
    const firstYearMortgagePrincipalReduction = roundCurrency(loan.schedule.slice(0, 12).reduce((total, row) => total + Math.max(0, row.principalRepaid), 0));
    const employerSuper = employerSuperSummary(plan);
    const grossEmployerSuperContributions = nonNegative(employerSuper.totalEffective);
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
    const enteredSafeWithdrawalRate = annualRate(plan.investing.safeWithdrawalRatePct);
    const safeWithdrawalRate = enteredSafeWithdrawalRate > 0 ? enteredSafeWithdrawalRate : 0.04;
    const expectedInvestmentReturn = annualRate(plan.investing.expectedInvestmentReturnPct);
    const expectedSuperReturn = annualRate(plan.investing.expectedSuperReturnPct);
    const inflation = annualRate(plan.investing.inflationPct);
    const grossGrowthInvestmentAssets = roundCurrency(
      currentFiAssetSummary.sharesEtfsFiAssets
      + currentFiAssetSummary.cryptoFiAssets
      + currentFiAssetSummary.managedFundFiAssets
      + currentFiAssetSummary.investmentBondFiAssets
      + currentFiAssetSummary.otherInvestableFiAssets,
    );
    const projectedFinancialInvestmentGrowthBase = grossGrowthInvestmentAssets;
    const projectedFinancialInvestmentGrowth = roundCurrency(projectedFinancialInvestmentGrowthBase * expectedInvestmentReturn);
    const propertyGrowthSummary = projectedPropertyGrowthSummary(plan);
    const projectedPropertyGrowthBase = propertyGrowthSummary.grossValue;
    const projectedPropertyGrowthRate = propertyGrowthSummary.blendedGrowthRate;
    const projectedPropertyGrowth = propertyGrowthSummary.annualGrowth;
    const projectedInvestmentGrowthBase = projectedFinancialInvestmentGrowthBase;
    const projectedInvestmentGrowth = projectedFinancialInvestmentGrowth;
    const combinedWealthCreation = roundCurrency(annualPassiveIncome + projectedFinancialInvestmentGrowth + projectedPropertyGrowth);
    const freedMonthlyRepayments = Array.from({ length: 360 }, (_, monthIndex) => {
      if (!loan.payoffMonth) return 0;
      return monthIndex + 1 > loan.payoffMonth ? nonNegative(plan.liabilities.monthlyRepayment || plan.expenses.mortgageRepayments) : 0;
    });
    const investmentProjection = projectBalance({
      startingBalance: investmentBalance,
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
    const targetAnnualLifestyleSpending = nonNegative(plan.personal.targetAnnualSpending);
    const targetProjectionAge = nonNegative(plan.personal.fullRetirementAge) || currentAge;
    const targetProjectionYear = Math.max(0, Math.min(30, Math.round(targetProjectionAge - currentAge)));
    const targetAnnualLifestyleSpendingAtFinancialFreedomAge = inflatedLifestyleSpending(targetAnnualLifestyleSpending, inflation, targetProjectionYear);
    const currentYearTargetCapital = safeWithdrawalRate > 0 ? roundCurrency(targetAnnualLifestyleSpending / safeWithdrawalRate) : 0;
    const targetCapital = safeWithdrawalRate > 0 ? roundCurrency(targetAnnualLifestyleSpendingAtFinancialFreedomAge / safeWithdrawalRate) : 0;
    const estimatedSustainableIncomeFromCurrentFiAssets = roundCurrency(financialIndependenceAssets * safeWithdrawalRate);
    const passiveIncomeCoveragePercent = targetAnnualLifestyleSpending > 0 ? Math.max(0, roundRatio(annualPassiveIncome / targetAnnualLifestyleSpending * 100)) : 0;
    const lifestyleFundingPercent = targetAnnualLifestyleSpending > 0 ? Math.max(0, roundRatio(estimatedSustainableIncomeFromCurrentFiAssets / targetAnnualLifestyleSpending * 100)) : 0;
    const financialFreedomProgressRaw = targetCapital > 0 ? Math.max(0, roundRatio(financialIndependenceAssets / targetCapital * 100)) : 0;
    const financialFreedomScore = Math.min(100, financialFreedomProgressRaw);
    const fiTargetRemaining = roundCurrency(Math.max(0, targetCapital - financialIndependenceAssets));
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
      const projectionYears = Math.max(0, item.age - currentAge);
      const milestoneAnnualLifestyleSpending = inflatedLifestyleSpending(targetAnnualLifestyleSpending, inflation, projectionYears);
      const milestoneTargetCapital = safeWithdrawalRate > 0 ? milestoneAnnualLifestyleSpending / safeWithdrawalRate : 0;
      const projectedFiSummary = calculateNetFiAssetSummary({
        plan,
        currentAge: item.age,
        superBalance: superannuationBalance,
        projectedSuperBalance: superRow.closingBalance,
        rentalPropertyDebt: rentalPropertyLoanBalance,
        projectedInvestmentBalance: investment.closingBalance,
        projectedInvestmentPropertyGrossValue: projectedInvestmentPropertyGrossValue(plan, projectionYears),
      });
      const projectedFiAssets = projectedFiSummary.netFiAssets;
      const requiredCapital = roundCurrency(milestoneTargetCapital * item.coverage);
      return {
        ...item,
        projectedFiAssets,
        requiredCapital,
        inflatedAnnualLifestyleSpending: milestoneAnnualLifestyleSpending,
        targetCapital: roundCurrency(milestoneTargetCapital),
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
        firstYearDraw: inflatedLifestyleSpending(targetAnnualLifestyleSpending, inflation, Math.max(0, fullRetirementAge - currentAge)),
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
    const netWorthProjection = investmentProjection.map((row, index) => {
      const year = index + 1;
      const residenceValue = plan.downsizing?.enabled && nonNegative(plan.downsizing.futurePropertyValue) > 0
        ? nonNegative(plan.downsizing.futurePropertyValue)
        : nonNegative(plan.assets.homeValue);
      const homeValue = residenceValue * Math.pow(1 + principalResidenceGrowthRateForAsset(plan, { category: "home" }), year);
      const investmentPropertyValue = projectedInvestmentPropertyGrossValue(plan, year);
      const loanBalance = balanceAtMonth(loan.schedule, loan.finalBalance, year * MONTHS_PER_YEAR);
      const projectedStudyLoanBalance = Math.max(0, totalStudyLoanBalance - helpRepaymentEstimate.annualRepayment * year);
      const closingBalance = roundCurrency(homeValue + investmentPropertyValue + nonNegative(plan.assets.vehiclesPersonalAssets) + nonNegative(plan.assets.offsetBalance) + row.closingBalance + superProjection[index].closingBalance - loanBalance - projectedStudyLoanBalance - nonNegative(plan.liabilities.otherDebts) - creditCardBalance);
      return { year, age: currentAge + year, closingBalance };
    });
    const financialFreedomProgressProjection = investmentProjection.map((row, index) => {
      const inflatedAnnualLifestyleSpending = inflatedLifestyleSpending(targetAnnualLifestyleSpending, inflation, row.year);
      const requiredCapital = safeWithdrawalRate > 0 ? inflatedAnnualLifestyleSpending / safeWithdrawalRate : 0;
      const projectedFiSummary = calculateNetFiAssetSummary({
        plan,
        currentAge: row.age,
        superBalance: superannuationBalance,
        projectedSuperBalance: superProjection[index].closingBalance,
        rentalPropertyDebt: rentalPropertyLoanBalance,
        projectedInvestmentBalance: row.closingBalance,
        projectedInvestmentPropertyGrossValue: projectedInvestmentPropertyGrossValue(plan, row.year),
      });
      return {
        year: row.year,
        age: row.age,
        netFiAssets: projectedFiSummary.netFiAssets,
        estimatedSustainableIncome: roundCurrency(projectedFiSummary.netFiAssets * safeWithdrawalRate),
        inflatedAnnualLifestyleSpending,
        requiredCapital: roundCurrency(requiredCapital),
        progress: requiredCapital > 0 ? Math.min(200, roundRatio(projectedFiSummary.netFiAssets / requiredCapital * 100)) : 0,
      };
    });
    const targetInvestmentRow = targetProjectionYear > 0 ? investmentProjection[targetProjectionYear - 1] : { closingBalance: investmentBalance, age: currentAge, year: 0 };
    const targetSuperRow = targetProjectionYear > 0 ? superProjection[targetProjectionYear - 1] : { closingBalance: superannuationBalance };
    const targetAgeFiAssetSummary = calculateNetFiAssetSummary({
      plan,
      currentAge: targetProjectionAge,
      superBalance: superannuationBalance,
      projectedSuperBalance: targetSuperRow?.closingBalance || superannuationBalance,
      rentalPropertyDebt: rentalPropertyLoanBalance,
      projectedInvestmentBalance: targetInvestmentRow?.closingBalance || investmentBalance,
      projectedInvestmentPropertyGrossValue: projectedInvestmentPropertyGrossValue(plan, targetProjectionYear),
    });
    const people = {
      person1: {
        id: "person1",
        name: plan.personal.person1Name || "Person 1",
        taxableIncome: person1AnnualIncome,
        salaryAndWages: person1SalaryWages,
        stsl: {
          hasDebt: person1HasStsl,
          openingBalance: person1StslBalance,
          estimatedCompulsoryRepayment: helpRepaymentEstimate.person1.annualRepayment,
          projectedClosingBalance: helpRepaymentEstimate.person1.projectedClosingBalance,
        },
        privateHealth: {
          hasAppropriateHospitalCover: hospitalCoverDays(plan.income.person1HospitalCoverStatus, plan.income.person1HospitalCoverDays) === DAYS_PER_YEAR,
          coveredForFullYear: plan.income.person1HospitalCoverStatus === "full-year",
          coveredDays: hospitalCoverDays(plan.income.person1HospitalCoverStatus, plan.income.person1HospitalCoverDays),
        },
        super: {
          employerContributionAutoAmount: employerSuper.person1Calculated,
          employerContributionOverride: nonNegative(plan.investing.person1EmployerSuperOverride),
          useManualEmployerContribution: Boolean(plan.investing.person1EmployerSuperOverrideEnabled),
          employerContributionAmount: employerSuper.person1Amount,
        },
      },
      person2: {
        id: "person2",
        name: plan.personal.person2Name || "Person 2",
        taxableIncome: person2AnnualIncome,
        salaryAndWages: person2SalaryWages,
        stsl: {
          hasDebt: person2HasStsl,
          openingBalance: person2StslBalance,
          estimatedCompulsoryRepayment: helpRepaymentEstimate.person2.annualRepayment,
          projectedClosingBalance: helpRepaymentEstimate.person2.projectedClosingBalance,
        },
        privateHealth: {
          hasAppropriateHospitalCover: hospitalCoverDays(plan.income.person2HospitalCoverStatus, plan.income.person2HospitalCoverDays) === DAYS_PER_YEAR,
          coveredForFullYear: plan.income.person2HospitalCoverStatus === "full-year",
          coveredDays: hospitalCoverDays(plan.income.person2HospitalCoverStatus, plan.income.person2HospitalCoverDays),
        },
        super: {
          employerContributionAutoAmount: employerSuper.person2Calculated,
          employerContributionOverride: nonNegative(plan.investing.person2EmployerSuperOverride),
          useManualEmployerContribution: Boolean(plan.investing.person2EmployerSuperOverrideEnabled),
          employerContributionAmount: employerSuper.person2Amount,
        },
      },
    };

    return {
      calculationVersion: CALCULATION_VERSION,
      financialYear: FINANCIAL_YEAR,
      plan,
      people,
      loan,
      totalAssets,
      totalLiabilities,
      currentNetWorth,
      investmentBalance,
      accessibleInvestmentAssets,
      canonicalAssetSource: currentFiAssetSummary.canonicalAssetSource,
      cashFiAssets: currentFiAssetSummary.cashFiAssets,
      offsetFiAssets: currentFiAssetSummary.offsetFiAssets,
      sharesEtfsFiAssets: currentFiAssetSummary.sharesEtfsFiAssets,
      cryptoFiAssets: currentFiAssetSummary.cryptoFiAssets,
      managedFundFiAssets: currentFiAssetSummary.managedFundFiAssets,
      investmentBondFiAssets: currentFiAssetSummary.investmentBondFiAssets,
      otherInvestableFiAssets: currentFiAssetSummary.otherInvestableFiAssets,
      investmentProjectionStartingBalance: currentFiAssetSummary.investmentProjectionStartingBalance,
      grossLiquidInvestmentAssets,
      liquidInvestmentAssets,
      otherInvestmentDebt,
      investmentPropertyGrossValue,
      investmentPropertyDebt,
      investmentPropertyEquity,
      includeInvestmentPropertyEquityInFi,
      accessibleFICapital,
      totalIncomeProducingAssets,
      fiAssetPolicy: {
        includeInvestmentPropertyEquityInFi,
        superIncludedInCurrentNetFiAssets: currentFiAssetSummary.superIncludedInNetFiAssets,
        note: "Financial Freedom progress uses current net FI assets divided by target FI assets. FI assets include liquid investment assets and net rental/investment-property equity, exclude the family home and personal-use assets, and include super only once it is accessible in the model.",
      },
      superannuationBalance,
      superAccessibleToday,
      superAccessAge: SUPER_ACCESS_AGE,
      currentNetFiAssets: financialIndependenceAssets,
      financialIndependenceAssets,
      effectiveMortgageBalance: loan.offsetBenefit.effectiveLoanBalance,
      annualGrossIncome,
      annualNetIncome: annualGrossIncome,
      person1AnnualIncome,
      person2AnnualIncome,
      person1SalaryWages,
      person2SalaryWages,
      incomeBreakdown: incomeSummary,
      otherAnnualIncome,
      passiveIncomeBreakdown: passiveIncomeSummary,
      annualPassiveIncome,
      projectedFinancialInvestmentGrowthBase,
      projectedFinancialInvestmentGrowth,
      projectedInvestmentGrowthBase,
      projectedInvestmentGrowth,
      projectedPropertyGrowthBase,
      projectedPropertyGrowthRate,
      projectedPropertyGrowthDefaultRate: DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE,
      projectedPropertyGrowth,
      projectedPropertyGrowthProperties: propertyGrowthSummary.properties,
      combinedWealthCreation,
      targetAnnualLifestyleSpendingToday: targetAnnualLifestyleSpending,
      targetAnnualLifestyleSpendingAtFinancialFreedomAge,
      targetProjectionAge,
      targetProjectionYear,
      currentYearTargetCapital,
      passiveIncomeCoveragePercent,
      lifestyleFundingPercent,
      estimatedSustainableIncomeFromCurrentFiAssets,
      financialFreedomProgressRaw,
      financialFreedomProgressDisplay: financialFreedomScore,
      fiTargetRemaining,
      targetAgeNetFiAssets: targetAgeFiAssetSummary.netFiAssets,
      targetAgeEstimatedSustainableIncome: roundCurrency(targetAgeFiAssetSummary.netFiAssets * safeWithdrawalRate),
      targetAgeSuperIncludedInNetFiAssets: targetAgeFiAssetSummary.superIncludedInNetFiAssets,
      annualExpenses,
      annualLivingExpenses,
      annualCoreLivingExpenses,
      annualOtherRegularExpenses,
      annualMortgageRepayments,
      annualCreditCardRepayments,
      annualRentalLoanCashflowRepayments,
      annualDebtRepayments,
      rentalPropertyLoanBalance,
      rentalPropertyCashflow,
      rentalPropertySummary: rentalPropertyCashflow,
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
      employerSuperRate: EMPLOYER_SUPER_RATE,
      employerSuperContributions: employerSuper,
      superContributionsTaxPaid,
      superContributionsTaxRate: SUPER_CONTRIBUTIONS_TAX_RATE,
      taxEstimate,
      payrollEstimates: payrollEstimate,
      payrollEstimate,
      helpRepaymentEstimate,
      stslRepaymentEstimate: helpRepaymentEstimate,
      stslRepaymentIncome,
      personTaxAdjustments: {
        person1: person1TaxAdjustments,
        person2: person2TaxAdjustments,
      },
      helpRepaymentIncome,
      taxConfiguration: {
        calculationVersion: CALCULATION_VERSION,
        financialYear: FINANCIAL_YEAR,
        taxYear: TAX_YEAR,
        financialYearConfig: ACTIVE_CONFIG,
        availableFinancialYears: Object.keys(FINANCIAL_YEAR_CONFIGS),
        stslThreshold: HELP_THRESHOLD,
        employerSuperRate: EMPLOYER_SUPER_RATE,
        employerSuperMaximumContributionBase: EMPLOYER_SUPER_MAXIMUM_CONTRIBUTION_BASE,
        concessionalSuperCap: CONCESSIONAL_SUPER_CAP,
        medicareLevyRate: MEDICARE_LEVY_RATE,
        medicareLevySurchargeThresholds: MLS_THRESHOLDS_2026_27,
      },
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
    CALCULATION_VERSION,
    FINANCIAL_YEAR,
    DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE,
    DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE,
    emptyPlan,
    clonePlan,
    annualize,
    annualRecurringExpenses,
    financialYearConfigs: FINANCIAL_YEAR_CONFIGS,
    calculateResidentIncomeTax2026_27: taxBeforeMedicare,
    calculateLITO,
    individualTaxBreakdown,
    individualTaxEstimate,
    marginalTaxRate,
    estimateHelpRepayment,
    calculatePersonSTSLRepaymentIncome,
    calculatePersonMLSIncomeForThreshold,
    calculatePersonMLSSurchargeBase,
    calculateMedicareLevySurcharge,
    calculateHelpRepaymentIncome,
    calculatePayrollEstimate,
    qualifyingEarningsAnnualAmount,
    calculateEmployerSuperForPerson,
    employerSuperSummary,
    normaliseIncomeType,
    normaliseIncomeOwner,
    normalisedIncomeItems,
    incomeCashAnnualAmount,
    incomeTaxableAnnualAmount,
    incomeAllocation,
    rentalCashIncomeAnnualAmount,
    hasRentalCashIncomeAnnualAmount,
    rentalPropertyAssetRecords,
    rentalPropertyLoansFromPlan,
    rentalIncomeItemsFromPlan,
    calculateRentalPropertyFromFacts,
    incomeBreakdown,
    getAnnualLoanBreakdown,
    calculateRentalPropertyCashflow,
    calculateRentalCashflowSummary,
    calculateRentalPropertySummary: calculateRentalCashflowSummary,
    passiveIncomeBreakdown,
    propertyGrowthRateForAsset,
    principalResidenceGrowthRateForAsset,
    calculateNetFiAssetSummary,
    calculateNetFIAssets,
    amortiseLoan,
    calculateOffsetBenefit,
    calculateLoanSummary,
    calculatePlan,
  };
})(globalThis);
