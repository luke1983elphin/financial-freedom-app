# R6C Financial Parity

## Baseline

Accepted R6B extraction:

`C:\Users\Elphin Accounting\Documents\Codex\2026-06-26\i\r6b-clean-verify-20260908-194000`

Accepted source ZIP SHA-256:

`B47F5C650B80682AD3C064EBFC1416F547454E7619238AC3134E708A49459FC9`

## Established calculator parity

Command:

```text
node scripts/r1-numerical-parity.mjs C:\Users\Elphin Accounting\Documents\Codex\2026-06-26\i\r6b-clean-verify-20260908-194000
```

Result: exact parity for seven fictional plans and all fourteen required financial metrics.

## Retirement projection parity

Command:

```text
node scripts/r6c-retirement-parity.mjs C:\Users\Elphin Accounting\Documents\Codex\2026-06-26\i\r6b-clean-verify-20260908-194000 docs\assurance\evidence-r6c\R6C-RETIREMENT-PARITY.json
```

The comparison checks identical projection inputs and deep equality of every property in every annual projection row. It passed for all seven fictional sample plans and the Taylor/Morgan staggered-retirement fixture.

Taylor/Morgan remained:

- first household transition year: 2046;
- household full-retirement year: 2048;
- unrounded transition funding: `$70,401.54`;
- displayed transition funding: `$70,402`.

Detailed hashes and values are in `evidence-r6c/R6C-RETIREMENT-PARITY.json` and `evidence-r6c/R6C-SEVEN-PLAN-FINANCIAL-PARITY.json`.

