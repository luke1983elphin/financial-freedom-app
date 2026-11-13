# Retirement results interface

The results shown after Calculate Retirement Plan now follow five sections: Your Retirement Outlook, Your Retirement Journey, scenario adjustments, How Your Retirement Is Funded, and Explore Your Detailed Results.

## Presentation boundary

`retirement-results.js` reorganises the existing, dollar-basis-aware rendered result in a detached template. `app.js` installs this adapter after the dollar-basis adapters. Existing renderer functions and their financial inputs remain intact. No calculation engine, pension/tax/funding/debt rule, dollar conversion function, saved-data schema, default or assumption is changed. No dependencies are added.

The four headline cards show household full retirement (year and both ages for couples, age for singles), lifestyle funding ages, non-super investments remaining and superannuation remaining. Both balances identify the forecast end and selected dollar basis. Super retains an access-age caveat. A compact status row shows the existing cumulative shortfall, discounted annually in today's dollars. A forecast with no shortfall is described as funded only through its end date. Full household retirement outside the forecast is identified explicitly.

The journey flattens the existing model timeline into a vertical chronological list, retaining calendar years, names, ages and details. It shows the first six events and makes the rest expandable. It does not calculate new milestones.

Stable `data-rr-source` attributes identify original renderer fragments independently of visible headings. Missing required sections or unexpected markup fall back to the complete original results with a visible notice. Unknown top-level content remains in Important Information.

Native `details` / `summary` elements provide independent keyboard-accessible panels. Expansion uses the existing ephemeral UI state, survives adjustments and dollar switching, and does not trigger a projection. Comparison entry points reveal the comparison panel. Pending, invalid and last-valid-result messaging remains with the existing adjustment controls. Critical model notes and debt/comparison warnings remain visible through automatically expanded panels.

## Retained information and controls

- The old balance snapshot, investment-exhaustion details, semi-retirement funding totals, discretionary spending, surplus assumption, passive income and tax details remain in View Detailed Funding Breakdown.
- The home/property/debt and retained-assets renderers remain together, with their dates, individual loans, ownership and growth assumptions.
- Pension estimates, optional with/without-pension comparison and annual amounts remain in Age Pension Estimate. The summary distinguishes actual projected inclusion, zero estimates, disabled estimation and unsupported circumstances.
- The original comparison controls, saved/temporary scenarios, breakdowns and portrait/landscape/full-detail PDF output remain available.
- The full annual table and mobile annual cards remain available. Phones can also scroll the full table horizontally.
- All original assumptions, carried-forward-rule notices and disclosures remain accessible.
- The spending input and slider still accept today's-dollar input. The outcome indicator uses the existing selected display basis. Reset and Manage Expenses retain their existing behaviour.
- Impact of Your Changes distinguishes no adjustment, unavailable comparison, invalid/last-valid results and a valid changed scenario. Existing original/adjusted end balances, their existing delta, and first-shortfall ages/years are shown; the detailed original comparison remains expandable.
- Funding defaults to a short paragraph containing only modelled sources. Detailed source explanations remain in the funding panel. Exhaustion without a spending shortfall uses neutral styling; continuation wording also checks for other modelled funding.
- Home/debt labels and values wrap and stack without overlap, including long payoff descriptions. Net-worth/property-equity distinctions and negative rental cashflow explanations do not change values or assumptions.

## Chart scope and limitations

The chart uses `household.closingAccessibleInvestmentBalance` directly for every annual row, discounted only by the existing dollar-basis helper at that row's year and the scenario's inflation rate. It reconciles with the annual forecast. It does not add super, unallocated cash or retained property equity. Any explicit withdrawal reserve still applies.

The apparent early depletion was caused by tiny positive annual closing balances. In the existing couple sample, nominal balances are $3,603.68 (2062), $126.13 (2063), $4.41 (2064), $0.15 (2065), $0.01 (2066), then $0 (2067). The engine records exhaustion when the closing balance is zero and a withdrawal occurred. The chart and milestone use the same rows; offset and unallocated balances are zero around this event. Super remains positive and spending remains funded. No reserve, inaccessible-asset or year-mapping discrepancy was found, and the engine was not changed.

The chart now marks the canonical exhaustion year and explains the apparent rounding difference. An expandable six-year table shows selected-basis values to cents, explicitly identifying positive amounts below one cent. Responsive axes use compact currency labels; an all-zero series has only a zero-value tick.

A combined withdrawable-assets chart remains out of scope. The existing comparison exposes a final investment-plus-super delta and first-shortfall timing, but no cumulative shortfall-dollar delta. The UI explicitly identifies this limitation instead of deriving a new comparison calculation. Total super may include amounts below access age. Existing model limitations remain unchanged. The 30-second comprehension objective has not been measured in a user study.

## Verification and evidence

Commands: `pnpm verify` and `pnpm test:browser`, using Node 24.19.0. Nine presentation unit cases exercise real engine fixtures (single, staggered couple, semi/full retirement, funded/shortfall, restricted super, depletion, outstanding debt, pension and zero/different inflation), plus existing comparison snapshots and missing/invalid comparison handling. Seven retirement browser cases cover 1366px, 375px and 430px layouts, exact annual/chart reconciliation, tiny residuals, zero charts, stable section identifiers and complete fallbacks, axis/debt label overlap, long payoff descriptions, native keyboard expansion without projection calls, state persistence, adjustments/reset/deltas, Manage Expenses, saved-data non-mutation, pension wording and a single-person shortfall. Existing browser suites continue to cover scenario comparisons and PDF output.

Final verification: `pnpm verify` passed all 1,216 tests across 61 suites; `pnpm test:browser` passed all 33 browser tests. The seven retirement browser cases were additionally rerun after adding all-zero-chart coverage and complete journey screenshots. No final failures, skips, cancellations or todo tests. Existing protected hashes, deterministic numerical parity, security, syntax, inventory, runner-failure and secret-scanning checks pass unchanged.

An initial verification run encountered a Windows `UNKNOWN` file-open error while an existing contribution test read the unchanged `semiRetirementProjection.js`. The isolated 15-test suite and the subsequent complete verification run both passed without code, hash, assertion or timeout changes.

Screenshots in this directory show the summary, complete journey, changed scenario adjustments, funding/chart and expanded Home & Debt at desktop and both mobile widths (1366, 375, 430). They use the app's existing sample plan and selected today's-dollar display. No screenshot figures are hardcoded into the application.

Refinement files: `app.js`, `retirement-results.js`, `styles.css`, `tests/retirement-results.test.mjs`, `tests/dollar-basis-browser.mjs`, this document and the screenshots. Protected functions and golden hash files remain unchanged.
