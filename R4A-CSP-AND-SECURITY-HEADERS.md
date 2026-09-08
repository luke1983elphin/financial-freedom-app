# R4A CSP and Security Headers

## Current status

**Prepared source configuration: REPORT-ONLY. Not deployed or observed on Vercel. Production is unchanged.**

`vercel.json` prepares these headers for a reviewed preview deployment:

- `Content-Security-Policy-Report-Only`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` denying camera, microphone, geolocation, payment and USB

The policy restricts scripts and connections to self, images to self/data/blob, objects to none, the base URI to self, framing to none and form submission to self. It does not allow `unsafe-eval`.

## Temporary exception

`style-src` includes `'unsafe-inline'` because the existing application uses calculated inline style attributes for progress indicators and charts. Script execution does not include `'unsafe-inline'`. Removing the style exception requires a deliberate renderer/style refactor and report-only evaluation; broad weakening was not used.

## Clickjacking

No legitimate embed workflow was found. `frame-ancestors 'none'` plus legacy `X-Frame-Options: DENY` is therefore the prepared policy.

## HSTS

HSTS was not added. HTTPS, subdomain and preload impacts require a separate owner-approved deployment decision and rollback plan.

## Self-tests

The policy parser fails when a critical directive is absent, when objects/framing are not denied, or when `unsafe-eval` appears. The runtime verifier confirms the configured policy is report-only and contains all required directives.

## Required owner sequence

1. Review and deploy this exact source to a protected non-production Vercel preview with AI disabled and no unnecessary production secrets.
2. Confirm the resulting deployment identity, source commit/hash, aliases and actual response headers.
3. Exercise imports/exports, Dashboard, charts, scenarios, Retirement Planning, Weekly Plan, reports and printing while recording report-only violations.
4. Correct legitimate policy requirements narrowly.
5. Seek separate approval before switching from report-only to enforcement or changing production.
