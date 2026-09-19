(function initScenarioOverlay(root, factory) {
  const api = factory(root.FFSPlanSchema || (typeof require === "function" ? require("./plan-schema.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSScenarioOverlay = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function scenarioOverlayFactory(SCHEMA) {
  "use strict";
  const EVENT_ORDER = ["propertySale", "oneOffIncome", "oneOffExpense", "debtRepayment", "superContribution", "investmentContribution", "retirementTransition", "assumptionChange"];
  const clone = SCHEMA.clone;
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const labels = {
    incomeChange: "Household income",
    expenseChange: "Household expenses",
    loanRepaymentChangeMonthly: "Monthly debt repayment",
    investmentContributionChange: "Investment contributions",
    superContributionChange: "Super contributions",
    extraConcessionalSuperChange: "Concessional super contributions",
    oneOffCosts: "One-off costs",
    oneOffSavings: "One-off savings",
  };
  const LEGACY_CHANGED_INPUT_KEYS = Object.freeze({
    "income": "incomeChange",
    "household income": "incomeChange",
    "expenses": "expenseChange",
    "household expenses": "expenseChange",
    "mortgage repayment": "loanRepaymentChangeMonthly",
    "monthly debt repayment": "loanRepaymentChangeMonthly",
    "loan interest rate": "loanInterestRateChangePct",
    "investment contribution": "investmentContributionChange",
    "investment contributions": "investmentContributionChange",
    "investment return": "investmentReturnChangePct",
    "employer super": "superContributionChange",
    "super contributions": "superContributionChange",
    "additional concessional super": "extraConcessionalSuperChange",
    "concessional super contributions": "extraConcessionalSuperChange",
    "stsl balance": "helpBalanceChange",
    "one-off costs": "oneOffCosts",
    "one-off savings": "oneOffSavings",
    "available surplus allocation": "surplusAllocationTarget",
  });
  function event(id, type, parameters, source = "saved-scenario") { return { id, type, parameters: clone(parameters), source, enabled: true }; }
  function fromDecisionAdjustments(adjustments = {}, source = "decision-engine") {
    const events = [];
    Object.entries(adjustments).forEach(([key, value]) => {
      if (!number(value) && !["surplusAllocationTarget", "surplusAllocationFrequency", "surplusAllocationUseFull"].includes(key)) return;
      let type = "assumptionChange";
      if (key === "oneOffCosts") type = "oneOffExpense";
      if (key === "oneOffSavings") type = "oneOffIncome";
      if (key.includes("loanRepayment")) type = "debtRepayment";
      if (key.includes("investmentContribution")) type = "investmentContribution";
      if (key.includes("super")) type = "superContribution";
      events.push(event(`event-${key}`, type, { key, value }, source));
    });
    return events;
  }
  function parseLegacyChangedValue(row, key) {
    const direct = row?.value;
    if (typeof direct === "number" && Number.isFinite(direct)) return { mapped: true, value: direct };
    if (key === "surplusAllocationTarget") {
      const allocation = String(direct ?? row?.after ?? "").trim().toLowerCase();
      if (allocation === "debt" || allocation === "direct to debt repayment") return { mapped: true, value: "debt" };
      if (allocation === "investments" || allocation === "direct to investments") return { mapped: true, value: "investments" };
      return { mapped: false };
    }
    const raw = String(direct ?? row?.after ?? "").trim();
    const cleaned = raw
      .replace(/\s+(per year|per month)$/i, "")
      .replace(/[%,$£€\s]/g, "");
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)) return { mapped: false };
    const value = Number(cleaned);
    return Number.isFinite(value) ? { mapped: true, value } : { mapped: false };
  }
  function fromLegacyChangedInputs(changedInputs = [], source = "legacy-changed-inputs") {
    const adjustments = {};
    const entries = (Array.isArray(changedInputs) ? changedInputs : []).map((row, index) => {
      const explicitKey = typeof row?.key === "string" && row.key ? row.key : "";
      const key = explicitKey || LEGACY_CHANGED_INPUT_KEYS[String(row?.label || "").trim().toLowerCase()] || "";
      const parsed = key ? parseLegacyChangedValue(row, key) : { mapped: false };
      if (key && parsed.mapped) adjustments[key] = parsed.value;
      return {
        index,
        status: key && parsed.mapped ? "mapped" : "read-only",
        key: key && parsed.mapped ? key : "",
        original: clone(row),
        reason: key ? (parsed.mapped ? "Deterministically mapped from saved value." : "Saved value could not be parsed without guessing.") : "Saved label has no deterministic typed-event mapping.",
      };
    });
    return { events: fromDecisionAdjustments(adjustments, source), entries };
  }
  function toDecisionAdjustments(events = {}, defaults = {}) {
    const next = { ...defaults };
    (Array.isArray(events) ? events : []).filter((item) => item.enabled !== false).forEach((item) => {
      if (item.parameters?.key) next[item.parameters.key] = item.parameters.value;
    });
    return next;
  }
  function sortEvents(events = []) {
    return clone(events).sort((a, b) => {
      const yearA = number(a.effectiveYear ?? a.effectiveAge);
      const yearB = number(b.effectiveYear ?? b.effectiveAge);
      return yearA - yearB || EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || String(a.id).localeCompare(String(b.id));
    });
  }
  function provenance(events = []) {
    return sortEvents(events).filter((item) => item.enabled !== false).map((item) => {
      const key = item.parameters?.key;
      const when = item.effectiveYear != null ? ` in year ${item.effectiveYear}` : item.effectiveAge != null ? ` at age ${item.effectiveAge}` : "";
      return { eventId: item.id, title: labels[key] || item.parameters?.label || item.type, description: `${labels[key] || item.parameters?.label || item.type} changed to ${item.parameters?.value ?? "configured"}${when}.`, ownerId: item.ownerId || "", assetId: item.assetId || "", liabilityId: item.liabilityId || "" };
    });
  }
  function fromRetirementSnapshot(snapshot = {}) {
    const events = [];
    (snapshot.people || []).forEach((person, index) => {
      events.push({ id: `event-retirement-${person.id || index + 1}`, type: "retirementTransition", effectiveAge: person.semiRetirementAge || person.fullRetirementAge, ownerId: person.id || `person${index + 1}`, parameters: { label: `${person.name || `Person ${index + 1}`} retirement timing`, semiRetirementAge: person.semiRetirementAge, fullRetirementAge: person.fullRetirementAge, semiRetirementGrossIncome: person.semiRetirementGrossIncome }, source: "retirement-planning", enabled: true });
    });
    (snapshot.scenario?.oneOffLifestyleEvents || []).forEach((item, index) => events.push({ id: item.id || `event-expense-${index + 1}`, type: "oneOffExpense", effectiveYear: item.year, ownerId: item.ownerId, parameters: { ...clone(item), label: item.description || "One-off expense" }, source: "retirement-planning", enabled: item.enabled !== false }));
    (snapshot.scenario?.oneOffIncomeEvents || []).forEach((item, index) => events.push({ id: item.id || `event-income-${index + 1}`, type: "oneOffIncome", effectiveYear: item.year, ownerId: item.ownerId, parameters: { ...clone(item), label: item.description || "One-off income" }, source: "retirement-planning", enabled: item.enabled !== false }));
    (snapshot.scenario?.plannedConcessionalContributions || []).forEach((item, index) => events.push({ id: item.id || `event-super-${index + 1}`, type: "superContribution", effectiveYear: item.financialYear || item.year, ownerId: item.personId, parameters: { ...clone(item), label: "Planned concessional contribution" }, source: "retirement-planning", enabled: item.enabled !== false }));
    const downsize = snapshot.scenario?.downsizeHomeEvent;
    if (downsize?.enabled) events.push({ id: downsize.id || "event-property-sale", type: "propertySale", effectiveYear: downsize.year, effectiveAge: downsize.age, assetId: downsize.assetId, parameters: { ...clone(downsize), label: "Downsize home" }, source: "retirement-planning", enabled: true });
    return events;
  }
  function migrateScenario(input = {}, basePlan = {}) {
    const scenario = clone(input);
    const adjustmentSource = scenario.overlay?.adjustments
      || scenario.scenarioInputSnapshot?.overlay?.adjustments
      || scenario.adjustments
      || scenario.scenarioInputSnapshot?.adjustments
      || (!Array.isArray(scenario.changedInputs) && scenario.changedInputs && typeof scenario.changedInputs === "object" ? scenario.changedInputs : undefined);
    const legacyChangedInputs = Array.isArray(scenario.changedInputs) ? fromLegacyChangedInputs(scenario.changedInputs) : { events: [], entries: [] };
    const events = Array.isArray(scenario.events)
      ? scenario.events
      : Array.isArray(scenario.overlay?.events)
        ? scenario.overlay.events
      : Array.isArray(scenario.scenarioInputSnapshot?.overlay?.events)
        ? scenario.scenarioInputSnapshot.overlay.events
      : scenario.scenarioType === "retirement" || scenario.engine === "retirement" || scenario.scenarioInputSnapshot?.people
        ? fromRetirementSnapshot(scenario.scenarioInputSnapshot || {})
        : adjustmentSource && typeof adjustmentSource === "object" && !Array.isArray(adjustmentSource)
          ? fromDecisionAdjustments(adjustmentSource, scenario.source || "legacy-scenario")
          : legacyChangedInputs.events;
    const revision = basePlan.meta?.revision || {};
    return {
      ...scenario,
      scenarioSchemaVersion: 1,
      id: scenario.id || `scenario-${SCHEMA.hash(scenario).slice(4)}`,
      engine: scenario.engine || (scenario.scenarioType === "retirement" ? "retirement" : "decision"),
      basePlanRevision: scenario.basePlanRevision || revision.hash || SCHEMA.revisionHash(basePlan),
      assumptions: clone(scenario.assumptions || {}),
      events: sortEvents(events),
      legacyProvenance: scenario.legacyProvenance || (legacyChangedInputs.entries.length ? { changedInputs: legacyChangedInputs.entries } : undefined),
      source: scenario.source || "user",
    };
  }
  function isStale(scenario, plan) { return Boolean(scenario?.basePlanRevision && scenario.basePlanRevision !== (plan?.meta?.revision?.hash || SCHEMA.revisionHash(plan))); }
  function validateReferences(scenario, plan) {
    const maps = SCHEMA.entityMaps(plan);
    const missing = [];
    (scenario.events || []).forEach((item) => {
      [["person", item.ownerId], ["asset", item.assetId], ["liability", item.liabilityId]].forEach(([type, id]) => { if (id && !maps[type]?.has(id)) missing.push({ eventId: item.id, entityType: type, entityId: id }); });
    });
    return { valid: missing.length === 0, missing };
  }
  return { EVENT_ORDER, LEGACY_CHANGED_INPUT_KEYS, fromDecisionAdjustments, fromLegacyChangedInputs, fromRetirementSnapshot, toDecisionAdjustments, sortEvents, provenance, migrateScenario, isStale, validateReferences };
});
