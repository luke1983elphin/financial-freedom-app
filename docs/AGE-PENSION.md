# Optional Australian Age Pension forecast

This scenario-only estimate is disabled unless `scenario.agePension.enabled === true`.
The panel follows Downsize home and precedes Projection settings. It does not alter
the main Financial Plan. Turning it off removes all pension-specific projection
fields and preserves the original calculation path.

## Dated rules

Reverified 19 October 2026; normal domestic payment rates effective 20 September 2026.
Other parameters have different effective dates; see the group register below.
Amounts are annualised using 26 fortnights. Future basic pension, Pension
Supplement, asset/income free areas and deeming balance thresholds compound at
the scenario CPI rate, once for each calendar year after 2026. Each year's
underlying schedule is indexed **before** the assets and income tests are run.
This can change eligibility; it does not simply multiply a prior pension result.
Energy Supplement, Work Bonus, deeming percentages, taper rates and pension age
remain fixed. Negative CPI does not reduce pension rates or thresholds. Amounts
are rounded to cents. Zero CPI holds the schedule constant.

This is a projection assumption, not a legislative forecast. Actual pension
indexation occurs in March/September, uses CPI/PBLCI and a wages benchmark;
thresholds have their own dates and statutory rounding. The annual CPI proxy
does not attempt to forecast those indices, ministerial decisions or legislation.
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

Deeming rates are **1.75% below the tier and 3.75% above it**, effective
20 September 2026, confirmed by Services Australia and the Australian Government
Actuary's record of the ministerial determination. The regular Work Bonus
is annualised as $7,800 against each pension-age person's employment income.
No opening credit, banking or uneven fortnightly earnings are assumed.

Sources:
- [Services Australia payment rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526)
- [Assets test](https://www.servicesaustralia.gov.au/assets-test-for-age-pension?context=22526)
- [Income test](https://www.servicesaustralia.gov.au/income-test-for-age-pension?context=22526)
- [Deeming](https://www.servicesaustralia.gov.au/deeming?context=22526)
- [AGA September 2026 deeming determination](https://aga.gov.au/publications/deeming-rate-recommendation-september-2026)
- [DSS pension indexation provisions](https://guides.dss.gov.au/social-security-guide/5/1/8/50)

### Release verification register — 19 October 2026

All groups below were checked separately against government sources on that date.
No discrepancy was found in the estimator's monetary constants; calculation
values are unchanged. The schedule's original `verifiedOn` records its prior
verification; this register records the subsequent review.

| Group | Verified values and categories | Effective date and evidence |
| --- | --- | --- |
| Normal domestic maximum payment | Single: basic $1,135.40 + Pension Supplement $88.20 + Energy Supplement $14.10 = $1,237.70 per fortnight. Partnered each: $855.90 + $66.50 + $10.60 = $933.00. | 20 September 2026 payment schedule: [Services Australia](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526). Energy Supplement values remain unchanged in that schedule; their original commencement is not asserted. |
| Supplement tax components | Basic supplement $30.70 single / $25.30 partnered each. Exempt supplement $57.50 / $41.20, plus energy $14.10 / $10.60; estimator annualises $71.60 / $51.80 by 26. | 20 September 2026: [DSS supplement schedule](https://guides.dss.gov.au/social-security-guide/5/1/9/10), [DVA component table](https://clik.dva.gov.au/node/86936). |
| Asset free areas | Homeowner single $333,000; non-homeowner single $600,000; couple combined $499,000 / $766,000, including one eligible partner. | 1 July 2026: [DSS historical dated table](https://guides.dss.gov.au/social-security-guide/4/10/3); current [Services Australia table](https://www.servicesaustralia.gov.au/assets-test-for-age-pension?context=22526). September part-pension cancellation figures are not the July free areas. |
| Asset taper | $3 per fortnight per $1,000 single or couple combined; $1.50 for each eligible partner. Annual factors 78 / 39. | 1 January 2017: [DSS assets test](https://guides.dss.gov.au/social-security-guide/4/2/3). |
| Income free areas | $226 per fortnight single; $396 combined couple (annual $5,876 / $10,296). | 1 July 2026: [DSS dated history](https://guides.dss.gov.au/social-security-guide/4/10/3); [Services Australia current income test](https://www.servicesaustralia.gov.au/income-test-for-age-pension?context=22526). |
| Income taper | 50 cents per excess dollar single; 25 cents each eligible partner against combined income. | 20 September 2009 normal rules: [DSS dated history](https://guides.dss.gov.au/social-security-guide/4/10/3). Transitional rules excluded. |
| Deeming balance thresholds | $66,800 single; $110,600 combined where at least one partner receives a pension. | 1 July 2026: [DSS deeming history](https://guides.dss.gov.au/social-security-guide/4/4/1/10). |
| Deeming rates | 1.75% lower / 3.75% upper. | 20 September 2026: [ministerial determination](https://www.legislation.gov.au/F2026L01083/asmade/2026-08-21/text/original/epub/OEBPS/document_1/document_1.html) and [Services Australia](https://www.servicesaustralia.gov.au/deeming?context=22526). |
| Work Bonus | $300 per fortnight per eligible person; annual proxy $7,800. | Increased to $300 from 1 July 2019: [DSS application/history](https://guides.dss.gov.au/social-security-guide/3/1/15/30). [Current scheme](https://www.servicesaustralia.gov.au/how-work-bonus-works?context=22561) also includes a bank and opening credit, intentionally not modelled. |
| Pension age | 67, with residency and ordinary eligibility assumed. | Final age step from 1 July 2023: [Services Australia information](https://www.servicesaustralia.gov.au/sites/default/files/2024-06/ci006-2304en.pdf); [current eligibility](https://www.servicesaustralia.gov.au/who-can-get-age-pension?context=22526). |

The estimator remains an annual scenario approximation, not an official
entitlement assessment. Illness-separated, overseas, transitional, rent-assistance,
fortnightly earnings/bank timing and specialist eligibility rules remain outside
its supported scope. SAPTO is an existing separate tax-offset approximation;
this pension-constant review does not broaden its scope or certify entitlement.
- [DSS indexation register](https://www.dss.gov.au/income-support-payments/social-security-indexation)
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
SAPTO is now included for ordinary eligible seniors when Age Pension modelling
is enabled, with an Advanced assumptions option to exclude it. Modelled
concessional super contributions and net investment losses are added back for
rebate income. Unentered fringe benefits and other adjustments are assumed zero;
exclude SAPTO if these or eligibility need specialist review. Eligible spouse
transfers use the statutory transfer formula and recalculate the recipient's
threshold. The offset is non-refundable and changes income tax only.
Pensioner Medicare concessions remain unsupported, and future income-tax rules
are held at the latest supported year without CPI indexation. See SAPTO.md.
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
depletion, downsizing, funding, tax, compounded indexation, fixed parameters,
new future eligibility, shortfall milestones and unsupported cases. Specialist
checkboxes are under collapsed Advanced assumptions. Annual results use a
scrollable two-column table, with future-dollar and before-tax labels. Run:

```
node scripts/run-tests.mjs
pnpm run verify
node --test tests/age-pension-browser.mjs
```

Merge requires the full regression and review gates plus desktop/mobile preview
verification. Pre-existing failures still block merge; they must not be hidden by
weakening or removing tests.
