# Final modelling assurance

Baseline: PR #11 head `4927f2034eade8e8001c820408615eb852fd5e57`.
Branch: `fix/final-modelling-assurance`. The delivery manifest identifies the final commit and archive hashes.

All three issues were reproduced and narrowly corrected. The FI wealth definitions, retirement residual settlement, retained-assets engine and UI markup/styles remain unchanged. This work is committed on a separate local branch for independent review; PR #11 was not modified or merged, and nothing was deployed or enabled for AI.

## 1. Future mortgage payment reinvestment

**Reproduction:** age 45, retirement age 65, mortgage $18,000, zero interest, $1,000 monthly payment, $80,000 gross salary, $63,880 net cash income, $40,000 living expenses, configured investing $6,000, zero investment return. The mortgage pays off in month 18. Projection continues for 30 years.

**Confirmed defect — behaviour B:** `calculatePlan` constructed `freedMonthlyRepayments` and passed the full former payment into `projectBalance` automatically after payoff, in addition to the initial affordable contribution. No explicit strategy or future affordability check authorised that increase. With negative surplus, the extra contributions still occurred. The baseline had no future household cashflow reconciliation rows: fields that did not exist are marked null in the before trace, not fabricated.

**Correction:** `accumulationMortgageCashflows` reuses existing legacy amortisation and canonical loan breakdowns. `calculatePlan` emits `accumulationCashflowProjection`, replacing the mortgage component of its fixed annual budget with the scheduled obligation. Annual investing is `min(configured target, max(0, net income − living costs − required debt deductions − extra super allocation))`. `projectBalance` receives that annual contribution series; payoff alone adds no discretionary allocation. A higher configured target can use increased available surplus, but never exceed it. A zero target remains zero. Unknown legacy balances and incomplete loan-term schedules with unpaid principal do not imply payoff.

**Before/after contribution and balance:**

| Year | Opening mortgage | Required/deducted mortgage after | Contribution before | Contribution after | Investment close before | Investment close after |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 18000 | 12000 | 6000 | 6000 | 6000 | 6000 |
| 2 | 6000 | 6000 | 12000 | 6000 | 18000 | 12000 |
| 3 | 0 | 0 | 18000 | 6000 | 36000 | 18000 |
| 4 | 0 | 0 | 18000 | 6000 | 54000 | 24000 |
| 5 | 0 | 0 | 18000 | 6000 | 72000 | 30000 |
| 6 | 0 | 0 | 18000 | 6000 | 90000 | 36000 |

Net household cash income remains $63,880, living expenses $40,000, configured/affordable/actual investing $6,000 each year in this fixture. Other debt and extra super are zero. Remaining surplus is $5,880 in year 1, $11,880 in year 2 and $17,880 thereafter. Full fields, including contribution passed into the accumulation projection, are in `mortgage-trace.csv` and the assurance JSONs.

**Evidence:** payoff/partial-year payment, required-versus-deducted equality, configured cap, low/negative surplus, zero target, structured-only mortgage, unknown balance and unpaid-term tests pass.

**Scope limitation:** this remains the simpler accumulation model. Income, taxes, living expenses, extra super and non-mortgage debt deductions remain its existing fixed annual assumptions; this task does not introduce retirement wage transitions, future tax changes or an integrated lifetime cashflow engine. Detailed retirement remains the appropriate model for those changes. Contributions remain spread monthly using existing cent rounding (annual totals can differ by a few cents from the unrounded annual budget). For an unpaid legacy loan beyond its entered term, the existing payment obligation is retained conservatively rather than assuming payoff or inventing a refinance schedule. Its existing warning still applies.

## 2. Per-person super access

**Reproduction:** Person 1 age 58 with $300,000; Person 2 age 55 with $250,000; $100,000 other accessible cash, no property, no contributions or growth, annual target spending $40,000, SWR 4%. The main model supports fixed age 60 for each person; the permitted equivalent fixture uses 60/60 rather than adding a new 60/65 input architecture. Detailed retirement continues to support its own per-person access-age overrides.

