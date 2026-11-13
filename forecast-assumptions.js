(function attachForecastAssumptions(root) {
  "use strict";

  // A read-only adapter over canonical plan fields. This module never mutates a plan,
  // creates replacement defaults, or alters the retirement calculation engine.
  const FIELDS = Object.freeze([
    { id: "investment", key: "expectedInvestmentReturnPct", label: "Investment return", fallback: 7, group: "essential", note: "Fallback for investments without an explicit asset return." },
    { id: "super", key: "expectedSuperReturnPct", label: "Superannuation return", fallback: 6.5, group: "essential", note: "Retirement scenarios can use separate per-person rates." },
    { id: "inflation", key: "inflationPct", label: "Inflation", fallback: 2.5, group: "essential", note: "Used in spending, selected income indexation and purchasing-power presentation." },
    { id: "wages", key: "wageGrowthPct", label: "Wage growth", fallback: 3, group: "advanced", note: "Not applied to wages in the legacy accumulation forecast." },
    { id: "withdrawal", key: "safeWithdrawalRatePct", label: "Illustrative withdrawal rate", fallback: 4, group: "advanced", note: "Used for FI illustrations, not the retirement spending engine." }
  ].map(Object.freeze));

  function resolve(plan) {
    const investing = plan?.investing || {};
    return FIELDS.map(field => {
      const raw = investing[field.key];
      const explicit = raw !== undefined && raw !== null && raw !== "";
      const value = explicit ? Number(raw) : field.fallback;
      return Object.freeze({
        ...field,
        value,
        source: explicit ? "plan" : "app-default",
        valid: Number.isFinite(value)
      });
    });
  }

  function draft(plan) {
    return Object.fromEntries(resolve(plan).map(field => [field.key, field.value]));
  }

  function validate(input) {
    const errors = [];
    for (const field of FIELDS) {
      const value = input?.[field.key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push({ key: field.key, message: "Enter a finite percentage." });
      } else if (field.id === "inflation" && value <= -100) {
        errors.push({ key: field.key, message: "Inflation must exceed -100%." });
      }
    }
    return errors;
  }

  function apply(plan, input) {
    const errors = validate(input);
    if (errors.length) return { ok: false, errors };
    // Only canonical plan fields are updated. The caller remains responsible
    // for using the existing explicit save and plan-validation workflow.
    return {
      ok: true,
      plan: {
        ...plan,
        investing: {
          ...(plan?.investing || {}),
          ...Object.fromEntries(FIELDS.map(field => [field.key, input[field.key]]))
        }
      }
    };
  }

  const api = Object.freeze({ fields: FIELDS, resolve, draft, validate, apply });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSForecastAssumptions = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
