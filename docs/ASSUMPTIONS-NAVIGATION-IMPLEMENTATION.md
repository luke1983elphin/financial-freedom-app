# Dedicated Assumptions workspace — implementation brief

## Goal
Make Assumptions a discoverable dedicated workspace without removing or reordering the five core navigation tabs.

## Navigation contract
- Keep **Home, My Plan, Goals, Retirement, Weekly** unchanged, including their existing navigation and mobile layout.
- Under **More tools**, add **Assumptions** as the first tile, followed by Try a Change, Investments, Super, Reports, Saved Scenarios.
- Selecting Assumptions navigates to its own view/panel, not a modal or an inline editor within Retirement.
- Remove the old Assumptions entry/link from below **Forecast Values** to avoid duplicate entry points.
- Keep **Today's dollars / Future dollars** toggle exactly where it is; preserve global basis behavior.
- Preserve existing deep links, navigation history, mobile accessibility and other tool routes.

## Assumptions workspace
1. **Plan Assumptions** — reuse the existing Forecast Assumptions editor and Essential/Advanced sections, Save/Undo/Restore defaults, validation and persistence behavior.
2. **Compare Growth Scenarios** — reuse the existing PR #58 Lower/Base/Higher comparison and its session-only overlays, responsive charts/table, and existing input validation. Keep the comparison button integrated in the editor header or a clearly associated section.
3. **What These Affect** — concise, accurate explanation:
   - Saving edits updates the main saved financial plan and applicable future forecasts, respecting individual asset-level settings.
   - Plan-linked retirement projections use the applicable saved-plan assumptions under existing model rules.
   - Previously saved retirement scenarios may contain independent snapshots and are not silently overwritten or recalculated by global edits.
   - Comparison scenario edits are temporary and do not save or change the main plan.
   - Wage growth applies to saved retirement-timing forecasts, not legacy accumulation; safe withdrawal is illustrative, not the detailed retirement spending rule.
- Explain scope near Save, using plain language; do not promise universal propagation into all retirement scenarios.

## Constraints
- UI/navigation only. No changes to financial engines, forecast formulas, protected functions, golden hashes, assumptions resolution/apply, storage schema, sample/default plan data, saved retirement scenarios, tax or dollar-basis logic.
- Reuse existing mounted components without duplicate listeners, stale editor state, or losing comparison edits on redraw. Navigation away/back must be deterministic; preserve existing unsaved edit warnings/behavior.
- Make Assumptions tile keyboard accessible, clearly active when selected, mobile-friendly at 375, 390, 430, 768, 1366px, and avoid horizontal overflow.
- Check accessibility, focus return, scroll position, browser history, and unchanged core tabs.

## Verification and delivery
- Independently inspect navigation architecture and identify any conflicts before coding.
- Add browser regression tests for all five core tabs, new More tools tile, removed old entry, navigating to/from Assumptions, save/undo/restore, comparison session isolation, sample mode, retirement snapshot independence, dollar-basis toggle, storage parity and mobile.
- Run pnpm verify and pnpm test:browser. Include screenshots for mobile and desktop.
- Commit and push to this branch, keep PR Draft. Do not merge or deploy without explicit approval.
