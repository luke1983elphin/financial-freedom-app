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
- `calculator.js:1295` `personTaxAdjustmentInputs`
- `calculator.js:1308` `householdTaxEstimate`
- `calculator.js:1438` `calculatePlan`
- `calculator.js:1504` FI asset category outputs
- `calculator.js:1562` authoritative `stslRepaymentIncome`
- `app.js:195` hospital-cover info note
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

Added outputs:

- `liquidInvestmentAssets`
- `investmentPropertyGrossValue`
- `investmentPropertyDebt`
- `investmentPropertyEquity`
- `accessibleFICapital`
- `superannuationBalance`
- `totalIncomeProducingAssets`

Documented property-equity rule:

Investment-property equity is excluded from FI capital unless `includeInvestmentPropertyEquityInFi` is selected. Gross property value is never counted without deducting rental-property debt. The family home is excluded unless a downsizing strategy is enabled.

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

- Accessible FI capital: `$195,000`
- Total income-producing assets: `$795,000`

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

The Codex runtime used for this audit does not include `npm.exe` on PATH. The final captured run therefore uses `pnpm test`, which executes the same `scripts.test` command that plain `npm test` will execute when npm is available. `test-output-report.txt` includes the `where npm` result and the successful script output.

Final packaged run:

- Core calculations: 9 passed
- Engagement helpers: 4 passed
- Tax integration: 7 passed
- Financial progress history: 5 passed
- Second-pass audit regressions: 12 passed

Total: 37 passed, 0 failed.

## Confirmations

- STSL includes allocated investment income, franking credits and rental taxable income.
- Family MLS checks Person 1, Person 2 where relevant, and dependent-child cover.
- MLS applies the individual low-income spouse exemption separately to Person 1 and Person 2.
- Part-year MLS results display the overlap assumption note.
- Missing MLS information is no longer treated as zero.
- Passive rental income is shown separately from principal repayments.
- Household cash surplus uses rental cashflow after principal.
- Dashboard, reports, financial progress and AI summaries read the central `calculatePlan` result fields.
- Weekly planner/export consumers should use the same central `calculatePlan` output; no separate rental/STSL/MLS formula was added in this audit correction.
