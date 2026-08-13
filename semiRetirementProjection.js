(function attachSemiRetirementProjection(global) {
  const CALC = global.FFSCalculator || {};
  function developmentFlagFromLocation() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const flag = params.get("semiRetirementProjection");
      if (flag === "1") return true;
      if (flag === "0") return false;
      return null;
    } catch (error) {
      return null;
    }
  }

  function resolveSemiRetirementProjectionFlag() {
    const locationFlag = developmentFlagFromLocation();
    if (typeof locationFlag === "boolean") return locationFlag;
    if (typeof global.FFS_ENABLE_SEMI_RETIREMENT_PROJECTION === "boolean") {
      return global.FFS_ENABLE_SEMI_RETIREMENT_PROJECTION;
    }
    return true;
  }

  const FEATURE_FLAGS = {
    semiRetirementProjectionEnabled: resolveSemiRetirementProjectionFlag(),
  };
  const DEFAULT_CONTRIBUTIONS_TAX_RATE = 0.15;
  const DEFAULT_EMPLOYER_SUPER_RATE = 0.12;
  const DEFAULT_FINANCIAL_YEAR = CALC.FINANCIAL_YEAR || "2026-27";
  const DEFAULT_FINANCIAL_YEAR_CONFIG = CALC.financialYearConfigs?.[DEFAULT_FINANCIAL_YEAR] || {};
  const DEFAULT_MAXIMUM_CONTRIBUTION_BASE = DEFAULT_FINANCIAL_YEAR_CONFIG.employerSuperMaximumContributionBase || 0;
  const VALID_REPAYMENT_FREQUENCIES = new Set(["weekly", "fortnightly", "monthly", "quarterly", "annually", "annual"]);
  const GENERIC_DEBT_TYPES = new Set([
    "homeLoan",
    "mortgage",
    "rentalPropertyLoan",
    "investmentLoan",
    "shareInvestmentLoan",
    "managedFundLoan",
    "personalLoan",
    "vehicleLoan",
    "creditCard",
    "lineOfCredit",
    "overdraft",
    "revolvingCredit",
    "revolvingFacility",
    "otherDebt",
  ]);
  const HOME_LOAN_TYPES = new Set(["homeLoan", "mortgage"]);
  const REVOLVING_DEBT_TYPES = new Set(["creditCard", "lineOfCredit", "overdraft", "revolvingCredit", "revolvingFacility"]);
  const STSL_DEBT_TYPES = new Set(["stsl", "hecsHelp", "helpDebt", "studyLoan"]);
  const PROPERTY_ASSET_TYPES = new Set([
    "home",
    "principalResidence",
    "principal_residence",
    "otherProperty",
    "rentalInvestmentProperty",
    "rentalProperty",
    "investmentProperty",
    "residentialInvestmentProperty",
    "commercialInvestmentProperty",
    "incomeProducingProperty",
  ]);
  const RENTAL_INVESTMENT_PROPERTY_TYPES = new Set([
    "rentalInvestmentProperty",
    "rentalProperty",
    "investmentProperty",
    "residentialInvestmentProperty",
    "commercialInvestmentProperty",
    "incomeProducingProperty",
  ]);
  const PERSONAL_USE_ASSET_TYPES = new Set(["home", "principalResidence", "principal_residence", "vehicle", "personalUse"]);

  function hasFiniteNumber(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundCurrency(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function roundRatio(value) {
    return Math.round((number(value) + Number.EPSILON) * 10000) / 10000;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function inflationFactor(rate, yearIndex) {
    return Math.pow(1 + number(rate), Math.max(0, yearIndex));
  }

  function grownAmount(amount, growthRate, yearIndex) {
    return roundCurrency(number(amount) * inflationFactor(growthRate, yearIndex));
  }

  function todayDollarAmount(amount, inflationRate, yearIndex) {
    return roundCurrency(number(amount) * inflationFactor(inflationRate, yearIndex));
  }

  function emptyMilestone() {
    return {
      calendarYear: null,
      person1Age: null,
      person2Age: null,
    };
  }

  function milestoneForYear(calendarYear, peopleYear) {
    return {
      calendarYear,
      person1Age: peopleYear[0]?.age ?? null,
      person2Age: peopleYear[1]?.age ?? null,
    };
  }

  function emptyRetirementMilestone() {
    return {
      ...emptyMilestone(),
      retiredPersonIds: [],
    };
  }

  function retirementMilestoneForYear(calendarYear, peopleYear, retiredPersonIds) {
    return {
      ...milestoneForYear(calendarYear, peopleYear),
      retiredPersonIds: retiredPersonIds.slice(),
    };
  }

  function milestoneIsUnset(milestone) {
    return !milestone || milestone.calendarYear === null;
  }

  function defaultSummary() {
    return {
      accessibleBalanceAtFirstPersonFullRetirement: null,
      // Deprecated alias retained temporarily for consumers that still read the Stage 1 field.
      accessibleBalanceAtFirstFullRetirement: null,
      accessibleBalanceWhenBothFullyRetired: null,
      totalSuperAtAge60: null,
      superByPersonAtAge60: { person1: null, person2: null },
      superByPersonAtAccessAge: {},
      totalInvestableAssetsAtFullRetirement: null,
      accessibleFundsExhausted: emptyMilestone(),
      accessibleFundsExhaustedAge: null,
      accessibleFundsExhaustedYear: null,
      allRetirementFundsExhausted: emptyMilestone(),
      allRetirementFundsExhaustedAge: null,
      allRetirementFundsExhaustedYear: null,
      firstUnfundedSpending: emptyMilestone(),
      firstUnfundedSpendingAge: null,
      firstUnfundedSpendingYear: null,
      firstPersonFullRetirement: emptyRetirementMilestone(),
      householdFullRetirement: emptyMilestone(),
      // Deprecated alias retained temporarily for the Stage 1A household-full-retirement milestone.
      firstFullRetirement: emptyMilestone(),
      firstYearAllPeopleSuperAccessible: emptyMilestone(),
      totalUnfundedSpending: 0,
      accessibleBalanceAtEndAge: 0,
      superBalanceAtEndAge: 0,
      totalInvestableAssetsAtEndAge: 0,
      minimumEstateBalanceTarget: 0,
      minimumEstateBalanceShortfallAtEndAge: 0,
      meetsMinimumEstateBalanceAtEndAge: true,
      totalPlannedSemiRetirementWithdrawals: 0,
      totalRetirementWithdrawals: 0,
      debtPayoffMilestones: [],
      totalDebtAtEndAge: 0,
      totalPropertyValueAtEndAge: 0,
      totalPropertyDebtAtEndAge: 0,
      totalPropertyEquityAtEndAge: 0,
      totalNetWorthAtEndAge: 0,
    };
  }

  function employmentPhaseForAge(person, age) {
    if (age >= person.fullRetirementAge) return "fully-retired";
    if (person.hasSemiRetirement && age >= person.semiRetirementAge) return "semi-retired";
    return "full-time";
  }

  function isSemiRetirementYear(peopleYear) {
    return householdPhase(peopleYear) === "semi-retirement";
  }

  function householdPhase(peopleYear) {
    if (peopleYear.every((person) => person.employmentPhase === "fully-retired")) return "full-retirement";
    if (peopleYear.every((person) => person.employmentPhase === "full-time")) return "working";
    return "semi-retirement";
  }

  function normalisePerson(person, index) {
    const id = String(person?.id || `person${index + 1}`);
    const currentAge = number(person?.currentAge);
    const fullRetirementAge = number(person?.fullRetirementAge);
    const hasSemiRetirement = hasFiniteNumber(person?.semiRetirementAge)
      && number(person.semiRetirementAge) < fullRetirementAge;
    const semiRetirementAge = hasSemiRetirement ? number(person.semiRetirementAge) : fullRetirementAge;
    return {
      id,
      name: String(person?.name || `Person ${index + 1}`),
      currentAge,
      currentGrossEmploymentIncome: number(person?.currentGrossEmploymentIncome),
      annualIncomeGrowthRate: number(person?.annualIncomeGrowthRate),
      semiRetirementAge,
      hasSemiRetirement,
      semiRetirementGrossIncome: hasSemiRetirement ? number(person?.semiRetirementGrossIncome) : 0,
      fullRetirementAge,
      superAccessAge: number(person?.superAccessAge),
      openingSuperBalance: number(person?.openingSuperBalance),
      superReturnBeforeRetirement: number(person?.superReturnBeforeRetirement),
      superReturnAfterRetirement: number(person?.superReturnAfterRetirement),
      superAnnualFeesRate: number(person?.superAnnualFeesRate),
      employerSuperRate: hasFiniteNumber(person?.employerSuperRate)
        ? number(person.employerSuperRate)
        : DEFAULT_EMPLOYER_SUPER_RATE,
      existingAdditionalConcessionalContributions: number(person?.existingAdditionalConcessionalContributions),
      additionalContributionsStopAge: hasFiniteNumber(person?.additionalContributionsStopAge)
        ? number(person.additionalContributionsStopAge)
        : fullRetirementAge,
      stslOpeningBalance: number(person?.stslOpeningBalance),
      hasPrivateHealthCover: person?.hasPrivateHealthCover !== false,
    };
  }

  function normaliseWithdrawalOrder(value) {
    if (value === undefined || value === null || value === "") return "accessible-first";
    if (value === "accessible-first") return "accessible-first";
    if (Array.isArray(value) && value.length === 2 && value[0] === "accessible" && value[1] === "super") {
      return "accessible-first";
    }
    return value;
  }

  function normaliseRecordId(item = {}, prefix = "record", index = 0) {
    return String(item.id || item.assetId || item.liabilityId || item.uid || item.key || `${prefix}-${index + 1}`);
  }

  function normaliseFrequency(value) {
    const text = String(value || "annually").trim();
    if (text === "annual") return "annually";
    return VALID_REPAYMENT_FREQUENCIES.has(text) ? text : "annually";
  }

  function annualiseAmount(amount, frequency = "annually") {
    const value = number(amount);
    const normalisedFrequency = normaliseFrequency(frequency);
    if (normalisedFrequency === "weekly") return roundCurrency(value * 52);
    if (normalisedFrequency === "fortnightly") return roundCurrency(value * 26);
    if (normalisedFrequency === "monthly") return roundCurrency(value * 12);
    if (normalisedFrequency === "quarterly") return roundCurrency(value * 4);
    return roundCurrency(value);
  }

  function rateFromPercentOrDecimal(value, fallback = 0) {
    if (!hasFiniteNumber(value)) return fallback;
    const parsed = number(value);
    return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
  }

  function rateFromPercentageField(value) {
    if (!hasFiniteNumber(value)) return null;
    const rate = number(value) / 100;
    return rate < -1 ? null : rate;
  }

  function rateFromDecimalField(value) {
    if (!hasFiniteNumber(value)) return null;
    const rate = number(value);
    return rate < -1 ? null : rate;
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

  function assumptionGrowthRate(decimalValue, percentageValue) {
    const percentageRate = rateFromPercentageField(percentageValue);
    if (percentageRate !== null) return percentageRate;
    const decimalRate = rateFromDecimalField(decimalValue);
    return decimalRate ?? 0;
  }

  function normaliseAssetType(value) {
    const text = String(value || "").trim();
    if (text === "rental_property" || text === "rental_property_asset") return "rentalInvestmentProperty";
    if (text === "investment_property") return "investmentProperty";
    if (text === "principal_home") return "home";
    return text || "other";
  }

  function normaliseLiabilityType(value) {
    const text = String(value || "").trim();
    if (text === "home_loan" || text === "mortgageLoan") return "homeLoan";
    if (text === "rental_property_loan") return "rentalPropertyLoan";
    if (text === "investment_loan") return "investmentLoan";
    if (text === "personal_loan") return "personalLoan";
    if (text === "vehicle_loan" || text === "carLoan") return "vehicleLoan";
    if (text === "credit_card") return "creditCard";
    if (text === "line_of_credit") return "lineOfCredit";
    if (text === "revolving_credit") return "revolvingCredit";
    if (text === "revolving_facility") return "revolvingFacility";
    if (text === "other_debt") return "otherDebt";
    return text || "otherDebt";
  }

  function warningCodeMessage(warning) {
    if (typeof warning === "string") return warning;
    if (!warning || typeof warning !== "object") return String(warning || "");
    if (warning.code === "DEBT_NEGATIVE_AMORTISATION") {
      return `Repayments did not cover interest, so ${roundCurrency(warning.capitalisedInterest)} of interest was capitalised.`;
    }
    if (warning.code === "DEBT_TERM_BALLOON_REPAYMENT") {
      return `The entered term expired, so a final repayment of ${roundCurrency(warning.balloonRepayment)} was modelled.`;
    }
    if (warning.code === "DEBT_TERM_EXPIRED_REVOLVING") {
      return "The entered term expired, but this revolving debt was not forced into a balloon repayment.";
    }
    return warning.message || warning.code || "Debt schedule warning.";
  }

  function linkedLoanIds(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
    return value ? [String(value)] : [];
  }

  function resolveProjectionAssetGrowthRate(asset = {}, type = "", growthAssumptions = {}) {
    const explicitPercentageRate = firstFieldContractRate([
      { value: asset.assetSpecificGrowthRatePct, unit: "percent" },
      { value: asset.annualGrowthRatePct, unit: "percent" },
      { value: asset.propertyGrowthRatePct, unit: "percent" },
      { value: asset.capitalGrowthRatePct, unit: "percent" },
      { value: asset.expectedGrowthRatePct, unit: "percent" },
      { value: asset.growthRatePct, unit: "percent" },
    ]);
    if (explicitPercentageRate !== null) {
      return {
        annualGrowthRate: explicitPercentageRate,
        growthRateSource: String(asset.growthRateSource || "asset-specific"),
      };
    }
    const explicitDecimalRate = firstFieldContractRate([
      { value: asset.assetSpecificGrowthRate, unit: "decimal" },
      { value: asset.annualGrowthRate, unit: "decimal" },
      { value: asset.propertyGrowthRate, unit: "decimal" },
      { value: asset.capitalGrowthRate, unit: "decimal" },
      { value: asset.expectedGrowthRate, unit: "decimal" },
      { value: asset.growthRate, unit: "decimal" },
    ]);
    if (explicitDecimalRate !== null) {
      return {
        annualGrowthRate: explicitDecimalRate,
        growthRateSource: String(asset.growthRateSource || "asset-specific"),
      };
    }
    if (RENTAL_INVESTMENT_PROPERTY_TYPES.has(type)) {
      return {
        annualGrowthRate: number(growthAssumptions.investmentPropertyCapitalGrowthRate),
        growthRateSource: "investment-property-default",
      };
    }
    if (PERSONAL_USE_ASSET_TYPES.has(type) && (type === "home" || type === "principalResidence" || type === "principal_residence")) {
      return {
        annualGrowthRate: number(growthAssumptions.principalResidenceCapitalGrowthRate),
        growthRateSource: "principal-residence-default",
      };
    }
    return {
      annualGrowthRate: 0,
      growthRateSource: "zero-fallback",
    };
  }

  function normaliseProjectionAsset(asset = {}, index = 0, growthAssumptions = {}) {
    const type = normaliseAssetType(asset.type || asset.category || asset.assetCategory);
    const id = normaliseRecordId(asset, "asset", index);
    const resolvedGrowth = resolveProjectionAssetGrowthRate(asset, type, growthAssumptions);
    const annualGrowthRate = resolvedGrowth.annualGrowthRate;
    return {
      id,
      name: String(asset.name || asset.description || `Asset ${index + 1}`),
      type,
      openingValue: roundCurrency(Math.max(0, number(asset.openingValue ?? asset.currentValue ?? asset.value ?? asset.balance))),
      annualGrowthRate,
      annualGrowthRatePct: roundRatio(annualGrowthRate * 100),
      growthRateSource: resolvedGrowth.growthRateSource,
      includeInNetWorth: asset.includeInNetWorth !== false,
      isProperty: PROPERTY_ASSET_TYPES.has(type),
      isRentalInvestmentProperty: RENTAL_INVESTMENT_PROPERTY_TYPES.has(type),
      isPersonalUse: asset.isPersonalUse === true || PERSONAL_USE_ASSET_TYPES.has(type),
      isAccessibleAsset: asset.isAccessibleAsset === true,
    };
  }

  function normaliseProjectionLiability(liability = {}, index = 0) {
    const type = normaliseLiabilityType(liability.type || liability.category || liability.liabilityType);
    const id = normaliseRecordId(liability, "liability", index);
    const remainingTermSource = liability.remainingTermYears ?? liability.termYears;
    const hasExplicitRemainingTerm = hasFiniteNumber(remainingTermSource);
    const remainingTermYears = hasExplicitRemainingTerm
      ? Math.max(0, number(remainingTermSource))
      : 30;
    const explicitRepaymentSource = liability.repaymentAmount ?? liability.repayment;
    const debtScheduleType = liability.debtScheduleType === "revolving" || REVOLVING_DEBT_TYPES.has(type)
      ? "revolving"
      : "amortising";
    return {
      id,
      name: String(liability.name || liability.description || `Liability ${index + 1}`),
      type,
      debtScheduleType,
      linkedAssetId: String(liability.linkedAssetId || liability.investmentLink?.linkedAssetId || ""),
      linkedRentalIncomeId: String(liability.linkedRentalIncomeId || ""),
      openingBalance: roundCurrency(Math.max(0, number(liability.openingBalance ?? liability.currentBalance ?? liability.balance ?? liability.value))),
      openingOffsetBalance: roundCurrency(Math.max(0, number(liability.openingOffsetBalance ?? liability.offsetBalance ?? liability.linkedOffsetBalance))),
      annualInterestRate: rateFromPercentOrDecimal(liability.annualInterestRate ?? liability.interestRate ?? liability.interestRatePct, 0),
      repaymentAmount: Math.max(0, number(explicitRepaymentSource)),
      hasExplicitRepaymentAmount: hasFiniteNumber(explicitRepaymentSource),
      repaymentFrequency: normaliseFrequency(liability.repaymentFrequency || "monthly"),
      annualAdditionalPrincipalRepayment: annualiseAmount(liability.additionalPrincipalRepayment, liability.additionalPrincipalFrequency || "annually"),
      remainingTermYears,
      hasExplicitRemainingTerm,
      repaymentType: liability.repaymentType === "interestOnly" ? "interestOnly" : "principalAndInterest",
      isStsl: STSL_DEBT_TYPES.has(type),
      isSupportedDebt: GENERIC_DEBT_TYPES.has(type),
      isHomeLoan: HOME_LOAN_TYPES.has(type),
    };
  }

  function normalisePropertyIncome(item = {}, index = 0, inflationRate = 0) {
    const rentalCashSource = firstRentalCashIncomeSource(item);
    const hasRentalCashIncome = item.missingRentalCashIncome === true || item.hasRentalCashIncome === false
      ? false
      : rentalCashSource !== undefined;
    const annualIncome = hasRentalCashIncome ? number(rentalCashSource) : null;
    const annualTaxableIncome = hasFiniteNumber(item.taxableRentalIncomeAnnual)
      ? number(item.taxableRentalIncomeAnnual)
      : hasFiniteNumber(item.annualTaxableIncome)
        ? number(item.annualTaxableIncome)
        : hasFiniteNumber(item.taxableIncome)
          ? number(item.taxableIncome)
          : 0;
    const treatment = item.rentalCashflowTreatment === "beforeInterest" || item.cashflowTreatment === "beforeInterest"
      ? "beforeInterest"
      : "afterInterest";
    return {
      id: normaliseRecordId(item, "property-income", index),
      name: String(item.propertyName || item.name || item.description || `Property income ${index + 1}`),
      linkedAssetId: String(item.linkedAssetId || item.linkedPropertyAssetId || item.assetId || ""),
      linkedLoanIds: linkedLoanIds(item.linkedLoanIds || item.linkedLoanId),
      annualIncome: annualIncome === null ? null : roundCurrency(annualIncome),
      baseRentalCashIncome: annualIncome === null ? null : roundCurrency(annualIncome),
      hasRentalCashIncome,
      missingRentalCashIncome: !hasRentalCashIncome,
      annualGrowthRate: number(inflationRate),
      rentalCashIncomeGrowthRate: number(inflationRate),
      rentalCashIncomeGrowthSource: "cpi",
      taxableRentalIncomeAnnual: roundCurrency(annualTaxableIncome),
      baseTaxableRentalIncome: roundCurrency(annualTaxableIncome),
      taxableRentalIncomeGrowthRate: number(item.taxableRentalIncomeGrowthRate ?? item.annualTaxableIncomeGrowthRate),
      rentalCashflowTreatment: treatment,
    };
  }

  function firstRentalCashIncomeSource(item = {}) {
    const candidates = [
      item.annualIncome,
      item.rentalCashIncomeAnnual,
      item.annualRentalCashIncome,
      item.annualCashIncome,
      item.cashIncome,
      item.annualNetRentalCashIncome,
    ];
    return candidates.find(hasFiniteNumber);
  }

  function rentalCashIncomeRequiredWarning(income = {}) {
    const propertyName = income.name || "Rental property";
    return {
      code: "RENTAL_CASH_INCOME_REQUIRED",
      incomeId: income.id,
      linkedAssetId: income.linkedAssetId,
      propertyName,
      message: `Rental cash income required for ${propertyName}. The entered taxable rental profit cannot be used as the property's cash income. Enter the annual rental cash income used for cashflow projections.`,
    };
  }

  function normaliseIncomeType(value) {
    const text = String(value || "").trim();
    if (["interest", "bankInterest"].includes(text)) return "interest";
    if (["dividends", "dividend", "frankedDividends"].includes(text)) return "dividends";
    if (["distributions", "distributionIncome", "distribution_income", "trustDistribution"].includes(text)) return "distributions";
    if (["rentalTaxableIncome", "rentalNetCashIncome", "rental_net_profit", "rentalNetProfit", "rental"].includes(text)) return "rentalTaxableIncome";
    if (["otherPassive", "otherPassiveIncome"].includes(text)) return "otherPassive";
    if (["otherTaxableIncome", "other_taxable_income", "other"].includes(text)) return "otherTaxableIncome";
    return "otherTaxableIncome";
  }

  function normaliseIncomeOwner(value) {
    const text = String(value || "").trim();
    if (text === "person1" || text === "person2") return text;
    return "joint";
  }

  function ownershipShares(item = {}) {
    const owner = normaliseIncomeOwner(item.owner || item.incomeOwner);
    if (owner === "person1") return { person1: 1, person2: 0 };
    if (owner === "person2") return { person1: 0, person2: 1 };
    let person1Percent = number(item.person1AllocationPercentage ?? item.person1AllocationPct ?? item.person1SharePct);
    let person2Percent = number(item.person2AllocationPercentage ?? item.person2AllocationPct ?? item.person2SharePct);
    if (person1Percent <= 0 && person2Percent <= 0) {
      person1Percent = 50;
      person2Percent = 50;
    } else if (person1Percent > 0 && person2Percent <= 0) {
      person2Percent = Math.max(0, 100 - person1Percent);
    } else if (person2Percent > 0 && person1Percent <= 0) {
      person1Percent = Math.max(0, 100 - person2Percent);
    }
    const total = person1Percent + person2Percent;
    if (total <= 0) return { person1: 0.5, person2: 0.5 };
    return {
      person1: roundRatio(person1Percent / total),
      person2: roundRatio(person2Percent / total),
    };
  }

  function normalisePassiveIncome(item = {}, index = 0) {
    const type = normaliseIncomeType(item.type || item.category || item.incomeType);
    const cashSource = item.annualCashIncome ?? item.cashIncome ?? item.cashAmount ?? item.annualAmount ?? item.amount;
    const taxableSource = item.annualTaxableIncome ?? item.taxableIncome ?? item.taxableAmount ?? item.annualAmount ?? item.amount;
    return {
      id: normaliseRecordId(item, "passive-income", index),
      name: String(item.name || item.description || `Passive income ${index + 1}`),
      type,
      owner: normaliseIncomeOwner(item.owner || item.incomeOwner),
      shares: ownershipShares(item),
      annualCashIncome: roundCurrency(Math.max(0, number(cashSource))),
      annualTaxableIncome: roundCurrency(Math.max(0, number(taxableSource))),
      annualCashGrowthRate: number(item.annualCashGrowthRate ?? item.cashGrowthRate),
      annualTaxableGrowthRate: number(item.annualTaxableGrowthRate ?? item.taxableGrowthRate),
      linkedAssetId: String(item.linkedAssetId || item.linkedPropertyAssetId || item.assetId || ""),
      sourceIncomeId: String(item.sourceIncomeId || item.id || ""),
    };
  }

  function projectDebtYear(liability, openingBalance, yearIndex = 0, calendarYear = null) {
    const opening = roundCurrency(Math.max(0, number(openingBalance)));
    const offsetBalanceUsed = liability.isHomeLoan
      ? roundCurrency(Math.min(opening, Math.max(0, number(liability.openingOffsetBalance))))
      : 0;
    const interestBearingBalance = roundCurrency(Math.max(0, opening - offsetBalanceUsed));
    const base = {
      id: liability.id,
      name: liability.name,
      type: liability.type,
      debtScheduleType: liability.debtScheduleType || "amortising",
      linkedAssetId: liability.linkedAssetId,
      linkedRentalIncomeId: liability.linkedRentalIncomeId,
      openingBalance: opening,
      offsetBalanceUsed,
      interestBearingBalance,
      interestRate: liability.annualInterestRate,
      interestCharged: 0,
      scheduledRepayment: 0,
      regularRepayment: 0,
      balloonRepayment: 0,
      totalRepayment: 0,
      principalRepaid: 0,
      capitalisedInterest: 0,
      closingBalance: opening,
      paidOffThisYear: false,
      warnings: [],
    };
    if (opening <= 0) return { ...base, closingBalance: 0 };

    const annualRegularRepayment = annualiseAmount(liability.repaymentAmount, liability.repaymentFrequency);
    const annualAdditionalPrincipal = roundCurrency(Math.max(0, liability.annualAdditionalPrincipalRepayment));
    const totalTermMonths = liability.hasExplicitRemainingTerm
      ? Math.max(0, Math.round(liability.remainingTermYears * 12))
      : null;
    const termMonthsRemainingAtStart = liability.hasExplicitRemainingTerm
      ? Math.max(0, totalTermMonths - (yearIndex * 12))
      : null;
    const isRevolving = liability.debtScheduleType === "revolving";
    const shouldApplyTermExpiry = !isRevolving && liability.hasExplicitRemainingTerm;
    const regularMonthsThisYear = isRevolving || !liability.hasExplicitRemainingTerm
      ? 12
      : Math.min(12, Math.max(0, termMonthsRemainingAtStart));
    const termExpiresThisYear = shouldApplyTermExpiry
      && opening > 0
      && termMonthsRemainingAtStart !== null
      && termMonthsRemainingAtStart <= 12;

    const negativeAmortisationWarning = (interestCharged, repayment, capitalisedInterest) => ({
      code: "DEBT_NEGATIVE_AMORTISATION",
      liabilityId: liability.id,
      calendarYear,
      interestCharged: roundCurrency(interestCharged),
      repayment: roundCurrency(repayment),
      capitalisedInterest: roundCurrency(capitalisedInterest),
    });

    const balloonWarning = (balloonRepayment) => ({
      code: "DEBT_TERM_BALLOON_REPAYMENT",
      liabilityId: liability.id,
      calendarYear,
      balloonRepayment: roundCurrency(balloonRepayment),
    });

    if (liability.repaymentType === "interestOnly") {
      const interestCharged = roundCurrency(interestBearingBalance * Math.max(0, liability.annualInterestRate));
      const defaultInterestOnlyRepayment = liability.hasExplicitRepaymentAmount
        ? annualRegularRepayment
        : interestCharged;
      let regularRepayment = roundCurrency(Math.min(Math.max(0, defaultInterestOnlyRepayment), opening + interestCharged));
      let balance = roundCurrency(Math.max(0, opening + interestCharged - regularRepayment));
      const warnings = [];
      const extraPrincipal = roundCurrency(Math.min(balance, annualAdditionalPrincipal));
      balance = roundCurrency(Math.max(0, balance - extraPrincipal));
      let balloonRepayment = 0;
      if (termExpiresThisYear && balance > 0) {
        balloonRepayment = balance;
        balance = 0;
        warnings.push(balloonWarning(balloonRepayment));
      } else if (liability.hasExplicitRemainingTerm && isRevolving && termMonthsRemainingAtStart <= 0 && balance > 0) {
        warnings.push({
          code: "DEBT_TERM_EXPIRED_REVOLVING",
          liabilityId: liability.id,
          calendarYear,
        });
      }
      const totalRepayment = roundCurrency(regularRepayment + extraPrincipal + balloonRepayment);
      const capitalisedInterest = roundCurrency(Math.max(0, balance - opening));
      const principalRepaid = roundCurrency(Math.max(0, opening - balance));
      if (capitalisedInterest > 0) warnings.push(negativeAmortisationWarning(interestCharged, totalRepayment, capitalisedInterest));
      return {
        ...base,
        interestCharged,
        scheduledRepayment: totalRepayment,
        regularRepayment,
        balloonRepayment,
        totalRepayment,
        principalRepaid,
        capitalisedInterest,
        closingBalance: balance,
        paidOffThisYear: opening > 0 && balance === 0,
        warnings,
      };
    }

    const monthlyRate = Math.max(0, liability.annualInterestRate) / 12;
    const monthlyRepayment = annualRegularRepayment / 12;
    let balance = opening;
    let interestCharged = 0;
    let regularRepayment = 0;
    const warnings = [];

    for (let month = 0; month < regularMonthsThisYear && balance > 0; month += 1) {
      const monthInterestBearingBalance = Math.max(0, balance - offsetBalanceUsed);
      const interest = roundCurrency(monthInterestBearingBalance * monthlyRate);
      const repayment = Math.min(monthlyRepayment, balance + interest);
      interestCharged = roundCurrency(interestCharged + interest);
      regularRepayment += repayment;
      balance = Math.max(0, balance + interest - repayment);
    }

    if (balance > 0 && annualAdditionalPrincipal > 0) {
      const extraPrincipal = roundCurrency(Math.min(balance, annualAdditionalPrincipal));
      regularRepayment = roundCurrency(regularRepayment + extraPrincipal);
      balance = Math.max(0, balance - extraPrincipal);
    }

    balance = roundCurrency(balance);
    let balloonRepayment = 0;
    if (termExpiresThisYear && balance > 0) {
      balloonRepayment = balance;
      balance = 0;
      warnings.push(balloonWarning(balloonRepayment));
    } else if (liability.hasExplicitRemainingTerm && isRevolving && termMonthsRemainingAtStart <= 0 && balance > 0) {
      warnings.push({
        code: "DEBT_TERM_EXPIRED_REVOLVING",
        liabilityId: liability.id,
        calendarYear,
      });
    }

    const totalRepayment = roundCurrency(regularRepayment + balloonRepayment);
    const capitalisedInterest = roundCurrency(Math.max(0, balance - opening));
    const principalRepaid = roundCurrency(Math.max(0, opening - balance));
    if (capitalisedInterest > 0) warnings.push(negativeAmortisationWarning(interestCharged, totalRepayment, capitalisedInterest));

    return {
      ...base,
      interestCharged: roundCurrency(interestCharged),
      scheduledRepayment: totalRepayment,
      regularRepayment: roundCurrency(regularRepayment),
      balloonRepayment: roundCurrency(balloonRepayment),
      totalRepayment,
      principalRepaid: roundCurrency(principalRepaid),
      capitalisedInterest: roundCurrency(capitalisedInterest),
      closingBalance: balance,
      paidOffThisYear: opening > 0 && balance === 0,
      warnings,
    };
  }

  function projectAssetYear(asset, openingValue) {
    const opening = roundCurrency(Math.max(0, number(openingValue)));
    const growth = roundCurrency(opening * asset.annualGrowthRate);
    const closingValue = roundCurrency(Math.max(0, opening + growth));
    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      openingValue: opening,
      propertyGrowth: PROPERTY_ASSET_TYPES.has(asset.type) ? growth : 0,
      annualGrowth: growth,
      closingValue,
      annualGrowthRate: asset.annualGrowthRate,
      annualGrowthRatePct: asset.annualGrowthRatePct,
      growthRateSource: asset.growthRateSource,
      includeInNetWorth: asset.includeInNetWorth,
      isProperty: asset.isProperty,
      isRentalInvestmentProperty: asset.isRentalInvestmentProperty,
      isAccessibleAsset: asset.isAccessibleAsset,
    };
  }

  function loanIdsForPropertyIncome(income, debtRows, liabilities) {
    const ids = new Set(income.linkedLoanIds);
    debtRows.forEach((row) => {
      const source = liabilities.find((liability) => liability.id === row.id);
      if (!source) return;
      if (source.linkedRentalIncomeId && source.linkedRentalIncomeId === income.id) ids.add(row.id);
      if (income.linkedAssetId && source.linkedAssetId && source.linkedAssetId === income.linkedAssetId && source.type === "rentalPropertyLoan") ids.add(row.id);
    });
    return ids;
  }

  function projectPropertyIncomeRows(normalised, debtRows, yearIndex) {
    return normalised.propertyIncome.map((income) => {
      const loanIds = loanIdsForPropertyIncome(income, debtRows, normalised.liabilities);
      const linkedLoanRows = debtRows.filter((row) => loanIds.has(row.id));
      const loanInterest = roundCurrency(linkedLoanRows.reduce((total, row) => total + row.interestCharged, 0));
      const loanPrincipal = roundCurrency(linkedLoanRows.reduce((total, row) => total + row.principalRepaid, 0));
      const fullLoanRepayments = roundCurrency(linkedLoanRows.reduce((total, row) => total + row.totalRepayment, 0));
      if (income.hasRentalCashIncome === false || !hasFiniteNumber(income.baseRentalCashIncome ?? income.annualIncome)) {
        const warning = rentalCashIncomeRequiredWarning(income);
        return {
          id: income.id,
          name: income.name,
          linkedAssetId: income.linkedAssetId,
          linkedLoanIds: Array.from(loanIds),
          rentalCashflowTreatment: income.rentalCashflowTreatment,
          rentalIncomeTreatment: income.rentalCashflowTreatment,
          hasRentalCashIncome: false,
          missingRentalCashIncome: true,
          baseRentalCashIncome: null,
          rentalCashIncome: null,
          rentalCashIncomeGrowthRate: number(income.rentalCashIncomeGrowthRate ?? income.annualGrowthRate),
          rentalCashIncomeGrowthSource: income.rentalCashIncomeGrowthSource || "cpi",
          baseTaxableRentalIncome: roundCurrency(income.baseTaxableRentalIncome ?? income.taxableRentalIncomeAnnual),
          taxableRentalIncome: grownAmount(income.baseTaxableRentalIncome ?? income.taxableRentalIncomeAnnual, number(income.taxableRentalIncomeGrowthRate), yearIndex),
          taxableRentalIncomeGrowthRate: number(income.taxableRentalIncomeGrowthRate),
          grossRentalIncome: null,
          propertyExpenses: 0,
          loanInterest,
          loanPrincipal,
          fullLoanRepayments,
          incomeAfterInterest: null,
          netPropertyCashflow: 0,
          interestAlreadyIncluded: income.rentalCashflowTreatment === "afterInterest",
          warnings: [warning],
        };
      }
      const baseRentalCashIncome = roundCurrency(income.baseRentalCashIncome ?? income.annualIncome);
      const rentalCashIncomeGrowthRate = number(income.rentalCashIncomeGrowthRate ?? income.annualGrowthRate);
      const rentalCashIncome = grownAmount(baseRentalCashIncome, rentalCashIncomeGrowthRate, yearIndex);
      const baseTaxableRentalIncome = roundCurrency(income.baseTaxableRentalIncome ?? income.taxableRentalIncomeAnnual);
      const taxableRentalIncome = grownAmount(baseTaxableRentalIncome, number(income.taxableRentalIncomeGrowthRate), yearIndex);
      const incomeAfterInterest = income.rentalCashflowTreatment === "beforeInterest"
        ? roundCurrency(rentalCashIncome - loanInterest)
        : rentalCashIncome;
      const netPropertyCashflow = income.rentalCashflowTreatment === "beforeInterest"
        ? roundCurrency(rentalCashIncome - fullLoanRepayments)
        : roundCurrency(rentalCashIncome - loanPrincipal);
      return {
        id: income.id,
        name: income.name,
        linkedAssetId: income.linkedAssetId,
        linkedLoanIds: Array.from(loanIds),
        rentalCashflowTreatment: income.rentalCashflowTreatment,
        rentalIncomeTreatment: income.rentalCashflowTreatment,
        baseRentalCashIncome,
        rentalCashIncome,
        rentalCashIncomeGrowthRate,
        rentalCashIncomeGrowthSource: income.rentalCashIncomeGrowthSource || "cpi",
        baseTaxableRentalIncome,
        taxableRentalIncome,
        taxableRentalIncomeGrowthRate: number(income.taxableRentalIncomeGrowthRate),
        grossRentalIncome: rentalCashIncome,
        propertyExpenses: 0,
        loanInterest,
        loanPrincipal,
        fullLoanRepayments,
        incomeAfterInterest,
        netPropertyCashflow,
        interestAlreadyIncluded: income.rentalCashflowTreatment === "afterInterest",
        hasRentalCashIncome: true,
        missingRentalCashIncome: false,
        warnings: [],
      };
    });
  }

  function projectPropertyRows(normalised, assetRows, debtRows, propertyIncomeRows) {
    const rows = assetRows
      .filter((asset) => asset.isProperty)
      .map((asset) => {
        const linkedDebtRows = debtRows.filter((debt) => debt.linkedAssetId && debt.linkedAssetId === asset.id);
        const linkedIncomeRows = propertyIncomeRows.filter((income) => {
          if (income.linkedAssetId && income.linkedAssetId === asset.id) return true;
          return income.linkedLoanIds.some((loanId) => linkedDebtRows.some((debt) => debt.id === loanId));
        });
        const linkedLoanOpeningBalance = roundCurrency(linkedDebtRows.reduce((total, debt) => total + debt.openingBalance, 0));
        const linkedLoanClosingBalance = roundCurrency(linkedDebtRows.reduce((total, debt) => total + debt.closingBalance, 0));
        const loanInterest = roundCurrency(linkedDebtRows.reduce((total, debt) => total + debt.interestCharged, 0));
        const loanPrincipal = roundCurrency(linkedDebtRows.reduce((total, debt) => total + debt.principalRepaid, 0));
        const netPropertyCashflow = roundCurrency(linkedIncomeRows.reduce((total, income) => total + income.netPropertyCashflow, 0));
        const hasLinkedIncome = linkedIncomeRows.length > 0;
        const hasValidRentalCashIncome = linkedIncomeRows.some((income) => income.hasRentalCashIncome === true);
        return {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          openingValue: asset.openingValue,
          propertyGrowth: asset.propertyGrowth,
          closingValue: asset.closingValue,
          annualGrowthRate: asset.annualGrowthRate,
          annualGrowthRatePct: asset.annualGrowthRatePct,
          growthRateSource: asset.growthRateSource,
          rentalCashIncome: hasValidRentalCashIncome
            ? roundCurrency(linkedIncomeRows.reduce((total, income) => total + number(income.rentalCashIncome), 0))
            : hasLinkedIncome ? null : 0,
          baseRentalCashIncome: hasValidRentalCashIncome
            ? roundCurrency(linkedIncomeRows.reduce((total, income) => total + number(income.baseRentalCashIncome ?? income.rentalCashIncome), 0))
            : hasLinkedIncome ? null : 0,
          rentalCashIncomeGrowthRate: linkedIncomeRows[0]?.rentalCashIncomeGrowthRate ?? normalised.inflationRate,
          rentalCashIncomeGrowthSource: linkedIncomeRows[0]?.rentalCashIncomeGrowthSource || "cpi",
          taxableRentalIncome: roundCurrency(linkedIncomeRows.reduce((total, income) => total + number(income.taxableRentalIncome), 0)),
          baseTaxableRentalIncome: roundCurrency(linkedIncomeRows.reduce((total, income) => total + number(income.baseTaxableRentalIncome), 0)),
          grossRentalIncome: hasValidRentalCashIncome
            ? roundCurrency(linkedIncomeRows.reduce((total, income) => total + number(income.rentalCashIncome), 0))
            : hasLinkedIncome ? null : 0,
          propertyExpenses: 0,
          loanInterest,
          loanPrincipal,
          netPropertyCashflow,
          linkedLoanOpeningBalance,
          linkedLoanClosingBalance,
          propertyEquity: roundCurrency(asset.closingValue - linkedLoanClosingBalance),
          isRentalInvestmentProperty: asset.isRentalInvestmentProperty,
          hasMissingRentalCashIncome: linkedIncomeRows.some((income) => income.missingRentalCashIncome === true),
          warnings: linkedIncomeRows.flatMap((income) => income.warnings || []),
        };
      });
    return rows;
  }

  function projectPassiveIncomeRows(normalised, yearIndex) {
    return normalised.passiveIncome.map((income) => {
      const cashIncome = grownAmount(income.annualCashIncome, income.annualCashGrowthRate, yearIndex);
      const taxableIncome = grownAmount(income.annualTaxableIncome, income.annualTaxableGrowthRate, yearIndex);
      return {
        id: income.id,
        name: income.name,
        type: income.type,
        owner: income.owner,
        shares: { ...income.shares },
        linkedAssetId: income.linkedAssetId,
        sourceIncomeId: income.sourceIncomeId,
        cashIncome,
        taxableIncome,
        person1CashIncome: roundCurrency(cashIncome * income.shares.person1),
        person2CashIncome: roundCurrency(cashIncome * income.shares.person2),
        person1TaxableIncome: roundCurrency(taxableIncome * income.shares.person1),
        person2TaxableIncome: roundCurrency(taxableIncome * income.shares.person2),
      };
    });
  }

  function passiveIncomeForPerson(passiveIncomeRows, personId) {
    const personKey = personId === "person2" ? "person2" : "person1";
    return passiveIncomeRows.reduce((summary, income) => {
      const cash = number(income[`${personKey}CashIncome`]);
      const taxable = number(income[`${personKey}TaxableIncome`]);
      summary.cashIncome = roundCurrency(summary.cashIncome + cash);
      summary.taxableIncome = roundCurrency(summary.taxableIncome + taxable);
      if (income.type === "interest") summary.interestIncome = roundCurrency(summary.interestIncome + taxable);
      else if (income.type === "dividends") summary.dividendIncome = roundCurrency(summary.dividendIncome + taxable);
      else if (income.type === "distributions") summary.distributionIncome = roundCurrency(summary.distributionIncome + taxable);
      else if (income.type === "rentalTaxableIncome") summary.rentalTaxableIncome = roundCurrency(summary.rentalTaxableIncome + taxable);
      else summary.otherTaxableIncome = roundCurrency(summary.otherTaxableIncome + taxable);
      return summary;
    }, {
      cashIncome: 0,
      taxableIncome: 0,
      interestIncome: 0,
      dividendIncome: 0,
      distributionIncome: 0,
      rentalTaxableIncome: 0,
      otherTaxableIncome: 0,
    });
  }

  function normaliseInputs(input) {
    const people = Array.isArray(input?.people) ? input.people.map(normalisePerson) : [];
    const externalAccessibleContribution = hasFiniteNumber(input?.accessibleInvestments?.externalAnnualAccessibleContribution)
      ? number(input.accessibleInvestments.externalAnnualAccessibleContribution)
      : number(input?.accessibleInvestments?.currentAnnualContributions);
    const inflationRate = number(input?.inflationRate);
    const propertyGrowthAssumptions = {
      principalResidenceCapitalGrowthRate: assumptionGrowthRate(
        input?.assumptions?.principalResidenceCapitalGrowthRate,
        input?.assumptions?.principalResidenceCapitalGrowthRatePct,
      ),
      investmentPropertyCapitalGrowthRate: assumptionGrowthRate(
        input?.assumptions?.investmentPropertyCapitalGrowthRate,
        input?.assumptions?.investmentPropertyCapitalGrowthRatePct,
      ),
    };
    return {
      projectionStartYear: Math.round(number(input?.projectionStartYear)),
      projectionEndAge: number(input?.projectionEndAge),
      inflationRate,
      household: {
        currentLifestyleSpending: number(input?.household?.currentLifestyleSpending),
        semiRetirementLifestyleSpending: number(input?.household?.semiRetirementLifestyleSpending),
        fullRetirementLifestyleSpending: number(input?.household?.fullRetirementLifestyleSpending),
        spendingAmountsAreInTodaysDollars: true,
        dependants: Math.max(0, Math.round(number(input?.household?.dependants))),
        otherAnnualIncome: number(input?.household?.otherAnnualIncome),
        annualLoanPrincipalRepayments: number(input?.household?.annualLoanPrincipalRepayments),
      },
      accessibleInvestments: {
        openingBalance: number(input?.accessibleInvestments?.openingBalance),
        annualReturnRate: number(input?.accessibleInvestments?.annualReturnRate),
        annualFeesRate: number(input?.accessibleInvestments?.annualFeesRate),
        externalAnnualAccessibleContribution: externalAccessibleContribution,
        currentAnnualContributions: externalAccessibleContribution,
      },
      assets: Array.isArray(input?.assets)
        ? input.assets.map((asset, index) => normaliseProjectionAsset(asset, index, {
          principalResidenceCapitalGrowthRate: propertyGrowthAssumptions.principalResidenceCapitalGrowthRate,
          investmentPropertyCapitalGrowthRate: propertyGrowthAssumptions.investmentPropertyCapitalGrowthRate,
        }))
        : [],
      liabilities: Array.isArray(input?.liabilities)
        ? input.liabilities.map(normaliseProjectionLiability).filter((liability) => !liability.isStsl)
        : [],
      propertyIncome: Array.isArray(input?.propertyIncome) ? input.propertyIncome.map((item, index) => normalisePropertyIncome(item, index, inflationRate)) : [],
      passiveIncome: Array.isArray(input?.passiveIncome) ? input.passiveIncome.map(normalisePassiveIncome) : [],
      assumptions: {
        principalResidenceCapitalGrowthRate: propertyGrowthAssumptions.principalResidenceCapitalGrowthRate,
        investmentPropertyCapitalGrowthRate: propertyGrowthAssumptions.investmentPropertyCapitalGrowthRate,
      },
      people,
      scenario: {
        semiRetirementAccessibleWithdrawal: number(input?.scenario?.semiRetirementAccessibleWithdrawal),
        fullRetirementAnnualSpending: number(input?.scenario?.fullRetirementAnnualSpending),
        minimumAccessibleBalance: number(input?.scenario?.minimumAccessibleBalance),
        minimumEstateBalanceAtEndAge: number(input?.scenario?.minimumEstateBalanceAtEndAge),
        withdrawalOrder: normaliseWithdrawalOrder(input?.scenario?.withdrawalOrder),
        superWithdrawalOrder: Array.isArray(input?.scenario?.superWithdrawalOrder)
          ? input.scenario.superWithdrawalOrder.slice()
          : null,
      },
    };
  }

  function addValidation(errors, path, message) {
    errors.push({ path, message });
  }

  function validateInputs(input) {
    const errors = [];
    if (!input || typeof input !== "object") {
      addValidation(errors, "inputs", "Projection inputs must be provided as an object.");
      return errors;
    }
    if (!hasFiniteNumber(input.projectionStartYear)) addValidation(errors, "projectionStartYear", "Projection start year is required.");
    if (!hasFiniteNumber(input.projectionEndAge)) addValidation(errors, "projectionEndAge", "Projection end age is required.");
    if (!hasFiniteNumber(input.inflationRate)) addValidation(errors, "inflationRate", "Inflation rate is required.");
    const rateChecks = [
      ["inflationRate", input.inflationRate],
      ["accessibleInvestments.annualReturnRate", input.accessibleInvestments?.annualReturnRate],
      ["accessibleInvestments.annualFeesRate", input.accessibleInvestments?.annualFeesRate],
    ];
    rateChecks.forEach(([path, value]) => {
      if (hasFiniteNumber(value) && number(value) < -1) addValidation(errors, path, "Return or fee assumptions cannot be below -100%.");
    });

    [
      ["household.currentLifestyleSpending", input.household?.currentLifestyleSpending],
      ["household.semiRetirementLifestyleSpending", input.household?.semiRetirementLifestyleSpending],
      ["household.fullRetirementLifestyleSpending", input.household?.fullRetirementLifestyleSpending],
      ["household.otherAnnualIncome", input.household?.otherAnnualIncome],
      ["household.annualLoanPrincipalRepayments", input.household?.annualLoanPrincipalRepayments],
      ["accessibleInvestments.openingBalance", input.accessibleInvestments?.openingBalance],
      ["accessibleInvestments.currentAnnualContributions", input.accessibleInvestments?.currentAnnualContributions],
      ["accessibleInvestments.externalAnnualAccessibleContribution", input.accessibleInvestments?.externalAnnualAccessibleContribution],
      ["scenario.semiRetirementAccessibleWithdrawal", input.scenario?.semiRetirementAccessibleWithdrawal],
      ["scenario.minimumAccessibleBalance", input.scenario?.minimumAccessibleBalance],
    ].forEach(([path, value]) => {
      if (hasFiniteNumber(value) && number(value) < 0) addValidation(errors, path, "Negative amounts are not valid for this projection input.");
    });

    const assetInputs = Array.isArray(input.assets) ? input.assets.map(normaliseProjectionAsset) : [];
    const assetIds = new Set();
    assetInputs.forEach((asset, index) => {
      const prefix = `assets.${index}`;
      if (assetIds.has(asset.id)) addValidation(errors, `${prefix}.id`, "Duplicate asset IDs are not valid.");
      assetIds.add(asset.id);
      if (asset.openingValue < 0) addValidation(errors, `${prefix}.openingValue`, "Asset values cannot be negative.");
      if (asset.annualGrowthRate < -1) addValidation(errors, `${prefix}.annualGrowthRate`, "Asset growth assumptions cannot be below -100%.");
    });
    const liabilityInputs = Array.isArray(input.liabilities) ? input.liabilities.map(normaliseProjectionLiability) : [];
    const liabilityIds = new Set();
    liabilityInputs.forEach((liability, index) => {
      const prefix = `liabilities.${index}`;
      if (STSL_DEBT_TYPES.has(liability.type)) return;
      if (liabilityIds.has(liability.id)) addValidation(errors, `${prefix}.id`, "Duplicate liability IDs are not valid.");
      liabilityIds.add(liability.id);
      if (liability.openingBalance < 0) addValidation(errors, `${prefix}.openingBalance`, "Debt balances cannot be negative.");
      if (liability.repaymentAmount < 0) addValidation(errors, `${prefix}.repaymentAmount`, "Debt repayments cannot be negative.");
      if (liability.annualInterestRate < 0) addValidation(errors, `${prefix}.annualInterestRate`, "Interest rates cannot be negative.");
      if (!VALID_REPAYMENT_FREQUENCIES.has(liability.repaymentFrequency)) addValidation(errors, `${prefix}.repaymentFrequency`, "Repayment frequency is not supported.");
      if (liability.linkedAssetId && !assetIds.has(liability.linkedAssetId)) addValidation(errors, `${prefix}.linkedAssetId`, "Linked asset was not found.");
    });
    const propertyIncomeInputs = Array.isArray(input.propertyIncome) ? input.propertyIncome.map(normalisePropertyIncome) : [];
    propertyIncomeInputs.forEach((income, index) => {
      const prefix = `propertyIncome.${index}`;
      if (income.annualGrowthRate < -1) addValidation(errors, `${prefix}.annualGrowthRate`, "Property income growth cannot be below -100%.");
      if (income.linkedAssetId && !assetIds.has(income.linkedAssetId)) addValidation(errors, `${prefix}.linkedAssetId`, "Linked property asset was not found.");
      if (income.linkedAssetId && assetIds.has(income.linkedAssetId)) {
        const linkedAsset = assetInputs.find((asset) => asset.id === income.linkedAssetId);
        if (linkedAsset && !linkedAsset.isProperty) addValidation(errors, `${prefix}.linkedAssetId`, "Rental income must link to a property asset.");
      }
      income.linkedLoanIds.forEach((loanId) => {
        if (!liabilityIds.has(loanId)) addValidation(errors, `${prefix}.linkedLoanIds`, "Linked rental loan was not found.");
      });
    });
    const passiveIncomeInputs = Array.isArray(input.passiveIncome) ? input.passiveIncome.map(normalisePassiveIncome) : [];
    const passiveIncomeIds = new Set();
    passiveIncomeInputs.forEach((income, index) => {
      const prefix = `passiveIncome.${index}`;
      if (passiveIncomeIds.has(income.id)) addValidation(errors, `${prefix}.id`, "Duplicate passive-income IDs are not valid.");
      passiveIncomeIds.add(income.id);
      if (income.annualCashIncome < 0 || income.annualTaxableIncome < 0) addValidation(errors, prefix, "Passive-income amounts cannot be negative.");
      if (income.annualCashGrowthRate < -1 || income.annualTaxableGrowthRate < -1) addValidation(errors, prefix, "Passive-income growth assumptions cannot be below -100%.");
      const shareTotal = roundRatio(number(income.shares.person1) + number(income.shares.person2));
      if (Math.abs(shareTotal - 1) > 0.01) addValidation(errors, `${prefix}.owner`, "Passive-income ownership must allocate 100%.");
    });

    if (!Array.isArray(input.people) || input.people.length === 0) {
      addValidation(errors, "people", "At least one person is required.");
    }
    if (Array.isArray(input.people) && input.people.length > 2) {
      addValidation(errors, "people", "Stage 1 supports up to two people.");
    }
    const peopleArray = Array.isArray(input.people) ? input.people : [];
    const finiteCurrentAges = peopleArray
      .map((person) => person?.currentAge)
      .filter(hasFiniteNumber)
      .map(number);
    const youngestCurrentAge = finiteCurrentAges.length ? Math.min(...finiteCurrentAges) : null;
    const horizonYears = youngestCurrentAge !== null && hasFiniteNumber(input.projectionEndAge)
      ? Math.max(0, Math.ceil(number(input.projectionEndAge) - youngestCurrentAge))
      : null;
    const withdrawalOrder = normaliseWithdrawalOrder(input.scenario?.withdrawalOrder);
    if (withdrawalOrder !== "accessible-first") {
      addValidation(errors, "scenario.withdrawalOrder", "Stage 1A supports only the accessible-first withdrawal strategy.");
    }
    const ids = new Set();
    peopleArray.forEach((person, index) => {
      const prefix = `people.${index}`;
      const id = String(person?.id || `person${index + 1}`);
      if (ids.has(id)) addValidation(errors, `${prefix}.id`, "Duplicate person IDs are not valid.");
      ids.add(id);
      [
        ["currentAge", person?.currentAge],
        ["currentGrossEmploymentIncome", person?.currentGrossEmploymentIncome],
        ["fullRetirementAge", person?.fullRetirementAge],
        ["superAccessAge", person?.superAccessAge],
        ["openingSuperBalance", person?.openingSuperBalance],
      ].forEach(([field, value]) => {
        if (!hasFiniteNumber(value)) addValidation(errors, `${prefix}.${field}`, `${field} is required.`);
      });
      [
        ["currentGrossEmploymentIncome", person?.currentGrossEmploymentIncome],
        ["semiRetirementGrossIncome", person?.semiRetirementGrossIncome],
        ["openingSuperBalance", person?.openingSuperBalance],
        ["existingAdditionalConcessionalContributions", person?.existingAdditionalConcessionalContributions],
        ["stslOpeningBalance", person?.stslOpeningBalance],
      ].forEach(([field, value]) => {
        if (hasFiniteNumber(value) && number(value) < 0) addValidation(errors, `${prefix}.${field}`, "Negative amounts are not valid.");
      });
      [
        ["annualIncomeGrowthRate", person?.annualIncomeGrowthRate],
        ["superReturnBeforeRetirement", person?.superReturnBeforeRetirement],
        ["superReturnAfterRetirement", person?.superReturnAfterRetirement],
        ["superAnnualFeesRate", person?.superAnnualFeesRate],
        ["employerSuperRate", person?.employerSuperRate],
      ].forEach(([field, value]) => {
        if (hasFiniteNumber(value) && number(value) < -1) addValidation(errors, `${prefix}.${field}`, "Rate assumptions cannot be below -100%.");
      });
      const currentAge = number(person?.currentAge);
      const fullRetirementAge = number(person?.fullRetirementAge);
      const hasSemiAge = hasFiniteNumber(person?.semiRetirementAge);
      const semiRetirementAge = hasSemiAge ? number(person?.semiRetirementAge) : fullRetirementAge;
      if (hasSemiAge && semiRetirementAge < currentAge) addValidation(errors, `${prefix}.semiRetirementAge`, "Semi-retirement age cannot be below current age.");
      if (fullRetirementAge < semiRetirementAge) addValidation(errors, `${prefix}.fullRetirementAge`, "Full-retirement age cannot be below semi-retirement age.");
      if (hasFiniteNumber(person?.superAccessAge) && number(person.superAccessAge) < currentAge) addValidation(errors, `${prefix}.superAccessAge`, "Super access age cannot be below current age.");
      const finalAgeAtProjectionEnd = horizonYears !== null ? currentAge + horizonYears : null;
      if (finalAgeAtProjectionEnd !== null && finalAgeAtProjectionEnd < fullRetirementAge) {
        addValidation(errors, "projectionEndAge", "Projection end age leaves a person before their full-retirement age.");
      }
    });
    return errors;
  }

  function fallbackTaxBreakdown(income) {
    const taxable = Math.max(0, number(income));
    const incomeTax = taxable <= 18200 ? 0
      : taxable <= 45000 ? (taxable - 18200) * 0.15
        : taxable <= 135000 ? 4020 + (taxable - 45000) * 0.30
          : taxable <= 190000 ? 31020 + (taxable - 135000) * 0.37
            : 51370 + (taxable - 190000) * 0.45;
    return {
      incomeTax: roundCurrency(incomeTax),
      medicareLevy: roundCurrency(taxable * 0.02),
    };
  }

  function calculateMls(peopleYear, normalised) {
    if (typeof CALC.calculateMedicareLevySurcharge !== "function") {
      return { person1Surcharge: 0, person2Surcharge: 0, annualSurcharge: 0, warning: "Existing MLS helper was not available; MLS has been treated as zero." };
    }
    const p1 = peopleYear[0] || {};
    const p2 = peopleYear[1] || {};
    const hasPartner = Boolean(peopleYear[1]);
    const p1Income = p1.totalTaxableIncome ?? p1.grossEmploymentIncome ?? 0;
    const p2Income = p2.totalTaxableIncome ?? p2.grossEmploymentIncome ?? 0;
    const result = CALC.calculateMedicareLevySurcharge({
      person1TaxableIncome: p1Income,
      person2TaxableIncome: p2Income,
      person1MLSIncomeForThreshold: p1Income,
      person2MLSIncomeForThreshold: p2Income,
      person1MLSSurchargeBase: p1Income,
      person2MLSSurchargeBase: p2Income,
      person1CoverStatus: p1.hasPrivateHealthCover ? "full-year" : "no-cover",
      person2CoverStatus: hasPartner ? (p2.hasPrivateHealthCover ? "full-year" : "no-cover") : "full-year",
      dependantsHospitalCoverStatus: "full-year",
      dependants: normalised.household.dependants || 0,
      hasPartner,
      spouseForFullYear: hasPartner,
    });
    return {
      person1Surcharge: roundCurrency(result.person1Surcharge || 0),
      person2Surcharge: roundCurrency(result.person2Surcharge || 0),
      annualSurcharge: roundCurrency(result.annualSurcharge || 0),
      warning: result.cannotConfirm ? result.note : "",
    };
  }

  function estimateStslRepayment(repaymentIncome, openingBalance) {
    if (typeof CALC.estimateHelpRepayment === "function") {
      return CALC.estimateHelpRepayment(repaymentIncome, openingBalance).annualRepayment || 0;
    }
    return 0;
  }

  function employerSuperContribution(grossIncome, rate) {
    const cappedIncome = DEFAULT_MAXIMUM_CONTRIBUTION_BASE > 0
      ? Math.min(Math.max(0, grossIncome), DEFAULT_MAXIMUM_CONTRIBUTION_BASE)
      : Math.max(0, grossIncome);
    return roundCurrency(cappedIncome * Math.max(0, rate));
  }

  function withdrawFromSuper(requiredAmount, personOutputs, personStates, normalised) {
    let remaining = roundCurrency(Math.max(0, requiredAmount));
    const withdrawals = {};
    const configuredOrder = normalised.scenario.superWithdrawalOrder;
    const ordered = configuredOrder
      ? configuredOrder.map((id) => personOutputs.find((person) => person.id === id)).filter(Boolean)
      : personOutputs.slice().sort((a, b) => (b.age - a.age) || String(a.id).localeCompare(String(b.id)));
    ordered.forEach((person) => {
      if (remaining <= 0) return;
      if (person.age < person.superAccessAge) {
        withdrawals[person.id] = 0;
        return;
      }
      const state = personStates[person.id];
      const provisionalBalance = roundCurrency(state.openingSuperBalance + person.netEmployerSuperContribution + person.netAdditionalSuperContribution);
      const amount = roundCurrency(Math.min(provisionalBalance, remaining));
      withdrawals[person.id] = amount;
      person.superWithdrawal = amount;
      remaining = roundCurrency(remaining - amount);
    });
    personOutputs.forEach((person) => {
      if (!hasFiniteNumber(withdrawals[person.id])) withdrawals[person.id] = person.superWithdrawal || 0;
    });
    return {
      withdrawals,
      total: roundCurrency(requiredAmount - remaining),
      unmet: roundCurrency(remaining),
    };
  }

  function projectRetirementScenario(inputs) {
    const originalInputs = clone(inputs);
    const validationErrors = validateInputs(inputs);
    const normalised = normaliseInputs(inputs || {});
    const youngestCurrentAge = normalised.people.length
      ? Math.min(...normalised.people.map((person) => person.currentAge))
      : 0;
    const projectionHorizonYears = Math.max(0, Math.ceil(normalised.projectionEndAge - youngestCurrentAge));
    const projectedEndAgesByPerson = Object.fromEntries(normalised.people.map((person) => [
      person.id,
      person.currentAge + projectionHorizonYears,
    ]));
    const assumptions = {
      featureFlags: { ...FEATURE_FLAGS },
      financialYear: DEFAULT_FINANCIAL_YEAR,
      annualCalculationOrder: [
        "Determine person employment phases and gross employment income.",
        "Allocate passive taxable income by owner, then calculate person-level tax, Medicare levy, MLS and capped STSL repayment using existing helpers.",
        "Calculate gross and net employer/additional concessional super contributions.",
        "Project annual debt schedules and property values from explicit asset/liability inputs.",
        "Escalate rental/property cash income by CPI, then calculate cashflow using the selected after-interest or before-interest treatment.",
        "Calculate household lifestyle requirement in nominal dollars using today's-dollar inflation.",
        "Apply cash surplus or shortfall to accessible investments first, then available super where permitted.",
        "Apply midpoint total-return earnings to accessible investments and super balances.",
      ],
      ageConvention: "A person's currentAge is treated as their age at the start of projection year zero. Semi-retirement, full-retirement, super access and contribution stop transitions apply when age >= the entered transition age.",
      householdPhaseRules: {
        working: "All people are still full-time.",
        "semi-retirement": "At least one person is no longer full-time and not all people are fully retired.",
        "full-retirement": "All people are fully retired.",
      },
      projectionEndAgeTreatment: "projectionEndAge is the age reached by the youngest person in the household. Older people may be older than projectionEndAge in the final projection year.",
      projectionHorizonYears,
      projectedEndAgesByPerson,
      superAtAge60Treatment: "superByPersonAtAge60 records each person's own projected super balance only in the projection year where that person's age is exactly 60. If a person is older than 60 at projection start, the value remains null because the engine does not reconstruct historical age-60 balances.",
      inflation: "Household lifestyle spending and rental cash income are treated as projection-start dollars and inflated from projection year zero using the same CPI assumption.",
      investmentReturnTiming: "Total-return method. Earnings equal opening balance return plus 50% of net annual cash movement return. Fees use the same midpoint balance. Dividends, interest and rent are not added separately.",
      superContributionTiming: "Employer and additional concessional contributions are reduced by 15% contributions tax before being added to super. Stage 1 does not optimise concessional caps or carry-forward amounts.",
      superAccessTreatment: "scenario-assumed-access-age",
      superAccessNote: "Super availability is modelled using the entered scenario access age. The engine does not independently determine whether all legal conditions of release are satisfied.",
      accessibleContributionTreatment: "accessibleInvestments.externalAnnualAccessibleContribution/currentAnnualContributions is treated as an explicit additional accessible-investment contribution on top of any household cash surplus. It is not auto-populated from household surplus.",
      debtAndPropertyTreatment: "Stage A1 projects supplied non-STSL liabilities annually, separating interest charged, total repayment, principal repaid, capitalised interest, final balloon repayments and repayment cashflow. STSL remains person-level and outside the generic debt schedule.",
      rentalIncomeTreatment: "Rental/property income uses rentalCashflowTreatment. Entered rental cash income is the projection-start annual amount, CPI-escalated each projection year before loan cashflows are applied. afterInterest means loan interest is already included in the entered rental cash income, so only linked principal is deducted from property cashflow. beforeInterest deducts linked loan interest and principal exactly once.",
      passiveIncomeTreatment: "Interest, dividends, distributions and taxable rental income are allocated to each person using stored ownership percentages and included in person-level taxable income. Cash income is modelled separately from taxable income where supplied.",
      rentalTaxModel: "Rental property projection models cashflow, not full future taxable rental profit/loss. Stage C also carries the entered taxable rental-income amount separately for owner-level tax estimates. Negative gearing, depreciation, CGT and future rental tax schedules are not modelled in Stage C.",
      propertyEquityTreatment: "Property equity is reported in projected net worth but is not treated as accessible retirement cash or used to fund lifestyle spending.",
      propertyGrowthAssumptions: {
        principalResidenceCapitalGrowthRate: normalised.assumptions.principalResidenceCapitalGrowthRate,
        investmentPropertyCapitalGrowthRate: normalised.assumptions.investmentPropertyCapitalGrowthRate,
        rentalCashIncomeGrowthRate: normalised.inflationRate,
        rentalCashIncomeGrowthSource: "cpi",
        hierarchy: "Property-specific rate, then scenario-level rate for the matching property type, then a documented 0% fallback only where no applicable rate exists.",
      },
      propertySaleTreatment: "No automatic property sale, refinance, downsizing or redraw event is assumed in Stage A.",
      offsetTreatment: "Existing app offset assumptions are preserved. Stage A1 applies the current offset balance to reduce projected home-loan interest, while loan principal remains the actual liability. The projection does not dynamically deplete offset accounts during retirement; if offset funds are later withdrawn, future loan interest may differ.",
      withdrawalOrder: normalised.scenario.withdrawalOrder,
      superWithdrawalOrder: normalised.scenario.superWithdrawalOrder || "oldest available person first",
      limitations: [
        "No Age Pension, Monte Carlo modelling, contribution optimisation, account-based pension minimums or transfer balance cap treatment.",
        "Additional concessional contributions are paid from household cash and receive contributions-tax treatment only in Stage 1.",
        "Investment assumptions use a total-return model to avoid double counting cash yield.",
        "Property sale, downsizing, refinance, redraw, dynamic offset depletion, CGT, depreciation and negative-gearing optimisation are intentionally deferred.",
      ],
    };

    if (validationErrors.length) {
      return {
        years: [],
        summary: defaultSummary(),
        assumptions,
        validation: { isValid: false, errors: validationErrors },
        warnings: ["Projection was not run because validation errors were found."],
      };
    }

    const peopleStates = {};
    normalised.people.forEach((person) => {
      peopleStates[person.id] = {
        openingSuperBalance: roundCurrency(person.openingSuperBalance),
        stslBalance: roundCurrency(person.stslOpeningBalance),
      };
    });

    const years = [];
    const summary = defaultSummary();
    const warnings = [];
    normalised.people.forEach((person) => {
      if (!Object.prototype.hasOwnProperty.call(summary.superByPersonAtAge60, person.id)) {
        summary.superByPersonAtAge60[person.id] = null;
      }
      if (!Object.prototype.hasOwnProperty.call(summary.superByPersonAtAccessAge, person.id)) {
        summary.superByPersonAtAccessAge[person.id] = null;
      }
      if (person.currentAge > 60) {
        warnings.push(`${person.name} is older than 60 at projection start, so superByPersonAtAge60 is not inferred from the opening balance.`);
      }
    });
    if (normalised.accessibleInvestments.externalAnnualAccessibleContribution > 0) {
      warnings.push("External annual accessible contribution is modelled as additional to ordinary household cash surplus.");
    }
    const assetStates = {};
    normalised.assets.forEach((asset) => {
      assetStates[asset.id] = roundCurrency(asset.openingValue);
    });
    const liabilityStates = {};
    normalised.liabilities.forEach((liability) => {
      liabilityStates[liability.id] = roundCurrency(liability.openingBalance);
    });
    const debtPayoffRecorded = new Set();
    let accessibleOpening = roundCurrency(normalised.accessibleInvestments.openingBalance);
    // Age is measured at the start of each projection year; projectionEndAge belongs to the youngest person.
    const maxYears = projectionHorizonYears;

    for (let yearIndex = 0; yearIndex <= maxYears; yearIndex += 1) {
      const calendarYear = normalised.projectionStartYear + yearIndex;
      const peopleYear = normalised.people.map((person) => {
        const age = person.currentAge + yearIndex;
        const employmentPhase = employmentPhaseForAge(person, age);
        const grossEmploymentIncome = employmentPhase === "fully-retired" ? 0
          : employmentPhase === "semi-retired" ? grownAmount(person.semiRetirementGrossIncome, person.annualIncomeGrowthRate, yearIndex)
            : grownAmount(person.currentGrossEmploymentIncome, person.annualIncomeGrowthRate, yearIndex);
        return {
          id: person.id,
          name: person.name,
          age,
          employmentPhase,
          grossEmploymentIncome,
          superAccessAge: person.superAccessAge,
          hasPrivateHealthCover: person.hasPrivateHealthCover,
          warnings: [],
        };
      });
      const passiveIncomeRows = projectPassiveIncomeRows(normalised, yearIndex);
      peopleYear.forEach((person) => {
        const passive = passiveIncomeForPerson(passiveIncomeRows, person.id);
        person.employmentIncome = roundCurrency(person.grossEmploymentIncome);
        person.interestIncome = passive.interestIncome;
        person.dividendIncome = passive.dividendIncome;
        person.rentalTaxableIncome = passive.rentalTaxableIncome;
        person.distributionIncome = passive.distributionIncome;
        person.otherTaxableIncome = passive.otherTaxableIncome;
        person.totalPassiveTaxableIncome = passive.taxableIncome;
        person.totalPassiveCashIncome = passive.cashIncome;
        person.totalTaxableIncome = roundCurrency(person.grossEmploymentIncome + passive.taxableIncome);
        person.totalCashIncomeBeforeTax = roundCurrency(person.grossEmploymentIncome + passive.cashIncome);
      });

      const mls = calculateMls(peopleYear, normalised);
      if (mls.warning) warnings.push(`${calendarYear}: ${mls.warning}`);

      peopleYear.forEach((person, index) => {
        const source = normalised.people.find((item) => item.id === person.id);
        const taxBreakdown = typeof CALC.individualTaxBreakdown === "function"
          ? CALC.individualTaxBreakdown(person.totalTaxableIncome)
          : fallbackTaxBreakdown(person.totalTaxableIncome);
        const stslOpeningBalance = peopleStates[person.id].stslBalance;
        const stslRepayment = roundCurrency(Math.min(stslOpeningBalance, estimateStslRepayment(person.totalTaxableIncome, stslOpeningBalance)));
        peopleStates[person.id].stslBalance = roundCurrency(Math.max(0, stslOpeningBalance - stslRepayment));
        const medicareLevySurcharge = index === 0 ? mls.person1Surcharge : mls.person2Surcharge;
        const additionalSuperContribution = person.grossEmploymentIncome > 0 && person.age < source.additionalContributionsStopAge
          ? roundCurrency(source.existingAdditionalConcessionalContributions)
          : 0;
        const employerSuper = employerSuperContribution(person.grossEmploymentIncome, source.employerSuperRate);
        person.incomeTax = roundCurrency(taxBreakdown.incomeTax);
        person.medicareLevy = roundCurrency(taxBreakdown.medicareLevy);
        person.medicareLevySurcharge = roundCurrency(medicareLevySurcharge);
        person.stslOpeningBalance = stslOpeningBalance;
        person.stslRepayment = stslRepayment;
        person.stslClosingBalance = peopleStates[person.id].stslBalance;
        person.netEmploymentIncome = roundCurrency(Math.max(0, person.totalCashIncomeBeforeTax - person.incomeTax - person.medicareLevy - person.medicareLevySurcharge - stslRepayment));
        person.netIncome = person.netEmploymentIncome;
        person.employerSuperContribution = employerSuper;
        person.netEmployerSuperContribution = roundCurrency(employerSuper * (1 - DEFAULT_CONTRIBUTIONS_TAX_RATE));
        person.additionalSuperContribution = additionalSuperContribution;
        person.netAdditionalSuperContribution = roundCurrency(additionalSuperContribution * (1 - DEFAULT_CONTRIBUTIONS_TAX_RATE));
        person.superContributionsTax = roundCurrency(
          person.employerSuperContribution
          + person.additionalSuperContribution
          - person.netEmployerSuperContribution
          - person.netAdditionalSuperContribution,
        );
        person.openingSuperBalance = peopleStates[person.id].openingSuperBalance;
        person.superWithdrawal = 0;
      });

      const assetRows = normalised.assets.map((asset) => {
        const row = projectAssetYear(asset, assetStates[asset.id]);
        assetStates[asset.id] = row.closingValue;
        return row;
      });
      const liabilityRows = normalised.liabilities.map((liability) => {
        const row = projectDebtYear(liability, liabilityStates[liability.id], yearIndex, calendarYear);
        liabilityStates[liability.id] = row.closingBalance;
        if (row.paidOffThisYear && !debtPayoffRecorded.has(row.id)) {
          summary.debtPayoffMilestones.push({
            liabilityId: row.id,
            name: row.name,
            calendarYear,
            person1Age: peopleYear[0]?.age ?? null,
            person2Age: peopleYear[1]?.age ?? null,
            type: row.type,
          });
          debtPayoffRecorded.add(row.id);
        }
        row.warnings.forEach((warning) => warnings.push(`${calendarYear} ${row.name}: ${warningCodeMessage(warning)}`));
        return row;
      });
      const propertyIncomeRows = projectPropertyIncomeRows(normalised, liabilityRows, yearIndex);
      const propertyRows = projectPropertyRows(normalised, assetRows, liabilityRows, propertyIncomeRows);
      const debtIdsLinkedToPropertyIncome = new Set(propertyIncomeRows.flatMap((income) => income.linkedLoanIds));
      const totalDebtRepayments = roundCurrency(liabilityRows.reduce((total, debt) => total + debt.totalRepayment, 0));
      const totalLoanInterest = roundCurrency(liabilityRows.reduce((total, debt) => total + debt.interestCharged, 0));
      const totalLoanPrincipal = roundCurrency(liabilityRows.reduce((total, debt) => total + debt.principalRepaid, 0));
      const propertyDebtRepayments = roundCurrency(liabilityRows
        .filter((debt) => debtIdsLinkedToPropertyIncome.has(debt.id))
        .reduce((total, debt) => total + debt.totalRepayment, 0));
      const scheduledDebtCashRequirement = roundCurrency(liabilityRows
        .filter((debt) => !debtIdsLinkedToPropertyIncome.has(debt.id))
        .reduce((total, debt) => total + debt.totalRepayment, 0));
      const legacyFlatLoanRepayments = normalised.liabilities.length
        ? 0
        : roundCurrency(normalised.household.annualLoanPrincipalRepayments);
      const annualDebtCashRequirement = roundCurrency(scheduledDebtCashRequirement + legacyFlatLoanRepayments);
      const netRentalCashflow = roundCurrency(propertyIncomeRows.reduce((total, income) => total + income.netPropertyCashflow, 0));
      const totalPropertyValue = roundCurrency(propertyRows.reduce((total, property) => total + property.closingValue, 0));
      const totalPropertyDebt = roundCurrency(propertyRows.reduce((total, property) => total + property.linkedLoanClosingBalance, 0));
      const totalPropertyEquity = roundCurrency(propertyRows.reduce((total, property) => total + property.propertyEquity, 0));
      const totalDebt = roundCurrency(liabilityRows.reduce((total, debt) => total + debt.closingBalance, 0));
      const totalNonAccessibleAssetValue = roundCurrency(assetRows
        .filter((asset) => asset.includeInNetWorth && !asset.isAccessibleAsset)
        .reduce((total, asset) => total + asset.closingValue, 0));

      const phase = householdPhase(peopleYear);
      const lifestyleBase = phase === "full-retirement"
        ? (normalised.scenario.fullRetirementAnnualSpending || normalised.household.fullRetirementLifestyleSpending)
        : phase === "semi-retirement"
          ? normalised.household.semiRetirementLifestyleSpending
          : normalised.household.currentLifestyleSpending;
      const applicableLifestyleSpending = todayDollarAmount(lifestyleBase, normalised.inflationRate, yearIndex);
      const totalNetEmploymentIncome = roundCurrency(peopleYear.reduce((total, person) => total + person.netEmploymentIncome, 0));
      const totalPassiveCashIncome = roundCurrency(passiveIncomeRows.reduce((total, income) => total + income.cashIncome, 0));
      const totalPassiveTaxableIncome = roundCurrency(passiveIncomeRows.reduce((total, income) => total + income.taxableIncome, 0));
      const totalInterestCashIncome = roundCurrency(passiveIncomeRows.filter((income) => income.type === "interest").reduce((total, income) => total + income.cashIncome, 0));
      const totalDividendCashIncome = roundCurrency(passiveIncomeRows.filter((income) => income.type === "dividends").reduce((total, income) => total + income.cashIncome, 0));
      const totalDistributionCashIncome = roundCurrency(passiveIncomeRows.filter((income) => income.type === "distributions").reduce((total, income) => total + income.cashIncome, 0));
      const totalRentalTaxableIncome = roundCurrency(passiveIncomeRows.filter((income) => income.type === "rentalTaxableIncome").reduce((total, income) => total + income.taxableIncome, 0));
      const otherIncome = roundCurrency(normalised.household.otherAnnualIncome);
      const totalAdditionalSuperContribution = roundCurrency(peopleYear.reduce((total, person) => total + person.additionalSuperContribution, 0));
      const householdCashRequirement = roundCurrency(applicableLifestyleSpending + annualDebtCashRequirement + totalAdditionalSuperContribution);
      const netHouseholdCashIncome = roundCurrency(totalNetEmploymentIncome + otherIncome + netRentalCashflow);
      const cashSurplusOrShortfall = roundCurrency(netHouseholdCashIncome - householdCashRequirement);
      const householdSurplusAccessibleContribution = roundCurrency(Math.max(0, cashSurplusOrShortfall));
      const externalAnnualAccessibleContribution = roundCurrency(normalised.accessibleInvestments.externalAnnualAccessibleContribution);
      const accessibleInvestmentContribution = roundCurrency(householdSurplusAccessibleContribution + externalAnnualAccessibleContribution);
      let accessibleBeforeReturn = roundCurrency(accessibleOpening + accessibleInvestmentContribution);
      let requiredShortfall = roundCurrency(Math.max(0, -cashSurplusOrShortfall));
      const minimumAccessibleBalance = roundCurrency(normalised.scenario.minimumAccessibleBalance);
      const withdrawableAccessible = () => roundCurrency(Math.max(0, accessibleBeforeReturn - minimumAccessibleBalance));
      const requiredAccessibleWithdrawal = roundCurrency(Math.min(requiredShortfall, withdrawableAccessible()));
      accessibleBeforeReturn = roundCurrency(accessibleBeforeReturn - requiredAccessibleWithdrawal);
      requiredShortfall = roundCurrency(requiredShortfall - requiredAccessibleWithdrawal);

      const plannedSemiRetirementWithdrawalRequested = phase === "semi-retirement"
        ? roundCurrency(normalised.scenario.semiRetirementAccessibleWithdrawal)
        : 0;
      const plannedSemiRetirementWithdrawal = roundCurrency(Math.min(plannedSemiRetirementWithdrawalRequested, withdrawableAccessible()));
      accessibleBeforeReturn = roundCurrency(accessibleBeforeReturn - plannedSemiRetirementWithdrawal);
      const unfundedPlannedSemiRetirementWithdrawal = roundCurrency(plannedSemiRetirementWithdrawalRequested - plannedSemiRetirementWithdrawal);

      const superFunding = requiredShortfall > 0
        ? withdrawFromSuper(requiredShortfall, peopleYear, peopleStates, normalised)
        : { total: 0, unmet: 0, withdrawals: {} };
      const unmetSpending = roundCurrency(superFunding.unmet + unfundedPlannedSemiRetirementWithdrawal);
      const totalAccessibleWithdrawal = roundCurrency(requiredAccessibleWithdrawal + plannedSemiRetirementWithdrawal);
      const netAccessibleMovement = roundCurrency(accessibleInvestmentContribution - totalAccessibleWithdrawal);
      const accessibleEarningsBasis = Math.max(0, accessibleOpening + netAccessibleMovement * 0.5);
      const accessibleInvestmentEarnings = roundCurrency(accessibleEarningsBasis * normalised.accessibleInvestments.annualReturnRate);
      const accessibleInvestmentFees = roundCurrency(accessibleEarningsBasis * Math.max(0, normalised.accessibleInvestments.annualFeesRate));
      const closingAccessibleInvestmentBalance = roundCurrency(Math.max(0, accessibleBeforeReturn + accessibleInvestmentEarnings - accessibleInvestmentFees));
      const accessibleReconciliationExpectedClosing = roundCurrency(
        accessibleOpening
        + accessibleInvestmentEarnings
        + householdSurplusAccessibleContribution
        + externalAnnualAccessibleContribution
        - requiredAccessibleWithdrawal
        - plannedSemiRetirementWithdrawal
        - accessibleInvestmentFees,
      );
      const accessibleReconciliationDifference = roundCurrency(closingAccessibleInvestmentBalance - accessibleReconciliationExpectedClosing);

      peopleYear.forEach((person) => {
        const source = normalised.people.find((item) => item.id === person.id);
        const opening = person.openingSuperBalance;
        const netContributions = roundCurrency(person.netEmployerSuperContribution + person.netAdditionalSuperContribution);
        const rate = person.employmentPhase === "fully-retired" ? source.superReturnAfterRetirement : source.superReturnBeforeRetirement;
        const movement = roundCurrency(netContributions - person.superWithdrawal);
        const earningsBasis = Math.max(0, opening + movement * 0.5);
        person.superInvestmentEarnings = roundCurrency(earningsBasis * rate);
        person.superFees = roundCurrency(earningsBasis * Math.max(0, source.superAnnualFeesRate));
        person.closingSuperBalance = roundCurrency(Math.max(0, opening + movement + person.superInvestmentEarnings - person.superFees));
        const expectedSuperClosingBalance = roundCurrency(
          opening
          + person.employerSuperContribution
          + person.additionalSuperContribution
          - person.superContributionsTax
          + person.superInvestmentEarnings
          - person.superFees
          - person.superWithdrawal,
        );
        person.superReconciliation = {
          openingBalance: opening,
          employerContributionGross: person.employerSuperContribution,
          additionalContributionGross: person.additionalSuperContribution,
          contributionsTax: person.superContributionsTax,
          investmentEarnings: person.superInvestmentEarnings,
          fees: person.superFees,
          withdrawal: person.superWithdrawal,
          expectedClosingBalance: expectedSuperClosingBalance,
          closingBalance: person.closingSuperBalance,
          difference: roundCurrency(person.closingSuperBalance - expectedSuperClosingBalance),
        };
        peopleStates[person.id].openingSuperBalance = person.closingSuperBalance;
      });

      const totalSuperBalance = roundCurrency(peopleYear.reduce((total, person) => total + person.closingSuperBalance, 0));
      const totalInvestableAssets = roundCurrency(closingAccessibleInvestmentBalance + totalSuperBalance);
      const totalNetWorth = roundCurrency(closingAccessibleInvestmentBalance + totalSuperBalance + totalNonAccessibleAssetValue - totalDebt);
      const propertyIncomeWarningMessages = propertyIncomeRows
        .flatMap((income) => income.warnings || [])
        .map(warningCodeMessage)
        .filter(Boolean);
      const yearWarnings = yearIndex === 0 ? propertyIncomeWarningMessages : [];
      if (unfundedPlannedSemiRetirementWithdrawal > 0) yearWarnings.push("Planned semi-retirement withdrawal could not be fully funded from accessible investments.");
      if (superFunding.unmet > 0) yearWarnings.push("Household spending shortfall could not be fully funded.");
      if (closingAccessibleInvestmentBalance === 0 && totalAccessibleWithdrawal > 0 && milestoneIsUnset(summary.accessibleFundsExhausted)) {
        summary.accessibleFundsExhausted = milestoneForYear(calendarYear, peopleYear);
        summary.accessibleFundsExhaustedAge = summary.accessibleFundsExhausted.person1Age;
        summary.accessibleFundsExhaustedYear = summary.accessibleFundsExhausted.calendarYear;
      }
      if (unmetSpending > 0 && milestoneIsUnset(summary.firstUnfundedSpending)) {
        summary.firstUnfundedSpending = milestoneForYear(calendarYear, peopleYear);
        summary.firstUnfundedSpendingAge = summary.firstUnfundedSpending.person1Age;
        summary.firstUnfundedSpendingYear = summary.firstUnfundedSpending.calendarYear;
      }
      if (unmetSpending > 0 && totalInvestableAssets === 0 && milestoneIsUnset(summary.allRetirementFundsExhausted)) {
        summary.allRetirementFundsExhausted = milestoneForYear(calendarYear, peopleYear);
        summary.allRetirementFundsExhaustedAge = summary.allRetirementFundsExhausted.person1Age;
        summary.allRetirementFundsExhaustedYear = summary.allRetirementFundsExhausted.calendarYear;
      }
      const retiredPersonIds = peopleYear
        .filter((person) => person.employmentPhase === "fully-retired")
        .map((person) => person.id);
      if (retiredPersonIds.length > 0 && milestoneIsUnset(summary.firstPersonFullRetirement)) {
        summary.firstPersonFullRetirement = retirementMilestoneForYear(calendarYear, peopleYear, retiredPersonIds);
        summary.accessibleBalanceAtFirstPersonFullRetirement = closingAccessibleInvestmentBalance;
        summary.accessibleBalanceAtFirstFullRetirement = closingAccessibleInvestmentBalance;
      }
      if (phase === "full-retirement" && milestoneIsUnset(summary.householdFullRetirement)) {
        summary.householdFullRetirement = milestoneForYear(calendarYear, peopleYear);
        summary.firstFullRetirement = { ...summary.householdFullRetirement };
      }
      if (peopleYear.every((person) => person.age >= person.superAccessAge) && milestoneIsUnset(summary.firstYearAllPeopleSuperAccessible)) {
        summary.firstYearAllPeopleSuperAccessible = milestoneForYear(calendarYear, peopleYear);
      }

      const annualResult = {
        calendarYear,
        yearIndex,
        householdPhase: phase,
        person1Age: peopleYear[0]?.age ?? null,
        person2Age: peopleYear[1]?.age ?? null,
        people: peopleYear.map((person) => ({
          id: person.id,
          name: person.name,
          age: person.age,
          employmentPhase: person.employmentPhase,
          grossEmploymentIncome: roundCurrency(person.grossEmploymentIncome),
          employmentIncome: roundCurrency(person.employmentIncome),
          interestIncome: person.interestIncome,
          dividendIncome: person.dividendIncome,
          rentalTaxableIncome: person.rentalTaxableIncome,
          distributionIncome: person.distributionIncome,
          otherTaxableIncome: person.otherTaxableIncome,
          totalPassiveTaxableIncome: person.totalPassiveTaxableIncome,
          totalPassiveCashIncome: person.totalPassiveCashIncome,
          totalTaxableIncome: person.totalTaxableIncome,
          totalCashIncomeBeforeTax: person.totalCashIncomeBeforeTax,
          incomeTax: person.incomeTax,
          medicareLevy: person.medicareLevy,
          medicareLevySurcharge: person.medicareLevySurcharge,
          stslOpeningBalance: person.stslOpeningBalance,
          stslRepayment: person.stslRepayment,
          stslClosingBalance: person.stslClosingBalance,
          netEmploymentIncome: person.netEmploymentIncome,
          employerSuperContribution: person.employerSuperContribution,
          netEmployerSuperContribution: person.netEmployerSuperContribution,
          additionalSuperContribution: person.additionalSuperContribution,
          netAdditionalSuperContribution: person.netAdditionalSuperContribution,
          superContributionsTax: person.superContributionsTax,
          openingSuperBalance: person.openingSuperBalance,
          superInvestmentEarnings: person.superInvestmentEarnings,
          superFees: person.superFees,
          superWithdrawal: person.superWithdrawal,
          closingSuperBalance: person.closingSuperBalance,
          superReconciliation: person.superReconciliation,
        })),
        household: {
          householdPhase: phase,
          applicableLifestyleSpending,
          totalNetEmploymentIncome,
          totalNetPersonCashIncome: totalNetEmploymentIncome,
          totalPassiveCashIncome,
          totalPassiveTaxableIncome,
          totalInterestCashIncome,
          totalDividendCashIncome,
          totalDistributionCashIncome,
          totalRentalTaxableIncome,
          otherIncome,
          netRentalCashflow,
          netHouseholdCashIncome,
          annualLoanPrincipalRepayments: roundCurrency(legacyFlatLoanRepayments || totalLoanPrincipal),
          legacyFlatLoanRepayments,
          scheduledDebtCashRequirement,
          annualDebtCashRequirement,
          totalDebtRepayments,
          propertyDebtRepayments,
          totalLoanInterest,
          totalLoanPrincipal,
          totalPropertyValue,
          totalPropertyDebt,
          totalPropertyEquity,
          totalDebt,
          totalNetWorth,
          additionalConcessionalContributionsPaidFromCash: totalAdditionalSuperContribution,
          householdCashRequirement,
          cashSurplusOrShortfall,
          plannedSemiRetirementWithdrawal: plannedSemiRetirementWithdrawal,
          plannedSemiRetirementWithdrawalRequested,
          unfundedPlannedSemiRetirementWithdrawal,
          requiredAccessibleWithdrawal,
          totalAccessibleWithdrawal,
          householdSurplusAccessibleContribution,
          externalAnnualAccessibleContribution,
          accessibleInvestmentContribution,
          openingAccessibleInvestmentBalance: accessibleOpening,
          accessibleInvestmentEarnings,
          accessibleInvestmentFees,
          closingAccessibleInvestmentBalance,
          accessibleReconciliation: {
            openingBalance: accessibleOpening,
            householdSurplusContribution: householdSurplusAccessibleContribution,
            externalAnnualAccessibleContribution,
            investmentEarnings: accessibleInvestmentEarnings,
            requiredAccessibleWithdrawal,
            plannedSemiRetirementWithdrawal,
            fees: accessibleInvestmentFees,
            expectedClosingBalance: accessibleReconciliationExpectedClosing,
            closingBalance: closingAccessibleInvestmentBalance,
            difference: accessibleReconciliationDifference,
          },
          totalSuperWithdrawal: superFunding.total,
          totalSuperBalance,
          totalInvestableAssets,
          unmetSpending,
        },
        assets: assetRows,
        liabilities: liabilityRows,
        propertyIncome: propertyIncomeRows,
        passiveIncome: passiveIncomeRows,
        properties: propertyRows,
        warnings: yearWarnings,
      };
      years.push(annualResult);

      if (summary.accessibleBalanceWhenBothFullyRetired === null && peopleYear.every((person) => person.employmentPhase === "fully-retired")) {
        summary.accessibleBalanceWhenBothFullyRetired = closingAccessibleInvestmentBalance;
        summary.totalInvestableAssetsAtFullRetirement = totalInvestableAssets;
      }
      peopleYear.forEach((person) => {
        if (summary.superByPersonAtAge60[person.id] === null && person.age === 60) {
          summary.superByPersonAtAge60[person.id] = person.closingSuperBalance;
        }
        if (summary.superByPersonAtAccessAge[person.id] === null && person.age >= person.superAccessAge) {
          summary.superByPersonAtAccessAge[person.id] = person.closingSuperBalance;
        }
      });
      summary.totalUnfundedSpending = roundCurrency(summary.totalUnfundedSpending + unmetSpending);
      summary.totalPlannedSemiRetirementWithdrawals = roundCurrency(summary.totalPlannedSemiRetirementWithdrawals + plannedSemiRetirementWithdrawal);
      if (phase === "full-retirement") {
        summary.totalRetirementWithdrawals = roundCurrency(summary.totalRetirementWithdrawals + requiredAccessibleWithdrawal + superFunding.total);
      }
      accessibleOpening = closingAccessibleInvestmentBalance;
    }

    const finalYear = years.at(-1);
    if (finalYear) {
      summary.accessibleBalanceAtEndAge = finalYear.household.closingAccessibleInvestmentBalance;
      summary.superBalanceAtEndAge = finalYear.household.totalSuperBalance;
      summary.totalInvestableAssetsAtEndAge = finalYear.household.totalInvestableAssets;
      summary.totalDebtAtEndAge = finalYear.household.totalDebt;
      summary.totalPropertyValueAtEndAge = finalYear.household.totalPropertyValue;
      summary.totalPropertyDebtAtEndAge = finalYear.household.totalPropertyDebt;
      summary.totalPropertyEquityAtEndAge = finalYear.household.totalPropertyEquity;
      summary.totalNetWorthAtEndAge = finalYear.household.totalNetWorth;
    }
    summary.minimumEstateBalanceTarget = roundCurrency(normalised.scenario.minimumEstateBalanceAtEndAge);
    summary.minimumEstateBalanceShortfallAtEndAge = roundCurrency(Math.max(
      0,
      summary.minimumEstateBalanceTarget - summary.totalInvestableAssetsAtEndAge,
    ));
    summary.meetsMinimumEstateBalanceAtEndAge = summary.minimumEstateBalanceShortfallAtEndAge === 0;
    const allAge60BalancesAvailable = normalised.people.every((person) => hasFiniteNumber(summary.superByPersonAtAge60[person.id]));
    summary.totalSuperAtAge60 = allAge60BalancesAvailable
      ? roundCurrency(normalised.people.reduce((total, person) => total + summary.superByPersonAtAge60[person.id], 0))
      : null;
    if (summary.accessibleBalanceWhenBothFullyRetired === null) summary.accessibleBalanceWhenBothFullyRetired = finalYear?.household.closingAccessibleInvestmentBalance ?? 0;
    if (summary.totalInvestableAssetsAtFullRetirement === null) summary.totalInvestableAssetsAtFullRetirement = finalYear?.household.totalInvestableAssets ?? 0;

    const result = {
      years,
      summary,
      assumptions,
      validation: { isValid: true, errors: [] },
      warnings,
    };
    if (JSON.stringify(inputs) !== JSON.stringify(originalInputs)) {
      result.warnings.push("Input mutation was detected. This should not occur.");
    }
    return result;
  }

  global.FFSSemiRetirementProjection = {
    featureFlags: FEATURE_FLAGS,
    projectRetirementScenario,
    validateRetirementProjectionInputs: validateInputs,
    normaliseRetirementProjectionInputs: normaliseInputs,
    projectDebtYearForAudit: projectDebtYear,
    projectPassiveIncomeRowsForAudit: projectPassiveIncomeRows,
  };
})(globalThis);
