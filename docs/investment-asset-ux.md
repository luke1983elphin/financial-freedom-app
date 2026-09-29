# PR #16 investment setup refinement

This follow-up refines the existing `feature/investment-income-return-split` branch. PR #16 was already merged externally as `5ea75c7`, so this refinement is submitted as a new review PR. It does not merge or manually deploy production. The original split-return model is documented in `investment-return-split.md`; the UI descriptions below supersede that document's initial editor descriptions.

## UX and defaults

New guided shares/ETFs and managed funds use the split-return model automatically: editable 7% total return, 0% yield and reinvestment. The 7% default is independent of the household's global return assumption. The generic Add Asset starts as cash; explicitly changing it to shares or managed fund sets the same defaults. Merely opening or editing an existing investment does not opt it in.

The modelling-mode selector is removed. Existing unconfigured investments offer **Set up investment income** (crypto: **Set up investment return**) and retain existing calculations until selected. Explicit opt-in uses the existing return assumption and linked-income yield suggestion from PR #16.

The return field explains that it is a pre-filled, editable long-term modelling assumption. Its info tooltip explains total return includes capital growth and income and actual returns may be negative. Shares use **Expected dividend / distribution yield (%)**; managed funds use **Expected distribution yield (%)**. Treatment options use **Reinvest investment income / Take investment income as cash** for shares, avoiding truncated long option labels on mobile; managed funds use **Reinvest distributions / Take distributions as cash**. Consumer explanations replace technical references to modelling modes, canonical records and migration.

Inputs and their helpers stay together in a two-column desktop layout and stack on mobile. The full-width **Estimated annual outcome** uses `investmentReturnAmounts`, the same canonical helper as the model. At $50,000, 7% total return and 3% yield it shows capital growth 4%/$2,000, income 3%/$1,500 and total return 7%/$3,500, followed by reinvested/cash treatment status. Yield above total return is rejected, never clamped.

## Shared capabilities and fields

`assetCapabilities` separates editable capabilities from the existing legacy aggregate portfolio membership. Both generic asset cards and guided investment setup use it; `assetWithType` handles explicit transitions.

| Asset type | Return/income fields |
| --- | --- |
| Home | Existing home, ownership and loan controls; property growth remains in its existing system. No financial split controls. |
| Other property | Existing property fields/growth system; no financial split controls. |
| Rental / investment property | Existing rental, property ownership, tax and loan controls; no dividend or financial split controls. |
| Offset | Existing offset treatment; no financial earnings controls. |
| Cash | Existing cash treatment; no new return/income controls. |
| Shares / ETFs | Total return, dividend/distribution yield, treatment, income owner/allocation and annual outcome. |
| Managed fund | Same model, with distribution terminology. |
| Crypto | New/type-switched crypto: total return and growth outcome only. Existing unconfigured crypto has an optional return setup action. See compatibility exception below. |
| Super | Existing person-level super growth, contributions and access model; no non-super split controls. |
| Vehicles / personal assets | Existing balance-sheet fields only. |
| Other | Generic asset fields/ownership where already applicable; no split-return controls. |

PR #16 already accepted explicitly configured crypto income, including in its populated verification fixture. Existing nonzero crypto income assumptions remain visible as **Existing investment income yield**, with their original treatment and ownership, so they are not silently dropped or left hidden. New/type-switched crypto does not assume such income. No staking model has been added. Existing explicitly named investment-bond/private/business categories retain their supported return capabilities; these are not new entries in the user-facing asset list.

## Type changes and narrowly scoped modelling bug

**Separately identified application bug:** PR #16's broad financial-investment category list included generic `other`/`otherInvestment`. Consequently, stale share-specific split fields could still drive projected returns and income after changing to Other. Home/cash/super/vehicle were already excluded from the split engine, but the UI could still show an income owner because its rendering checked mode without category.

The fix filters active split assets through capabilities. Generic Other now ignores split fields; its inherited legacy aggregate treatment is unchanged. Explicit type changes clear incompatible return-mode/rate/yield/treatment fields. Shares-to-crypto clears the old yield and cash treatment, retaining the configured total return. Ownership is retained where it remains meaningful for the destination model. Shares/funds entering from an unsupported type get 7/0/reinvest. Shares-to-fund keeps compatible entered assumptions. Guided Other investment follows the same rule. These are explicit edits, not load-time migration.

No split-return formulas, contribution timing, tax rules, FI definitions, retirement engine, saved-scenario conversion or property/super formulas were changed. Saved snapshots remain independent. The only applicability correction affects unsupported generic Other records carrying explicit split settings; such records can produce corrected results. Legacy records without new settings remain exactly unchanged.

## Verification

25 new tests cover every listed asset capability, all requested type transitions, inactive stale fields, new defaults, canonical outcome reconciliation, validation, crypto compatibility and guided persistence. Two configured PR #16 golden fixtures captured from `9fa1893` compare **all calculator results, saved scenario drafts and full retirement results**. Both match exactly. The original two pre-PR16 legacy parity fixtures also pass exactly.

Full `pnpm run verify`: **1,047/1,047 tests passed**, with syntax, test inventory, security, secret scan, numerical parity and AI containment checks. The repository has no separate lint/typecheck/build commands.

Browser QA covers new guided entry, existing configured and legacy direct/guided editing, managed-fund terminology, editable 7% default despite a 9% household assumption, invalid-yield rejection, save, canonical annual outcome, all 11 asset types and all requested type transitions. The wizard and normal editor share the renderer and both were checked. Desktop/mobile screenshots were inspected for readable helpers, full-width outcomes and no horizontal overflow. No browser page errors occurred. The optional reproducible harness is `scripts/verify-investment-ux.mjs` and accepts the same `FFS_PLAYWRIGHT_MODULE` environment setting as the existing report QA script.
