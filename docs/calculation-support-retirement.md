# Retirement calculation support

The result and retirement comparison offer **Download calculation support (Excel)**. A browser-memory capture owns the scenario results, resolved inputs, draft assumptions, comparison values and display settings. Unchanged captures retain their ID; a change creates a new UUID. The retirement comparison PDF displays that same ID. Nothing is uploaded or written to plan/scenario storage.

The workbook contains an overview with worksheet links, inputs, full retained annual engine detail, annual funding, separate dollar conversion, formula-based accessible/super balance workings, figure reconciliation and review notes. Annual funding identifies work phases and super access ages, income, spending, withdrawals and gaps. Engine detail includes tax, Age Pension and property-event records where modelled. Engine estimates are explicitly distinguished from workbook arithmetic; no independent benchmarking or professional review is claimed.

Stable RET references appear in the result and comparison and their workbook rows. Today’s Dollars discounts each annual amount separately; nominal engine records remain unchanged. The workbook is a captured record, not an editable replacement for the retirement engine.

Verification uses only fictional plans. `scripts/verify-calculation-support.mjs` exercises a funding gap, input edits, alternatives, both dollar bases, unchanged rerenders, real downloads and matching PDF IDs. `scripts/verify-calculation-support-excel.ps1` opens both exports in Excel without repair, recalculates every balance/conversion row and perturbs an input in a disposable read-only workbook. Run with the bundled Playwright path in `FFS_PLAYWRIGHT_MODULE`.

Report suites and existing browser reporting-scope regression pass. Both financial and retirement parity scripts pass against main `c561017`; financial engines, schemas, stored history and numerical fixtures are unchanged. Fictional examples accompany this draft under `docs/examples/calculation-support/retirement/`.

This is the first review stage. Growth, Saved Scenarios and Try a Change are separate draft PRs. Professional Review remains out of scope. No deployment or merge is part of this work.
