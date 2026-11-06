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

  function calendarHorizon(calendarYear, inputs = {}, rows = []) {
    const base = Number(inputs?.projectionStartYear ?? inputs?.assumptions?.projectionStartYear ?? rows[0]?.calendarYear);
    const year = Number(calendarYear);
    return Number.isFinite(base) && Number.isFinite(year) ? Math.max(0, year - base) : 0;
  }

  function convertedFields(object, fields, years, inflationPct, basis) {
    if (!object) return object;
    const copy = { ...object };
    for (const field of fields) {
      // Unknown balances must remain unknown, not become zero dollars.
      if (object[field] != null) copy[field] = displayedValue(object[field], years, inflationPct, basis);
    }
    return copy;
  }

  function annualSum(rows, value, inputs, basis) {
    return rows.reduce((sum, row) => sum + displayedValue(value(row),
      row.yearIndex ?? calendarHorizon(row.calendarYear, inputs, rows),
      inflationPercent(inputs), basis), 0);
  }

  function inflationPercent(inputs) {
    // Engine inputs store a decimal rate; editable/saved drafts store a percentage.
    return inputs?.inflationRate != null ? Number(inputs.inflationRate) * 100
      : inputs?.assumptions?.inflationRatePct;
  }

  root.FFSDollarBasis = Object.freeze({ valueInTodaysDollars, displayedValue, calendarHorizon, convertedFields, annualSum, inflationPercent });
})(typeof window !== "undefined" ? window : globalThis);
