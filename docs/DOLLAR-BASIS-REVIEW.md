# PR #54 corrective implementation

Branch: `feature/todays-dollars-toggle`. Keep the PR Draft; do not merge.

## Seven findings

| Priority | Finding | Correction | Regression evidence |
| --- | --- | --- | --- |
| P1 | Protected dashboard changed | Restore audited implementations. Install explicit presentation adapters separately, retaining the original nominal renderers. Golden hashes and financial engines are unchanged. | `ux-stage1`: protected files/functions and exact numerical parity across nine fixtures |
| P1 | Calendar-year inflation horizon | Use the scenario's projection start year or explicit annual row index, never the browser's current year. | Dated-scenario unit tests; browser scenario beginning in 2027 |
| P1 | Comparison uses active scenario's inflation | Pass each comparison's inputs. Resolve engine `inflationRate` (decimal) separately from editable/saved draft `assumptions.inflationRatePct` (percentage), preserving explicit zero. | Different-rate and zero-rate unit/browser scenarios |
| P1 | Report/PDF mixes bases | Discount year-10 narrative amounts and all monetary chart series consistently with cards. Label comparison PDFs with the active basis in every layout. | Main report card/narrative checks; generated main, portrait and landscape PDFs |
| P2 | Comparison components remain nominal | Convert super contributions/balances, withdrawals, debts, shortfall-year funding, final assets/debt and net worth with each scenario's own milestone year and inflation. Keep entered assumptions unchanged. | Component reconciliation, shortfall-year and source non-mutation tests |
| P2 | Forecast charts disagree with cards | Convert copied chart points once, using each point's year. Include investments, super, debt, net worth and endpoint annotations. Percentages remain unchanged. Future You resolves labels semantically rather than relying on tile order. | Every chart point, investment cards, slider, reordered tiles and exact reversal |
| P2 | Decision Engine ignores basis | Convert custom 1/2/long-term and 10-year surplus outcomes independently for both plans. Convert Quick What-If 1/5/10-year values and deltas after nominal calculation. | Custom/quick browser comparisons, unchanged current cashflow and reversibility |

## Display coverage

Conversion is `nominal / (1 + inflationPercent / 100) ** years`. Calculations and saved data stay nominal. Display adapters operate on scalar values or fresh copies; they never pass discounted financial data back to a projection engine or persistence method.

| Display | Values / horizon | Inflation source | Verification |
| --- | --- | --- | --- |
| Future You | Selected preview year; accessible assets, property/home equity, wealth, net worth, passive income | Current calculated plan | Browser desktop/mobile, slider and semantic-label test |
| Dashboard / investment / super cards and charts | Actual projection row year; current points at zero; sustainability horizon | Current plan | Chart-point/card comparison and exact reversal |
| My Plan | One-year net worth | Current plan | Named display adapter; full browser runtime checks |
| Goals / milestones / FI target | Target age/year, each milestone's age; current assets stay current | Current plan | Existing milestone/model tests; full browser checks |
| Main report / PDF | 1/2/10/30-year narrative and cards; per-point charts; target year | Report result's plan | Browser narrative reconciliation, print generation and rendered PDF inspection |
| Saved report comparisons | Each saved result's 10-year and final-year amounts | Each saved plan | Explicit independent conversion; existing report tests |
| Retirement annual table / mobile cards / details / pension | Row year index or calendar year minus scenario start | Calculated scenario inputs | Dated browser scenario; full pension and retirement suites |
| Retirement snapshot / income-tax / property / retained assets | Selected year, full retirement, exhaustion or projection-end year as applicable | Calculated scenario inputs | Protected model tests; browser rendering; component tests |
| Retirement funding totals / unfunded spending / pension totals | Sum of individually discounted annual cashflows | Calculated scenario inputs | Annual-sum regression, including already-real inputs |
| Retirement timeline | Event-year amounts from the original annual rows | Calculated scenario inputs | Existing timeline tests and browser runtime checks |
| Retirement comparisons and all PDF layouts | Each scenario's retirement, shortfall and end year; components match totals | Each compared scenario, including zero inflation | Reconciliation tests; dated/different-rate browser scenario; portrait/wide PDFs |
| Decision Engine | 1/2/30 and 10 years; Quick What-If 1/5/10; interest sums discounted at payment months | Each base/revised result's plan | Custom and quick browser regression tests |
| Saved scenario cards / side-by-side outcomes | Saved retirement milestone/end years; saved decision 1/2/30-year values | Saved scenario inputs or plan snapshot | Pure saved-outcome tests; existing saved/reopen browser workflows |
| Current position, income, taxes, input assumptions, percentages and weekly bank schedule | No conversion: current/input values and operational payment amounts are not long-term inflation forecasts | Not applicable | Financial parity and unchanged plan/browser checks |

