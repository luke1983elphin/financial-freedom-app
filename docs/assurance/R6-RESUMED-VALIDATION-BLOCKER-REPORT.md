# R6 Resumed Validation Blocker Report

## Outcome

**BLOCKED - stop rule triggered.** A material Retirement Planning result inconsistency was confirmed during the first full fictional personal-plan browser journey. No runtime correction, preview deployment, production action, push, merge or AI enablement was performed. Validation stopped before scenario, PDF, backup, import-security, preview and device sign-off.

## Accepted baseline

- Source: `stage-r6b-canonical-salary-timing-final-source-20260908-194000.zip`
- SHA-256: `B47F5C650B80682AD3C064EBFC1416F547454E7619238AC3134E708A49459FC9`
- Git identity: unavailable in the accepted archive; no commit ID is asserted.
- Baseline verification: `pnpm run test:r6b` passed 18/18; `pnpm test` passed 645/645.

## New blocker: R6-F7

**Severity: High / release blocker / material cross-screen inconsistency.**

The Retirement Planning result snapshot says:

- `Semi-retire: No semi-retirement phase`
- `Fully retire: Not modelled`

The same result models and displays:

- Taylor fully retires in 2046 at age 60;
- Morgan fully retires in 2048 at age 60;
- household full retirement begins in 2048;
- `Semi-Retirement Funding: $70,402 total` for the intervening household transition years.

The projection arithmetic is not shown to be wrong. The result summary is materially false and internally contradictory, so users cannot reliably interpret the scenario.

## Exact reproduction

1. Open the accepted R6B source locally in a fresh browser origin.
2. Create a two-person personal plan: Taylor age 40 and Morgan age 38.
3. Enter Taylor salary `$3,500` fortnightly and Morgan salary `$2,800` fortnightly.
4. Enter assets, liabilities, annual living costs and a `$70,000` Financial Freedom lifestyle target.
5. Complete setup and open Retirement Planning.
6. Leave `Do you plan to semi-retire?` as `No` for both people.
7. Leave each person's full-retirement age at 60 and project to age 90.
8. Select `Calculate Retirement Plan`.
9. Observe the contradictory snapshot, timeline and funding output described above.

## Root cause

The projection engine correctly defines household `semi-retirement` as any year in which the household is neither entirely full-time nor entirely fully retired. This includes staggered full-retirement dates (`semiRetirementProjection.js:211-214`).

The result view model then loses the fields required by the snapshot:

- `personListFromProjection()` returns only `id`, `name`, `currentAge` and `superAccessAge` (`semiRetirementUi.js:1045-1061`).
- `renderSemiRetirementSnapshotHtml()` asks that reduced `viewModel.people` collection for `semiRetirementAge` and `fullRetirementAge` (`app.js:8384-8389`).
- `semiRetirementPersonTimingLabel()` filters on missing `hasSemiRetirement` and reads missing timing fields, producing the fallback strings (`app.js:8018-8029`).
- The funding panel independently and correctly sums projection rows whose `householdPhase` is `semi-retirement` (`semiRetirementUi.js:1843-1858`; `app.js:9063-9075`).

## Affected files and lines

- `semiRetirementUi.js:1045-1061` - incomplete person result view model.
- `app.js:8018-8029` - label helper depends on fields omitted by the view model.
- `app.js:8384-8410` - false snapshot labels are rendered.
- `semiRetirementProjection.js:211-214` - authoritative household-phase rule, retained as evidence rather than identified as faulty.
- `semiRetirementUi.js:1843-1858` and `app.js:9063-9075` - contradictory but projection-driven funding output.

## Proposed narrow correction for approval

1. Preserve the projection engine and all financial formulas.
2. Carry `hasSemiRetirement`, `semiRetirementAge` and `fullRetirementAge` from the matching input/draft person into `personListFromProjection()`.
3. Make the snapshot distinguish an explicitly elected personal semi-retirement phase from a household transition caused by staggered full-retirement dates. Do not call the latter `No semi-retirement phase` when projection rows classify it as semi-retirement.
4. Add integration tests for two people with equal full-retirement ages but different current ages, verifying the snapshot dates against timeline milestones and household-phase rows.
5. Add a single-person no-semi-retirement test and a two-person explicit semi-retirement test to preserve valid fallback behaviour.

## Work completed before stop

- Exact accepted archive hash verified.
- Fresh validation workspace created without Git metadata or inherited changes.
- `pnpm install --frozen-lockfile` completed.
- `pnpm run test:r6b`: 18 passed, 0 failed.
- `pnpm test`: 645 passed, 0 failed.
- Fictional personal plan completed through the browser setup flow.
- Cross-screen setup/dashboard headline values reconciled: gross income `$163,800`, net income `$131,944`, living costs `$63,700`, loan repayments `$32,400`, annual surplus `$35,844`, and net worth `$698,000`.
- Base Retirement Planning scenario calculated and the blocker reproduced.

## Not completed after stop

Base plus up to three scenario comparison, actual report/PDF/print inspection, Saved Scenarios, Weekly Plan end-to-end, R5 browser durability journeys, import-security browser checks, full responsive/accessibility matrix, protected Vercel preview, deployed CSP/network/console review, saved-data compatibility, rollback compatibility and physical-device checks were not continued.

## Preservation confirmation

No application, calculation, storage, security, Weekly Plan, Vercel configuration or test-expectation file was changed. R1, R3B, R4A, R5, R6A and R6B behaviour remains untouched.
