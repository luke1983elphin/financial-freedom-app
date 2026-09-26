(function initPlanMutations(root, factory) {
  const api = factory(root.FFSPlanSchema || (typeof require === "function" ? require("./plan-schema.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSPlanMutations = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function planMutationsFactory(SCHEMA) {
  "use strict";
  const MAP = { income: "incomeItems", asset: "assetItems", liability: "liabilityItems", expense: "expenseItems", goal: "goalItems" };
  const clone = SCHEMA.clone;
  const text = (value) => String(value ?? "").trim();
  function canonical(input) { return SCHEMA.migrate(input).plan; }
  function entityTypeForCollection(collection) { return Object.entries(MAP).find(([, key]) => key === collection)?.[0]; }
  function upsert(input, collection, record) {
    const plan = canonical(input);
    if (!Object.values(MAP).includes(collection)) throw new Error(`Unsupported canonical collection: ${collection}`);
    if (!text(record?.id)) throw new Error("Canonical records require a stable ID.");
    const index = plan[collection].findIndex((item) => item.id === record.id);
    if (index >= 0) plan[collection][index] = { ...plan[collection][index], ...clone(record) };
    else plan[collection].push(clone(record));
    const entityType = entityTypeForCollection(collection);
    if (entityType === "income") plan.relationships = plan.relationships.filter((rel) => !(rel.type === "asset-income" && rel.toId === record.id));
    if (entityType === "liability") plan.relationships = plan.relationships.filter((rel) => !(rel.type === "asset-liability" && rel.toId === record.id));
    if (entityType === "goal") plan.relationships = plan.relationships.filter((rel) => !(rel.type === "goal-target" && rel.fromId === record.id));
    SCHEMA.deriveRelationships(plan);
    return plan;
  }
  function link(input, relationship) {
    const plan = canonical(input);
    const rel = { ...clone(relationship) };
    if (!rel.id) rel.id = `rel-${SCHEMA.hash(rel).slice(4)}`;
    const check = SCHEMA.validateRelationship(rel, plan);
    if (!check.valid) throw new Error(check.errors[0]);
    if (rel.type === "goal-target") {
      plan.relationships = plan.relationships.filter((item) => !(item.type === "goal-target" && item.fromId === rel.fromId));
      const goal = plan.goalItems.find((item) => item.id === rel.fromId);
      if (goal) {
        delete goal.linkedAssetId;
        delete goal.linkedLiabilityId;
      }
    }
    plan.relationships = plan.relationships.filter((item) => item.id !== rel.id);
    plan.relationships.push(rel);
    if (rel.type === "asset-liability") {
      const liability = plan.liabilityItems.find((item) => item.id === rel.toId);
      if (liability) liability.linkedAssetId = rel.fromId;
    }
    if (rel.type === "asset-income") {
      const income = plan.incomeItems.find((item) => item.id === rel.toId);
      if (income) income.linkedAssetId = rel.fromId;
    }
    if (rel.type === "goal-target") {
      const goal = plan.goalItems.find((item) => item.id === rel.fromId);
      if (goal) goal[rel.toEntityType === "liability" ? "linkedLiabilityId" : "linkedAssetId"] = rel.toId;
    }
    return plan;
  }
  function unlink(input, relationshipId) {
    const plan = canonical(input);
    const rel = plan.relationships.find((item) => item.id === relationshipId);
    plan.relationships = plan.relationships.filter((item) => item.id !== relationshipId);
    if (rel?.type === "asset-liability") {
      const liability = plan.liabilityItems.find((item) => item.id === rel.toId);
      if (liability?.linkedAssetId === rel.fromId) delete liability.linkedAssetId;
    }
    if (rel?.type === "asset-income") {
      const income = plan.incomeItems.find((item) => item.id === rel.toId);
      if (income?.linkedAssetId === rel.fromId) delete income.linkedAssetId;
    }
    if (rel?.type === "goal-target") {
      const goal = plan.goalItems.find((item) => item.id === rel.fromId);
      if (goal) {
        if (rel.toEntityType === "asset" && goal.linkedAssetId === rel.toId) delete goal.linkedAssetId;
        if (rel.toEntityType === "liability" && goal.linkedLiabilityId === rel.toId) delete goal.linkedLiabilityId;
      }
    }
    return plan;
  }
  function remove(input, collection, id, options = {}) {
    const plan = canonical(input);
    const entityType = entityTypeForCollection(collection);
    if (!entityType) throw new Error(`Unsupported canonical collection: ${collection}`);
    const touching = plan.relationships.filter((rel) => (rel.fromEntityType === entityType && rel.fromId === id) || (rel.toEntityType === entityType && rel.toId === id));
    if (touching.length && options.onLinked === "reject") throw new Error(`Cannot remove ${id} while linked relationships exist.`);
    plan[collection] = plan[collection].filter((item) => item.id !== id);
    plan.relationships = plan.relationships.filter((rel) => !touching.includes(rel));
    if (entityType === "asset") {
      plan.incomeItems.forEach((item) => { if (item.linkedAssetId === id) delete item.linkedAssetId; });
      plan.liabilityItems.forEach((item) => { if (item.linkedAssetId === id) delete item.linkedAssetId; });
      plan.goalItems.forEach((item) => { if (item.linkedAssetId === id) delete item.linkedAssetId; });
    }
    if (entityType === "liability") plan.goalItems.forEach((item) => { if (item.linkedLiabilityId === id) delete item.linkedLiabilityId; });
    return plan;
  }
  function updateOwnership(input, collection, id, ownerId) {
    const plan = canonical(input);
    const valid = new Set([...plan.people.map((person) => person.id), "joint"]);
    if (!valid.has(ownerId)) throw new Error(`Unknown household member: ${ownerId}`);
    const item = plan[collection]?.find((record) => record.id === id);
    if (!item) throw new Error(`Missing record: ${id}`);
    item.owner = ownerId;
    return plan;
  }
  return { upsert, remove, link, unlink, updateOwnership, canonical };
});
