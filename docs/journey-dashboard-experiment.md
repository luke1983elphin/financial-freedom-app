# Journey dashboard experiment

Open `/?dashboard=journey` to go directly to the alternative dashboard. The normal URL retains the existing dashboard and home experience. The query parameter stays in the URL while navigating the existing app. No preference or alternate plan is stored.

The new presentation has a progress card, scrollable milestone journey, four-number snapshot, lifestyle target and links to existing scenario tools. With the experimental workspace open, the duplicate home summary is hidden. All original navigation remains available. The experiment can be removed by reverting this PR.

## Canonical sources

| Display | Existing source | Presentation choice |
| --- | --- | --- |
| Financial Freedom progress | `freedomPercent(result)` in `app.js` (raw progress, existing score fallback) | Labelled FI target progress, not retirement spending coverage. The bar is visually clamped to 0–100; the displayed number is not clamped. |
| Net worth | `result.currentNetWorth` | Same current net worth as Results and Future You. |
| Accessible FI assets | `result.accessibleFiAssets` | Canonical current FI wealth output, including eligible super by each person's age. No independent asset aggregation. |
| Current ages | `plan.personal.person1Age/person2Age` | Both ages shown for couples. |
| Semi-retirement | Existing `semiRetirementScenarioDraft.people`, only `hasSemiRetirement === true` with a valid age before full retirement | Explicitly labelled Retirement Planning scenario setting; no invented days-per-week value. |
| Full retirement target | `plan.personal.fullRetirementAge` | Main plan target, labelled Person 1 age for couples. |
| Lifestyle target | Existing `lifestyleTarget(result)` helper | Main plan annual target in today's dollars, with its existing expense fallback. |
| Super projection | Exact age-60 row from `result.superProjection`, `closingBalance` | Future nominal household dollars; for couples, when Person 1 is 60. If no exact row exists or Person 1 is already 60+, use `result.superannuationBalance` labelled current super. |
| Cash surplus | Existing `estimatedCashflow(result)` helper | Annual final projected cash surplus after tax, costs and planned investing. |
| Horizon | Last row of `result.financialFreedomProgressProjection`, `age` | Actual main model endpoint, not a manufactured age 90. |
| Readiness | `personalisedResultsReadiness(plan, result)` | Incomplete plans show setup prompt and unavailable amounts rather than implied zero balances. |

## Ambiguities and limitations

The main plan's legacy `semiRetirementAge` is also presented elsewhere as an FI target age; it is not evidence that reduced work is enabled. This experiment does not turn it into a semi-retirement milestone. Explicitly enabled settings from the existing Retirement Planning draft are shown with their scenario context. That draft is separate from the main plan; changing it does not change the main-plan numbers on this dashboard. No new scenario persistence is introduced.

The main accumulation projection can end earlier than the separate Retirement Planning scenario. Its actual endpoint is used and labelled as the main projection. A horizon is not a promise that lifestyle spending remains funded to that age.

The current progress helper differs in semantics from retirement cash-flow coverage. Accordingly the hero says “Financial Freedom progress” and “of your FI target”, rather than claiming a percentage of future spending is funded.

Scenario buttons open existing Decision Engine or Retirement Planning screens; they do not pre-apply edits or select an optimal option. Detailed Future You/projection information remains in those existing experiences. Horizontal milestones are not time-scaled. Mobile users can scroll within the keyboard-focusable journey region.

## Financial integrity

No changes to calculator, tax/Medicare/STSL, super/employer contributions, investment growth/income, property/rent, debt/offset, semi-retirement projection engine, drawdowns, FI targets, exhaustion, retained capital, weekly plan, reports, schemas or storage code. The adapter consumes the existing result and never invokes an extra calculation. Navigation does not write the plan or introduce storage keys.

## Verification

`pnpm run verify` runs the existing release verification pipeline and full suite, including eight new presentation tests. `scripts/verify-journey-dashboard.mjs` uses the existing browser-test hooks and synthetic fixture data to compare the entire calculator output between normal and journey URLs, verify navigation and unchanged localStorage/plan data, exercise semi-retirement enable/disable, and check single/couple/incomplete/large-value cases. It checks 1440px desktop, 768px tablet and 375px mobile, card bounds, touch targets and console errors.

Run browser checks with `FFS_PLAYWRIGHT_MODULE` pointing at a Playwright installation. Set `FFS_PREVIEW_URL` to repeat them against the Vercel preview. Browser screenshots and verification JSON are written to `outputs/journey-dashboard/`. Committed review screenshots contain only synthetic fixtures.
