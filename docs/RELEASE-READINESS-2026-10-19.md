# Release-readiness review — 19 October 2026

Base: latest fetched `origin/main`, `e1e69f8` (PR #50 merged).
Working branch: `codex/release-readiness`. Local review only: no push, deployment,
merge, protection-setting change, account system or paid-service enablement.

## Findings and changes

| Requested area | Verified finding | Resolution |
| --- | --- | --- |
| Disabled AI | Coaching already required exact `true`; payslip extraction required only an API key. Coaching UI already obeyed server availability. | Both require explicit flags plus a code-level release lock. API keys and even both flags cannot lift the lock. Payslip UI shows a brief unavailable/manual-entry note and returns before FileReader. Disabled routes make no network calls. |
| Server controls | Both lacked origin/access/shared-budget protection; coaching output tokens and PDF upload/deletion timeouts were unbounded. | Shared method/origin/JSON/size validation, private-operator bearer guard, atomic Redis REST global budget with no local fallback, bounded output and timeouts. One generation per request. Provider errors do not expose raw payloads. These dormant controls do not constitute a public-product access decision or provisioned infrastructure. |
| Upload privacy | Original documents, including identifiers, would be transmitted. Output instructions were not redaction. Provider files were deleted best effort. | Upload path locked off and fully documented, including residual cleanup failure cases and local extraction/redaction options. Consent, provider configuration/terms, minimisation and reliable cleanup remain prerequisites. |
| Financial-year assumptions | 2027–28 has supported income-tax brackets but carries four sections from 2026–27. Later years hold the latest income-tax brackets too. No visible notice identified this. | Resolver metadata drives notices beside retirement results, salary estimates and reports, including comparison PDF output. The 2026–27 main report has no warning. Source year is stored with held-rule metadata; UI contains no hardcoded year. Calculation outputs are numerically unchanged. |
| CSP | Report-only header; local scripts/resources, calculated style attributes and Blob downloads. | Enforcing CSP. Scripts and stylesheet elements self-only; style attributes retain their narrowly scoped inline allowance. Images/fonts/connect self-only; workers/objects/framing denied. No reporting collector. Real browser tests use the exact header. |
| CI | Individual checks used continue-on-error, but the final shell gate already tested their outcomes. No evidence that ordinary check failures escaped that gate. Action tags were mutable. | Remove continue-on-error, preserve always-run diagnostics/final gate and isolated test runner, add enforcing-policy check. Pin checkout v4.3.0 and setup-node v4.4.0 to SHAs verified with official repository tag refs. |
| Pension constants | Payment/components, assets, income, deeming, Work Bonus and age matched official sources. Effective dates differ by group. | Add dated source register and category/taper boundary tests; no monetary changes. SAPTO latest-version evidence was initially unresolved; the subsequent [evidence closure](RELEASE-EVIDENCE-2026-10-19.md) resolves it using the working official title and versions pages. |
| Housekeeping | Root parity JSON is referenced by `scripts/r1-numerical-parity.mjs` and the stage-4 commit inventory. Old patch has no runtime reference but cannot be reverse-applied to current code. | Retain the referenced JSON. Retain the patch because its complete obsolescence is not established; failed applicability alone is not proof it is safe to discard. No unrelated workspace evidence deleted. |
| Node / licence | No package dependencies in the lockfile. Native TypeScript syntax/test scripts and CI use Node 24.19.0. No licence file. | Keep the tested Node range unchanged; no evidence supports broadening runtimes. Licence remains an owner/distribution decision. |

## Verification

- `pnpm run verify`: **57 isolated suites, 1,160 tests passed; zero failures,
  skips, cancellations or timeouts**. Inventory, native syntax, syntax self-test,
  browser security configuration, numerical-parity self-test, AI containment,
  runner failure propagation, secret scan and scan self-test passed.
- `pnpm run test:browser-release`: **4 passed**, installed Chromium/Edge,
  desktop 1366px and mobile 375px. Manual salary entry, reports/charts,
  financial/comparison PDF rendering, carried-rule notices, backup JSON download,
  no horizontal overflow, no accidental CSP/runtime errors, and blocked injected
  inline script. Both POST routes returned 503 with the enforcing header.
- The first browser iteration found incorrect test selectors/print-mode
  expectations and a missing local-harness API mapping; these were corrected.
  They were harness defects, not failures in the product's route handlers.
- Financial-year tests cover fully supported, partially supported and later
  held years. Direct comparison to `e1e69f8` passed **25 full sample-output/tax
  boundary comparisons**. Existing nine-fixture full modelling parity and
  60 pension-off full-output hash cases remain unchanged and passed.
- Focused API tests exercise strict enable values, rejection before body reads,
  invalid/missing origins, methods/content types, malformed/oversized JSON and
  chunked uploads, missing/invalid access, shared-budget exhaustion/storage
  failure, bounded provider calls and PDF cleanup attempts after success,
  provider rejection, malformed output and abort. Provider/storage calls are
  mocked; no real personal document or paid provider request was used.
- `pnpm install --frozen-lockfile` passed. Runtime: Node **24.19.0**; installed
  pnpm **11.25.0**. CI remains pinned to pnpm **11.19.0**; that exact package
  manager version and remote Linux CI were not run locally.
- After the final CSP narrowing/browser-script addition, the browser tests,
  syntax self-test, enforcing-policy verifier and 23 browser-security/integrated
  regression tests passed. `git diff --check` passed.

The existing source-hash guard was refreshed only for the intentionally changed
calculator/AI files and three disclosure renderers, after parity verification.
No numeric golden fixtures or failure-propagation assertions were removed.

## Remaining dependencies and limits

Both AI endpoints remain disabled by default **and release-locked**. Before any
enablement, complete the [privacy/access/infrastructure checklist](PRIVACY-BOUNDARY.md).
The Redis implementation is tested against mocked REST responses, not an actual
multi-instance service. Expiry, concurrent load, credentials and provider/file
retention must be verified in a separately authorised environment. Private bearer
access is not a public user authentication system. Never ship that token in JS.

Classic branch protection returned GitHub **403, Resource not accessible by
integration**. The accessible repository-rulesets endpoint returned `[]`.
Required-check enforcement therefore **cannot be confirmed**. No settings changed.

The enforcing CSP is prepared and locally browser-tested; actual hosting headers,
preview-toolbar injection, Safari/Firefox, physical mobile devices and native
print dialogs remain untested. Browser tests render PDFs through Chromium and
stub the interactive print dialog. No deployment was authorised or performed.

The subsequent [evidence closure](RELEASE-EVIDENCE-2026-10-19.md) resolves the
SAPTO latest-version evidence item, records the absent per-IP limiter, and adds
partially supported-year rendered evidence. It supersedes this report's open
SAPTO verification status; see [SAPTO.md](SAPTO.md) for the source-access limits.
Resolve licence/ownership/distribution terms before distributing under an
open-source licence; none has been selected. Privacy/Terms retain their existing
draft status; this work does not claim legal compliance.

See [Age Pension source register](AGE-PENSION.md) and
[CSP rationale](assurance/R4A-CSP-AND-SECURITY-HEADERS.md). Browser screenshots in
`release-evidence` contain synthetic sample data only.
