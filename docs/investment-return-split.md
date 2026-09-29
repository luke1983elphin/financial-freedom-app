# Investment total return and income treatment

## Investigation before implementation

Baseline: main `de9b5a8` (includes the first-page report inset).

`calculator.js` compounded the entire global non-super return monthly. Contributions were added before each month's earnings. There was no capital/income split or reduction for dividends paid out. Thus the assumption acted as a fully retained return, although legacy inputs did not establish whether a user intended capital growth or total return. Dividend/distribution records separately increased household cash, passive income, taxable income and surplus. Dividends used the existing cash-dividend migration; distributions used their entered frequency. Neither reduced portfolio growth. Tax, Medicare, MLS and STSL could reduce affordable contributions, but the income was still counted independently from portfolio return.

FI targets use inflation-adjusted spending divided by the withdrawal assumption. Current sustainable income uses current FI assets times that assumption; passive income is not added to either formula. Future FI assets use projected portfolio balances. The old Combined Wealth Creation metric added passive cash income to financial growth and property growth, so an overlapping dividend could also overstate that metric.

Detailed retirement projections used an aggregate accessible balance, excluded offsets from investment earnings, applied returns to opening balance plus half net annual movement, and separately included passive cash/taxable income. Saved scenarios clone draft/projection inputs; per-asset return settings were not previously present. Reports described compounding and warned of possible overlap without preventing it.

## Canonical model and definitions

`investmentReturnAmounts` is the shared nominal split used by the editor, generated income, accumulation and retirement. For an eligible non-super financial asset:

- **Total investment return:** capital appreciation plus income return; current value times expected total return percentage for the nominal annual preview.
- **Income yield:** the income portion of total return, entered as a percentage of asset value.
- **Capital growth component:** total return rate minus income yield.
- **Reinvested income:** income retained within the full return, not household cash. It remains taxable at the entered yield under the app's existing ordinary-income treatment.
- **Cash investment income:** the income portion extracted from the portfolio. Only the residual rate is retained.

For $500,000 at 7% total return and 3% yield, the nominal preview reconciles $20,000 capital growth + $15,000 income = $35,000 total return. Cash mode retains $20,000 and pays $15,000; reinvest mode retains $35,000 and pays zero. Both identify $15,000 taxable income. These previews are nominal annual amounts, not promises of an exactly $35,000 first projected year when monthly compounding or contributions apply.

Validation requires finite non-negative return/yield, `yield <= return`, and an explicit cash/reinvest treatment. Invalid values are rejected, not clamped. Negative configured capital-growth rates are not introduced. Legacy negative-rate assumptions retain their prior handling.

## Schema and legacy handling

Optional fields on existing asset records:

| Field | Meaning |
| --- | --- |
| `investmentReturnMode` | `totalReturn` opts in; absent / `legacyReinvested` retains the old path |
| `expectedTotalReturnPct` | Per-asset nominal total return |
| `expectedIncomeYieldPct` | Per-asset income portion |
| `incomeTreatment` | `cash` or `reinvest` |
| Existing `owner` and allocation percentages | Ownership of generated taxable and cash income |

Income records reuse the existing stable `linkedAssetId` relationship and add `confirmedSeparateInvestmentIncome`. Existing schema migration/cloning preserves these additive properties; no schema-version bump or retrospective yield inference is needed. The canonical income view generates one virtual record per configured asset. Multiple linked records are informational references and cannot multiply its amount. Original records/amounts are retained for legacy compatibility; asset yield and ownership are authoritative while configured.

Existing assets stay in legacy mode until explicitly configured. During explicit opt-in, an existing linked amount can prefill a suggested yield so choosing reinvestment does not inadvertently discard its taxable amount. New guided investments start with visible total-return settings. Unlinked private-company/trust/dividend/distribution income remains independent and keeps its existing tax/cash treatment.

Two fixed-date golden fixtures captured from pre-change main verify **every calculator result, scenario draft and full retirement projection**, not selected totals. Both are exactly unchanged. Legacy overlap is intentionally not silently corrected: it produces a targeted review warning until linked/configured or confirmed separate.

## Projection timing, cashflow and tax

The main accumulation model retains monthly contribution-before-growth timing. Configured holdings compound their own retained rate and generate monthly income from that same basis. Contributions are distributed proportionally across holdings; residual unconfigured funds retain the global legacy rate. If all holdings are zero, contributions go to the residual portfolio. Annual income feeds the existing calculator's tax and affordability path, with bounded iteration to reconcile affordable contributions and the income they generate. Non-convergence fails explicitly. Annual rows expose cash income, taxable income, retained growth, total return and holdings for reconciliation. Unallocated surplus is not automatically invested.

