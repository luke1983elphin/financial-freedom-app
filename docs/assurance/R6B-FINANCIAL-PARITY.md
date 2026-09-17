# R6B Financial Parity

Command:

`node scripts/r1-numerical-parity.mjs ..\r6a-clean-verify-20260908-173059`

Genuine baseline: accepted R6A extraction from `stage-r6a-stage-readiness-correction-final-source-20260908-173059.zip`, SHA-256 `890C8802217B7FB9806E629DE001524A2296F90193E13C6E3CB3112722C21816`.

Result: seven fictional sample plans, 14 required financial metrics per plan, all exact and identical. Missing metric paths remain fatal in the parity tool.

Expected difference: Weekly Plan week-by-week receipt timing changes when a current structured salary frequency differs from a stale legacy frequency. That is the intended R6B correction and is not an annual financial-model change.
