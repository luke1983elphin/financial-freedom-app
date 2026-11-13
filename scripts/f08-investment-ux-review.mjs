// Preserve and review the two older configured-investment full-output hashes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const baseline = '6f3dbf83cc744e765eddf6244313635ea357bc9a';
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function capture(plan, old) {
  const c = { console }; c.globalThis = c;
  c.Date = class extends Date { constructor(...a) { super(...(a.length ? a : ['2026-09-29T00:00:00Z'])); } static now() { return Date.parse('2026-09-29T00:00:00Z'); } };
  for (const f of ['calculator.js', 'semiRetirementProjection.js', 'semiRetirementUi.js']) {
    vm.runInNewContext(old ? execFileSync('git', ['show', `${baseline}:${f}`], { encoding: 'utf8' }) : readFileSync(new URL('../' + f, import.meta.url), 'utf8'), c);
  }
  const calc = c.FFSCalculator.calculatePlan(plan), { draft } = c.FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(plan, calc);
  draft.scenario.workingPhaseSurplusDestination = 'accessible-investments';
  return JSON.parse(JSON.stringify({ calc, draft, retirement: c.FFSSemiRetirementUi.runSemiRetirementProjection(c.FFSSemiRetirementProjection, draft) }));
}
const original = JSON.parse(readFileSync(new URL('../tests/fixtures/investment-ux-parity.pre-f08.json', import.meta.url)));
const changed = [], updated = [];
for (const fixture of original) {
  const before = capture(fixture.plan, true), after = capture(fixture.plan, false);
  assert.equal(hash(before), fixture.sha256, 'Historical fixture must reproduce exactly');
  assert.deepEqual(after.calc, before.calc); assert.deepEqual(after.draft, before.draft);
  const i = after.retirement.result.years.findIndex((row, index) => JSON.stringify(row) !== JSON.stringify(before.retirement.result.years[index]));
  assert.ok(i >= 0); assert.ok(after.retirement.result.years[i].people.some(p => p.netEmploymentIncome < 0));
  for (const row of after.retirement.result.years) {
    const signed = row.people.reduce((sum, p) => sum + p.totalCashIncomeBeforeTax - p.incomeTax - p.medicareLevy - p.medicareLevySurcharge - p.stslRepayment, 0);
    assert.ok(Math.abs(row.household.netHouseholdCashIncome - signed - row.household.otherIncome - row.household.netRentalCashflow) <= .02);
    assert.equal(row.household.accessibleReconciliation.difference, 0);
  }
  changed.push({ name: fixture.name, previousSha256: fixture.sha256, correctedSha256: hash(after),
    firstChangedYear: after.retirement.result.years[i].calendarYear,
    firstSignedCash: after.retirement.result.years[i].people.map(p => p.netEmploymentIncome),
    firstClosingBefore: before.retirement.result.years[i].household.totalInvestableAssets,
    firstClosingAfter: after.retirement.result.years[i].household.totalInvestableAssets });
  updated.push({ ...fixture, sha256: hash(after) });
}
if (process.argv.includes('--apply')) writeFileSync(new URL('../tests/fixtures/investment-ux-parity.json', import.meta.url), JSON.stringify(updated, null, 2) + '\n');
writeFileSync(new URL('../docs/f08-tax-funding/investment-ux-deltas.json', import.meta.url), JSON.stringify({ baseline, changed }, null, 2) + '\n');
console.log(JSON.stringify(changed, null, 2));
