# Assurance Decisions

## R4A decisions

1. Replace the browser Tailwind compiler with a finite, committed local CSS snapshot covering the 105 utilities actually used. Do not introduce another CDN or a package upgrade.
2. Keep the current template renderer for R4A, centralise security helpers and test high-risk untrusted paths. Defer structural DOM refactoring.
3. Set the import limit to 5 MiB and reject unsafe content before state mutation while retaining legacy versionless migration.
4. Prepare CSP as a response header in report-only mode. Do not enforce or deploy it without controlled preview telemetry and separate approval.
5. Retain the temporary `style-src 'unsafe-inline'` exception for existing calculated style attributes; do not permit inline scripts or `unsafe-eval`.
6. Deny framing because no legitimate embed workflow was identified. Do not add HSTS without an owner-approved domain assessment.
7. Preserve exact R1 AI containment and self-only browser `connect-src`; do not enable the provider.
8. Keep numerical behavior locked to accepted R3D and stop on any unexplained parity difference.
9. Keep private machine evidence out of the source-only package.
# R5 decisions (2026-09-08)

- Retain local browser storage as the default; do not add accounts, cloud sync or a database.
- Use enumerated exact keys/prefixes and never `localStorage.clear()`.
- Describe related-key writes as verified best-effort with rollback, not atomic.
- Record backup download initiation only; never claim external retention.
- Use a one-time first-save prompt and a passive 30-day reminder, with a 7-day remind-later option.
- Keep AI disabled and require separate affirmative consent gates before any future generation; client consent is not endpoint authentication.
- Keep policy and consent text as explicit professional-review placeholders.

# R6 decisions (2026-09-08)

- Apply the R6 financial/data-integrity stop rule after confirming the cross-output stage mismatch. Do not alter either stage model within R6.
- Do not deploy a preview or describe the candidate as release-ready while R6-F1 and R6-F2 remain unresolved.
- Preserve the accepted R5 runtime exactly. Limit R6 changes to test registration, read-only metric evidence and assurance documents.
- Require an owner-approved correction stage to select one authoritative user-facing stage model and one authoritative readiness contract before R6 resumes.

# R6A decisions (2026-09-08)

- Retain both approved taxonomies without changing thresholds: four-stage `Financial Stage` and nine-step `Financial Journey Step`.
- Use `personalisedResultsReadiness()` as the sole Home/Dashboard readiness view model.
- Scope Dashboard stage-card rendering to `.freedom-progress-section` so Wizard Results cannot intercept later updates.
- Keep R6-F3 open and stop after R6A review packaging.

# Resumed R6 decisions (2026-09-08)

- Stop resumed R6 immediately after confirming the Weekly Plan salary-recurrence financial defect.
- Do not modify `weekly-plan.js` or any runtime file inside R6 validation.
- Do not deploy a preview or claim device, PDF, backup or release-candidate completion.
- Seek approval for a narrow correction that derives salary timing from canonical structured income records while retaining legacy fallback and saved history.
