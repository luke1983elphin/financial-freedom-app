# R6 Integrated Release-Candidate Report

## Outcome

**BLOCKED - not release-ready.** Resumed R6 validation stopped at a newly confirmed Weekly Plan financial defect. No runtime correction, preview deployment, production change, push, merge or AI enablement was performed.

## Accepted baseline

- Source: `stage-r6a-stage-readiness-correction-final-source-20260908-173059.zip`
- SHA-256: `890C8802217B7FB9806E629DE001524A2296F90193E13C6E3CB3112722C21816`
- Git identity: unavailable in the accepted archive; no commit ID is asserted.
- Toolchain: Node 24.x; pnpm 11.19.0.
- Inventory: 29 registered and discovered suites.
- Baseline and final pre-stop suite: 627 passed, 0 failed.
- Syntax, verification, R1 AI containment, R3 blocker, R5 durability, R6/R6A and secret scan: passed.

## Browser work completed before stop

- Rechecked all seven samples for settled Home readiness and AI-disabled presentation.
- Opened all ten main workspaces for the fictional personal plan with no visible `NaN` or `undefined` values.
- Created and reloaded a fictional two-person personal plan through the user interface.
- Entered two fortnightly salaries, expenses, assets, home loan, offset, investments, super and goals.
- Generated a 52-week Weekly Plan, edited a timing item with stable draft state, saved it, and collapsed Step 1.

## Release blocker R6-F5

The personal plan retained both salary records as `frequency: "fortnightly"`. The generated Weekly Plan instead created annual timing items and placed each person's full estimated annual net employment income in Week 1:

- Taylor: `$70,000 annually` after the deliberate timing-editor amount test (originally `$69,093 annually`).
- Morgan: `$57,171 annually`.
- Current-week planned money in: `$127,171`.

The weekly schedule should contain fortnightly net-pay occurrences, not one annual receipt. This is a financial scheduling defect and triggered the mandatory R6 stop rule.

## Root cause trace

`weekly-plan.js:571-573` obtains salary timing from legacy `plan.income.person1Frequency` and `plan.income.person2Frequency`. The Financial Plan interface persists current records in `plan.incomeItems[]`, where both tested salary records retained `frequency: "fortnightly"`. The structured records are not used when building default salary timing items.

## Proposed narrow correction

Create a focused post-R6 correction that:

1. builds salary timing from canonical structured `incomeItems[]` records;
2. creates an independent timing item for each salary record, preserving its owner, recurrence and first pay date;
3. allocates each person's existing calculated annual net employment income across that person's salary records without recalculating tax or deducting PAYG twice;
4. uses legacy `plan.income.*Frequency` only when structured income records are absent;
5. preserves saved user-edited timing items and completed Weekly Plan history;
6. adds browser and calculation tests for two fortnightly salaries on different dates, multiple salaries for one person, and legacy plans.

Owner approval is required before implementation. R6-F3 remains incomplete behind this blocker.
