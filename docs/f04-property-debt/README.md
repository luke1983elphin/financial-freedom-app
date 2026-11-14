# F04 — Retain property debt in projected net worth and report debt

Implementation baseline: main `0e9a6a4c007e47dc83f2ece7832b986755cb597d`, after merged F08 PR #62. Branch: `fix/f04-property-debt-net-worth`. The user instructed “Please commence F04 correction.” This authorises this focused correction and its independently reconciled protected/golden updates; no merge, deployment, F07 or F11 implementation is included.

**This is a Draft correction for independent review, not an overall financial-model sign-off.** F11 property duplication and a separately confirmed detailed study-loan net-worth omission remain unresolved. Monte Carlo remains on hold. Main Git deployment stays disabled, and this Draft branch is also explicitly excluded from Vercel Git deployment.

## Confirmed defects and implementation

The legacy calculator included gross projected property value but omitted rental-property loans when deriving future net worth. Its current balance sheet included ordinary rental loans. Thus the same $600k property/$350k debt could jump from $250k current net worth to $618k future net worth after only $18k capital growth. Separately, the app's report/chart/decision debt helper omitted property loans even when detailed retirement had correctly scheduled and subtracted them.

The correction introduces a common result-level debt selector, `FFSCalculator.projectedDebtAtYear`, with debt-model identifier **`2026.27.1-f04`**. Tax calculation version `2026.27.3`, input schemas and detailed retirement engine version `2026.27.4-f08` remain unchanged.

| Source | Correction | Deliberately retained conventions |
| --- | --- | --- |
| `calculator.js`, `projectedRentalPropertyDebt` | Active, first-ID-wins canonical property-loan records; independent remaining balance for each loan; no re-addition of aggregate mirrors | Existing annual linked-loan scheduling, monthly P&I rounding, explicit IO principal reductions |
| `calculator.js`, current rental debt / net-worth rows | Include canonical property debt in current liabilities and subtract remaining property debt once from future gross wealth | Home-loan schedule, held other-debt/card balances, legacy HELP estimate, investment/super returns, tax and contribution rules |
| `calculator.js`, `projectedDebtAtYear` | Legacy results use their home/HELP/other balances plus scheduled property debt; linked results use the detailed year's actual non-study liabilities plus each owner's closing study debt | No second subtraction from detailed net worth; no new borrowing, repayment or tax rules |
| `app.js`, `projectedDebtAtYear` | Dashboard/report/Decision debt consumers delegate to the same selector | Dollar conversion still happens only at presentation |
| `app.js`, debt labels/chart | Outside a detailed horizon, text and saved-scenario comparisons say “Outside projection” and the debt chart omits unavailable points | No zero or legacy-engine fallback presented as detailed debt |
| `app.js`, report copy | Remove the now-incorrect property-debt-omission disclosure; explain included remaining loans and retained-property liquidity | Does not claim that property equity automatically funds retirement |
| New Financial Plan / Decision result snapshots | Add `debtProjectionVersion` metadata | No overwrite/migration of old saved inputs or historical results; existing explicit save/open behaviour remains |

