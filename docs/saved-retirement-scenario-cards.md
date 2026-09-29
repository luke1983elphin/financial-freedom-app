# Saved retirement scenario cards

The cards now group the saved retirement pathway, balances at full retirement, asset exhaustion, retained capital, and spending status through the saved horizon. Capital details collapse, and the card uses a single column on small screens. Differences show current-plan settings → saved settings with named people, formatted values and an expandable list. Existing stale revision checks and all scenario actions remain in place.

## Files and architecture

- `semiRetirementUi.js`: compact outcome extraction from the existing results view model; current-versus-saved draft differences.
- `semiRetirementProjection.js`: exports the existing retained-assets helper; no projection arithmetic changed.
- `app.js`: versioned snapshot creation, grouped card rendering, legacy fallback and expanded saved-snapshot comparison.
- `styles.css`: responsive sections and detail controls.
- `tests/saved-retirement-cards.test.mjs` and `scripts/test-suites.mjs`: 29 registered regression tests.
- `scripts/verify-saved-retirement-cards.mjs`: optional local browser workflow, with Playwright supplied through `FFS_PLAYWRIGHT_MODULE`.

## Persistence and legacy handling

The existing scenario envelope and input/base-plan snapshots are unchanged. New retirement `keyResultSnapshot` objects use version 2 and contain a version-1 `retirementOutcome`, formatted sections, and flattened rows for compatibility. Only compact primitive outcome data is stored, not annual projection rows. Migration already preserves this field. Duplicate, reload and current-plan edits preserve saved outcomes.

Older snapshots show their original saved rows and an explicit notice that additional outcomes are unavailable. Missing retirement results never fall back to current-plan financial results. Opening and saving a new scenario captures the expanded data. A legacy snapshot's original labels are retained rather than assigning an unverified meaning to an old value.

The saved-library comparison includes all four outcome sections for two new snapshots, retaining differing horizon and status labels. Mixed/legacy comparisons retain shared saved rows. The separate detailed retirement projection comparison keeps its existing saved-input calculation path.

## Definitions

- Accessible investments: canonical `closingAccessibleInvestmentBalance` in the first modelled fully retired household row.
- Superannuation: `totalSuperBalance` in that row, including super still subject to each person's access age.
- Retirement funding assets: canonical `totalInvestableAssets`, accessible investments plus super; this is not a claim that locked super is immediately spendable.
- Capital remaining: existing `retainedAssetsAtYear(lastAnnualRow, false)`, using end-of-horizon retained capital asset values less canonically linked debt. Accessible and super balances are excluded. Unknown property debt produces unavailable equity rather than an invented amount.
- Principal residence equity: retained home value less its linked debt, shown within the optional capital breakdown, never added to accessible funding. Modelled downsizing is reflected through released cash and the replacement home without double counting.

Values are nominal closing balances. For households already retired at projection start, the retirement balance is the first modelled fully retired year, not a reconstructed historical balance. Household milestone ages are named for each person.

Accessible exhaustion reuses the canonical milestone where present. Super exhaustion is the first projected zero household super closing balance with a super withdrawal. Both use explicit already-zero handling at full retirement (or throughout the projection). Otherwise the card says not exhausted by the actual saved horizon; no age is extrapolated. These are first depletion events, so a later modelled inflow can replenish a balance. Spending status uses the first annual `unmetSpending > 0`; retained property and locked super do not mask a cash shortfall.

## Verification

29 new tests cover balances, semi-retirement pathways, exhaustion, actual horizon limits, locked super, retained home/property, downsizing, zero ownership, unknown debt, legacy rendering, current-plan differences, snapshot independence and comparison with different horizons/statuses.

Browser checks cover saving through the real dialog, desktop and 375px mobile rendering, no horizontal overflow, stale/current-plan differences, immutable saved results after editing the plan, duplication, persistence after reload and no browser errors.

Final verification: `pnpm run verify` passed, including 962/962 regression tests (29 new card tests), syntax, inventory, security, parity and runner checks. Desktop and mobile browser checks passed. The repository has no standalone typecheck, lint or production-build commands; its static application uses the existing syntax, security, parity, browser-security and complete regression workflow via `pnpm run verify`.

## Limits

The engine has a home-downsizing event but no separate investment-property sale event. Cards reflect existing projected capital rows and exclude zero-value/zero-ownership assets; this change adds no sale model. Legacy outcomes are not silently regenerated. Current-plan differences compare the current canonical retirement defaults with the saved draft, while the outcome remains the saved snapshot. Inactive semi-retirement and zero-contribution stop-age differences are suppressed.
