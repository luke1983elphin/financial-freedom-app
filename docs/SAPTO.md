# SAPTO in Age Pension forecasts

Release review, 19 October 2026: sections 4 and 9–12 of the [official as-made
instrument](https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html)
were re-read. They confirm the $2,230/$1,602 bases, $445/$37,000/0.015 threshold
inputs, 0.125 taper and $6,000/0.15 transfer inputs used in this file. That
instrument commenced 1 October 2025. No numeric change is justified by that
evidence. **Unresolved:** the register's latest-text and latest-details URLs
returned errors in this review, so absence of subsequent amendments was not
independently established. Confirm current compilation status before release;
the as-made check must not be represented as that confirmation.

Verified 13 October 2026. SAPTO is applied automatically within the enabled Age
Pension scenario from age 67, under the same ordinary residency assumptions.
Receiving a positive pension is not required. Couples are assumed to live
together throughout the year. Complex circumstances suppress pension and SAPTO.
The Advanced assumptions exclusion also permits pension modelling without SAPTO.
The disabled pension path and main Financial Plan calculator remain unchanged.

## Rules and sources

[Income Tax Assessment (1936 Act) Regulations 2025, sections 9–12](https://www.legislation.gov.au/F2025L01060/asmade/text)
provide bases of $2,230 single and $1,602 partnered, with a 12.5% taper. Thresholds
are calculated from the enacted tax-year rates and statutory $445/$37,000/1.5%
formula inputs, rounded upward to whole dollars. These constants are not LITO.
Both eligibility and spouse transfers are tested before applying the offset.
Transfers use the statutory $6,000/15% formula, change the recipient's base and
threshold, and require both partners to qualify. An offset cannot generate cash
or reduce Medicare, MLS or STSL. It is capped at income tax remaining after LITO.

[ATO eligibility and rebate income guidance](https://www.ato.gov.au/myTax25OffsetsSAPTO)
requires individual rebate income and combined couple eligibility. Modelled
reportable super and investment losses are added back; compulsory employer super
and tax-exempt pension supplements are not. Eligibility is not inferred from
receipt of a pension alone.

| Tax year | Single full-offset threshold | Couple threshold each |
| --- | ---: | ---: |
| 2026–27 | $36,034 | $31,847 |
| 2027–28 and later modelled years | $37,137 | $32,822 |

Future rules are held, not CPI-indexed or forecast as future legislation. The
second statutory threshold formula applies when the first exceeds $37,000.

## Supported assumptions and limits

No unentered adjusted fringe benefits, unmodelled investment deductions,
foreign/exempt benefit adjustments, or special eligibility facts are assumed.
The model does not support changing marital status, illness separation, trustees,
under-67 veteran eligibility, imprisonment or part-year residency. Use Exclude
SAPTO when the ordinary assumptions do not fit. Household income not allocated
to a person's taxable income remains subject to the existing model limitations.

Pensioner Medicare thresholds and family Medicare reductions remain unsupported
and explicitly disclosed. SAPTO does not make Medicare, MLS or STSL disappear.

## Regression examples

For two eligible partners each with $25,258 taxable/rebate income in 2035, the
existing $288.12 income tax is reduced to zero. With $1,613 tax-free cash and no
other deductions, net cash is $26,871. This reproduces the reported income
figures, not every input of the user's saved scenario.

Tests cover tax-year formulas, full/partial/zero offsets, combined-income cutoff,
younger/ineligible spouses, rebate-income add-backs, statutory transfers and
non-refundability. Projection tests verify unchanged taxable income and gross
pension, unchanged levy/loan deductions, and the tax saving entering cashflow
exactly once. Existing pension-off full-output parity fixtures are unchanged.

## Verification

Full local `pnpm run verify`: 54 suites, 1,135 passes, zero failures or skips.
The 21 pension/SAPTO tests retain all 60 exact pension-off parity checks.
Desktop 1366px and mobile 375px browser workflows pass, including SAPTO output
and the exclusion control. CI and the deployed preview must pass before merge.
