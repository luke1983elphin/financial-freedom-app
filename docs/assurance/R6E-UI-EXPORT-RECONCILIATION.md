# R6E UI Export Reconciliation

The Weekly Plan UI and workbook export consume the same corrected generated schedule. No export-side date adjustment was added.

For the Hobart fortnightly salary fixture, the in-app planned income sequence and the `Weekly Money Plan` worksheet sequence are identical:

```text
2672, 0, 2672, 0, 2672, 0, 2672, 0, 2672, 0
```

This places income in weeks `1,3,5,7,9` in both outputs. The focused test creates the workbook bytes, reads the worksheet XML and compares every exported weekly income value with the UI schedule.

Opening and closing planned balances consequently move in the affected Hobart weeks, as expected. Carry-forward continues from the corrected prior planned closing balance. The annual planned salary remains `$69,472`.

The export implementation file is byte-identical to R6D. PDF/print formatting was not changed; those paths receive the corrected shared Weekly Plan data rather than applying independent bucketing logic.