**Confirmed defect:** `calculateNetFiAssetSummary` tested Person 1 age against 60 and included the entire household super balance. The simplification was inconsistent with ownership and accessible-funding definitions. At ages 60/57 it made the younger person's $250,000 accessible three years early.

**Correction:** `superAccessByPerson` applies age eligibility to each owner's balance. `calculatePlan` passes per-person projected balances into current/future FI, milestones and the existing retirement-sustainability starting pool. Person 1's trajectory uses their employer contribution and the existing extra-super allocation; Person 2 receives the remaining aggregate balance, preserving the existing household total and assigning only aggregate cent-rounding differences to Person 2. Explicit additional contributions not allocated by the taxable-income split remain with Person 1 rather than becoming phantom Person 2 contributions. `superPeople` exposes age, access age, balance, accessible and inaccessible amounts. Total FI Wealth remains Accessible FI Assets + Investment Property Equity; it is not redefined to include inaccessible super. Broader household net worth continues to track all super.

| P1 age | P2 age | P1 balance | P2 balance | Eligible P1 after | Eligible P2 after | Accessible FI before → after | Inaccessible after | Total FI Wealth after | FI % before → after |
|---:|---:|---:|---:|---:|---:|---|---:|---:|---|
| 58 | 55 | 300000 | 250000 | 0 | 0 | 100000 → 100000 | 550000 | 100000 | 10 → 10 |
| 59 | 56 | 300000 | 250000 | 0 | 0 | 100000 → 100000 | 550000 | 100000 | 10 → 10 |
| 60 | 57 | 300000 | 250000 | 300000 | 0 | 650000 → 400000 | 250000 | 400000 | 65 → 40 |
| 61 | 58 | 300000 | 250000 | 300000 | 0 | 650000 → 400000 | 250000 | 400000 | 65 → 40 |
| 62 | 59 | 300000 | 250000 | 300000 | 0 | 650000 → 400000 | 250000 | 400000 | 65 → 40 |
| 63 | 60 | 300000 | 250000 | 300000 | 250000 | 650000 → 650000 | 0 | 650000 | 65 → 65 |
| 64 | 61 | 300000 | 250000 | 300000 | 250000 | 650000 → 650000 | 0 | 650000 | 65 → 65 |

The corrected figures change only during the interval when one partner was wrongly unlocked. Separate tests reverse the age ordering, conserve aggregate super under growth, and confirm new contributions retain their owner's eligibility. The existing calculation-audit expectation intentionally changes from $1.15m accessible/$1.4m wealth/46% to $1.05m/$1.3m/42%, because its younger partner's $100k is inaccessible. Its low-target percentage correspondingly changes 460% → 420%. No tests were removed or weakened.

**Remaining conventions:** main access age is still 60 for each person, not a new configurable preservation-age system. Detailed scenario overrides are not automatically applied to the independent main-plan model. The simple retirement-sustainability illustrations still use a static starting pool; they do not introduce the later release of a younger person's super or other lifetime events. The detailed retirement projection models those events. Missing Person 2 age is not treated as permission to unlock their balance.

## 3. Stale legacy debt resurrection

**Confirmed defect:** `semiRetirementUi.js:projectionLiabilitiesFromPlan` filtered structured records and returned only if the resulting list was nonempty. Otherwise it reconstructed home/card/other debt from legacy fields. Thus zero, inactive/deleted or schema-authoritative empty records could revive old balances.

**Correction:** shared `hasStructuredLiabilityAuthority` treats a nonempty structured collection as authoritative (including zero/inactive/deleted records). An empty collection is authoritative when `planSchemaVersion` or `meta.schemaVersion` identifies the existing structured schema. The adapter returns the filtered result even when empty. Main household loan cashflow and home-equity debt selection share this authority rule, preventing a removed loan from reappearing in those funding outputs. Existing active filtering, ID deduplication, offset allocation and loan schedules are reused.

