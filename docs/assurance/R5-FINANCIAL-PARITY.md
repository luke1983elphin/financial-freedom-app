# R5 Financial Parity

Baseline: accepted R4A source ZIP SHA-256 `4966BA758E6DDA248550C88DA4EBE0A194AAE5627B9BB815DCFA422BA7B3F563`.

R5 changes browser persistence, recovery, deletion and privacy/consent wording only. `calculator.js`, `semiRetirementProjection.js`, `weekly-plan.js` and `weekly-planner-export.js` are protected from formula edits. The final report will record before/after hashes and the exact seven-sample numerical parity command/result.

Command: `node scripts/r1-numerical-parity.mjs ..\r4a-exact-source-verify2-20260908`

Result: exact parity passed for all 7 fictional sample plans and all 14 required metrics. The comparison artifact is kept in the private evidence package.

| Protected file | Identical SHA-256 |
|---|---|
| `calculator.js` | `02101A14BACCC8010C8B607F5435F016989D46EE899F13FF88E39AC59A10D08B` |
| `semiRetirementProjection.js` | `B114BF99017C349BF2AF9A87D58E9F3D15ADAB47F602F6493B1A721F053F2FB4` |
| `weekly-plan.js` | `D0E40CB914C21170D79818144BB84D75F10E520B13F28C23EBEB59A888D6FA5E` |
| `weekly-planner-export.js` | `F0F6E4C82F4EA81039502D83C95EFE88D68ECD460B5F7BDE78AE3AE55DB7EE80` |
| `security.js` | `19CAA32B797A87C7DDBBE4C7352717CE1F7DF52E7292A0DE529449C24F7BAA4B` |
| `vercel.json` | `AA4509D3A72DCD54185557E18D1DAE79863EFB6D474E1B8DDC1723B3BDDA5F86` |
