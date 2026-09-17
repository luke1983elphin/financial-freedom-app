# R6C Person vs Household Phase Contract

## Person-level choice

A person has an elected semi-retirement phase only when `hasSemiRetirement === true` and their selected `semiRetirementAge` is earlier than their `fullRetirementAge`. This is a personal scenario choice and is labelled with the selected person where a couple has only one election.

## Household transition

A household transition exists only when an authoritative annual projection row has `householdPhase === "semi-retirement"`. This can occur when:

- an elected semi-retired person and a working person coexist;
- one person is fully retired while another remains working; or
- people with different current ages reach the same selected full-retirement age in different calendar years.

The presentation does not infer this phase from age differences and does not imply a personal election where none exists.

## Display rules

- One valid full-retirement age: `Age 60`.
- Same valid age for a couple: `Age 60`.
- Different valid ages: `Taylor age 60 / Morgan age 62`.
- One elected semi-retirement in a couple: `Taylor age 55`.
- No personal election with transition rows: `Semi-retirement choice: None selected` plus the projection-derived household transition years.
- No personal election and no transition row: `No semi-retirement phase`.
- Missing or invalid timing only: `Not modelled`.