| Case | Structured/provenance evidence | Legacy mirror | Detailed debt before | Detailed debt after |
|---|---|---:|---:|---:|
| A. Active home | Active home $12,000 | 99000 | 12000 | 12000 |
| B. Zero home | Explicit balance/payment zero | 99000 | 99000 | 0 |
| C. Inactive home | active=false | 99000 | 99000 | 0 |
| D. Empty canonical | Schema version 1 + [] | 99000 | 99000 | 0 |
| E. Deleted rental | deleted=true rental record | 75000 | 75000 | 0 |
| F. Genuine legacy | No structured model | 99000 | 99000 | 99000 |

Case E uses the existing legacy `otherDebts` aggregate, which the adapter previously revived as an unlinked other-debt record. The adapter has no separate legacy rental-debt field; no new one was invented. Active structured home debt retains its own $12,000 rather than the $99,000 mirror. Mixed active/removed structured records preserve only active debt. Explicit zero with stale scheduled repayment cannot withdraw principal because the existing paid-off loan breakdown remains authoritative.

**Compatibility/limitation:** an unversioned empty array without other provenance is indistinguishable from an old plan that used empty placeholders. It retains legacy fallback; balance alone is not used to guess that the debt was deleted. Schema-bearing plans with no array at all are also left to the existing migration layer to create their canonical records. No migration/deletion history is invented, and historical saved data is not rewritten. Unrelated legacy summary/net-worth mirrors outside these funding paths were not refactored.

## Verification and parity

- New focused tests: **25/25**.
- Combined assurance, retirement, FI/cashflow and release-parity groups: **568/568** (25 + 495 + 41 + 7).
- All PR #11 targeted tests: **67/67**, unchanged (41 FI/cashflow + 26 exhaustion/retained assets).
- `pnpm test`: **933/933**, 43 suites, no failed/skipped/cancelled tests (baseline 908 + 25).
- `pnpm run verify`: passed, including test inventory, syntax, security configuration, numerical parity self-tests, AI containment, runner/scanner self-tests and full regression.
- `pnpm run security:scan`: passed independently.
- Existing real-app browser smoke: passed; Future You and Live Summary deterministic assertions, retirement results and retained assets, 1366px/375px and large values, no horizontal overflow or captured console/page errors. Browser server is loopback-only and production APIs are stubbed disabled. No UI source or styles changed.
- Exact PR #11 parity across every pre-existing `calculatePlan` output for four unaffected fixtures: single/no debt, same-age couple, no super/no debt, and mortgage not paid off within the 30-year horizon. Only additive `superPeople` and `accumulationCashflowProjection` metadata is excluded. `assurance-parity.json` records the scope. The existing browser harness additionally verifies three unaffected detailed-retirement scenarios against its original main baseline; that is separate from the PR #11 parity comparison.

The only existing assertion adjustments are the four explicit mixed-age audit expectations above. Corrected mortgage/super/debt scenarios are documented as differences, not reported as parity. Calculation version is retained at 2026.27.3 for this narrow assurance stage; source commit identifies the revision.

## Files and reproducibility

1. `calculator.js`: mortgage cashflow schedule and annual contribution input; owner-specific super eligibility/projection inputs; shared structured-liability authority.
2. `semiRetirementUi.js`: prevent legacy fallback when structured debt is authoritative.
3. `scripts/test-suites.mjs`: register assurance tests.
4. `scripts/modelling-assurance-fixture.mjs`: deterministic inputs.
5. `scripts/verify-modelling-assurance.mjs`: before/after traces and exact PR #11 parity checks (first argument is a directory containing baseline calculator/retirement runtime files; second is output directory).
6. `tests/final-modelling-assurance.test.mjs`: 25 focused cases.
7. `tests/calculation-audit-2026-27.test.mjs`: corrected mixed-age expectations.
8. `docs/FINAL-MODELLING-ASSURANCE.md`: this report.

Evidence ZIP contains baseline/current JSON, mortgage/super CSV traces, parity JSON, final validation logs and browser screenshots/checks. Source ZIP is exported from the committed tree. The external delivery manifest records the full commit SHA; SHA256SUMS.txt identifies both archives. Stop here for independent review: no merge, production deployment, AI enablement, or unrelated refactor.
