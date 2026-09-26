# Stage 4 Proposed Commit and Package Inventory

## Repository state

- Branch: `feature/linked-investment-setup-legal-drafts`
- Base HEAD: `f698b61f419c9abc42435adae3a021713cd23ab7`
- No merge, push or deployment was performed.
- No tracked deletion is proposed.

## Proposed application and configuration files

- `app.js`
- `consumer-setup.js`
- `dialog-controller.js`
- `index.html`
- `legacy-plan-adapter.js`
- `linked-setup.js`
- `package.json`
- `plan-mutations.js`
- `plan-schema.js`
- `plan-selectors.js`
- `scenario-overlay.js`
- `styles.css`
- `trust-readiness.js`
- `v2-data.js`

## Proposed tests and test-runner files

- `scripts/test-suites.mjs`
- `tests/canonical-integrity-stage3a.test.mjs`
- `tests/canonical-plan-stage3.test.mjs`
- `tests/consumer-first-stage2.test.mjs`
- `tests/consumer-ux-stage2b.test.mjs`
- `tests/data-durability-r5.test.mjs`
- `tests/linked-investment-setup.test.mjs`
- `tests/release-parity-stage4.test.mjs`
- `tests/semi-retirement-ui.test.mjs`
- `tests/stage1-browser-workflows.mjs`
- `tests/trust-readiness-stage1.test.mjs`

## Proposed product/engineering documentation

- `docs/CANONICAL-PLAN-SCHEMA.md`
- `docs/BACKUP-COVERAGE.md`
- `docs/LEGAL-REVIEW-NOTE.md`
- `docs/LINKED-SETUP-MAPPING.md`
- `docs/PRIVACY-BOUNDARY.md`
- `docs/STAGE2-COMPLETION-REPORT.md`
- `docs/STAGE2-CONSUMER-FIRST-EVIDENCE.md`
- `docs/STAGE2B-COMPLETION-REPORT.md`
- `docs/STAGE3-ARCHITECTURE-REVIEW.md`
- `docs/STAGE3-COMPLETION-REPORT.md`
- `docs/STAGE3-MIGRATION-GUIDE.md`
- `docs/STAGE3A-COMPLETION-REPORT.md`
- `docs/STAGE4-COMMIT-INVENTORY.md`
- `docs/STAGE4-CONTROLLED-BETA-CHECKLIST.md`
- `docs/STAGE4-LEGAL-REVIEW-CHECKLIST.md`
- `docs/STAGE4-RELEASE-ASSESSMENT.md`
- `docs/STORAGE-INVENTORY.md`

## Exclude from the release source archive/deployment

- `.git/`
- `node_modules/`, package-manager stores and caches
- real `.env` files; preserve only `.env.example`
- `docs/assurance/` and other private review/evidence material
- `R2-NUMERICAL-PARITY.json`
- local screenshots, downloaded backups, logs and temporary files
- ZIPs and hash sidecars
- machine-specific test output

The `.vercelignore` already excludes tests, scripts, private assurance, caches, ZIPs, hashes and real environment files from deployment. The source archive retains tests and scripts so an independent reviewer can reproduce verification, while excluding private assurance material.
