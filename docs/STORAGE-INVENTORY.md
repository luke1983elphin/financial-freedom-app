# Browser Storage Inventory

The application uses `localStorage`. No application use of `sessionStorage`, IndexedDB, Cache Storage or cookies is required for plan persistence. Browser downloads are files, not browser storage records. Runtime memory contains the open plan and UI drafts but is lost when the tab closes.

| Key or prefix | Contents and sensitivity | Essential / derived | Delete-all and recovery |
| --- | --- | --- | --- |
| `ffs-current-plan-v3-mobile-dashboard-ux-test` | Legacy-compatible full plan and UI state | Essential compatibility copy | Removed; included in complete backup |
| `ffs-current-plan-last-saved-v3-mobile-dashboard-ux-test` | Last verified save timestamp | Derived | Removed; recreated after successful save |
| `ffs-scenarios-v3-mobile-dashboard-ux-test` | Saved scenario plans, notes and snapshots | Essential user data | Removed; included in complete backup |
| `ffs-weekly-plan-v1-v3-mobile-dashboard-ux-test` | Legacy-compatible Weekly Plan, timing and history | Essential compatibility copy | Removed; included in complete and Weekly-only backups |
| `ffs-user-state-v3-mobile-dashboard-ux-test` | Personal-plan-created flag and last personal context | Essential preference/context | Removed; included in complete backup |
| `ffs-plan-context-v3-mobile-dashboard-ux-test` | Active/last personal plan ID and demo separation | Essential context | Removed; recreated from import/context |
| `ffs-personal-plan-v1:` | Namespaced canonical plan record and UI state | Essential canonical plan | Removed; included in complete backup |
| `ffs-weekly-plan-v1:` | Plan-specific Weekly Plan and actual history | Essential weekly data | Removed; complete or Weekly-only backup |
| `ffs-financial-snapshots-v1:` | Plan-specific historical snapshots and metrics | Essential history | Removed; included in complete backup |
| `ffs-durability-state-v1` | Backup prompts, verified-save and reminder state | Derived preference | Removed; not needed for plan recovery |
| `ffs-data-deletion-in-progress-v1` | Short-lived multi-tab deletion token | Derived coordination marker | Removed after coordination delay |

Writes spanning several keys use a verified best-effort batch with rollback of already changed keys. `localStorage` provides no transaction or crash-atomicity guarantee. A rollback can itself fail if storage becomes unavailable; the UI reports failure and retains the open in-memory plan.
