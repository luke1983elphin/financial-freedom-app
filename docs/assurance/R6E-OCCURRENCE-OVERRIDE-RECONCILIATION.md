# R6E Occurrence Override Reconciliation

The fortnightly occurrence dated 12 October 2026 belongs to Week 5 of a planner starting 14 September 2026.

| Operation | Result |
|---|---|
| Change amount on 12 October to `$3,000` | `$3,000` remains in Week 5 |
| Move 12 October to 13 October | `$3,000` remains in Week 5 |
| Move 12 October to 11 October | `$3,000` moves to Week 4 and Week 5 is cleared |
| Deactivate 12 October occurrence | Week 5 is cleared |

All override paths use the shared civil-date `weekIndexForDate()` helper. No override amount, scope or persistence semantics changed.

The completed-history fixture marks Week 1 complete with actual income `$2,800`, closing balance `$3,800` and note `History`. Reforecast after the date correction leaves that completed week byte-equivalent at the data-object level. User-edited timing, actuals and historical reconciliation are not rewritten.
