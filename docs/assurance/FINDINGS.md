# Assurance Findings

## R4A findings

| ID | Finding | Status | Classification |
|---|---|---|---|
| R4A-F01 | Production HTML executed the unpinned Tailwind development CDN compiler in the financial-data origin. | Corrected in source | FIX IN R4A |
| R4A-F02 | Plan and Weekly Plan imports lacked consistent size, recursive shape, numeric/date and prototype-key validation. | Corrected in source | FIX IN R4A |
| R4A-F03 | Rendering safety depended on a local escaping helper without centralized context utilities or direct browser fixtures. | Reduced; structural template risk remains | FIX IN R4A / defer structural refactor |
| R4A-F04 | Security response headers and CSP were not represented in deployment source. | Report-only configuration prepared, not deployed | OWNER VERIFICATION REQUIRED |
| R4A-F05 | Online package advisory lookup could not reach the registry. | Open | MANUAL REVIEW |
| R4A-F06 | Existing local-storage corruption/recovery behavior was not redesigned. | Open for R5 | OUT OF R4A SCOPE |
| R4A-F07 | Preview CSP telemetry, physical-device checks and native PDF output inspection were unavailable. | Open | OWNER / NEXT CONTROLLED PREVIEW |

Earlier R1-R3 findings and decisions remain governed by their accepted evidence. R4A did not change their financial conclusions or reopen their formulas.
# R5 additions (2026-09-08)

- R5-F1 resolved locally: direct save paths could report success after browser-storage failure. Central verified writes now return explicit results and retain dirty in-memory state.
- R5-F2 resolved locally: complete versus Weekly-only backup scope was not sufficiently explicit in labels and metadata.
- R5-F3 resolved locally: no enumerated delete-all action or cross-tab autosave suppression existed.
- R5-F4 open public-release blocker: approved Privacy, Terms and AI data-transfer consent wording is not available; explicit placeholders remain.
- R5-F5 documented limitation: localStorage is not transactional, encrypted server storage or cross-device backup.

# R6 additions (2026-09-08)

- R6-F1 release blocker: the Young Professional sample is classified as `Building Wealth` on Home but `Building the Foundation` on Dashboard and Reports. Home uses the nine-stage `engagementStageInfo()` classifier; Dashboard and Reports use the four-stage `financialStageInfo()` classifier.
- R6-F2 release blocker: Home can render a personalised journey while Dashboard renders its incomplete-plan state. Both paths reference `financialJourneyReadiness()`, but Dashboard adds `isBlankPlan()` and is rendered through a separate lifecycle. The observed state requires a focused lifecycle/readiness trace; no cause is asserted beyond the confirmed output mismatch.
- R6-F3 blocked verification: physical iPhone/Android, automated width matrix, browser console/network capture, PDF inspection, backup/destructive flows and public preview were not continued after R6-F1 triggered the mandatory stop rule.
- R6-F4 environment limitation: the agent-browser CLI was unavailable and local Playwright could not launch system Chrome because process creation was denied. The in-app browser was used for the partial manual journey.

# R6A additions (2026-09-08)

- R6-F1 resolved in source: Home now labels the nine-stage result as `Current journey step`; Dashboard and Reports retain the authoritative four-stage Financial Stage.
- R6-F2 resolved in the local running browser: Home and Dashboard consume one readiness view model, and the Dashboard stage card is updated within its own section rather than by a global first-match selector.
- R6-F3 remains open. Full R6 device, PDF, backup and preview validation was not resumed under the R6A authorization.

# Resumed R6 additions (2026-09-08)

- R6-F5 release blocker confirmed: canonical structured salary records retained fortnightly frequency, but Weekly Plan default timing used annual recurrence and put full annual net pay in Week 1.
- Root cause: `buildDefaultTimingItems()` reads legacy `plan.income.person1Frequency/person2Frequency` rather than structured `incomeItems[].frequency`.
- Validation stopped before runtime correction, preview deployment and lower-priority journeys as required by the approved R6 defect rule.
- R6-F3 remains open behind R6-F5.
