# R3D Approved Decision Implementation Matrix

Baseline: `stage-r3b-timing-review-ui-closure-final-source-20260908-103042.zip`

Baseline SHA-256: `CD155942DC04CD10CBEF84EDBAD366A30FCB251FDC74FBA92CDFCE9D9C535265`

| Decision | Status | Implementation | Verification |
|---|---|---|---|
| MLS-01 | Implemented | The 2026-27 full-year spouse low-income MLS threshold is `$28,011`. The exemption applies at or below the threshold and is evaluated independently for each person. | Boundary tests for both people at `$28,010`, `$28,011`, and `$28,012`; broader MLS tests remain active. |
| DEBT-01A | Implemented | Positive-balance P&I loans use the first 12 months of actual capped amortisation payments. Additional principal is applied after regular payments and capped to remaining principal. Explicit-zero and missing/invalid legacy behavior remain distinct. | Paid-off-loan suite covers 0% and interest-bearing payoffs, month 11, overpayment, offset, additional principal, interest-only, rental before/after interest, explicit zero, and missing/invalid values. |
| TAX-04 | Implemented | Retirement Planning uses the authoritative calculator tax helper with an explicit financial year. The duplicated fallback scale was removed. A missing helper produces a calculation-unavailable result. | Central-helper and fail-closed tests; 2026-27 boundary coverage remains active. |
| TAX-01 | Implemented | 2026-27 uses the enacted 15% lower rate. 2027-28 uses the enacted 14% lower rate. Unknown later years hold the last supported enacted configuration. Unsupported earlier years fail closed. | Australian FY boundary, exact supported year, held future year, unsupported year, multi-year projection and scenario tests. |
| UX-01 | Implemented | The UI and supported reports expose calculation version `2026.27.2`, rules reviewed date, rule-year treatment, future-rule assumption, and deferred limitations. | Governance tests cover 30 June/1 July and supported historical/current-later states. |

## Deferred Decisions

The following are deliberately not implemented or approximated: TAX-02 Working Australians Tax Offset; TAX-03 standard work deduction; MED-01 full Medicare family, SAPTO and exemption engine; MLS-02 detailed MLS adjustment inputs; SUPER-01 carry-forward, Division 293, eligibility and conditions-of-release engine.
