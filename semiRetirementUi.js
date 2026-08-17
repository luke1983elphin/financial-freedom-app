(function attachSemiRetirementUi(global) {
  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function finiteNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function nonNegative(value) {
    return Math.max(0, number(value));
  }

  function percentToRate(value) {
    return number(value) / 100;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function planValue(plan, path, fallback = 0) {
    return path.split(".").reduce((cursor, key) => cursor?.[key], plan) ?? fallback;
  }

  function roundCurrency(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function roundRatio(value) {
    return Math.round((number(value) + Number.EPSILON) * 10000) / 10000;
  }

  function formatPercentRate(rate) {
    return `${roundRatio(number(rate) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  }

  function annualiseAmount(amount, frequency = "annually") {
    const value = number(amount);
    if (frequency === "weekly") return roundCurrency(value * 52);
    if (frequency === "fortnightly") return roundCurrency(value * 26);
    if (frequency === "monthly") return roundCurrency(value * 12);
    if (frequency === "quarterly") return roundCurrency(value * 4);
    return roundCurrency(value);
  }

  const DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE = number(global.FFSCalculator?.DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE, 0.03);
  const DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE = number(global.FFSCalculator?.DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE, 0.03);
  const PRINCIPAL_RESIDENCE_TYPES = new Set(["home", "principalResidence", "principal_residence"]);
  const RENTAL_INVESTMENT_PROPERTY_TYPES = new Set(["rentalInvestmentProperty", "rentalProperty", "investmentProperty", "residentialInvestmentProperty", "commercialInvestmentProperty", "incomeProducingProperty"]);
  const OTHER_PROPERTY_TYPES = new Set(["otherProperty"]);
  const PROPERTY_TYPES = new Set([...PRINCIPAL_RESIDENCE_TYPES, ...RENTAL_INVESTMENT_PROPERTY_TYPES, ...OTHER_PROPERTY_TYPES]);
  const PASSIVE_TAXABLE_INCOME_TYPES = new Set(["interest", "dividends", "distributions", "rentalNetCashIncome"]);
  const PROPERTY_GROWTH_SOURCE_LABELS = {
    "asset-specific": "property-specific assumption",
    "investment-property-default": "investment property capital-growth assumption",
    "principal-residence-default": "principal residence capital-growth assumption",
    "zero-fallback": "0% fallback because no applicable growth assumption was entered",
  };

  function ratePctFromPercentageField(value) {
    const parsed = finiteNumberOrNull(value);
    if (parsed === null) return null;
    if (parsed < -100) return null;
    return roundRatio(parsed);
  }

  function ratePctFromDecimalField(value) {
    const parsed = finiteNumberOrNull(value);
    if (parsed === null) return null;
    if (parsed < -1) return null;
    return roundRatio(parsed * 100);
  }

  function firstFieldContractRatePct(candidates = []) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const rate = candidate.unit === "percent"
        ? ratePctFromPercentageField(candidate.value)
        : ratePctFromDecimalField(candidate.value);
      if (rate !== null) return rate;
    }
    return null;
  }

  function firstPercentageRatePct(candidates = []) {
    for (const value of candidates) {
      const rate = ratePctFromPercentageField(value);
      if (rate !== null) return rate;
    }
    return null;
  }

  function propertyTypeGroup(type = "") {
    if (PRINCIPAL_RESIDENCE_TYPES.has(type)) return "principal-residence";
    if (RENTAL_INVESTMENT_PROPERTY_TYPES.has(type)) return "investment-property";
    if (OTHER_PROPERTY_TYPES.has(type)) return "other-property";
    return PROPERTY_TYPES.has(type) ? "property" : "non-property";
  }

  function propertySpecificGrowthRatePct(item = {}) {
    return firstFieldContractRatePct([
      { value: item.assetSpecificGrowthRatePct, unit: "percent" },
      { value: item.annualGrowthRatePct, unit: "percent" },
      { value: item.propertyGrowthRatePct, unit: "percent" },
      { value: item.capitalGrowthRatePct, unit: "percent" },
      { value: item.expectedGrowthRatePct, unit: "percent" },
      { value: item.growthRatePct, unit: "percent" },
      { value: item.assetSpecificGrowthRate, unit: "decimal" },
      { value: item.annualGrowthRate, unit: "decimal" },
      { value: item.propertyGrowthRate, unit: "decimal" },
      { value: item.capitalGrowthRate, unit: "decimal" },
      { value: item.expectedGrowthRate, unit: "decimal" },
      { value: item.growthRate, unit: "decimal" },
    ]);
  }

  function propertyGrowthAssumptionsFromPlan(plan = {}) {
    const principalResidenceCapitalGrowthRatePct = firstFieldContractRatePct([
      { value: plan.investing?.principalResidenceGrowthRatePct, unit: "percent" },
      { value: plan.investing?.homeGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.principalResidenceGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.homeGrowthRatePct, unit: "percent" },
      { value: plan.investing?.principalResidenceGrowthRate, unit: "decimal" },
      { value: plan.investing?.homeGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.principalResidenceGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.homeGrowthRate, unit: "decimal" },
      { value: DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE, unit: "decimal" },
    ]);
    const investmentPropertyCapitalGrowthRatePct = firstFieldContractRatePct([
      { value: plan.investing?.investmentPropertyGrowthRatePct, unit: "percent" },
      { value: plan.investing?.propertyGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.investmentPropertyGrowthRatePct, unit: "percent" },
      { value: plan.assumptions?.propertyGrowthRatePct, unit: "percent" },
      { value: plan.investing?.investmentPropertyGrowthRate, unit: "decimal" },
      { value: plan.investing?.propertyGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.investmentPropertyGrowthRate, unit: "decimal" },
      { value: plan.assumptions?.propertyGrowthRate, unit: "decimal" },
      { value: DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE, unit: "decimal" },
    ]);
    return {
      principalResidenceCapitalGrowthRatePct: principalResidenceCapitalGrowthRatePct ?? 0,
      investmentPropertyCapitalGrowthRatePct: investmentPropertyCapitalGrowthRatePct ?? 0,
    };
  }

  function resolvePlanPropertyGrowthRatePct(plan = {}, item = {}, assumptions = propertyGrowthAssumptionsFromPlan(plan)) {
    const type = item.category || item.type || "";
    const group = propertyTypeGroup(type);
    const specificRate = propertySpecificGrowthRatePct(item);
    if (specificRate !== null) return { ratePct: specificRate, source: "asset-specific", group };
    if (group === "investment-property") {
      return { ratePct: assumptions.investmentPropertyCapitalGrowthRatePct, source: "investment-property-default", group };
    }
    if (group === "principal-residence") {
      return { ratePct: assumptions.principalResidenceCapitalGrowthRatePct, source: "principal-residence-default", group };
    }
    return { ratePct: 0, source: "zero-fallback", group };
  }

  function resolveScenarioPropertyGrowthRatePct(draft = {}, asset = {}) {
    const type = asset.type || asset.category || "";
    const group = propertyTypeGroup(type);
    const scenarioAssumptions = {
      principalResidenceCapitalGrowthRatePct: firstPercentageRatePct([draft.assumptions?.principalResidenceCapitalGrowthRatePct]) ?? 0,
      investmentPropertyCapitalGrowthRatePct: firstPercentageRatePct([draft.assumptions?.investmentPropertyCapitalGrowthRatePct]) ?? 0,
    };
    const source = String(asset.growthRateSource || "");
    if (source === "asset-specific") {
      const specificRate = firstFieldContractRatePct([
        { value: asset.assetSpecificGrowthRatePct, unit: "percent" },
        { value: asset.annualGrowthRatePct, unit: "percent" },
        { value: asset.propertyGrowthRatePct, unit: "percent" },
        { value: asset.capitalGrowthRatePct, unit: "percent" },
        { value: asset.expectedGrowthRatePct, unit: "percent" },
        { value: asset.growthRatePct, unit: "percent" },
        { value: asset.assetSpecificGrowthRate, unit: "decimal" },
        { value: asset.annualGrowthRate, unit: "decimal" },
        { value: asset.propertyGrowthRate, unit: "decimal" },
        { value: asset.capitalGrowthRate, unit: "decimal" },
        { value: asset.expectedGrowthRate, unit: "decimal" },
        { value: asset.growthRate, unit: "decimal" },
      ]);
      if (specificRate !== null) return { ratePct: specificRate, source: "asset-specific", group };
    }
    if (source && source !== "asset-specific") {
      if (group === "investment-property") return { ratePct: scenarioAssumptions.investmentPropertyCapitalGrowthRatePct, source: "investment-property-default", group };
      if (group === "principal-residence") return { ratePct: scenarioAssumptions.principalResidenceCapitalGrowthRatePct, source: "principal-residence-default", group };
      return { ratePct: 0, source: "zero-fallback", group };
    }
    const specificRate = propertySpecificGrowthRatePct(asset);
    if (specificRate !== null) return { ratePct: specificRate, source: "asset-specific", group };
    if (group === "investment-property") return { ratePct: scenarioAssumptions.investmentPropertyCapitalGrowthRatePct, source: "investment-property-default", group };
    if (group === "principal-residence") return { ratePct: scenarioAssumptions.principalResidenceCapitalGrowthRatePct, source: "principal-residence-default", group };
    return { ratePct: 0, source: "zero-fallback", group };
  }

  function linkedLoanIds(item = {}) {
    if (Array.isArray(item.linkedLoanIds)) return item.linkedLoanIds.map((id) => String(id || "")).filter(Boolean);
    if (typeof item.linkedLoanIds === "string") return item.linkedLoanIds.split(",").map((id) => id.trim()).filter(Boolean);
    return item.linkedLoanId ? [String(item.linkedLoanId)] : [];
  }

  function normalisedIncomeItems(plan = {}) {
    if (typeof global.FFSCalculator?.normalisedIncomeItems === "function") return global.FFSCalculator.normalisedIncomeItems(plan);
    return Array.isArray(plan.incomeItems) ? plan.incomeItems : [];
  }

  function incomeAllocation(item = {}) {
    if (typeof global.FFSCalculator?.incomeAllocation === "function") return global.FFSCalculator.incomeAllocation(item);
    const owner = item.owner || item.incomeOwner;
    if (owner === "person1") return { person1: 1, person2: 0 };
    if (owner === "person2") return { person1: 0, person2: 1 };
    const p1 = number(item.person1AllocationPercentage ?? item.person1AllocationPct, 50);
    const p2 = number(item.person2AllocationPercentage ?? item.person2AllocationPct, 50);
    const total = p1 + p2 || 100;
    return { person1: roundRatio(p1 / total), person2: roundRatio(p2 / total) };
  }

  function incomeCashAnnualAmount(item = {}) {
    if (typeof global.FFSCalculator?.incomeCashAnnualAmount === "function") return global.FFSCalculator.incomeCashAnnualAmount(item);
    return annualiseAmount(item.amount, item.frequency || "annually");
  }

  function incomeTaxableAnnualAmount(item = {}) {
    if (typeof global.FFSCalculator?.incomeTaxableAnnualAmount === "function") return global.FFSCalculator.incomeTaxableAnnualAmount(item);
    return incomeCashAnnualAmount(item);
  }

  function rentalCashIncomeAnnualAmount(item = {}) {
    if (typeof global.FFSCalculator?.rentalCashIncomeAnnualAmount === "function") return global.FFSCalculator.rentalCashIncomeAnnualAmount(item);
    const source = item.rentalCashIncomeAnnual ?? item.annualRentalCashIncome ?? item.annualCashIncome ?? item.cashIncome ?? item.annualNetRentalCashIncome;
    if (source === undefined || source === null || source === "") return null;
    return annualiseAmount(source, item.rentalCashIncomeFrequency || item.cashIncomeFrequency || item.frequency || "annually");
  }

  function hasRentalCashIncomeAnnualAmount(item = {}) {
    if (typeof global.FFSCalculator?.hasRentalCashIncomeAnnualAmount === "function") return global.FFSCalculator.hasRentalCashIncomeAnnualAmount(item);
    return [item.rentalCashIncomeAnnual, item.annualRentalCashIncome, item.annualCashIncome, item.cashIncome, item.annualNetRentalCashIncome]
      .some((value) => value !== undefined && value !== null && value !== "");
  }

  function rentalLoansLinkedToIncome(plan = {}, income = {}) {
    const existing = new Set(linkedLoanIds(income));
    const incomeLinkedAssetId = String(income.linkedAssetId || income.linkedPropertyAssetId || "");
    const rentalLoans = (Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [])
      .filter((loan) => loan.type === "rentalPropertyLoan");
    rentalLoans.forEach((loan) => {
      const loanId = String(loan.id || "");
      if (!loanId) return;
      const loanLinkedAssetId = String(loan.linkedAssetId || loan.investmentLink?.linkedAssetId || "");
      if (loan.linkedRentalIncomeId && String(loan.linkedRentalIncomeId) === String(income.id || "")) existing.add(loanId);
      if (incomeLinkedAssetId && loanLinkedAssetId && loanLinkedAssetId === incomeLinkedAssetId) existing.add(loanId);
    });
    return Array.from(existing).filter((loanId) => {
      const loan = rentalLoans.find((item) => String(item.id || "") === loanId);
      if (!loan) return false;
      const loanLinkedAssetId = String(loan.linkedAssetId || loan.investmentLink?.linkedAssetId || "");
      return !incomeLinkedAssetId || !loanLinkedAssetId || loanLinkedAssetId === incomeLinkedAssetId || String(loan.linkedRentalIncomeId || "") === String(income.id || "");
    });
  }

  function projectionAssetsFromPlan(plan = {}) {
    const items = Array.isArray(plan.assetItems) ? plan.assetItems : [];
    const propertyLike = new Set(["home", "principalResidence", "principal_residence", "otherProperty", "rentalInvestmentProperty", "rentalProperty", "investmentProperty", "vehicle"]);
    const growthAssumptions = propertyGrowthAssumptionsFromPlan(plan);
    const detailed = items
      .filter((item) => propertyLike.has(item.category || item.type))
      .map((item, index) => {
        const type = item.category || item.type || "other";
        const resolvedGrowth = PROPERTY_TYPES.has(type)
          ? resolvePlanPropertyGrowthRatePct(plan, item, growthAssumptions)
          : { ratePct: 0, source: "zero-fallback", group: "non-property" };
        return {
          id: String(item.id || `asset-${index + 1}`),
          name: String(item.name || item.description || `Asset ${index + 1}`),
          type,
          openingValue: nonNegative(item.value ?? item.currentValue ?? item.balance),
          annualGrowthRatePct: resolvedGrowth.ratePct,
          assetSpecificGrowthRatePct: resolvedGrowth.source === "asset-specific" ? resolvedGrowth.ratePct : null,
          growthRateSource: resolvedGrowth.source,
          propertyTypeGroup: resolvedGrowth.group,
          includeInNetWorth: item.includeInNetWorth !== false,
          isAccessibleAsset: false,
          isPersonalUse: item.isPersonalUse === true,
        };
      })
      .filter((item) => item.openingValue > 0 || item.type === "rentalInvestmentProperty");
    if (detailed.length) {
      const hasPrincipalResidence = detailed.some((item) => propertyTypeGroup(item.type) === "principal-residence");
      const hasLegacyOtherProperty = detailed.some((item) => item.id === "legacy-other-property" || propertyTypeGroup(item.type) === "other-property");
      if (!hasPrincipalResidence && nonNegative(plan.assets?.homeValue) > 0) {
        const resolvedGrowth = resolvePlanPropertyGrowthRatePct(plan, { type: "home" }, growthAssumptions);
        detailed.unshift({ id: "legacy-home", name: "Home", type: "home", openingValue: nonNegative(plan.assets.homeValue), annualGrowthRatePct: resolvedGrowth.ratePct, growthRateSource: resolvedGrowth.source, propertyTypeGroup: resolvedGrowth.group, includeInNetWorth: true, isAccessibleAsset: false });
      }
      if (!hasLegacyOtherProperty && nonNegative(plan.assets?.otherPropertyValue) > 0) {
        const resolvedGrowth = resolvePlanPropertyGrowthRatePct(plan, { type: "otherProperty" }, growthAssumptions);
        detailed.push({ id: "legacy-other-property", name: "Other property", type: "otherProperty", openingValue: nonNegative(plan.assets.otherPropertyValue), annualGrowthRatePct: resolvedGrowth.ratePct, growthRateSource: resolvedGrowth.source, propertyTypeGroup: resolvedGrowth.group, includeInNetWorth: true, isAccessibleAsset: false });
      }
      return detailed;
    }
    const fallback = [];
    if (nonNegative(plan.assets?.homeValue) > 0) {
      const resolvedGrowth = resolvePlanPropertyGrowthRatePct(plan, { type: "home" }, growthAssumptions);
      fallback.push({ id: "legacy-home", name: "Home", type: "home", openingValue: nonNegative(plan.assets.homeValue), annualGrowthRatePct: resolvedGrowth.ratePct, growthRateSource: resolvedGrowth.source, propertyTypeGroup: resolvedGrowth.group, includeInNetWorth: true, isAccessibleAsset: false });
    }
    if (nonNegative(plan.assets?.otherPropertyValue) > 0) {
      const resolvedGrowth = resolvePlanPropertyGrowthRatePct(plan, { type: "otherProperty" }, growthAssumptions);
      fallback.push({ id: "legacy-other-property", name: "Other property", type: "otherProperty", openingValue: nonNegative(plan.assets.otherPropertyValue), annualGrowthRatePct: resolvedGrowth.ratePct, growthRateSource: resolvedGrowth.source, propertyTypeGroup: resolvedGrowth.group, includeInNetWorth: true, isAccessibleAsset: false });
    }
    if (nonNegative(plan.assets?.vehiclesPersonalAssets) > 0) {
      fallback.push({ id: "legacy-vehicle", name: "Vehicles / personal assets", type: "vehicle", openingValue: nonNegative(plan.assets.vehiclesPersonalAssets), annualGrowthRatePct: 0, includeInNetWorth: true, isAccessibleAsset: false });
    }
    return fallback;
  }

  function projectionLiabilitiesFromPlan(plan = {}) {
    const items = Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [];
    const homeLoanTypes = new Set(["homeLoan", "mortgage", "home_loan", "mortgageLoan"]);
    let unappliedHomeOffsetBalance = nonNegative(plan.assets?.offsetBalance);
    const offsetForLiability = (item, type, openingBalance) => {
      const explicitOffset = item.openingOffsetBalance ?? item.offsetBalance ?? item.linkedOffsetBalance;
      if (explicitOffset !== null && explicitOffset !== undefined && explicitOffset !== "") return nonNegative(explicitOffset);
      if (!homeLoanTypes.has(type)) return 0;
      const assigned = Math.min(openingBalance, unappliedHomeOffsetBalance);
      unappliedHomeOffsetBalance = Math.max(0, unappliedHomeOffsetBalance - assigned);
      return assigned;
    };
    const filtered = items
      .filter((item) => !["stsl", "hecsHelp", "helpDebt", "studyLoan"].includes(item.type || item.category))
      .map((item, index) => {
        const type = item.type || item.category || "otherDebt";
        const openingBalance = nonNegative(item.balance ?? item.currentBalance ?? item.value);
        return {
          id: String(item.id || `liability-${index + 1}`),
          name: String(item.name || item.description || `Liability ${index + 1}`),
          type,
          linkedAssetId: String(item.linkedAssetId || item.investmentLink?.linkedAssetId || ""),
          linkedRentalIncomeId: String(item.linkedRentalIncomeId || ""),
          openingBalance,
          openingOffsetBalance: offsetForLiability(item, type, openingBalance),
          interestRatePct: number(item.interestRatePct ?? item.interestRate ?? item.annualInterestRate),
          repaymentAmount: nonNegative(item.repayment ?? item.repaymentAmount),
          repaymentFrequency: item.repaymentFrequency || "monthly",
          remainingTermYears: nonNegative(item.termYears ?? item.remainingTermYears),
          repaymentType: item.repaymentType === "interestOnly" ? "interestOnly" : "principalAndInterest",
          additionalPrincipalRepayment: nonNegative(item.additionalPrincipalRepayment),
          additionalPrincipalFrequency: item.additionalPrincipalFrequency || "annually",
        };
      })
      .filter((item) => item.openingBalance > 0 || item.repaymentAmount > 0);
    if (filtered.length) return filtered;
    const fallback = [];
    if (nonNegative(plan.liabilities?.homeLoanBalance) > 0) {
      fallback.push({
        id: "legacy-home-loan",
        name: "Home loan",
        type: "homeLoan",
        linkedAssetId: "legacy-home",
        openingBalance: nonNegative(plan.liabilities.homeLoanBalance),
        openingOffsetBalance: Math.min(nonNegative(plan.liabilities.homeLoanBalance), nonNegative(plan.assets?.offsetBalance)),
        interestRatePct: number(plan.liabilities.homeLoanInterestRatePct),
        repaymentAmount: nonNegative(plan.liabilities.monthlyRepayment),
        repaymentFrequency: "monthly",
        remainingTermYears: nonNegative(plan.liabilities.remainingLoanTermYears),
        repaymentType: "principalAndInterest",
      });
    }
    if (nonNegative(plan.liabilities?.creditCardBalance) > 0) {
      fallback.push({
        id: "legacy-credit-card",
        name: "Credit card",
        type: "creditCard",
        openingBalance: nonNegative(plan.liabilities.creditCardBalance),
        interestRatePct: number(plan.liabilities.creditCardInterestRatePct),
        repaymentAmount: nonNegative(plan.liabilities.creditCardMonthlyRepayment),
        repaymentFrequency: "monthly",
        remainingTermYears: 30,
        repaymentType: "principalAndInterest",
      });
    }
    if (nonNegative(plan.liabilities?.otherDebts) > 0) {
      fallback.push({
        id: "legacy-other-debt",
        name: "Other debts",
        type: "otherDebt",
        openingBalance: nonNegative(plan.liabilities.otherDebts),
        interestRatePct: 0,
        repaymentAmount: 0,
        repaymentFrequency: "monthly",
        remainingTermYears: 30,
        repaymentType: "principalAndInterest",
      });
    }
    return fallback;
  }

  function projectionPropertyIncomeFromPlan(plan = {}) {
    return normalisedIncomeItems(plan)
      .filter((item) => item.type === "rentalNetCashIncome" || item.incomeType === "rentalNetCashIncome")
      .map((item, index) => {
        const hasRentalCashIncome = hasRentalCashIncomeAnnualAmount(item);
        return {
          id: String(item.id || `property-income-${index + 1}`),
          name: String(item.propertyName || item.name || `Rental property ${index + 1}`),
          linkedAssetId: String(item.linkedAssetId || item.linkedPropertyAssetId || ""),
          linkedLoanIds: rentalLoansLinkedToIncome(plan, item),
          annualIncome: hasRentalCashIncome ? rentalCashIncomeAnnualAmount(item) : null,
          hasRentalCashIncome,
          missingRentalCashIncome: !hasRentalCashIncome,
          taxableRentalIncomeAnnual: incomeTaxableAnnualAmount(item),
          annualGrowthRatePct: number(item.annualGrowthRatePct ?? item.growthRatePct ?? 0),
          rentalCashflowTreatment: item.rentalCashflowTreatment === "beforeInterest" ? "beforeInterest" : "afterInterest",
        };
      });
  }

  function projectionPassiveIncomeFromPlan(plan = {}) {
    return normalisedIncomeItems(plan)
      .filter((item) => {
        if (PASSIVE_TAXABLE_INCOME_TYPES.has(item.type)) return true;
        return item.type === "other" && (item.isPassiveIncome === true || item.passiveIncome === true || item.isPassive === true);
      })
      .map((item, index) => {
        const allocation = incomeAllocation(item);
        const isRental = item.type === "rentalNetCashIncome";
        const annualCashIncome = isRental ? 0 : incomeCashAnnualAmount(item);
        const annualTaxableIncome = incomeTaxableAnnualAmount(item);
        const type = isRental ? "rentalTaxableIncome" : item.type === "other" ? "otherPassive" : item.type;
        return {
          id: `passive-${String(item.id || index + 1)}`,
          sourceIncomeId: String(item.id || ""),
          name: String(item.name || item.propertyName || `Passive income ${index + 1}`),
          type,
          owner: item.owner || item.incomeOwner || "joint",
          person1AllocationPercentage: roundRatio(allocation.person1 * 100),
          person2AllocationPercentage: roundRatio(allocation.person2 * 100),
          annualCashIncome,
          annualTaxableIncome,
          linkedAssetId: String(item.linkedAssetId || item.linkedPropertyAssetId || ""),
        };
      });
  }

  function personName(plan, index) {
    return String(plan?.personal?.[`person${index}Name`] || `Person ${index}`);
  }

  function personId(index) {
    return `person${index}`;
  }

  function hasSecondPerson(plan = {}, result = {}) {
    return Boolean(
      plan.personal?.person2Name
      || number(plan.personal?.person2Age) > 0
      || number(result.person2SalaryWages) > 0
      || number(plan.assets?.superPerson2) > 0
      || number(result.helpRepaymentEstimate?.person2?.openingBalance) > 0
      || number(result.people?.person2?.taxableIncome) > 0,
    );
  }

  function salaryForPerson(result = {}, index) {
    const key = personId(index);
    return nonNegative(result[`${key}SalaryWages`] ?? result.people?.[key]?.salaryAndWages);
  }

  function superForPerson(plan = {}, index) {
    return nonNegative(plan.assets?.[`superPerson${index}`]);
  }

  function stslForPerson(result = {}, index) {
    return nonNegative(result.helpRepaymentEstimate?.[personId(index)]?.openingBalance);
  }

  function defaultFullRetirementAge(plan = {}, index) {
    const currentAge = nonNegative(plan.personal?.[`person${index}Age`]);
    const entered = number(plan.personal?.fullRetirementAge || plan.personal?.semiRetirementAge || plan.personal?.workOptionalAge);
    return Math.max(currentAge, entered || currentAge);
  }

  function basePlanSourceKey(plan = {}, result = {}) {
    return JSON.stringify({
      personal: {
        person1Name: plan.personal?.person1Name || "",
        person2Name: plan.personal?.person2Name || "",
        person1Age: number(plan.personal?.person1Age),
        person2Age: number(plan.personal?.person2Age),
        fullRetirementAge: number(plan.personal?.fullRetirementAge),
        semiRetirementAge: number(plan.personal?.semiRetirementAge),
        targetAnnualSpending: number(plan.personal?.targetAnnualSpending),
      },
      household: {
        annualLivingExpenses: nonNegative(result.annualLivingExpenses),
      },
      income: {
        person1SalaryWages: salaryForPerson(result, 1),
        person2SalaryWages: salaryForPerson(result, 2),
      },
      assets: {
        accessibleInvestmentAssets: nonNegative(result.accessibleInvestmentAssets),
        superPerson1: superForPerson(plan, 1),
        superPerson2: superForPerson(plan, 2),
        projectedAssets: projectionAssetsFromPlan(plan),
      },
      liabilities: {
        projectedLiabilities: projectionLiabilitiesFromPlan(plan),
      },
      propertyIncome: {
        projectedPropertyIncome: projectionPropertyIncomeFromPlan(plan),
      },
      passiveIncome: {
        projectedPassiveIncome: projectionPassiveIncomeFromPlan(plan),
      },
      assumptions: {
        investmentReturnPct: number(plan.investing?.expectedInvestmentReturnPct),
        superReturnPct: number(plan.investing?.expectedSuperReturnPct),
        inflationPct: number(plan.investing?.inflationPct),
        wageGrowthPct: number(plan.investing?.wageGrowthPct),
        propertyGrowth: propertyGrowthAssumptionsFromPlan(plan),
        employerSuperRate: number(result.employerSuperRate || result.taxConfiguration?.employerSuperRate),
      },
      stsl: {
        person1: stslForPerson(result, 1),
        person2: stslForPerson(result, 2),
      },
    });
  }

  function defaultScenarioLifestyleSpending(plan = {}, result = {}) {
    const annualLivingExpenses = finiteNumberOrNull(result.annualLivingExpenses);
    if (annualLivingExpenses !== null) return Math.max(0, annualLivingExpenses);
    return nonNegative(plan.personal?.targetAnnualSpending);
  }

  function personDefaults(plan = {}, result = {}, index = 1) {
    const currentAge = nonNegative(plan.personal?.[`person${index}Age`]);
    const fullRetirementAge = defaultFullRetirementAge(plan, index);
    const employerSuperRatePct = number(result.employerSuperRate || result.taxConfiguration?.employerSuperRate || 0.12) * 100;
    const superReturnPct = number(plan.investing?.expectedSuperReturnPct, 6.5);
    return {
      id: personId(index),
      name: personName(plan, index),
      currentAge,
      currentGrossEmploymentIncome: salaryForPerson(result, index),
      annualIncomeGrowthRatePct: number(plan.investing?.wageGrowthPct, 3),
      hasSemiRetirement: false,
      semiRetirementAge: fullRetirementAge,
      semiRetirementGrossIncome: 0,
      fullRetirementAge,
      superAccessAge: 60,
      openingSuperBalance: superForPerson(plan, index),
      superReturnBeforeRetirementPct: superReturnPct,
      superReturnAfterRetirementPct: Math.max(0, superReturnPct - 1),
      superAnnualFeesRatePct: 0,
      employerSuperRatePct,
      existingAdditionalConcessionalContributions: 0,
      additionalContributionsStopAge: fullRetirementAge,
      stslOpeningBalance: stslForPerson(result, index),
      hasPrivateHealthCover: result.people?.[personId(index)]?.privateHealth?.hasAppropriateHospitalCover !== false,
    };
  }

  function buildSemiRetirementScenarioDefaults(plan = {}, result = {}) {
    const lifestyleSpending = defaultScenarioLifestyleSpending(plan, result);
    const people = [personDefaults(plan, result, 1)];
    if (hasSecondPerson(plan, result)) people.push(personDefaults(plan, result, 2));
    const assets = projectionAssetsFromPlan(plan);
    const liabilities = projectionLiabilitiesFromPlan(plan);
    const propertyIncome = projectionPropertyIncomeFromPlan(plan);
    const passiveIncome = projectionPassiveIncomeFromPlan(plan);
    const propertyGrowthAssumptions = propertyGrowthAssumptionsFromPlan(plan);
    const mappedPropertyIncomeTotal = roundCurrency(propertyIncome.reduce((total, item) => total + number(item.annualIncome), 0));
    const mappedPassiveCashIncomeTotal = roundCurrency(passiveIncome.reduce((total, item) => total + number(item.annualCashIncome), 0));
    const otherAnnualIncome = roundCurrency(Math.max(0, number(result.otherAnnualIncome) - mappedPropertyIncomeTotal - mappedPassiveCashIncomeTotal));
    const draft = {
      version: 1,
      projectionStartYear: currentYear(),
      projectionEndAge: 90,
      household: {
        currentLifestyleSpending: lifestyleSpending,
        semiRetirementLifestyleSpending: lifestyleSpending,
        fullRetirementLifestyleSpending: lifestyleSpending,
        annualLoanPrincipalRepayments: 0,
        otherAnnualIncome,
      },
      accessibleInvestments: {
        openingBalance: nonNegative(result.accessibleInvestmentAssets),
        openingOffsetBalance: Math.min(nonNegative(result.accessibleInvestmentAssets), nonNegative(plan.assets?.offsetBalance)),
        annualReturnRatePct: number(plan.investing?.expectedInvestmentReturnPct, 7),
        annualFeesRatePct: 0,
        externalAnnualAccessibleContribution: 0,
      },
      assumptions: {
        inflationRatePct: number(plan.investing?.inflationPct, 2.5),
        principalResidenceCapitalGrowthRatePct: propertyGrowthAssumptions.principalResidenceCapitalGrowthRatePct,
        investmentPropertyCapitalGrowthRatePct: propertyGrowthAssumptions.investmentPropertyCapitalGrowthRatePct,
      },
      scenario: {
        optionalAdditionalLifestyleWithdrawal: 0,
        semiRetirementAccessibleWithdrawal: 0,
        surplusDestination: "enjoyment",
        minimumAccessibleBalance: 0,
        minimumEstateBalanceAtEndAge: 0,
        withdrawalOrder: "accessible-first",
      },
      assets,
      liabilities,
      propertyIncome,
      passiveIncome,
      people,
    };
    return {
      sourceKey: basePlanSourceKey(plan, result),
      draft,
    };
  }

  function getDraftPath(draft, path) {
    return String(path || "").split(".").reduce((cursor, key) => {
      if (cursor === undefined || cursor === null) return undefined;
      if (/^\d+$/.test(key) && Array.isArray(cursor)) return cursor[Number(key)];
      return cursor[key];
    }, draft);
  }

  function setDraftPath(draft, path, value) {
    const keys = String(path || "").split(".");
    const last = keys.pop();
    const target = keys.reduce((cursor, key, index) => {
      const nextKey = keys[index + 1] || last;
      const isArrayIndex = /^\d+$/.test(nextKey);
      const realKey = /^\d+$/.test(key) && Array.isArray(cursor) ? Number(key) : key;
      if (cursor[realKey] === undefined || cursor[realKey] === null) cursor[realKey] = isArrayIndex ? [] : {};
      return cursor[realKey];
    }, draft);
    const realLast = /^\d+$/.test(last) && Array.isArray(target) ? Number(last) : last;
    target[realLast] = value;
    return draft;
  }

  function validateSemiRetirementScenarioDraft(draft = {}) {
    const errors = [];
    const add = (path, message) => errors.push({ path, message });
    if (!Array.isArray(draft.people) || !draft.people.length) add("people", "At least one person is required.");
    (draft.people || []).forEach((person, index) => {
      const prefix = `people.${index}`;
      const currentAge = number(person.currentAge);
      const fullRetirementAge = number(person.fullRetirementAge);
      const semiRetirementAge = person.hasSemiRetirement ? number(person.semiRetirementAge) : fullRetirementAge;
      if (currentAge < 0) add(`${prefix}.currentAge`, "Current age cannot be negative.");
      if (person.hasSemiRetirement && semiRetirementAge < currentAge) add(`${prefix}.semiRetirementAge`, "Semi-retirement age cannot be earlier than your current age.");
      if (fullRetirementAge < currentAge) add(`${prefix}.fullRetirementAge`, "Full-retirement age cannot be earlier than your current age.");
      if (person.hasSemiRetirement && fullRetirementAge < semiRetirementAge) add(`${prefix}.fullRetirementAge`, "Full-retirement age cannot be earlier than semi-retirement age.");
      if (number(person.superAccessAge) < currentAge) add(`${prefix}.superAccessAge`, "Assumed super access age cannot be earlier than your current age.");
      [
        ["currentGrossEmploymentIncome", "Annual income cannot be negative."],
        ["semiRetirementGrossIncome", "Annual income cannot be negative."],
        ["openingSuperBalance", "Super balance cannot be negative."],
        ["existingAdditionalConcessionalContributions", "Additional super contributions cannot be negative."],
        ["stslOpeningBalance", "STSL balance cannot be negative."],
      ].forEach(([field, message]) => {
        if (number(person[field]) < 0) add(`${prefix}.${field}`, message);
      });
    });
    [
      ["household.currentLifestyleSpending", draft.household?.currentLifestyleSpending, "Lifestyle spending cannot be negative."],
      ["household.semiRetirementLifestyleSpending", draft.household?.semiRetirementLifestyleSpending, "Lifestyle spending cannot be negative."],
      ["household.fullRetirementLifestyleSpending", draft.household?.fullRetirementLifestyleSpending, "Lifestyle spending cannot be negative."],
      ["accessibleInvestments.openingBalance", draft.accessibleInvestments?.openingBalance, "Accessible investment balance cannot be negative."],
      ["accessibleInvestments.openingOffsetBalance", draft.accessibleInvestments?.openingOffsetBalance, "Opening offset balance cannot be negative."],
      ["accessibleInvestments.externalAnnualAccessibleContribution", draft.accessibleInvestments?.externalAnnualAccessibleContribution, "Additional planned investment contribution cannot be negative."],
      ["scenario.optionalAdditionalLifestyleWithdrawal", draft.scenario?.optionalAdditionalLifestyleWithdrawal, "Optional additional lifestyle draw cannot be negative."],
      ["scenario.semiRetirementAccessibleWithdrawal", draft.scenario?.semiRetirementAccessibleWithdrawal, "Planned withdrawal cannot be negative."],
    ].forEach(([path, value, message]) => {
      if (number(value) < 0) add(path, message);
    });
    [
      ["accessibleInvestments.annualReturnRatePct", draft.accessibleInvestments?.annualReturnRatePct],
      ["accessibleInvestments.annualFeesRatePct", draft.accessibleInvestments?.annualFeesRatePct],
      ["assumptions.inflationRatePct", draft.assumptions?.inflationRatePct],
      ["assumptions.principalResidenceCapitalGrowthRatePct", draft.assumptions?.principalResidenceCapitalGrowthRatePct],
      ["assumptions.investmentPropertyCapitalGrowthRatePct", draft.assumptions?.investmentPropertyCapitalGrowthRatePct],
      ...(draft.people || []).flatMap((person, index) => [
        [`people.${index}.annualIncomeGrowthRatePct`, person.annualIncomeGrowthRatePct],
        [`people.${index}.superReturnBeforeRetirementPct`, person.superReturnBeforeRetirementPct],
        [`people.${index}.superReturnAfterRetirementPct`, person.superReturnAfterRetirementPct],
        [`people.${index}.superAnnualFeesRatePct`, person.superAnnualFeesRatePct],
        [`people.${index}.employerSuperRatePct`, person.employerSuperRatePct],
      ]),
    ].forEach(([path, value]) => {
      if (number(value) < -100) add(path, "Investment return must be greater than -100%.");
    });
    const youngestCurrentAge = (draft.people || []).reduce((youngest, person) => Math.min(youngest, number(person.currentAge)), Infinity);
    const projectionEndAge = number(draft.projectionEndAge);
    if (!Number.isFinite(youngestCurrentAge) || projectionEndAge < 80 || projectionEndAge > 110) add("projectionEndAge", "Projection end age must be between 80 and 110.");
    const yearsUntilProjectionEnd = projectionEndAge - youngestCurrentAge;
    (draft.people || []).forEach((person) => {
      const yearsUntilFullRetirement = number(person.fullRetirementAge) - number(person.currentAge);
      if (yearsUntilFullRetirement > yearsUntilProjectionEnd) {
        add("projectionEndAge", `${person.name || "This person's"} full-retirement age occurs after the selected projection end.`);
      }
    });
    return errors;
  }

  function scenarioDraftToProjectionInputs(draft = {}) {
    const inputs = {
      projectionStartYear: Math.round(number(draft.projectionStartYear, currentYear())),
      projectionEndAge: number(draft.projectionEndAge, 90),
      inflationRate: percentToRate(draft.assumptions?.inflationRatePct),
      household: {
        currentLifestyleSpending: nonNegative(draft.household?.currentLifestyleSpending),
        semiRetirementLifestyleSpending: nonNegative(draft.household?.semiRetirementLifestyleSpending),
        fullRetirementLifestyleSpending: nonNegative(draft.household?.fullRetirementLifestyleSpending),
        otherAnnualIncome: nonNegative(draft.household?.otherAnnualIncome),
        annualLoanPrincipalRepayments: nonNegative(draft.household?.annualLoanPrincipalRepayments),
      },
      accessibleInvestments: {
        openingBalance: nonNegative(draft.accessibleInvestments?.openingBalance),
        openingOffsetBalance: nonNegative(draft.accessibleInvestments?.openingOffsetBalance),
        annualReturnRate: percentToRate(draft.accessibleInvestments?.annualReturnRatePct),
        annualFeesRate: percentToRate(draft.accessibleInvestments?.annualFeesRatePct),
        externalAnnualAccessibleContribution: nonNegative(draft.accessibleInvestments?.externalAnnualAccessibleContribution),
        currentAnnualContributions: nonNegative(draft.accessibleInvestments?.externalAnnualAccessibleContribution),
      },
      assumptions: {
        principalResidenceCapitalGrowthRate: percentToRate(draft.assumptions?.principalResidenceCapitalGrowthRatePct),
        principalResidenceCapitalGrowthRatePct: number(draft.assumptions?.principalResidenceCapitalGrowthRatePct),
        investmentPropertyCapitalGrowthRate: percentToRate(draft.assumptions?.investmentPropertyCapitalGrowthRatePct),
        investmentPropertyCapitalGrowthRatePct: number(draft.assumptions?.investmentPropertyCapitalGrowthRatePct),
      },
      assets: Array.isArray(draft.assets) ? clone(draft.assets).map((asset) => {
        const resolvedGrowth = PROPERTY_TYPES.has(asset.type || asset.category)
          ? resolveScenarioPropertyGrowthRatePct(draft, asset)
          : { ratePct: 0, source: "zero-fallback", group: "non-property" };
        return {
          ...asset,
          annualGrowthRatePct: resolvedGrowth.ratePct,
          annualGrowthRate: percentToRate(resolvedGrowth.ratePct),
          growthRateSource: resolvedGrowth.source,
          propertyTypeGroup: resolvedGrowth.group,
        };
      }) : [],
      liabilities: Array.isArray(draft.liabilities) ? clone(draft.liabilities).map((liability) => ({
        ...liability,
        annualInterestRate: finiteNumberOrNull(liability.annualInterestRate) !== null
          ? number(liability.annualInterestRate)
          : percentToRate(liability.interestRatePct),
        repaymentAmount: nonNegative(liability.repaymentAmount),
        openingBalance: nonNegative(liability.openingBalance),
      })) : [],
      propertyIncome: Array.isArray(draft.propertyIncome) ? clone(draft.propertyIncome).map((income) => ({
        ...income,
        annualIncome: finiteNumberOrNull(income.annualIncome) === null ? null : number(income.annualIncome),
        hasRentalCashIncome: income.hasRentalCashIncome === true && finiteNumberOrNull(income.annualIncome) !== null,
        missingRentalCashIncome: income.missingRentalCashIncome === true || finiteNumberOrNull(income.annualIncome) === null,
        taxableRentalIncomeAnnual: number(income.taxableRentalIncomeAnnual),
        annualGrowthRate: finiteNumberOrNull(income.annualGrowthRate) !== null
          ? number(income.annualGrowthRate)
          : percentToRate(income.annualGrowthRatePct),
      })) : [],
      passiveIncome: Array.isArray(draft.passiveIncome) ? clone(draft.passiveIncome).map((income) => ({
        ...income,
        annualCashIncome: nonNegative(income.annualCashIncome),
        annualTaxableIncome: nonNegative(income.annualTaxableIncome),
        annualCashGrowthRate: finiteNumberOrNull(income.annualCashGrowthRate) !== null ? number(income.annualCashGrowthRate) : percentToRate(income.annualCashGrowthRatePct),
        annualTaxableGrowthRate: finiteNumberOrNull(income.annualTaxableGrowthRate) !== null ? number(income.annualTaxableGrowthRate) : percentToRate(income.annualTaxableGrowthRatePct),
      })) : [],
      people: (draft.people || []).map((person, index) => {
        const fullRetirementAge = number(person.fullRetirementAge);
        const hasSemiRetirement = Boolean(person.hasSemiRetirement);
        return {
          id: String(person.id || personId(index + 1)),
          name: String(person.name || `Person ${index + 1}`),
          currentAge: number(person.currentAge),
          currentGrossEmploymentIncome: nonNegative(person.currentGrossEmploymentIncome),
          annualIncomeGrowthRate: percentToRate(person.annualIncomeGrowthRatePct),
          semiRetirementAge: hasSemiRetirement ? number(person.semiRetirementAge) : fullRetirementAge,
          semiRetirementGrossIncome: hasSemiRetirement ? nonNegative(person.semiRetirementGrossIncome) : 0,
          fullRetirementAge,
          superAccessAge: number(person.superAccessAge, 60),
          openingSuperBalance: nonNegative(person.openingSuperBalance),
          superReturnBeforeRetirement: percentToRate(person.superReturnBeforeRetirementPct),
          superReturnAfterRetirement: percentToRate(person.superReturnAfterRetirementPct),
          superAnnualFeesRate: percentToRate(person.superAnnualFeesRatePct),
          employerSuperRate: percentToRate(person.employerSuperRatePct),
          existingAdditionalConcessionalContributions: nonNegative(person.existingAdditionalConcessionalContributions),
          additionalContributionsStopAge: number(person.additionalContributionsStopAge, fullRetirementAge),
          stslOpeningBalance: nonNegative(person.stslOpeningBalance),
          hasPrivateHealthCover: person.hasPrivateHealthCover !== false,
        };
      }),
      scenario: {
        optionalAdditionalLifestyleWithdrawal: nonNegative(draft.scenario?.semiRetirementAccessibleWithdrawal ?? draft.scenario?.optionalAdditionalLifestyleWithdrawal),
        semiRetirementAccessibleWithdrawal: nonNegative(draft.scenario?.semiRetirementAccessibleWithdrawal ?? draft.scenario?.optionalAdditionalLifestyleWithdrawal),
        surplusDestination: draft.scenario?.surplusDestination || "enjoyment",
        fullRetirementAnnualSpending: nonNegative(draft.household?.fullRetirementLifestyleSpending),
        minimumAccessibleBalance: nonNegative(draft.scenario?.minimumAccessibleBalance),
        minimumEstateBalanceAtEndAge: nonNegative(draft.scenario?.minimumEstateBalanceAtEndAge),
        withdrawalOrder: "accessible-first",
      },
    };
    return inputs;
  }

  function runSemiRetirementProjection(engine, draft) {
    const uiErrors = validateSemiRetirementScenarioDraft(draft);
    if (uiErrors.length) {
      return {
        inputs: scenarioDraftToProjectionInputs(draft),
        result: null,
        validation: { isValid: false, errors: uiErrors },
      };
    }
    if (!engine || typeof engine.projectRetirementScenario !== "function") {
      return {
        inputs: scenarioDraftToProjectionInputs(draft),
        result: null,
        validation: { isValid: false, errors: [{ path: "engine", message: "Semi-retirement projection engine is not available." }] },
      };
    }
    const inputs = scenarioDraftToProjectionInputs(draft);
    const result = engine.projectRetirementScenario(inputs);
    return {
      inputs,
      result,
      validation: result.validation || { isValid: true, errors: [] },
    };
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function personListFromProjection(projection = {}, draft = {}, inputs = {}) {
    const projectedPeople = asArray(projection.years?.[0]?.people);
    const draftPeople = asArray(draft.people);
    const inputPeople = asArray(inputs.people);
    const people = projectedPeople.length ? projectedPeople : draftPeople;
    return people.map((person, index) => ({
      id: person.id || personId(index + 1),
      name: person.name || `Person ${index + 1}`,
      currentAge: number(person.currentAge ?? person.age),
    })).map((person, index) => {
      const inputPerson = inputPeople.find((candidate) => candidate.id === person.id);
      const draftPerson = draftPeople.find((candidate) => candidate.id === person.id) || draftPeople[index];
      return {
        ...person,
        superAccessAge: finiteNumberOrNull(inputPerson?.superAccessAge ?? draftPerson?.superAccessAge),
      };
    });
  }

  function milestoneHasYear(milestone) {
    return Boolean(milestone && milestone.calendarYear !== null && milestone.calendarYear !== undefined);
  }

  function milestoneAges(milestone = {}, people = []) {
    return people.map((person, index) => ({
      id: person.id,
      name: person.name,
      age: milestone[`${person.id}Age`] ?? milestone[`person${index + 1}Age`] ?? null,
    }));
  }

  function rowAges(row = {}, people = []) {
    return people.map((person, index) => {
      const projected = asArray(row.people).find((entry) => entry.id === person.id);
      return {
        id: person.id,
        name: person.name,
        age: projected?.age ?? row[`${person.id}Age`] ?? row[`person${index + 1}Age`] ?? null,
      };
    });
  }

  function rowForCalendarYear(years = [], calendarYear) {
    if (!calendarYear) return null;
    return years.find((row) => row.calendarYear === calendarYear) || null;
  }

  function phaseLabel(phase = "") {
    const labels = {
      working: "Working",
      "semi-retirement": "Semi-retirement",
      "full-retirement": "Full retirement",
      "full-time": "Full-time work",
      "semi-retired": "Semi-retired",
      "fully-retired": "Fully retired",
    };
    return labels[phase] || String(phase || "Not available");
  }

  function surplusDestinationLabel(value = "") {
    const labels = {
      enjoyment: "Extra lifestyle / enjoyment",
      super: "Contribute to super",
      "accessible-investments": "Contribute to accessible investments",
      unallocated: "Leave as unallocated surplus",
    };
    return labels[value] || labels.enjoyment;
  }

  function roundDisplayAmount(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function warningText(warning) {
    if (warning && typeof warning === "object") {
      return warning.message || warning.code || "Projection warning.";
    }
    const text = String(warning || "");
    if (!text) return "";
    return text
      .replace(/superByPersonAtAge60/g, "age-60 super balance")
      .replace(/External annual accessible contribution/g, "Additional planned investment contribution")
      .replace(/Input mutation was detected\. This should not occur\./g, "The projection input changed unexpectedly while calculating. Review the scenario and calculate again.");
  }

  function debtTypeLabel(type = "") {
    const labels = {
      homeLoan: "Home loan",
      mortgage: "Home loan",
      rentalPropertyLoan: "Investment property loan",
      investmentLoan: "Investment loan",
      shareInvestmentLoan: "Share investment loan",
      managedFundLoan: "Managed fund loan",
      personalLoan: "Personal loan",
      vehicleLoan: "Vehicle loan",
      creditCard: "Credit card",
      lineOfCredit: "Line of credit",
      overdraft: "Overdraft",
      revolvingCredit: "Revolving credit",
      revolvingFacility: "Revolving facility",
      otherDebt: "Other debt",
    };
    return labels[type] || String(type || "Debt");
  }

  function rentalTreatmentLabel(treatment = "") {
    return treatment === "beforeInterest"
      ? "Loan interest is deducted separately in this projection."
      : "Rental cash income entered after loan interest.";
  }

  function resolveLinkedPropertyName(linkedAssetId, propertyRows = [], assetRows = []) {
    if (!linkedAssetId) return "";
    const property = propertyRows.find((item) => item.id === linkedAssetId)
      || assetRows.find((item) => item.id === linkedAssetId);
    return property?.name || "Linked property unavailable";
  }

  function liabilityInRow(row = {}, liabilityId = "") {
    return asArray(row.liabilities).find((liability) => liability.id === liabilityId) || null;
  }

  function propertyInRow(row = {}, propertyId = "") {
    return asArray(row.properties).find((property) => property.id === propertyId) || null;
  }

  function hasMeaningfulDebt(row = {}) {
    return asArray(row.liabilities).some((liability) => (
      number(liability.openingBalance) > 0
      || number(liability.closingBalance) > 0
      || number(liability.totalRepayment ?? liability.scheduledRepayment) > 0
    ));
  }

  function buildDebtWarnings(years = []) {
    const negativeByDebt = new Map();
    const balloonWarnings = [];
    years.forEach((row) => {
      asArray(row.liabilities).forEach((liability) => {
        asArray(liability.warnings).forEach((warning) => {
          if (!warning || typeof warning !== "object") return;
          if (warning.code === "DEBT_NEGATIVE_AMORTISATION") {
            const existing = negativeByDebt.get(liability.id) || {
              liabilityId: liability.id,
              name: liability.name || debtTypeLabel(liability.type),
              years: [],
              firstYear: row.calendarYear,
            };
            existing.years.push(row.calendarYear);
            existing.firstYear = Math.min(existing.firstYear, row.calendarYear);
            existing.capitalisedInterest = roundDisplayAmount(number(existing.capitalisedInterest) + number(warning.capitalisedInterest));
            negativeByDebt.set(liability.id, existing);
          }
          if (warning.code === "DEBT_TERM_BALLOON_REPAYMENT") {
            balloonWarnings.push({
              liabilityId: liability.id,
              name: liability.name || debtTypeLabel(liability.type),
              calendarYear: row.calendarYear,
              amount: roundDisplayAmount(warning.balloonRepayment ?? liability.balloonRepayment),
            });
          }
        });
      });
    });
    return {
      negativeAmortisation: Array.from(negativeByDebt.values()).map((item) => ({
        ...item,
        yearCount: item.years.length,
      })),
      balloonRepayments: balloonWarnings,
    };
  }

  function buildDebtCard({ liabilityId, years, people, payoffMilestones, propertyRows, assetRows, householdFullRetirementRow }) {
    const firstRowWithDebt = years.find((row) => liabilityInRow(row, liabilityId));
    const startDebt = liabilityInRow(firstRowWithDebt, liabilityId);
    if (!startDebt) return null;
    const retirementDebt = liabilityInRow(householdFullRetirementRow, liabilityId)
      || liabilityInRow(years.at(-1), liabilityId)
      || startDebt;
    const payoff = payoffMilestones.find((milestone) => milestone.liabilityId === liabilityId) || null;
    const payoffRow = payoff ? rowForCalendarYear(years, payoff.calendarYear) : null;
    const payoffDebt = payoffRow ? liabilityInRow(payoffRow, liabilityId) : null;
    const nextRow = payoffRow ? years[years.findIndex((row) => row.calendarYear === payoffRow.calendarYear) + 1] : null;
    const repaymentBefore = payoffRow?.household?.totalDebtRepayments ?? payoffDebt?.totalRepayment ?? null;
    const repaymentAfter = nextRow?.household?.totalDebtRepayments ?? null;
    const repaymentReduction = repaymentBefore !== null && repaymentAfter !== null
      ? roundDisplayAmount(number(repaymentBefore) - number(repaymentAfter))
      : null;
    const linkedPropertyName = resolveLinkedPropertyName(startDebt.linkedAssetId, propertyRows, assetRows);
    return {
      id: liabilityId,
      name: startDebt.name || debtTypeLabel(startDebt.type),
      type: startDebt.type,
      typeLabel: debtTypeLabel(startDebt.type),
      linkedPropertyName,
      currentBalance: startDebt.openingBalance,
      projectedBalanceAtRetirement: retirementDebt.closingBalance,
      projectedBalanceAtRetirementYear: householdFullRetirementRow?.calendarYear ?? years.at(-1)?.calendarYear ?? null,
      annualRepayment: startDebt.totalRepayment ?? startDebt.scheduledRepayment,
      payoff,
      payoffAges: payoff ? milestoneAges(payoff, people) : [],
      payoffIsBalloon: number(payoffDebt?.balloonRepayment) > 0,
      balloonRepayment: payoffDebt?.balloonRepayment ?? 0,
      repaymentBefore,
      repaymentAfter,
      repaymentReduction,
      hasNegativeAmortisation: years.some((row) => {
        const debt = liabilityInRow(row, liabilityId);
        return number(debt?.capitalisedInterest) > 0;
      }),
      isRevolving: startDebt.debtScheduleType === "revolving",
    };
  }

  function buildPropertyCard(propertyId, selectedRow = {}, years = []) {
    const property = propertyInRow(selectedRow, propertyId)
      || years.map((row) => propertyInRow(row, propertyId)).find(Boolean);
    if (!property) return null;
    return {
      id: propertyId,
      name: property.name || "Rental / Investment Property",
      selectedYear: selectedRow?.calendarYear ?? null,
      selectedLabel: selectedRow?.householdPhase === "full-retirement"
        ? "At household full retirement"
        : selectedRow?.calendarYear ? `At ${selectedRow.calendarYear}` : "Selected projection year",
      openingValue: property.openingValue,
      propertyGrowth: property.propertyGrowth,
      annualGrowthRate: property.annualGrowthRate,
      annualGrowthRatePct: property.annualGrowthRatePct,
      growthRateSource: property.growthRateSource,
      growthRateSourceLabel: PROPERTY_GROWTH_SOURCE_LABELS[property.growthRateSource] || "capital-growth assumption",
      projectedPropertyValue: property.closingValue,
      linkedPropertyDebt: property.linkedLoanClosingBalance,
      projectedPropertyEquity: property.propertyEquity,
      baseRentalCashIncome: property.baseRentalCashIncome,
      rentalCashIncome: property.rentalCashIncome ?? property.grossRentalIncome,
      rentalCashIncomeGrowthRate: property.rentalCashIncomeGrowthRate,
      rentalCashIncomeGrowthSource: property.rentalCashIncomeGrowthSource,
      taxableRentalIncome: property.taxableRentalIncome,
      baseTaxableRentalIncome: property.baseTaxableRentalIncome,
      loanInterest: property.loanInterest,
      loanPrincipal: property.loanPrincipal,
      netPropertyCashflow: property.netPropertyCashflow,
      hasMissingRentalCashIncome: property.hasMissingRentalCashIncome === true,
      warnings: asArray(property.warnings).map(warningText).filter(Boolean),
      cashflowTone: property.hasMissingRentalCashIncome === true || number(property.netPropertyCashflow) < 0 ? "warning" : "positive",
      isRentalInvestmentProperty: property.isRentalInvestmentProperty === true,
    };
  }

  function buildDebtPropertyResultsViewModel(projection = {}, people = []) {
    const years = asArray(projection.years);
    const summary = projection.summary || {};
    const startRow = years[0] || null;
    const finalRow = years.at(-1) || null;
    const firstPersonFullRetirementRow = rowForCalendarYear(years, summary.firstPersonFullRetirement?.calendarYear) || null;
    const householdFullRetirementRow = rowForCalendarYear(years, summary.householdFullRetirement?.calendarYear)
      || years.find((row) => row.householdPhase === "full-retirement")
      || finalRow
      || null;
    const propertyDisplayRow = householdFullRetirementRow || finalRow || startRow;
    const hasDebt = years.some(hasMeaningfulDebt);
    const assetRows = asArray(startRow?.assets);
    const propertyRows = asArray(propertyDisplayRow?.properties).length
      ? asArray(propertyDisplayRow.properties)
      : asArray(startRow?.properties);
    const liabilityIds = Array.from(new Set(years.flatMap((row) => asArray(row.liabilities).map((liability) => liability.id)).filter(Boolean)));
    const payoffMilestones = asArray(summary.debtPayoffMilestones);
    const debtCards = liabilityIds
      .map((liabilityId) => buildDebtCard({
        liabilityId,
        years,
        people,
        payoffMilestones,
        propertyRows,
        assetRows,
        householdFullRetirementRow,
      }))
      .filter(Boolean);
    const propertyIds = Array.from(new Set(years
      .flatMap((row) => asArray(row.properties))
      .filter((property) => property.isRentalInvestmentProperty)
      .map((property) => property.id)
      .filter(Boolean)));
    const propertyCards = propertyIds.map((propertyId) => buildPropertyCard(propertyId, propertyDisplayRow, years)).filter(Boolean);
    const debtWarnings = buildDebtWarnings(years);
    const accessibleExhaustion = milestoneHasYear(summary.accessibleFundsExhausted)
      ? rowForCalendarYear(years, summary.accessibleFundsExhausted.calendarYear)
      : null;
    const propertyEquityAtAccessibleExhaustion = accessibleExhaustion
      ? roundDisplayAmount(asArray(accessibleExhaustion.properties).reduce((total, property) => total + number(property.propertyEquity), 0))
      : 0;
    const netWorthRow = householdFullRetirementRow || finalRow || startRow || {};
    return {
      isAvailable: Boolean(years.length),
      hasDebt,
      hasProperty: propertyCards.length > 0,
      milestoneDebt: [
        { label: "Total debt now", row: startRow, value: startRow?.household?.totalDebt },
        { label: "Debt when first person fully retires", row: firstPersonFullRetirementRow, value: firstPersonFullRetirementRow?.household?.totalDebt },
        { label: "Debt when both are fully retired", row: householdFullRetirementRow, value: householdFullRetirementRow?.household?.totalDebt },
        { label: "Debt at projection end", row: finalRow, value: finalRow?.household?.totalDebt },
      ].filter((item) => item.row),
      debtCards,
      propertyCards,
      netWorthDistinction: {
        label: netWorthRow?.householdPhase === "full-retirement" ? "When both are fully retired" : `At ${netWorthRow?.calendarYear || "projection end"}`,
        calendarYear: netWorthRow?.calendarYear ?? null,
        ages: rowAges(netWorthRow, people),
        investableRetirementAssets: netWorthRow?.household?.totalInvestableAssets,
        projectedNetWorth: netWorthRow?.household?.totalNetWorth,
        totalPropertyEquity: netWorthRow?.household?.totalPropertyEquity,
        totalDebt: netWorthRow?.household?.totalDebt,
      },
      accessibleExhaustionPropertyEquity: accessibleExhaustion ? {
        calendarYear: accessibleExhaustion.calendarYear,
        ages: rowAges(accessibleExhaustion, people),
        propertyEquity: propertyEquityAtAccessibleExhaustion,
      } : null,
      warnings: debtWarnings,
      offsetDisclosure: years.flatMap((row) => asArray(row.liabilities))
        .filter((debt) => number(debt.offsetBalanceUsed) > 0)
        .map((debt) => ({
          liabilityId: debt.id,
          name: debt.name || debtTypeLabel(debt.type),
          offsetBalanceUsed: debt.offsetBalanceUsed,
        }))
        .filter((item, index, array) => array.findIndex((candidate) => candidate.liabilityId === item.liabilityId) === index),
    };
  }

  function passiveIncomeTypeLabel(type = "") {
    const labels = {
      interest: "Interest",
      dividends: "Dividends",
      distributions: "Distributions",
      rentalTaxableIncome: "Rental taxable income",
      otherPassive: "Other passive income",
      otherTaxableIncome: "Other taxable income",
    };
    return labels[type] || String(type || "Passive income");
  }

  function buildPassiveIncomeResultsViewModel(projection = {}, people = []) {
    const years = asArray(projection.years);
    if (!years.length) return { isAvailable: false };
    const summary = projection.summary || {};
    const displayRow = rowForCalendarYear(years, summary.householdFullRetirement?.calendarYear)
      || years.find((row) => row.householdPhase === "semi-retirement")
      || years[0];
    const passiveRows = asArray(displayRow?.passiveIncome);
    const sourceRows = ["interest", "dividends", "rentalTaxableIncome", "distributions", "otherPassive", "otherTaxableIncome"]
      .map((type) => ({
        type,
        label: passiveIncomeTypeLabel(type),
        taxableIncome: roundDisplayAmount(passiveRows.filter((row) => row.type === type).reduce((total, row) => total + number(row.taxableIncome), 0)),
        cashIncome: roundDisplayAmount(passiveRows.filter((row) => row.type === type).reduce((total, row) => total + number(row.cashIncome), 0)),
      }))
      .filter((row) => row.taxableIncome > 0 || row.cashIncome > 0);
    const personRows = people.map((person) => {
      const personYear = asArray(displayRow.people).find((entry) => entry.id === person.id) || {};
      return {
        id: person.id,
        name: person.name,
        employmentIncome: number(personYear.employmentIncome ?? personYear.grossEmploymentIncome),
        interestIncome: number(personYear.interestIncome),
        dividendIncome: number(personYear.dividendIncome),
        rentalTaxableIncome: number(personYear.rentalTaxableIncome),
        distributionIncome: number(personYear.distributionIncome),
        otherTaxableIncome: number(personYear.otherTaxableIncome),
        totalPassiveTaxableIncome: number(personYear.totalPassiveTaxableIncome),
        totalTaxableIncome: number(personYear.totalTaxableIncome),
        incomeTax: number(personYear.incomeTax),
        medicareLevy: number(personYear.medicareLevy),
        medicareLevySurcharge: number(personYear.medicareLevySurcharge),
        stslRepayment: number(personYear.stslRepayment),
        netIncome: number(personYear.netIncome ?? personYear.netEmploymentIncome),
      };
    });
    return {
      isAvailable: sourceRows.length > 0 || personRows.some((person) => person.totalPassiveTaxableIncome > 0),
      calendarYear: displayRow.calendarYear,
      householdPhaseLabel: phaseLabel(displayRow.householdPhase),
      ages: rowAges(displayRow, people),
      sourceRows,
      personRows,
      totalPassiveTaxableIncome: roundDisplayAmount(displayRow.household?.totalPassiveTaxableIncome),
      totalPassiveCashIncome: roundDisplayAmount(displayRow.household?.totalPassiveCashIncome),
    };
  }

  function addTimelineEvent(groups, event) {
    if (!event?.calendarYear) return;
    const key = `${event.calendarYear}:${event.title}`;
    if (groups.seen.has(key)) return;
    groups.seen.add(key);
    const group = groups.byYear.get(event.calendarYear) || {
      calendarYear: event.calendarYear,
      ages: event.ages || [],
      events: [],
    };
    if ((!group.ages || !group.ages.length) && event.ages) group.ages = event.ages;
    group.events.push({
      title: event.title,
      detail: event.detail || "",
      tone: event.tone || "neutral",
    });
    groups.byYear.set(event.calendarYear, group);
  }

  function buildRetirementTimeline(projection = {}, people = []) {
    const years = asArray(projection.years);
    const summary = projection.summary || {};
    const groups = { byYear: new Map(), seen: new Set() };
    const lastPhaseByPerson = {};
    const superAccessSeen = new Set();

    years.forEach((row) => {
      asArray(row.people).forEach((person) => {
        const previousPhase = lastPhaseByPerson[person.id];
        if (person.employmentPhase === "semi-retired" && previousPhase !== "semi-retired" && previousPhase !== "fully-retired") {
          addTimelineEvent(groups, {
            calendarYear: row.calendarYear,
            ages: rowAges(row, people),
            title: `${person.name || person.id} semi-retires`,
            detail: "Reduced work begins in the projection.",
          });
        }
        if (person.employmentPhase === "fully-retired" && previousPhase !== "fully-retired") {
          addTimelineEvent(groups, {
            calendarYear: row.calendarYear,
            ages: rowAges(row, people),
            title: `${person.name || person.id} fully retires`,
            detail: "Employment income for this person is no longer modelled.",
          });
        }
        const displayPerson = people.find((candidate) => candidate.id === person.id);
        const superAccessAge = finiteNumberOrNull(displayPerson?.superAccessAge);
        if (!superAccessSeen.has(person.id) && superAccessAge !== null && person.age >= superAccessAge) {
          superAccessSeen.add(person.id);
          const alreadyReachedAtStart = row.yearIndex === 0 && person.age >= superAccessAge;
          addTimelineEvent(groups, {
            calendarYear: row.calendarYear,
            ages: rowAges(row, people),
            title: alreadyReachedAtStart
              ? `${person.name || person.id} is already at or above the assumed super access age`
              : `${person.name || person.id} reaches the scenario super-access age`,
            detail: "Super access is based on the scenario assumption entered.",
          });
        }
        lastPhaseByPerson[person.id] = person.employmentPhase;
      });
    });

    if (milestoneHasYear(summary.firstPersonFullRetirement)) {
      const retiredNames = asArray(summary.firstPersonFullRetirement.retiredPersonIds)
        .map((id) => people.find((person) => person.id === id)?.name || id)
        .join(", ");
      addTimelineEvent(groups, {
        calendarYear: summary.firstPersonFullRetirement.calendarYear,
        ages: milestoneAges(summary.firstPersonFullRetirement, people),
        title: "First person fully retires",
        detail: retiredNames ? `Retired: ${retiredNames}` : "",
      });
    }
    if (milestoneHasYear(summary.householdFullRetirement)) {
      addTimelineEvent(groups, {
        calendarYear: summary.householdFullRetirement.calendarYear,
        ages: milestoneAges(summary.householdFullRetirement, people),
        title: "Household fully retired",
        detail: "All people in the scenario are fully retired.",
      });
    }
    if (milestoneHasYear(summary.accessibleFundsExhausted)) {
      addTimelineEvent(groups, {
        calendarYear: summary.accessibleFundsExhausted.calendarYear,
        ages: milestoneAges(summary.accessibleFundsExhausted, people),
        title: "Accessible investments reach $0",
        tone: "warning",
      });
    }
    if (milestoneHasYear(summary.firstUnfundedSpending)) {
      addTimelineEvent(groups, {
        calendarYear: summary.firstUnfundedSpending.calendarYear,
        ages: milestoneAges(summary.firstUnfundedSpending, people),
        title: "First projected funding shortfall",
        tone: "warning",
      });
    }
    if (milestoneHasYear(summary.allRetirementFundsExhausted)) {
      addTimelineEvent(groups, {
        calendarYear: summary.allRetirementFundsExhausted.calendarYear,
        ages: milestoneAges(summary.allRetirementFundsExhausted, people),
        title: "Total investable retirement assets reach $0",
        tone: "warning",
      });
    }
    asArray(summary.debtPayoffMilestones).forEach((milestone) => {
      const row = rowForCalendarYear(years, milestone.calendarYear);
      const debt = liabilityInRow(row, milestone.liabilityId);
      const isBalloon = number(debt?.balloonRepayment) > 0;
      addTimelineEvent(groups, {
        calendarYear: milestone.calendarYear,
        ages: milestoneAges(milestone, people),
        title: isBalloon
          ? `${milestone.name || debt?.name || "Debt"} final repayment`
          : `${milestone.name || debt?.name || "Debt"} repaid`,
        detail: isBalloon
          ? `Final repayment projected at ${roundDisplayAmount(debt.balloonRepayment).toLocaleString(undefined, { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}.`
          : "Debt payoff based on the annual debt schedule.",
        tone: isBalloon ? "warning" : "positive",
      });
    });

    return Array.from(groups.byYear.values()).sort((a, b) => a.calendarYear - b.calendarYear);
  }

  function buildAnnualProjectionRows(projection = {}, people = []) {
    return asArray(projection.years).map((row) => ({
      calendarYear: row.calendarYear,
      yearIndex: row.yearIndex,
      householdPhase: row.householdPhase,
      householdPhaseLabel: phaseLabel(row.householdPhase),
      ages: rowAges(row, people),
      people: asArray(row.people).map((person) => ({
        ...person,
        employmentPhaseLabel: phaseLabel(person.employmentPhase),
      })),
      household: row.household || {},
      assets: asArray(row.assets),
      liabilities: asArray(row.liabilities),
      propertyIncome: asArray(row.propertyIncome),
      passiveIncome: asArray(row.passiveIncome),
      properties: asArray(row.properties),
      warnings: asArray(row.warnings).map(warningText).filter(Boolean),
    }));
  }

  function buildAssumptionRows(projection = {}, inputs = {}) {
    const assumptions = projection.assumptions || {};
    const people = asArray(inputs.people);
    const debtRows = asArray(inputs.liabilities).flatMap((liability) => {
      const name = liability.name || debtTypeLabel(liability.type);
      return [
        { label: `${name} interest rate`, value: liability.annualInterestRate, type: "percentRate" },
        { label: `${name} repayment`, value: `${number(liability.repaymentAmount).toLocaleString(undefined, { style: "currency", currency: "AUD", maximumFractionDigits: 0 })} ${liability.repaymentFrequency || "annually"}`, type: "plain" },
        { label: `${name} remaining term`, value: liability.remainingTermYears ? `${liability.remainingTermYears} years` : "Open-ended or not entered", type: "plain" },
        ...(number(liability.openingOffsetBalance) > 0 ? [{ label: `${name} opening offset`, value: liability.openingOffsetBalance, type: "currency" }] : []),
      ];
    });
    const propertyInputs = asArray(inputs.assets).filter((asset) => PROPERTY_TYPES.has(asset.type || asset.category));
    const hasPrincipalResidence = propertyInputs.some((asset) => propertyTypeGroup(asset.type || asset.category) === "principal-residence");
    const hasInvestmentProperty = propertyInputs.some((asset) => propertyTypeGroup(asset.type || asset.category) === "investment-property");
    const hasOtherPropertyFallback = propertyInputs.some((asset) => propertyTypeGroup(asset.type || asset.category) === "other-property" && asset.growthRateSource === "zero-fallback");
    const propertyRows = [
      ...(hasPrincipalResidence ? [{
        label: "Principal residence capital growth",
        value: inputs.assumptions?.principalResidenceCapitalGrowthRate,
        type: "percentRate",
        note: PROPERTY_GROWTH_SOURCE_LABELS["principal-residence-default"],
      }] : []),
      ...(hasInvestmentProperty ? [{
        label: "Investment property capital growth",
        value: inputs.assumptions?.investmentPropertyCapitalGrowthRate,
        type: "percentRate",
        note: PROPERTY_GROWTH_SOURCE_LABELS["investment-property-default"],
      }] : []),
      ...propertyInputs
        .filter((asset) => asset.growthRateSource === "asset-specific")
        .map((asset) => ({
          label: `${asset.name || "Property"} property growth`,
          value: asset.annualGrowthRate,
          type: "percentRate",
          note: PROPERTY_GROWTH_SOURCE_LABELS["asset-specific"],
        })),
      ...(hasOtherPropertyFallback ? [{
        label: "Other property capital growth",
        value: 0,
        type: "percentRate",
        note: PROPERTY_GROWTH_SOURCE_LABELS["zero-fallback"],
      }] : []),
    ];
    const propertyIncomeInputs = asArray(inputs.propertyIncome);
    const rentalRows = [
      ...(propertyIncomeInputs.length ? [{
        label: "Rental cash income growth",
        value: "CPI",
        type: "plain",
        note: `Uses the inflation assumption (${formatPercentRate(inputs.inflationRate)}).`,
      }] : []),
      ...propertyIncomeInputs.map((income) => ({
        label: `${income.name || "Rental income"} treatment`,
        value: income.rentalCashflowTreatment === "beforeInterest"
          ? "Rental cash income before loan interest"
          : "Rental cash income after loan interest",
        type: "plain",
      })),
    ];
    const passiveRows = asArray(inputs.passiveIncome).length
      ? [{
        label: "Passive taxable income",
        value: "Allocated by owner",
        type: "plain",
        note: "Interest, dividends, distributions and taxable rental income are included in each person's projected taxable income.",
      }]
      : [];
    const offsetRows = asArray(projection.years).some((row) => asArray(row.liabilities).some((debt) => number(debt.offsetBalanceUsed) > 0))
      ? [{ label: "Mortgage offset treatment", value: assumptions.offsetTreatment || "Offset cash reduces projected interest and is dynamically depleted if used for retirement spending.", type: "plain" }]
      : [];
    const noSaleRows = asArray(projection.years).some((row) => asArray(row.properties).length)
      ? [
        { label: "Property sale treatment", value: assumptions.propertySaleTreatment || "No automatic property sale is assumed.", type: "plain" },
        { label: "Rental tax model", value: assumptions.rentalTaxModel || "Rental property projection models cashflow, not full future taxable rental profit/loss.", type: "plain" },
      ]
      : [];
    return [
      { label: "Projection start year", value: inputs.projectionStartYear ?? assumptions.projectionStartYear ?? null, type: "plain" },
      { label: "Projection end age", value: inputs.projectionEndAge ?? null, type: "age" },
      { label: "Inflation", value: inputs.inflationRate, type: "percentRate" },
      { label: "Accessible investment return", value: inputs.accessibleInvestments?.annualReturnRate, type: "percentRate" },
      { label: "Accessible investment fees", value: inputs.accessibleInvestments?.annualFeesRate, type: "percentRate" },
      { label: "Working-phase planned investment contribution", value: inputs.accessibleInvestments?.externalAnnualAccessibleContribution ?? inputs.accessibleInvestments?.currentAnnualContributions, type: "currency" },
      { label: "Opening offset balance inside accessible assets", value: inputs.accessibleInvestments?.openingOffsetBalance, type: "currency" },
      { label: "Current lifestyle spending", value: inputs.household?.currentLifestyleSpending, type: "currency" },
      { label: "Semi-retirement lifestyle spending", value: inputs.household?.semiRetirementLifestyleSpending, type: "currency" },
      { label: "Full-retirement lifestyle spending", value: inputs.household?.fullRetirementLifestyleSpending ?? inputs.scenario?.fullRetirementAnnualSpending, type: "currency" },
      { label: "Annual loan principal repayments", value: inputs.household?.annualLoanPrincipalRepayments, type: "currency" },
      { label: "Other annual income", value: inputs.household?.otherAnnualIncome, type: "currency" },
      { label: "Optional additional lifestyle draw", value: inputs.scenario?.optionalAdditionalLifestyleWithdrawal ?? inputs.scenario?.semiRetirementAccessibleWithdrawal, type: "currency" },
      { label: "Retirement surplus destination", value: surplusDestinationLabel(inputs.scenario?.surplusDestination), type: "plain" },
      { label: "Minimum accessible balance", value: inputs.scenario?.minimumAccessibleBalance, type: "currency" },
      { label: "Withdrawal order", value: inputs.scenario?.withdrawalOrder || assumptions.withdrawalOrder || "accessible investments first", type: "plain" },
      ...people.flatMap((person) => [
        { label: `${person.name || person.id} semi-retirement income`, value: person.semiRetirementGrossIncome, type: "currency" },
        { label: `${person.name || person.id} full-retirement age`, value: person.fullRetirementAge, type: "age" },
        { label: `${person.name || person.id} assumed super access age`, value: person.superAccessAge, type: "age" },
        { label: `${person.name || person.id} employer super rate`, value: person.employerSuperRate, type: "percentRate" },
        { label: `${person.name || person.id} super return before retirement`, value: person.superReturnBeforeRetirement, type: "percentRate" },
        { label: `${person.name || person.id} super return after retirement`, value: person.superReturnAfterRetirement, type: "percentRate" },
      ]),
      ...debtRows,
      ...propertyRows,
      ...rentalRows,
      ...passiveRows,
      ...offsetRows,
      ...noSaleRows,
    ].filter((row) => row.value !== undefined);
  }

  function buildSemiRetirementResultsViewModel(projection = {}, inputs = {}, draft = {}) {
    if (!projection || !projection.summary || !asArray(projection.years).length) {
      return { isAvailable: false };
    }
    const years = asArray(projection.years);
    const summary = projection.summary || {};
    const people = personListFromProjection(projection, draft, inputs);
    const finalYear = years[years.length - 1] || {};
    const householdFullRetirementRow = rowForCalendarYear(years, summary.householdFullRetirement?.calendarYear)
      || years.find((row) => row.householdPhase === "full-retirement")
      || null;
    const firstPersonFullRetirementRow = rowForCalendarYear(years, summary.firstPersonFullRetirement?.calendarYear) || null;
    const firstUnfunded = summary.firstUnfundedSpending || {};
    const isShortfall = milestoneHasYear(firstUnfunded) || roundDisplayAmount(summary.totalUnfundedSpending) > 0;
    const projectionEndAge = inputs.projectionEndAge
      ?? Math.min(...asArray(finalYear.people).map((person) => person.age).filter((age) => Number.isFinite(Number(age))));
    const annualRows = buildAnnualProjectionRows(projection, people);
    const topWarnings = asArray(projection.warnings).map(warningText).filter(Boolean);
    const annualWarnings = annualRows
      .flatMap((row) => row.warnings.map((warning) => `${row.calendarYear}: ${warning}`))
      .filter(Boolean);
    const semiRetirementRows = years.filter((row) => row.householdPhase === "semi-retirement");
    const requiredAccessibleWithdrawalsDuringSemiRetirement = semiRetirementRows.reduce((total, row) => {
      const household = row.household || {};
      return roundDisplayAmount(total + number(household.requiredAccessibleWithdrawal));
    }, 0);
    const superWithdrawalsDuringSemiRetirement = semiRetirementRows.reduce((total, row) => {
      const household = row.household || {};
      return roundDisplayAmount(total + number(household.totalSuperWithdrawal));
    }, 0);
    const plannedSemiRetirementWithdrawals = summary.totalPlannedSemiRetirementWithdrawals ?? semiRetirementRows.reduce((total, row) => {
      const household = row.household || {};
      return roundDisplayAmount(total + number(household.plannedSemiRetirementWithdrawal));
    }, 0);
    const totalAssetWithdrawalsDuringSemiRetirement = roundDisplayAmount(
      plannedSemiRetirementWithdrawals
      + requiredAccessibleWithdrawalsDuringSemiRetirement
      + superWithdrawalsDuringSemiRetirement,
    );
    const missingSuperAccessAgeWarnings = people
      .filter((person) => finiteNumberOrNull(person.superAccessAge) === null)
      .map((person) => `${person.name || person.id}: assumed super access age is missing, so no super-access timeline event is shown.`);
    const debtProperty = buildDebtPropertyResultsViewModel(projection, people);
    const passiveIncome = buildPassiveIncomeResultsViewModel(projection, people);

    return {
      isAvailable: true,
      people,
      projectionEndAge,
      projectionEndDescription: `Projection ends when the younger person reaches age ${projectionEndAge}`,
      status: {
        type: isShortfall ? "shortfall" : "funded",
        title: isShortfall
          ? `Projected funding shortfall begins in ${firstUnfunded.calendarYear}`
          : "Lifestyle funded through the projection period",
        milestone: isShortfall ? firstUnfunded : null,
        ages: isShortfall ? milestoneAges(firstUnfunded, people) : [],
      },
      keyResults: {
        accessibleAtFirstPersonFullRetirement: {
          milestone: summary.firstPersonFullRetirement,
          value: summary.accessibleBalanceAtFirstPersonFullRetirement,
          row: firstPersonFullRetirementRow,
        },
        accessibleWhenBothFullyRetired: {
          milestone: summary.householdFullRetirement,
          value: summary.accessibleBalanceWhenBothFullyRetired ?? householdFullRetirementRow?.household?.closingAccessibleInvestmentBalance ?? null,
          row: householdFullRetirementRow,
        },
        totalInvestableAssetsWhenBothFullyRetired: {
          milestone: summary.householdFullRetirement,
          value: summary.totalInvestableAssetsAtFullRetirement ?? householdFullRetirementRow?.household?.totalInvestableAssets ?? null,
          row: householdFullRetirementRow,
        },
        superAtAge60: people.map((person) => ({
          person,
          value: summary.superByPersonAtAge60?.[person.id] ?? null,
          unavailableReason: summary.superByPersonAtAge60?.[person.id] === null ? "Not available - age 60 predates this projection" : "",
        })),
        superAtAccessAge: people.map((person) => ({
          person,
          value: summary.superByPersonAtAccessAge?.[person.id] ?? null,
        })),
        projectionEnd: {
          calendarYear: finalYear.calendarYear,
          ages: rowAges(finalYear, people),
          accessibleInvestments: summary.accessibleBalanceAtEndAge ?? finalYear.household?.closingAccessibleInvestmentBalance ?? null,
          super: summary.superBalanceAtEndAge ?? finalYear.household?.totalSuperBalance ?? null,
          totalInvestableAssets: summary.totalInvestableAssetsAtEndAge ?? finalYear.household?.totalInvestableAssets ?? null,
          projectedNetWorth: summary.totalNetWorthAtEndAge ?? finalYear.household?.totalNetWorth ?? null,
        },
      },
      timeline: buildRetirementTimeline(projection, people),
      longevity: {
        accessibleFundsExhausted: summary.accessibleFundsExhausted,
        allRetirementFundsExhausted: summary.allRetirementFundsExhausted,
        firstUnfundedSpending: summary.firstUnfundedSpending,
        totalUnfundedSpending: roundDisplayAmount(summary.totalUnfundedSpending),
      },
    semiRetirementFunding: {
        plannedAnnualAccessibleWithdrawal: inputs.scenario?.optionalAdditionalLifestyleWithdrawal ?? inputs.scenario?.semiRetirementAccessibleWithdrawal ?? draft.scenario?.optionalAdditionalLifestyleWithdrawal ?? draft.scenario?.semiRetirementAccessibleWithdrawal ?? 0,
        totalPlannedSemiRetirementWithdrawals: plannedSemiRetirementWithdrawals,
        requiredAccessibleWithdrawalsDuringSemiRetirement,
        superWithdrawalsDuringSemiRetirement,
        totalAssetWithdrawalsDuringSemiRetirement,
      },
      passiveIncome,
      debtProperty,
      annualRows,
      assumptions: {
        rows: buildAssumptionRows(projection, inputs),
        engineAssumptions: projection.assumptions || {},
      },
      warnings: [...topWarnings, ...annualWarnings, ...missingSuperAccessAgeWarnings],
    };
  }

  const SCENARIO_ADJUSTMENT_FIELDS = {
    semiRetirementAccessibleWithdrawal: {
      path: "scenario.semiRetirementAccessibleWithdrawal",
      label: "Optional additional lifestyle draw",
    },
    fullRetirementLifestyleSpending: {
      path: "household.fullRetirementLifestyleSpending",
      label: "Annual retirement lifestyle spending",
    },
  };

  function hasSemiRetirementPhase(projection = {}, inputs = {}, draft = {}) {
    if (asArray(projection.years).some((row) => row.householdPhase === "semi-retirement")) return true;
    const people = asArray(inputs.people).length ? inputs.people : asArray(draft.people);
    return people.some((person) => Boolean(person.hasSemiRetirement) && number(person.semiRetirementAge) < number(person.fullRetirementAge));
  }

  function scenarioAdjustmentSliderMax(value) {
    const amount = nonNegative(value);
    return Math.max(100000, Math.ceil((amount * 2) / 5000) * 5000);
  }

  function scenarioAdjustmentValue(draft = {}, field) {
    const config = SCENARIO_ADJUSTMENT_FIELDS[field];
    if (field === "semiRetirementAccessibleWithdrawal") {
      return number(draft.scenario?.semiRetirementAccessibleWithdrawal ?? draft.scenario?.optionalAdditionalLifestyleWithdrawal);
    }
    return config ? number(getDraftPath(draft, config.path)) : 0;
  }

  function applyScenarioAdjustment(draft = {}, field, value) {
    const config = SCENARIO_ADJUSTMENT_FIELDS[field];
    if (!config) return draft;
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) ? parsed : value;
    setDraftPath(draft, config.path, nextValue);
    if (field === "semiRetirementAccessibleWithdrawal") {
      setDraftPath(draft, "scenario.optionalAdditionalLifestyleWithdrawal", nextValue);
    }
    return draft;
  }

  function buildScenarioAdjustmentSnapshot(projection = {}, inputs = {}, draft = {}) {
    const viewModel = buildSemiRetirementResultsViewModel(projection, inputs, draft);
    if (!viewModel?.isAvailable) return null;
    const firstShortfall = viewModel.longevity?.firstUnfundedSpending || null;
    return {
      values: {
        semiRetirementAccessibleWithdrawal: scenarioAdjustmentValue(draft, "semiRetirementAccessibleWithdrawal"),
        fullRetirementLifestyleSpending: scenarioAdjustmentValue(draft, "fullRetirementLifestyleSpending"),
      },
      statusType: viewModel.status?.type || "funded",
      statusTitle: viewModel.status?.title || "",
      projectionEndAssets: finiteNumberOrNull(viewModel.keyResults?.projectionEnd?.totalInvestableAssets),
      projectionEndYear: viewModel.keyResults?.projectionEnd?.calendarYear ?? null,
      projectionEndAges: viewModel.keyResults?.projectionEnd?.ages || [],
      firstShortfallYear: firstShortfall?.calendarYear ?? null,
      firstShortfallAges: firstShortfall?.calendarYear ? milestoneAges(firstShortfall, viewModel.people) : [],
      hasSemiRetirementPhase: hasSemiRetirementPhase(projection, inputs, draft),
    };
  }

  function buildScenarioAdjustmentComparison(baseline = null, adjusted = null) {
    if (!baseline || !adjusted) return null;
    const baselineEndAssets = finiteNumberOrNull(baseline.projectionEndAssets);
    const adjustedEndAssets = finiteNumberOrNull(adjusted.projectionEndAssets);
    return {
      endAssetsDelta: baselineEndAssets === null || adjustedEndAssets === null
        ? null
        : roundDisplayAmount(adjustedEndAssets - baselineEndAssets),
      baselineFirstShortfallYear: baseline.firstShortfallYear ?? null,
      adjustedFirstShortfallYear: adjusted.firstShortfallYear ?? null,
      firstShortfallYearDelta:
        baseline.firstShortfallYear === null || baseline.firstShortfallYear === undefined
        || adjusted.firstShortfallYear === null || adjusted.firstShortfallYear === undefined
          ? null
          : Number(adjusted.firstShortfallYear) - Number(baseline.firstShortfallYear),
      valueDeltas: {
        semiRetirementAccessibleWithdrawal: roundDisplayAmount(
          scenarioAdjustmentValue({ scenario: { semiRetirementAccessibleWithdrawal: adjusted.values?.semiRetirementAccessibleWithdrawal } }, "semiRetirementAccessibleWithdrawal")
          - scenarioAdjustmentValue({ scenario: { semiRetirementAccessibleWithdrawal: baseline.values?.semiRetirementAccessibleWithdrawal } }, "semiRetirementAccessibleWithdrawal"),
        ),
        fullRetirementLifestyleSpending: roundDisplayAmount(
          scenarioAdjustmentValue({ household: { fullRetirementLifestyleSpending: adjusted.values?.fullRetirementLifestyleSpending } }, "fullRetirementLifestyleSpending")
          - scenarioAdjustmentValue({ household: { fullRetirementLifestyleSpending: baseline.values?.fullRetirementLifestyleSpending } }, "fullRetirementLifestyleSpending"),
        ),
      },
    };
  }

  function buildScenarioAdjustmentState(projection = {}, inputs = {}, draft = {}, baseline = null) {
    const impact = buildScenarioAdjustmentSnapshot(projection, inputs, draft);
    if (!impact) return { isAvailable: false };
    const semiValue = scenarioAdjustmentValue(draft, "semiRetirementAccessibleWithdrawal");
    const retirementValue = scenarioAdjustmentValue(draft, "fullRetirementLifestyleSpending");
    return {
      isAvailable: true,
      values: {
        semiRetirementAccessibleWithdrawal: semiValue,
        fullRetirementLifestyleSpending: retirementValue,
      },
      controls: {
        semiRetirementAccessibleWithdrawal: {
          ...SCENARIO_ADJUSTMENT_FIELDS.semiRetirementAccessibleWithdrawal,
          enabled: impact.hasSemiRetirementPhase,
          value: semiValue,
          min: 0,
          max: scenarioAdjustmentSliderMax(semiValue),
          step: 1000,
        },
        fullRetirementLifestyleSpending: {
          ...SCENARIO_ADJUSTMENT_FIELDS.fullRetirementLifestyleSpending,
          enabled: true,
          value: retirementValue,
          min: 0,
          max: scenarioAdjustmentSliderMax(retirementValue),
          step: 1000,
        },
      },
      impact,
      comparison: buildScenarioAdjustmentComparison(baseline, impact),
    };
  }

  function buildScenarioAdjustmentDisplayState({
    projection = {},
    inputs = {},
    resultDraft = {},
    currentDraft = {},
    baseline = null,
    hasValidationErrors = false,
  } = {}) {
    const resultState = buildScenarioAdjustmentState(projection, inputs, resultDraft, baseline);
    if (!resultState?.isAvailable) return { isAvailable: false };
    const controlState = buildScenarioAdjustmentState(projection, inputs, currentDraft, null);
    if (!controlState?.isAvailable) return resultState;
    return {
      ...resultState,
      values: controlState.values,
      controls: {
        semiRetirementAccessibleWithdrawal: {
          ...resultState.controls.semiRetirementAccessibleWithdrawal,
          value: controlState.controls.semiRetirementAccessibleWithdrawal.value,
          max: controlState.controls.semiRetirementAccessibleWithdrawal.max,
        },
        fullRetirementLifestyleSpending: {
          ...resultState.controls.fullRetirementLifestyleSpending,
          value: controlState.controls.fullRetirementLifestyleSpending.value,
          max: controlState.controls.fullRetirementLifestyleSpending.max,
        },
      },
      resultValues: resultState.values,
      draftValues: controlState.values,
      isUsingLastValidResult: Boolean(hasValidationErrors),
      statusMessage: hasValidationErrors
        ? "Last valid projection remains visible. Fix the adjustment value to update the results."
        : "Projection updated from the existing engine.",
    };
  }

  function resetScenarioAdjustmentsToBaseline(draft = {}, baseline = null) {
    if (!baseline?.values) return draft;
    applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", baseline.values.semiRetirementAccessibleWithdrawal);
    applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", baseline.values.fullRetirementLifestyleSpending);
    return draft;
  }

  function isSemiRetirementUiEnabled(engine = global.FFSSemiRetirementProjection) {
    return Boolean(engine?.featureFlags?.semiRetirementProjectionEnabled);
  }

  function setSemiRetirementProjectionEnabledForDevelopment(enabled = true) {
    if (!global.FFSSemiRetirementProjection?.featureFlags) return false;
    global.FFSSemiRetirementProjection.featureFlags.semiRetirementProjectionEnabled = Boolean(enabled);
    return global.FFSSemiRetirementProjection.featureFlags.semiRetirementProjectionEnabled;
  }

  global.FFSSemiRetirementUi = {
    buildSemiRetirementScenarioDefaults,
    basePlanSourceKey,
    projectionPropertyIncomeFromPlan,
    projectionPassiveIncomeFromPlan,
    rentalLoansLinkedToIncome,
    getDraftPath,
    setDraftPath,
    validateSemiRetirementScenarioDraft,
    scenarioDraftToProjectionInputs,
    runSemiRetirementProjection,
    buildSemiRetirementResultsViewModel,
    buildDebtPropertyResultsViewModel,
    buildPassiveIncomeResultsViewModel,
    hasSemiRetirementPhase,
    applyScenarioAdjustment,
    buildScenarioAdjustmentSnapshot,
    buildScenarioAdjustmentComparison,
    buildScenarioAdjustmentState,
    buildScenarioAdjustmentDisplayState,
    resetScenarioAdjustmentsToBaseline,
    isSemiRetirementUiEnabled,
    setSemiRetirementProjectionEnabledForDevelopment,
  };
})(globalThis);
