# Stage 2 mobile usability — U02–U05

Repository: `luke1983elphin/financial-freedom-app`  
Branch: `ui/mobile-usability-stage2`  
Baseline: latest main `cfe63844eb762dc4e89cda16cb73334428bc0683`.

PR #64 was already merged before work began. Its annual-forecast adapter and scoped styles remain intact. This PR implements only U02–U05 from [the roadmap](../mobile-usability/REPORT.md).

## Implementation

### U02 — Try a Change comparisons

At screen widths through 900px, the existing forecast grid becomes stacked labelled comparison rows. Each measure retains Current Plan, Adjusted Plan and the signed Difference, with the original year, value strings and explanations. When reopening a saved Try a Change, the baseline is explicitly labelled Saved base plan, consistent with the existing saved-base banner. Values and long labels can wrap. Desktop and print retain the existing comparison grid; mobile-only labels are hidden there.

The adapter moves existing rendered strings into labelled containers. It does not calculate returns, differences, taxes, inflation or forecast values. It runs after every existing render, including preset/custom changes, allocation choices, basis switching and saved-scenario opening. Repeated decoration is idempotent.

Tests cover valid positive, zero and negative outcomes, custom changes with negative available cash, saved-car-scenario restoration, long descriptions and a $9,876,543,210 portfolio. [Comparison parity evidence](comparison-parity.json) records all three forecast rows for each preset/basis/viewport case, compared against the original renderer.

### U03 — Honest setup progress

My Plan now says Step 1 of 7, etc., and Navigation progress. The adjacent explanation states that steps show location, not completed or validated financial information. Review/results steps no longer display Setup complete merely because the user navigated there. Active step chips use `aria-current="step"`.

Next, Previous, Save, data entry, existing navigation, readiness/completeness calculations elsewhere and the footer layout are unchanged. The original guarded wizard renderer is retained; a presentation wrapper changes only these navigation-progress labels immediately after rendering.

### U04 — Retirement spending constraints

The mismatch came from `buildScenarioAdjustmentState` providing a **step of 1000**, minimum zero and a dynamic slider maximum. The guarded renderer reused that step for the numeric editor, although the engine accepts derived amounts such as $75,490. Advanced and comparison editors also supplied step 1000. The adjustment numeric editor had no maximum; the slider maximum is a UI scale, not a model limit.

Presentation wrappers give the spending number inputs `step="any"`, `min="0"` and `required`. They retain the exact numeric value. The existing coarse slider and ±$5k actions remain unchanged; there is no new financial cap or rounding rule. Capturing input validation rejects blank, negative and non-finite edits before legacy fallback/coercion handlers can replace the draft. Calculate/save/comparison creation are blocked while a visible spending editor is invalid. Valid values continue through the original handlers and projection engine. An invalid edit cancels a pending adjustment redraw so its text is not replaced by an earlier debounce.

Acceptance tests cover $75,490, $75,000, $75,500, $0, $75,490.37, tiny positive amounts, blanks, negatives and non-finite/unsupported number strings. Full projection JSON matches an independent call to the existing engine with the same draft. Save, Calculate, Reset, comparison-input validity and reopening a saved retirement draft retain exact amounts and history. Existing summary-currency display rounding is unchanged; the numeric editor and saved draft retain the entered decimal value.

### U05 — Understandable saved scenarios

- **View saved snapshot** opens a read-only historical-results section. It does not load plan inputs, rerun retirement history or replace the current plan. Missing stored outcomes are explicitly unavailable rather than fabricated.
- **Compare with current plan** displays current engine results beside stored snapshot results. For retirement scenarios, the existing temporary retirement-comparison path is retained. Existing dollar-basis display helpers are reused.
- **Open temporary change** restores saved Try a Change/custom settings into the existing temporary draft; current financial-plan inputs remain unchanged.
- **Open retirement scenario** uses the existing retirement draft/recalculation path. The card explains that the current plan and stored history remain unchanged and saving a new scenario is separate.
- **Compare saved snapshots** retains the original saved-to-saved comparison for non-retirement snapshots, with a label distinct from current-plan comparison.

Names, notes and dates remain in their metadata positions. Retirement cards retain their live Changes from the current plan heading and comparison. On non-retirement cards, the Financial changes recorded when saved section excludes exact known metadata-only records such as Saved plan snapshot, while retaining genuine saved financial changes. Stored `changedInputs` and result snapshots are not rewritten. Current-plan input comparison uses the existing schema migrator on clones to avoid presenting legacy/canonical migration bookkeeping as financial changes. It omits app metadata/cached engagement/AI information but retains actual financial inputs, including weekly starting balances. Difference labels identify named records and familiar units instead of exposing raw schema paths.

