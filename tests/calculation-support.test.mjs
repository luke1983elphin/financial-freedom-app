import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { engine, fixture } from '../scripts/retirement-exhaustion-fixture.mjs';
const context = { crypto: webcrypto };
vm.runInNewContext(readFileSync(new URL('../calculation-support.js', import.meta.url), 'utf8'), context);
const api = context.FFSCalculationSupport;
test('captures are immutable; edits, basis and returning to old state create new IDs', () => {
  const payload = { assumptions: { inflation: .025 }, results: [10], basis: 'future' };
  const a = api.capture(null, payload);
  assert.equal(api.capture(a, payload), a);
  payload.results[0] = 20;
  assert.equal(a.data.results[0], 10);
  const b = api.capture(a, payload); assert.notEqual(a.id, b.id);
  const c = api.capture(b, { ...payload, basis: 'today' }); assert.notEqual(b.id, c.id);
  assert.notEqual(api.capture(c, a.data).id, a.id);
  assert.throws(() => { a.data.results[0] = 30; });
});
test('fictional funding gap retains nominal records and separately discounts each year', () => {
  const inputs = fixture(); inputs.inflationRate = .025;
  const result = engine().projectRetirementScenario(inputs);
  const capture = api.capture(null, { scenarios: [{ name: '=SUM(1,2)', source: 'current', result, inputs, draft: {} }], settings: { basis: 'today' }, figures: [] });
  const tables = api.retirementTables(capture);
  assert.ok(result.years.some(y => y.household.unmetSpending > 0));
  const conversion = tables.find(t => t.name === 'Dollar conversion').rows.slice(1);
  for (const cells of conversion) assert.equal(cells[6].cachedValue, cells[3].value / (1 + inputs.inflationRate) ** cells[5].value);
  const workings = tables.find(t => t.name === 'Balance workings').rows.slice(1);
  assert.ok(workings.every(cells => Math.abs(cells[11].cachedValue) < .011));
  assert.ok(workings.every(cells => cells[9].formula.startsWith('ROUND(')));
  assert.equal(workings[0][0].type, 'string');
  assert.equal(workings[0][0].formula, undefined, 'User text never becomes a formula');
  assert.ok(tables.find(t => t.name === 'Review notes').rows.some(r => r[0].value === 'Professionally reviewed' && r[1].value.startsWith('Not reviewed')));
});

test('review view shows the captured comparison and preserves detailed formula addresses', () => {
  const exported = (value) => ({ value, type: 'string' });
  const overview = { name: 'Overview', rows: [
    ['Calculation support', 'Value'].map(exported),
    ['Export ID', 'CS-test'].map(exported),
    ['Dollar basis', 'today'].map(exported),
  ] };
  const headers = ['Figure', 'Reference', 'Period', 'Units', 'Displayed Current Plan', 'Displayed Adjusted Plan', 'Displayed Difference', 'Difference'];
  const difference = { formula: 'I2-H2', cachedValue: -50 };
  const results = { name: 'Results and reconciliation', rows: [
    headers.map(exported),
    [...['Net worth', 'CHG-test', 'Year 5', 'AUD', '$200', '$150', '−$50'].map(exported), difference],
  ] };
  const [start, summary, original] = api.presentationTables([overview, results]);
  assert.equal(start.rows[1][1].value, 'CS-test');
  assert.equal(start.rows[2][1].value, 'Today’s Dollars');
  assert.ok(start.rows.some((cells) => cells[0].formula?.includes('#\'Reported results\'!A1')));
  assert.equal(summary.name, 'Reported results');
  assert.deepEqual(Array.from(summary.rows[1], c => c.value), ['Net worth', 'Year 5', 'AUD', '$200', '$150', '−$50', 'CHG-test']);
  assert.equal(original, results);
  assert.equal(original.rows[1][7], difference);
});
