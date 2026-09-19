# Backup Coverage

`Export complete backup` produces the complete local plan backup. `Export Weekly Plan Backup` is a separate Weekly Plan-only backup. A browser download being initiated does not prove the file was retained elsewhere.

| Data | Complete local plan JSON | Weekly Plan JSON | Notes |
| --- | --- | --- | --- |
| Current Financial Plan and assumptions | INCLUDED | NOT INCLUDED | Full plan record is migrated before export |
| Saved Scenarios and scenario notes | INCLUDED | NOT INCLUDED | Sample/demo scenarios are excluded from personal storage |
| One-off lifestyle/income events | INCLUDED | NOT INCLUDED | Stored within plan or retirement scenario state |
| Planned concessional super events | INCLUDED | NOT INCLUDED | Stored within plan/retirement scenario state |
| Retirement scenario state | INCLUDED | NOT INCLUDED | Saved scenarios and plan settings included |
| Weekly Plan schedule and customised timing | INCLUDED | INCLUDED | Both use the current adjusted Weekly Plan |
| Weekly actuals, completed history and notes | INCLUDED | INCLUDED | Stored in the Weekly Plan payload |
| Timing-review and occurrence metadata | INCLUDED | INCLUDED | Stored in the Weekly Plan payload |
| Financial snapshots/progress history | INCLUDED | NOT INCLUDED | Included for personal plans only |
| User state and interface settings | INCLUDED | NOT INCLUDED | Includes personal-plan state and draft UI |
| Last-saved timestamp | DERIVED / RECREATED | NOT APPLICABLE | A new verified timestamp is written on import |
| Durability prompt/reminder history | NOT INCLUDED | NOT INCLUDED | Device/browser preference, deliberately recreated |
| Downloaded files | NOT APPLICABLE | NOT APPLICABLE | Managed by the browser/user outside app storage |
| Provider/hosting logs | NOT INCLUDED | NOT INCLUDED | Outside browser backup scope |

Supported legacy full-plan payloads continue through validation and migration. Weekly backups continue through `FFSWeeklyPlan.importPayload` and `migrate`. Invalid files are rejected before replacing the current stored plan.
