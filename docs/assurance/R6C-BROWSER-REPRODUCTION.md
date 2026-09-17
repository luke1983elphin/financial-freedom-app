# R6C Browser Reproduction

## Environment

- Local cache-free HTTP origin serving the R6C candidate.
- In-app Chromium browser.
- Fictional two-person Taylor/Morgan plan entered through the actual setup UI.
- No browser console warnings or errors after calculation.

## Before correction

The blocked resumed-R6 browser run showed:

- `Semi-retire: No semi-retirement phase`;
- `Fully retire: Not modelled`;
- Taylor fully retires in 2046;
- Morgan fully retires in 2048;
- `Semi-Retirement Funding: $70,402 total`.

This output is retained in `R6-RESUMED-VALIDATION-BLOCKER-REPORT.md`.

## After correction

The same fictional inputs rendered:

- `Semi-retirement choice: None selected`;
- `Household retirement transition: 2046-2048`;
- `Fully retire: Age 60`;
- Taylor fully retires in 2046 at age 60;
- Morgan fully retires in 2048 at age 60;
- `Transition / Semi-Retirement Funding: $70,402 total`.

The visible browser accessibility tree was checked after the result rendered, and a viewport screenshot was captured in the task evidence. Browser developer logs contained zero warnings and zero errors.

The first local browser attempt mixed a newly served `app.js` with a cached older `semiRetirementUi.js`. It was discarded. Final evidence was collected from a cache-busted script URL on the preserved fictional-plan origin.

