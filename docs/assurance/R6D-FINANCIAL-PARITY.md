# R6D Financial Parity

The accepted R6C ZIP was extracted separately and compared with the R6D candidate using `scripts/r6-sample-metrics.mjs`.

- Baseline SHA-256: `233CB5476482CE1FF00E015FFB7EC13D3A6808ED3E8E666CA82633A32074BC0B`
- Fictional plans: 7
- Existing annual metrics per plan: 14
- Normalised exact match (excluding generated timestamp): true
- Retirement result exact match: true
- Protected financial/runtime files: byte-identical

The only observed Weekly Plan numerical change was the authorised browser test where a confirmed user edit changed Week 1 Money in and then explicitly saved it. Merely opening, viewing, cancelling or reloading a completed week made no numerical change.
