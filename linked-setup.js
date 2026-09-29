(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSLinkedSetup = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const numberOrZero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const text = (value) => String(value ?? "").trim();
  const findById = (items, id) => (items || []).find((item) => String(item.id) === String(id));
  const removeValue = (items, value) => (items || []).filter((item) => String(item) !== String(value));

  function defaultId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function collections(plan) {
    plan.assetItems = Array.isArray(plan.assetItems) ? plan.assetItems : [];
    plan.incomeItems = Array.isArray(plan.incomeItems) ? plan.incomeItems : [];
    plan.liabilityItems = Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [];
    return plan;
  }

  function ownership(target, draft) {
    target.owner = ["person1", "person2", "joint"].includes(draft.owner) ? draft.owner : "joint";
    if (target.owner === "joint") {
      target.person1AllocationPercentage = numberOrZero(draft.person1AllocationPercentage ?? 50);
      target.person2AllocationPercentage = numberOrZero(draft.person2AllocationPercentage ?? 50);
    } else {
      target.person1AllocationPercentage = target.owner === "person1" ? 100 : 0;
      target.person2AllocationPercentage = target.owner === "person2" ? 100 : 0;
    }
  }

  function validateOwnership(draft, errors) {
    if (draft.owner === "joint") {
      const total = numberOrZero(draft.person1AllocationPercentage) + numberOrZero(draft.person2AllocationPercentage);
      if (Math.abs(total - 100) > 0.001) errors.push("Joint ownership percentages must total 100%.");
    }
  }

  function validateRental(draft, existingLoan) {
    const errors = [];
    if (!text(draft.name)) errors.push("Enter a property name or description.");
    if (numberOrZero(draft.value) < 0) errors.push("Property value cannot be negative.");
    validateOwnership(draft, errors);
    if (draft.hasLoan && numberOrZero(draft.loanBalance) < 0) errors.push("Loan balance cannot be negative.");
    if (!draft.hasLoan && existingLoan && !["keep", "unlink"].includes(draft.existingLoanChoice)) {
      errors.push("Choose whether to keep the existing loan linked or unlink it without deleting it.");
    }
    return errors;
  }

  function upsertRentalProperty(sourcePlan, draft, options = {}) {
    const plan = collections(clone(sourcePlan));
    const makeId = options.makeId || defaultId;
    const existingAsset = findById(plan.assetItems, draft.assetId);
    const assetId = existingAsset?.id || draft.assetId || makeId("asset-rental");
    const existingIncome = findById(plan.incomeItems, draft.incomeId)
      || plan.incomeItems.find((item) => item.type === "rentalNetCashIncome" && String(item.linkedAssetId) === String(assetId));
    const existingLoan = findById(plan.liabilityItems, draft.loanId || draft.linkExistingLoanId)
      || plan.liabilityItems.find((item) => item.type === "rentalPropertyLoan" && String(item.linkedAssetId || item.investmentLink?.linkedAssetId) === String(assetId));
    const errors = validateRental(draft, existingLoan);
    if (errors.length) return { ok: false, errors, plan: sourcePlan };

    const asset = existingAsset || { id: assetId };
    asset.name = text(draft.name);
    asset.category = "rentalInvestmentProperty";
    asset.value = numberOrZero(draft.value);
    asset.guidedSetup = true;
    ownership(asset, draft);
    if (!existingAsset) plan.assetItems.push(asset);

    const incomeId = existingIncome?.id || draft.incomeId || makeId("income-rental");
    const income = existingIncome || { id: incomeId };
    income.name = text(draft.incomeName) || `${asset.name} rental income`;
    income.propertyName = asset.name;
    income.type = "rentalNetCashIncome";
    income.frequency = "annually";
    income.linkedAssetId = assetId;
    income.linkedPropertyAssetId = assetId;
    income.isPassiveIncome = true;
    income.guidedSetup = true;
    ownership(income, draft);
    income.annualRentReceived = numberOrZero(draft.annualRentReceived);
    income.annualPropertyExpensesExcludingPrincipal = numberOrZero(draft.annualPropertyExpensesExcludingPrincipal);
    const derivedCash = income.annualRentReceived - income.annualPropertyExpensesExcludingPrincipal;
    income.rentalCashIncomeAnnual = draft.useAdvancedCashIncome
      ? numberOrZero(draft.rentalCashIncomeAnnual)
      : derivedCash;
    income.rentalCashflowTreatment = draft.rentalCashflowTreatment === "beforeInterest" ? "beforeInterest" : "afterInterest";
    if (draft.taxableRentalProfitProvided) {
      income.amount = numberOrZero(draft.taxableRentalProfit);
      income.taxableRentalProfitProvided = true;
    } else {
      income.amount = existingIncome ? numberOrZero(existingIncome.amount) : 0;
      income.taxableRentalProfitProvided = Boolean(existingIncome?.taxableRentalProfitProvided);
    }
    if (!existingIncome) plan.incomeItems.push(income);

    let loan = existingLoan || null;
    if (draft.hasLoan || draft.existingLoanChoice === "keep") {
      const loanId = loan?.id || draft.loanId || makeId("liability-rental");
      loan = loan || { id: loanId };
      loan.name = text(draft.loanName) || `${asset.name} loan`;
      loan.type = "rentalPropertyLoan";
      loan.owner = asset.owner;
      loan.balance = numberOrZero(draft.loanBalance ?? loan.balance);
      loan.interestRatePct = numberOrZero(draft.interestRatePct ?? loan.interestRatePct);
      loan.repayment = numberOrZero(draft.repayment ?? loan.repayment);
      loan.repaymentFrequency = draft.repaymentFrequency || loan.repaymentFrequency || "monthly";
      loan.termYears = numberOrZero(draft.termYears ?? loan.termYears);
      loan.openingOffsetBalance = numberOrZero(draft.offsetBalance ?? loan.openingOffsetBalance);
      loan.repaymentType = draft.repaymentType === "interestOnly" ? "interestOnly" : "principalAndInterest";
      loan.linkedAssetId = assetId;
      loan.linkedRentalIncomeId = incomeId;
      loan.investmentLink = { assetCategory: "rental_property", linkedAssetId: assetId, description: asset.name };
      loan.guidedSetup = true;
      if (!existingLoan) plan.liabilityItems.push(loan);
      income.linkedLoanIds = Array.from(new Set([...(income.linkedLoanIds || []).map(String), String(loanId)]));
      income.linkedLoanId = income.linkedLoanIds.length === 1 ? income.linkedLoanIds[0] : "";
    } else if (existingLoan && draft.existingLoanChoice === "unlink") {
      existingLoan.linkedAssetId = "";
      existingLoan.linkedRentalIncomeId = "";
      existingLoan.investmentLink = { ...(existingLoan.investmentLink || {}), linkedAssetId: "" };
      income.linkedLoanIds = removeValue(income.linkedLoanIds, existingLoan.id);
      income.linkedLoanId = income.linkedLoanIds.length === 1 ? String(income.linkedLoanIds[0]) : "";
      loan = null;
    }

    return {
      ok: true,
      plan,
      ids: { assetId, incomeId, loanId: loan?.id || "" },
      mapping: {
        rentalCashIncomeAnnual: income.rentalCashIncomeAnnual,
        taxableRentalProfit: income.amount,
        rentalCashflowTreatment: income.rentalCashflowTreatment,
      },
    };
  }

  function investmentCategory(type) {
    if (type === "managedFund") return "managedFund";
    if (type === "otherInvestment") return "other";
    return "shares";
  }

  function upsertInvestment(sourcePlan, draft, options = {}) {
    const plan = collections(clone(sourcePlan));
    const makeId = options.makeId || defaultId;
    const errors = [];
    if (draft.investmentReturnMode === "totalReturn") {
      if (!globalThis.FFSCalculator?.investmentReturnValidation) errors.push("Investment return validation is unavailable.");
      else errors.push(...globalThis.FFSCalculator.investmentReturnValidation(draft));
    }
    if (!text(draft.name)) errors.push("Enter an investment name or description.");
    validateOwnership(draft, errors);
    const existingAsset = findById(plan.assetItems, draft.assetId);
    const assetId = existingAsset?.id || draft.assetId || makeId("asset-investment");
    const existingIncome = findById(plan.incomeItems, draft.incomeId)
      || plan.incomeItems.find((item) => String(item.linkedAssetId) === String(assetId) && ["dividends", "distributions"].includes(item.type));
    const existingLoan = findById(plan.liabilityItems, draft.loanId || draft.linkExistingLoanId)
      || plan.liabilityItems.find((item) => item.type === "investmentLoan" && String(item.linkedAssetId || item.investmentLink?.linkedAssetId) === String(assetId));
    if (!draft.hasLoan && existingLoan && !["keep", "unlink"].includes(draft.existingLoanChoice)) {
      errors.push("Choose whether to keep the existing loan linked or unlink it without deleting it.");
    }
    if (errors.length) return { ok: false, errors, plan: sourcePlan };

    const asset = existingAsset || { id: assetId };
    asset.name = text(draft.name);
    asset.category = investmentCategory(draft.investmentType);
    asset.investmentType = draft.investmentType || "shares";
    asset.value = numberOrZero(draft.value);
    if (draft.investmentReturnMode) {
      asset.investmentReturnMode = draft.investmentReturnMode;
      asset.expectedTotalReturnPct = draft.expectedTotalReturnPct;
      asset.incomeTreatment = draft.incomeTreatment;
      asset.expectedIncomeYieldPct = draft.expectedIncomeYieldPct;
    }
    asset.guidedSetup = true;
    ownership(asset, draft);
    if (!existingAsset) plan.assetItems.push(asset);

    const incomeId = existingIncome?.id || draft.incomeId || makeId("income-investment");
    const income = existingIncome || { id: incomeId };
    income.name = text(draft.incomeName) || `${asset.name} dividends / distributions`;
    income.type = ["managedFund", "otherInvestment"].includes(draft.investmentType) ? "distributions" : "dividends";
    income.owner = asset.owner;
    income.frequency = "annually";
    income.amount = numberOrZero(draft.annualIncome);
    income.linkedAssetId = assetId;
    income.isPassiveIncome = true;
    income.guidedSetup = true;
    ownership(income, draft);
    if (!existingIncome) plan.incomeItems.push(income);

    let loan = existingLoan || null;
    if (draft.hasLoan || draft.existingLoanChoice === "keep") {
      const loanId = loan?.id || draft.loanId || makeId("liability-investment");
      loan = loan || { id: loanId };
      loan.name = text(draft.loanName) || `${asset.name} investment loan`;
      loan.type = "investmentLoan";
      loan.owner = asset.owner;
      loan.balance = numberOrZero(draft.loanBalance ?? loan.balance);
      loan.interestRatePct = numberOrZero(draft.interestRatePct ?? loan.interestRatePct);
      loan.repayment = numberOrZero(draft.repayment ?? loan.repayment);
      loan.repaymentFrequency = draft.repaymentFrequency || loan.repaymentFrequency || "monthly";
      loan.termYears = numberOrZero(draft.termYears ?? loan.termYears);
      loan.linkedAssetId = assetId;
      loan.linkedInvestmentIncomeId = incomeId;
      loan.investmentAssetCategory = asset.category === "shares" ? "shares" : "other";
      loan.investmentLink = { assetCategory: loan.investmentAssetCategory, linkedAssetId: assetId, description: asset.name };
      loan.guidedSetup = true;
      if (!existingLoan) plan.liabilityItems.push(loan);
    } else if (existingLoan && draft.existingLoanChoice === "unlink") {
      existingLoan.linkedAssetId = "";
      existingLoan.linkedInvestmentIncomeId = "";
      existingLoan.investmentLink = { ...(existingLoan.investmentLink || {}), linkedAssetId: "" };
      loan = null;
    }

    return { ok: true, plan, ids: { assetId, incomeId, loanId: loan?.id || "" } };
  }

  function upsertHome(sourcePlan, draft, options = {}) {
    const plan = collections(clone(sourcePlan));
    const makeId = options.makeId || defaultId;
    const errors = [];
    if (!text(draft.name)) errors.push("Enter a home name or description.");
    if (numberOrZero(draft.value) < 0) errors.push("Home value cannot be negative.");
    const existingAsset = findById(plan.assetItems, draft.assetId);
    const assetId = existingAsset?.id || draft.assetId || makeId("asset-home");
    const existingLoan = findById(plan.liabilityItems, draft.loanId || draft.linkExistingLoanId)
      || plan.liabilityItems.find((item) => item.type === "homeLoan" && String(item.linkedAssetId || "") === String(assetId));
    if (draft.hasLoan && numberOrZero(draft.loanBalance ?? existingLoan?.balance) < 0) errors.push("Loan balance cannot be negative.");
    if (errors.length) return { ok: false, errors, plan: sourcePlan };

    const asset = existingAsset || { id: assetId };
    asset.name = text(draft.name);
    asset.category = "home";
    asset.value = numberOrZero(draft.value);
    asset.guidedSetup = true;
    if (!existingAsset) plan.assetItems.push(asset);

    let loan = existingLoan || null;
    if (draft.hasLoan) {
      const loanId = loan?.id || draft.loanId || makeId("liability-home");
      loan = loan || { id: loanId };
      loan.name = text(draft.loanName) || `${asset.name} loan`;
      loan.type = "homeLoan";
      loan.balance = numberOrZero(draft.loanBalance ?? loan.balance);
      loan.interestRatePct = numberOrZero(draft.interestRatePct ?? loan.interestRatePct);
      loan.repayment = numberOrZero(draft.repayment ?? loan.repayment);
      loan.repaymentFrequency = draft.repaymentFrequency || loan.repaymentFrequency || "monthly";
      loan.termYears = numberOrZero(draft.termYears ?? loan.termYears);
      loan.linkedAssetId = assetId;
      loan.guidedSetup = true;
      if (!existingLoan) plan.liabilityItems.push(loan);
    }

    return { ok: true, plan, ids: { assetId, loanId: loan?.id || "" } };
  }

  function linkedRentalRecords(plan, assetId) {
    const asset = findById(plan.assetItems, assetId);
    if (!asset) return null;
    const income = (plan.incomeItems || []).find((item) => item.type === "rentalNetCashIncome" && String(item.linkedAssetId) === String(assetId));
    const loan = (plan.liabilityItems || []).find((item) => item.type === "rentalPropertyLoan" && String(item.linkedAssetId || item.investmentLink?.linkedAssetId) === String(assetId));
    return { asset, income: income || null, loan: loan || null };
  }

  function linkedInvestmentRecords(plan, assetId) {
    const asset = findById(plan.assetItems, assetId);
    if (!asset) return null;
    const income = (plan.incomeItems || []).find((item) => ["dividends", "distributions"].includes(item.type) && String(item.linkedAssetId) === String(assetId));
    const loan = (plan.liabilityItems || []).find((item) => item.type === "investmentLoan" && String(item.linkedAssetId || item.investmentLink?.linkedAssetId) === String(assetId));
    return { asset, income: income || null, loan: loan || null };
  }

  function linkedHomeRecords(plan, assetId) {
    const asset = findById(plan.assetItems, assetId);
    if (!asset) return null;
    const loan = (plan.liabilityItems || []).find((item) => item.type === "homeLoan" && String(item.linkedAssetId || "") === String(assetId));
    return { asset, loan: loan || null };
  }

  function removeLinkedAsset(sourcePlan, assetId) {
    const plan = collections(clone(sourcePlan));
    const id = String(assetId || "");
    const removedIncomeIds = new Set(plan.incomeItems
      .filter((income) => [income.linkedAssetId, income.linkedPropertyAssetId].some((value) => String(value || "") === id))
      .map((income) => String(income.id || "")));
    plan.assetItems = plan.assetItems.filter((asset) => String(asset.id || "") !== id);
    plan.incomeItems = plan.incomeItems.filter((income) => !removedIncomeIds.has(String(income.id || "")));
    plan.liabilityItems.forEach((loan) => {
      const linkedToAsset = [loan.linkedAssetId, loan.investmentLink?.linkedAssetId].some((value) => String(value || "") === id);
      const linkedToIncome = [loan.linkedRentalIncomeId, loan.linkedInvestmentIncomeId].some((value) => removedIncomeIds.has(String(value || "")));
      if (!linkedToAsset && !linkedToIncome) return;
      loan.linkedAssetId = "";
      loan.linkedRentalIncomeId = "";
      loan.linkedInvestmentIncomeId = "";
      if (loan.investmentLink) loan.investmentLink = { ...loan.investmentLink, linkedAssetId: "" };
    });
    plan.incomeItems.forEach((income) => {
      income.linkedLoanIds = (income.linkedLoanIds || []).filter((loanId) => (
        plan.liabilityItems.some((loan) => String(loan.id || "") === String(loanId || "") && String(loan.linkedAssetId || loan.investmentLink?.linkedAssetId || "") !== "")
      ));
      income.linkedLoanId = income.linkedLoanIds.length === 1 ? String(income.linkedLoanIds[0]) : "";
    });
    return { plan, removedAssetId: id, removedIncomeIds: Array.from(removedIncomeIds) };
  }

  return { upsertRentalProperty, upsertInvestment, upsertHome, linkedRentalRecords, linkedInvestmentRecords, linkedHomeRecords, removeLinkedAsset, investmentCategory };
});
