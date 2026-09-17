# R6C Snapshot, Timeline and Funding Reconciliation

| Output | Before R6C | After R6C | Authoritative source |
|---|---|---|---|
| Personal semi-retirement | `No semi-retirement phase` | `None selected` | Canonical scenario person fields |
| Household transition | Not shown | `2046-2048` | Annual rows with `householdPhase === "semi-retirement"` and first full-retirement row |
| Full retirement | `Not modelled` | `Age 60` | Canonical person `fullRetirementAge` |
| Taylor timeline | 2046 at age 60 | Unchanged | Projection milestone rows |
| Morgan timeline | 2048 at age 60 | Unchanged | Projection milestone rows |
| Funding phase | `Semi-Retirement Funding` | `Transition / Semi-Retirement Funding` | Same transition-row total; wording only changed |
| Funding amount | `$70,402 total` | `$70,402 total` | Existing required-withdrawal values and display rounding |

The corrected snapshot no longer contradicts the timeline. The timeline, transition label and funding panel all describe the same 2046-2048 household transition while making clear that neither person elected a personal semi-retirement phase.

