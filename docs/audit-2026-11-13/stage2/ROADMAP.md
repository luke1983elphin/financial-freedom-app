# Proposed correction PRs and independent acceptance tests

These are designs for separate Draft PRs, **not authorised financial changes**. No item below has been implemented by this review. Approve a specific financial behaviour, applicability boundary, settlement convention and expected delta inventory before touching protected functions, hashes or golden fixtures. Dependencies are intentional: a later tax feature must use a funding ledger that can actually pay its tax.

## Common approval and verification contract

For every correction PR:

- Record old/new engine versions, rule versions, input schema changes, exact approved behaviour, independent derivation and all affected surfaces. Review the expected before/after deltas for the original 48 households and new diagnostics; those deltas are the review evidence, not a reason to suppress a valid correction.
- Retain previous golden outputs as historical evidence. Where an approved correction changes a protected function or its legitimate result, enumerate the affected entries in `tests/fixtures/ux-stage1-protected.json`, `tests/fixtures/ux-stage1-before.json.gz`, `tests/fixtures/age-pension-off-baseline.json`, `R2-NUMERICAL-PARITY.json` and any other test-discovered snapshots. Some fixtures may be unaffected: compute reachability/diffs rather than regenerate them wholesale.
- Require explicit owner approval for protected calculation/hash/golden changes. A stale hash is not financial truth. Once the numerical change is approved and independently proven, update only necessary guards with provenance, preserving old fixtures and the independent oracle; do not loosen tolerances, delete failing assertions or make expected values call the corrected engine.
- Run test inventory, syntax/security, unchanged relevant unit suites, full `pnpm verify`, independent acceptance cases and browser/report/export checks. Verify current results, raw future rows, growth overlays, real display conversion, saved snapshots and printed PDFs for the same versioned household.
- Test repeated execution and input nonmutation. Check household-wide conservation including fees, taxes owed/refunded, debt, withdrawals and unfunded liabilities. Per-account self-reconciliation alone is insufficient.

Currency acceptance: cents for deterministic zero-return examples; independently justified monthly-rounding tolerance for scheduled debt/compounding; whole-dollar formatting only at the display layer. Never accept a percentage tolerance broad enough to hide a debt or tax omission.

## Dependency order

`P0 return/scope contract → P1 detailed funding → P2 accumulation/weekly bridge`; `P3 asset identity → P4 debt/report reconciliation`; `P0 + P1 + P3/P4 → P5 retirement starts/rates`; `P0 + P1 → P6 income identity/franking`; `P1 + P5 → P7 super/pension tax scope`; `P0/P1/P3/P5 → P8 downside engine`; all approved deterministic PRs → `P9 simulation eligibility/verification gate`. P3 can be reviewed independently of P1 but must precede any attempt to validate property wealth or pension asset means tests comprehensively.

## P0 — Define and version the return and time-basis contract

**Files/functions:** `forecast-assumptions.js` fields/resolve/apply; `forecast-assumptions-view.js`; `calculator.js` `emptyPlan`, `projectBalance`, `projectSplitInvestmentYear`; `semiRetirementUi.js` `personDefaults`, `scenarioDraftToProjectionInputs`, `applyRetirementForecast`; `plan-schema.js` optional metadata and saved-snapshot adapters in `app.js`; tests `forecast-assumptions-adapter`, `growth-scenarios`, `investment-return-split`, `new-plan-projection-default`.

**Behaviour decision:** distinguish nominal APR from effective annual return; nominal versus real dollars; capital versus income; tax/fee inclusions; super accumulation/retirement account assumptions. Recommended new convention is effective annual nominal returns with an explicit tax/fee basis, but the owner must approve it. A recommendation is not authorisation to reinterpret every existing 7% input. Fees embedded in a net return must not be charged again. Do not automatically treat reduced employment as an exempt pension conversion.

**Independent acceptance:** at $500k, no flows, effective annual 7% closes at $535k; monthly equivalent `(1.07)^(1/12)−1`. A declared 7% nominal APR closes at $536,145.03 with monthly cents; disclose effective 7.2290%. Effective annual 6.5% closes at $532,500 versus monthly APR $533,485.90. Add monthly $1k contributions and independently derive annuity-due value; test annual midpoint as a separately labelled approximation. At $500k and a return explicitly already net of all costs, a zero separate fee leaves exactly the entered return; adding a distinct 1% fee requires confirmation of different cost scope.

