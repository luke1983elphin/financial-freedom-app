# R4A CSP and Security Headers

## Current status

**Updated 19 October 2026: prepared source configuration is ENFORCING. Not deployed or observed on Vercel. Production is unchanged.** This release-safeguard review supersedes the original report-only preparation below and the related R4A decision/completion records.

`vercel.json` prepares these headers for a reviewed preview deployment:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` denying camera, microphone, geolocation, payment and USB

The policy restricts scripts, stylesheets, images, fonts and API connections to self, objects and workers to none, the base URI to self, framing to none and form submission to self. It does not allow inline scripts or `unsafe-eval`. Runtime resources are local; server-side provider calls are not browser CSP connections. Blob download URLs remain usable without adding blob script/image/worker permissions. No reporting collector is configured.

## Temporary exception

Only `style-src-attr` includes `'unsafe-inline'`, because renderers use calculated style attributes for progress widths, SVG chart colours and comparison-grid columns. `style-src` and `style-src-elem` allow self only: inline style blocks are not needed. Script policy is independently self-only. This preserves the design without allowing arbitrary script execution. Removing the attribute exception would require a separate renderer refactor. Test supported browser versions for CSP Level 3 style-attribute support before release; local verification used installed Chromium/Edge.

## Clickjacking

No legitimate embed workflow was found. `frame-ancestors 'none'` plus legacy `X-Frame-Options: DENY` is therefore the prepared policy.

## HSTS

HSTS was not added. HTTPS, subdomain and preload impacts require a separate owner-approved deployment decision and rollback plan.

## Self-tests

The policy parser fails when a critical directive is absent, when objects/framing are not denied, or when `unsafe-eval` appears. The runtime verifier now requires the enforcing header. `pnpm run test:browser-release` serves the exact header locally and tests desktop/mobile setup and manual entry, reports/charts, financial and comparison PDF rendering, downloaded backup JSON, disabled AI and blocked inline-script injection. It records CSP security events; it is separate from the isolated unit suites because it requires installed Edge/Chrome.

## Required owner sequence

1. Review and deploy this exact source to a protected non-production Vercel preview with AI disabled and no unnecessary production secrets.
2. Confirm the resulting deployment identity, source commit/hash, aliases and actual response headers.
3. Exercise imports/exports, Dashboard, charts, scenarios, Retirement Planning, Weekly Plan, reports and printing while recording enforcing-policy violations.
4. Correct legitimate policy requirements narrowly.
5. Obtain owner approval before deployment or changing production. Local browser verification cannot certify platform-injected scripts, preview toolbars or actual deployed response headers. No deployment was performed in this task.
