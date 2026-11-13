# Second-stage execution and scope evidence

Starting commit: `065de0410698bb82edb66a4f192ed765e0dd102c`, the head of Draft PR #61 when reviewed. Both the repository and connected GitHub PR were checked. The second-stage change adds review/evidence files only under this directory. The existing branch-specific Vercel deployment disable remains unchanged. No calculation, protection fixture, original audit result, default, schema, deployment setting or financial UI source has been altered.

## Commands and results

| Command / check | Result |
| --- | --- |
| `node docs/audit-2026-11-13/household-audit.mjs` | All original 48 households / 99 checks replayed; original output files unchanged byte-for-byte, including all original discrepancies |
| `python docs/audit-2026-11-13/stage2/recheck-original.py` | **99/99 expected amounts independently recomputed** using Python and no production helpers. Arithmetic agrees under stated eligibility/convention assumptions; this does not convert hypothetical gross-return or desired downside support into current product promises |
| `node docs/audit-2026-11-13/stage2/reproduce.mjs` | **59 diagnostics**, 50 numerical comparisons (15 match, 35 diverge), 9 observations. Divergences intentionally include confirmed errors, conditional alternative conventions and desired unsupported scope. Evidence-generator exit 0 is not a financial correctness pass |
| `node docs/audit-2026-11-13/stage2/browser-trace.mjs` | Four real Chromium traces complete: three landlord routes plus reinvestment tax route; both display bases, actual chart series, weekly data, detailed retirement, saved input/context reopening and PDF rendering. Eight saved input/result equality assertions pass; zero runtime exceptions |
| `python docs/audit-2026-11-13/stage2/inspect-pdfs.py` | Four actual PDFs extracted with `pdftotext`; displayed source amounts found. PDFs reproduce the financial errors; no claim their financial values passed an independent correctness gate |
| `PNPM_HOME=/tmp/ffa-pnpm XDG_DATA_HOME=/tmp/ffa-xdg COREPACK_HOME=/tmp/ffa-corepack pnpm run verify` | **63 suites; 1,247 passed; zero failed, skipped, cancelled or TODO.** Includes inventory, syntax, CSP/security, numerical parity self-test, AI containment, runner failure propagation, secret scan/self-test, protected hashes and golden regression checks |
| `node --test --test-concurrency=1 tests/dollar-basis-browser.mjs tests/stage1-browser-workflows.mjs tests/age-pension-browser.mjs tests/release-browser.mjs` | **52 passed**, zero failed/skipped/cancelled/TODO; 181.4 seconds |
| New JS syntax, Python AST parse and `git diff --check` | Pass |
| Direct source/fixture comparison to PR61 starting revision | No financial source/hash/golden diffs; original first-stage evidence retained |

Runtime is Node v24.22.1 and environment-provided pnpm v11.25.0. Repository declares pnpm 11.19.0; the version difference is retained as a qualification. No dependencies or lockfile were changed. Task-local pnpm/XDG/COREPACK directories avoid writing outside the workspace. Chromium runs against a temporary local server/profile with enforced repository CSP. The trace injects diagnostic read access to existing app closure state and chart-series capture into served source only; it does not replace financial algorithms. The browser trace uses an isolated profile and synthetic inputs, not a personal browser session.

Existing browser regressions regenerate PNG evidence. The 24 generated tracked PNGs were restored to the starting revision; none is included in this change. Full diagnostic PDFs are local `/tmp/ffa-stage2-*.pdf` artifacts; their hashes, sizes, extracted amount checks and regeneration scripts are committed, rather than committing binary reports with transient timestamps. Browser evidence JSON is compactly serialised to avoid unnecessary repository bulk.

The accompanying [verification-summary.json](verification-summary.json) records counts and SHA-256 values for the reviewed financial/application modules. `diagnostics.json` and `original-99-review.json` retain individual numeric evidence; `browser-trace.json` retains the browser's actual inputs, values and render traces. All calculations run under the pinned source; the review does not claim every possible household, law or specialist account has been verified.

## Interpretation and remaining gates

Regression success establishes that this documentation/evidence review did not change guarded behaviour. It is expected that independently demonstrated defects coexist with passing old regressions. Future corrections must be judged against approved independent financial expectations; they must not preserve an incorrect result to keep an old hash green.

The [source register](SOURCES.md) distinguishes current published pension parameters, dated legislation, indexed ATO excerpts, failed direct source requests and unverified specialist cases. Latest-law contents alone are not a full consolidation review. User-facing Monte Carlo remains **NO-GO** pending the corrections/applicability decisions in [REVIEW.md](REVIEW.md) and [ROADMAP.md](ROADMAP.md).

Draft PR #61 is the review destination. No merge, deployment, Monte Carlo implementation or protected financial correction is authorised or performed. Remote CI status, if reported in the final response, refers to the newly published review commit and is separate from these completed local results.
