# Additional super contributions

## Investigation

The exact reported $20,000 → $16,825 incident was not reproduced. No evidence established inflation, contribution caps or duplicate transactions as its cause. The existing input handler invalidated stored results on typing but left the previous forecast visible until a later render. All retirement inputs now hide that obsolete forecast immediately and show a recalculation notice. Typing updates the draft without rebuilding the plan forecast; calculation remains explicit. Existing Today's Dollars/Future Dollars methodology is unchanged. The annual contribution breakdown exposes actual nominal gross transactions as well as values in the selected display basis.

## Model and compatibility

Each person can hold independent personal deductible, salary sacrifice and personal after-tax arrangements. One-offs use nominal dollars in the selected financial year. Annual amounts default to fixed nominal dollars, optionally growing with scenario CPI from their commencement year. Contributions stop before the nominated age, and the editor displays the final financial year. Multiple arrangements can share a year.

Personal deductible contributions use household cash once, reduce eligible modelled taxable income and incur 15% contributions tax. Salary sacrifice reduces cash employment income and taxable income once, respects available employment income, and leaves the employer SG base intact. My Plan salary packaging is reported separately from scenario salary sacrifice. Personal after-tax contributions use cash once, receive no deduction and incur no standard contributions tax. Existing cash withdrawal and midpoint investment growth conventions apply. An unfunded contribution/spending combination is explicitly invalid, with the shortfall disclosed.

Deductible contributions and salary sacrifice are added back for STSL repayment income and the MLS income threshold; the MLS surcharge base remains taxable income. The existing tax engine calculates income tax and Medicare levy. Standard financial-year cap warnings combine employer SG and all concessional arrangements; non-concessional amounts are assessed separately. Caps do not automatically truncate contributions.

Legacy recurring amounts were already personal deductible contributions. Migration retains that treatment, fixed nominal amount, and the original employment/semi-retirement stop conditions. Advanced legacy one-offs retain their person, financial year, gross nominal amount and personal deductible treatment. Deterministic IDs make migration idempotent. An explicit `superContributions` array owns voluntary contributions, including an empty array after removing all entries; retained legacy fields are compatibility data and are never added again. Existing raw plans/backups remain readable without destructive rewriting. Saved snapshots are migrated in their editable copy; stored snapshots and My Plan are preserved.

## Memory regression and performance

The initial implementation added five empty contribution fields to every person/year row. This created 8,860 differences in the existing 12.2 MB golden fixture. Node exhausted memory formatting the failed deep-equality assertion. There was no recursive forecast update or repeated calculation loop. Empty fields are now omitted, preserving exact historical output and avoiding unnecessary allocation. All nine golden fixtures remain byte-for-byte identical, including their numerical results.

Three complete fixture captures per fresh Node process, with the same runtime and no memory-limit changes:

| Measurement | Unchanged baseline | Updated model |
|---|---:|---:|
| Median fixture capture | 1,219 ms | 1,234 ms |
| Peak RSS | 247,660 KiB | 254,876 KiB |
| Serialised output | 12,208,872 bytes | 12,208,872 bytes |
| SHA-256 | `648c1146afe49a37f811c1456d21a5c561b960bd7edc747f982e5f49c0e14542` | same |

The 1.2% time and 2.9% RSS differences are small for this local measurement. Growth Scenarios passes all 38 tests after the correction.

## Verification and limitations

Full `pnpm verify` passed: 1,390 tests across 72 suites, with no failures or skips, plus syntax, security, inventory and runner checks. The affected model, migration, display and protected-fixture tests also passed after final cleanup.

New engine regressions cover immediate $20,000 entry, clear/re-entry, edits/removal, concurrent types and years, future recurring starts, stop ages, CPI, tax/cash reconciliation, employment cessation, SG, STSL/MLS, baseline salary packaging, cap warnings, invalid funding, validation and idempotent migration. Browser acceptance covers desktop (1366px), tablet (768px), iPhone (390px), focus, dollar-basis switching, obsolete forecast hiding, saved scenarios, backup validation/import, reopening and comparison PDF generation.

The complete existing browser run and targeted reruns cover 99 workflows. Eleven initial failures came from existing expectations for automatic dashboard startup, the old hidden mobile sample disclosure, three comparison rows, a previously fixed property PDF amount, and Linux-only Chromium/PDF paths. Representative failures reproduced on the unchanged baseline. Tests now follow the existing Continue and sample-card flows, preserve every original comparison value while allowing current detail rows, and support installed Windows browsers and an optional Python PDF extractor. All failed cases were rerun successfully; no app navigation or design changes were made for them. Temporary implementation/diagnostic scripts and generated changes to unrelated evidence were removed.

The model assumes eligibility for personal deductions and contributions; it does not verify notices of intent, work tests, unused carry-forward caps, bring-forward arrangements, total super balance restrictions, Division 293, excess contribution taxes or every adjusted-income circumstance. Cap warnings are modelling guidance and do not establish legal eligibility. The exact original intermittent incident remains unconfirmed.
