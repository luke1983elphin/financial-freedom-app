# R3D Expected Numerical Differences

All differences below are approved consequences of MLS-01, DEBT-01A or TAX-01. Other fixture changes are unexplained regressions and are not accepted.

| Area | Fixture | Baseline behavior | R3D behavior | Classification |
|---|---|---:|---:|---|
| MLS | Full-year spouse with surcharge income `$28,010` or `$28,011`, family otherwise above threshold, no cover | Individual MLS could be charged above stale `$27,222` threshold | Individual MLS `$0` | EXPECTED APPROVED DIFFERENCE |
| MLS | Same fixture at `$28,012` | MLS permitted when all other tests apply | Unchanged | UNAFFECTED PARITY |
| Home loan | `$5,000`, 0%, `$1,000` monthly | `$12,000` annual servicing | `$5,000` annual servicing | EXPECTED APPROVED DIFFERENCE |
| Home loan | `$5,000`, 12%, `$1,000` monthly | `$12,000` annual servicing | `$5,155.59` actual first-year servicing | EXPECTED APPROVED DIFFERENCE |
| Home loan | `$5,000`, 0%, `$6,000` monthly | `$72,000` annual servicing | `$5,000` annual servicing | EXPECTED APPROVED DIFFERENCE |
| Home loan | `$11,000`, 0%, `$1,000` monthly | `$12,000` annual servicing | `$11,000` annual servicing | EXPECTED APPROVED DIFFERENCE |
| Future tax | `$80,000` taxable income in 2027-28 | 2026-27 scale retained | Income tax before offsets `$14,252`, `$268` lower | EXPECTED APPROVED DIFFERENCE |
| Future tax | `$100,000` taxable income in 2027-28 | `$20,520` before offsets | `$20,252` before offsets | EXPECTED APPROVED DIFFERENCE |
| Current tax | Any supported 2026-27 fixture | 2026-27 enacted scale | Identical | UNAFFECTED PARITY |
| Debt fallback | Missing or invalid loan balance with a saved repayment | Legacy repayment fallback | Identical | UNAFFECTED PARITY |
| R3B debt | Explicit-zero balance | No future servicing | Identical | UNAFFECTED PARITY |

The full suite reports 563 passed and 0 failed. No unexplained numerical regression was observed in registered fixtures.
