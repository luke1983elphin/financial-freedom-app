# R6A Readiness Contract

`personalisedResultsReadiness(planData, resultInput)` is the shared Home/Dashboard view model.

It returns:

- `hasPlanData`: the plan is not blank and calculated result data is present;
- `complete`: `financialJourneyReadiness()` requirements are satisfied;
- `missingSections`: shared missing-section labels;
- `message`: shared user-facing readiness explanation;
- `readyForPersonalisedResults`: both plan data and completion requirements are present.

Home and Dashboard consume the same object during the same `renderOutputs()` cycle. Neither view independently redefines “ready enough.” AI’s stricter `isFinancialPlanComplete()` remains separate because R6A does not alter AI eligibility.

All seven bundled sample plans return `readyForPersonalisedResults: true`. Empty and partial plans return false. JSON save/reload and sample-to-personal transitions retain the same decision.