## Preserved behavior and limitations

- The two-option selector remains in the left sidebar. Its accessible state, persistence, storage-failure fallback, mobile layout and reversibility are tested. Switching preserves the current plan and unsaved form text.
- Original audited presentation functions remain intact alongside the new adapters. This deliberately adds presentation code rather than weakening hash guards. Future presentation changes should be reviewed in both dollar modes.
- Older saved retirement snapshots without an inflation assumption or projection start cannot be safely converted. Cards request reopening; comparison amounts are unavailable rather than silently presenting nominal values as real. String-only legacy decision snapshots similarly require reopening when their numeric forecast is absent.
- Current balances, editable assumptions, already-today-dollar lifestyle inputs, tax calculations, progress percentages, retirement ages and projection outcomes are unchanged. Model percentages retain their existing nominal definition; the real-dollar report says this explicitly.
- Existing model limitations remain, including the main report's disclosed omission of investment-property debt from certain future net-worth/debt estimates and carried-forward financial rules. This PR does not change those calculations.
- Weekly scheduled bank payments and contractual cash amounts remain nominal operational amounts; the switch is a forecast-presentation preference, not a change to transactions or input assumptions.

## Verification

Commands: `pnpm verify` and `pnpm test:browser`. The latter runs the dollar-basis, Stage 1, Age Pension and release browser suites serially.

The older Stage 1 browser harness failures were reproduced against main before repair. Updated coverage uses current investment-return controls, current report/decision wording, explicit income targeting in the test-only provenance hook, and graceful Windows browser shutdown. It still checks linked asset/income/loan IDs, ownership, zero duplicate income, persistence, gating, focus, navigation and overflow.

Final verification on Node **24.19.0** (the CI version): **1,205 passed, 0 failed, 0 skipped/todo/cancelled**, across 60 suites. Inventory, syntax, syntax self-tests, browser security, numerical parity, AI containment, runner self-tests, secret scan and scanner self-tests also pass. The protected-function suite retains all existing golden hashes and the nine deterministic financial fixtures have zero numerical differences.

The complete standalone browser run passes **24 tests**, including seven new dollar-basis browser cases, with no failures or skips. It covers desktop/mobile, custom and quick comparisons, different/zero scenario inflation, dated projections, print layouts, storage restrictions, reload, unsaved text, source non-mutation and exact reversal. The regression unit suite adds eleven cases, including unknown legacy outcomes and a requested age beyond the available projection horizon.

The bundled Node 24.22.1 runtime intermittently timed out in unrelated worker suites. The unchanged test policy and complete suite pass using CI's checksum-verified Node 24.19.0; no timeout, hash or completion guard was weakened. Local pnpm is 11.25.0; CI retains the repository's pinned 11.19.0.

Generated PDF/screenshots are kept locally in ignored `test-results/dollar-basis/`; generated changes to pre-existing release evidence are excluded from the commit. Rendered main-report Future Outlook and portrait/wide retirement comparison pages were visually inspected.
