# Growth scenario comparison — implementation and verification

PR: [#58](https://github.com/luke1983elphin/financial-freedom-app/pull/58)  
Branch: `feature/growth-scenario-comparisons`  
Reviewed: 13 November 2026

## Implementation

The Assumptions workspace opens a dedicated **Compare growth scenarios** panel. Lower, Base and Higher each expose investment return, super return, home growth and investment-property growth. Initial bands use the saved effective Base plus/minus 3 percentage points for investments/super and 2 for property. Only suggested bands that would breach the existing adapter's greater-than-minus-100-percent rule stop at −99.99%; the UI explains that boundary. Manual invalid rates produce errors instead of results.

Base initially uses the saved plan exactly, including imported property aliases, decimal/percent units, explicit zeros and absent fields. Editing Base changes this comparison session only. The panel identifies whether Base still matches the saved plan and provides separate resets for Base and all suggested bands. Unsaved edits in the saved-assumptions editor are excluded. Plan changes, restoring saved defaults and entering/leaving sample mode reload the appropriate saved comparison baseline.

The three cards show selected-year net worth and differences from Base. The accessible comparison chart and year-selectable table also show investments, super, home equity and investment-property equity. All displayed amounts use the existing Today's Dollars / Future Dollars selection, saved inflation and completed forecast year. Cards stack on smaller screens. The mobile table has its own labelled, keyboard-focusable horizontal scroll region; the page itself does not overflow.

Individual investment total-return rates and property overrides remain fixed by default, with an explanation and an inventory of effective asset settings. Each scenario offers an explicit opt-in to copy its investment return into explicit financial investments and remove applicable property growth overrides in its clone. Income yield, income treatment, linked-income records and loan settings remain intact. A total return below an existing income yield is rejected, not silently adjusted. Property overrides unused by the active forecast remain retained and disclosed.

Plan-linked retirement forecasts show private-fund exhaustion and first unfunded spending separately when the existing engine supplies them. Other forecasts explicitly mark these retirement outcomes unavailable and provide a Retirement Planning action. Saved retirement snapshots retain their own assumptions and are never rerun or replaced by this feature.

## Independent architecture assessment

1. **The app adapter is part of the financial boundary.** The saved plan has canonical record collections alongside legacy aggregates. `app.js`'s `calculatePlan` first calls `legacyCalculationProjection`, which migrates and synchronizes a clone, then invokes `FFSCalculator.calculatePlan` and `FFSSemiRetirementUi.applyRetirementForecast`. Calling the calculator directly from the feature would bypass that synchronization. The comparison receives the same app-level entry point as the normal forecast.
2. **There are two existing forecast modes.** Legacy accumulation calculations and the saved-retirement-timing path have different forecast horizons and property/debt behavior. The overlay preserves this choice. If an adjusted plan-linked scenario is rejected and would fall back to legacy while the original plan supports retirement, the feature returns an error instead of mixing forecast modes across cards.
3. **Assumptions have established precedence and units.** `FFSForecastAssumptions.resolve/draft/apply` already preserve imported aliases, explicit zeros, app defaults and individual settings. The new overlay uses that adapter rather than adding a schema, normalizing an unchanged Base or copying financial formulas.
4. **Asset-level rates are independent inputs.** Explicit total returns and property overrides cannot safely be assumed to follow global edits. Their treatment is therefore visible and opt-in. The existing engine continues to determine tax, cash/reinvestment treatment, linked-income deduplication, super access, loans and property accessibility.
5. **Saved retirement scenarios are independent snapshots.** The comparison uses only the current plan-linked path, not whichever retirement snapshot happens to be open. Tests preserve the opened snapshot's inputs, results and storage while comparison rates change.
6. **Existing modelling limitations remain.** In particular, the app's existing disclosure notes that legacy future debt/net-worth charts omit investment-property loan balances. Comparison total net worth deliberately retains those existing results; the component equity rows come from the existing FI-wealth projection. Components can also differ from the total because other recorded assets, offsets and liabilities are included. This feature does not repair or reinterpret those financial calculations.

`growth-scenarios.js` is the pure overlay and result-selection module. `growth-scenarios-view.js` owns only in-memory UI state. Neither module uses storage or calls a plan-save mutation. The app integration supplies read-only plan/identity access, the canonical forecast callback, the display basis and navigation. Forecast engines, assumption adapter, persistence/schema, default plans and golden fixtures are unchanged.

## Verification

- `pnpm verify`: **63 suites; 1,247 tests passed; zero failures or skips.** Includes 13 new growth-overlay tests, syntax checks, test inventory, enforcing CSP/security checks, runner and parity validator self-tests, secret scans and all existing regression suites.
- `pnpm test:browser`: **49 passed; zero failures or skips** (129.1 seconds). Includes the original workflows plus seven dedicated growth workflows covering the four viewport sizes, reset/switch behavior, plan-linked retirement and sample isolation.
- Full Base forecasts are compared by exact JSON serialization for legacy, plan-linked retirement and every sample plan. Browser checks also pass the comparison through the real app-level calculation adapter.
- Overlay tests cover frozen inputs, unrelated settings, imported aliases/zeros, each rate's actual dependency, fixed versus included overrides, cash/reinvestment income and tax treatment, linked-income deduplication, independent retirement snapshots, invalid/extreme values, mode-fallback rejection and consistent dollar conversion.
- Browser workflows exercise keyboard opening/closing and focus return, labelled controls, invalid-rate announcements, absence of stale results, selected years, table/card reconciliation, both dollar bases, unchanged plan forecasts and saved scenarios, and unchanged storage during comparison edits. Entering/leaving sample mode retains the app's existing save-on-switch behavior; the persisted financial plan remains unchanged and comparison edits are never saved.
- Layouts checked at **1366, 768, 430 and 375px**; desktop cards sit side by side and smaller layouts stack. The 375px intrinsic table-width issue discovered during testing was fixed. Runtime errors and enforcing-CSP violations are checked by the browser suite.
- `git diff --exit-code` against the original PR branch confirms the calculator, retirement engines, assumption adapter, schema, mutations, storage, dollar conversion, sample/default data and all fixtures are unchanged. Protected hashes and numerical golden regressions pass without fixture updates.

Runtime used: Node 24.22.1 and pnpm 11.25.0. No project dependencies were added.

## Evidence

- [Desktop, 1366px](comparison-1366.png)
- [Tablet, 768px](comparison-768.png)
- [Phone, 430px](comparison-430.png)
- [Phone, 375px](comparison-375.png)
- [Plan-linked retirement comparison](plan-linked-retirement.png)

The four viewport captures show year 5 in today's dollars with the Higher asset-rate opt-in selected. The retirement capture shows the independent plan-linked outcomes. No scenario PDF export was added; existing plan/retirement PDFs retain their existing contents and behavior.

## Delivery

Keep PR #58 in Draft. No merge or deployment is part of this work. Both complete local verification commands passed. CI status is checked separately after pushing this implementation.
