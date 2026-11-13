# Centralised Forecast Assumptions — PR 1 implementation contract

Status: implementation specification; no financial engine or UI behaviour changes in this commit.

## Objective
Expose existing effective forecast assumptions in a dedicated workspace beneath Forecast Values. Retain schema v3, current plan storage, existing defaults, per-asset precedence, and all protected calculation paths. This PR must not include Lower/Base/Higher comparisons or Monte Carlo.

## Canonical assumptions (do not introduce a second source of truth)
- `plan.investing.expectedInvestmentReturnPct`: default 7%, fallback for legacy investments; explicit `assetItems[]` rates take precedence.
- `plan.investing.expectedSuperReturnPct`: default 6.5%; retirement drafts may have independent per-person pre/post retirement rates.
- `plan.investing.inflationPct`: default 2.5%.
- `plan.investing.wageGrowthPct`: default 3%; not effective in the legacy accumulation wage path.
- `plan.investing.safeWithdrawalRatePct`: default 4%; illustrative FI targets, not the detailed retirement withdrawal engine.
- Property growth: resolve effective asset-specific values, then plan-level home/investment property values and legacy aliases; fallback 3%.
- Rental cash income: currently CPI-indexed by the retirement engine; do not expose an independent editable rental growth field unless it is actually supported.
- Asset total returns, income yields, and reinvestment/cash treatment must retain current reconciliation and deduplication logic.
- Retirement draft assumptions are independent snapshots and must not be silently overwritten when global plan assumptions change.

## UI
Add an `Assumptions` navigation entry directly below the Forecast Values dollar-basis selector, opening a full-width workspace. Present an Essential group (investment, super, property, inflation) and an Advanced group (wage growth, withdrawal rate, per-asset overrides and existing supported settings). Show effective rate, provenance (default / plan / asset / retirement draft), unit, effect, and whether a control is effective in the active engine. Link to Retirement Planning for independent retirement-draft settings. Avoid duplicate authoritative inputs.

## Editing and resets
Edit a draft copy of existing plan fields; do not mutate the saved plan until explicit Save. Validate finite numeric rates and existing engine-specific constraints; distinguish missing from explicit zero. Offer Undo Unsaved Edits, Restore App Defaults with a preview, and Use Plan Default for asset overrides. Preserve imported aliases and asset IDs. Persist via the existing plan save/backup path. Failed saves must not claim success.

## Acceptance tests
1. Exact unchanged-plan calculation parity in legacy and retirement paths.
2. Correct precedence and display for asset overrides, imported aliases, explicit zero and missing fields.
3. Existing total-return/income-yield handling and linked-income deduplication unchanged.
4. Retirement snapshots independent; CPI-linked rent and wage-growth applicability clearly explained.
5. Both dollar-basis modes unchanged; assumption editing does not accidentally change the display preference.
6. Save, undo, defaults preview, backup round-trip and storage failure behaviour.
7. Desktop/mobile UI and accessibility; no clipping at 375px and 430px.
8. Protected hashes, golden tests, `pnpm verify`, `pnpm test:browser` all pass before marking PR ready.

## Scope guard
Do not change protected engine functions, schema/storage formats, policy tables, golden fixtures, or default rates. Stop and seek approval if any such changes become necessary. PR 2 will implement isolated Lower/Base/Higher comparison snapshots after PR 1 review.
