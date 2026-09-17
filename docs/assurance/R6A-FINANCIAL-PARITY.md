# R6A Financial Parity

Command:

```text
node scripts/r1-numerical-parity.mjs ..\r6-source-stage-20260908-170140
```

Result: exact parity for all seven bundled samples and all 14 required finite numeric metrics.

The following protected runtime files are hash-identical to the accepted R6 source: `calculator.js`, `semiRetirementProjection.js`, `weekly-plan.js`, `weekly-planner-export.js`, `storage.js`, `security.js`, `vercel.json`, `index.html`, `styles.css`, `v2-data.js` and `pnpm-lock.yaml`.

Only integration/UI logic in `app.js` and test/tool registration changed. There are no authorized or observed financial numerical differences.
