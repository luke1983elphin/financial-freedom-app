(function initPlanSchema(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSPlanSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function planSchemaFactory() {
  "use strict";

  const SCHEMA_VERSION = 3;
  const MEMBER_IDS = ["person1", "person2"];
  const COLLECTIONS = ["incomeItems", "assetItems", "liabilityItems", "expenseItems", "goalItems"];
  const PERIODS = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1, annual: 1, "one-off": 1 };
  const RELATIONSHIP_CONTRACTS = Object.freeze({
    "asset-income": Object.freeze({ from: Object.freeze(["asset"]), to: Object.freeze(["income"]) }),
    "asset-liability": Object.freeze({ from: Object.freeze(["asset"]), to: Object.freeze(["liability"]) }),
    "goal-target": Object.freeze({ from: Object.freeze(["goal"]), to: Object.freeze(["asset", "liability"]) }),
  });

  const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const text = (value) => String(value ?? "").trim();
  const annual = (value, frequency) => number(value) * (PERIODS[frequency] || 1);
  const makeId = (prefix, index) => `${prefix}-${index + 1}`;

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function hash(value) {
    const source = stableStringify(value);
    let result = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      result ^= source.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return `rev-${(result >>> 0).toString(16).padStart(8, "0")}`;
  }

  function financialContent(plan) {
    const next = clone(plan);
    if (next.meta) {
      delete next.meta.updatedAt;
      delete next.meta.revision;
      delete next.meta.lastSavedAt;
    }
    delete next.revision;
    return next;
  }

  function revisionHash(plan) {
    return hash(financialContent(plan));
  }

  function ensurePeople(plan) {
    const personal = plan.personal || {};
    const existing = Array.isArray(plan.people) ? plan.people : [];
    const byLegacy = new Map(existing.map((person) => [person.legacyKey || person.id, person]));
    plan.people = MEMBER_IDS.map((id, index) => {
      const prior = byLegacy.get(id) || {};
      const suffix = index + 1;
      return {
        ...prior,
        id: text(prior.id) || id,
        legacyKey: id,
        name: text(prior.name) || text(personal[`person${suffix}Name`]) || `Person ${suffix}`,
        age: number(prior.age || personal[`person${suffix}Age`]),
        active: index === 0 || Boolean(text(personal.person2Name) || number(personal.person2Age) || existing.some((item) => item.legacyKey === "person2")),
      };
    });
  }

  function uniqueIds(items, prefix, repairs) {
    const used = new Set();
    return items.map((item, index) => {
      let id = text(item?.id) || makeId(prefix, index);
      if (used.has(id)) {
        const base = id;
        let suffix = 2;
        while (used.has(`${base}-${suffix}`)) suffix += 1;
        id = `${base}-${suffix}`;
        repairs.push(`Assigned unique ID ${id} to duplicate ${prefix} record.`);
      }
      used.add(id);
      return { ...(item || {}), id };
    });
  }

  function duplicateIds(items = []) {
    const seen = new Set();
    const duplicates = new Set();
    items.forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    });
    return duplicates;
  }

  function relationshipErrors(relationship, maps) {
    const errors = [];
    const contract = RELATIONSHIP_CONTRACTS[relationship?.type];
    const id = relationship?.id || "without ID";
    if (!contract) {
      errors.push(`Relationship ${id} has unknown type ${text(relationship?.type) || "(missing)"}.`);
      return errors;
    }
    if (!contract.from.includes(relationship.fromEntityType) || !contract.to.includes(relationship.toEntityType)) {
      errors.push(`Relationship ${id} has incompatible ${relationship.type} endpoints ${text(relationship.fromEntityType) || "(missing)"} -> ${text(relationship.toEntityType) || "(missing)"}.`);
    }
    if (maps) {
      if (!maps[relationship.fromEntityType]?.has(relationship.fromId)) errors.push(`Relationship ${id} has missing source ${text(relationship.fromId) || "(missing)"}.`);
      if (!maps[relationship.toEntityType]?.has(relationship.toId)) errors.push(`Relationship ${id} has missing target ${text(relationship.toId) || "(missing)"}.`);
    }
    return errors;
  }

  function validateRelationship(relationship, planOrMaps) {
    const maps = planOrMaps && !planOrMaps.assetItems ? planOrMaps : entityMaps(planOrMaps || {});
    const errors = relationshipErrors(relationship, maps);
    return { valid: errors.length === 0, errors };
  }

  function clearAmbiguousCompatibilityReferences(plan, ambiguous, repairs) {
    const ambiguousAssets = ambiguous.asset;
    const ambiguousLiabilities = ambiguous.liability;
    const clearAssetLink = (item, collection) => {
      if (ambiguousAssets.has(text(item.linkedAssetId))) {
        repairs.push(`Cleared ambiguous asset link ${item.linkedAssetId} from ${collection}/${item.id}; explicit relinking is required.`);
        delete item.linkedAssetId;
      }
      if (ambiguousAssets.has(text(item.investmentLink?.linkedAssetId))) {
        repairs.push(`Cleared ambiguous investment asset link ${item.investmentLink.linkedAssetId} from ${collection}/${item.id}; explicit relinking is required.`);
        item.investmentLink = { ...item.investmentLink };
        delete item.investmentLink.linkedAssetId;
      }
    };
    plan.incomeItems.forEach((item) => clearAssetLink(item, "incomeItems"));
    plan.liabilityItems.forEach((item) => clearAssetLink(item, "liabilityItems"));
    plan.goalItems.forEach((item) => {
      clearAssetLink(item, "goalItems");
      if (ambiguousLiabilities.has(text(item.linkedLiabilityId))) {
        repairs.push(`Cleared ambiguous liability link ${item.linkedLiabilityId} from goalItems/${item.id}; explicit relinking is required.`);
        delete item.linkedLiabilityId;
      }
    });
  }

  function repairGoalTargetCardinality(plan, repairs) {
    plan.goalItems.forEach((goal) => {
      if (goal.linkedAssetId && goal.linkedLiabilityId) {
        repairs.push(`Goal ${goal.id} referenced both an asset and a liability; retained the liability target and cleared the asset target.`);
        delete goal.linkedAssetId;
      }
    });
    const byGoal = new Map();
    plan.relationships.forEach((relationship) => {
      if (relationship.type !== "goal-target") return;
      if (!byGoal.has(relationship.fromId)) byGoal.set(relationship.fromId, []);
      byGoal.get(relationship.fromId).push(relationship);
    });
    byGoal.forEach((relationships, goalId) => {
      if (relationships.length < 2) return;
      const goal = plan.goalItems.find((item) => item.id === goalId);
      const expectedType = goal?.linkedLiabilityId ? "liability" : goal?.linkedAssetId ? "asset" : "";
      const expectedId = goal?.linkedLiabilityId || goal?.linkedAssetId || "";
      const matching = relationships.filter((item) => item.toEntityType === expectedType && item.toId === expectedId);
      const keep = matching.length === 1 ? matching[0] : null;
      plan.relationships = plan.relationships.filter((item) => item.type !== "goal-target" || item.fromId !== goalId || item === keep);
      if (!keep && goal) {
        delete goal.linkedAssetId;
        delete goal.linkedLiabilityId;
      }
      repairs.push(keep
        ? `Removed superseded goal targets for ${goalId}; retained ${keep.toEntityType}/${keep.toId}.`
        : `Removed ambiguous goal targets for ${goalId}; explicit relinking is required.`);
    });
  }

  function legacyCollections(plan) {
    const income = plan.income || {};
    const assets = plan.assets || {};
    const liabilities = plan.liabilities || {};
    const expenses = plan.expenses || {};
    if (!Array.isArray(plan.incomeItems)) plan.incomeItems = [
      { id: "income-person-1", name: income.person1IncomeName || "Person 1 income", type: "salaryWages", owner: "person1", amount: number(income.person1Income), frequency: income.person1Frequency || "annually" },
      { id: "income-person-2", name: income.person2IncomeName || "Person 2 income", type: "salaryWages", owner: "person2", amount: number(income.person2Income), frequency: income.person2Frequency || "annually" },
      { id: "income-other", name: income.otherIncomeName || "Other income", type: "other", owner: "joint", amount: number(income.otherIncome), frequency: income.otherIncomeFrequency || "annually" },
    ];
    if (!Array.isArray(plan.assetItems)) plan.assetItems = [
      { id: "asset-home", name: "Home", category: "home", value: number(assets.homeValue), owner: "joint" },
      { id: "asset-other-property", name: "Other property", category: "otherProperty", value: number(assets.otherPropertyValue), owner: "joint" },
      { id: "asset-offset", name: "Offset account", category: "offset", value: number(assets.offsetBalance), owner: "joint" },
      { id: "asset-cash", name: "Cash", category: "cash", value: number(assets.cash), owner: "joint" },
      { id: "asset-shares", name: "Shares / ETFs", category: "shares", value: number(assets.sharesEtfs), owner: "joint" },
      { id: "asset-crypto", name: "Crypto", category: "crypto", value: number(assets.crypto), owner: "joint" },
      { id: "asset-super-1", name: "Person 1 super", category: "super", value: number(assets.superPerson1), owner: "person1" },
      { id: "asset-super-2", name: "Person 2 super", category: "super", value: number(assets.superPerson2), owner: "person2" },
      { id: "asset-vehicles", name: "Vehicles / personal assets", category: "vehicle", value: number(assets.vehiclesPersonalAssets), owner: "joint" },
    ];
    if (!Array.isArray(plan.liabilityItems)) plan.liabilityItems = [
      { id: "liability-home-loan", name: "Home loan", type: "homeLoan", balance: number(liabilities.homeLoanBalance), interestRatePct: number(liabilities.homeLoanInterestRatePct), repayment: number(liabilities.monthlyRepayment || expenses.mortgageRepayments), repaymentFrequency: "monthly", termYears: number(liabilities.remainingLoanTermYears), linkedAssetId: "asset-home" },
      { id: "liability-other", name: "Other debts", type: "otherDebt", balance: number(liabilities.otherDebts), owner: "joint" },
    ];
    if (!Array.isArray(plan.expenseItems)) plan.expenseItems = [
      { id: "expense-living", name: "Living costs", category: "living", amount: number(expenses.livingCosts), frequency: expenses.livingFrequency || "annually" },
      { id: "expense-food", name: "Food", category: "food", amount: number(expenses.food), frequency: expenses.foodFrequency || "annually" },
      { id: "expense-utilities", name: "Utilities", category: "utilities", amount: number(expenses.utilities), frequency: expenses.utilitiesFrequency || "annually" },
      { id: "expense-insurance", name: "Insurance", category: "insurance", amount: number(expenses.insurance), frequency: expenses.insuranceFrequency || "annually" },
      { id: "expense-other", name: "Other expenses", category: "other", amount: number(expenses.otherExpenses), frequency: expenses.otherFrequency || "annually" },
    ];
    if (!Array.isArray(plan.goalItems)) plan.goalItems = [];
  }

  function relationshipKey(relationship) {
    return [relationship.type, relationship.fromEntityType, relationship.fromId, relationship.toEntityType, relationship.toId].join("|");
  }

  function deriveRelationships(plan) {
    const derived = [];
    const add = (type, fromEntityType, fromId, toEntityType, toId, source = "migration") => {
      if (!fromId || !toId) return;
      derived.push({ id: `rel-${hash({ type, fromEntityType, fromId, toEntityType, toId }).slice(4)}`, type, fromEntityType, fromId, toEntityType, toId, source });
    };
    plan.liabilityItems.forEach((item) => add("asset-liability", "asset", item.linkedAssetId || item.investmentLink?.linkedAssetId, "liability", item.id));
    plan.incomeItems.forEach((item) => add("asset-income", "asset", item.linkedAssetId, "income", item.id));
    plan.goalItems.forEach((item) => add("goal-target", "goal", item.id, item.linkedLiabilityId ? "liability" : "asset", item.linkedLiabilityId || item.linkedAssetId));
    const existing = Array.isArray(plan.relationships) ? plan.relationships : [];
    const unique = new Map();
    [...existing, ...derived].forEach((relationship) => {
      const normalized = { ...relationship, id: text(relationship.id) || `rel-${hash(relationship).slice(4)}` };
      unique.set(relationshipKey(normalized), normalized);
    });
    plan.relationships = [...unique.values()];
  }

  function migrate(input, options = {}) {
    const plan = clone(input);
    const repairs = [];
    plan.planSchemaVersion = SCHEMA_VERSION;
    plan.meta = { ...(plan.meta || {}), schemaVersion: SCHEMA_VERSION };
    ensurePeople(plan);
    legacyCollections(plan);
    const ambiguous = {
      income: duplicateIds(plan.incomeItems),
      asset: duplicateIds(plan.assetItems),
      liability: duplicateIds(plan.liabilityItems),
      expense: duplicateIds(plan.expenseItems),
      goal: duplicateIds(plan.goalItems),
    };
    const importedRelationships = Array.isArray(plan.relationships) ? plan.relationships : [];
    plan.relationships = importedRelationships.filter((relationship) => {
      const ambiguousSource = ambiguous[relationship.fromEntityType]?.has(text(relationship.fromId));
      const ambiguousTarget = ambiguous[relationship.toEntityType]?.has(text(relationship.toId));
      if (ambiguousSource || ambiguousTarget) repairs.push(`Removed ambiguous relationship ${relationship.id || "without ID"}; duplicate endpoint IDs require explicit relinking.`);
      return !ambiguousSource && !ambiguousTarget;
    });
    plan.incomeItems = uniqueIds(plan.incomeItems, "income", repairs);
    plan.assetItems = uniqueIds(plan.assetItems, "asset", repairs);
    plan.liabilityItems = uniqueIds(plan.liabilityItems, "liability", repairs);
    plan.expenseItems = uniqueIds(plan.expenseItems, "expense", repairs);
    plan.goalItems = uniqueIds(plan.goalItems, "goal", repairs);
    clearAmbiguousCompatibilityReferences(plan, ambiguous, repairs);
    repairGoalTargetCardinality(plan, repairs);
    const validOwners = new Set([...plan.people.map((person) => person.id), "joint"]);
    ["incomeItems", "assetItems", "liabilityItems"].forEach((collection) => {
      plan[collection] = plan[collection].map((item) => {
        if (!item.owner || validOwners.has(item.owner)) return item;
        repairs.push(`Repaired invalid owner on ${collection}/${item.id}.`);
        return { ...item, owner: "joint" };
      });
    });
    deriveRelationships(plan);
    repairGoalTargetCardinality(plan, repairs);
    const relationshipMaps = entityMaps(plan);
    plan.relationships = plan.relationships.filter((relationship) => {
      const errors = relationshipErrors(relationship, relationshipMaps);
      if (errors.length) repairs.push(`Removed invalid relationship ${relationship.id || "without ID"}; ${errors.join(" ")} Source records were retained.`);
      return errors.length === 0;
    });
    const currentHash = revisionHash(plan);
    const previous = plan.meta.revision || plan.revision || {};
    plan.meta.revision = {
      number: Math.max(1, number(previous.number) || 1),
      hash: text(previous.hash) || currentHash,
      updatedAt: previous.updatedAt || plan.meta.updatedAt || options.now || new Date().toISOString(),
    };
    delete plan.revision;
    const validation = validate(plan);
    return { plan, report: { fromVersion: number(input?.planSchemaVersion || input?.meta?.schemaVersion), toVersion: SCHEMA_VERSION, repairs, ...validation } };
  }

  function entityMaps(plan) {
    return {
      person: new Map((plan.people || []).map((item) => [item.id, item])),
      income: new Map((plan.incomeItems || []).map((item) => [item.id, item])),
      asset: new Map((plan.assetItems || []).map((item) => [item.id, item])),
      liability: new Map((plan.liabilityItems || []).map((item) => [item.id, item])),
      expense: new Map((plan.expenseItems || []).map((item) => [item.id, item])),
      goal: new Map((plan.goalItems || []).map((item) => [item.id, item])),
    };
  }

  function validate(input) {
    const plan = input || {};
    const errors = [];
    const warnings = [];
    const maps = entityMaps(plan);
    COLLECTIONS.forEach((collection) => {
      const seen = new Set();
      (plan[collection] || []).forEach((item) => {
        if (!text(item.id)) errors.push(`${collection} contains a record without an ID.`);
        else if (seen.has(item.id)) errors.push(`${collection} contains duplicate ID ${item.id}.`);
        seen.add(item.id);
      });
    });
    const owners = maps.person;
    ["incomeItems", "assetItems", "liabilityItems"].forEach((collection) => (plan[collection] || []).forEach((item) => {
      if (item.owner && item.owner !== "joint" && !owners.has(item.owner)) errors.push(`${collection}/${item.id} references missing owner ${item.owner}.`);
    }));
    (plan.relationships || []).forEach((relationship) => {
      errors.push(...relationshipErrors(relationship, maps));
    });
    const goalTargets = new Map();
    (plan.relationships || []).filter((item) => item.type === "goal-target").forEach((relationship) => {
      goalTargets.set(relationship.fromId, (goalTargets.get(relationship.fromId) || 0) + 1);
    });
    goalTargets.forEach((count, goalId) => { if (count > 1) errors.push(`Goal ${goalId} has more than one target relationship.`); });
    if (number(plan.planSchemaVersion) !== SCHEMA_VERSION) warnings.push(`Plan schema version is not ${SCHEMA_VERSION}.`);
    return { valid: errors.length === 0, errors, warnings };
  }

  function commitRevision(input, now = new Date().toISOString()) {
    const plan = input;
    plan.meta = plan.meta || {};
    const nextHash = revisionHash(plan);
    const prior = plan.meta.revision || {};
    if (prior.hash !== nextHash) {
      plan.meta.revision = { number: Math.max(0, number(prior.number)) + 1, hash: nextHash, updatedAt: now };
    }
    return plan.meta.revision;
  }

  return { SCHEMA_VERSION, MEMBER_IDS, COLLECTIONS, RELATIONSHIP_CONTRACTS, annual, clone, hash, stableStringify, revisionHash, migrate, validate, validateRelationship, deriveRelationships, commitRevision, entityMaps };
});
