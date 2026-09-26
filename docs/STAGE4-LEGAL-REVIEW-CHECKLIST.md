# Stage 4 External Legal Review Checklist

This is an issue checklist, not legal advice or legal approval.

## Required before public launch

- [ ] Confirm the operator's legal/business name, ABN/ACN if applicable, physical or service address and monitored contact email.
- [ ] Select the governing Australian State or Territory and approve the jurisdiction clause.
- [ ] Review whether the app, its Decision Engine, reports, scenarios and wording constitute general information, personal advice or another regulated financial service.
- [ ] Review Australian financial-services licensing, authorised-representative and disclosure obligations.
- [ ] Review Australian Consumer Law representations, guarantees, exclusions and limitation-of-liability wording.
- [ ] Confirm Privacy Act / Australian Privacy Principles applicability and the correct complaint/escalation route.
- [ ] Confirm whether hosting request logs, security logs or Vercel services collect personal information, where it is processed, and retention/deletion periods.
- [ ] Confirm the description of local browser storage, device access risk, browser clearing, backup responsibility and downloaded backup files.
- [ ] Confirm that no user account, cloud plan storage or analytics is active in the release configuration.
- [ ] Confirm the AI-disabled wording. Before any later AI enablement, separately approve provider identity, data fields, purpose, overseas disclosure, retention, consent and opt-out wording.
- [ ] Review tax, STSL, Medicare, MLS, superannuation, property, debt and projection disclaimers and the selected financial-year disclosure.
- [ ] Confirm the age/capacity requirement and whether minors may use the app.
- [ ] Review intellectual-property, acceptable-use, suspension and service-availability clauses.
- [ ] Approve how policy changes are notified and whether fresh consent is required.
- [ ] Confirm accessibility and consumer-support contact processes.

## Current behavior to verify against the drafts

- Core plan data is stored in browser storage on the user's device.
- Complete-plan backups are downloaded files controlled by the user.
- Delete-all removes app-managed local data but cannot remove downloaded files or hosting/security logs.
- No user account or cloud plan synchronisation is present.
- No analytics has been authorised for this release candidate.
- AI is disabled by the exact server-side gate and is not used during normal plan workflows.
- Ordinary hosting providers may receive request metadata even when plan data remains local.
- Financial outputs are educational estimates driven by user data and assumptions.

## Unresolved placeholders

- `[insert Australian State or Territory following legal review]`
- `[insert business name and contact email before release]`
- `[insert business name and privacy contact email before release]`

Legal readiness remains `FAIL` until these items are resolved and the final pages receive external Australian legal/regulatory approval.