The viewer provides Back to saved scenarios with focus return and Return to current plan. Current comparisons refresh through the existing render path; historical results remain stored/read-only. Old outcomes without sufficient metadata for a today's-dollar conversion retain the existing unavailable-conversion behavior; no new historical projection is calculated to fill that gap.

## Financial safeguards and architecture

The implementation is in a new standalone presentation/helper module plus a single installer in `app.js`, invoked after the existing display adapters. Existing guarded functions are wrapped, not edited or exempted from checks. The original financial renderers, scenario loading/saving functions, assumptions, tax/CGT/Age Pension, retirement funding/withdrawal logic, defaults and schemas remain unchanged. No external dependencies were added.

Golden fixtures, protected hash manifests and all engine files are byte-identical to baseline. No tolerances or guards were relaxed. The current-plan comparison calls the normal existing forecast/snapshot helper; historical viewing uses stored results. No financial formulas are implemented in this presentation code.

## Verification

- `pnpm verify`: **66 suites, 1,297 passed, zero failures/skips**. Includes all protected/golden, syntax, inventory, security/CSP, runner and secret-scan checks.
- `pnpm test:browser`: **69 passed, zero failures/skips**, in 234.6 seconds. A final retirement-heading scope correction then passed **4 focused U04/U05 browser tests** (10.1 seconds); the financial code and figures were unchanged. Includes all existing browser/PDF workflows and the complete Stage 2 coverage.
- Eight new helper/validation tests and eight targeted browser workflows plus the four-screen evidence workflow passed.
- [Verification JSON](verification.json) records counts/runtime; [financial safeguards](financial-safeguards.json) records unchanged baseline hashes; comparison evidence contains 72 forecast rows and 216 original financial strings.
- Before/after and stress captures total **40 screenshots** at 375, 390, 768 and 1366px. Geometry tests check document and affected component widths; native keyboard/focus and 44px touch targets are covered.
- Local runtime: Node 24.22.1 / pnpm 11.25.0. No dependencies were added. Remote CI and final Draft/deployment status are linked from the PR after pushing.

Targeted coverage includes eight browser workflows for the four findings, the four-width evidence workflow, and eight helper/validation tests. The complete browser suite retains all annual-forecast Stage 1 checks, reports/PDF, dollar-basis, financial correction, saved-history and navigation tests.

## Before/after gallery

Each initial-state capture uses the same synthetic public couple or blank plan, with the comparison at the default preset. Screenshot times naturally differ. U04's key change is native validity, not the calculated amount; numeric validity and full result parity are tested directly. The existing U06 setup-footer density/overlap can still be seen in U03 images and is intentionally outside this PR.

| Finding | 375px before | 375px after | 390px before | 390px after |
| --- | --- | --- | --- | --- |
| U02 comparisons | [Before](before/u02-375.png) | [After](after/u02-375.png) | [Before](before/u02-390.png) | [After](after/u02-390.png) |
| U03 setup | [Before](before/u03-375.png) | [After](after/u03-375.png) | [Before](before/u03-390.png) | [After](after/u03-390.png) |
| U04 spending | [Before](before/u04-375.png) | [After](after/u04-375.png) | [Before](before/u04-390.png) | [After](after/u04-390.png) |
| U05 snapshots | [Before](before/u05-375.png) | [After](after/u05-375.png) | [Before](before/u05-390.png) | [After](after/u05-390.png) |

Tablet/desktop captures for every finding are in the same folders with `768` and `1366` suffixes. Large-value negative comparisons: [375px](after/u02-negative-large-375.png), [390px](after/u02-negative-large-390.png), [768px](after/u02-negative-large-768.png), [1366px](after/u02-negative-large-1366.png).

## Limitations and review recommendation

- Chromium viewport testing does not establish physical iPhone Safari, VoiceOver or software-keyboard behavior; a device pass remains appropriate before release.
- U06–U14 remain deferred, including setup-footer density, navigation/control density, investment summary repetition, Weekly navigation and broader terminology work. The existing annual-forecast Stage 1 changes remain in place.
- Existing financial-model limitations from the prior audit are unchanged; this is not financial-model sign-off or Monte Carlo approval.
- Saved Try a Change drafts continue to use their stored base when reopened, as the existing engine requires. The baseline label and retained banner disclose that scope; Compare with current plan is a separate action.
- Historical rows without the original data needed for display-basis conversion are not reconstructed by a new calculation.

All local checks pass. **Recommendation: ready for final usability review**, subject to remote CI and owner review. No known blocking issue remains within U02–U05. Keep it Draft. No merge or deployment is part of this task. The exact branch is excluded from Vercel Git deployment, and main's existing deployment block is retained.

Additional viewer evidence: [375px](after/u05-viewer-375.png), [390px](after/u05-viewer-390.png), [768px](after/u05-viewer-768.png), [1366px](after/u05-viewer-1366.png). The existing backup notice is dismissed in the test fixture before keyboard focus checks; production reminder behavior is unchanged.
