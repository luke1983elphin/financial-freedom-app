# Age Pension verification — 13 October 2026

PR #33 remains draft. **Do not merge: the full suite is not green.**

- Original PR head: b904d6182ca8029476dc98c35ffee5a974c3da00.
- Before changes: 53 suites; 1,100 passed, 14 failed.
- After changes: 54 suites; 1,113 passed, the same 14 failed.
- New Age Pension tests: 13 passed, including 60 exact complete-output parity runs.
- Real browser: 2 passed at 1366px and 375px, covering default-off/collapsed state, placement before Projection settings, responsive overflow, on/off calculation and comparison output.
- Native syntax checks, syntax self-test, inventory, browser security configuration, numerical parity self-test, runner self-test, secret scan and secret-scan self-test passed.
- No existing failing tests were removed, weakened or changed.

## Existing blockers reproduced on the original branch

| Suite | Failures | Cause shown by tests |
| --- | ---: | --- |
| ux-stage1 | 3 | Navigation expectation, missing dashboardMissionHtml test target, pre-existing protected calculator hash mismatch |
| minor-presentation | 2 | Extracted rendering function references estimatedCashflow outside its test context |
| engagement | 1 | Dashboard navigation label expectation |
| semi-retirement-ui | 5 | Navigation markup and progressive-disclosure expectations |
| stage-d | 2 | Top-level navigation order and Weekly Plan location |
| integrated-release-candidate-r6 | 1 | Navigation/export inventory expectation |

These failures concern earlier interface changes and their test fixtures. The
approved task excludes unrelated refactors, and its release instructions require
all checks to pass. Resolving those failures requires a separate focused review
of the current intended navigation and affected test fixtures. Do not accept a
merge merely because the new pension tests pass.

The numerical approximation limits and sources are in AGE-PENSION.md. In
particular, SAPTO/pensioner Medicare concessions and pension supplement minimum
payment edge cases remain outside this indicative annual model and need review
before describing it as a precise entitlement calculator.
