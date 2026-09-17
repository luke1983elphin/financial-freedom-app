# R5 Test Evidence

Runtime: Node.js v24.19.0; pnpm 11.19.0.

## Commands Run

```text
pnpm install --frozen-lockfile
pnpm run test:r5
pnpm test
pnpm run syntax
pnpm run syntax:self-test
pnpm run test:r1-ai
pnpm run test:r3-blocker
pnpm run test:audit
pnpm run test:runner
pnpm run parity:self-test
pnpm run security:scan
pnpm run security:scan:self-test
node scripts/r1-numerical-parity.mjs ..\r4a-exact-source-verify2-20260908
pnpm run verify
```

## Results Before Final Packaging

| Check | Result |
|---|---|
| Dependency lock install | Passed; lockfile already current |
| R5 targeted tests | 24 passed, 0 failed |
| Full regression | 602 passed, 0 failed |
| R1 AI containment | 8 passed, 0 failed |
| R3 blocker tests | 44 passed, 0 failed |
| Calculation audit | 66 passed, 0 failed |
| Test runner self-test | 12 passed, 0 failed |
| Numerical parity self-test | 5 passed, 0 failed |
| Syntax and syntax self-test | Passed |
| Browser security verifier | Passed |
| Secret scan and self-test | Passed; zero findings |
| Genuine R4A numerical comparison | 7 fictional plans, 14 required metrics, exact parity |

The first full R5 run exposed two obsolete source-structure assertions that expected direct local-storage calls. Those assertions were updated to exercise the new coordinator path; no financial expected value was changed. The final full result was 602 passed and 0 failed.

The packaged-source clean-extraction results and archive hashes are recorded in the package hash manifest generated after packaging.
