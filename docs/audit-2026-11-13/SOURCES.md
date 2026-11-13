# Source register and assurance limits

Sources were requested on 13 November 2026. [source-capture.json](source-capture.json) records URLs, redirects, HTTP outcomes and hashes of retrieved HTML. HTTP 200 alone is not evidence that policy content was available: the ATO sometimes returned an outage page. `contentStatus: unavailable-page` records that distinction. Captured HTML hashes identify a response; they do not certify legal currency. `collect-sources.py` can repeat read-only collection using Python's standard library and the environment's configured HTTPS trust/proxy. Visible text was inspected in local temporary files; no private data was collected.

## Primary content successfully read

| Source | Independently checked content | Qualification |
| --- | --- | --- |
| [ATO resident rates](https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents) | 2026–27: nil through $18,200; 15% to $45,000; $4,020 + 30% to $135,000; $31,020 + 37% to $190,000; $51,370 + 45% above; excludes Medicare | Retrieved table supports H01–H09. Does not establish family/pensioner levy treatment |
| [ATO study/training loan table](https://www.ato.gov.au/tax-rates-and-codes/study-and-training-loan-minimum-repayment-income-and-rates) | 2026–27: nil through $69,528; 15% of excess to $129,717; $9,028 + 17% of excess to $186,050; 10% of total above. Published examples: $86,380→$2,527.80 and $137,064→$10,276.99 | H10/H11 use the same repayment-income amounts but independently calculate repayments. H12 additionally caps at entered debt |
| [ATO SG](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee) | 12%; annual maximum contribution base $270,830 from 1 July 2026; qualifying earnings/payday framework | Confirms annual modelling inputs; does not verify real payroll timing or every person's qualifying earnings |
| [ATO contribution caps](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps) | 2026–27 concessional cap $32,500, versus $30,000 in 2025–26 | Carry-forward eligibility and excess consequences remain out of verified scope |
| [Deeming determination F2026L01083](https://www.legislation.gov.au/F2026L01083/asmade/2026-08-21/text/original/epub/OEBPS/document_1/document_1.html) | 20 September 2026 commencement; 1.75% below threshold and 3.75% above | Confirms percentages/date, not balance thresholds or full pension schedule |
| [SAPTO regulations F2025L01060](https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html) | Sections 9–12: base rebates, rebate threshold calculation, taper and spouse transfer framework; statutory $445 component | As-made instrument checked against implementation; current consolidation/eligibility requires qualified review. H48 independently tests one single-senior case, not every spouse-transfer branch |

## Unavailable or incompletely revalidated content

Services Australia [rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526), [assets](https://www.servicesaustralia.gov.au/assets-test-for-age-pension?context=22526), [income](https://www.servicesaustralia.gov.au/income-test-for-age-pension?context=22526) and [deeming](https://www.servicesaustralia.gov.au/deeming?context=22526) returned HTTP 503. DSS [dated pension history](https://guides.dss.gov.au/social-security-guide/4/10/3) and [deeming history](https://guides.dss.gov.au/social-security-guide/4/4/1/10) returned HTTP 403. H32–H37/H42 therefore use an independently written means-test calculation **conditional on the dated schedule in [AGE-PENSION.md](../AGE-PENSION.md)**; they do not independently authenticate that schedule. The repository's prior October verification was read as historical evidence, not re-labelled as this audit's fresh verification.

LITO and Division 293 alternate ATO routes returned HTTP 200 outage content; older dividend, super-tax and conditions-of-release routes returned 404. The basic LITO formula and 15% contribution tax/Division 293 and franking rules used in examples are explicit audit assumptions based on ordinary Australian treatments, pending fresh current-source and eligibility review. They are not claimed to have been retrieved successfully through those routes. Family/pensioner Medicare thresholds, current franking eligibility/refund restrictions, detailed super earnings tax and all conditions of release need additional source validation before broader financial assurance.

## Independent mathematical references

These checks do not require reading app configuration as an oracle:

- No-flow effective annual investment: `B1 = B0 × (1 + r)`; nominal monthly APR: `B1 = B0 × (1 + r/12)^12`.
- Loan with fixed offset O, monthly interest i, monthly end-of-period payment A and positive balance above offset: `Bn = O + (B0 − O)(1+i)^n − A((1+i)^n − 1)/i`. H25 remains above offset throughout its 12-month check.
- Economic investment return: capital growth plus income; retained return plus extracted cash yield must equal total return. Tax is a separate outflow or liability.
- Nominal spending after n years: `S0(1+CPI)^n`; today's purchasing power: `nominal/(1+CPI)^n`.
- Household net worth: all owned asset values less all outstanding liabilities. Moving a cashflow between accounts cannot create wealth or remove tax owed.

All scenario inputs and numerical expectations are explicit in [household-audit.mjs](household-audit.mjs). Where the expected result depends on a chosen timing/return convention, the household description states that choice and the report classifies the discrepancy accordingly.
