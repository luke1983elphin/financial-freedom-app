# Try a Change calculation support

Stacked after the Retirement, Growth and Saved Scenarios drafts. Quick presets/custom changes and detailed comparisons capture their actual current and adjusted engine results during rendering. Downloads use that immutable capture, with a new ID when results, changes, assumptions or dollar basis change. No financial calculation, saved schema or numerical fixture is changed.

The workbook identifies Current Plan (or the saved base), Adjusted Plan and signed Difference, with stable CHG references beside the visible figures. It contains an overview, reconciliation, separate nominal/Today's Dollars conversion, requested and resolved changes, both plans, retained engine schedules, additional displayed technical details and review notes. The cashflow bridge distinguishes the initial change before allocation from final cash after allocation. Zero values are retained. Projection/tax/pension calculations supplied by the engine are labelled outside workbook formula coverage; independent benchmarking and professional review are not claimed.

Try a Change has no dedicated PDF export. Fictional workbooks and matching screenshots with the same IDs are in `examples/calculation-support/change`: expense reduction (positive cashflow), increased investing (negative cashflow) and an unchanged detailed comparison (zero differences).

Verification commands:

```powershell
node scripts/verify-change-support.mjs
./scripts/verify-change-support-excel.ps1
node --test tests/try-change-targeted.test.mjs tests/custom-what-if.test.mjs tests/ux-stage1.test.mjs
node scripts/run-tests.mjs --group report
node scripts/verify-reporting-scope.mjs outputs/calculation-support/final-regression
node scripts/r1-numerical-parity.mjs ../calculation-support-baseline
node scripts/r6c-retirement-parity.mjs ../calculation-support-baseline outputs/calculation-support/final-retirement-parity.json
```

Browser verification covers positive/negative presets, weekly custom changes, zero detailed differences, both dollar bases, exact visible figures, ID changes after edits and plan preservation. Excel opened five files without repair, recalculated comparisons/conversions and responded to a disposable +100 input perturbation. Worksheet previews were inspected. Financial parity passes against main `c561017` (seven sample plans; retirement additionally Taylor/Morgan). The protected-function test still hashes the complete audited comparison body after removing only the explicit presentation capture call; its fixtures are untouched.

All exports remain browser-local. Keep this PR draft; do not merge or deploy. The Professional Review library is deferred.
