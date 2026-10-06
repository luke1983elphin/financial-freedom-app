# UX Simplification — Stage 1

Navigation and dashboard presentation only. Prepared for independent review on 6 October 2026. No merge, push or deployment performed. Setup simplification has not started; AI remains disabled under the existing configuration.

Current implementation: `C:/Users/luket/Documents/GitHub/financial-freedom-app`, branch `ux-simplification-stage-1`, created from freshly fetched `origin/main` at `bd23b2aa9016c8c8be70a16c9de5bea74a38a5b2`. The previous real-repo branch had no commits outside main. The reviewed patch was transferred from `ux-stage1-work`; main exactly matched that review baseline. The separate opt-in journey dashboard experiment is excluded. No merge conflicts or calculation changes were needed. Git line-ending conversion was corrected to preserve the baseline line endings; the three application source files now match the reviewed files byte-for-byte. The review-copy checkout was not modified.

## Navigation map

| Before | After | Existing view ID |
| --- | --- | --- |
| Dashboard | Dashboard | `dashboard` |
| Financial Plan | My Plan | `setup` |
| Decision Engine | Future | `decision` |
| Retirement Planning | Retirement | `semiretirement` |
| Investments | More → Investments | `investments` |
| Super | More → Super | `super` |
| Goals | More → Goals | `goals` |
| Weekly Plan | More → Weekly Plan | `weeklyplan` |
| Reports | More → Reports | `reports` |
| Saved Scenarios | More → Saved Scenarios | `scenarios` |

More is a native `details` disclosure, not a new route. It opens with Enter/Space, exposes buttons in normal Tab order, closes on selection or Escape, and returns focus to its summary when a selected button becomes hidden. Existing destination buttons retain `aria-current="page"`. More is highlighted when an advanced destination is active. The mobile navigation wraps into two rows with at least 44px control heights rather than scrolling horizontally. Existing feature flags retain their behaviour.

**No views were deleted.** The complete set of `data-view-panel` IDs matches the baseline. Existing aliases and direct navigation targets remain unchanged.

## Dashboard hierarchy

1. **Where you are now:** Financial Freedom %, accessible FI assets, net worth and annual surplus, all from existing results. View Financial Details opens the existing disclosure and moves keyboard focus to its summary.
2. **Your Future:** the existing Future You selector, current-age default and all seven existing outputs. Its calculation and age-selection functions are unchanged.
3. **When work could become optional:** existing calculated retirement timing labels, when available, plus Explore retirement plan. If no valid retirement result exists, the card shows explanatory copy and the link; it does not invent an age or run a new projection.
4. **Try a change:** a non-AI link to the existing `decision` view, replacing the unavailable AI card on the normal dashboard.

The old score banner, financial stage presentation, milestones, weekly mission and deeper financial presentation remain inside Financial Details. The AI card renderer remains in the source; its dashboard call is removed. No AI code, API, configuration, recommendation ranking or scenario controls were changed.

Future now opens a heading of “Try a change.” The custom scenario builder remains available as “More detailed scenario.” Display copy in scenario comparison areas uses Future where appropriate; persisted scenario type labels and internal keys remain unchanged.

The empty home journey introduction now describes building a plan, seeing the future, exploring retirement and trying changes. The existing fallback home journey cards use the same sequence. Start My Plan, Load Sample Plan, Continue, backup controls and legal links remain available.

## Advanced access

| Presentation moved or collapsed | Access retained |
| --- | --- |
| Six advanced primary tabs | More, plus existing direct buttons |
| Detailed current financial results, charts, stage and weekly mission | Dashboard → View Financial Details |
| Financial Progress | Financial Details and Reports → Track Your Progress |
| Assumptions | Existing setup review, dashboard assumptions and report assumptions |
| Custom scenario builder | Future → More detailed scenario |
| Investments / Super / Goals in setup | Existing setup steps, alongside their dedicated More destinations |
| AI unavailable card | Not displayed on the normal dashboard; underlying inactive AI code preserved |

## Screenshots

Captured in headless Microsoft Edge at 1440px and 375px. Dashboard-only crops hide the sticky global header during capture to avoid obscuring the top of the component; full-page captures preserve the complete page.

| View | Before | After |
| --- | --- | --- |
| Desktop full page | [Before 1440px](docs/ux-stage1-evidence/before-1440.png) | [After 1440px](docs/ux-stage1-evidence/after-1440.png) |
| Mobile full page | [Before 375px](docs/ux-stage1-evidence/before-375.png) | [After 375px](docs/ux-stage1-evidence/after-375.png) |
| Dashboard | — | [Desktop](docs/ux-stage1-evidence/dashboard-1440.png), [mobile](docs/ux-stage1-evidence/dashboard-375.png) |
| More expanded | — | [Desktop](docs/ux-stage1-evidence/more-1440.png), [mobile](docs/ux-stage1-evidence/more-375.png) |

