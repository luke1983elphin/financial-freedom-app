# Issue #95: property growth comparison audit

## Findings

Identical property equity is not, by itself, evidence that growth scenarios failed. The existing contract holds explicit asset growth overrides fixed unless the user opts in. The reported $529,857 can be reproduced under that contract; the user's private plan and screenshot totals were not accessed, so this is a synthetic reproduction rather than a claim about their exact inputs.

Three defects were found:

1. With saved retirement timing, Other property uses a preserved 0% fallback when no individual rate exists. The comparison's opt-in removed an override but did not apply the selected scenario rate, causing every opted-in scenario to use 0% instead.
2. The assumptions property catalogue omitted residential, commercial and income-producing property aliases, even though the engines project them. Their overrides could neither be explained nor included correctly.
3. Canonical investment-property records and the matching `assets.otherPropertyValue` legacy aggregate were both mapped into new retirement drafts. This added a phantom property and overstated equity, net worth and remaining wealth. Canonical property records now suppress the aggregate fallback for their bucket, including zero/deleted records. Aggregate-only legacy plans still work.

## Behaviour

- Fixed overrides remain fixed by default. The existing Other property 0% retirement fallback also remains fixed by default and is explicitly identified.
- “Apply scenario rates to fixed assets” applies the selected comparison rate, including to Other property and aggregate-only legacy property. This changes a cloned comparison plan only.
- Every scenario shows each property's actual rate and whether it is fixed or varied. All supported property aliases appear in the catalogue. Gross value is not labelled as equity.
- Loan principal, interest, repayment settings, inflation, tax and Age Pension formulas are unchanged. There is no saved-data migration. Historical retirement snapshots retain their original assets and outcomes, including any historical duplicated inputs; new live drafts use the corrected mapping.
- Growth comparisons remain temporary and are not added to plan PDF exports. Saved retirement reports continue to use saved snapshot inputs rather than a comparison overlay.

## Reproducible year-15 example

Use one property worth $600,000, an explicit 3% growth rate, a $167,389.53 linked interest-only loan at 0% interest (no repayments), saved retirement timing, and 2.5% inflation. The unusual loan amount is chosen to reproduce the reported rounded equity, not inferred from user data. Suggested property rates are 1%, 3% and 5%.

Today's-dollar equity is `(projected gross value - outstanding loan) / 1.025^15`. Retirement rows preserve their existing annual cents rounding. In this isolated fixture, net worth equals property equity.

| Other property behaviour | Lower | Base | Higher |
| --- | ---: | ---: | ---: |
| Fixed 3% override, before and after | $529,857.01 | $529,857.01 | $529,857.01 |
| Apply scenario rates, before (incorrect 0% fallback) | $298,702.63 | $298,702.63 | $298,702.63 |
| Apply scenario rates, corrected | $365,388.74 | $529,857.01 | $745,680.28 |
| Corrected future-dollar equity | $529,191.84 | $767,390.93 | $1,079,967.38 |

The corrected investment-property classification gives the same values. Previously, mapping both the canonical property and its $600,000 aggregate added $414,279.33 of phantom today's-dollar wealth at year 15. Mortgage balances never vary with the growth bands.

## Verification and review limits

The regression matrix covers all seven non-home classifications with/without retirement timing, fixed overrides, opt-in, inherited rates, Other property zero fallback, linked debt, both dollar bases, removed/zero canonical properties and historical snapshots. Browser tests check desktop/mobile tables, cards, chart values, actual-rate disclosures, untouched My Plan data, saved scenarios and PDF export paths.

The previous nine-fixture numerical baseline is retained as `tests/fixtures/ux-stage1-before.pre-issue95.json.gz`. Seven fixtures remain identical. Two fixtures lose only their duplicated $690,000/$760,000 property balances. An independent reconciliation subtracts those amounts from property equity/net-worth/remaining-wealth fields and removes the duplicate records, then compares every other field exactly. No tax, pension, debt, accessible-funds or funding-timing change is permitted by that test. The release property-household ending net worth changes from $23,843,554.69 to $23,153,554.69 for the same reason.

Browser verification uses Edge with mobile viewport emulation, not physical iPhone/Safari. The previously reported broad-browser startup/disclosure failures remain separate from this issue; relevant growth and asset-sync cases are run explicitly.

### Final run results

- `pnpm run verify`: 71 suites, 1,363 tests passed; no failures, skips or cancellations.
- `node --test tests/retirement-asset-sync-browser.mjs`: 8 passed (including two new Issue #95 desktop/mobile cases, PR #93 sync/report cases and Issue #94 editing cases).
- Selected growth cases in `tests/dollar-basis-browser.mjs`: 9 passed, including saved-plan isolation, plan-linked retirement, mobile values and both dollar bases.
- `node --test tests/property-debt-f04-browser.mjs`: existing startup timeout at line 44, before assertions. This matches the failure previously reproduced on the pre-correction PR #93 baseline; it is not an all-green broad-browser run. Its obsolete duplicate-property numeric expectations were corrected, and the equivalent debt/equity regression runs in the passing full suite.
