# Stage 4 Release Candidate Assessment

## Executive assessment

The `feature/linked-investment-setup-legal-drafts` working copy is technically suitable to become a release candidate for a small, controlled invited-user beta, subject to the conditions below. It is not ready for public launch.

Stage 4 found and corrected one release-blocking fixture defect: bundled rental-property samples represented the linked rental loan as a generic investment loan. That excluded the loan from household liabilities and property equity while also reducing accessible investments. The sample builder now creates the same `rentalPropertyLoan` relationship as the guided setup. No protected financial formula changed.

A presentation inconsistency was also corrected: Retirement Planning used the first annual projection row but labelled it `Current debt`. It now says `Debt after first projection year`. Projection semantics are unchanged.

## Baseline

- Branch: `feature/linked-investment-setup-legal-drafts`
- Repository HEAD before the uncommitted Stage 1-4 work: `f698b61f419c9abc42435adae3a021713cd23ab7`
- Accepted Stage 3A source archive: `stage3a-canonical-integrity-final-source-20260919.zip`
- Accepted Stage 3A SHA-256: `485AB38C30D720B3DD50716BB1A124B90B3422C99107E56A722B986C0DE79F64`
- Runtime: Node `v24.19.0`, pnpm `11.19.0`
- Lockfile: present; the project has no third-party package dependencies.

## Release gates

| Gate | Status | Evidence / condition |
| --- | --- | --- |
| Calculation integrity | PASS | 841 tests pass; seven Stage 4 release tests cover four household types, the rental-link regression and containment/presentation copy; protected financial files are byte-identical to Stage 3A. |
| Canonical data integrity | PASS | Stage 3A 21/21; relationship validation, deterministic migration and scenario provenance remain active. |
| Migration | PASS | Legacy scalar, linked-record, scenario, Weekly Plan and backup migration paths are covered by the Stage 1-3A and R5 suites. |
| Persistence / backup | PASS | R5 33/33, including fail-closed coordinator behavior, rollback, malformed import and delete protection. |
| Security | PASS | R1 AI, R4A browser-security, syntax, secret scanner and scanner self-tests pass; no dependency graph is present. |
| Accessibility | CONDITIONAL PASS | Critical controls have labels and names; modal focus trap/restoration and keyboard close work. Duplicate IDs remain in mutually hidden render templates and should be removed post-beta. |
| Mobile UX | PASS | No page-level overflow at 375, 390 or 430 px. The workspace navigation is intentionally horizontally scrollable. |
| Desktop / tablet UX | PASS | No page-level overflow at 768, 1024 or 1366 px; fresh setup and persisted workflows were exercised. |
| Reports / PDF | CONDITIONAL PASS | A complete report rendered with assumptions and disclaimer and no wide tables. Browser print was invoked, but native print-preview page-by-page inspection was not available in the automated browser environment. |
| AI containment | PASS | Server gate remains exact and disabled; UI states that coaching is unavailable; R1 tests pass; no provider request occurred in normal flows. |
| Clean installation | PASS | Must be confirmed by the final extracted-package commands recorded with the delivered archive. |
| Legal readiness | FAIL | Terms and Privacy are drafts with operator/contact and governing-jurisdiction placeholders. External Australian legal/regulatory review is required. |
| Controlled-beta readiness | CONDITIONAL PASS | Technically suitable for a small invited beta after owner accepts the known limitations and gives testers the backup and draft-legal notices. |
| Public-launch readiness | FAIL | Legal approval, final operator details, print review and beta feedback remain outstanding. |

## Calculation integrity

The compact Stage 4 parity suite stores material outputs for:

- a single salary earner with home, mortgage, cash, shares, super and expenses;
- a couple with two salaries, one STSL balance, private hospital cover, offset, shares and super;
- a property household with home, rental property, rental loan, rental cashflow and property equity;
- a semi-retirement household with accessible investments, super, debt and retirement outcomes.

It verifies tax, net income, surplus, total debt, net worth, accessible investments, super, property equity and retirement outputs. The protected file hashes are:

