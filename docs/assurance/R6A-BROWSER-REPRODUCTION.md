# R6A Browser Reproduction

## Before correction

Accepted R6 source, local in-app browser, sample plan loaded:

- Home: personalised, `Current stage: Building Wealth`.
- Dashboard title: personalised.
- Dashboard stage card: stale `Complete setup` with missing age, income, spending and assets text.
- Report: `Current financial stage: Building the Foundation`.

The personalised Dashboard title alongside a stale incomplete stage card proved this was not a genuine readiness calculation failure.

## After correction

Young Professional:

- Home: ready, `Current journey step: Building Wealth`.
- Dashboard: ready, `Financial Stage / Current stage: Building the Foundation`.
- Report: `Current financial stage: Building the Foundation`.
- Report contains no `Complete setup` state.

All seven sample plans were then selected through the actual sample control. Every Home and Dashboard settled as ready; every Dashboard/Report formal stage matched.

Returning from a sample to the existing incomplete personal plan produced `not ready` on both Home and Dashboard. Reload retained `not ready` on both.

No public preview or physical-device run was authorized in R6A. Those remain part of R6-F3.
