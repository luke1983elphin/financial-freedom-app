(function initPlanSelectors(root, factory) {
  const api = factory(root.FFSPlanSchema || (typeof require === "function" ? require("./plan-schema.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSPlanSelectors = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function planSelectorsFactory(SCHEMA) {
  "use strict";
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const annual = (item) => SCHEMA.annual(item.amount ?? item.annualAmount, item.frequency || "annually");
  const byId = (items, id) => (items || []).find((item) => String(item.id) === String(id));

  function people(plan) { return copy((plan.people || []).filter((person) => person.active !== false)); }
  function incomes(plan, ownerId) { return copy((plan.incomeItems || []).filter((item) => !ownerId || item.owner === ownerId)); }
  function employmentIncome(plan, ownerId) { return incomes(plan, ownerId).filter((item) => item.type === "salaryWages"); }
  function annualEmploymentIncome(plan, ownerId) { return employmentIncome(plan, ownerId).reduce((sum, item) => sum + annual(item), 0); }
  function assets(plan, categories) { const allowed = categories ? new Set([].concat(categories)) : null; return copy((plan.assetItems || []).filter((item) => !allowed || allowed.has(item.category))); }
  function liabilities(plan, types) { const allowed = types ? new Set([].concat(types)) : null; return copy((plan.liabilityItems || []).filter((item) => !allowed || allowed.has(item.type))); }
  function relationships(plan, type) { return copy((plan.relationships || []).filter((item) => !type || item.type === type)); }
  function linkedTo(plan, entityType, id, relationshipType) {
    const maps = SCHEMA.entityMaps(plan);
    return (plan.relationships || []).filter((rel) => (!relationshipType || rel.type === relationshipType) && rel.fromEntityType === entityType && rel.fromId === id)
      .map((rel) => copy(maps[rel.toEntityType]?.get(rel.toId))).filter(Boolean);
  }
  function rentalProperties(plan) {
    return assets(plan, ["rentalInvestmentProperty", "rentalProperty"]).map((asset) => ({
      asset,
      income: linkedTo(plan, "asset", asset.id, "asset-income"),
      liabilities: linkedTo(plan, "asset", asset.id, "asset-liability"),
    }));
  }
  function investmentAssets(plan) { return assets(plan, ["shares", "managedFunds", "crypto", "investmentProperty", "rentalInvestmentProperty"]); }
  function accessibleInvestments(plan) { return assets(plan, ["cash", "offset", "shares", "managedFunds", "crypto"]); }
  function superBalances(plan) { return assets(plan, "super").map((asset) => ({ ownerId: asset.owner || (asset.id === "asset-super-2" ? "person2" : "person1"), assetId: asset.id, value: number(asset.value) })); }
  function linkedDebt(plan, assetId) { return linkedTo(plan, "asset", assetId, "asset-liability"); }
  function owner(plan, ownerId) { return ownerId === "joint" ? { id: "joint", name: "Joint" } : copy(byId(plan.people, ownerId) || null); }
  return { people, incomes, employmentIncome, annualEmploymentIncome, assets, liabilities, relationships, linkedTo, rentalProperties, investmentAssets, accessibleInvestments, superBalances, linkedDebt, owner };
});