**Compatibility / financial impact:** convention changes alter long-term projections, growth comparisons and saved scenarios materially. Store the selected basis/version and distinguish known prior APR inputs from unknown provenance. Do not guess that “legacy” means tax-free. Offer a preview of corrected/rebased projections and retain historical calculation evidence. If preserving an old version for historical replay, label it as historical; do not continue showing a known-wrong projection as the current corrected result.

**Hashes/goldens:** any compounding change affects calculator guards and most future-balance fixtures; default/adapter metadata may affect serialised snapshots. Pure disclosure changes may avoid numerical goldens but still alter source guards. Approve separately from P1's conservation fix.

## P1 — Preserve signed person cash and settle detailed tax deficits (F08)

**Files/functions:** `semiRetirementProjection.js` ordinary and pension-enabled person tax settlement, `totalNetEmploymentIncome`, `netHouseholdCashIncome`, required shortfall, `withdrawAccessibleBalance`, `withdrawFromSuper`, year-end settlement, household reconciliation/report fields; `semiRetirementUi.js` view-model/shortfall labels; `app.js` retirement rows, comparison summaries and print disclosures where a tax liability is currently called lifestyle spending.

**Expected behaviour:** combine signed person cash before funding; use household cash before eligible investments/super; if insufficient, retain an explicit unfunded tax/required-cash liability. Keep income-tax accrual, payment timing and source separate. Do not charge a tax computed before pension again after pension recalculation. Super remains restricted by owner and approved legal-access assumptions. A household with a working spouse need not sell investments solely because the income owner has no cash.

**Numerical acceptance:**

| Case | Independent expected result |
| --- | --- |
| $100k opening, zero return/spending, $60k taxable noncash income, cash $0 | Tax $9,620; household cash −$9,620; withdrawal $9,620; close $90,380 |
| Same, cash receipts $5k | Net −$4,620; withdrawal $4,620; close $95,380 |
| Same, cash $20k, enjoyment surplus | Net $10,380; no portfolio withdrawal; close $100k; enjoyment $10,380 |
| Owner taxable reinvested yield $60k; spouse salary $100k; no other deductions/MLS | Household net $67,860 = $100k − $22,520 − $9,620; no lost owner tax |
| No accessible or eligible super funds; tax $9,620; no other spending | Explicit unmet tax/required cash $9,620, rather than zero shortfall |
| Pension enabled, entitlement zero because of $2m assets | Same tax funding as disabled control, subject to explicitly selected SAPTO eligibility and independent tax amount |
| Restricted super owner 59, no liquid funds, tax $1k | No prohibited withdrawal; explicit unmet liability $1k |

For the $2m/7%/3% retained-yield case, **agree settlement timing before fixing a closing balance**: using opening yield and year-end tax gives `$2m + $140k − $9,620 = $2,130,380`; under midpoint withdrawal timing the close is `$2m − $9,620 + 7%×($2m−$4,810) = $2,130,043.30`. Both assume the specified simplified realisation/tax basis. They cannot both be the same acceptance target. The tax payment itself must appear exactly once in either design.

**Regression/compatibility:** extend `semi-retirement-projection`, `investment-return-split`, `age-pension`, concessional tax-event and surplus-routing suites; reserves/offset depletion, spouse ownership, zero/negative cash, fees, insufficiency and terminal-year cases. Saved inputs usually need no schema migration, but results, shortfall years and stored key-result summaries change. Versioned interpretation/refresh is required.

**Hashes/goldens / user effects:** retirement engine guard changes are expected, and pension-off full-output baselines may change for cases hitting the clamp. Enumerate affected records. Users may see lower balances, earlier shortfalls or less surplus; publish numerical deltas rather than hiding the correction.

## P2 — Reconcile accumulation deficits and the weekly tax calendar

**Files/functions:** `calculator.js` `projectConfiguredInvestments`, `accumulationCashflowProjection`, current cashflow result contract; `weekly-plan.js` `estimatedNetIncomeAnnuals`, `buildDefaultTimingItems`, `createFromPlan`/`reforecast`; `app.js` Weekly setup/provisions/actual reconciliation; `weekly-planner-export.js` exports; `semiRetirementUi.js` current-versus-lifetime boundary.

