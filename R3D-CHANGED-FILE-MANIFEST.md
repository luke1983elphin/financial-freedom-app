# R3D Changed File Manifest

Compared with the accepted baseline ZIP, before adding assurance documents:

| File | Purpose |
|---|---|
| `calculator.js` | MLS threshold correction, paid-off-loan annual cash reconciliation, central year-aware tax configuration and governance metadata. |
| `semiRetirementProjection.js` | Central tax-helper dependency, explicit annual-row financial year, held-future-rule behavior. |
| `app.js` | Concise rule/version/limitation disclosures and report metadata. |
| `tests/calculation-audit-2026-27.test.mjs` | MLS, tax-year and governance boundaries. |
| `tests/main-calculator-zero-balance-loan-r3-blocker.test.mjs` | Positive-balance within-year payoff and downstream rental cases. |
| `tests/semi-retirement-projection.test.mjs` | Tax-helper fail-closed and financial-year projection coverage. |
| `tests/semi-retirement-concessional-tax-treatment-g2es1.test.mjs` | Approved 2027-28 enacted-rate expected outputs. |

Assurance documents under `docs/assurance/` are source documentation only. `weekly-plan.js` and `weekly-planner-export.js` are byte-for-byte unchanged.
