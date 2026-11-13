# Centralised Forecast Assumptions — PR #57 completion review

## Delivered
The Assumptions utility sits directly beneath Forecast Values and retains the Future Dollars / Today's Dollars selector. Essential controls cover investment return, super return, home growth, investment-property growth and inflation. Advanced controls cover applicable wage growth, illustrative withdrawal rate, individual investment total return/income yield/treatment, effective property overrides and a Retirement Planning link.

Each field explains its effect and saved/default/imported source. Existing duplicate global inputs now link to this workspace. Edits remain isolated until explicit Save; Undo reloads saved values. Restore App Defaults shows a confirmation preview and stages values for Save, retaining asset overrides. Stale drafts cannot overwrite a plan changed elsewhere. Validation and storage errors preserve retryable edits and the saved forecast. Sample changes apply only to the preview.

## Separate financial dependency review
Reviewed the adapter, existing calculator/property resolvers, retirement defaults/application, display conversion and persistence boundary. No engine or protected function bodies were changed.

| Assumption | Existing source/default | Dependency and boundary |
|---|---|---|
| Investment return | investing.expectedInvestmentReturnPct; 7% | Legacy/unconfigured investment fallback; explicit asset total-return settings take precedence. |
| Super return | investing.expectedSuperReturnPct; 6.5% | Plan super projection; new retirement defaults use this before retirement and max(0, rate minus 1 percentage point) afterwards. Saved scenario inputs remain independent. |
| Home/property growth | Existing percent/decimal aliases; 3% | Existing resolver precedence retained; edits update the effective imported path in its original units. Property equity is not automatically spendable retirement funding. |
| Inflation | investing.inflationPct; 2.5% | Existing retirement spending/rental escalation and today's-dollar conversion. The display toggle is unchanged and does not mutate assumptions. |
| Wage growth | investing.wageGrowthPct; 3% | Editable when saved retirement timing activates the plan retirement path; read-only for legacy accumulation, which keeps wages fixed. |
| Withdrawal rate | investing.safeWithdrawalRatePct; 4% | Illustrative FI target/income only. The existing entered-zero-to-4% calculation fallback is explained, not changed. |
| Asset returns/income | Existing assetItems fields | Yield is a component of total return, not an additional return. Existing validation, cash/reinvestment tax treatment and linked-income deduplication are retained. |

Unchanged-plan tests compare complete calculation outputs exactly in both legacy and saved-retirement paths. Imported aliases, missing fields, explicit zero/null/blank semantics, property precedence, default resets, asset-specific rates and backup round trips are covered. Changed-field-only patches leave unrelated values and saved scenario arrays intact. Browser coverage confirms an opened saved retirement snapshot retains its inputs/results through plan assumption saves and both dollar bases.

Persistence uses the existing validated batch-save path. Failed persistence restores the live plan and prior saved storage; no success message is shown. No new plan schema or storage format was introduced.

## Existing model limitations retained
- Legacy accumulation does not grow wages. The corresponding control is read-only until retirement timing is saved.
- Retirement rental cash income remains CPI-indexed; there is no misleading independent rental-growth control.
- Individual home growth overrides apply to retirement projections, while the legacy home forecast uses the global home growth rate. The property list shows the current engine's effective rate and explains dormant overrides.
- Use plan return copies the current global rate into an explicit investment record. It preserves income yield/treatment and is not a permanent inheritance relationship; the UI explains this. Unsupported legacy investment income settings remain in their existing setup workflow.
- Saved retirement scenarios are independent snapshots. Edit their assumptions through Retirement Planning; global changes do not rewrite them.
- Rates are deterministic assumptions, not probability estimates. Growth comparisons and Monte Carlo remain out of scope.

## Verification
Executed on Windows with Node 24.19.0:
- pnpm verify: PASS; 62 suites, 1,234 tests passed, zero failed/skipped/cancelled/todo. Includes syntax, inventory, runner/security checks, exact financial parity and protected-function/golden checks.
- New adapter regression coverage: 18 tests, all passed (included above).
- pnpm test:browser: PASS; all 42 tests passed, zero failed/skipped/cancelled/todo, including 9 new assumption browser cases. Existing dollar-basis reports/PDF, retirement redesign, release/CSP, backup and keyboard workflows passed.

Protected whole-file and app-function hashes, golden fixtures, financial methodology, policy values and calculation defaults remain unchanged. No tests or hash exclusions were weakened. No merge or deployment was performed.

## Visual evidence
Reviewed desktop/tablet and mobile layouts at 1366, 768, 375 and 430 pixels, including the advanced controls, long investment names, visible keyboard focus and absence of horizontal overflow. Screenshots contain test-fixture values (including zero inflation), not replacement app defaults.

- [Desktop essential](forecast-assumptions/assumptions-essential-1366.png)
- [Desktop advanced](forecast-assumptions/assumptions-advanced-1366.png)
- [375px essential](forecast-assumptions/assumptions-essential-375.png)
- [430px advanced](forecast-assumptions/assumptions-advanced-430.png)

## Files
Adapter/view modules hold assumption resolution and isolated editing. app.js installs the workspace through wrappers without changing protected bodies; index.html/styles.css provide navigation/layout. Adapter and browser tests, test registration and syntax checks cover the integration. This document and screenshots supply review evidence.