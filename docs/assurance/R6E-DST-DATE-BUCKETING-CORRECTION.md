# R6E DST Date Bucketing Correction

## Baseline

- Accepted source: `stage-r6d-completed-week-edit-gating-final-source-20260915-163500.zip`
- Accepted SHA-256: `1BE55AE1A80CDAE398CEB967486CD0D39BEC26F3D929045EF39AFE932827A465`
- R6E scope: Weekly Plan civil-date week bucketing only

## Confirmed cause

`weekly-plan.js` previously calculated week position by dividing elapsed milliseconds between two local-midnight `Date` values by seven days. Across a daylight-saving transition, those instants can be separated by 167 or 169 hours while their civil dates remain exactly seven days apart. This shifted otherwise correct recurrence dates into the preceding planner week.

## Correction

R6E adds `civilDayOrdinal(date)`, which constructs a neutral ordinal from the date's local `getFullYear()`, `getMonth()` and `getDate()` components. `weekIndexForDate()` subtracts those ordinals and floors the civil-day difference by seven. Invalid dates produce `NaN`, which cannot satisfy the valid index range and therefore return `-1`.

No date is converted into a UTC display instant. Existing local parsing, formatting and civil recurrence advancement remain unchanged.

## Caller audit

The corrected `weekIndexForDate()` remains the sole week-position helper used by:

- exact-date and recurring schedule placement in `scheduleRecurring()`;
- one-off items through the shared timing schedule;
- occurrence cancellation, amount changes and moved dates in `applyOccurrenceOverrides()`;
- monthly, quarterly and annual anchored recurrence placement;
- `currentCalendarWeekNumberFor()`.

No other fixed-millisecond civil-day/week-position calculation was found in `weekly-plan.js`.

## Scope protection

Recurrence amounts and advancement functions were not changed. R6B canonical salary frequency resolution, R3B timing/history protection and R6D completed-week edit gating remain intact. No annual financial model, storage, security or export generator was changed.

R6-F9 is resolved in this review copy. R6-F3 remains open. No deployment, push, merge, AI enablement or resumed R6 validation occurred.
