# R6D Completed-Week State Contract

| Week state | UI state | Persistence |
|---|---|---|
| Incomplete | Normal five-step editor | Existing autosave/save behaviour |
| Completed and `weeklyEditingWeek` differs | Compact read-only history summary | No write or reforecast from viewing |
| Completed and edit warning cancelled | Compact read-only history summary | No change |
| Completed and edit warning accepted | Five-step editor with preserved actuals and edit notice | Draft only until explicit save |
| Completed edit cancelled | Compact read-only history summary | Draft discarded; persisted values unchanged |
| Completed edit saved | Compact read-only history summary | Existing R5-coordinated save and authorised future reforecast |

`weeklyEditingWeek` remains transient. Navigation, reload and backup restore therefore return completed weeks to read-only state. A recorded numeric zero remains an entered value in both summary and edit mode.
