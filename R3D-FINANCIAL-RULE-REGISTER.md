# R3D Financial Rule Register

| Rule | Configuration / behavior | R3D status |
|---|---|---|
| 2026-27 resident lower band | 15% from `$18,200` to `$45,000` | Supported, unchanged |
| 2027-28 resident lower band | 14% from `$18,200` to `$45,000`; other thresholds retained as enacted | Supported, added |
| Later resident years | Last supported enacted configuration held with disclosure | Approved model policy |
| LITO | Existing central formula retained | Supported, unchanged |
| Retirement tax fallback | Independent scale removed; central helper required | Corrected by TAX-04 |
| Ordinary Medicare | Existing individual 2% and low-income phase-in retained | Supported within current simplified model |
| Full-year spouse MLS low-income threshold | `$28,011`; income must exceed threshold before MLS may apply | Corrected by MLS-01 |
| MLS tiers, child increment, cover fraction | Existing 2026-27 settings retained | Unchanged |
| STSL | Existing 2026-27 marginal formulas and debt cap retained | Unchanged |
| Super guarantee and caps | Existing configured rules retained | Unchanged |
| Positive loan paid off within year | First-year actual capped schedule cash, plus capped remaining additional principal | Corrected by DEBT-01A |
| Explicit-zero loan | No future servicing | R3B protection retained |
| Missing/invalid loan balance | Legacy saved repayment fallback | Retained |

## Open Limitations

- TAX-02 Working Australians Tax Offset is not modelled.
- TAX-03 standard work deduction is not modelled.
- MED-01 family Medicare reductions, SAPTO and exemptions are not fully modelled.
- MLS-02 detailed adjustment inputs are not implemented.
- SUPER-01 carry-forward, Division 293, eligibility and release conditions are not determined.
- Future non-income-tax parameters currently use the last supported configuration where no separately enacted configuration is implemented.
