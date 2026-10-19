# Release evidence closure — 19 October 2026

Scope: `codex/release-readiness`, reviewed commit `ee81a103f56e5d112114a1760f61f9de303bae2b`, parent `e1e69f87e311ec3db396a08fffa6f4d92c82d380`. This follow-up changes documentation and tests/evidence only. No production calculation, renderer, persistence, API lock or repository setting is changed. No deployment, push, merge, service activation or branch cleanup was performed.

## Pension constant verification

Every numeric member of `agePensionEstimate.js:RATES`, its embedded component amounts, and the SAPTO formula constants are covered below. All rows were checked **2026-10-19**. V = verified against the linked official source; D = arithmetic derived from verified inputs. Annual amounts use the model's 26-fortnight convention, not an additional statutory annual entitlement promise.

| Implemented constant/component | Implemented value | Official source URL | Effective date | Checked | Status |
| --- | --- | --- | --- | --- | --- |
| `pensionAge` | 67 | [DSS qualification](https://guides.dss.gov.au/social-security-guide/3/4/1/10) | 2023-07-01 final age step | 2026-10-19 | V |
| Basic pension, single / partnered each (components of maximum) | $1,135.40 / $855.90 per fortnight | [Services Australia rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526) | 2026-09-20 | 2026-10-19 | V |
| Maximum Pension Supplement, single / partnered each | $88.20 / $66.50 per fortnight | [DSS supplement](https://guides.dss.gov.au/social-security-guide/5/1/9/10) | 2026-09-20 | 2026-10-19 | V |
| Basic supplement, single / partnered each | $30.70 / $25.30 per fortnight | [DSS supplement](https://guides.dss.gov.au/social-security-guide/5/1/9/10) (annual $798.20 / $657.80 divided by 26) | 2026-09-20 | 2026-10-19 | V/D |
| `energyAnnualSingle` / `energyAnnualCoupleEach` | $14.10 × 26 = $366.60 / $10.60 × 26 = $275.60 | [Services Australia rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526) | Present in 2026-09-20 schedule; original commencement not established here | 2026-10-19 | V/D; historical-date limit |
| `maximumAnnualSingle` | $1,237.70 × 26 = $32,180.20 | [Services Australia rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526) | 2026-09-20 | 2026-10-19 | V/D |
| `maximumAnnualCoupleEach` | $933 × 26 = $24,258; combined $48,516 | [Services Australia rates](https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526) | 2026-09-20 | 2026-10-19 | V/D |
| `taxExemptAnnualSingle` | ($88.20 − $30.70 + $14.10) × 26 = $1,861.60 | [DVA component table](https://clik.dva.gov.au/node/86936), [DSS supplement](https://guides.dss.gov.au/social-security-guide/5/1/9/10) | 2026-09-20 component schedule | 2026-10-19 | V/D |
| `taxExemptAnnualCoupleEach` | ($66.50 − $25.30 + $10.60) × 26 = $1,346.80 | [DVA component table](https://clik.dva.gov.au/node/86936), [DSS supplement](https://guides.dss.gov.au/social-security-guide/5/1/9/10) | 2026-09-20 component schedule | 2026-10-19 | V/D |
| `assetFreeAreaSingleHomeowner` | $333,000 | [DSS dated table 5](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2026-07-01 | 2026-10-19 | V |
| `assetFreeAreaSingleNonHomeowner` | $600,000 | [DSS dated table 5](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2026-07-01 | 2026-10-19 | V |
| `assetFreeAreaCoupleHomeowner` | $499,000 combined | [DSS dated table 5](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2026-07-01 | 2026-10-19 | V |
| `assetFreeAreaCoupleNonHomeowner` | $766,000 combined | [DSS dated table 5](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2026-07-01 | 2026-10-19 | V |
| `annualAssetTaperPerThousandSingle` / `…CoupleEach` | $78 / $39 per $1,000 annually; $3 / $1.50 fortnightly; couple combined $3 | [DSS assets taper](https://guides.dss.gov.au/social-security-guide/4/2/3) | 2017-01-01 | 2026-10-19 | V/D |
| `incomeFreeAreaSingleAnnual` | $226 × 26 = $5,876 | [DSS dated table 6](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2026-07-01 | 2026-10-19 | V/D |
| `incomeFreeAreaCoupleAnnual` | $396 × 26 = $10,296 combined ($5,148 each) | [DSS dated table 6](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2026-07-01 | 2026-10-19 | V/D |
| `incomeTaperSingle` / `incomeTaperCoupleEach` | 0.50 / 0.25 per excess dollar of assessable income | [Services Australia income test](https://www.servicesaustralia.gov.au/income-test-for-age-pension?context=22526), [DSS history](https://guides.dss.gov.au/social-security-guide/4/10/3) | 2009-09-20 ordinary rules | 2026-10-19 | V |
| `deemingThresholdSingle` / `deemingThresholdCouple` | $66,800 / $110,600 combined | [DSS deeming history](https://guides.dss.gov.au/social-security-guide/4/4/1/10) | 2026-07-01 | 2026-10-19 | V |
| `deemingLowerRate` / `deemingUpperRate` | 0.0175 / 0.0375 (1.75% / 3.75%) | [DSS deeming history](https://guides.dss.gov.au/social-security-guide/4/4/1/10), [Services Australia](https://www.servicesaustralia.gov.au/deeming?context=22526) | 2026-09-20 | 2026-10-19 | V |
| `workBonusAnnual` | $300 × 26 = $7,800 per eligible person | [DSS Work Bonus](https://guides.dss.gov.au/social-security-guide/3/1/15/30) | 2019-07-01 | 2026-10-19 | V/D; bank/timing excluded |
| SAPTO base, single / partnered | $2,230 / $1,602 | [Regulation s9](https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html) | Instrument commences 2025-10-01 | 2026-10-19 | V |
| SAPTO threshold formula constants | $445; $37,000; 0.015 | [Regulation ss4,9](https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html) | 2025-10-01 | 2026-10-19 | V |
| SAPTO taper | 0.125 (12.5%) | [Regulation ss9–11](https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html) | 2025-10-01 | 2026-10-19 | V |
| SAPTO transfer constants | $6,000; 0.15 (15%) | [Regulation s12](https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html) | 2025-10-01 | 2026-10-19 | V |
| Tax inputs consumed by SAPTO threshold formula | Tax-free threshold $18,200; lowest rate 15% in 2026–27, 14% from 2027–28; next rate 30% | [Income Tax Rates Act, Schedule 7](https://www.legislation.gov.au/C2004A03348/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html) | 2026-07-01 / 2027-07-01 for lowest rates; existing 30% bracket from 2024-07-01 | 2026-10-19 | V |
| Derived SAPTO full-offset threshold, single / partnered each | 2026–27: $36,034 / $31,847; 2027–28: $37,137 / $32,822 | Same regulation and tax schedule above; statutory rounding upward | Applicable tax year | 2026-10-19 | D, tested |

`effectiveFrom = 2026-09-20` is the model's payment-schedule anchor, not the commencement date of every parameter. `verifiedOn = 2026-10-13` remains the historical source-code check date; this table records the later independent check without changing the protected calculation file.

### SAPTO compilation question — resolved for this review date

The official [title/text page](https://www.legislation.gov.au/F2025L01060/asmade), retrieved 2026-10-19, identifies the instrument as **In force** and its **Latest version** as **F2025L01060, 09 September 2025**. The official [All versions page](https://www.legislation.gov.au/F2025L01060/asmade/versions) lists zero compiled versions and one as-made version. Read together with sections 2, 4 and 9–12, this establishes that the registered latest text remains the as-made instrument, commencing 1 October 2025. No later registered compilation was identified. The broken `/latest/details` alias is no longer the sole basis for the conclusion.

Source-access limit: the web tool reported a current crawl for the title/text page and a three-month-old crawl for the versions page. The latter is corroboration, not a claim of independently refreshed live API history or proof about future amendments. Recheck the Register when releasing if time has elapsed. This closes the prior missing-current-version evidence item; it does not certify individual entitlement.

### Unresolved or deliberately unmodelled pension matters

- No unresolved current numeric constant was found in the supported ordinary-domestic scope. The original commencement of the unchanged Energy Supplement is not established by this check; its current amount is verified.
- Annual CPI extrapolation, 26-fortnight annualisation, cent rounding and zero floors are model conventions. Future pension rates are not verified future legislation. Statutory March/September indexation and July threshold rounding are not replicated.
- Work Bonus bank/starting credits, fortnightly timing, specialist eligibility, illness separation, overseas/transitional payments, rent assistance and pensioner/family Medicare rules remain outside the documented scope. The $11,800 bank and $4,000 starting credit are not implemented constants.
- SAPTO remains limited to the enabled ordinary pension scenario (unless excluded), including eligible zero-pension recipients. It affects income tax and downstream retirement cashflow; ordinary core/payroll and pension-off calculations do not use it.

## AI requirement-to-evidence matrix

Both default handlers import the same `api/_lib/ai-policy.js`. **No row below has been verified against deployed infrastructure.** Local HTTP/browser tests invoke the real handlers under a local server, not Vercel. Provider and Redis tests use mocks.

| Requirement | Coaching `/api/ai-insights` | Payslip `/api/payslip-extract` | Exact automated evidence and level |
| --- | --- | --- | --- |
| Release lock | `aiEnablementStatus` requires `AI_RELEASE_READY && exact true flag`; POST checks `isEnabled()` before policy/body. GET returns disabled metadata. | Handler checks `!AI_RELEASE_READY` before policy/body/document parsing. | `tests/release-safeguards.test.mjs`: **both routes reject before body access or any network call, even with keys and flags** (direct handlers, throwing body getter/fetch). `tests/ai-containment-r1.test.mjs`: **release gate cannot be enabled by environment alone**, **R1 disabled POST is rejected before the handler reads the request body or stream**, **R1 availability endpoint reports disabled without requiring an API key or calling the provider**. Local browser: **CSP rejects injected inline script and both APIs remain disabled**. |
| Method validation | GET status, POST locked; other methods 405 with Allow header. | POST locked; other methods 405. | `tests/release-safeguards.test.mjs`: **both route handlers reject unsupported methods before body or network access** (PUT/PATCH/DELETE/OPTIONS/HEAD for both; payslip GET). Direct real handlers. |
| Origin rejection | Dormant `protectRequest → validateRequest`, exact configured HTTPS origin. | Same. | `tests/release-safeguards.test.mjs`: **future policy rejects origins, methods, content types, lengths and missing access**. Tests absent/null, hostile, suffix-spoofed and HTTP origins, expecting 403. **Helper isolation only**: locked handlers intentionally return 503 first, not 403. |
| Per-IP limiting | **Not implemented.** | **Not implemented.** | **No test and no infrastructure evidence.** Browser cooldown/max-generation metadata is not server per-IP enforcement. Before AI activation, specify trustworthy client-IP extraction, privacy/retention, shared-store keys, limits and proxy/spoofing/concurrency tests, or approve a documented alternative abuse-control requirement. |
| Shared budget | Dormant `protectRequest → consumeBudget`. | Same Redis key as coaching. | `tests/release-safeguards.test.mjs`: **atomic distributed budget exhausts across calls and fails closed on storage failure**. Mock REST count accepts 20, rejects 21 with 429; missing/failing storage 503. Checks EVAL/INCR/EXPIRE command structure. **Helper isolation only**, not real atomicity, TTL, multi-instance, eviction or service availability evidence. |

The budget is one global **fixed 3,600-second window starting with the first request**, shared by both routes; it is not a sliding window or per-user/IP quota. Boundary bursts are possible. Locked requests do not consume it. Release-lock tests deliberately configure keys and flags, then prove no body reads or network activity.

## Financial-year notice placement and rendered evidence

`calculator.js:carriedForwardRuleNotices` groups actual resolver metadata. `app.js:carriedForwardRulesHtml` resolves each returned result/year's financial year, then calls that helper; it does not persist notice text.

| Surface | Implementation | Coverage/limit |
| --- | --- | --- |
| Salary setup, above take-home summary | `salaryTakeHomeSummaryHtml` | Notice for a partially supported calculation year; no notice for fully supported 2026–27. |
| Retirement results, before snapshot | `renderSemiRetirementScenarioResultHtml` | Aggregates the projection's years and source-year groups. Long forecasts can correctly have a separate income-tax notice for 2028–29 onward. |
| Financial report opening | `reportPresentationHtml` | Same report DOM is printed/exported via `printWithMode('financial-report')`. |
| Retirement comparison report opening | `renderSemiRetirementComparisonPrintReport` | Aggregates compared results; retained by `printSemiRetirementComparisonPdf`. |
| JSON plan/Weekly Plan backup | Existing export functions | No rendered notice is added; backups retain their existing data format. Do not claim universal export coverage. |
| Weekly Planner Excel/PDF | `buildWeeklyPlannerData`, `downloadWeeklyPlannerExcel`, `printWeeklyPlannerPdf` | No new carried-rule notice. Current core calculation year is fixed to fully supported 2026–27. If these exports later use partially supported years, disclosure coverage needs extension before that change is released. |

New browser test: **partially supported 2027-28 renders the source year and affected sections in setup and report**, in `tests/release-browser.mjs`. The local test server substitutes only the calculator's default financial-year constant with `2027-28`; actual calculations and production renderers then execute under the enforcing CSP. This is explicitly an alternate-year fixture, not a production date change or proof of a year selector. No production source file is rewritten.

Expected and asserted rendered text:

> Some settings for 2027-28 are unavailable. This estimate uses 2026-27 settings for Medicare levy, Medicare levy surcharge, study loan repayments, superannuation.

Income tax is intentionally absent: its 2027–28 rules are supported. Evidence: [desktop setup](release-evidence/partial-2027-setup-1366.png), [mobile setup](release-evidence/partial-2027-setup-375.png), [desktop report](release-evidence/partial-2027-report-1366.png), [mobile report](release-evidence/partial-2027-report-375.png), [captured DOM text and fixture provenance](release-evidence/partial-2027-rendered.json). The [print-media capture](release-evidence/partial-2027-print-1366.png) follows the real report print-button action and confirms the notice remains visible under print CSS. Its narrow screen-emulated column is not a paginated PDF/native-printer layout sign-off. Existing local browser tests also check retirement/comparison notices and Chromium PDF rendering. These are not deployed or physical-mobile results. All five new screenshots were visually inspected.

## Payslip availability and deliberate activation sequence

`app.js:PAYSLIP_UPLOADS_AVAILABLE = false`: `salaryPayslipAssistantHtml` returns unavailable wording before picker markup; `extractPayslipForSalary` returns before file access/FileReader. Local desktop/mobile tests assert no `[data-payslip-file]` controls. Direct API invocation remains possible as an HTTP request, but cannot invoke extraction: POST returns 503 before body access even with a key and true flag. Exported provider helpers are internal module functions, not extra HTTP routes.

Before activation, complete [PRIVACY-BOUNDARY.md](PRIVACY-BOUNDARY.md): per-upload consent naming OpenAI and exactly what leaves the device; actual processing-location/retention terms; local extraction/strict numeric allowlist and human review or a separately justified minimisation design; TFN/bank/metadata handling and ambiguous-document fallback to manual entry; reviewed access controls; distributed abuse controls including the per-IP gap above; provider request/logging audit; reliable expiry/reconciliation for orphaned files. `store:false` is not zero retention, and output identifier instructions do not redact input. Current PDF DELETE is best effort and can fail or never run.

Deliberate future steps, **not performed**:

1. Resolve those product/privacy/infrastructure requirements and test enabled flows in an explicitly authorized isolated environment, using synthetic documents.
2. Make a reviewed source change to `AI_RELEASE_READY` only after evidence is accepted. Environment variables alone cannot lift it. Retain independent per-route default-off flags and a rollback switch.
3. For payslips, separately change `PAYSLIP_UPLOADS_AVAILABLE` only alongside the completed consent/access/minimisation UI. Do not place the private bearer token in public JavaScript. Coaching must likewise have a functioning reviewed client access flow.
4. Configure exact allowed origins, appropriate access credentials, shared-store credentials and provider credentials, then explicitly set only the intended route flag to the exact string `true` in the approved environment. Verify provider limits, no raw-content logs, cleanup failure recovery and immediate disablement. Replace lock-only expectations with reviewed disabled-and-enabled integration coverage while preserving fail-closed tests.

## Eight versus 26 files

The reproducible complete comparison is `git diff --name-status e1e69f87e311ec3db396a08fffa6f4d92c82d380 ee81a103f56e5d112114a1760f61f9de303bae2b`: **26 files**, 698 insertions and 156 deletions, including two binary screenshots.

Eight primary implementation/configuration files are `.github/workflows/complete-verification.yml`, `api/_lib/ai-policy.js`, `api/ai-insights.js`, `api/payslip-extract.js`, `app.js`, `calculator.js`, `package.json`, `vercel.json`. The complete diff additionally contains **2 verification scripts, 9 test/fixture files, 5 Markdown documents and 2 screenshots**: 8 + 2 + 9 + 5 + 2 = 26.

The earlier “8 edited files” statement is not a valid complete-diff count. This eight-file grouping explains its possible scope, but no separate eight-file Git comparison/base has been established; it must not be retroactively represented as one. The 26-file count is authoritative for the reviewed commit against its parent. This follow-up working-tree diff has a separate base, `ee81a10`, and must be reviewed separately. No inference is made about whether any remote branch is obsolete.

## Remaining release gates

### Retirement comparison timing investigation

The supplied `comparison-2027-28.pdf` was generated by the local browser fixture from the fictional Young Couple plan, not by loading a saved scenario. `tests/release-browser.mjs` cloned the current retirement draft into a temporary comparison, then changed both full-retirement ages from 62 to 65. The automatically created name `Retire at 62` was never refreshed. The inputs and projection were correct; the title was stale. Saved comparisons separately clone `scenarioInputSnapshot`; editing a comparison does not mutate that stored snapshot. Names confirmed in the Save dialog are treated as user-owned, including names that happen to resemble automatic names.

| Case | Starting ages | Personal retirement events | First row with both fully retired |
| --- | --- | --- | --- |
| Original Current Plan | Alex 32, Jordan 31 | Alex 62 in 2056; Jordan 62 in 2057 | 2057: Alex 63, Jordan 62 |
| Edited temporary comparison | Alex 32, Jordan 31 | Alex 65 in 2059; Jordan 65 in 2060 | 2060: Alex 66, Jordan 65 |
| Explicit shared-year example | Alex 32, Jordan 31 | Alex 65 and Jordan 64 in 2059 | 2059: Alex 65, Jordan 64 |

The fixture's projection start is calendar 2026; the alternate financial-year configuration 2027-28 tests rule disclosures and does not advance the projection start year. Engine ages are `currentAge + yearIndex`, at the **start** of each projection year. Employment stops when age reaches the entered retirement age. `summary.householdFullRetirement` and the report's `accessibleWhenBothFullyRetired.row` select the first all-retired row; financial balances on that row are closing-year values. Adjacent-row income/phase assertions confirm no off-by-one defect. Projection arithmetic is unchanged.

Automatic temporary names now refresh on input edits using an explicit `nameIsAutomatic` flag. Saved/custom names are preserved. Generated per-person summaries appear beneath comparison and saved-card names. Household labels include the event year and actual ages, with earlier retirement years explained. Legacy different-year inputs display Individual timing instead of the old misleading Shared default; no ages are silently changed. Explicit Shared selection aligns partners by elapsed years from current ages. Subsequent primary-person edits retain that alignment even when the input event precedes change. Saving timing validates the mode against the actual offsets, so mismatched inputs cannot be stored as Shared; explicit Individual remains Individual even if years happen to coincide.

New regression coverage checks unequal starting ages, adjacent retirement rows and income cessation, shared-year save/reload, explicit individual timing, custom saved-name preservation, edited comparison isolation, reopen consistency, automatic renaming and generated PDF summaries. The browser fixture also reproduces the original 62-to-65 case under 2027-28 rule disclosure configuration. Privacy/Terms and inaccessible branch-protection inspection remain separate.

Actual deployed Sample Plan mode additionally exposed its sticky exploration banner and screen-wrapper spacing leaking into pagination. Print CSS now excludes that screen-only banner and removes comparison workspace padding/margins, while retaining the report's sample plan identity and all disclosures. An active-banner print regression was added. The real sample-mode six-page A4 export has content on every page and keeps the complete final disclaimer with assumptions. This does not change screen layout or the intentional non-persistence of Sample Plan exploration; persistence validation uses an imported fictional backup.

### Comparison PDF correction after deployed validation

The `64852f8` preview exposed a real print defect missed by the earlier byte-count check: a global `header` print selector hid the comparison cover and its held-rule notices. The fix scopes it to `.app-header`; navigation remains excluded. Print-only assumptions use compact label/value rows and a closing group with the complete disclaimer, without reducing font sizes or suppressing notices. Print containers no longer clip the cover against screen-card rounded corners.

The assumptions renderer incorrectly flattened an already-flat `viewModel.assumptions.rows` list. It now prints the existing matching assumptions, including both people's returns and retirement ages, without the previous ten-row truncation. Shortfall milestones contain dates/ages, not funding amounts: the breakdown now reads the matching `annualRows[].household` values (normal/one-off spending, net cash income, accessible/super withdrawals and unmet spending). Zero remains zero. No projected shortfall is explicitly not applicable; a missing annual row is explicitly unavailable. No model, input, persistence or AI-lock logic changed. Two presentation-function hashes were refreshed; all other protected hashes remain unchanged.

Regression evidence: `tests/sample-plans-multi-comparison-g2h.test.mjs` checks the correct shortfall-year row, exact amounts, zero values, no shortfall and absent annual output. `tests/release-browser.mjs` checks real print-media title/metadata/disclosure visibility, hidden application header/navigation, populated assumptions, absence of generic missing-data placeholders, and the closing-group break rule. It renders financial and comparison PDFs for 2026-27 and a test-only 2027-28 configuration, with both adults retiring three years later in the comparison. Production's configured year is unchanged. Set `FFS_PDF_OUTPUT_DIR` to retain the four PDFs for visual inspection. The browser fixture stubs the native print dialog and then uses Chromium `Page.printToPDF`; deployed validation separately uses real print actions. Actual pagination requires inspecting the rendered PDFs; viewport element height is not equivalent to paginated print height.

Local full verification: 57 suites / 1,162 tests passed. Six browser checks passed, including the expanded print regression. Rendered comparison PDFs have six pages, with assumptions and the complete disclaimer together on the final page; financial PDFs have 15 pages with charts. These are synthetic two-person fixtures. Remote CI and deployment evidence must be tied to the eventual pushed commit, not inferred from these local results. Privacy/Terms completion and the branch-protection 403 limitation remain separate.

Core release: successful remote CI for the eventual release revision; confirm required `Complete Verification` check enforcement; actual preview response headers and browser/print/save/restore/navigation verification; finish public-launch Privacy/Terms identity/contact and draft review. The SAPTO compilation evidence gap is closed as of this check; supported-scope limitations remain disclosures, not newly discovered wrong constants. Current-year core exports do not require held-rule notices, but future-year export coverage must not be overstated.

AI activation: separate access/consent/minimisation/retention/cleanup and distributed abuse-control requirements above, including absent per-IP enforcement and real service testing. None blocks the release-locked planner by requiring AI services to be provisioned.

Validation: `pnpm run verify` passed, **57 suites / 1,161 tests**, zero failures, skips, TODOs or cancellations. This includes 22 pension/SAPTO tests and the unchanged numerical parity fixtures. Log: `../release-evidence-verify.log`. Focused direct-handler/policy tests: **16 passed**. Final `pnpm run test:browser-release`: **5 passed**, including the partial-year fixture and print-media visibility. Test inventory, syntax and `git diff --check` passed. No remote CI, hosting, Redis, provider or branch-protection change is claimed. Changes remain local and uncommitted on `codex/release-readiness` above `ee81a10`.
