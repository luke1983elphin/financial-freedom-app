# Stage 4 Controlled Beta Checklist

## Proposed beta

- Invite approximately 8-15 testers representing single-person, couple, homeowner, investor/property and approaching-retirement situations.
- Run for 3-4 weeks so testers can complete setup, return after a refresh and use at least two Weekly Plan cycles.
- Use fictional or deliberately minimised data where practical during the first week.
- Do not enable analytics or AI without separate approval and updated privacy/legal review.

## Tester workflows

- [ ] Start a new plan and reach a ready Dashboard.
- [ ] Add, edit and remove salary, home, mortgage, cash, investments and rental-property records.
- [ ] Confirm totals across Dashboard, Reports and Decision Engine.
- [ ] Create, edit, compare and reload a Decision Engine or Retirement Planning scenario.
- [ ] Generate a Weekly Plan, review timing, record actuals, complete a week and reopen it.
- [ ] Export a complete backup before any destructive test.
- [ ] Import that backup on the same browser or a second test device and verify key totals and links.
- [ ] Print or save representative Financial and Weekly reports as PDF.
- [ ] Exercise keyboard-only navigation and phone/tablet layouts.
- [ ] Confirm the app still works after closing and reopening the browser.

## Feedback to collect

- Time and number of corrections needed to complete initial setup.
- Labels or calculations that were misunderstood.
- Any duplicated entry or unexpected default item.
- Cross-screen values that appeared inconsistent.
- Weekly timing/editing friction and actual-versus-forecast clarity.
- Backup/import confidence and any recovery failure.
- Print/PDF clipping, blank pages or missing assumptions/disclosures.
- Device/browser, viewport, reproduction steps, expected result and actual result for every defect.
- Console error screenshot only when it contains no private financial information.

## Required tester notice

- This is an invited beta, not a public release.
- The legal pages are drafts and the app provides educational modelling, not advice.
- Data is stored in the browser on that device and can be lost if browser data is cleared.
- Export a current backup regularly and protect the downloaded file because it contains financial data.
- AI is disabled.
- Do not enter account numbers, tax file numbers or unnecessary identifying information.
- Report calculation, data-loss, security or material cross-screen inconsistencies immediately and stop relying on the affected result.

## Release management

- Use a protected beta deployment separate from production.
- Record the exact commit and archive SHA-256 used by testers.
- Keep a rollback deployment from the prior accepted release.
- Triage calculation, migration, durability and security defects as release blockers.
- Keep feature requests separate from beta-defect remediation.
- Re-run the full suite, verification and security scan for every beta candidate.
