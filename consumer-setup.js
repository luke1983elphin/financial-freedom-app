(function initConsumerSetup(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSConsumerSetup = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function consumerSetupFactory() {
  "use strict";

  const EXPERIENCE = "consumer-first-v2";
  const COLLECTIONS = ["incomeItems", "assetItems", "liabilityItems", "expenseItems", "goalItems"];
  const PERIODS_PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1 };

  function salaryPresentation(item = {}) {
    const frequency = PERIODS_PER_YEAR[item.frequency] ? item.frequency : "annually";
    const labels = {
      weekly: "Gross pay per week",
      fortnightly: "Gross pay per fortnight",
      monthly: "Gross pay per month",
      quarterly: "Gross pay per quarter",
      annually: "Gross annual salary",
    };
    const amount = Number(item.amount);
    const annualEquivalent = Number.isFinite(amount) ? amount * PERIODS_PER_YEAR[frequency] : 0;
    return {
      frequency,
      label: labels[frequency],
      annualEquivalent,
      showAnnualEquivalent: frequency !== "annually",
    };
  }

  function hasMeaningfulFinancialRecord(plan = {}) {
    const keys = {
      incomeItems: ["amount", "annualAmount"],
      assetItems: ["value"],
      liabilityItems: ["balance", "repayment"],
      expenseItems: ["amount", "annualAmount"],
      goalItems: ["current", "target"],
    };
    return Object.entries(keys).some(([collection, fields]) => (
      Array.isArray(plan[collection])
      && plan[collection].some((item) => fields.some((field) => Number(item?.[field]) > 0))
    ));
  }

  function householdPeople(plan = {}) {
    const personal = plan.personal || {};
    const incomes = Array.isArray(plan.incomeItems) ? plan.incomeItems : [];
    const person2Active = Boolean(
      String(personal.person2Name || "").trim()
      || Number(personal.person2Age) > 0
      || incomes.some((item) => item?.owner === "person2"),
    );
    return person2Active ? ["person1", "person2"] : ["person1"];
  }

  function setupConfirmationState(plan = {}) {
    const confirmations = plan.meta?.setupConfirmations || {};
    const legacy = !usesConsumerFirstSetup(plan);
    const expenses = Array.isArray(plan.expenseItems) ? plan.expenseItems : [];
    const hasSpending = expenses.some((item) => Number(item?.amount ?? item?.annualAmount) > 0)
      || Number(plan.expenses?.livingCosts) > 0;
    const superBalances = {
      person1: Number(plan.assets?.superPerson1) || Number((plan.assetItems || []).find((item) => item?.id === "asset-super-1")?.value) || 0,
      person2: Number(plan.assets?.superPerson2) || Number((plan.assetItems || []).find((item) => item?.id === "asset-super-2")?.value) || 0,
    };
    const people = householdPeople(plan);
    const superConfirmed = people.every((person) => (
      superBalances[person] > 0 || confirmations[`${person}NoSuper`] === true || legacy
    ));
    return {
      spendingConfirmed: hasSpending || confirmations.spendingReviewed === true || legacy,
      superConfirmed,
      superBalances,
      people,
    };
  }

  function markNewPlan(plan = {}) {
    const next = plan;
    next.meta = { ...(next.meta || {}), setupExperience: EXPERIENCE };
    COLLECTIONS.forEach((key) => {
      if (!Array.isArray(next[key])) next[key] = [];
    });
    return next;
  }

  function usesConsumerFirstSetup(plan = {}) {
    return plan?.meta?.setupExperience === EXPERIENCE;
  }

  function shouldCreateLegacyDefaults(plan = {}, collection) {
    if (Array.isArray(plan?.[collection])) return false;
    return !usesConsumerFirstSetup(plan);
  }

  function createItem(action, options = {}) {
    const id = typeof options.makeId === "function" ? options.makeId : (prefix) => `${prefix}-${Date.now()}`;
    const person1Name = String(options.person1Name || "Person 1").trim() || "Person 1";
    const person2Name = String(options.person2Name || "Person 2").trim() || "Person 2";
    const items = {
      "salary-person1": ["incomeItems", { id: id("income"), name: `${person1Name} salary`, type: "salaryWages", owner: "person1", amount: 0, frequency: "fortnightly" }],
      "salary-person2": ["incomeItems", { id: id("income"), name: `${person2Name} salary`, type: "salaryWages", owner: "person2", amount: 0, frequency: "fortnightly" }],
      "other-income": ["incomeItems", { id: id("income"), name: "Other income", type: "other", owner: "person1", amount: 0, frequency: "annually", isPassiveIncome: false }],
      home: ["assetItems", { id: id("asset"), name: "Your home", category: "home", value: 0 }],
      cash: ["assetItems", { id: id("asset"), name: "Cash and savings", category: "cash", value: 0 }],
      "other-asset": ["assetItems", { id: id("asset"), name: "Other asset", category: "other", value: 0 }],
      "home-loan": ["liabilityItems", { id: id("liability"), name: "Home loan", type: "homeLoan", balance: 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0 }],
      "investment-loan": ["liabilityItems", { id: id("liability"), name: "Investment loan", type: "investmentLoan", balance: 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0, investmentAssetCategory: "shares" }],
      "personal-loan": ["liabilityItems", { id: id("liability"), name: "Personal or car loan", type: "personalLoan", balance: 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0 }],
      "other-debt": ["liabilityItems", { id: id("liability"), name: "Other debt", type: "otherDebt", balance: 0, interestRatePct: 0, repayment: 0, repaymentFrequency: "monthly", termYears: 0 }],
      "household-spending": ["expenseItems", { id: id("expense"), name: "Household living costs", category: "living", amount: 0, frequency: "monthly" }],
      "another-expense": ["expenseItems", { id: id("expense"), name: "Household expense", category: "other", amount: 0, frequency: "monthly" }],
      "goal-retire": ["goalItems", { id: id("goal"), name: "Retire or reduce work", goalType: "retirementIntent" }],
      "goal-investments": ["goalItems", { id: id("goal"), name: "Build investments", current: 0, target: 0 }],
      "goal-home-loan": ["goalItems", { id: id("goal"), name: "Repay home loan", goalType: "homeLoanPayoff", linkedLiabilityId: "" }],
      "goal-emergency": ["goalItems", { id: id("goal"), name: "Emergency fund", current: 0, target: 0 }],
      "goal-purchase": ["goalItems", { id: id("goal"), name: "Major purchase", current: 0, target: 0 }],
      "goal-other": ["goalItems", { id: id("goal"), name: "Other goal", current: 0, target: 0 }],
    };
    const entry = items[action];
    return entry ? { collection: entry[0], item: entry[1] } : null;
  }

  function hasMeaningfulEdit(plan = {}) {
    const personal = plan.personal || {};
    if ([personal.person1Name, personal.person2Name].some((value) => String(value || "").trim())) return true;
    if ([personal.person1Age, personal.person2Age].some((value) => Number(value) > 0)) return true;
    const keys = { incomeItems: ["amount"], assetItems: ["value"], liabilityItems: ["balance", "repayment"], expenseItems: ["amount"], goalItems: ["current", "target"] };
    return Object.entries(keys).some(([collection, fields]) => Array.isArray(plan[collection]) && plan[collection].some((item) => fields.some((field) => Number(item?.[field]) > 0)));
  }

  return {
    EXPERIENCE,
    COLLECTIONS,
    markNewPlan,
    usesConsumerFirstSetup,
    shouldCreateLegacyDefaults,
    createItem,
    hasMeaningfulEdit,
    hasMeaningfulFinancialRecord,
    householdPeople,
    salaryPresentation,
    setupConfirmationState,
  };
});
