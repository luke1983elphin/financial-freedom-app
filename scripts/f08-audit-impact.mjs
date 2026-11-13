// Side-by-side old/new actuals. Independent expected amounts live in the F08
// acceptance tests; this script measures scope, not financial correctness alone.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseline = '6f3dbf83cc744e765eddf6244313635ea357bc9a';
function load(old) {
  const c = { console, structuredClone }; c.globalThis = c;
  for (const file of ['calculator.js', 'agePensionEstimate.js', 'semiRetirementProjection.js', 'semiRetirementUi.js', 'dollar-basis.js']) {
    const text = old ? execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' })
      : readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    vm.runInNewContext(text, c);
  }
  return c;
}
const old = load(true), next = load(false);
// Reuse PR #61's existing synthetic fixture at its immutable repository revision;
// do not duplicate household input payloads in the correction PR.
const auditRevision = '56a3eb336f4cde204f158c4d471a849e814bbfe8';
const audit = JSON.parse(execFileSync('git', ['show', `${auditRevision}:docs/audit-2026-11-13/household-results.json`], { encoding: 'utf8' }));
const inputs = { cases: audit.results.map(({ id, input }) => ({ id, input })) };
function run(c, { id, input: p }) {
  const C = c.FFSCalculator, P = c.FFSAgePension;
  if (id === 'H25') return C.amortiseLoan(p);
  if (id === 'H37') return P.assessProjectionYear(p);
  if (id === 'H44') return C.investmentReturnValidation(p);
  if (id === 'H48') return P.estimateSapto(p.people, p.financialYear);
  if (Object.hasOwn(p, 'partnered')) return P.estimateAnnualPension(p);
  if (p.people) return c.FFSSemiRetirementProjection.projectRetirementScenario(p);
  return C.calculatePlan(p);
}
function count(a, b) {
  if (Object.is(a, b)) return 0;
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].reduce((n, k) => n + count(a[k], b[k]), 0);
  return 1;
}
const rows = inputs.cases.map(p => {
  const before = JSON.parse(JSON.stringify(run(old, p))), after = JSON.parse(JSON.stringify(run(next, p)));
  const changedFields = count(before, after);
  assert.equal(changedFields > 0, p.id === 'H47', 'Unexpected audit scope delta: ' + p.id);
  return { id: p.id, changedFields, ...(p.id === 'H47' ? {
    before: { signedCash: before.years[0].household.netHouseholdCashIncome, taxWithdrawal: before.years[0].household.totalAccessibleInvestmentWithdrawal, closing: before.years[0].household.closingAccessibleInvestmentBalance },
    after: { signedCash: after.years[0].household.netHouseholdCashIncome, taxWithdrawal: after.years[0].household.totalAccessibleInvestmentWithdrawal, closing: after.years[0].household.closingAccessibleInvestmentBalance },
  } : {}) };
});
const result = { baseline, auditCases: rows.length, unchanged: rows.filter(p => p.changedFields === 0).length,
  changed: rows.filter(p => p.changedFields > 0),
  note: 'The main accumulation deficit H41 and all other audit findings intentionally remain unchanged. H47 uses existing annual midpoint tax funding/return timing. These are pinned old/new actual comparisons, not regenerated audit expectations.' };
writeFileSync(new URL('../docs/f08-tax-funding/audit-impact.json', import.meta.url), JSON.stringify({ ...result, cases: rows }, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
