# R5 Changed-File Manifest

Compared with accepted R4A source SHA-256 `4966BA758E6DDA248550C88DA4EBE0A194AAE5627B9BB815DCFA422BA7B3F563`.

## Runtime and UI

| File | Change |
|---|---|
| `storage.js` | New storage coordinator, verified writes, rollback, owned-key deletion and multi-tab suppression |
| `app.js` | Coordinator integration, backup/import flows, recovery notices, deletion flow, reminders and consent state |
| `index.html` | Storage script, durability dialogs/notices, backup/delete controls and policy placeholders |
| `styles.css` | Responsive durability, policy, dialog and action styling |
| `api/ai-insights.js` | Privacy wording correction only; strict server enablement gate unchanged |

## Test Infrastructure and Tests

| File | Change |
|---|---|
| `package.json` | Added R5 target and syntax coverage |
| `scripts/test-suites.mjs` | Registered R5 suite |
| `tests/data-durability-r5.test.mjs` | Added 24 durability, recovery, deletion, consent and boundary tests |
| `tests/financial-progress-history.test.mjs` | Updated source assertion for coordinated import batch |
| `tests/semi-retirement-integration-v1.test.mjs` | Updated source assertion for coordinated removal |

## Assurance Documents

Added the `R5-*` inventory, matrices, data-flow, recovery, deletion, privacy, consent, browser, parity, test-evidence, manifest and completion-report documents. Prepended R5 findings and decisions to `docs/assurance/FINDINGS.md` and `docs/assurance/DECISIONS.md`.

## Explicitly Unchanged

`calculator.js`, `semiRetirementProjection.js`, `weekly-plan.js`, `weekly-planner-export.js`, `security.js` and `vercel.json` are byte-identical to the accepted R4A baseline. No financial formula, projection semantic, tax rule, Weekly Plan calculation or deployment configuration was changed.
