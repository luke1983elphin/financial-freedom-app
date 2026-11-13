# Growth Scenario Comparisons — PR #58 implementation contract

## Goal
Add a non-destructive Lower / Base / Higher deterministic growth comparison to Financial Freedom App, building on the centralised assumptions workspace merged in PR #57. This is a separate feature from saved retirement scenarios, Try-a-Change and Monte Carlo.

## UX
- Add a clearly labelled **Compare growth scenarios** action in the Assumptions workspace, opening a dedicated responsive comparison panel. Avoid creating another competing source of truth.
- Display three side-by-side scenario cards (stack vertically on phones) and an accessible chart/table with selectable forecast years. Include investments, super, home, investment property, total net worth and, only when supported by the current retirement engine, retirement funding/exhaustion outcomes.
- Use **Lower / Base / Higher**, not pessimistic / expected / optimistic. These are illustrative deterministic assumptions, not likelihoods, confidence intervals or financial advice.
- Base defaults to the user's *actual effective saved plan*, including imported aliases and explicit zero values; editable Base scenario is session-only and must never silently update the saved plan.
- Each scenario has editable investment return, super return, principal residence growth and investment-property growth. Inflation remains the saved plan rate by default; if exposed for scenarios, explain the purchasing-power basis clearly and compare like with like. Advanced individual-asset override treatment must be visible, not hidden.
- Suggested starting bands should be calculated as offsets to each effective Base assumption, not overwrite it with generic 4/7/10 etc. Suggested offsets (percentage points): investments -3/0/+3; super -3/0/+3; property -2/0/+2. Clamp only where existing engine contracts require it and label the adjustment. Allow manual editing, reset to suggested bands and reset Base to saved values.
- Do not assume individual asset overrides follow global return changes. Explain which asset-level rates remain fixed and provide an explicit, non-destructive way to include them in a growth scenario if appropriate.
- Provide a concise comparison explanation and clear differences relative to Base. Ensure comparison charts respect the existing Today's Dollars / Future Dollars toggle without mutating plan assumptions.

## Calculation architecture
- Build a **pure scenario overlay** from an immutable cloned saved plan. Reuse FFSForecastAssumptions, FFSCalculator and existing retirement projections; do not copy or rewrite formulas.
- For each scenario, apply only supported assumption changes through the canonical paths/units, preserving other settings, asset overrides, income yield treatment, linked-income deduplication, saved retirement scenario snapshots, loan schedules, property access and taxes.
- Base parity is mandatory: with no adjustments, full Base results must be bit-for-bit equivalent to the normal plan forecast.
- Existing retirement snapshots are independent. Do not imply they are automatically re-run with global scenario rates. Either compare the plan-linked retirement path correctly or clearly label retirement-specific outputs unavailable and link to Retirement Planning.
- Avoid counting total investment return and yield twice. Property equity is not automatically retirement-accessible.
- Keep scenario edits in memory only. Do not add new persisted fields, modify plan schema, mutate the active plan, or change protected financial functions/hashes/golden fixtures.
- Do not change global default assumptions or the default plan.

## Verification gates
1. Baseline unchanged-plan parity for legacy and plan-linked retirement projections.
2. Three scenario overlays correctly adjust intended dependencies and preserve unmodified inputs.
3. Imported percent/decimal aliases and explicit zero.
4. Asset-level total-return and property overrides: explicit, documented handling.
5. No double-counted investment income; cash vs reinvest tax treatment preserved.
6. Saved retirement snapshots untouched, including inflation and individual return assumptions.
7. Today/future dollar comparisons consistent across all cards, charts, tables and PDFs if exported.
8. No mutation or persistence, including when switching plan, sample/demo, or restoring defaults.
9. Invalid rates and unsupported scenario values handled without crashes.
10. Responsive UI at 1366, 768, 430, 375px; keyboard navigation, accessible labels, no overflow.
11. Run pnpm verify and pnpm test:browser, confirm all protected hashes/golden fixtures and CI.

## Delivery
Implement and test on feature/growth-scenario-comparisons and keep PR #58 Draft. Commit all changes and include screenshots, precise results and limitations. No merge or production deployment without user approval. Monte Carlo, probability distributions, policy changes and financial engine changes are out of scope.
