# R6E Timezone Regression Matrix

## Original accepted-R6D reproduction

Planner start: 14 September 2026. Fortnightly salary anchor: 14 September 2026.

| Timezone | 14 Sep | 28 Sep | 12 Oct | 26 Oct | 9 Nov |
|---|---:|---:|---:|---:|---:|
| Australia/Hobart, R6D | 1 | 3 | 4 | 6 | 8 |
| UTC, R6D | 1 | 3 | 5 | 7 | 9 |

The Hobart result reproduced before editing and is retained in the preceding R6 blocker evidence package.

## R6E result

The same 18-case test suite was run in separate processes with an explicit `TZ` value.

| Timezone | Fortnightly forward | Weekly forward | Fortnightly backward | Weekly backward | Result |
|---|---|---|---|---|---|
| Australia/Hobart | 1,3,5,7,9 | 1-10 | 1,3,5,7,9 | 1-10 | 18 passed, 0 failed |
| UTC | 1,3,5,7,9 | 1-10 | 1,3,5,7,9 | 1-10 | 18 passed, 0 failed |
| Australia/Brisbane | 1,3,5,7,9 | 1-10 | 1,3,5,7,9 | 1-10 | 18 passed, 0 failed |

Commands used:

```powershell
$env:TZ='Australia/Hobart'; pnpm run test:r6e
$env:TZ='UTC'; pnpm run test:r6e
$env:TZ='Australia/Brisbane'; pnpm run test:r6e
```

The backward fixture starts 8 March 2027 and spans the Hobart DST end. No duplicate, skipped or delayed planner week occurs. Monthly dates anchored on the 12th map to weeks 5, 9 and 13; quarterly dates map to weeks 5 and 18; annual dates map to weeks 5 and 57. Amounts are unchanged.