- `calculator.js`: `02101A14BACCC8010C8B607F5435F016989D46EE899F13FF88E39AC59A10D08B`
- `semiRetirementProjection.js`: `B114BF99017C349BF2AF9A87D58E9F3D15ADAB47F602F6493B1A721F053F2FB4`
- `weekly-plan.js`: `0AAF2710B38ADBACBA8B9ABF12FA6E9E2E42F42138C017DE053237CDE481BCB5`
- `weekly-planner-export.js`: `F0F6E4C82F4EA81039502D83C95EFE88D68ECD460B5F7BDE78AE3AE55DB7EE80`

## Fresh-user and browser evidence

A clean-origin browser journey completed household setup, two salaries, home and mortgage, cash, shares, rental property and loan, spending confirmation, two super balances, goals and assumptions. It reached a ready Dashboard, Decision Engine, Retirement Planning and a generated 52-week Weekly Plan. Refresh restored the personal plan and Weekly Plan.

The resulting cross-screen figures reconciled to $1.79m assets, $870k debt and $920k net worth. Weekly Plan used estimated net salary rows and separately scheduled the rental-loan principal. Retirement Planning calculated successfully and now describes first-year debt accurately.

The browser console contained no warnings or errors. Practical view-change timings were below one second in the attached browser session. The current all-views render retains about 47,000 DOM nodes; reducing hidden DOM is a post-beta performance improvement.

## Migration and recovery

The canonical migration runs before calculation and before backup acceptance. Invalid relationships are repaired non-destructively or rejected where required. Complete-backup import validates the migrated schema before batch persistence. R5 tests cover atomic restore, rollback, malformed data, storage failure and preservation of the open in-memory plan.

The destructive clear-and-restore journey was not manually repeated against the populated attached browser because local deletion requires an explicit interactive confirmation. The same supported workflow is exercised by the active R5 functional suite.

## Architecture sanity check

No new RC blocker was found in the final read-only review:

- canonical collections are projected through one legacy calculation adapter;
- the calculator is called through the adapter, not from competing UI stores;
- relationship mutation and validation remain centralised;
- scenario overlays remain separate from the base plan;
- backup import uses schema migration and validation;
- persistence-changing writes remain coordinated by `storage.js`.

Post-beta improvements:

- remove duplicate IDs from mutually hidden render templates;
- reduce the retained all-view DOM and measure on low-end physical devices;
- continue retiring compatibility scalars only after migration telemetry and beta evidence exist;
- perform broader physical-device and assistive-technology testing.

## Print and content review

The representative couple/property report rendered 10,000+ characters, all major assumptions, rental cashflow, projections, milestones and the financial-modelling disclaimer. It contained no wide HTML tables. Readiness gating is covered by browser-security and Stage 1 tests. Native print preview was invoked but could not be inspected page-by-page in the controlled browser, so PDF presentation remains a beta acceptance condition rather than a public-launch sign-off.

## Merge procedure (not executed)

1. Preserve the current branch and final archive hash as the rollback point.
2. Review the proposed inventory in `docs/STAGE4-COMMIT-INVENTORY.md` and exclude private assurance material.
3. Commit the cohesive Stage 1-4 release as one reviewed release-candidate commit; a squash merge is appropriate because the current working copy contains the staged feature set as uncommitted files over the older branch HEAD.
4. Open a pull request from `feature/linked-investment-setup-legal-drafts` to `main`.
5. Re-run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm run verify`, `pnpm run security:scan` and the critical browser smoke in the PR checkout.
6. Obtain product-owner and external legal decisions; do not enable AI.
7. Merge only after explicit approval. Tag the merge as `v3.0.0-beta.1` (or the owner's established release convention).
8. Verify the protected preview, then production only under a separate deployment authorisation.
9. Roll back to the recorded pre-merge `main` commit or the Stage 3A archive if a release blocker appears.

## Verification summary

- Stage 4 release suite: 7 passed, 0 failed.
- Stage 3A: 21 passed, 0 failed.
- R5 durability: 33 passed, 0 failed.
- Full regression: 841 passed, 0 failed across 40 suites.
- Live browser: fresh setup, ready Dashboard, Decision Engine, Retirement Planning, Weekly Plan, reload persistence, responsive matrix, modal keyboard flow and console review passed.
- Child-process headless browser harness: unavailable in this sandbox because the browser process did not expose its debugging endpoint; this was not an application failure and the accepted harness was left unchanged.

Final `verify`, security, clean-extraction and archive hash results are reported alongside the delivered artifact.
