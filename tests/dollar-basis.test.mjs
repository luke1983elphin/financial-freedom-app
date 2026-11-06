import test from "node:test";
import assert from "node:assert/strict";
import "../dollar-basis.js";

const { displayedValue, valueInTodaysDollars } = globalThis.FFSDollarBasis;

test("the switch changes only displayed amounts, not nominal results", () => {
  const forecast = 2_000_000;
  assert.equal(displayedValue(forecast, 20, 2.8, "future"), forecast);
  assert.ok(Math.abs(displayedValue(forecast, 20, 2.8, "today") - forecast / 1.028 ** 20) < 0.001);
  assert.equal(forecast, 2_000_000);
});

test("each projection year receives its own inflation adjustment", () => {
  assert.equal(valueInTodaysDollars(1000, 0, 3), 1000);
  assert.ok(Math.abs(valueInTodaysDollars(1030, 1, 3) - 1000) < 0.0001);
  assert.ok(Math.abs(valueInTodaysDollars(1060.9, 2, 3) - 1000) < 0.0001);
});

test("negative values, zero inflation, and an invalid inflation denominator remain safe", () => {
  assert.ok(Math.abs(displayedValue(-1030, 1, 3, "today") + 1000) < 0.0001);
  assert.equal(displayedValue(4321, 30, 0, "today"), 4321);
  assert.equal(displayedValue(4321, 30, -100, "today"), 4321);
});
