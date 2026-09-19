(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSTrustReadiness = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const positive = (value) => number(value) > 0;
  const list = (value) => Array.isArray(value) ? value : [];
  const hasItemValue = (items, keys) => list(items).some((item) => keys.some((key) => positive(item?.[key])));
  const categoryTotal = (items, categories, key = "value") => {
    const allowed = new Set(categories);
    return list(items).reduce((total, item) => total + (allowed.has(item?.category || item?.type) ? number(item?.[key]) : 0), 0);
  };

  function evaluatePlanReadiness(plan = {}, result = {}) {
    const personal = plan.personal || {};
    const investing = plan.investing || {};
    const assets = plan.assets || {};
    const liabilities = plan.liabilities || {};
    const hasAge = positive(personal.person1Age) || positive(personal.person2Age);
    const hasTargetAge = positive(personal.fullRetirementAge) || positive(personal.semiRetirementAge) || positive(personal.workOptionalAge);
    const hasIncome = hasItemValue(plan.incomeItems, ["amount", "annualAmount"])
      || positive(plan.income?.person1Income) || positive(plan.income?.person2Income) || positive(plan.income?.otherIncome)
      || positive(result.annualGrossIncome);
    const hasLifestyle = positive(personal.targetAnnualSpending)
      || hasItemValue(plan.expenseItems, ["amount", "annualAmount"])
      || positive(plan.expenses?.livingCosts) || positive(result.annualLivingExpenses);
    const isSample = plan.meta?.source === "sample" || Boolean(plan.meta?.samplePlanId);
    const isConsumerPlan = plan.meta?.setupExperience === "consumer-first-v2";
    const confirmations = plan.meta?.setupConfirmations || {};
    const hasSpendingConfirmation = hasItemValue(plan.expenseItems, ["amount", "annualAmount"])
      || positive(plan.expenses?.livingCosts)
      || confirmations.spendingReviewed === true
      || !isConsumerPlan
      || isSample;
    const person2Active = Boolean(
      String(personal.person2Name || "").trim()
      || positive(personal.person2Age)
      || list(plan.incomeItems).some((item) => item?.owner === "person2"),
    );
    const superFor = (person) => {
      const legacyKey = person === "person2" ? "superPerson2" : "superPerson1";
      const assetId = person === "person2" ? "asset-super-2" : "asset-super-1";
      return positive(assets[legacyKey]) || list(plan.assetItems).some((item) => item?.id === assetId && positive(item.value));
    };
    const hasSuperConfirmation = ["person1", ...(person2Active ? ["person2"] : [])].every((person) => (
      superFor(person)
      || confirmations[`${person}NoSuper`] === true
      || !isConsumerPlan
      || isSample
    ));
    const hasPosition = hasItemValue(plan.assetItems, ["value"])
      || hasItemValue(plan.liabilityItems, ["balance", "repayment", "repaymentAmount"])
      || [assets.homeValue, assets.otherPropertyValue, assets.offsetBalance, assets.cash, assets.sharesEtfs, assets.crypto, assets.superPerson1, assets.superPerson2,
        liabilities.homeLoanBalance, liabilities.otherDebts, liabilities.creditCardBalance, liabilities.hecsHelpDebt,
        result.totalAssets, result.totalLiabilities, result.currentNetWorth].some(positive);
    const hasAssumptions = positive(investing.expectedInvestmentReturnPct)
      && positive(investing.expectedSuperReturnPct)
      && positive(investing.inflationPct)
      && positive(investing.safeWithdrawalRatePct);
    const checks = [
      { key: "age", label: "Household age", complete: hasAge },
      { key: "targetAge", label: "Financial Freedom target age", complete: hasTargetAge },
      { key: "income", label: "Income", complete: hasIncome },
      { key: "lifestyle", label: "Lifestyle spending", complete: hasLifestyle },
      { key: "spendingConfirmation", label: "Household spending confirmation", complete: hasSpendingConfirmation },
      { key: "superConfirmation", label: "Superannuation status", complete: hasSuperConfirmation },
      { key: "position", label: "Assets, liabilities or starting balances", complete: hasPosition },
      { key: "assumptions", label: "Planning assumptions", complete: hasAssumptions },
    ];
    // Target ages and assumptions have populated defaults, so neither proves that
    // the household has started entering a plan.
    const meaningful = [hasAge, hasIncome, hasLifestyle, hasPosition].some(Boolean);
    const missing = checks.filter((check) => !check.complete);
    const state = !meaningful ? "empty" : missing.length ? "partial" : "ready";
    return {
      state,
      complete: state === "ready",
      readyForPersonalisedResults: state === "ready",
      hasPlanData: state !== "empty",
      checks,
      missingSections: missing.map((check) => check.label),
      message: state === "ready"
        ? "Your plan has enough information for personalised projections and comparisons."
        : "Complete your Financial Plan before personalised projections and comparisons are available.",
    };
  }

  const explicitRentalCategories = new Set(["rentalInvestmentProperty", "rentalProperty", "investmentProperty"]);

  function hasExplicitRentalRelationship(plan = {}, assetId = "") {
    const id = String(assetId || "");
    if (!id) return false;
    const linkedIncome = list(plan.incomeItems).some((income) => (
      income?.type === "rentalNetCashIncome"
      && [income.linkedAssetId, income.linkedPropertyAssetId].some((value) => String(value || "") === id)
    ));
    const linkedLoan = list(plan.liabilityItems).some((loan) => (
      [loan?.linkedAssetId, loan?.investmentLink?.linkedAssetId].some((value) => String(value || "") === id)
      && (loan?.type === "rentalPropertyLoan" || loan?.investmentLink?.assetCategory === "rental_property")
    ));
    return linkedIncome || linkedLoan;
  }

  function isRentalLinkEligible(plan = {}, asset = {}) {
    return explicitRentalCategories.has(asset?.category) || hasExplicitRentalRelationship(plan, asset?.id);
  }

  const adjustmentDefinitions = [
    ["incomeChange", "Income", "annual"],
    ["expenseChange", "Expenses", "annual"],
    ["otherExpenseAnnualChange", "Expenses", "annual"],
    ["loanRepaymentChangeMonthly", "Mortgage repayment", "monthly"],
    ["loanInterestRateChangePct", "Loan interest rate", "percent"],
    ["investmentContributionChange", "Investment contribution", "annual"],
    ["annualInvestingTarget", "Investment contribution", "annual"],
    ["investmentReturnChangePct", "Investment return", "percent"],
    ["superContributionChange", "Employer super", "annual"],
    ["extraConcessionalSuperChange", "Additional concessional super", "annual"],
    ["helpBalanceChange", "STSL balance", "money"],
    ["oneOffCosts", "One-off costs", "money"],
    ["oneOffSavings", "One-off savings", "money"],
  ];

  function formatAdjustment(value, format) {
    const amount = number(value);
    if (format === "percent") return `${amount > 0 ? "+" : ""}${amount}%`;
    const money = `${amount < 0 ? "-" : amount > 0 ? "+" : ""}$${Math.abs(amount).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
    if (format === "annual") return `${money} per year`;
    if (format === "monthly") return `${money} per month`;
    return money;
  }

  function scenarioChangesFromAdjustments(adjustments = {}) {
    const changes = adjustmentDefinitions.flatMap(([key, label, format]) => {
      const value = number(adjustments[key]);
      return value ? [{ key, label, before: "No change", after: formatAdjustment(value, format), value }] : [];
    });
    if (adjustments.surplusAllocationTarget && adjustments.surplusAllocationTarget !== "none") {
      changes.push({
        key: "surplusAllocationTarget",
        label: "Available surplus allocation",
        before: "Not allocated",
        after: adjustments.surplusAllocationTarget === "debt" ? "Direct to debt repayment" : "Direct to investments",
        value: String(adjustments.surplusAllocationTarget),
      });
    }
    return changes;
  }

  function createScenarioOverlay({ actionId = "", label = "", adjustments = {} } = {}) {
    return {
      version: 1,
      type: "decision-adjustments",
      sourceAction: { id: String(actionId || ""), label: String(label || "") },
      adjustments: { ...adjustments },
      changes: scenarioChangesFromAdjustments(adjustments),
    };
  }

  function scenarioOverlayFromSnapshot(snapshot = {}, fallback = {}) {
    if (snapshot?.overlay?.version === 1 && Array.isArray(snapshot.overlay.changes)) return snapshot.overlay;
    return createScenarioOverlay({
      actionId: snapshot?.actionId || fallback.actionId || "legacy",
      label: fallback.label || "Legacy scenario",
      adjustments: snapshot?.adjustments || fallback.adjustments || {},
    });
  }

  return {
    evaluatePlanReadiness,
    explicitRentalCategories: Array.from(explicitRentalCategories),
    hasExplicitRentalRelationship,
    isRentalLinkEligible,
    scenarioChangesFromAdjustments,
    createScenarioOverlay,
    scenarioOverlayFromSnapshot,
  };
});
