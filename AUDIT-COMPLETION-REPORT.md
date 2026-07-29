# Second-Pass Audit Corrections

Audit copy only. Do not merge this package to main without separate review.

## Files Changed

- `calculator.js`
- `app.js`
- `package.json`
- `tests/calculation-audit-2026-27.test.mjs`
- `tests/financial-freedom-tax-integration.test.mjs` packaged path copy
- `tests/financial-progress-history.test.mjs` packaged path copy
- `test-output-report.txt`

## Key Functions And Lines

- `calculator.js:221` `calculatePersonSTSLRepaymentIncome`
- `calculator.js:261` `calculateMedicareLevySurcharge`
- `calculator.js:361` `calculatePayrollEstimate`
- `calculator.js:532` `qualifyingEarningsAnnualAmount`
- `calculator.js:539` `employerSuperForSalaryItem`
- `calculator.js:747` `calculateRentalPropertyCashflow`
- `calculator.js:879` `passiveIncomeBreakdown`
- `calculator.js:1452` `canonicalAssetRecords`
- `calculator.js:1477` `calculateNetFiAssetSummary`
- `calculator.js:1549` `calculateNetFIAssets`
- `calculator.js:1295` `personTaxAdjustmentInputs`
- `calculator.js:1308` `householdTaxEstimate`
- `calculator.js:1438` `calculatePlan`
- `calculator.js:1530` FI asset category outputs
- `calculator.js:1562` authoritative `stslRepaymentIncome`
- `app.js:195` hospital-cover info note
- `app.js:176` Financial Freedom progress and sustainable-income info notes
- `app.js:371` asset-based Financial Freedom progress selector
- `app.js:5743` part-year MLS assumption display
- `app.js:5770` cashflow rows
- `app.js:5805` rental cashflow summary
- `app.js:5845` passive income breakdown
- `app.js:9109` report cashflow rows

## Before And After Formulas

### STSL

Before:

`STSL repayment income = salary and wages only inside calculatePayrollEstimate`

After:

`STSL repayment income = taxableIncomeBeforeFHSSAdjustments + reportableFringeBenefits + reportableEmployerSuperContributions + personalDeductibleSuperContributions + totalNetInvestmentLosses + exemptForeignEmploymentIncome`

The full-plan result now creates:

```js
stslRepaymentIncome = {
  person1: calculatePersonSTSLRepaymentIncome(...),
  person2: calculatePersonSTSLRepaymentIncome(...),
}
```

Then it separately calls `estimateStudyLoanRepayment` for each person.

2026-27 second band:

`STSL repayment = $9,028 + 17 cents for each $1 over $129,717`

Rounding convention:

The published second-band base is stored as `$9,028`. The app calculates the marginal component to cents and then rounds the final annual repayment to cents.

### Medicare Levy Surcharge

Before:

`MLS threshold income = taxable income`

`MLS surcharge base = taxable income`

Missing cover details could be converted to a zero uncovered fraction.

After:

`MLS threshold income` and `MLS surcharge base` are separate values.

Whole-family cover is checked as:

`person1 covered && (!hasPartner || person2 covered) && (dependants === 0 || dependants covered)`

Individual low-income spouse exemption:

Where a taxpayer had a spouse for the full year and their own MLS-purpose income is `$27,222` or less, that person's individual MLS is set to nil. This is applied separately to Person 1 and Person 2.

Part-year coverage caveat:

Part-year MLS estimates assume the entered family members' covered days overlap unless actual coverage dates are collected.

If information needed to determine MLS is missing and the threshold is exceeded, the result is:

```js
{
  status: "incomplete",
  cannotConfirm: true,
  annualSurcharge: null,
  person1Surcharge: null,
  person2Surcharge: null
}
```

### Medicare Levy

Before:

Displayed as a generic Medicare levy amount.

After:

Displayed as `Estimated Medicare levy - simplified 2% calculation`, with metadata noting that low-income reductions, family reductions and exemptions are not fully modelled in this audit copy.

### Employer Super

Before:

`employer super = salary amount * 12%`, with package-inclusive salary support.

After:

`employer super = min(qualifying earnings, maximum contribution base) * 12%`

The salary amount remains the default qualifying earnings value. Each salary item can now use `qualifyingEarningsOverrideEnabled` and `qualifyingEarningsAmount`.

### Rental Income

Before:

Headline passive rental income used household cashflow after principal repayment.

After:

For income entered after interest:

`rentalPassiveIncomeBeforePrincipal = annualNetRentalCashIncome`

`rentalHouseholdCashflowAfterPrincipal = annualNetRentalCashIncome - annualLoanPrincipal`

For income entered before interest:

`rentalPassiveIncomeBeforePrincipal = annualNetRentalCashIncome - annualLoanInterest`

`rentalHouseholdCashflowAfterPrincipal = annualNetRentalCashIncome - annualLoanInterest - annualLoanPrincipal`

Passive-income totals use `rentalPassiveIncomeBeforePrincipal`. Household cash surplus uses `rentalHouseholdCashflowAfterPrincipal`.

### FI Asset Categories

Added central net-FI-assets selector:

`calculateNetFiAssetSummary(...)`

Added direct helper:

`calculateNetFIAssets(...)`

Double-count source fixed:

The previous Net FI Assets implementation added `assets.sharesEtfs` and `assets.crypto`, then also added matching detailed `assetItems` categories. The app mirrors `assetItems` back into those legacy fields for saved-plan compatibility, so legacy plans containing both shapes could count the same shares or crypto twice.

