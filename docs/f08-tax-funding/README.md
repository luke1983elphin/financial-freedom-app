# F08 — Fund detailed-retirement tax deficits

Implementation basis: latest main `6f3dbf83cc744e765eddf6244313635ea357bc9a`. Review basis: [Draft PR #61](https://github.com/luke1983elphin/financial-freedom-app/pull/61), especially its [second-stage correction plan](https://github.com/luke1983elphin/financial-freedom-app/blob/56a3eb336f4cde204f158c4d471a849e814bbfe8/docs/audit-2026-11-13/stage2/ROADMAP.md). PR #61 remains an unchanged audit record. This correction has its own branch, `fix/f08-retirement-tax-funding`, with Git deployment disabled for that branch.

The user authorised proceeding with the proposed F08-only correction, including the necessary independently reviewed protected-guard and fixture changes. This does not authorise implementing the other audit findings, merging or deploying.

## Problem and corrected behaviour

Detailed retirement previously calculated a person's income tax, Medicare, MLS and HELP, then floored that person's after-tax cash at zero before pooling household cash. Reinvested income could produce a tax liability but no cash distribution; the resulting negative cash disappeared. Available investments/super were never asked to fund it, and a household with no funds could show no required shortfall.

`semiRetirementProjection.js` now preserves signed after-tax person cash in both the ordinary tax calculation and the pension/SAPTO recalculation. The existing household pooling and withdrawal waterfall then:

- uses spouse/household cash first;
- draws available accessible funds, respecting reserves and offsets;
- uses super only at the selected owner's permitted access age;
- records any remaining requirement as unmet cashflow.

The correction does not introduce a second tax charge. It changes neither tax rates nor taxable-income rules. It does not change returns, fees, cash-yield timing, contribution tax, access rules or withdrawal order. Existing **annual midpoint** earnings/withdrawal timing is retained. A zero-value account is not treated as having paid a liability; a residual requirement is reported as unfunded.

The existing output field names `unmetRequiredLifestyleSpending`, `unmetSpending` and summary shortfall fields remain for compatibility. Their amounts include the required tax cashflow that was previously lost. They record unmet annual needs rather than creating a new borrowing or tax-arrears account. The visible metric now says **Unfunded required cashflow**, with an explanation that required taxes and other cash needs are included. Tax-related insolvency gets a corresponding warning.

## Independent acceptance amounts

These amounts come from independently specified cash ledgers and the configured ordinary 2026–27 resident tax schedule, not from regenerated regression expectations. At $60k taxable income: income tax before offsets $8,520, LITO $100, Medicare $1,200 → **$9,620** total; no MLS, HELP or specialist concessions unless stated.

| Case | Required result |
| --- | --- |
| $100k opening assets; zero return/spending; $60k taxable noncash income; zero cash receipts | Signed cash −$9,620; withdraw $9,620; close $90,380 |
| Same, $5k cash receipts | Signed cash −$4,620; withdraw $4,620; close $95,380 |
| Same, $20k cash receipts; enjoyment surplus | No portfolio draw; close $100k; $10,380 enjoyment surplus |
| Same taxable owner plus $100k working spouse with full cover | Household net $67,860 = $100k − $22,520 − $9,620; no forced portfolio sale |
| No accessible or eligible super funds | Explicit $9,620 unmet requirement, first shortfall in 2026 |
| $1k accessible and $20k eligible super | Withdraw $1k accessible and $8,620 super; super closes $11,380 |
| $10k accessible, $9k reserve, $20k restricted super at age 59 | Withdraw $1k; retain $9k reserve/$20k super; unmet $8,620 |
| $40k lifestyle spending plus $9,620 tax | One combined $49,620 draw; $100k closes $50,380 |
| $20k offset cash with a linked zero-interest loan | Offset draw $9,620 once; remaining offset $10,380; account reconciles |
| $120k taxable noncash income, uncovered single with HELP | Ordinary tax/Medicare $28,920 + MLS $1,200 + HELP $7,570.80 → draw $37,690.80; $100k closes $62,309.20 |
| Zero-return $60k taxable-income case repeated in 2027–28 | Next-year tax $9,352; after both years $100k closes $81,028 |

The no-cash $2m reinvested holding at 7% total/3% yield recognises $60k opening-year taxable income. With zero fees:

`$2,000,000 − $9,620 + ($2,000,000 − $9,620/2) × 7% = $2,130,043.30`.

Previously it closed at $2,140,000. The $9,956.70 difference includes the $9,620 tax and $336.70 less midpoint investment earnings. This is deliberately **not** the $2,130,380 year-end-tax alternative from the audit's discussion of possible conventions. At an explicit 1% fee, the same midpoint basis earns $139,663.30 and costs $19,951.90, closing at **$2,110,091.40**. No blanket tax deduction is applied to the 7% return.

The pension-enabled test uses zero entitlement and excludes SAPTO to isolate the ordinary $9,620 tax through the second calculation path. Existing positive-pension/SAPTO tests remain in the full suite. Eligibility, franking, Division 293 and CGT limitations are not expanded by this fix.

## Saved plans and existing projections

Projection engine version is now **`2026.27.4-f08`**, exported by the detailed engine and stored as additive `keyResultSnapshot.projectionEngineVersion` metadata on newly saved retirement results. Main calculator version and saved input schemas are unchanged.

Opening a scenario with an older/missing projection engine tag recalculates using the corrected engine and explains that saved inputs and previous results remain unchanged until the user saves a new scenario. The notice does not block opening or automatically save. An explicit new save records the corrected result/version alongside the original scenario. Browser acceptance verifies original stored input/result bytes are unchanged by opening, and a new result can be saved and reopened reproducibly.

Detailed retirement scenarios and main-plan forecasts/comparisons that use the detailed retirement engine may have lower balances, less surplus or earlier shortfalls. Historical stored summaries remain historical; reopening produces a corrected calculation. This is not a bulk migration, deletion of previous results, or a claim to execute old financial engines for historical replay.

The original 48 audit households were run side-by-side under pinned old and corrected source. **47 are identical. H47 alone changes**, from signed cash $0/draw $0/close $2,140,000 to −$9,620/$9,620/$2,130,043.30. See [audit-impact.json](audit-impact.json). Main accumulation H41 remains unchanged: settling its visible deficits and reconciling Weekly investment tax is a separate authorised-scope decision, not silently included here.

## Protected calculations and golden changes

The only financial formula change is removal of the two per-person zero floors in the detailed engine. Additional engine changes provide a version identifier and a tax-related unmet-cashflow warning. `app.js` changes result wording, saved-result version metadata and the reopening notice. Calculator, pension rules, retirement adapter, Weekly formulas, schema, defaults and return conventions are unchanged.

The protected engine hash and the four touched app function guards are updated with old/new hash provenance in `tests/fixtures/ux-stage1-protected.json`. The active dollar-basis longevity renderer is additionally guarded; no existing guard is removed or tolerance relaxed.

Nine complete financial fixtures were compared field by field. Seven sample-plan records are identical. Only the **single** and **couple-property-offset** synthetic investment-return records change, in their detailed retirement and earlier-retirement scenario results after an owner's cash goes negative. Main calculations and input drafts match exactly for all nine. The updated outputs independently reconcile **948 annual projection rows**, checking ordinary tax, signed person/household cash, asset/super movements and funded/unmet requirements. [golden-deltas.json](golden-deltas.json) records the first affected year, owners, closing assets and horizons.

These stress fixtures have pre-existing synthetic horizons, including an age-zero named partner in the fixture called “single,” which extends its older person's end age to 133. Their very large terminal balances/deltas are not typical household impact estimates and are not repaired by F08. The machine-readable evidence includes actual horizons/ages rather than concealing them. The $2m and zero-return cases above give bounded, independently specified impacts.

The two older configured-investment full-output SHA fixtures also change once owner deficits arise. [investment-ux-deltas.json](investment-ux-deltas.json) records original/corrected hashes and first affected values. Their old outputs reproduce the original hashes exactly before correction; current main calculations and drafts remain identical.

Historical fixture contents are retained as `ux-stage1-before.pre-f08.json.gz` and `investment-ux-parity.pre-f08.json`. The age-pension-off baseline (30 households, omitted/disabled settings), main numerical parity files and every unrelated source guard remain unchanged. Fixture expectations were changed after the independent funding tests and bounded field-level reviews, not to preserve or hide an incorrect calculation.

## Verification and reproduction

See [verification-summary.json](verification-summary.json) for final counts and hashes. Commands:

```sh
pnpm run test:f08
pnpm run test:browser-f08
pnpm run verify
pnpm run test:browser
node scripts/f08-audit-impact.mjs
node scripts/f08-fixture-review.mjs
node scripts/f08-investment-ux-review.mjs
```

The review scripts need the pinned main and audit commits locally (`git fetch origin main audit/financial-model-before-monte-carlo` in a shallow checkout). The impact script reads the existing synthetic fixture from audit commit `56a3eb3`; household input payloads are not duplicated in this correction PR. Scripts are read-only by default except for evidence JSON; `--apply` on the two fixture scripts is an explicit controlled golden-update operation. The historical fixtures remain untouched. Browser tests require Chromium and `pdftotext` (Poppler); no package/lockfile dependencies were added. [browser-evidence.json](browser-evidence.json) records saved-history preservation, engine version, the tax-only shortfall and the actual corrected report/PDF values. Nominal results are unchanged by Today's/Future-dollar switching; the report/PDF discounts $2,130,043.30 once to **$2,078,091** at 2.5% CPI.

Final local results: **64 suites / 1,263 tests**, zero failures/skips/cancellations/TODO; **53 browser tests**, zero failures/skips/cancellations/TODO. Fifteen new independent F08 tests and one saved-version test are included. Full verification covers inventory, syntax, security/CSP, runner/scanner self-tests and guarded/golden parity.

Before the correction, the new funding tests reproduced the zero-floor failures. An initial full run against the stale large golden terminated with exit 137 while comparing that mismatch; a bounded field-level review was then used to identify the two affected records. Expected guard/hash failures and the two configured-investment hash failures were reconciled with provenance. Final full verification passes without weakening checks. Browser setup was adjusted to respect the existing UI end-age range (80–110); no production validation was relaxed.

Runtime is Node v24.22.1 and environment pnpm v11.25.0 (repository declaration 11.19.0); task-local pnpm/XDG/COREPACK paths were used. Regenerated unrelated browser PNGs were restored to main. No merge, deployment or Monte Carlo implementation is part of this change. Other findings from PR #61 remain unresolved, so this correction alone does **not** make the model ready for Monte Carlo.