Detailed retirement retains its annual midpoint convention for **retained growth** and uses opening holdings for that year's income estimate. Cash mode applies the residual rate to the midpoint balance; reinvest mode applies the full rate. Thus contributions/drawdowns can make annual realised estimates differ from a simple opening balance times 7%; cash + retained return still reconciles exactly to modelled economic return. Income declines with holdings and stops after exhaustion. Ownership feeds existing person-level tax/Medicare/MLS/STSL helpers. Taxes are funded through household cashflow and existing withdrawal rules, not deducted a second time from gross reinvested return.

Retirement contributions, withdrawals and fees are allocated proportionally across the component holdings. Components are reconciled to the existing net accessible balance, excluding offset; where the existing model nets investment debt against accessible assets, the holdings basis is correspondingly scaled. This retains the existing net-accessible funding framework rather than introducing a separate gross-asset/debt engine. The simple combined-pot retirement illustrations use a weighted full economic return because they do not add a separate passive-income stream.

No new tax law, franking-credit gross-up, capital-gains tax, asset-specific tax exemptions or after-tax reinvestment engine is introduced. The existing simplified taxable-income rule is applied to the configured yield in both treatments. Capital appreciation is not newly taxed. Super and rental/property calculation paths are unchanged.

## FI, saved scenarios and Decision Engine

Current FI asset inclusion, access ages, spending target and withdrawal-rate definitions remain unchanged. Updated retained balances flow through future FI assets/progress, milestone timing, retirement withdrawals and exhaustion. Saved retirement drafts carry independent `accessibleInvestments.components`, their rates/treatments/yields, owners and source-income IDs, plus the base global return used for adjustments. Conversion to projection inputs preserves them. JSON round-trip tests confirm later current-plan edits do not change saved results. Old scenarios without components take the original aggregate path.

The retirement scenario's existing global return adjustment applies a percentage-point change to each stored component return, leaving yields fixed and revalidating the split. The Decision Engine likewise adjusts configured asset total returns without changing yields. UI validation rejects a reduction below yield. Saved decision plans retain their complete adjusted asset/income records.

## UI, dashboard, report and warnings

Manual and guided investment editors expose opt-in mode, total return, treatment, income yield, ownership and a current-value preview. Reinvested yield stays visible because it affects tax. Linked income editors explain that the asset supplies the amount and ownership; they no longer display an editable competing amount. Income entries offer an investment selector or persistent Keep separate confirmation. Legacy guided investment summaries show the derived cash amount after opt-in.

The warning appears only when there is an investment return assumption and positive unlinked/unresolved dividend or distribution income. Linking to a configured asset or confirming separate income suppresses it. No portfolio/no relevant income means no warning. A legacy relationship alone is not treated as a configured return split. Reports use the same relevance check.

Configured report assumptions list each asset's total return, yield and treatment. Projected Financial Investment Growth means retained financial return (including reinvested income, excluding extracted cash). Total financial investment return is retained financial return plus configured cash income. Combined Wealth Creation continues to add retained financial growth + passive cash income + investment-property growth: extracted income appears only in passive cash, and reinvested income only in retained return. Genuine unlinked income remains in passive cash. The dashboard adds cash-income and total-return reconciliation figures when configured.

## Verification and limitations

New tests cover nominal and monthly reconciliation, cash/reinvestment tax separation, multiple portfolios and linked references, zero/full/excessive yields, unrelated dividend/trust income, contributions, negative surplus, FI balances, retirement midpoint timing, exhaustion, saved-scenario independence, legacy parity and conditional report warnings. Browser automation exercises yield rejection, treatment selection, warning confirmation/linking, and desktop/mobile layouts. Both configured report fixtures were exported at A4: 12 populated pages and 11 simple pages. Every page was visually inspected; margin/split checks passed for 134 protected components. First-page padding remains intact.

Full `pnpm run verify` passed: **1,022/1,022 tests**, including **32 new tests**. Security, parity, AI containment and secret checks passed. There are no separate lint, typecheck or production-build scripts. Optional visual reproduction: set `FFS_PLAYWRIGHT_MODULE`, then run `node scripts/verify-financial-report.mjs . outputs/investment-return --investment-split` and `python scripts/check-report-pdf.py outputs/investment-return`.

Remaining limitations: returns are deterministic; distributions are estimates rather than dated security transactions; asset-level contribution destinations and cost bases are not modelled; retirement income uses opening holdings rather than intrayear dividend dates; the inherited net-accessible balance convention can scale holdings with debt. Legacy users who intentionally leave overlapping assumptions unresolved retain their old outputs. Existing report disclosure about omitted rental debt in the simple future net-worth/debt forecast remains; this separate issue was not changed. No merge or manual production deployment is part of this work.
