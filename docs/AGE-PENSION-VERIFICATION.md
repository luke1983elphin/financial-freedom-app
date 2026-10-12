# Age Pension verification — 13 October 2026

## Baseline comparison

| Revision | Suites | Passed | Failed |
| --- | ---: | ---: | ---: |
| Original PR scaffold b904d6182ca8029476dc98c35ffee5a974c3da00 | 53 | 1,100 | 14 |
| Initial implementation 8f675a81c12b35881cd10bb1f437bacef2c4e866 | 54 | 1,113 | 14 |
| Owner follow-up implementation | 54 | 1,130 | 0 |

`pnpm run verify` passed locally: inventory, syntax and its self-test, browser
security configuration, numerical parity self-test, AI containment, runner
failure-propagation self-test, secret scanning and its self-test, and all 54
regression suites. No skipped, cancelled or TODO tests. The 16 pension tests
include 60 exact full-output comparisons against the original engine.

Two real-browser workflows passed at 1366px and 375px: default off/collapsed,
directly below Downsize home, Advanced assumptions collapsed, two specialist
checkboxes inside it, on/off calculation, with/without comparison, compact
annual table, keyboard activation, no horizontal page overflow, unsupported
circumstances producing no estimate, and no browser warnings/errors.

GitHub CI and a Vercel preview of the pushed revision must also pass before the
draft is marked ready and merged. Their run/deployment links and verified
revision are recorded in PR #33. Local success alone is not merge approval.

## Resolution of the 14 baseline failures

| Suite | Failures | Diagnosis and repair |
| --- | ---: | --- |
| ux-stage1 | 3 | Old navigation expectation replaced with exact approved five-tab grouping; actual dashboard mission/journey helpers loaded; stale source hashes updated with audited provenance |
| minor-presentation | 2 | Load actual estimatedCashflow helper into rendering context; retain all rendering assertions |
| engagement | 1 | Check all current labels/destinations, allowing approved SVG icon markup |
| semi-retirement-ui | 5 | Assert current labels, icon-preserving runtime behavior, comparison heading and progressive disclosure; preserve page IDs, controls and AI checks |
| stage-d | 2 | Read full nav rather than first nested div; assert Retirement and Weekly in primary group and all ten destinations in order |
| integrated-release-candidate-r6 | 1 | Assert exact current navigation labels/groups and destination panels; preserve export assertions |

Production navigation/rendering behavior was not changed to repair these tests.
The common navigation helper checks exact labels, grouping, order, uniqueness,
button type and availability. It permits SVG markup without dropping any
destination assertion. The intended navigation comes from merged commit
6724713; subsequent merged presentation changes include 8148cc3 and 08cc6c5.

The original protected-source fixture predates approved changes already on
main (`485174d4da7f941d464020045a1b21aceabaf30f`). Every original guarded
file/function remains checked. Its `approvedRevision.changes` records original,
merged-main and approved hashes for all 21 changed entries. Fifteen are already
identical to main; six cover the approved pension integration. The new pension
module is additionally hash-protected. Unchanged entries retain their hashes.

Neither numerical baseline was regenerated or altered:

- `ux-stage1-before.json.gz`: exact full results for nine financial fixtures.
- `age-pension-off-baseline.json`: 30 households, each with omitted and explicitly
  disabled pension settings, checking the complete original output by SHA-256.

No tests were removed or skipped, tolerances relaxed, CI conditions bypassed,
or correct existing calculations changed to obtain passing results.

## Financial checks and limits

Services Australia and the Australian Government Actuary confirm 1.75%/3.75%
deeming from 20 September 2026. DSS indexation rules informed the annual CPI
projection approximation, with non-indexed policy parameters held fixed.
Tests cover 10-year compounding, zero/negative CPI, future eligibility from
indexed free areas, both means tests, mixed ages, super exemptions, downsizing,
depletion, taxable cash counted once and spending-shortfall milestones.

A zero-private-assets single household spending $25,000 in 2026 dollars remains
funded through age 90 at 2.5% CPI in the test fixture. At $28,000, its first
shortfall occurs in 2049 under the existing ordinary tax assumptions; without
pension it is 2026. Pension continues after private savings are exhausted.

SAPTO, pensioner Medicare thresholds and offset transfers remain unsupported
and clearly disclosed in Advanced assumptions and projection assumptions.
Existing tax brackets are not indexed, so future after-tax income can be
understated and funding shortfalls overstated. This remains an indicative
annual planning model. See AGE-PENSION.md for sources and other limits.
