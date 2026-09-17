# R6 Defect Register

| ID | Severity | Finding | Status |
|---|---|---|---|
| R6-F1 | Release blocker | Financial Journey Step and Financial Stage were presented as one concept | Resolved and accepted in R6A |
| R6-F2 | Release blocker | Home/Dashboard readiness disagreement | Resolved and accepted in R6A |
| R6-F3 | Verification blocker | Full browser/device/PDF/backup/preview matrix incomplete | Open |
| R6-F4 | Release blocker / financial integration | Weekly Plan salary timing used stale legacy frequency instead of canonical structured salary frequency | Resolved in R6B; independent review pending |
| R6-F5 | Environment limitation | Physical iPhone/Android unavailable | Pending owner/device check |
| R6-F6 | Public-release blocker | Professionally approved Privacy and Terms wording unavailable | Open, intentionally unchanged |
| R6-F7 | Release blocker / material result inconsistency | Retirement Planning snapshot says no semi-retirement phase and full retirement is not modelled while the same projection models staggered retirement and reports semi-retirement funding | Resolved in R6C; independent review pending |
| R6-F8 | Release blocker / history integrity | Completed Weekly Plan weeks bypassed the read-only/edit gate and could save/reforecast without explicit confirmation | Resolved in R6D; independent review pending |
| R6-F9 | Release blocker / weekly scheduling | Weekly Plan date-to-week bucketing used elapsed local-midnight milliseconds and shifted future occurrences across DST | Resolved in R6E; independent review pending |

## R6-F4 reproduction and correction

1. Start a new fictional two-person plan.
2. Enter Taylor salary `$3,500 fortnightly` and Morgan salary `$2,800 fortnightly`.
3. Confirm annual household income is `$163,800` and both structured records retain `frequency: "fortnightly"`.
4. Generate the Weekly Plan starting 7 September 2026.
5. The blocked R6 copy displayed annual net-pay rows and the full annual net income in Week 1.
6. R6B now resolves each person's valid canonical salary frequency first. The same fictional plan generates `$2,745` and `$2,269` fortnightly rows and `$5,013` planned Week 1 money in (whole-dollar UI display).

## Cause and next decision

The root cause was the direct read of `plan.income.person1Frequency` and `person2Frequency` in `buildDefaultTimingItems()`. R6B uses canonical `incomeItems[]` salary records, with legacy fields only as a read-only fallback. Newly generated salary rows carry provenance. Reforecast updates only rows that remain exact, untouched generated rows with no occurrence overrides; unproven legacy rows, manual edits, completed weeks and actual history remain unchanged. R6-F3 remains open.

## R6-F7 reproduction and correction

The blocked browser journey had valid Taylor and Morgan retirement timeline events but false snapshot fallbacks because `personListFromProjection()` dropped canonical retirement timing fields. R6C retains those fields by stable person ID, uses existing projection rows to identify the household transition, and separates that transition from personal semi-retirement choices. The Taylor/Morgan snapshot now reports no personal election, a `2046-2048` household transition and full retirement at age 60. The existing `$70,402` display result and all projection arithmetic are unchanged.

## R6-F8 reproduction and correction

R6C calculated completed/edit state but then forced `canEdit = true` and `completedReadOnly = false`, making the existing guarded completed summary unreachable. R6D restores the state derivation, requires the existing confirmation before edit mode, blocks direct read-only saves, stages completed-week edits until explicit save, and discards staged values on Cancel. Local Taylor/Morgan browser reproduction and all 15 focused tests pass. R6-F3 remains open.

## R6-F9 reproduction and correction

With a planner starting 14 September 2026 and fortnightly salary dates of 14 September, 28 September, 12 October, 26 October and 9 November, accepted R6D assigned Hobart weeks `1,3,4,6,8` but UTC weeks `1,3,5,7,9`. `weekIndexForDate()` subtracted local-midnight timestamps, so Hobart's DST transition shortened elapsed time without changing civil dates.

R6E adds one local-civil `civilDayOrdinal()` helper and derives week position from the difference between UTC ordinals constructed from local year, month and day components. The same `weekIndexForDate()` remains authoritative for recurring schedules, one-offs, occurrence overrides, moved dates and current-calendar-week selection. The 18-case R6E suite passes under `Australia/Hobart`, `UTC` and `Australia/Brisbane`; UI and workbook schedules agree; all annual and Retirement Planning parity checks are exact. R6-F3 remains open and R6 validation was not resumed.
