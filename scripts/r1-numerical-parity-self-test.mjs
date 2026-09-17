import assert from "node:assert/strict";
import test from "node:test";

import {
  readMetric,
  resolveComparisonSamples,
} from "./r1-numerical-parity.mjs";

const numericDefinition = { label: "requiredMetric", path: ["requiredMetric"], type: "number" };

test("strict parity metric validation accepts real finite numbers", () => {
  assert.equal(readMetric({ requiredMetric: 42 }, numericDefinition), 42);
  assert.equal(readMetric({ nested: { value: 7 } }, { label: "nested.value", path: ["nested", "value"], type: "number" }), 7);
});

test("strict parity metric validation rejects coercible and non-finite values", () => {
  for (const value of ["", false, "123", Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => readMetric({ requiredMetric: value }, numericDefinition),
      /not a finite numeric value/,
      `value ${String(value)} should not be accepted as a required numeric metric`,
    );
  }
});

test("strict parity metric validation rejects missing required paths", () => {
  assert.throws(
    () => readMetric({ present: 1 }, numericDefinition),
    /Missing required metric path: requiredMetric/,
  );
  assert.throws(
    () => readMetric({ nested: null }, { label: "nested.value", path: ["nested", "value"], type: "number" }),
    /Missing required metric path: nested\.value/,
  );
});

test("strict parity sample validation rejects selected samples missing from either side", () => {
  const baselineData = { samplePlans: [{ id: "known-sample", plan: { value: 1 } }] };
  const candidateData = { samplePlans: [{ id: "known-sample", plan: { value: 1 } }, { id: "candidate-only", plan: { value: 2 } }] };

  assert.throws(
    () => resolveComparisonSamples(baselineData, candidateData, ["candidate-only"]),
    /Selected sample ID not found in baseline: candidate-only/,
  );
  assert.throws(
    () => resolveComparisonSamples(baselineData, candidateData, ["missing-everywhere"]),
    /Selected sample ID not found in baseline: missing-everywhere/,
  );
});

test("strict parity sample validation rejects implicit sample-set differences and input-plan drift", () => {
  assert.throws(
    () => resolveComparisonSamples(
      { samplePlans: [{ id: "a", plan: { amount: 1 } }] },
      { samplePlans: [{ id: "a", plan: { amount: 1 } }, { id: "b", plan: { amount: 2 } }] },
    ),
    /Sample ID sets differ/,
  );
  assert.throws(
    () => resolveComparisonSamples(
      { samplePlans: [{ id: "a", plan: { amount: 1 } }] },
      { samplePlans: [{ id: "a", plan: { amount: 2 } }] },
    ),
    /Input plan data differs for sample a/,
  );
});
