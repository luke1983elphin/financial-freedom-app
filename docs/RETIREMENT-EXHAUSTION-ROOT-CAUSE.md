# Retirement exhaustion investigation

Baseline: main 64d282c. Investigated before changing runtime code.

The device-only Luke/Lisa plan was not supplied. The reproducible fixture in
`scripts/retirement-exhaustion-fixture.mjs` is synthetic, not a reconstruction
of their personal balances. It reproduces shortfall at age 85 / 2068 and a
reported exhaustion age of 89 / 2072.

`withdrawFromSuper` consumes opening super plus net contributions. The annual
projection then credits investment earnings using the existing mid-year
movement convention. An account whose principal was fully withdrawn therefore
receives earnings after the withdrawal calculation. The same ordering applies
to accessible investments. The earnings remain despite unfunded spending and
become next year's opening balance, earning further returns. The milestone
requires unmet spending AND `totalInvestableAssets === 0`, delaying exhaustion
until these residuals round to zero. This is not merely floating-point noise.

The mobile annual-results card labels `totalAccessibleWithdrawal` as
"Portfolio withdrawal", omitting `totalSuperWithdrawal`. Thus it can show $0
while super was actually withdrawn.

Correction: retain existing mid-year returns, fees, and normal funding, then
settle remaining required shortfall at year end from accessible funds above the
configured reserve, followed by eligible super, in the configured order. This
settlement is explicitly at year end and does not earn another period's return
or alter the existing mid-year return basis. Record settlement withdrawals in
all funding totals and reconciliations. Unrestricted exhausted accounts close
at zero without a large balance threshold. No tax/access/return assumption changes.

The retained-assets report uses closing asset/debt rows in the exhaustion year
or the final projection year. Stable linked asset IDs determine loans; unresolved
property links produce unknown debt/equity rather than an outright claim. No
retained value is injected into cash funding. Only existing modelled transactions
(currently home downsizing) affect retained ownership; no sale is invented.
