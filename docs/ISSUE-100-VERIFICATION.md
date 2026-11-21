# Issue #100 — Plan menu, backup and data management

Base: `bfaeee4` (latest main inspected before implementation). Branch: `feature/plan-backup-data-menu`.

## Findings and changes

- Plans already autosave. The former Load Plan action opened Saved Scenarios; Duplicate Plan duplicated a scenario. Those entry points were redundant with the existing scenario workflows. The Plan menus now contain only New Plan, Export Plan Backup and Import Plan Backup.
- Startup migrated the legacy draft into a namespaced personal record, but later autosave overwrote the legacy key. A different legacy copy could therefore disappear before export. Before startup writes, the storage coordinator now preserves the exact owned storage strings once in `ffs-plan-menu-recovery-v1`. No source record is deleted by migration. Preservation failure blocks writes and explains how to export through Manage Data. Starting another plan or importing cannot bypass that protection.
- Manage Data exports individual preserved plans with scenarios, weekly records and history from that same preservation point. It also exports a raw recovery copy for malformed or unsupported records. These copies remain local until explicitly deleted; they are not silently mixed with the active plan's export. Current-plan backups still use the existing format and atomic import validation/write transaction.
- Both desktop and mobile receive visible export/import feedback. Downloads are synchronous from the action and object URLs remain available for 60 seconds; iPhone/iPad feedback explains saving a Safari preview to Files. The app reports download initiation, not unverifiable permanent file retention.
- Delete all is separate from Plan, explains its permanent scope, provides backup access, and defaults focus to Cancel. The owned-key inventory now includes the three display preferences previously omitted. Preference writes use the coordinator so deletion cannot immediately recreate them. Unrelated same-origin data remains intact.
- Reports replaces Print / Export. Financial Plan Report and Saved Retirement Scenario Reports remain available. The shared report popup was inside the hidden desktop toolbar; moving it outside makes it available to mobile as well. Escape and expanded-state feedback are supported.
- No calculator, Age Pension, growth model, scenario assumptions, Try a Change or Weekly Mission calculations were changed. Existing numerical fixtures are unchanged. Only intentionally changed persistence/presentation fingerprints were updated.

## Verification

The user flow is Plan/Manage Data → browser storage or downloaded JSON → validated atomic restore → visible success/error feedback. This is a client-only feature; it adds no API, credentials or external service.

- `pnpm run verify`: 71 suites, 1,371 tests passed, zero failed/skipped. Includes syntax, security, runner self-tests and numerical parity.
- Issue #100 browser cases at 1366, 820 and 390 px verify the three Plan actions, actual downloaded JSON, file-input restore, unchanged assumptions/saved scenarios/history, older-plan export, Reports routes, deletion cancellation/confirmation, and unrelated-data preservation.
- A fourth browser case verifies malformed JSON, cancelled restore and failed downloads leave the current plan unchanged.
- Four new storage tests cover exact/idempotent legacy preservation, unreadable legacy records, quota/write failure protection, distinct legacy/current records, and display-preference deletion.
- Retirement/backup browser suite: 12/12 passed in isolation, including all four Issue #100 cases and existing property/retirement editing regressions.
- Full browser suite: 78 passed, 11 failed. The nine dollar-basis browser assertions reproduce on untouched main at the same assertion lines (1258, 1385, 1437, 1562, 1587, 1655, 1715, 1741, plus the existing investments-navigation assertion). F04 and F08 browser harness startup timeouts also reproduce on untouched main. No assertions were weakened or unrelated startup/reporting code changed to hide these failures.
- An earlier concurrent regression run encountered the existing 3px scroll jitter and a Windows browser-profile cleanup lock; the final isolated run passed all 12 tests without either failure.
- Desktop and phone Manage Data screenshots were inspected. Backup feedback is a dismissible fixed notice so it remains visible when the workspace is scrolled.

## Limits and review

Browser automation uses installed Edge/Chromium with desktop, tablet and phone viewport metrics. Physical iPhone Safari/Files interaction needs a manual device check; mobile emulation is not evidence of WebKit testing. Raw recovery exports intentionally require recovery assistance rather than bypassing normal import validation. The pre-update recovery copy uses additional browser storage; if storage is full the app preserves existing records and pauses saves until space is available.

The feature branch explicitly disables Vercel Git deployment. No merge or deployment is requested or performed.
