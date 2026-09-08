# R4A Import Validation Report

## Import paths hardened

- Complete Financial Freedom plan backup import in `app.js`.
- Weekly Plan backup import in `app.js` and `weekly-plan.js`.

Both paths now parse through `FFSSecurity.parseJsonImport` and validate data before replacing current state.

## Controls

| Condition | Behaviour |
|---|---|
| Invalid JSON or wrong root type | Clear rejection; current plan is retained |
| Unsupported schema version | Rejected before migration |
| Non-object plan or invalid scenarios/weeks/UI sections | Rejected |
| Deep or very large object graph | Rejected at depth 40 or 100,000 nodes |
| Excessively long string | Rejected above 250,000 characters per string |
| Non-finite/extreme number | Rejected; absolute numeric limit is `1e15` |
| Invalid export date | Rejected |
| `__proto__`, `constructor`, `prototype` keys | Rejected recursively |
| Oversized file | Rejected before `FileReader` above 5 MiB |
| Malicious-looking display strings | Stored as data and escaped when rendered |

The 5 MiB limit is deliberately well above ordinary formatted JSON exports while bounding memory use before parsing. The exact boundary is tested: 5 MiB is accepted by the byte check and one byte over is rejected.

## Preservation behavior

Parsing and validation complete before confirmation and before assignment to `plan`, `weeklyPlan`, scenarios, snapshots or UI state. A failed import updates the user-facing save status and does not overwrite the current working plan. Local-browser testing imported a prototype-pollution fixture and confirmed rejection, unchanged current-plan display and no global-prototype mutation.

## Compatibility

Legacy exports with no schema version remain accepted and continue through existing migration functions. R4A did not redesign the stored data model. Corrupt existing `localStorage` recovery is outside this file-import stage and remains part of the later R5 durability/privacy review.
