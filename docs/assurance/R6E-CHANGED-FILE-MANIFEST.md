# R6E Changed-File Manifest

## Runtime

- `weekly-plan.js` - adds the local-civil day ordinal helper and uses it in the existing authoritative week-index function.

## Tests and registration

- `tests/dst-safe-week-bucketing-r6e.test.mjs` - 18 focused R6E cases.
- `tests/helpers/weekly-dst-probe.mjs` - functional fixture/probe shared by the suite and evidence runs.
- `scripts/test-suites.mjs` - registers the R6E suite and syntax targets.
- `package.json` - adds `test:r6e` and syntax checks for the R6E files.

## Assurance documentation

- `docs/assurance/R6E-DST-DATE-BUCKETING-CORRECTION.md`
- `docs/assurance/R6E-CIVIL-DATE-ARITHMETIC-CONTRACT.md`
- `docs/assurance/R6E-TIMEZONE-REGRESSION-MATRIX.md`
- `docs/assurance/R6E-OCCURRENCE-OVERRIDE-RECONCILIATION.md`
- `docs/assurance/R6E-UI-EXPORT-RECONCILIATION.md`
- `docs/assurance/R6E-FINANCIAL-PARITY.md`
- `docs/assurance/R6E-CHANGED-FILE-MANIFEST.md`
- `docs/assurance/R6E-COMPLETION-REPORT.md`
- `docs/assurance/R6-DEFECT-REGISTER.md`

No other runtime, financial, export, persistence, security or deployment file changed.
