import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const c = {};
c.globalThis = c;
vm.runInNewContext(
  readFileSync(
    new URL("../mobile-usability-stage2.js", import.meta.url),
    "utf8",
  ),
  c,
);
const U = c.FFSMobileUsabilityStage2;
test("U04 accepts derived values, zero and fractional currency without rounding", () => {
  for (const value of [75490, 75000, 75500, 0, 75490.37, 0.001, 1000000])
    assert.equal(U.spendingError(value), "");
});
test("U04 rejects blank, negative and non-finite amounts", () => {
  for (const value of [
    "",
    " ",
    -1,
    -0.01,
    NaN,
    Infinity,
    "not a number",
    "1e309",
  ])
    assert.notEqual(U.spendingError(value), "");
});
test("U04 changes only numeric editor constraints, retaining value and coarse slider", () => {
  const html =
    '<input type="number" min="0" step="1000" value="75490.37"><input type="range" min="0" max="200000" step="1000" value="75000">';
  const next = U.currencyHtml(html);
  assert.match(next, /value="75490.37" min="0" step="any" required/);
  assert.equal(
    next.slice(next.indexOf('<input type="range"')),
    html.slice(html.indexOf('<input type="range"')),
  );
});
test("U05 metadata is excluded from financial changes without mutating history", () => {
  const changes = [
    {
      label: "Saved plan snapshot",
      before: "Current working plan",
      after: "Long name",
    },
    { label: "Scenario notes", after: "memo" },
    { label: "Annual investment", before: "0", after: "10000" },
    { label: "Retirement spending", before: "75000", after: "75490" },
  ];
  const before = JSON.stringify(changes);
  assert.deepEqual(
    JSON.parse(JSON.stringify(U.financialChanges(changes))),
    changes.slice(2),
  );
  assert.equal(JSON.stringify(changes), before);
});
test("U05 plan differences retain zero, missing inputs, genuine amounts and assumptions", () => {
  const a = {
      personal: { targetAnnualSpending: 0 },
      investing: { inflationPct: 0 },
      assetItems: [{ id: "a", value: 0 }],
    },
    b = {
      personal: { targetAnnualSpending: 75490 },
      investing: { inflationPct: 2.5 },
      assetItems: [{ id: "a", value: 99 }],
      assets: { cash: 10 },
    };
  const differences = U.inputDifferences(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(differences.map((d) => d.path))), [
    "personal.targetAnnualSpending",
    "investing.inflationPct",
    "assetItems.0.value",
    "assets.cash",
  ]);
  assert.equal(differences[0].current, 0);
  assert.equal(differences[0].saved, 75490);
});
test("U05 excludes only application metadata, not plan inputs, and leaves both plans intact", () => {
  const a = {
      meta: { name: "before" },
      reportSettings: { aiInsights: { usage: 1 } },
      personal: { person1Name: "Alex", targetAnnualSpending: 75000 },
    },
    b = structuredClone(a);
  b.meta.name = "after";
  b.reportSettings.aiInsights.usage = 2;
  const before = JSON.stringify({ a, b });
  assert.equal(U.inputDifferences(a, b).length, 0);
  assert.equal(JSON.stringify({ a, b }), before);
  b.personal.targetAnnualSpending = 0;
  assert.equal(
    U.inputDifferences(a, b)[0].path,
    "personal.targetAnnualSpending",
  );
});
test('U05 retains genuine weekly financial settings while excluding app bookkeeping',()=>{const a={reportSettings:{weeklyPlanner:{startingBalance:0},aiInsights:{usage:1}}},b={reportSettings:{weeklyPlanner:{startingBalance:500},aiInsights:{usage:2}}};const differences=U.inputDifferences(a,b);assert.equal(differences.length,1);assert.equal(differences[0].path,'reportSettings.weeklyPlanner.startingBalance');assert.equal(differences[0].current,0);assert.equal(differences[0].saved,500);});
test('U05 difference labels identify named records and familiar financial units',()=>{assert.equal(U.inputLabel('assetItems.0.value',{}, {assetItems:[{name:'Family portfolio'}]}),'Asset · Family portfolio · Value ($)');assert.equal(U.inputLabel('personal.targetAnnualSpending'),'Household · Annual spending target ($)');assert.equal(U.inputLabel('investing.inflationPct'),'Investment assumptions · Inflation (%)');});
