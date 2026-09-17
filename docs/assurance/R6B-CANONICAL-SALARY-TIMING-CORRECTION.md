# R6B Canonical Salary Timing Correction

## Baseline

- Working source: `stage-r6-resumed-blocked-review-source-20260908-182740-final.zip`
- Verified SHA-256: `24634DB4D38884B1576034CD9070F8269BAF3729BAA154864F38DC853BCD180F`
- Accepted functional baseline: R6A source ZIP SHA-256 `890C8802217B7FB9806E629DE001524A2296F90193E13C6E3CB3112722C21816`.
- Baseline suite: `627 passed, 0 failed`.

## Correction

`weekly-plan.js` now resolves each person's salary timing from a valid owned structured salary record before consulting legacy summary frequency fields. The authoritative annual net-pay values and every financial formula remain unchanged.

Newly generated salary timing rows now carry source provenance. Reforecast is fail-conservative: only exact untouched generated rows without occurrence overrides can follow a canonical source/frequency change. Saved rows without proof, edits, completed weeks and actual history are preserved.

## Scope

No tax, Medicare, MLS, STSL, super, investment, retirement, stage, journey, storage, security or deployment logic changed. R6-F3 remains open. R6 was not resumed and nothing was deployed, pushed, merged or enabled.

## Verification summary

- R6B focused suite: `18 passed, 0 failed`.
- R3B paid-off-loan/timing protections: `44 passed, 0 failed`.
- R6A readiness: `8 passed, 0 failed`.
- Financial parity: `7` samples x `14` metrics, exact.
- Browser: original two-fortnightly defect corrected; mixed frequencies independent; saved custom timing retained; zero console warnings/errors.

Final source verification: `645 passed, 0 failed`; `pnpm run verify` passed. Test inventory registered all 30 discovered suites. Native syntax, browser-security configuration, test-runner integrity, strict parity self-tests and secret scans passed. Package hashes and clean-extraction results are recorded in the private evidence package and delivery summary.