**Expected behaviour decision:** either make accumulation an integrated signed-funding ledger, or explicitly carry negative cash as a liability/unfunded requirement in projected wealth and stop implying it has been paid. Do not silently redeem assets if the product remains a fixed-budget illustration. Add an explicit annual investment-tax settlement/provision bridge to Weekly, without double-counting estimated salary withholding or completed-week actuals. Due-date scheduling must be user-defined or clearly estimated; an annual tax accrual is not proof of a specific weekly debit date.

**Acceptance:** original H41 no-contribution monthly portfolio grows from $2m to $2,144,580.16 before tax; its specified year-end settlement estimate is $10,277.58, net $2,134,302.58 to the independent rounding tolerance. If a different settlement convention is approved, replace this with its independently derived ledger and retain the old diagnostic as a timing comparison. Current $60k reinvestment income with $9,620 tax, no salary/cash, must not produce a Weekly plan with no tax outflow/provision and claim current cash is reconciled. A $100k salary already withheld by $22,520 plus a separate investment tax adjustment must reconcile once, not charge full household income tax twice.

**Compatibility:** preserve completed-week actuals and explicit occurrence edits; introduce future tax lines as reviewable dated items, never rewrite bank history or silently move actual payments. New provisions require stable source IDs and backup/import preservation. Regenerate only future auto-generated items with a visible comparison.

**Tests:** cashflow tax integration, canonical salary timing, weekly reforecast/completed-week gating, DST-safe dates, export arithmetic, and original deficit household cases. `calculator.js`, `weekly-plan.js` and export guards may change. Future balances and calendar surpluses can change; do not conflate a calendar correction with new investment income.

## P3 — Fix canonical property identity before debt reconciliation (F11)

**Files/functions:** `semiRetirementUi.js` `projectionAssetsFromPlan`, `propertyTypeGroup`, asset-growth/source metadata; `legacy-plan-adapter.js` / `app.js` `syncCollectionsToLegacy` authority contract; `plan-selectors.js` and schema adapters if a shared canonical-property selector is chosen. The detailed `totalNetWorth` arithmetic should not be changed merely to compensate for duplicate input assets.

**Expected behaviour:** one canonical economic property plus its legacy aggregate mirror creates one retirement asset, not two. Canonical records must be authoritative for that collection. An actual additional legacy-only property requires an explicit identity/mapping decision; do not blindly subtract all legacy values, and do not deduplicate genuine properties just because values match. Respect inactive/deleted records and explicit zero.

**Acceptance:** $600k `investmentProperty`, mirrored `assets.otherPropertyValue=$600k`, $350k linked loan → one asset; with 3% growth, $618k gross, $350k debt, $268k equity. With two genuine properties $600k/$400k and aggregate mirror $1m, preserve two, not four and not one. With two distinct $600k properties, preserve both. A legacy-only $600k property still appears once. All inactive canonical records plus stale mirrors must follow an explicitly approved authority rule; test it rather than reviving deleted wealth.

**Saved-data risk:** retirement drafts already persisted with both a named property and `legacy-other-property` are ambiguous. Inspect provenance/source IDs to propose a mapping, show a review diff, and preserve the original snapshot. Never automatically delete a genuinely separate property based only on amount/category. Save a corrected scenario as a new revision and mark stale summaries. This may change pension means tests as well as wealth, so separate net-worth correction from pension-benefit validation.

**Tests/hashes/user effects:** canonical integrity, debt/property stages, growth and assumption override tests, retirement snapshots and report parity. UI adapter source guards and future numerical fixtures can legitimately change. Affected users may see hundreds of thousands less projected property wealth; current main balance-sheet totals may be unchanged.

## P4 — Include canonical scheduled debt in every intended balance sheet (F04)

**Files/functions:** `calculator.js` `netWorthProjection`, `calculateNetFiAssetSummary`/linked-debt selectors as needed; `app.js` `projectedDebtAtYear`, `renderReportCharts`, report outlook, dashboard debt chart and Decision comparisons; `semiRetirementUi.js` `applyRetirementForecast` debt/provenance contract. Prefer a shared result-level projected liability series over independent ad hoc subtraction in each renderer.

