# Stage 3A Canonical Integrity Hardening

## Scope

Stage 3A is a narrow correction on the completed Stage 3 source. It changes no financial formula, tax rule, Weekly Plan logic, projection engine or user-interface design.

## Corrections

1. Goal-target unlink now clears the matching `linkedAssetId` or `linkedLiabilityId` compatibility field before removing the explicit relationship.
2. Goal targets have one authoritative target. Relinking removes the prior target relationship and clears both compatibility fields before setting the new one.
3. `asset-income`, `asset-liability` and `goal-target` use one explicit relationship contract shared by import validation and mutations. Unknown types, incompatible endpoints and missing endpoints are rejected for new mutations.
4. Malformed imports retain financial entities, remove invalid relationships and record repair messages.
5. Duplicate-ID migration detects ambiguous endpoints before deterministic ID repair. Ambiguous links are removed, compatibility references are cleared, and explicit relinking is required.
6. Legacy `changedInputs` rows are mapped only when the saved label and value provide deterministic semantics. Unmappable rows are retained as read-only `legacyProvenance`; historical snapshots are untouched.

## Required probes

- Probe A: asset goal link -> unlink -> migrate: relationship remains absent.
- Probe B: asset goal link -> liability relink -> migrate: one liability target remains.
- Probe C: `goal-target` asset -> asset: rejected as incompatible.
- Probe D: unknown relationship type: rejected.
- Probe E: deterministic legacy `changedInputs` become typed events; unsupported display-only rows remain explicit read-only provenance with no invented event.

## Verification

- Stage 3A: 21 passed, 0 failed.
- Stage 3 combined: 60 passed, 0 failed.
- Stage 2B: 18 passed, 0 failed.
- Stage 2: 17 passed, 0 failed.
- Stage 1: 48 passed, 0 failed.
- Full regression: 834 passed, 0 failed across 39 suites.
- `pnpm run verify`: passed.
- Secret scan: zero findings.
- Protected financial modules match the completed Stage 3 source byte-for-byte.
- Representative migration/calculator parity tests remain exact.

Clean extracted-package verification and the final archive SHA-256 are reported with the delivered artifact.

## Remaining limitations

The documented Stage 3 P2/P3 limitations remain unchanged: older UI normalisers and specialised scalar controls still exist at compatibility boundaries; historical scenario snapshots remain read-only compatibility records; relationship data is both derived and persisted during transition; and revision hashes are deterministic change indicators rather than security primitives.
