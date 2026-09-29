# Financial report presentation and print redesign

## Scope and result

Presentation only, based on main `4a6f987656aa71c5b892b9496864610eed6e03be`. The report describes the current plan; saved retirement scenario inputs/outcomes and comparison behaviour are unchanged. No calculator, retirement projection, schema, tax or allocation maths changed.

The opening combines a concise executive narrative and At a Glance. The balance sheet separates household position, FI assets and other capital. Cashflow has a visible starting amount, deductions and remaining surplus. Rental cashflow and passive income are grouped without double counting. FI progress uses a current/gap/target bridge with explanatory wealth-creation metrics. Future outlook separates near-term, ten-year and long-term figures. Four charts occupy two readable print pages. Milestones use a 2-by-2 layout. Actions show an observation, supporting amount and scenario to test. Assumptions and the final loan/modelling/disclaimer section retain existing educational language.

Repeated outcome tiles and duplicated action lists were removed; numerical information was retained in its relevant section. Empty rental/passive sections and absent STSL deductions are omitted. Zero values remain where needed to explain FI wealth or reconcile cashflow.

## Files

- `app.js`: reusable report metric/group/chart builders, report narrative and explanations, rental and loan displays, factual milestone status, responsive report chart rendering. The shared chart accepts an optional width; all other callers retain their existing default.
- `styles.css`: report hierarchy, mobile stacking, A4 named print page, card/paragraph/heading/table protection, full-width charts and normal-flow footer.
- `index.html`: clarifies the current-plan source of the report toolbar.
- `tests/financial-report-presentation.test.mjs`: 28 behavioural/report regression tests.
- `tests/stage-readiness-r6a.test.mjs`: updates the existing report renderer assertion while retaining its check that the authoritative stage classifier supplies the displayed stage.
- `scripts/test-suites.mjs`: registers the new report suite.
- `scripts/report-fixture.mjs`: representative couple and simpler single-person fixtures.
- `scripts/verify-financial-report.mjs`: optional local Edge/Playwright screen, mobile and PDF verification. Its local server instruments the report entry point to capture the exact result passed after the existing adapter; production source is not instrumented.
- `scripts/check-report-pdf.py`: optional PDF margin, rectangle, protected-content, orphan-heading and final-page checks using pdfplumber.

## Definitions verified against existing code

| Metric | Existing definition and report explanation |
| --- | --- |
| Accessible FI Assets / Current FI Assets | Cash and offset plus eligible financial investments, less non-property investment debt (liquid subtotal floored at zero), plus each person's accessible super. Home and investment-property equity are excluded. Main-plan super access is age 60 for each person separately. |
| Investment Property Equity | Investment property gross value less the corresponding property debt, using stable links and existing fallback rules. Not immediately spendable retirement funding. |
| Total FI Wealth | Accessible FI Assets plus Investment Property Equity. Excludes principal-residence equity and inaccessible super. |
| Home Equity | Principal residence value less home-loan debt. Kept separate from available retirement spending. |
| Current investment portfolio | `investmentBalance`: non-super investment projection starting balance, including cash but excluding offset; not an additional amount to add to the balance sheet. |
| Target FI assets | Target annual lifestyle spending inflated to the entered full-retirement age, with the horizon limited to 0–30 years, divided by the positive withdrawal assumption (otherwise the existing 4% fallback). |
| FI progress | Current accessible FI assets divided by target capital. The displayed percentage reuses `freedomPercent`; only the visual bar and line are capped at 100%. Future progress uses each year's inflation-adjusted spending target. |
| Estimated FI age | `milestoneReachEstimate(result, 75)`: current age if already at 75%, otherwise the first forecast row at or above 75%. This is the app's milestone, not a new affordability test. |
| Estimated Financial Freedom age | `targetAgeOutcome`: the first forecast row reaching 100% of that year's target, or Beyond 30 years. Unlike the FI helper, this helper searches forecast rows rather than a current-year row; this existing behaviour is unchanged. |
| Sustainable income | Current FI assets multiplied by the effective withdrawal assumption. An estimated income-support measure, not actual cash income or a guarantee. |
| Passive Cash Income | Interest + dividends + distributions + rental passive cash income after interest/before principal + other passive income. Salary/wages excluded. Uses the existing passive-income breakdown. |
| Financial Investment Growth | Eligible shares/ETFs, crypto, managed funds, investment bonds and other investable financial assets multiplied by the entered investment return. Cash and offset excluded from this growth metric. |
| Property Growth | Investment-property gross values multiplied by their resolved property growth rates, using existing defaults/overrides. Home growth excluded from this metric. |
| Combined Wealth Creation | Existing sum of Passive Cash Income + Financial Investment Growth + Property Growth. If entered investment returns include dividends/distributions, this can overlap. The report explicitly warns that it is not an independent total return or spendable cashflow. |

The portfolio projection compounds its entered annual return and uses affordable contributions. Separately entered passive income is not automatically reinvested. No new reinvestment assumption is asserted. Inflation affects target spending and future FI requirements; current cashflow living expenses remain entered amounts.

Milestone thresholds remain 25%, 50%, 75%, 100%. “On track” previously meant only that a threshold occurred within the forecast, not that the target age was met. The report now says “Projected within forecast” without changing the condition. The current financial-stage indicator still uses `financialStageInfo`, whose thresholds differ from the report milestone ladder.

## Cashflow and rental treatment