**Expected behaviour:** gross property value minus its actual scheduled debt; interest and principal remain distinct cashflows; year-zero and future debt cover the same declared liability population. Do not subtract the loan twice if net property equity was already used. Handle home/investment/other debt links, repayment types, offsets and paid-off balances consistently. Report a missing/unknown debt as unknown with a warning rather than zero.

**Acceptance:** after P3, $600k property at 3% and $350k 6% IO loan has year-one $618k gross/$350k debt/$268k net; report debt $350k, not zero. At 1%/3%/5% applicable growth: $256k/$268k/$280k net. In today's dollars at CPI 2.5%: $261,463.41 net and $341,463.41 debt. For P&I replace IO balance with the independently derived loan-annuity close; principal repayment reduces debt once. A fully repaid loan becomes zero only when its schedule settles it. Current totals remain $250k net at time zero.

**Risks/tests:** loan/property stages, loan-zero-balance and financial-report presentation suites, screen/PDF chart data, canonical authority, gross-vs-net FI invariants. No schema change if exposing a derived debt series; new output fields still affect serialised golden snapshots. Protected calculator and app functions may change. Legacy forecast wealth falls by outstanding omitted debt; linked wealth need not change if its detailed debt ledger was already correct, but its report debt chart must change.

## P5 — Repair retirement start dates, account return selection and labels (F07)

**Files/functions:** `calculator.js` `rowAtAge`, sustainability starting-pool selection, return weighting, `simulateRetirement`, `maximumLifestyleDraw` horizon; `semiRetirementUi.js` `applyRetirementForecast`; `app.js` simple sustainability/report/checkpoint consumers. A perpetual weighted return is not a substitute for account-specific funding once withdrawals shift weights.

**Expected behaviour:** retirement at the present instant starts with actual opening accessible balances; future starts use the close immediately preceding that instant, with no extra accumulation year. Each owner's super is accessible only under approved access assumptions. Separate investment/super account rates through withdrawals; maintain correct horizon and age labels. Pre-60 retirees need explicit bridge funding rather than labelling age-60 assets as age-55 starting wealth. Missing historical age-60 data stays missing.

**Acceptance:** no-flow current $500k super at effective annual 6.5%, retiring at 65 → start $500k; age-70 $685,043.33. If the detailed snapshot explicitly uses retired 5.5%, corresponding $653,480.00; do not force these unequal assumptions to match. At zero returns, $200k investments + $500k eligible super, $40k annual beginning-of-year spending for five years → $500k combined, with accessible-first draws leaving $0/$500k. A 65/55 couple with $300k/$400k super starts with only $300k eligible; no historical balance is invented for a checkpoint labelled age 60. Horizon to 90 from 65 must represent 25 completed annual intervals, not an unlabelled extra year.

**Risks/tests:** retirement exhaustion/timing, new-plan defaults, per-owner access, mixed ages and saved scenario compare/export. Existing simple illustration labels/keys may need a versioned output change; do not change saved retirement input snapshots to manufacture parity. Calculator/adapter guards and milestone/sustainability golden values will change. Existing users' simple illustrations can materially fall; a detailed funding forecast may remain unchanged unless the old adapter also chose a wrong start.

## P6 — Separate income identity from dividend tax character (F03/F05)

Keep this as two independently reviewable PRs if scope grows: **P6a income identity**, then **P6b franking**, both using P1/P2's funded-tax contract.

**Files/functions:** `calculator.js` `investmentReturnAmounts`, `normalisedIncomeItems`, `rawNormalisedIncomeItems`, `investmentIncomeReviewItems`, dividend migration, `incomeBreakdown`, `householdTaxEstimate`; `semiRetirementUi.js` `projectionPassiveIncomeFromPlan`; detailed `projectPassiveIncomeRows`/person tax; `linked-setup.js`, `plan-schema.js`, backup/import and income editor fields in `app.js` as necessary.

**Expected behaviour:** establish whether a dividend/distribution is a reference to a configured holding's yield or economically separate. Preserve both cash and taxable components. A confirmation field is not proof of a matching asset without a declared user-input contract. Add eligible gross-up and tax offset/refund separately from ordinary cash dividends and do not reduce capital growth by a refund. Reinvested dividends remain taxable; cash/yield must not be retained twice.

