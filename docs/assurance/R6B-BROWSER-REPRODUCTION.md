# R6B Browser Reproduction

## Before correction

The accepted blocked-R6 browser evidence recorded:

- Taylor gross salary: `$3,500` fortnightly;
- Morgan gross salary: `$2,800` fortnightly;
- structured Financial Plan frequencies: fortnightly / fortnightly;
- Weekly Plan rows: annual / annual;
- Week 1: full annual estimated net income.

Taylor's timing row was then deliberately edited in the timing editor. That saved user-owned row was retained by R6B, as required.

## After correction

Local browser: `http://127.0.0.1:5200/` using a fresh origin and fictional data.

- Financial Plan: Taylor `$3,500` fortnightly; Morgan `$2,800` fortnightly.
- Annual gross household income remained `$163,800`.
- Weekly Plan: Taylor estimated net pay `$2,745` fortnightly.
- Weekly Plan: Morgan estimated net pay `$2,269` fortnightly.
- Week 1 planned money in: `$5,013` (whole-dollar UI display).
- The annual net amount was not posted as a weekly receipt.

Mixed-frequency follow-up changed the canonical records to Taylor weekly and Morgan monthly. Only the untouched generated timing rows changed. Both rows displayed `Review required` with their specific old and new frequencies. The browser console contained zero warnings or errors.

Compatibility check at `http://127.0.0.1:5198/` confirmed the pre-existing saved/user-edited annual rows remained annual after loading R6B.

Physical iPhone/Android testing remains part of open R6-F3/R6-F5 and was not claimed in R6B.
