# R6D History Preservation

- Viewing a completed week performs no calculation or persistence operation.
- Cancelling the warning does not unlock the week.
- Cancelling an active edit removes only that week's unsaved draft.
- Saving uses the pre-existing `completeWeek()` and reforecast semantics.
- A saved Week N edit preserves completion and recorded actuals for Weeks 1 through N-1.
- Only authorised downstream opening/closing balances can change after explicit save.
- Backup export/import retains `isCompleted` and actual history but does not contain transient `weeklyEditingWeek`.
- Persistence remains routed through `saveWeeklyPlan()` and the R5 storage coordinator; no direct `localStorage` fallback was added.
