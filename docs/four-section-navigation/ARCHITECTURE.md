# Four-section navigation — architecture assessment before implementation

Baseline: `02054bfcf9a687efae6074560104042c0c3a64db` (latest main, merged #64–#66). PR #67 is still unmerged and remains separate. No dependency on its presentation tidy-up is required.

| Existing workspace ID | Existing entry | Proposed entry | Rendering/state owner |
| --- | --- | --- | --- |
| dashboard | Home | My Freedom Progress (primary) | renderDashboard / renderDashboardRetirementCard; existing plan/readiness |
| semiretirement | Retirement | Explore My Future (primary) | renderSemiRetirementScenario; existing draft/result and comparison state |
| decision | Try a Change (More tools) | Try a Change (primary) | renderDecision/renderWhatIf; existing baseline snapshots/custom draft |
| weeklyplan | Weekly | My Weekly Mission (primary) | renderWeeklyPlan; existing weekly plan storage/edit state |
| setup | My Plan (primary) | My Plan (More tools) | renderWizardStep/renderForms; original field IDs, active step and autosave |
| assumptions | Assumptions (More tools) | Assumptions (More tools) | single forecast assumptions editor and saved-plan adapter |
| investments | Investments (More tools) | Investments (More tools) | renderInvestments / original investingForm |
| super | Super (More tools) | Super (More tools) | renderSuper / employer contribution panel |
| goals | Goals (primary) | Goals (More tools) | renderGoalsSummary / original personalForm |
| scenarios | Saved Scenarios (More tools) | Saved Scenarios (More tools) | original saved snapshots, view/compare/edit semantics |
| reports | Reports (More tools) | Reports (More tools) | renderReports; original plan/scenario sources and print controls |

Legacy cashflow/assets/loans/forecast route aliases remain in the existing setView mapping. No duplicate primary workspaces are needed. All field, button and view IDs can be preserved.

The single growth comparison is mounted by installForecastAssumptionsWorkspace inside a growth-workspace node. Its comparison session and Base/Lower/Higher results belong to FFSGrowthScenariosView. Move that same mounted node into a Future host while exploring growth, then restore it to Assumptions. Do not clone or remount it, blend its balances with retirement outputs, or change engine calls.

Navigation currently uses showWorkspace/setView and delegated data-view controls, without URL workspace routing. Original render functions rebuild many panels; the UI adapter must run after those renderers without modifying guarded financial functions. Add UI-only history state for browser Back/Forward and explicit workspace hashes; retain existing privacy/terms handling. No route fields enter saved financial schemas.

Saved drafts are read through readPersonalDraftRecord/loadDraft (namespaced personal records with legacy recovery). Existing autosave/backup/recovery remains authoritative. The current boot deliberately opens welcome even for a saved plan. The new startup behavior should use the existing valid saved-draft detection to enter dashboard on a returning base-URL visit, while preserving explicit workspace URLs on refresh and all saved form/weekly/scenario data.

First-time welcome should retain original Start/sample event handlers, clearly identify fictional examples and hide personal-result previews until a workspace is explicitly entered. AI coaching functions/data remain available; remove promotional coaching wording only from primary presentation.

Safeguards: preserve calculator, tax/pension, property/debt, retirement/withdrawal, defaults, schema and persistence files and all numerical fixtures. Update only UI navigation expectations in tests that intentionally enforce the superseded five-tab layout. Keep protected financial hashes and exact numerical baselines unchanged.
