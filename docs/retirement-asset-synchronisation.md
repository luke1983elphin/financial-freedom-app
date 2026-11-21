# Issue #92: property sales and retirement asset synchronisation

Specification: [GitHub Issue #92](https://github.com/luke1983elphin/financial-freedom-app/issues/92), including the preceding asset-synchronisation audit request. Base: `c5257cc` (main, PR #91). No saved user records were migrated or overwritten.

## Root cause

`ensureSemiRetirementScenarioDraft` used the draft's dirty flag to suppress source refresh for plans without persisted retirement timing. Calculating or editing a retirement scenario could therefore leave its asset name, value, growth, ownership and loans behind subsequent My Plan edits. The source fingerprint already contained these fields; the refresh condition was the defect. Plans with persisted timing took a different path, replacing the whole draft and losing adjustments.

There was also a historical-input leak: saved scenarios with missing/zero ages borrowed ages from the current plan. Saved scenarios are snapshots, not dynamic views; they now remain entirely historical, including validation of incomplete saved inputs.

The supplied $93,994 is reproducible as `300000 / 1.025^47 = 93993.880859`. It is consistent with a stale **zero-growth** asset displayed in today's dollars. The current property mapper correctly recognises `capitalGrowthRatePct: 3`; the compound-growth formula did not require replacement. The user's private saved scenario was not accessed, so we cannot distinguish a stale live draft from an intentionally opened historical snapshot in that particular session. Both paths are now explicitly handled and labelled.

## Corrections

- Live drafts refresh when their My Plan source changes, whether dirty or clean and whether retirement timing has been saved or not. Assets, liabilities and mapped income come from the current plan. Changed plan fields win; unrelated scenario spending, events and assumptions survive. Cached inputs/results and adjustment baselines are invalidated.
- Temporary comparisons refresh with the live baseline. Saved comparisons keep their historical input sets. Reopening a saved scenario recalculates its saved inputs without rewriting stored inputs or historical results. Returning to the retirement plan explicitly loads current inputs.
- Asset mapping now includes all property classifications already recognised by the engine, including residential/commercial/income-producing investment-property aliases. Explicit growth/depreciation on vehicles and personal assets survives both mapping stages; absent growth remains zero.
- Saved cards, the retirement editor and comparison reports disclose historical input semantics.
- Saved-scenario PDF printing expands cloned disclosure sections so the capital-assets breakdown is included even when collapsed on screen. Print layout permits a long card to paginate without pushing it onto an otherwise blank page. Screen disclosures and stored data are unchanged.

## Property example

Synthetic input: stable asset ID, **259 Eagle Point Road**, $300,000, 3% nominal annual growth, joint household ownership, no loans, start year 2026, horizon 2073.

The engine's existing annual rows contain closing balances and apply one year's growth in the starting-year row. Its 2073 closing row therefore contains **48 growth steps** (2026 through 2073 inclusive): approximately **$1,239,676 future dollars**. At the existing 2.5% inflation/display convention (47 years from 2026), this is **$388,406 in today's dollars**. The regression checks annual rounding and the independent compound-growth formula within ten cents. Retained equity equals the full projected value; “Owned outright” is correct because there is no linked loan. Joint ownership is not divided by two in a household forecast.

For comparison, a point-in-time valuation exactly 47 growth periods after $300,000 is $1,203,569. This PR preserves the established closing-row timing and dollar-basis conventions rather than introducing an unrelated horizon change.

## Scope and downstream effects

The stale input set could affect retained property/vehicle values, linked debt and equity, net worth, remaining estate capital, rental/passive income and comparative outcomes. Changes to loans and income can also affect funding longevity and shortfalls. All consumers now receive refreshed live inputs or a complete historical snapshot, never a partially refreshed saved snapshot.

The retirement engine now supports explicit non-home property sales as described below. Existing personal income-tax helpers, Age Pension formulas/defaults, loan amortisation and inflation formulas are unchanged. Existing flags that make additional excluded assets report-only are preserved. No sale is inferred. Duplicate/missing asset references fail validation; names and list position never identify the sold asset. Existing home downsizing remains separate and its tests stay in the full suite.

## Validation

- `pnpm run verify`: **71 suites, 1,342 tests passed**, zero failures/skips/cancellations. Includes test inventory, syntax checks, runner failure-propagation checks, security scans, tax/debt/retirement/scenario/report tests and parity checks.
- Nine existing complete financial fixtures retain **exact numerical parity**. Protected-file fingerprints were updated only for the changed adapter and audited refresh/render functions; calculation and storage protections remain enforced.
- Seventeen new regression cases cover dirty live drafts with/without timing, ownership/value/growth/loan edits, temporary vs saved comparisons, incomplete historical snapshots, all supported property classes, explicit vehicle depreciation/personal-asset growth, 2073 valuation, retained equity/estate data, stable-ID sales, removal and reclassification, rental cessation, CGT funding, outstanding debt settlement, negative-equity shortfalls, pension asset-test inputs and sole-owner gain allocation.
- `node --test tests/retirement-asset-sync-browser.mjs`: two cases passed in headless Edge. Exercises a dirty forecast, a My Plan update, preserved spending adjustment, save/reopen, current-vs-historical comparison, print disclosures and both PDF export paths. No browser warnings/errors. The existing `tests/age-pension-browser.mjs` also passes all three desktop/mobile/personal-sale cases.
- PDF text and rendered pages inspected: [saved scenario](asset-sync-evidence/saved-scenario.pdf) and [comparison](asset-sync-evidence/comparison.pdf). Both contain **259 Eagle Point Road**; the saved breakdown displays **$388,406** in today's dollars. These use synthetic sample-plan data, not the user's saved plan.

The new browser regression is separate from the unit inventory, matching the repository's existing real-browser test convention. It writes reproducible evidence to `output/asset-sync/`.

## Issue #92 property-sale behaviour

- **Sell an asset / Asset to sell** offers personal assets and all supported non-home property classes, including vacant land stored as Other property. Principal residences stay in the existing downsizing pathway. Ordinary one-off income remains a separate action and does not dispose of a holding.
- New sales use gross proceeds in today's dollars and a selling-cost percentage. Proceeds inflate once to the selected year; selling costs apply to that gross amount. Settlement repays each linked loan's opening balance after prior years' amortisation. The remaining cash enters accessible investments once. Negative-equity settlement shortfalls enter the normal household funding waterfall and are reported if unfunded.
- Sales occur at the beginning of the selected annual row. The sold property and equity disappear immediately; linked rent (including expenses already netted against rent), taxable rental income, loan interest and scheduled repayments cease. Direct asset links and unique loan/rental-income links are supported. Unlinked lifestyle expenses cannot be inferred and remain unchanged, as disclosed in the form.
- The existing codebase has no cost-base/CGT-disposal calculator to reuse. The form therefore requires either explicit confirmation of no taxable gain or **net taxable capital gains for each person, in nominal sale-year dollars**. Users must work out the gains after cost base, eligible selling costs, capital losses and applicable discounts; the app does not guess these or assume a 50% discount. These are taxable amounts, **not extra cash and not flat tax charges**. They feed the existing personal-tax/Medicare/MLS/HELP calculation, whose cash deficit is funded once through the normal retirement waterfall. Sole-owner gains cannot be allocated to the other person. Joint owners enter their own amounts rather than assuming a split. Review these inputs if price, ownership or year changes.
- This follows the ATO distinction between calculating the net gain and taxing it as part of income: [How to calculate CGT](https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/calculating-your-cgt/how-to-calculate-your-cgt), [cost base](https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/calculating-your-cgt/cost-base-of-asset), and [capital losses](https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/calculating-your-cgt/using-capital-losses-to-reduce-capital-gains). The entered gains permit externally calculated losses/discounts/exemptions without inventing unsupported tax rules. There is no automatic capital-loss carryforward, exemption eligibility determination or future cost-base estimation.
- Pension eligibility formulas are untouched. The existing assessment receives remaining assets and sale cash after selling costs/debt instead of also retaining the disposed property; linked rent ceases. Ordinary CGT gain is not added as recurring pension-assessable income.
- Legacy personal-sale snapshots retain their existing net-after-costs amount interpretation. New optional sale fields and result breakdowns round-trip through saving/reopening; stored snapshots are never migrated or overwritten. Engine version is now `2026.27.5-asset-sales`, so reopening older snapshots explicitly reports recalculation.
- Annual details, saved cards and comparison/PDF reports show gross proceeds, selling costs, loan repayment, net cash before personal tax, gains and settlement shortfalls. Saved and annual dollar amounts follow their dollar-basis setting; comparison assumption disclosures explicitly label nominal sale-year dollars.

Additional synthetic export evidence: [saved rental-sale report](asset-sync-evidence/issue92-saved-sale.pdf) and [rental-sale comparison](asset-sync-evidence/issue92-comparison.pdf). The example sells a $300,000-today rental in 2027, applies 2% selling costs, settles its $100,000 nominal loan and includes a $50,000 nominal net capital gain through personal tax.

No merge has been performed. Vercel automatically created a preview for the initial PR push; automatic deployment is now disabled for this review branch.

## PR #93 debt-validation review correction

The original sale validator treated every unlinked loan of a potentially secured type as a blocker, even without a relationship to the property being sold. Validation now gathers stable direct asset and rental-income links, and rejects conflicting links only when they involve the selected sale asset. Settlement uses the same relationship resolution; an unrelated or unlinked debt is not repaid from sale proceeds. Loan type and display name do not establish security.

Thirteen regression cases cover vacant land and investment property sales with unrelated unlinked loans, unchanged balances/interest/repayments, conflicting direct and indirect sale-linked debt, and conflicts wholly unrelated to the sale. Before the correction, eleven of these cases failed; all 24 asset-sale tests now pass. The full verification passes 71 suites / 1,342 tests, and all nine numerical parity fixtures remain identical.

Browser verification after the correction: the two asset-sync/sale export cases pass. The broader pnpm run test:browser run reports 78 passed and 11 failed: nine existing disclosure/startup/report-label assertions in dollar-basis-browser.mjs and setup timeouts in the F04 and F08 browser files. All eleven failures reproduce against the unchanged pre-correction PR commit 3787873. They are not a clean browser-suite pass and remain review limitations outside this debt-validation correction.