Relevant source boundaries: [property debt](../../calculator.js#L2279), [result debt selector](../../calculator.js#L2289), [app selector/formatting](../../app.js#L1693), [report chart](../../app.js#L15369), [Decision result metadata](../../app.js#L15800), [Financial Plan result metadata](../../app.js#L16232). Line positions are for this branch; function names are authoritative.

The supported legacy property-debt population is `rentalPropertyLoan`, plus `investmentLoan`, `shareInvestmentLoan` and `managedFundLoan` when explicitly linked to an active supported property asset. Home/credit-card/otherDebt/STSL categories retain their existing population and rules; a security link does not cause them to be charged a second time as rental debt. Detailed debt uses the already-selected detailed ledger, including its supported liability types, owner HELP balances, offsets and balloon settlement. This is not a rewrite of every custom liability category or every legacy aggregate-authority rule.

## Independent acceptance arithmetic

The acceptance tests specify expected balance sheets independently of the production debt helper. P&I expectations use a separate monthly cents ledger: interest is opening interest-bearing principal × annual rate / 12; a payment reduces principal after interest; the final payment is capped at principal plus interest. The independent fixture review also checks each complete old calculation against an expected copy changed only by independently scheduled outstanding property debt.

| Case | Expected result |
| --- | --- |
| $600k property, 3% growth; $350k loan at 6% interest-only, $21k interest paid | Current net worth $250k; year-one gross $618k, debt $350k, net worth **$268k** |
| Same, 1% / 3% / 5% growth | Year-one net worth **$256k / $268k / $280k** |
| Same, CPI 2.5% | Year-one today's net worth **$261,463.41**, debt **$341,463.41**; each nominal amount deflated once |
| $350k, 6%, $30k annual P&I payments | Independently amortised principal at years 1/2/5/10/20/30; each future net worth equals independently grown gross property less that principal |
| $10k loan, 0%, $6k annual P&I payments; $600k zero-growth property | Year-one debt $4k/net worth $596k; year-two final debt $0/net worth $600k |
| $350k IO plus $10k explicit annual extra principal | Debt $340k after year one, $330k after year two; year-one net worth $278k |
| Additional $100k zero-interest P&I loan, $12k yearly payment | Combined year-one debt $438k; net worth $180k |
| Duplicate ID plus inactive/deleted copies of the same rental loan | One $350k liability, not multiplied or resurrected; current net worth remains $250k |
| Canonical field aliases (`category`, `currentBalance`, `repaymentAmount`) | Same $350k debt and $268k year-one net worth |
| Investment-loan category explicitly linked to this property | Same balance sheet; no second deduction from liquid FI assets |
| Zero balance with a stale nonzero payment | No resurrected debt; year-one net worth $618k |
| $800k IO debt against the $600k property | Negative year-one net worth **−$182k**, not clipped to zero |
| Home $800k, offset $50k and home debt $200k, alongside this rental | Offset remains an asset; home principal follows its independently derived offset-aware schedule; property debt is added once |
| Linked forecast with two-year IO term | Report debt $350k after year one and zero after actual year-two balloon settlement, instead of stale legacy debt |
| No-property control | Existing home/HELP/card/other-debt conventions remain; no invented property debt |
| Detailed year beyond the model horizon | `null` from the selector, “Outside projection” in text; no zero debt chart point |

There are **26 focused unit tests** covering these cases, repeatability and input nonmutation. The same code also exercises report delegation, actual detailed row alignment, supported loan-category variants and the explicit F11 non-correction control.

## Financial impact and fixture review

[deltas.json](deltas.json) contains every changed leaf field, original/corrected values, original archive hash and raw-source guard provenance. It is produced by `scripts/f04-review.mjs`, which reads the original synthetic 48 audit inputs from immutable audit revision `56a3eb336f4cde204f158c4d471a849e814bbfe8`. Household input payloads are not duplicated in this PR.

- **45 of 48 audit households are identical.** Only H22, H23 and H24 change, with 30 future net-worth fields each. H22 year one is $618k → $268k. H23/H24 have debt without the corresponding asset; year one is $0 → −$294k, reaching −$120k at year 30. The loan is not erased because gross assets are zero. H47/F08 is unchanged.
- **Six of nine complete sample fixtures are identical.** `established-family-wealth-building` has 21 changed legacy net-worth rows, `pre-retirement` has 15, and `couple-property-offset` has 30: **66 fields total**. First-year results are respectively $2,688,433.11 → $2,287,466.96; $4,229,855.65 → $3,980,432.85; and $1,375,853.33 → $1,128,425.60.
- For all nine, input drafts, detailed retirement outputs and earlier-retirement scenario outputs are **exactly identical**. The reviewed full legacy result differs only by independently computed property principal; it does not alter cashflow, tax, investments, super, FI wealth, sustainability or returns.
- The populated case in each of `investment-ux-parity.json` and `investment-return-legacy.json` has 30 changed legacy net-worth rows and one corresponding SHA update. Their simple cases are unchanged. Full original hashes reproduce before applying F04; all detailed saved-scenario outputs remain exact.
- The original full F08-era fixture and both investment expectation files are retained byte-for-byte as `*.pre-f04.*`. F08's older archives are untouched. R2 numerical-parity and age-pension-off fixtures are unchanged.

The oracle is separate arithmetic, not `expected = correctedEngine(...)`. It constructs the expected result by adjusting only each original net-worth row by its independent loan balance, and then compares the **entire** result. Unexpected field changes fail. `--apply` is explicit and updates only these verified expectations and raw-source-checked guards.

`tests/fixtures/ux-stage1-protected.json` records the whole calculator file and ten changed/new app function hashes, comparing baseline source with any previous recorded expectation. No guard exemption or tolerance is added. The active dollar-basis report/comparison renderers and new unknown-debt formatter are guarded too. A temporary deliberate change to `projectedDebtAtYear` was rejected by the normal protected-function test; `app.js` was restored byte-for-byte, and the altered source is not committed.

## Browser, saved-data and PDF evidence

[browser-evidence.json](browser-evidence.json) records a real Chromium run under the repository CSP for three routes:

1. Legacy `investmentProperty`: corrected year-one net worth $268k; report chart debt $350k at years 1 and 10; Lower/Base/Higher with explicit overrides included produces $256k/$268k/$280k. Keeping overrides excluded intentionally retains the asset's own rate.
2. Linked `otherProperty` control with an explicit 3% rate: the detailed net-worth result stays $268k; report debt is corrected to the actual $350k scheduled balance.
3. Ordinary linked `investmentProperty` with its normal legacy mirror: report debt is $350k once, but net worth remains **$868k because F11 is not fixed**. The test explicitly detects that surviving error.

Nominal results stay unchanged when toggling Today's/Future Dollars. The report chart discounts $350k once to $341,463.41 after one year. Actual PDFs are text-checked for corrected year-one net worth ($261,463 in the two nonduplicating routes) and ten-year discounted IO debt ($273,419). The F11 route still prints its incorrect $846,829 today's year-one net worth; this is documented rather than mistaken for a passing wealth forecast.

The browser check seeds a historical saved result, generates the newly versioned Financial Plan result, and verifies that stored history is byte-identical. The existing complete browser suite additionally exercises actual saved-scenario save/open flows and F08 tax-funding/report/PDF acceptance. There is no bulk saved-data migration, old-engine replay or automatic rewriting of historical cards. Opening/recalculating existing plans can show lower corrected future wealth; only an explicit save records new results.

## Material remaining limitations

**F11 remains a separate asset-identity defect.** The realistic mirrored linked-property case is still overstated by $600k in year one. This PR fixes the loan omission, not duplicated property assets. Fix and independently review F11 before signing off property forecasts as a complete system; do not attempt to cancel duplicated assets with another debt subtraction.

**Detailed net worth still omits remaining owner HELP balances.** A separate control with the nonduplicating $600k property, $350k rental loan and $10k HELP has current net worth $240k. Both baseline and F04 detailed year-one net worth are $268k; independently including the $10k remaining HELP gives **$258k**. The new debt selector correctly reports $360k. See [study-loan-limitation.json](study-loan-limitation.json). Detailed `household.totalDebt` excludes study loans, which are tracked on people; its unchanged net-worth formula does not deduct that separate balance. This is a confirmed pre-existing financial inconsistency, not an introduced F04 delta. It needs a separately authorised correction and its own protected/golden review.

**Existing debt-policy limits are retained.** The legacy forecast retains its existing home schedule, HELP repayment estimate and static other-debt/card assumptions. IO additional-principal timing and interest-underpayment behaviour are existing conventions; this PR does not implement an arrears ledger or harmonise IO balloon rules between the legacy and detailed models. Canonical unknown/missing balances, unsupported custom loan types and ambiguous imported aggregate-only rental debt still need input validation/applicability work; a zero/default input is not evidence that a real debt is paid. Do not reinterpret those unsupported inputs as newly certified by this fix.

F07 retirement starting balances/return selection, F01/F02 return conventions, tax limitations and negative-return readiness remain unresolved. This PR neither implements Monte Carlo nor provides a GO decision for it.

## Reproduction and validation

```sh
pnpm run test:f04
pnpm run test:browser-f04
node scripts/f04-review.mjs
node --test tests/ux-stage1.test.mjs
pnpm run verify
pnpm run test:browser
```

The review script needs the baseline and immutable audit commit available locally. It is read-only for protected expectations unless `--apply` is supplied; it writes the review evidence JSON. Browser tests require Chromium and Poppler `pdftotext`. No dependency or lockfile change is required. Runtime: Node 24.22.1 / environment pnpm 11.25.0; repository declaration is pnpm 11.19.0. GitHub CI uses the repository's pinned environment.

Final counts, fixture hashes and guard checks are recorded in [verification-summary.json](verification-summary.json) after the complete final runs. Initial acceptance tests failed on the original omission. An initial full run was stopped at the stale large-golden comparison so its deltas could be bounded and independently reconciled before updating; it is not reported as a pass. Final verification uses the reconciled expectations without weakened assertions. Generated unrelated browser screenshots are restored before publishing.

Keep this work Draft for independent technical/financial review. Do not merge, deploy or silently include F11/F07/HELP changes under F04.