“Remaining annual cash surplus” consistently means `finalProjectedCashSurplus`: household cash income less estimated income tax, Medicare, MLS, compulsory STSL, living expenses, debt cashflow deductions, affordable investing and extra super. Monthly surplus is this amount divided by 12. The starting label is household cash income before tax, because rental cash income can already be net of operating costs/interest; describing every component as gross salary would be misleading.

Rental cashflow preserves the engine's treatment: before-interest rent deducts full linked loan repayments; after-interest rent deducts principal separately. Passive rental income is after interest and before principal. Taxable rent is a separate value used by the tax estimate. These rental amounts are already in household income and deductions, not extra amounts to add again. Zero estimated linked interest is explained as a prompt to check links, balances and rates, not replaced with an invented rate.

## Loan interest investigation

The old report read `plan.liabilities.homeLoanInterestRatePct` from the working plan. The application calculates from an adapted copy that derives loan information from structured liabilities, so the working-plan legacy field can remain zero while individual home/rental loan rates are nonzero. A single home-loan rate also cannot represent multiple loan types.

The report now reads active structured loans from `result.plan` via `canonicalLiabilityItems`, with each loan's rate and balance. It identifies genuinely missing rates (when preserved by the input) and explicit zero rates neutrally. An unstructured legacy plan retains its home-loan rate fallback. STSL is excluded from the ordinary-interest list. Tests reproduce a legacy zero alongside structured rates of 5.8% and 6.2%. The user's device-only plan was not available, so this is a reproduced display-path finding rather than an assertion about their exact entered rate.

## Existing projection issue discovered, not changed

`netWorthProjection` and the report's `projectedDebtAtYear` omit investment-property loan balances in future years. The current balance sheet and FI property-equity calculation include those debts. This can create an apparent early net-worth increase/debt reduction and overstate future net worth/understate future debt.

No financial logic was changed. A conditional warning appears in Future Outlook when investment-property debt exists, and the debt chart explains the year-zero versus forecast scope. Correcting the calculation requires a separate modelling change with dedicated regression review. The broader debt/asset model has different paths; no claim of full model assurance is made by this presentation work.

## Print, accessibility and visual QA

The report uses a named A4 portrait page with 14mm top, 12mm side and 16mm bottom margins. Main logical sections start on new pages. The opening stays together in tested fixtures; passive income follows rental details without a split. Cards, charts, disclaimer and rows avoid page breaks. Headings stay with following content; paragraphs use widow/orphan protection. Tables have fixed width and repeated headers. The footer remains in document flow, with a separate page-number margin box. Report controls and the duplicate app disclaimer are hidden for report printing. Text is readable at 9.5–10pt for supporting copy, with larger values/headings; no whole-page shrinking or clipping is used.

Desktop uses two/three columns by category; 375px mobile stacks cards and resizes chart coordinates so labels remain legible. SVGs have descriptive accessible labels. Status is conveyed in text, not colour alone. The original disclaimer wording is retained in full.

| Fixture | Before | After | Visual inspection |
| --- | ---: | ---: | --- |
| Couple: salaries, STSL, home/home loan, investments, super, rental property/loan, passive income, investing, positive surplus | 14 pages | 12 pages | Every final page inspected |
| Simpler single-person plan without rental/STSL/passive sections | 12 pages | 11 pages | Every final page inspected |

All 23 final pages were rendered with Poppler and visually inspected. PDF checks passed for 133 protected components, text/box page margins, intact component text, headings with first content, and nonblank final pages. Desktop and mobile were visually checked; both had zero horizontal overflow. No boxes outside printable margins, clipped cards/text, unintended card splits, chart overflow, footer collisions, orphan section headings or unnecessary blank final pages were found in these exports.

## Verification and reproducibility

The exact result received by `renderReports` was captured before and after for both fixtures. Every top-level result field other than the plan envelope was compared, including full investment, super, net-worth and FI projection arrays: zero differences. This covers income, tax, Medicare, STSL, spending, investing, debt deductions, surplus, wealth categories, FI target/progress and future balances. Unit tests also verify unchanged milestone helpers and that rendering does not mutate results.

Run `node --test tests/financial-report-presentation.test.mjs`, or the registered report group. Full repository verification uses `pnpm run verify` (including all unit/projection/integration/UI suites, syntax, security, parity, inventory and runner checks). There are no standalone typecheck, lint or production-build scripts in this static-app repository; none were invented or claimed.

Final local verification passed: `pnpm run verify`, 990/990 tests including 28 new report tests. Browser checks found no uncaught page errors or mobile horizontal overflow in either fixture; PDF structural checks passed for both exports.

For browser/PDF QA, set `FFS_PLAYWRIGHT_MODULE` to an installed Playwright module, then run `node scripts/verify-financial-report.mjs . outputs/report` followed by `python scripts/check-report-pdf.py outputs/report`. Edge and pdfplumber are optional local QA dependencies. Baseline generation uses the same script with an unchanged checkout path and `--baseline`. PDF rendering uses Poppler. Verification totals and CI status are recorded in the PR/completion response.

## Limits and release control

Layout acceptance is verified for the two supplied representative fixtures in Chromium/Edge A4 at default scale, with browser-added headers/footers off. Printer drivers, paper sizes, user scaling, substituted fonts, unusually long custom labels, and unusually large loan/history lists can change pagination; preview those cases before distributing a report. Larger content is allowed to flow to additional pages rather than being clipped.

This branch is for review only. No merge or manual production deployment is part of the task. The existing rental-debt forecast omission and potential return/passive-income overlap are disclosed for separate modelling review.
