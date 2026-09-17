# R5 Save Failure and Recovery

R5 centralises browser writes in `storage.js`. JSON is serialised before any write, writes are read back, and related records use a documented best-effort batch. On a quota, denial, serialization or verification failure:

- the app does not advance the last-saved timestamp;
- the dirty in-memory plan remains open;
- a prior good stored plan is rolled back where the browser remains writable;
- the UI does not show `Saved` or `All changes saved`;
- the user is offered Export backup, Try saving again and Import an earlier backup.

Corrupt or unsupported local JSON is preserved in storage and is not auto-overwritten. Startup falls back only where a separately valid legacy record exists. Recovery choices are to continue the open in-memory plan, import a validated backup, or deliberately start a new plan. No cloud recovery is claimed.

Limitation: `localStorage` is not transactional. A browser/process crash or a storage backend that fails during rollback can leave related compatibility keys at different revisions. The canonical namespaced record and validation reduce this risk, but cannot provide database-style atomicity.

