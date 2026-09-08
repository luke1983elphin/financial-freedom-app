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
