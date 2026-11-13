# Verification evidence

Audited main commit: `6f3dbf83cc744e765eddf6244313635ea357bc9a` (confirmed again through GitHub immediately before preparing the PR). New files live under `docs/audit-2026-11-13`; the only other change disables Vercel Git deployment for the exact audit branch. No protected financial source or fixture is edited.

## Independent financial checks

```sh
node docs/audit-2026-11-13/household-audit.mjs
```

48 household scenarios, 99 checks, 36 households matching all checks, 12 households with discrepancies/limitations. Complete input/expected/actual/delta evidence is retained, including failures. This is a financial audit runner, deliberately separate from the regression test manifest; it does not replace or weaken any existing test. Exit 0 means evidence generation completed and every discrepancy has a finding ID. It is not a financial correctness pass. Any new mismatch in a case without a known finding produces a non-zero exit; existing findings still require human review of their deltas.

Methods and assumptions are described in [REPORT.md](REPORT.md) and [SOURCES.md](SOURCES.md). No existing tests/golden outputs were used as the oracle. H20/H21 test effective annual interpretation, H38 tests a stated gross-super interpretation, H41 uses year-end tax settlement, and H44 tests the financial domain required for negative-return simulation. Those scenarios must not be interpreted as proof that the app promises those conventions.

## Existing repository checks

```sh
PNPM_HOME=/tmp/ffa-pnpm XDG_DATA_HOME=/tmp/ffa-xdg COREPACK_HOME=/tmp/ffa-corepack pnpm run verify
```

**Pass: 63 suites, 1,247 tests; zero failures, skips, cancellations or TODO tests.** Inventory, syntax, syntax self-test, browser CSP/security configuration, numerical parity self-test, AI containment, runner failure propagation, secret scan/self-test, protected source hashes and golden regression checks all pass. [verification-summary.json](verification-summary.json) records per-suite counts. A separate direct `node scripts/run-tests.mjs` invocation also passed the same 1,247 tests before the full verification completed.

Runtime: Node v24.22.1, pnpm v11.25.0 supplied by this environment (repository declares pnpm 11.19.0). No dependency or lockfile was changed. The initial pnpm invocation could not create its default user-data directory in the sandbox; setting task-local PNPM/XDG/COREPACK directories resolved it. This version difference is recorded rather than claiming the exact CI toolchain was reproduced.

The new JavaScript audit runner passes `node --check`, the source collector passes Python compilation, and `git diff --check` passes. Production financial calculations, defaults and fixtures have no diff from the audited main. Their SHA-256 values are recorded in household-results.json, and existing protected-hash tests additionally verify the repository's guarded files/functions.

## Browser verification

The existing browser command is:

```sh
node --test --test-concurrency=1 tests/dollar-basis-browser.mjs tests/stage1-browser-workflows.mjs tests/age-pension-browser.mjs tests/release-browser.mjs
```

The sandboxed attempt stalled before browser startup while creating its loopback test server; it was stopped. The same existing tests were then run outside the network-isolated sandbox against local Chromium. **Pass: 52 browser tests; zero failures, skips, cancellations or TODO tests; 215.0 seconds.** Counts are recorded in verification-summary.json. Browser tests regenerated their existing PNG evidence; those generated screenshots were restored to the audited main so they are not included in this audit PR. These are existing UI/regression journeys, not the 16-household user study and not independent verification of tax legislation.

## Boundaries

No financial correction, Monte Carlo engine, production deployment, preview deployment or merge was performed. Current government-source failures and conditional pension checks are explicit in SOURCES.md. Local successful regression cannot erase the financial discrepancies or establish qualified legal/tax assurance. The Draft PR remains a review artefact and a no-go assessment for user-facing Monte Carlo.
