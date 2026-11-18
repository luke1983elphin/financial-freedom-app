# Growth calculation support

Stacked on the Retirement calculation-support draft. The download lives beside the Growth Scenarios comparison and captures all three scenarios together. GRO-01 through GRO-05 identify investments, super, home equity, investment-property equity and total net worth in desktop/mobile results and workbook reconciliation.

Each capture includes requested rates, include-overrides flags, resolved cloned plans, annual balances, retained investment/super/wealth/net-worth schedules, selected-year raw and formatted values, inflation and dollar basis. Changing a rate, override, selected year, plan or basis creates a new ID. Invalid scenarios suppress the export rather than exporting stale results. The existing Growth UI has no PDF export; the fictional screenshot shows the matching ID.

Workbook formulas reconstruct annual net worth from the reported asset components plus the engine-supplied other-net-assets/liabilities residual. Separate conversion formulas calculate Today’s Dollars. The residual and underlying forecast are explicitly engine supplied, not independent validation. No financial calculation, schema or saved-plan write is introduced.

Validation: growth model tests; browser checks of explicit asset overrides, zero Base super return, selected year, both bases, exact table/chart values, capture changes and unchanged plan; Excel opens both exports without repair and recalculates annual totals, conversions and a disposable input perturbation. Example workbook and matching screenshot are under `docs/examples/calculation-support/growth/`. Browser/Excel scripts are included for repeatable verification.

Keep this PR draft. No merge, deployment or Professional Review changes.
