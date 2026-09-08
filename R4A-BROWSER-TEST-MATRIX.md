# R4A Browser Test Matrix

## Evidence levels

| Surface | Status | Evidence |
|---|---|---|
| Source/DOM tests | PASS | R4A automated tests and browser-security verifier |
| Local real browser | PASS WITH LIMITS | In-app Chromium browser against local static server |
| Vercel preview | NOT AVAILABLE / NOT AUTHORISED IN THIS RUN | No deployment was created or changed |
| Physical device | NOT AVAILABLE | iPhone/Android hardware not connected |

## Responsive local-browser matrix

| Viewport | Result |
|---|---|
| 375 x 667 | No page-level horizontal overflow; content and navigation visible |
| 390 x 844 | No page-level horizontal overflow; visual screenshot inspected |
| 430 x 932 | No page-level horizontal overflow |
| 768 x 1024 | No page-level horizontal overflow |
| 1024 x 768 | No page-level horizontal overflow |
| 1366 x 768 | No page-level horizontal overflow |
| 1440 x 900 | No page-level horizontal overflow |
| 1920 x 1080 | No page-level horizontal overflow |

The Workspace navigation retains its pre-existing contained horizontal scroll at narrow widths; the document itself does not overflow.

## Workflows exercised in the local browser

- Loaded fictional Young Couple sample; demo banner and personal-plan protection remained visible.
- Opened Dashboard, Investments, Super, Goals, Decision Engine, Retirement Planning, Saved Scenarios, Weekly Plan and Reports; the selected panel became active.
- Dashboard calculations and cards rendered; investments, super and goals data remained visible.
- Weekly Plan opened with timing controls present.
- Replaced Person 1 name with `<svg onload=alert(1)>`; it rendered as text, created no SVG/script/event-handler element and did not change the same-origin script set.
- Imported a fictional prototype-pollution JSON fixture through the actual file picker; import was rejected, the existing plan remained visible, and `Object.prototype` was unchanged.
- Browser console had zero errors and zero warnings during the exercised candidate workflows.
- Runtime scripts and styles were all same-origin.

## Automated workflow evidence

- Stage G2H tests cover comparison/report content and print-mode behavior, including two-, three- and four-scenario selections.
- R4A tests cover inert report strings and normal JSON export/import round trips.
- Existing full regression covers calculations, plan migration, sample data, scenarios, Weekly Plan, Retirement Planning and report generation.

## Pending real-environment checks

- Actual Vercel response headers and CSP report-only violations.
- Native print dialog and generated PDF page-break inspection in a deployed preview.
- Physical iPhone Safari and Android keyboard/touch behavior.
- Full browser save/open/compare sequence for Saved Scenarios rather than source/automated coverage alone.
