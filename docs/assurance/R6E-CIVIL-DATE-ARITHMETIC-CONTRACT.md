# R6E Civil Date Arithmetic Contract

Weekly Plan dates are local civil dates. Week 1 contains the planner start date through start plus six civil days; each later week advances by seven civil days.

The authoritative calculation is:

```text
civilDayOrdinal(date) = floor(Date.UTC(localYear, localMonth, localDay) / DAY_MS)
calendarDayOffset = civilDayOrdinal(date) - civilDayOrdinal(startDate)
index = floor(calendarDayOffset / 7)
```

The index is returned only when `0 <= index < weeksCount`; otherwise the result is `-1`.

Boundary contract:

| Civil date | Index |
|---|---:|
| Before start | -1 |
| Start | 0 |
| Start + 6 days | 0 |
| Start + 7 days | 1 |
| Start + 13 days | 1 |
| Start + 14 days | 2 |
| After planner horizon | -1 |

`dateFromIso()` continues to create local dates with `new Date(year, monthIndex, day)`. `dateIso()`, `addDays()` and `addMonthsClamped()` retain their existing local-civil semantics. Recurrences must not advance by adding fixed elapsed milliseconds.

Invalid or missing date input remains outside the planner: `civilDayOrdinal()` returns `NaN`, and `weekIndexForDate()` returns `-1`. Existing callers already validate normal persisted dates, so no broader validation model was introduced.
