# R3D Rule and Version Governance

## Active Metadata

- Calculation version: `2026.27.2`
- Rules last reviewed: `8 September 2026`
- Explicit configurations: `2026-27`, `2027-28`
- Projection convention: an annual row identified by calendar year represents the Australian financial year beginning on 1 July of that year.

## Resolution Policy

1. Use the exact supported Australian financial-year configuration when present.
2. For a future year later than the latest supported configuration, hold the latest supported enacted rule set and mark the result as held.
3. Do not invent threshold indexation.
4. Fail closed for an earlier unsupported year rather than returning an apparently valid result.
5. Do not warn merely because a user deliberately views a supported historical year.
6. Warn when the current financial year, determined from an injectable date and the 1 July boundary, is later than the latest supported configuration.

## Disclosures

Future thresholds are not indexed unless enacted. The Working Australians Tax Offset and standard work deduction are not modelled. Ordinary Medicare family reductions, SAPTO and exemptions are not fully modelled. Detailed super eligibility, carry-forward caps, Division 293 and conditions of release are not determined.

## Primary Sources

- Resident rates: `https://www.legislation.gov.au/C2025A00028/asmade/details`
- Medicare and MLS spouse rule: `https://www.legislation.gov.au/C2004A03351/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html`
- MLS thresholds: `https://www.privatehealth.gov.au/health_insurance/surcharges_incentives/medicare_levy.htm`
- STSL thresholds: `https://www.legislation.gov.au/C2026G00249/asmade/2026-04-20/text/original/epub/OEBPS/document_1/document_1.html`
- Super guarantee: `https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee`
