# Clear-Down Branch Regression Completion Report

Generated: 2026-08-02

## Scope Confirmed

This regression pass covered the clear-down branch package after the final Weekly Plan adjustment. The two earlier presentation changes were not repeated.

## Files Changed

- `app.js`
  - Removed the duplicate top-level Weekly Plan live balance card from the normal This Week view.
  - Kept the live balance check inside Step 5 - Complete Week.
  - Updated the Dashboard mission card so the collapsed state shows one current recommended action only.
  - Changed the Dashboard mission recommended action from a second Weekly Plan button into display-only text, leaving one primary Continue Weekly Plan button.
- `styles.css`
  - Added subdued styling for completed dashboard task rows.
  - Added non-click cursor styling for the display-only recommended-action row.
- `tests/engagement.test.ts`
  - Added regression coverage for the Step 5-only live balance card.
  - Added regression coverage for the compact Dashboard mission behaviour.
- Root `package.json`
  - Updated the root test script to delegate to the tested clear-down package.
  - Added root `test:audit` delegation to the tested clear-down package.
- `FULL-REGRESSION-TEST-OUTPUT.txt`
  - Added full command output and exit statuses.
- `regression-evidence/*.png`
  - Added viewport screenshots for dashboard and Weekly Plan Step 5 checks.

## Commands Run

From repository root:

- `npm ci`
  - Could not run because `npm` is not available in this local shell.
- `pnpm install`
  - Passed. Already up to date.
- `pnpm test` with bundled Node on PATH
  - Passed. 50 tests, 0 failed.
- `pnpm run test:audit` with bundled Node on PATH
  - Passed. 19 tests, 0 failed.

From `outputs/financial-freedom-app-audit-calculations-and-data-flow-2026-27`:

- `pnpm test` with bundled Node on PATH
  - Passed. 50 tests, 0 failed.
- `pnpm run test:audit` with bundled Node on PATH
  - Passed. 19 tests, 0 failed.
- `node --check app.js`
  - Passed.
- `node --check calculator.js`
  - Passed.
- `node --check v2-data.js`
  - Passed.

Scripts checked:

- `lint`: not defined.
- `build`: not defined.
- `test:all`: not defined.
- `test:audit`: defined and passed.

Full raw output is included in `FULL-REGRESSION-TEST-OUTPUT.txt`.

## Manual Browser Workflows Tested

Local preview tested at `http://127.0.0.1:5197/`.

- Dashboard personal/blank state:
  - Continue setup state visible.
  - No `NaN` or `undefined` displayed.
  - No horizontal overflow.
- Dashboard full sample state:
  - Family sample loaded.
  - Financial Freedom Journey visible.
  - Weekly Mission visible.
  - Open/Continue Weekly Plan action visible.
  - No `NaN` or `undefined` displayed.
- This Week's Mission:
  - Collapsed Dashboard mission shows the current recommended action only.
  - Collapsed Dashboard mission does not render `.dashboard-task-list`.
  - Remaining count excludes the current recommended action.
  - Expanded Dashboard mission shows remaining unfinished actions first.
  - Completed actions are supported in subdued styling.
  - One primary Continue Weekly Plan button remains.
- Future You:
  - Tested selected ages 45, 55 and 65.
  - Values updated without console errors or overflow.
- Weekly Plan Steps 1-5:
  - Step 1 timing review collapsed after review.
  - Step navigation worked for Opening, Income, Bills, Savings & Transfers and Complete.
  - Only Step 5 rendered a live balance card.
- Opening balance, income, bills, savings and transfers:
  - Opening bank balance updated through the intended Update opening balance control.
  - Income actual input accepted values and retained focus.
  - Bills actual input accepted one-digit-at-a-time entry and retained focus.
  - Actual `$0` entries remained `$0` and did not fall back to planned values.
  - Savings and transfer actual fields accepted zero values and retained focus.
- Live closing balance and reconciliation:
  - Opening `$2,500`, income `$1,000`, outflows `$417`, transfers `$0`.
  - Calculated closing balance displayed `$3,083`.
  - Entered bank balance `$3,050`.
  - Reconciliation difference displayed `-$33`.
- Completing and reopening a week:
  - Planner start date moved to current-week range through Settings.
  - Week 1 completed through Complete Week.
  - Week 2 inherited Week 1 actual closing balance of `$3,083`.
  - Week 1 remained viewable and editable through completed-week controls.
- Major navigation:
  - Financial Plan, Dashboard, Weekly Plan, Investments, Super, Goals, Decision Engine, Reports, Saved Scenarios and AI Coach opened without console errors.
- Responsive checks:
  - Dashboard checked at 375 px, 430 px, 1366 px and 1920 px.
  - Weekly Plan Step 5 checked at 375 px and 430 px.
  - No horizontal overflow found.
  - Step 5 balance labels and values stayed within their cards.

## Browser Errors Found

No app JavaScript console errors were found during the final browser checks.

## Calculation Differences Found

No calculation output differences were introduced by this clear-down pass.

Automated tests continued to cover:

- tax and Medicare;
- Medicare Levy Surcharge;
- individual STSL calculations;
- employer and concessional super;
- rental income and rental-loan principal treatment;
- dividend, interest and passive-income treatment;
- cash and weekly surplus;
- assets, liabilities and net worth;
- Financial Freedom percentage;
- Future You projections;
- saved records and snapshots.

## Unresolved Issues / Caveats

- Plain `npm ci` could not be executed in this local shell because `npm` is not installed or not on PATH. The available package manager was `pnpm`, and all requested runnable scripts passed with bundled Node on PATH.
- No `lint`, `build` or `test:all` scripts are defined in the checked `package.json` files, so they were not run.
- The workspace root is not a Git repository in this environment, so no merge was performed and no branch metadata could be verified here.

## Merge Recommendation

Safe to merge from a functional regression perspective, subject to normal repository review and deployment checks in the actual Git/Vercel environment.