**Acceptance:** $500k at 7% total/3% yield gives $35k total, $20k capital and $15k income. Cash treatment retains $20k and pays $15k; reinvest retains $35k and pays no cash; linked reference cannot add another $15k. A genuine separate $15k source is allowed to raise total economic return to $50k. Eligible resident $7k dividend/$3k credit: taxable $10k, cash dividend $7k, refund $3k if no other tax, total post-settlement cash $10k. At salary $100k and full hospital cover, cash after total ordinary tax/refund is $84,280; tax liability before credit at taxable $110k is $25,720. Test partial franking, ineligible/nonresident cases and joint ownership with independently allocated cents.

**Risks/tests:** legacy grossed-up-only records, linked references, ownership and confirmed-separate records need evidence-preserving migration, not automatic yield inference. Keep raw historical income plus conversion metadata; do not change cash dividend to grossed-up income. Tests: investment split, franking/refund settlement, tax/HELP/MLS threshold add-backs, saved scenarios, linked editor, backup/export. Hashes and current/future golden values change for affected income records. Refund handling can increase cash, while gross-up can also increase Medicare/HELP/MLS; net impact is household-specific.

## P7 — Bound and extend tax/super/pension applicability (F06/F09)

Split into **P7a Division 293/contribution eligibility**, **P7b pension/Medicare policy**, and later specialist features. Do not introduce a general tax engine rewrite into a single correction.

**Files/functions:** calculator rule configuration, contribution-tax totals, person income/add-back calculation; detailed `refreshSuperContributionTotals` and funding state; `agePensionEstimate.js` dated rules/indexation/assessment/SAPTO; Medicare helpers; `semiRetirementUi.js` applicability, fees and account-phase fields; `app.js` disclosures/unsupported results and exports.

**Expected behaviour:** calculate Division 293 on the relevant threshold excess, then fund it once from the selected source. Validate or clearly exclude cap/carry-forward/notice/age cases. Ordinary 15% contribution tax must remain distinct from LISTO, additional tax, fund earnings tax and member withdrawal tax. For pension, version rules by component/effective date, retain both means tests and super exemptions, model or exclude senior/family levy reductions and specialist eligibility. Future annual CPI indexing and held tax thresholds must remain labelled assumptions unless a different policy model is approved.

**Acceptance:** salary $230k, concessional $27,600 → excess $7,600 and additional $1,140; $245k/$29,400 → additional $3,660; $300k/$32,499.60 → additional $4,874.94. Below-threshold control must owe zero. Cap $32,500 does not imply a contribution above it is invalid if documented carry-forward applies. Under stated LISTO eligibility, a $30k salary/SG $3,600 has ordinary $540 contribution tax and a separate up-to-$500 government credit; do not call $3,060 the full net benefit without scope qualification.

Pension tests: homeowner single assets $433k/income zero → $24,380.20 under checked schedule; mixed-age eligible couple at $599k assets → $20,358 for one eligible partner. Single income $15,876 → $27,180.20; deem $100k single at `$66,800×1.75% + $33,200×3.75% = $2,414`. Current maximum $32,180.20 is not CPI-grown before year zero. Compare independently verified senior Medicare thresholds before asserting a concession amount; the current $230.76 ordinary levy example identifies scope, not a complete current threshold schedule. Test age 66/67, one partner under 67 accumulation versus income stream, work bonus assumptions and nonhomeowner tables.

**Risks/tests/hashes:** tax law applicability and engine dates can change saved scenario results even when input snapshots are unchanged. Provide rule-date/version metadata and an unsupported-state contract. Extend tax-integration, age-pension/SAPTO, contribution events and all golden/hash guards actually reached. Division 293, LISTO or pensioner Medicare changes can move cash and super in opposite directions depending on payment source. Never reclassify pension-age super as exempt earnings automatically.

## P8 — Support downside returns and complete account exhaustion (F10)

**Files/functions:** `calculator.js` `investmentReturnValidation`, split-return functions and allocation; `forecast-assumptions.js`/view validation; detailed investment/super earnings, fee application, withdrawal settlement and reconciliation; `growth-scenarios.js` overlay validation; explicit-holding editor in `app.js`/`linked-setup.js`.