## Calculation parity

**ZERO numerical differences.** Before-change golden results were captured before editing the UI. After-change results are compared with strict deep equality, with no tolerance or rounding. The compressed fixture stores complete results, not just headline values.

- Nine fixtures: all seven bundled sample plans, a single-person fixture and a populated couple/property/offset fixture.
- 328,780 numeric leaves across complete calculator results, retirement drafts, retirement projections and earlier-retirement scenario projections.
- All nine baseline retirement projections and all nine alternative scenarios validate successfully.
- Includes current net worth, accessible FI assets, FI percentage, passive income, surplus, target capital, investment projections, loan balances, super, tax, retirement milestones, exhaustion, retained assets and scenario outcomes through complete output-object comparison.
- Time fixed at `2026-10-06T00:00:00Z` for deterministic capture and verification.
- Result SHA-256: `ce7cd3bf25813288fc8821835f6ba7f69324561e0b2984514a90bf5d9d3dfb75`.
- Source guard verifies 16 protected files and 773 unchanged app function sections against the main baseline, normalising only line endings. This includes calculation/selector/mutation/schema/storage/sample-data/API modules and existing Future You/scenario functions. The excluded sections are explicitly listed presentation/rendering/event-handler sections and were reviewed in the diff.
- Browser comparison additionally checks complete calculator results, quick-scenario inputs, Future You output at ages 43/55/65, all quick-scenario rendered outcomes and custom-scenario outcomes against the baseline. Navigation preserves plan data and localStorage exactly.

Evidence: [parity-results.json](docs/ux-stage1-evidence/parity-results.json), [golden fixture](tests/fixtures/ux-stage1-before.json.gz), [protected source hashes](tests/fixtures/ux-stage1-protected.json).

## Verification

Historical review baseline `pnpm test`: **1,087 passed**, zero failures/skips. All final results below were rerun in the real repository after transfer; they are not copied verification results.

Final results: **`pnpm test`: 1,095 passed across 52 suites; `pnpm run verify`: passed, including 1,095 tests; `pnpm run security:scan`: passed with zero findings; desktop/375px browser smoke: passed with zero browser errors.**

Final command results are recorded in [regression-results.json](docs/ux-stage1-evidence/regression-results.json). Fresh real-repository logs are retained at `C:/Users/luket/Documents/ChatGPT/Financial Freedom/ux-stage1-transfer-evidence`: `targeted-final.log`, `test-final.log`, `verify.log`, `security.log`, `parity.log` and `browser.log`. All final runs passed. The initial pre-correction full test recorded one line-ending-sensitive source-text assertion failure; the corrected final full run passed all 1,095 tests.

The eight new unit/regression tests cover navigation grouping and retained IDs, dashboard composition, supplied current values, unavailable retirement results, existing retirement timing labels, Future You outputs, exact numerical parity and protected-source integrity. Four existing test files update only presentation wording/order expectations.

The browser smoke covers all fifteen requested categories: five primary choices; six advanced destinations; More opening/closing; Future, Retirement and My Plan mappings; unavailable AI card removal; Try a change presence and routing; Future You outputs; Financial Details; unchanged underlying view IDs; desktop/mobile layout; keyboard navigation; exact financial parity. It also exercises setup exits, dedicated Super and retirement-intent links, report/progress links, assumptions, detailed scenarios, and save/open scenario links.

Browser evidence: [browser-results.json](docs/ux-stage1-evidence/browser-results.json). The `agent-browser` executable was unavailable, so verification uses the bundled Playwright runtime and installed Edge. The browser harness serves the unchanged disabled AI configuration locally and does not call an AI provider. Tests use isolated browser profiles and fictional fixtures.

Reproduce from this checkout:

```powershell
pnpm test
pnpm run verify
pnpm run security:scan
node scripts/ux-stage1-parity.mjs
# Set FFS_PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.
node scripts/verify-ux-stage1-browser.mjs
```

## Changed files

