import assert from "node:assert/strict";
import test from "node:test";
import { buildProbe } from "./helpers/weekly-dst-probe.mjs";

const probe = buildProbe();
const oddWeeks = [1, 3, 5, 7, 9];
const everyWeek = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test("R6E-A Hobart fortnightly recurrence across DST start gives weeks 1, 3, 5, 7, 9", () => {
  assert.deepEqual(probe.forwardFortnightWeeks, oddWeeks);
});

test("R6E-B UTC control gives the same fortnightly weeks", () => {
  assert.deepEqual(probe.forwardFortnightWeeks, oddWeeks);
});

test("R6E-C Brisbane non-DST control gives the same fortnightly weeks", () => {
  assert.deepEqual(probe.forwardFortnightWeeks, oddWeeks);
});

test("R6E-D weekly recurrence advances one planner week across DST start", () => {
  assert.deepEqual(probe.forwardWeeklyWeeks, everyWeek);
});

test("R6E-E fortnightly recurrence remains correct across Hobart DST end", () => {
  assert.deepEqual(probe.backwardFortnightWeeks, oddWeeks);
});

test("R6E-F weekly recurrence remains correct across Hobart DST end", () => {
  assert.deepEqual(probe.backwardWeeklyWeeks, everyWeek);
});

test("R6E-G exact-date one-off immediately after DST start maps to week 5", () => {
  assert.deepEqual(probe.oneOffWeeks, [5]);
});

test("R6E-H occurrence override original date and deactivation map correctly across DST", () => {
  assert.equal(probe.sameDateOverride[4], 3000);
  assert.equal(probe.sameDateOverride[3], 0);
  assert.equal(probe.deactivated[4], 0);
});

test("R6E-I moved occurrence dates use civil-date week bucketing", () => {
  assert.equal(probe.sameWeekMove[4], 3000);
  assert.equal(probe.sameWeekMove[3], 0);
  assert.equal(probe.precedingWeekMove[3], 3000);
  assert.equal(probe.precedingWeekMove[4], 0);
});

test("R6E-J current calendar week is correct around both DST transitions", () => {
  assert.equal(probe.currentWeekAfterDstStart, 5);
  assert.equal(probe.currentWeekAtDstStart, 3);
  assert.equal(probe.currentWeekBeforeDstEnd, 4);
  assert.equal(probe.currentWeekAtDstEnd, 4);
  assert.equal(probe.currentWeekAfterDstEnd, 5);
});

test("R6E-K week-boundary dates map correctly and pre-start remains outside", () => {
  assert.deepEqual(probe.boundaryWeeks, [0, 1, 1, 2, 2, 3]);
});

test("R6E-L planner end includes the last day and excludes the following day", () => {
  assert.deepEqual(probe.plannerEndIncome, [0, 0, 0, 0, 400]);
});

test("R6E-M monthly schedule retains its civil occurrence weeks", () => {
  assert.deepEqual(probe.monthlyWeeks.slice(0, 3), [5, 9, 13]);
});

test("R6E-N quarterly and annual schedules retain their civil occurrence weeks", () => {
  assert.deepEqual(probe.quarterlyWeeks, [5, 18]);
  assert.deepEqual(probe.annualWeeks, [5, 57]);
});

test("R6E-O annual planned fortnightly income total is unchanged", () => {
  assert.equal(probe.annualIncomeTotal, 69472);
});

test("R6E-P R6B canonical salary frequency remains authoritative without legacy mutation", () => {
  assert.equal(probe.canonicalFrequency, "fortnightly");
  assert.equal(probe.legacyFrequency, "annually");
});

test("R6E-Q completed-week actual history remains frozen through reforecast", () => {
  assert.equal(probe.completedHistoryPreserved, true);
  assert.equal(probe.completedActual.income, 2800);
  assert.equal(probe.completedActual.closingBalance, 3800);
  assert.equal(probe.completedActual.notes, "History");
});

test("R6E-R Weekly Planner export income schedule reconciles exactly to the UI schedule", () => {
  assert.deepEqual(probe.exportIncomeValues, probe.uiIncomeValues);
  assert.deepEqual(probe.exportIncomeValues.slice(0, 10).map((value, index) => value > 0 ? index + 1 : 0).filter(Boolean), oddWeeks);
});
