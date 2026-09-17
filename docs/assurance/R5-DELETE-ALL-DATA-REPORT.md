# R5 Delete-All Data Report

The new `Delete all Financial Freedom data on this device` action is distinct from the existing narrow `Clear Saved Plan` action. It requires a confirmation dialog and removes only the exact keys and prefixes in `storage.js`; it never calls `localStorage.clear()`.

Removed: personal plans, legacy draft, last-saved metadata, scenarios, Weekly Plans and actual history, snapshots, user/plan context and durability reminders. Unrelated same-origin keys, downloaded files, external backups and provider/hosting records are not removed.

Race protection cancels known save/debounce timers, sets an in-memory deletion state and suppresses coordinator writes. A short-lived storage marker notifies other tabs; receiving tabs suppress stale writes and require an intentional new-plan or import action. The marker is then removed. A deliberate new plan or validated import resumes writes.

Known boundary: a suspended tab that does not receive browser storage events until much later is browser-dependent. On receipt, stale writes are suppressed; this is not account-style locking.

