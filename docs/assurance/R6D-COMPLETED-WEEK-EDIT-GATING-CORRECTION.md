# R6D Completed-Week Edit-Gating Correction

## Baseline

- Accepted source: `stage-r6c-retirement-timing-presentation-final-source-complete-20260915.zip`
- SHA-256: `233CB5476482CE1FF00E015FFB7EC13D3A6808ED3E8E666CA82633A32074BC0B`
- Untouched baseline: `test:r6c` 13 passed; full suite 658 passed; zero failures.

## Correction

`weeklyThisWeekHtml()` now derives read-only state from `week.isCompleted` and the transient `weeklyEditingWeek` value. A completed week renders the existing compact completed summary and no editable workflow until the user confirms `Edit Completed Week`.

The direct save path rejects a completed week unless that week is in confirmed edit mode. Completed edits keep drafts in `weeklyActualDrafts`; blur, change and Enter no longer auto-persist those drafts. `Save completed week` uses the existing completion/reforecast path, while Cancel deletes the draft and restores the read-only summary.

No financial formulas or Weekly Plan arithmetic were changed. R6-F3 remains open.
