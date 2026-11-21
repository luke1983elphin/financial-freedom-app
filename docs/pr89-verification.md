# PR #89 verification

Scope: personal asset sales and default Age Pension selection for newly created Retirement Planning scenarios.

The new-scenario flag is applied at scenario creation, not to shared main-plan forecast defaults. Saved snapshots are reopened verbatim, including legacy snapshots with no pension setting. The pension engine and calculator are unchanged from base `7bc2d50be66f504f6657bb1e7ec4fccd56740e92`.

Personal asset sales reuse the one-off income funding path, remove the asset from the sale year onward, and reject duplicate sales, missing assets, homes and investment properties. Converting income preserves the amount and year. Comparison report assumptions show the pension inclusion setting.

Validation on Windows, Node 24.22.1:

- `pnpm run verify`: all gates passed; 1,312 automated tests passed, zero failures/skips. Includes full no-sale/pension-off fixture parity, means tests, age boundaries, couples/singles, homeowner status and later eligibility after asset depletion.
- Targeted pension/projection tests: 88 passed.
- `node --test tests/age-pension-browser.mjs`: 3 passed, covering desktop/mobile defaults and toggling, sale conversion, duplicate prevention, saved on/off/legacy snapshots, comparison assumptions and print mode.
- `node --test tests/stage1-browser-workflows.mjs`: 6 passed.
- `node --test tests/release-browser.mjs`: 9 passed, including saved comparisons and printing.
- Four targeted dollar-basis browser cases passed: dated retirement rows/PDFs, zero-inflation pension inclusion, saved-scenario isolation after assumption edits, and growth-comparison isolation.

The initial broad pension default caused unrelated main-plan test harnesses to require the pension engine. Scoping the default to scenario creation resolved those regressions without changing eligibility formulas. Protected fingerprints were refreshed only for this change and one pre-existing stale function fingerprint verified against the unchanged PR base. Release-browser assertions for old labels were reproduced on the base before being aligned with the existing dated labels and baseline name; the existing print CSS permits long assumptions to flow across pages.

Additional optional exploration: the broad dollar-basis browser sweep was interrupted after it stopped progressing; its four relevant cases passed separately. The legacy F04/F08 browser scripts hard-code `/usr/bin/chromium` and timed out before browser startup on Windows. They are not part of the required automated gate; their registered financial regression suites passed in full verification. Generated unrelated screenshots were not committed.
