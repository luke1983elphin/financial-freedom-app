# R6E Financial Parity

R6E was compared with the accepted R6D extraction at `stage-r6d-source-staging-20260915-163500`.

- Seven fictional plans
- Fourteen annual financial metrics per plan
- Exact normalised match: true
- Retirement Planning sample projections: exact match for all seven samples
- Taylor/Morgan retirement projection: exact match
- Annual planned fortnightly salary in the R6E DST fixture: `$69,472`, unchanged

The protected financial engines and configuration files are byte-identical to R6D. The expected and authorised difference is limited to future Weekly Plan date placement and resulting weekly planned opening/closing balances where R6D previously assigned a civil occurrence to the wrong week across DST.

No tax, Medicare, MLS, STSL, super, investment, debt, retirement or annual cashflow formula changed.
