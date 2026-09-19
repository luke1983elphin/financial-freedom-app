# Stage 2 Consumer-First Setup Evidence

## Scope

Stage 2 changes presentation and new-plan record creation only. Financial formulas, projection engines, Weekly Plan calculations and storage coordination remain unchanged.

## Before and after

| Area | Before | After |
| --- | --- | --- |
| New-plan collection records | Up to 32 visible zero-value templates: 3 income, 9 assets, 3 liabilities, 12 expenses and 5 goals | 0 persisted collection records until the user chooses an item |
| Mobile setup navigation | Eight large step chips stacked before active content | One native selector showing `Step X of 8`, plus existing Previous and Next buttons |
| Weekly Plan first run | 8 policy and balance fields, plus pay-date and bill-date controls | 2 fields: start date and opening balance |
| Property and investment entry | Generic record entry remained prominent beside guided setup | Guided rental-property and shares/investment actions are primary consumer choices |
| Advanced tax and strategy inputs | Mixed into the broader setup experience | STSL, private hospital cover and downsizing remain available in collapsed native details controls |

## Basic household interaction estimate

A basic household can now reach a useful initial result by entering household details, adding one or two salary records, adding only its actual home/cash/debt records, entering one household-spending amount and setting the lifestyle target. The setup no longer asks the user to inspect or remove dozens of irrelevant zero-value records.

## Compatibility boundary

- New plans carry `meta.setupExperience = "consumer-first-v2"` and initialise empty collections.
- Existing plans with collection arrays retain every record, including legitimate zero-value records.
- Legacy scalar plans without collection arrays continue through the existing compatibility materialisation path.
- Guided linked records continue to use stable IDs and the Stage 1 linked setup helpers.
- Existing Weekly Plans are not regenerated or changed; only the first-run setup form is shorter.

## Browser observations

- 375 px: no horizontal overflow; compact selector visible; step chips hidden; action buttons 48 px high.
- 390 px: no horizontal overflow; compact selector visible; step chips hidden; action buttons 48 px high.
- 430 px: no horizontal overflow; compact selector visible; step chips hidden; action buttons 48 px high.
- 768, 1024 and 1366 px: no horizontal overflow; desktop step chips visible; consumer actions use responsive columns.
- Guided rental dialog at 390 px: one-column fields, advanced details collapsed, no page overflow.
- Browser console: no warnings or errors during the tested setup, linked-dialog, navigation, reload and Weekly Plan flows.
