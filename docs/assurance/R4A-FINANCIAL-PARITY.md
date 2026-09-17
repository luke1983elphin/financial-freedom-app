# R4A Financial Parity

## Baseline

- Accepted source: `stage-r3d-approved-financial-corrections-final-source-20260908-122853.zip`
- SHA-256: `476F0D70DC53C56AA6415D3E7FE8DCF4BB7817250B5D72533F6F63C2561FA9F0`
- Comparison folder: clean extraction of that exact ZIP, not a copy of the R4A candidate

## Command

```text
node scripts/r1-numerical-parity.mjs C:\Users\Elphin Accounting\Documents\Codex\2026-06-26\i\r4a-r3d-parity-baseline-20260908
```

## Result

Seven fictional representative plans passed exact numerical comparison. Required metric paths were validated as present and numeric; legitimate nullable outputs remained distinct from missing properties. Compared outputs cover gross/net income, income tax, Medicare, MLS, STSL, annual expenses, debt repayments, annual surplus, accessible investments, super, FI progress, property/rental cashflow, retirement milestones/balances/funding status, net worth and scenario comparison values.

`calculator.js`, `semiRetirementProjection.js`, `weekly-planner-export.js` and `api/ai-insights.js` are byte-identical to R3D. `app.js` and `weekly-plan.js` differ only in browser/import security integration; the parity suite confirms no financial output change.

The machine-readable comparison is retained in the private evidence package, not the public source package.
