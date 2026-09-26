# Canonical Plan Schema (Stage 3)

## Version

`planSchemaVersion: 3` is the canonical persisted plan version. The same value is recorded at `meta.schemaVersion` and in complete backup metadata.

## Document shape

The existing plan sections remain available for calculation compatibility, while these collections are authoritative for itemised data:

- `people`: stable household-member records. Existing IDs `person1` and `person2` are retained as stable compatibility IDs.
- `incomeItems`: income records with stable IDs and owner IDs.
- `assetItems`: asset records with stable IDs and owner IDs.
- `liabilityItems`: liability records with stable IDs and optional asset links.
- `expenseItems`: expense records with stable IDs.
- `goalItems`: goal records with stable IDs and optional target links.
- `relationships`: explicit links between assets, income, liabilities and goals.
- `meta.revision`: lightweight financial-plan revision number, hash and timestamp.

Weekly Plan state, report settings, assumptions and retirement data keep their existing structures. Stage 3 does not rewrite those engines.

## Relationships

Each relationship has a stable `id`, a `type`, and typed source and target references:

- `asset-income`: asset to income.
- `asset-liability`: asset to liability.
- `goal-target`: goal to asset or liability.

Existing compatibility fields such as `linkedAssetId` remain supported. Migration derives explicit relationships from them. The mutation API updates both the explicit relationship and the necessary compatibility reference until all older consumers have moved to selectors.

Stage 3A enforces this relationship contract:

- `asset-income`: asset to income;
- `asset-liability`: asset to liability;
- `goal-target`: goal to one asset or one liability.

Unknown types and incompatible endpoints are rejected for new mutations. Imports retain their financial entities but remove invalid relationships and record the repair. A goal has one authoritative target; relinking clears the superseded relationship and compatibility reference.

## Invariants

Validation checks:

- unique IDs within each canonical collection;
- valid owner IDs;
- existing relationship endpoints;
- compatible endpoint types;
- explicit schema version.

Safely repairable legacy issues are repaired during migration and listed in the migration report. Invalid relationship records are removed without deleting their source financial entities.

When duplicate imported IDs make a relationship endpoint ambiguous, migration preserves each financial entity, removes the ambiguous relationship/reference, records the ambiguity and requires explicit relinking. It does not silently attach the relationship to whichever duplicate retained the original ID.

## Calculation boundary

The live canonical plan is not rewritten during rendering. `legacy-plan-adapter.js` clones the canonical plan and creates a non-authoritative legacy-shaped projection for the existing calculator. The protected calculation engines remain unchanged.

## Revision semantics

`meta.revision.hash` describes financial plan content and excludes save timestamps and the revision itself. A durable save increments the revision number only when that content changes. Scenarios retain `basePlanRevision`; an older scenario remains usable but is marked as created from an earlier plan revision.
