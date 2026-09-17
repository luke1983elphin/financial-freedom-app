# R5 Storage Inventory

Baseline: `stage-r4a-browser-security-hardening-final-source-20260908.zip`, SHA-256 `4966BA758E6DDA248550C88DA4EBE0A194AAE5627B9BB815DCFA422BA7B3F563`.

The application uses `localStorage`. No application use of `sessionStorage`, IndexedDB, Cache Storage or cookies was found. Browser downloads are files, not browser storage records. Runtime memory contains the open plan and UI drafts but is lost when the tab closes.

| Key or prefix | Created/read by | Contents and sensitivity | Essential/derived | Delete-all | Backup/recovery/version |
|---|---|---|---|---|---|
| `ffs-current-plan-v3-mobile-dashboard-ux-test` | `writePersonalDraftRecord` / `readPersonalDraftRecord` | Legacy-compatible full plan, names, notes and UI state; personal financial data | Essential compatibility copy | Removed | Complete local plan export; record v4, legacy v1-v4 accepted |
| `ffs-current-plan-last-saved-v3-mobile-dashboard-ux-test` | `writePersonalDraftRecord` / `updateSaveStatus` | Last verified save timestamp | Derived | Removed | Recreated after a successful save |
| `ffs-scenarios-v3-mobile-dashboard-ux-test` | `saveScenarios` / `loadScenarios` | Saved scenario plans, notes, inputs and calculated snapshots | Essential user data | Removed | Included in complete local plan export; migrated by `migrateScenarioList` |
| `ffs-weekly-plan-v1-v3-mobile-dashboard-ux-test` | `saveWeeklyPlan` / `loadWeeklyPlan` | Legacy-compatible Weekly Plan, timing, actuals, history, notes and review metadata | Essential compatibility copy | Removed | Included in complete backup and separate Weekly Plan backup; migrated by `FFSWeeklyPlan.migrate` |
| `ffs-user-state-v3-mobile-dashboard-ux-test` | `persistUserState` / `loadUserState` | Personal-plan-created flag and last personal route/id | Essential preference/context | Removed | Included in complete local plan export; v1 |
| `ffs-plan-context-v3-mobile-dashboard-ux-test` | `persistPlanContext` / `loadPlanContext` | Active/last personal plan ID and route; demo separation | Essential context | Removed | Recreated from imported backup/context; v1 |
| `ffs-personal-plan-v1:` | `writePersonalDraftRecord` / `readPersonalDraftRecord` | Canonical namespaced plan record, UI state, names and financial data | Essential canonical plan | Removed | Included in complete local plan export; record v4 |
| `ffs-weekly-plan-v1:` | `saveWeeklyPlan` / `loadWeeklyPlan` | Canonical plan-specific Weekly Plan and actual history | Essential canonical weekly data | Removed | Complete or Weekly-only backup; Weekly schema migration |
| `ffs-financial-snapshots-v1:` | `saveFinancialSnapshots` / `loadFinancialSnapshots` | Plan-specific historical snapshots and calculated financial metrics | Essential history | Removed | Included in complete local plan export; recalculated on supported import |
| `ffs-durability-state-v1` | R5 durability helpers | First-save prompt, successful-save time, export-initiation time/type and reminder date | Derived/user preference | Removed | Not needed for plan recovery; v1 |
| `ffs-data-deletion-in-progress-v1` | `deleteAllOwned` / storage event handler | Short-lived deletion coordination token; no plan data | Derived coordination marker | Removed after short delay | Not exported; transient |

Writes spanning several keys use a verified best-effort batch with rollback of already changed keys. `localStorage` provides no transaction or crash-atomicity guarantee. A rollback can itself fail if storage becomes unavailable; the UI reports failure and retains the open in-memory plan.

