# R6D Browser Reproduction

## Environment

- Local candidate served at `http://127.0.0.1:5202/`
- Codex in-app Chromium browser
- Fictional Taylor/Morgan saved plan
- Week 1: 14-20 September 2026

## Before correction

The accepted R6C build rendered completed Week 1 with enabled actual inputs, including Money in `$5,000`; `Edit Completed Week` count was zero and the normal `Save completed week` action was directly reachable.

## After correction

1. Completed Week 1 rendered a collapsed history summary. No actual input or five-step editor was present.
2. Expanding the summary showed recorded Money in `$5,000`, actual closing balance `-$248`, reconciliation details and `Edit Completed Week`.
3. Selecting Edit displayed the existing warning: `Editing a completed week may change the balances shown in later weeks.`
4. Dismissing the warning left the accessibility tree unchanged and the week read-only.
5. Accepting the warning displayed the edit notice and restored the saved Money in value.
6. A staged change from `$5,100` to `$5,200` updated the live closing estimate from `-$148` to `-$48`. Cancel restored the read-only result at `-$148`.
7. Repeating the edit and selecting `Save completed week` stored the `$5,200` result, returned Week 1 to read-only and changed Week 2's inherited opening balance to `-$48`.
8. Reloading the page retained the completed result and returned the week to read-only.
9. Browser console warnings/errors: none.

This was a local functional reproduction only. R6D authorises no deployment or production verification.
