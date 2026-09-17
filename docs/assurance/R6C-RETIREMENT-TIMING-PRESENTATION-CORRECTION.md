# R6C Retirement Timing Presentation Correction

## Scope and outcome

R6C resolves R6-F7 as a presentation/view-model defect only. The Retirement Plan snapshot now retains canonical person timing, distinguishes an elected personal semi-retirement phase from a projection-derived household transition, and reports valid full-retirement ages.

No projection formula or financial rule changed. `semiRetirementProjection.js` and `calculator.js` remain byte-identical to the accepted R6B baseline.

## Root cause

`personListFromProjection()` reduced each person to `id`, `name`, `currentAge` and `superAccessAge`. The snapshot renderer therefore received no `hasSemiRetirement`, `semiRetirementAge` or `fullRetirementAge` and used false fallback text even though the projection timeline retained the correct retirement events.

## Correction

- Canonical input and draft people are matched by stable `id`, with the existing index fallback retained for legacy data.
- `hasSemiRetirement`, `semiRetirementAge`, `fullRetirementAge` and `superAccessAge` are preserved in `viewModel.people`.
- Household-transition detection uses `projection.years[].householdPhase`; it does not duplicate the engine's phase rules.
- The snapshot displays personal semi-retirement choices separately from a household transition created by staggered retirement dates.
- The funding heading is `Transition / Semi-Retirement Funding`, with copy explaining that it covers both elected semi-retirement and staggered retirement dates.

## Taylor/Morgan result

With Taylor age 40, Morgan age 38, neither electing semi-retirement, and both selecting full retirement at age 60:

- personal semi-retirement choice: `None selected`;
- household retirement transition: `2046-2048`;
- full retirement: `Age 60`;
- Taylor timeline retirement: 2046;
- Morgan and household full retirement: 2048;
- transition funding: `$70,401.54`, displayed by the existing rounding as `$70,402 total`.