New canonical source rule:

Detailed `assetItems` are the canonical source for shares, ETFs, managed funds, crypto, cash, offset and investment property where a non-zero detailed record exists. Legacy fields such as `assets.sharesEtfs` and `assets.crypto` are fallback-only when no detailed value exists for that category. Duplicate detailed records with the same stable asset ID are counted once; genuinely separate holdings with different IDs remain counted separately.

Primary Financial Freedom Progress now uses:

`Financial Freedom Progress = current net FI assets / target FI assets * 100`

`Target FI assets = annual lifestyle spending needed for Financial Freedom / sustainable withdrawal rate`

The display percentage is capped at 100%, while `financialFreedomProgressRaw` preserves the uncapped calculation.

Added outputs:

- `liquidInvestmentAssets`
- `grossLiquidInvestmentAssets`
- `otherInvestmentDebt`
- `canonicalAssetSource`
- `sharesEtfsFiAssets`
- `cryptoFiAssets`
- `investmentProjectionStartingBalance`
- `investmentPropertyGrossValue`
- `investmentPropertyDebt`
- `investmentPropertyEquity`
- `accessibleFICapital`
- `currentNetFiAssets`
- `financialFreedomProgressRaw`
- `financialFreedomProgressDisplay`
- `fiTargetRemaining`
- `estimatedSustainableIncomeFromCurrentFiAssets`
- `passiveIncomeCoveragePercent`
- `targetAgeNetFiAssets`
- `targetAgeEstimatedSustainableIncome`
- `superannuationBalance`
- `totalIncomeProducingAssets`

Current net FI assets include liquid investment assets, net rental/investment-property equity and income-producing assets, net of linked investment debt. They exclude the family home, home loan, vehicles and other personal-use assets. Super is excluded from current net FI assets before modelled access age and included in future projections from the age it becomes accessible.

Passive income remains a separate supporting metric. It no longer drives the primary Financial Freedom Progress percentage.

## Household Reconciliation Example

Using the second-pass test household:

- Annual gross income: `$81,200`
- Income tax: `$12,645.90`
- Medicare levy: `$1,540`
- Medicare levy surcharge: `$0`
- STSL compulsory repayment: `$1,495.80`
- Net income after tax, Medicare, MLS and STSL: `$65,518.30`
- Core living expenses: `$36,000`
- Debt repayments: `$44,400`
- Other regular expenses: `$12,000`
- Investment contributions: `$12,000`
- Extra super contributions: `$6,000`
- Final projected cash surplus: `-$44,881.70`

Rental split:

- Passive rental income before principal: `$7,000`
- Rental principal repayments: `$6,000`
- Household rental cashflow after principal: `$1,000`

FI asset split:

- Current net FI assets: calculated from liquid investment assets plus net investment-property equity, net of linked investment debt
- Total income-producing assets: includes current net FI assets plus superannuation tracked separately where not yet accessible

## Test Files Included

- `tests/calculations.test.ts`
- `tests/engagement.test.ts`
- `tests/financial-freedom-tax-integration.test.mjs`
- `tests/financial-progress-history.test.mjs`
- `tests/calculation-audit-2026-27.test.mjs`

Full console output is included in `test-output-report.txt`.

Package command:

`npm test`

The package script now uses `node --experimental-strip-types` for the `.ts` tests:

`node --experimental-strip-types tests/calculations.test.ts && node --experimental-strip-types tests/engagement.test.ts && node tests/financial-freedom-tax-integration.test.mjs && node tests/financial-progress-history.test.mjs && node tests/calculation-audit-2026-27.test.mjs`

Local runtime note:

The Codex runtime used for this audit does not include `npm.exe` on PATH. The final captured run therefore uses `pnpm test` after adding the bundled Node directory to PATH, which executes the same `scripts.test` command that plain `npm test` will execute when npm is available. `test-output-report.txt` includes the successful script output.

Final packaged run:

- Core calculations: 9 passed
- Engagement helpers: 4 passed
- Tax integration: 7 passed
- Financial progress history: 5 passed
- Second-pass audit regressions: 13 passed

Total: 38 passed, 0 failed.

## Confirmations

- STSL includes allocated investment income, franking credits and rental taxable income.
- Family MLS checks Person 1, Person 2 where relevant, and dependent-child cover.
- MLS applies the individual low-income spouse exemption separately to Person 1 and Person 2.
- Part-year MLS results display the overlap assumption note.
- Missing MLS information is no longer treated as zero.
- Passive rental income is shown separately from principal repayments.
- Household cash surplus uses rental cashflow after principal.
- Financial Freedom Progress is based on current net FI assets divided by target FI assets, not passive income.
- Shares and crypto are counted once using canonical asset records, with legacy mirror fields used only as fallback values.
- Legacy saved plans that contain both `assetItems` and `assets.sharesEtfs` / `assets.crypto` no longer double count those holdings.
- Separate share portfolios with different stable IDs remain counted as separate legitimate assets.
- Passive income, passive-income coverage and estimated sustainable income are displayed separately as supporting metrics.
- Investment property values are counted only as net equity after linked rental-property debt.
- Family home value and home loan balance do not affect current net FI assets.
- Super is excluded before modelled access age and appears in future progress rows from access age.
- Dashboard, goals, reports, saved scenarios, financial progress history and AI summaries read the central `calculatePlan` result fields.
- Weekly planner/export consumers should use the same central `calculatePlan` output; no separate rental/STSL/MLS formula was added in this audit correction.
