# Retirement results interface

The results shown after Calculate Retirement Plan now follow five sections: Your Retirement Outlook, Your Retirement Journey, scenario adjustments, How Your Retirement Is Funded, and Explore Your Detailed Results.

## Presentation boundary

`retirement-results.js` reorganises the existing, dollar-basis-aware rendered result in a detached template. `app.js` installs this adapter after the dollar-basis adapters. Existing renderer functions and their financial inputs remain intact. No calculation engine, pension/tax/funding/debt rule, dollar conversion function, saved-data schema, default or assumption is changed. No dependencies are added.

The four headline cards use existing retirement timing, the first unfunded year or forecast end, the annual non-super closing investment balance, and the sum of existing annual unmet-spending values. Today's-dollar cumulative shortfalls use the existing annual discounting helper. Super is shown separately with an access-age caveat. A forecast with no shortfall is described as funded only through its end date. Full household retirement outside the forecast is identified explicitly.

The journey flattens the existing model timeline into individual event entries, retaining calendar years, names, ages and details. It shows the first six chronological events and makes the rest expandable. It does not calculate new milestones.

Native `details` / `summary` elements provide independent keyboard-accessible panels. Expansion uses the existing ephemeral UI state, survives adjustments and dollar switching, and does not trigger a projection. Comparison entry points reveal the comparison panel. Pending, invalid and last-valid-result messaging remains with the existing adjustment controls. Critical model notes and debt/comparison warnings remain visible through automatically expanded panels.

## Retained information and controls

- The old balance snapshot, investment-exhaustion details, semi-retirement funding totals, discretionary spending, surplus assumption, passive income and tax details remain in View Detailed Funding Breakdown.
- The home/property/debt and retained-assets renderers remain together, with their dates, individual loans, ownership and growth assumptions.
- Pension estimates, optional with/without-pension comparison and annual amounts remain in Age Pension Estimate. The summary distinguishes actual projected inclusion, zero estimates, disabled estimation and unsupported circumstances.
- The original comparison controls, saved/temporary scenarios, breakdowns and portrait/landscape/full-detail PDF output remain available.
- The full annual table and mobile annual cards remain available. Phones can also scroll the full table horizontally.
- All original assumptions, carried-forward-rule notices and disclosures remain accessible.
- The spending input and slider still accept today's-dollar input. The outcome indicator uses the existing selected display basis. Reset and Manage Expenses retain their existing behaviour.

## Chart scope and limitations

The chart uses `household.closingAccessibleInvestmentBalance` directly for every annual row, discounted only by the existing dollar-basis helper at that row's year and the scenario's inflation rate. It reconciles with the annual forecast. It does not add super, unallocated cash or retained property equity. Any explicit withdrawal reserve still applies.

A combined withdrawable-assets chart is deferred: the available total-investable-assets field can include super below access age, while the engine's eligible-retirement-funding figure is not exposed as an annual output. Deriving a substitute would exceed this presentation-only change. Milestones remain in the journey rather than overlaid on the chart. Existing model limitations are unchanged. The 30-second comprehension objective has not been measured in a user study.

## Verification and evidence

Commands: `pnpm verify` and `pnpm test:browser`, using Node 24.19.0. Eight new unit cases exercise real engine fixtures (single, couple, semi/full retirement, funded/shortfall, restricted super, depletion, outstanding debt, pension and zero/different inflation). Five added browser cases cover 1366px, 375px and 430px layouts, exact annual/chart reconciliation, native keyboard expansion, no projection on opening a panel, state persistence, adjustments/reset, Manage Expenses, saved-data non-mutation, pension wording and a single-person shortfall. Existing browser suites continue to cover scenario comparisons and PDF output.

Final totals: 1,215 tests across 61 suites; 31 browser tests. No failures, skips, cancellations or todo tests. Existing protected hashes, deterministic numerical parity, security, syntax, inventory, runner-failure and secret-scanning checks pass.

Screenshots in this directory show the summary/journey and funding/details at desktop and both mobile widths. They use the app's existing sample plan and selected today's-dollar display. No screenshot figures are hardcoded into the application.
