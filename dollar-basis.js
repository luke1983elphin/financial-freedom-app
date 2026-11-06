(function attachDollarBasis(root) {
  "use strict";

  // Convert a nominal future amount to its purchasing power in base-year dollars.
  // This is a display-only operation: financial projections must remain nominal.
  function valueInTodaysDollars(amount, years, inflationPct) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return 0;
    const horizon = Math.max(0, Number(years) || 0);
    const rate = Number(inflationPct) / 100;
    if (!Number.isFinite(rate) || rate <= -1) return numeric;
    return numeric / Math.pow(1 + rate, horizon);
  }

  function displayedValue(amount, years, inflationPct, basis) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return 0;
    return basis === "today" ? valueInTodaysDollars(numeric, years, inflationPct) : numeric;
  }

  root.FFSDollarBasis = Object.freeze({ valueInTodaysDollars, displayedValue });
})(typeof window !== "undefined" ? window : globalThis);