**Expected behaviour:** allow negative capital returns with positive distributions; define lower bounds for total loss and nonnegative cash yield; decide whether returns are sampled as total or as capital-plus-income components. Fees, cash yield and withdrawals must preserve the same economic identity through depletion. A depleted account cannot be revived by multiplying a negative base, and refunds/contributions must be explicit funding events. Negative aggregate support is necessary but not sufficient proof of robust explicit-account support.

**Acceptance:** zero flows, $500k, total −20% and cash yield 3% → total economic loss $100k, capital loss $115k, cash $15k, retained balance $385k; retained plus cash $400k before tax/fees. Reinvest gives $400k and zero cash. No-flow total −100% gives zero economic value under a consistent yield/capital model, not a negative account. Aggregate midpoint $500k/$40k spending/−20% produces $364k, but explicitly label timing. For zero return/zero fees, $10k liquid/$20k eligible super/$40k required cash → $10k unmet, not fabricated wealth. Repeat with restricted super: liquid drawn $10k, super remains $20k, unmet $30k. Test losses before/after cash withdrawals under the selected sequencing; do not assume every convention yields identical exhaustion timing.

**Risks/tests:** expanding validation does not require rewriting valid existing saved rates. Invalid prior drafts remain reviewable; new return-domain metadata may require schema defaults. New downside goldens must come from independent ledgers. Existing positive examples should retain behaviour except where P0's approved rate basis changes it. Explicit-holding/split functions, retirement guards and assumption validation hashes will change. Users may see earlier depletion; that is the purpose of correct downside support.

## P9 — Deterministic release gate before stochastic implementation

No random-return engine changes until P1/P3/P4/P5 and P8 have independent conservation evidence, P0 conventions are approved, and tax applicability from P6/P7 is either implemented or enforced as exclusions. Correct F11 before claiming property/pension parity. Require zero unexplained material deltas across the same households at the same instant and scope. Confirm signed tax balances, cash deficits, refunds, fees, loans and restricted accounts under loss/exhaustion cases.

Then a separate design/implementation PR may select a stochastic calibration: distribution/time step, serial dependence and correlations, income/capital split, inflation, account-specific returns, fee/tax scope, longevity, policy uncertainty, success definition, seed and convergence error. Acceptance must include zero-volatility equivalence to the approved deterministic model, exact replay under a seed, reproducible account-ledger paths, independent severe-loss sequences and changing-owner access dates. A random seed cannot compensate for wrong deterministic starting assets.

## Saved plans and projection-risk controls across all PRs

1. **Inputs and results are different artefacts.** Financial Plan snapshots, saved retirement input drafts, stored summary/key-result snapshots and historical progress records must be inventoried separately. `loadRetirementScenarioSnapshot` reruns the current engine; a stored summary may remain historical. Store calculation/rule version, input revision and timestamp for each displayed outcome.
2. **Never overwrite user intent to fix a formula.** Preserve original snapshots/backups. Expose corrected recalculation as a new revision with an explicit old/new delta and reason. Mark historical faulty results as historical/affected, rather than silently treating them as correct or deleting them. Do not retain a known-wrong current result merely to keep old hashes green.
3. **Do not guess legacy semantics.** Return basis, duplicate property identity, linked dividend references, pension phase, cost bases, tax eligibility and actual tax payment dates may be unknown. Use targeted review/unsupported states where necessary. Equal balances or names alone are not identity proof.
4. **Backups/imports must preserve additive metadata.** Test old backups, explicit zero, inactive canonical records, optional unknown fields and saved scenarios with omitted settings. Failed migration/recalculation must leave the original accessible and avoid partially saved updates.
5. **Separate actual history from estimates.** Completed Weekly actuals and historical snapshots must not be retroactively rebuilt to match a new forecast. Future calendar lines and newly calculated outcomes can change with approval and clear provenance.
6. **Make risk review concrete.** Each financial PR must include impacted household IDs/amounts, intended unchanged examples, eligible/excluded populations, guard/fixture changes and rollback/read-only compatibility. Review those exact artefacts before asking to approve implementation or merge. No such approval is presumed from this review request.
