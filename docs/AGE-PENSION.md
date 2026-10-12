# Optional Australian Age Pension forecast

This scenario-only estimate is disabled unless `scenario.agePension.enabled === true`.
The panel follows Downsize home and precedes Projection settings. It does not alter
the main Financial Plan. Turning it off removes all pension-specific projection
fields and preserves the original calculation path.

## Dated rules

Verified 13 October 2026; normal domestic rates effective 20 September 2026.
Amounts are annualised using 26 fortnights. Future rates, thresholds and deeming
rates are held fixed in nominal dollars: **no assumed future indexation**. This is
a conservative scenario assumption, not a prediction of future government rates.
Current rates are also used for the first annual 2026 projection period, rather
than retrospectively prorating the financial year. Reverify this schedule before
using a future release as a current entitlement calculator.

| Rule | Single | Couple |
| --- | ---: | ---: |
| Maximum per fortnight, supplements included | $1,237.70 | $933 each eligible person |
| Homeowner asset free area | $333,000 | $499,000 combined |
| Non-homeowner asset free area | $600,000 | $766,000 combined |
| Asset taper per $1,000 per fortnight | $3 | $1.50 each eligible person |
| Income free area per fortnight | $226 | $396 combined |
| Income taper | 50% | 25% each eligible person |
| Deeming lower-tier balance | $66,800 | $110,600 combined |

Deeming rates are 1.25% below the tier and 3.25% above it. The regular Work Bonus
is annualised as $7,800 against each pension-age person's employment income.
No opening credit, banking or uneven fortnightly earnings are assumed.

Sources:
- [Services Australia payment rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526)
- [Assets test](https://www.servicesaustralia.gov.au/assets-test-for-age-pension?context=22526)
- [Income test](https://www.servicesaustralia.gov.au/income-test-for-age-pension?context=22526)
- [Deeming](https://www.servicesaustralia.gov.au/deeming?context=22526)
- [Superannuation and younger partners](https://www.servicesaustralia.gov.au/superannuation?context=22526)
- [Work Bonus](https://www.servicesaustralia.gov.au/how-work-bonus-works?context=22561)
- [DSS assets taper](https://guides.dss.gov.au/social-security-guide/4/2/3)
- [DSS supplement components](https://guides.dss.gov.au/social-security-guide/5/1/9/10)

## Annual assessment and funding

The lower of assets-test and income-test annual amounts applies from age 67.
Couples share both free areas even when only one partner is 67. Each eligible
person receives the partnered rate and their own taper; the younger partner
does not receive pension. Residency and ordinary eligibility are assumptions,
not inferred from age alone or verified by this app.

Assessment uses opening accessible balances (including offset and unallocated
cash), eligible super and non-home assets. Same-year downsizing proceeds and
one-off cash receipts enter the assessment before pension is calculated.
The replacement principal home remains exempt. Loans linked to assessed assets
are assumed to be secured solely against those assets; home loans and unsecured
debts are not deducted from financial assets. Balances depleted by spending are
reassessed at the next annual step, not continuously within a year.

Under-67 super is assumed accumulation with lump-sum withdrawals and is exempt.
The optional income-stream checkbox instead assesses all under-67 super as a
modern account-based pension. Legacy, defined-benefit and mixed arrangements
require specialist assessment. Older super is assessed regardless of access or
retirement phase. Super distributions spent immediately are not counted again
as income. Cash retained outside super is assessable at the next annual step.

Financial assets generate deemed income for the means test; actual interest,
dividends, distributions and total portfolio returns are not added again.
Employment, supplied net rental taxable income and other income enter separately.
Rental taxable income is a simplifying proxy for Centrelink rental income; tax
depreciation and other differing deductions are not reconstructed.

Pension cash is added once to each recipient's cash income before the existing
funding waterfall. Taxable pension is added once to tax and STSL income, with
tax and MLS recalculated. The tax-exempt supplement component is excluded.
Existing ordinary tax assumptions remain: SAPTO, pensioner Medicare thresholds
and offset transfers are not calculated, so net pension funding can be understated.
No pension is added to investment earnings. Reduced shortfalls flow through to
withdrawals, balances and exhaustion. Private asset depletion does not mean
pension ceases or all spending becomes unfunded.

## Limits and release checks

This is a rounded annual planning estimate, not a Centrelink payment quote.
Fortnightly entitlement timing, supplement minimum-payment edge cases, Rent
Assistance, transitional rates, illness separation, overseas rules, gifting,
private trusts/company attribution and complex income streams are unsupported.
The complex-circumstances option returns no estimate and adds no pension cash;
known trust/company/business asset types are also blocked.

The regression fixture records SHA-256 hashes of the **entire original engine
result** at PR head `b904d6182ca8029476dc98c35ffee5a974c3da00` for 30 fixed
households. Each is tested with both omitted and explicitly disabled options.
The unit suite covers means tests, mixed ages, super, home loans, deeming,
depletion, downsizing, funding, tax and unsupported cases. Run:

```
node scripts/run-tests.mjs
pnpm run syntax
node --test tests/age-pension-browser.mjs
```

Merge requires the full regression and review gates plus desktop/mobile preview
verification. Pre-existing failures still block merge; they must not be hidden by
weakening or removing tests.
