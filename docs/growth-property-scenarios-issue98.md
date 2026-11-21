# Issue #98: default property growth scenarios

This intentionally changes the comparison semantics introduced before Issue #98. It does not change My Plan, normal forecasts or saved retirement inputs.

## Rules

- Every principal residence follows the comparison's Principal residence growth (%) field.
- Every investment-property classification and Other property/land follows Investment property growth (%), even if My Plan has an individual rate or the normal retirement forecast uses a zero-growth fallback.
- These changes are confined to comparison clones. Normal My Plan and Retirement Planning still respect their existing individual growth rates.
- The checkbox is now **Apply scenario return to individual investments**. It changes explicit financial-investment total returns only; it has no control over property growth. Existing income yield and validation rules are retained.
- An equal effective property rate preserves its original representation. When Base rates match all saved effective property rates, its cloned plan and full forecast remain identical. If an individual property rate differs from the saved plan-wide Base rate, Base intentionally applies the comparison rate and is labelled as having session-only edits.

For 259 Eagle Point Road at a saved 3% capital growth rate and suggested non-home rates of 1% / 3% / 5%, the effective comparison rates are now **1% / 3% / 5% immediately**, with every checkbox unchecked. The same applies to multiple properties and all supported aliases. Homes use their separate growth field, not the investment return or non-home rate.

The Issue #95 synthetic fixture (a $600,000 property, $167,389.53 linked debt, 2.5% inflation and year 15) now shows today's-dollar equity of **$365,389 / $529,857 / $745,680 by default**. Previously those values required property opt-in. Mortgage settings and schedules are not varied; the existing equity-before-inflation calculation and duplicate-property correction are retained.

## Validation

Regressions cover the named property, multiple investment properties and land, different home/non-home rates, Base equality, differing individual rates, zero/decimal/percentage override representations, no original-plan mutation, normal-forecast stability, checkbox independence, linked debt, both dollar bases, saved snapshots and exports. The existing nine-fixture numerical audit is unchanged because this update changes temporary comparisons only.

The browser checks verify default unchecked controls and 1% / 3% / 5% effective rates on desktop and mobile, and reconcile equity, total net worth, chart bars and saved-report paths. Physical iPhone/Safari is not part of the automated Edge viewport runs.

### Final verification

- `pnpm run verify`: 71 suites / 1,367 tests passed, with no failures, skips or cancellations.
- `node --test tests/retirement-asset-sync-browser.mjs`: final isolated run 8/8 passed, including Issue #98 desktop/mobile, saved-report exports, asset synchronisation and the existing retirement editor tests.
- Relevant cases in `tests/dollar-basis-browser.mjs`: 9/9 passed.
- Three of the four new Issue #98 unit regressions fail against the unchanged `fe18293` baseline; all pass with this change. The fourth protects existing matching-Base representation parity.
- Earlier concurrent browser runs intermittently failed the existing Issue #94 mobile scroll tolerance (3 failures, then 1 on recheck). The final isolated current run and an untouched baseline run both passed 8/8. No retirement-editor code or tolerance was changed. The separate broad browser suite, including its previously reported F04 startup issue, was not rerun or claimed green.