- `app.js`: navigation labels/disclosure presentation, dashboard composition, retirement result display, empty home copy and visible comparison wording. No calculation or persistence changes.
- `index.html`: five primary choices, More disclosure, retained content regrouping and heading/journey copy.
- `styles.css`: responsive navigation, dashboard hierarchy, focus and tap targets.
- `scripts/test-suites.mjs`: registers the new focused suite.
- `tests/ux-stage1.test.mjs`, `scripts/ux-stage1-parity.mjs`, `scripts/verify-ux-stage1-browser.mjs`: new focused and browser/parity checks.
- `tests/fixtures/ux-stage1-before.json.gz`, `tests/fixtures/ux-stage1-protected.json`: immutable baseline evidence.
- `tests/integrated-release-candidate-r6.test.mjs`, `tests/sample-plans-multi-comparison-g2h.test.mjs`, `tests/semi-retirement-debt-property-stage-d.test.mjs`, `tests/semi-retirement-ui.test.mjs`: updated presentation assertions.
- `docs/ux-stage1-evidence/*` and this report: screenshots and verification records.

## UX concerns and limits

- Retirement ages are scenario settings from a calculated result, not newly inferred safe retirement ages. They are labelled accordingly. A funding-horizon metric is omitted from the dashboard to avoid implying a reliable result before the user calculates Retirement Planning.
- Future You retains all seven existing metrics, so its mobile card remains taller than a three-metric summary. At 375px the two-column layout reduces scrolling while retaining every output.
- The established engagement home normally hides the older four-card journey. The revised fallback links are tested using its existing legacy-home feature override; the normal home is tested separately. This stage does not redesign the established home or setup.
- Existing saved scenario metadata can still contain “Decision Engine.” It is deliberately preserved to avoid changing saved records or persistence behaviour.
- Verification covers Edge desktop and a 375px viewport, keyboard interaction and DOM semantics. No physical-device or screen-reader session was performed.

Ready for independent review. Final verification evidence is recorded. Stop here before merge or deployment.

## Exact real-repository change inventory

Eight tracked files modified and seventeen new files; nothing staged or committed. Paths below are absolute.

- Modified: [app.js](C:/Users/luket/Documents/GitHub/financial-freedom-app/app.js)
- Modified: [index.html](C:/Users/luket/Documents/GitHub/financial-freedom-app/index.html)
- Modified: [scripts/test-suites.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/scripts/test-suites.mjs)
- Modified: [styles.css](C:/Users/luket/Documents/GitHub/financial-freedom-app/styles.css)
- Modified: [tests/integrated-release-candidate-r6.test.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/integrated-release-candidate-r6.test.mjs)
- Modified: [tests/sample-plans-multi-comparison-g2h.test.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/sample-plans-multi-comparison-g2h.test.mjs)
- Modified: [tests/semi-retirement-debt-property-stage-d.test.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/semi-retirement-debt-property-stage-d.test.mjs)
- Modified: [tests/semi-retirement-ui.test.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/semi-retirement-ui.test.mjs)
- New: [UX-SIMPLIFICATION-STAGE-1.md](C:/Users/luket/Documents/GitHub/financial-freedom-app/UX-SIMPLIFICATION-STAGE-1.md)
- New: [docs/ux-stage1-evidence/after-1440.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/after-1440.png)
- New: [docs/ux-stage1-evidence/after-375.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/after-375.png)
- New: [docs/ux-stage1-evidence/before-1440.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/before-1440.png)
- New: [docs/ux-stage1-evidence/before-375.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/before-375.png)
- New: [docs/ux-stage1-evidence/browser-results.json](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/browser-results.json)
- New: [docs/ux-stage1-evidence/dashboard-1440.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/dashboard-1440.png)
- New: [docs/ux-stage1-evidence/dashboard-375.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/dashboard-375.png)
- New: [docs/ux-stage1-evidence/more-1440.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/more-1440.png)
- New: [docs/ux-stage1-evidence/more-375.png](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/more-375.png)
- New: [docs/ux-stage1-evidence/parity-results.json](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/parity-results.json)
- New: [docs/ux-stage1-evidence/regression-results.json](C:/Users/luket/Documents/GitHub/financial-freedom-app/docs/ux-stage1-evidence/regression-results.json)
- New: [scripts/ux-stage1-parity.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/scripts/ux-stage1-parity.mjs)
- New: [scripts/verify-ux-stage1-browser.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/scripts/verify-ux-stage1-browser.mjs)
- New: [tests/fixtures/ux-stage1-before.json.gz](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/fixtures/ux-stage1-before.json.gz)
- New: [tests/fixtures/ux-stage1-protected.json](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/fixtures/ux-stage1-protected.json)
- New: [tests/ux-stage1.test.mjs](C:/Users/luket/Documents/GitHub/financial-freedom-app/tests/ux-stage1.test.mjs)
