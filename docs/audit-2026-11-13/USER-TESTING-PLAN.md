# Proposed 16-household user-testing plan

This is a practical study plan, not evidence that testing has occurred. Recruit 16 distinct Australian households (one decision-maker, optionally their partner), run two waves of eight, and use results to improve the corrected deterministic model before any user-facing Monte Carlo release. Allow 60–75 minutes per moderated household plus an optional 15-minute follow-up after one week. Two people can run a wave in three working days, followed by one analysis day; plan about two weeks including recruitment and corrections.

## Recruitment matrix

The rows below specify mutually assigned study slots; characteristics can overlap without counting a household twice. Use a local/review build of this Draft branch or a separately authorised test environment. Do not deploy this audit PR to recruit participants.

| Slots | Household profile | Required variation / focal task |
| --- | --- | --- |
| 1–2 | Single early-career workers, ages 25–35 | One HELP debtor; one modest-income earner in Medicare/LITO range; gross/net salary and SG package interpretation |
| 3–4 | Dual-income couples, ages 30–45, with dependants | Unequal incomes; mortgage/offset; child expenses; owner allocation and debt repayments |
| 5–6 | Mid-career investors, ages 35–55 | One explicit reinvested ETF holding, one cash dividend holding; include a legacy/unlinked dividend and explain overlap |
| 7–8 | High-income / self-directed super households, ages 40–60 | One salary sacrifice/deductible contribution near cap; one likely Division 293 case; identify unsupported assumptions rather than calculate advice |
| 9–10 | Landlords, ages 40–60 | One interest-only rental loan, one principal-and-interest; distinguish cash rent, taxable rental profit, capital growth and net equity |
| 11–12 | Early/semi-retirement households, ages 50–64 | One mixed-age couple straddling super access; one single with small liquid bridge; change retirement age and identify shortfall |
| 13–14 | Retired homeowners, ages 67–80 | One full-pension and one asset/income-tested part-pension case; assess deeming and pension on/off comparison |
| 15–16 | Retired non-homeowner and mixed-age couple | Rent/low assets in one; younger partner accumulation super in the other; recognise rent-assistance and specialist-scope limits |

Across the 16, target at least four mobile-primary participants, four with low financial confidence, four with high financial confidence, two who use keyboard/zoom/assistive technology, and a mix of single/couple and income/asset levels. Do not require participants to supply real tax identifiers, bank logins or account numbers. Recruit advisers separately as expert reviewers; do not substitute their opinions for household comprehension.

## Preparation and safe study setup

Study owner prepares a one-page case card per slot with age, ownership, income frequency, cash/taxable investment income, assets, liabilities, repayment type, retirement spending and clearly dated assumptions. Use synthetic or participant-redacted rounded amounts. A financial reviewer independently signs off expected current cashflow, tax, return split, debt/equity, super accessibility, nominal/today-dollar conversions and first shortfall for each case before the session. Record reference version, method and a reconciliation tolerance; do not use the app as its own oracle.

For findings still unfixed, use a labelled diagnostic task with a known-issue sheet for the moderator. Do not present known-wrong forecasts as advice or ask participants to act on them. Stop interpreting an affected result once a material discrepancy appears, capture the input path and continue unrelated tasks. User testing identifies usability and input issues; it does not validate law or replace model correction.

Obtain study consent for observations and optional recording. Explain that participation concerns comprehension and data entry, and that amounts are illustrative. Save de-identified case IDs, not names or financial screenshots, in the repository. Any recordings/real financial documents need an agreed restricted storage location and deletion date; retain de-identified findings for 90 days, delete raw session recordings after 30 days unless consent specifies otherwise. Do not enable analytics or AI extraction for this study without a separate approved workflow.

## Session script

| Time | Task | Observation / success criterion |
| --- | --- | --- |
| 0–5 min | Consent; financial confidence/device background | Participant understands the study and can choose synthetic data |
| 5–18 min | Create household from case card; enter salary/package, owner, frequency, assets and loans | At least 14/16 complete core setup without a moderator entering values; no unrecognised monthly/annual or ownership errors |
| 18–28 min | Read current cashflow; explain tax, HELP, SG and loan principal/interest | Correctly identify gross versus net income, employer SG outside spendable salary, and debt payment effect; record every material misinterpretation |
| 28–40 min | Configure 7% total return with 3% yield; switch cash/reinvest; resolve linked duplicate dividend | At least 14/16 explain that yield is inside total return and reinvested income can still be taxable; all affected cases identify how taxes/fees are treated or marked unknown |
| 40–52 min | Change retirement age/spending; explain accessible assets, super access and property equity | At least 14/16 correctly identify what can fund spending and the first shortfall; mixed-age cases distinguish each partner's access |
| 52–60 min | Toggle nominal/today dollars; change CPI; relevant cases toggle pension | At least 14/16 identify base-year purchasing power; every pension participant understands the estimate is conditional, dated and not an approved entitlement |
| 60–68 min | Save/reopen a comparison and export/read report | Scenario difference remains understandable; inputs/assumptions survive; report matches screen and case reference |
| 68–75 min | Teach-back and brief confidence/trust interview | Participant names one key assumption and limitation; record confidence 1–5 and perceived decision risk |

For the proposed later Monte Carlo wording task, use a clearly labelled paper/mock result, not a generated forecast. Ask participants to explain “80% of modelled paths fund the defined spending to age 90,” name what the remaining 20% means, and distinguish model uncertainty from a guaranteed real-world chance. Never claim a modelled percentage is a pension eligibility probability or personal recommendation. Run this task only after the deterministic funding tasks, so probability wording cannot conceal missing tax/debt understanding.

## Metrics and records

Use one row per household/task: case ID, model/build version, device, task, completion without help, minutes, wrong input/result interpretation, expected/actual key amount, absolute delta, severity, participant quote (de-identified), owner and resolution. Track input mistakes separately from formula defects and presentation misunderstandings. Record intervention level (none, hint, guided completion) so a “completed” task is not mistaken for independent success. Add a one-week follow-up asking participants to retrieve the saved scenario and explain its key assumption without prompting.

Report counts as `n/16`, plus mobile/confidence subgroup observations. The sample is formative and too small for population accuracy claims. For numerical checks use case-specific tolerances: cents for current deterministic cash/tax, documented rounding for annual balances; no broad percentage tolerance that hides the $350k debt omission or unpaid tax. Every material dollar mismatch needs financial review regardless of completion rate.

## Triage and release decisions

Wave 1 (eight households) prioritises discovery; fix input/wording issues and revalidate the independent reference before wave 2. Do not silently change calculations during a session. Re-run materially changed tasks with at least four affected households, extending recruitment to a maximum of 20 if necessary.

Block financial probability release for any unpaid/duplicated cashflow, omitted liability, wrong owner/access age, data loss or materially misleading return/pension interpretation. Assign critical funding defects within one working day and pause the affected task. Numerical correctness needs zero unresolved material financial defects; comprehension needs at least 14/16 correct teach-backs for each core concept, with all affected mixed-age/pension cases correct. A missed target triggers revision and retest rather than averaging across unrelated tasks.

Deliver a de-identified study summary, task metrics, issue register with reproduction/reference evidence, revised copy recommendations and an explicit go/no-go recommendation. The financial model owner and qualified financial reviewer decide readiness after deterministic corrections and policy verification. Participant approval or good usability scores alone cannot override unresolved F01–F10 risks.
