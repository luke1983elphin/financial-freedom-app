# Household and review UI verification

Baseline: GitHub main `2b9ecfd`.

Run `pnpm run verify` for the existing regression and security checks. Run `node scripts/verify-household-ui-browser.mjs` with `FFS_PLAYWRIGHT_MODULE` pointing to an installed Playwright `index.mjs` and Microsoft Edge available for the browser checks. Optionally set `FFS_PREVIEW_URL` to repeat the interaction checks against a deployment.

The browser script checks continuous name typing with the same DOM node and focus, deletion, inserted clipboard-style text, name propagation and blank fallbacks, reload persistence, decimal assumption entry, advanced disclosure, navigation preference persistence, and page overflow at 1440, 1920, 768, 375 and 430 pixels. It captures collapsed and expanded screenshots and rejects browser errors and warnings. Local runs compare the entire calculator result to the unchanged baseline for identical inputs; the existing suite additionally checks nine deterministic financial fixtures.

Only presentation assertions and their exact source hashes were updated. The `commitLinkedSetup` hash was already stale on GitHub main; it now matches that baseline function, whose implementation is unchanged here. Financial engine, tax, projection, persistence and schema files are unchanged. Numerical regression assertions are unchanged.

Mobile checks use browser viewport emulation, not physical iOS or Android devices.
