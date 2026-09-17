# R6B Frequency Resolution Contract

## Authority order

For each person, Weekly Plan salary timing resolves in this order:

1. A valid structured `incomeItems[]` salary/wages record owned by that person.
2. That person's valid legacy `plan.income.personXFrequency` value.
3. The existing safe default, `fortnightly`.

Canonical deterministic IDs are preferred. Equivalent structured salary records remain supported when their salary type, owner and frequency are valid. Rental, passive, joint-other, scenario-adjustment and the other person's records are excluded.

## Amount contract

The annual net-pay source is unchanged. Weekly Plan continues to use the existing person-level payroll result and divides it by the resolved occurrence count. Values remain rounded to cents at the timing-row boundary. For example, a monthly division may have a few cents of annual display-rounding residual.

R6B does not write, normalise, migrate or backfill either legacy frequency field.

## Other income

The legacy aggregate other-income timing remains unchanged. A broader canonical non-salary timing redesign was not justified and is outside R6B.
