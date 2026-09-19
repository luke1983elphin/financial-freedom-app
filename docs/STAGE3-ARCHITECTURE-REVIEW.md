# Stage 3 Read-Only Architecture Review

Review performed after implementation. No findings were changed during this review.

## P0

None identified.

## P1

None identified.

## P2

1. `ensureCollectionData()` and the older income/rental normalisers still mutate canonical records when legacy UI forms are prepared. They no longer synchronise collections into scalar fields during normal rendering, but should eventually be converted into load-boundary migrations and pure view-model helpers.
2. A few old scalar form controls remain writable because the protected calculators and some specialised screens still accept the legacy shape. Canonical collection edits are authoritative for itemised income/assets/liabilities/expenses; the remaining scalar controls should move to selectors/mutations in a later bounded stage.
3. Scenario plan snapshots remain stored for exact historical output compatibility alongside typed overlays. They are intentionally read-only representations, not a second live plan, but increase backup size.

## P3

1. Relationship records are currently derived as well as persisted. This is deliberate compatibility protection, though a future schema could store only relationships and remove link fields after all older consumers migrate.
2. Revision hashes use a deterministic non-cryptographic content hash. This is sufficient for stale-scenario indication, not security or collaborative version control.

## Conclusion

The principal dual-write issue has been removed from the render/calculation path. The remaining compatibility writes occur at explicit user-action boundaries or within older form normalisation, are documented above, and do not create a second persisted live plan.

