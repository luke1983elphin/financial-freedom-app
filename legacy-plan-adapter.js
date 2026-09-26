(function initLegacyPlanAdapter(root, factory) {
  const api = factory(root.FFSPlanSchema || (typeof require === "function" ? require("./plan-schema.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSLegacyPlanAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function legacyPlanAdapterFactory(SCHEMA) {
  "use strict";
  function toCalculationPlan(input, projector) {
    const canonical = SCHEMA.migrate(input || {}).plan;
    const projection = SCHEMA.clone(canonical);
    const result = typeof projector === "function" ? projector(projection) : projection;
    return result || projection;
  }
  function importLegacy(input) {
    return SCHEMA.migrate(input || {});
  }
  return { toCalculationPlan, importLegacy };
});
