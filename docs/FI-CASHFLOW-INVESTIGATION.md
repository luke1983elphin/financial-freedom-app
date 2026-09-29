# FI wealth and cashflow investigation

Baseline main: 64d282c. Personal device inputs were not supplied. Exact observed
$150,000 / $693,858 totals cannot be verified without them; tests use deterministic
inputs and do not hard-code those observed totals.

`futureYouPreview` skips projection rows at current age. Its fallback adds
investmentBalance, legacy offset and super from an absent current-age row. It
omits property equity. Future rows use canonical `netFiAssets`, including property
equity and canonical offset. The arrays start at year one, so a shared year-zero
composition is needed. $100k shares + $50k crypto with stale legacy offset gives
the $150k fallback; future wealth additionally contains property equity, offset,
returns and contributions. Exact next-year components require original inputs.

Primary FI progress currently includes property equity. Proposed correction:
accessible assets fund progress; property equity contributes only to Total FI
Wealth. Align `netFiAssets` and `calculateNetFIAssets` with accessible funding,
so the same FI label never silently means property-inclusive wealth elsewhere.
`totalFiWealth` is the explicit broader measure. Home equity remains separate.

Live Summary reads calculatePlan directly. Annual Income currently includes
rental `amount` (taxable profit) as cash, despite separate rental cash fields.
Proposed: use rental cash for cash income and retain taxable profit for tax.
Annual Loan Repayments currently displays a cashflow deduction (principal only
for after-interest rent), not full payments. Standalone loans are omitted.
Proposed: expose both full payments and deductions; deduct all genuine loans once.
Explicit after-interest rent remains net of interest, so deduct only principal.

Annual Surplus remains cash income less tax, living costs and debt deductions,
before discretionary investing. Configured investing is currently uncapped in
projections. Proposed: expose configured and affordable values separately, cap
actual investing at remaining surplus after extra super, and preserve tax/super
contribution assumptions. Negative surplus cannot fund new discretionary investing.

Reuse calculateNetFiAssetSummary, incomeBreakdown, rental cashflow, existing loan
breakdowns/amortisation, and expense helpers. No new projection engine. Preserve
offset interest mechanics, growth rates and explicit sale assumptions. The main
accumulation and detailed retirement engines' pre-existing timing, contribution,
tax-year and access conventions must be reported explicitly where they differ.
