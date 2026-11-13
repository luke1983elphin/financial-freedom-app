// Review approved F08 golden deltas. Default is read-only; --apply updates only
// the two independently reconciled affected records, preserving the old fixture.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { capture } from './ux-stage1-parity.mjs';
const previousPath = new URL('../tests/fixtures/ux-stage1-before.pre-f08.json.gz', import.meta.url);
const previousBytes = readFileSync(previousPath);
const before = JSON.parse(gunzipSync(previousBytes)), after = capture();
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
function tax(x, financialYear) {
  const first = financialYear === '2026-27' ? .15 : .14;
  const positive = n => Math.max(0, n);
  const gross = first * positive(x - 18200) + (.30 - first) * positive(x - 45000)
    + .07 * positive(x - 135000) + .08 * positive(x - 190000);
  const lito = x <= 37500 ? 700 : x <= 45000 ? 700 - .05 * (x - 37500) : Math.max(0, 325 - .015 * (x - 45000));
  const incomeTax = round(Math.max(0, gross - lito));
  const medicare = round(Math.min(.02 * x, Math.max(0, .1 * (x - 28011))));
  return round(incomeTax + medicare);
}
const equalMoney = (a, b, label) => assert.ok(Math.abs(a - b) <= .02, `${label}: ${a} vs ${b}`);
function differences(a, b, path = '', out = []) {
  if (Object.is(a, b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], path + '.' + key, out);
  } else out.push({ path, before: a, after: b });
  return out;
}
let reconciledYears = 0;
const deltas = [], approvedChanged = new Set(['single', 'couple-property-offset']);
assert.equal(before.length, after.length);
for (let i = 0; i < before.length; i++) {
  assert.equal(after[i].name, before[i].name);
  assert.deepEqual(after[i].records.calculation, before[i].records.calculation, 'Main calculator must not change');
  assert.deepEqual(after[i].records.draft, before[i].records.draft, 'Saved input assumptions must not change');
  const changed = JSON.stringify(after[i]) !== JSON.stringify(before[i]);
  assert.equal(changed, approvedChanged.has(after[i].name), 'Unexpected changed/unchanged fixture: ' + after[i].name);
  for (const route of ['retirement', 'scenario']) {
    const oldResult = before[i].records[route].result, result = after[i].records[route].result;
    const first = result.years.findIndex((row, index) => JSON.stringify(row) !== JSON.stringify(oldResult.years[index]));
    for (const row of result.years) {
      reconciledYears++;
      const h = row.household;
      let signed = 0;
      for (const p of row.people) {
        equalMoney(p.incomeTax + p.medicareLevy, tax(p.totalTaxableIncome, row.financialYear), 'Independent ordinary tax');
        const net = round(p.totalCashIncomeBeforeTax - tax(p.totalTaxableIncome, row.financialYear) - p.medicareLevySurcharge - p.stslRepayment);
        equalMoney(p.netEmploymentIncome, net, 'Signed owner cash');
        signed += net;
        equalMoney(p.closingSuperBalance, p.openingSuperBalance + p.employerSuperContribution + p.additionalSuperContribution
          - p.superContributionsTax + p.downsizerSuperContribution + p.superInvestmentEarnings - p.superFees - p.superWithdrawal, 'Super conservation');
      }
      equalMoney(h.netHouseholdCashIncome, round(signed + h.otherIncome + h.netRentalCashflow), 'Household signed aggregation');
      equalMoney(h.closingAccessibleInvestmentBalance, h.openingAccessibleInvestmentBalance + h.accessibleInvestmentEarnings
        + h.plannedExternalAccessibleContribution + h.surplusToAccessibleInvestments + h.oneOffIncomeAccessibleContribution
        + h.downsizeAccessibleInvestmentContribution - h.totalAccessibleInvestmentWithdrawal - h.accessibleInvestmentFees, 'Accessible asset conservation');
      equalMoney(h.netHouseholdCashIncome + h.requiredAccessibleWithdrawal + h.requiredSuperWithdrawal
        + h.unmetRequiredLifestyleSpending - h.householdCashRequirement, Math.max(0, h.cashSurplusOrShortfall), 'Required cash funding including unmet needs');
    }
    if (changed) {
      assert.ok(first >= 0);
      const oldRow = oldResult.years[first], newRow = result.years[first];
      assert.ok(newRow.people.some(p => p.netEmploymentIncome < 0), 'First changed row must originate at a signed owner deficit');
      deltas.push({ name: after[i].name, route, firstChangedYear: newRow.calendarYear,
        firstChangedOpeningAges: newRow.people.map(p => ({ id: p.id, age: p.age })),
        signedOwnerCash: newRow.people.map(p => ({ id: p.id, before: oldRow.people.find(o => o.id === p.id).netEmploymentIncome, after: p.netEmploymentIncome })),
        firstClosingInvestableBefore: oldRow.household.totalInvestableAssets, firstClosingInvestableAfter: newRow.household.totalInvestableAssets,
        finalYear: result.years.at(-1).calendarYear, finalOpeningAges: result.years.at(-1).people.map(p => p.age),
        finalInvestableBefore: oldResult.summary.totalInvestableAssetsAtEndAge, finalInvestableAfter: result.summary.totalInvestableAssetsAtEndAge,
        changedFields: differences(before[i].records[route], after[i].records[route]).length });
    }
  }
}
const summary = { baseline: '6f3dbf83cc744e765eddf6244313635ea357bc9a',
  preservedGoldenSha256: createHash('sha256').update(previousBytes).digest('hex'),
  fixtures: before.length, unchangedFixtures: before.filter(p => !approvedChanged.has(p.name)).map(p => p.name),
  reconciledProjectionYears: reconciledYears, notes: 'Only two synthetic investment-return fixtures change, in retirement outputs after owner tax deficits arise. Main results and drafts match exactly. Extreme end balances reflect the existing synthetic horizons/ages shown below, not a typical household forecast.', deltas };
writeFileSync(new URL('../docs/f08-tax-funding/golden-deltas.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
if (process.argv.includes('--apply')) {
  const merged = before.map((old, i) => approvedChanged.has(old.name) ? after[i] : old);
  writeFileSync(new URL('../tests/fixtures/ux-stage1-before.json.gz', import.meta.url), gzipSync(JSON.stringify(merged)));
}
console.log(JSON.stringify(summary, null, 2));
