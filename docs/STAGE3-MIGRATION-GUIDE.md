# Stage 3 Migration and Compatibility

## Load and import

All loaded plans pass through `FFSPlanSchema.migrate()` before becoming live application state. Migration is deterministic and idempotent.

Supported inputs include:

- scalar salary fields with weekly, fortnightly, monthly and annual frequency;
- one-person and couple households;
- legacy assets and liabilities;
- home and mortgage records;
- linked rental property, rental income and rental loan records;
- linked investments, dividends/distributions and investment loans;
- person-specific super balances and zero-super confirmations;
- expenses and goals;
- saved Decision and Retirement scenarios;
- Weekly Plan/report metadata;
- sample plans and complete backups.

Existing collection IDs are preserved. Missing IDs receive deterministic IDs, duplicate IDs receive deterministic suffixes, and existing `person1`/`person2` ownership remains valid.

## Failure safety

Complete backup import follows this sequence:

1. security and size/version checks;
2. canonical migration in memory;
3. invariant validation;
4. scenario and Weekly Plan migration;
5. one coordinated R5 storage batch.

If migration or validation fails, the current open plan is not replaced and no partial import is reported as successful.

## Legacy output

Compatibility is one-way:

`legacy input -> canonical plan -> cloned compatibility projection -> existing engine/report consumer`

The legacy projection is never persisted as a second live plan and is never written into canonical state during rendering.

## Scenario migration

Decision adjustments become typed events. Existing Retirement Planning event structures are adapted to the same overlay envelope and continue to be processed by the existing retirement adapter/engine. Existing scenario plan snapshots and calculated outcomes are preserved.

Stage 3A also recognises deterministic historical `changedInputs` rows. Exact supported labels and saved numeric values become typed events. Rows whose meaning or value cannot be established without guessing remain in `legacyProvenance.changedInputs` with `status: "read-only"`; their display history is retained and no financial event is invented.

Relationship migration now records and removes unknown contracts, incompatible endpoints and duplicate-ID ambiguities while retaining all underlying financial entities. Goal targets are single-cardinality and survive link, unlink, relink, save, reload and backup import without being recreated from stale compatibility fields.
