# PR #67 welcome-screen investigation

## Finding

No welcome-screen regression was reproduced. PR #67's welcome markup, saved-plan detection, handlers, recovery and backup code are unchanged from main (`02054bf`, including PR #66). The Stage 3 welcome presentation block is also unchanged; PR #67 only changes that module's Investments summary. Its new CSS is scoped to Investments and retirement assumption cards.

With a valid personal plan saved on the same origin, main and PR #67 both show the original **Continue Your Plan** panel, with **Continue**, **Start New Plan** and **Load Sample Plan**. Its HTML, computed styles and geometry match main exactly at 375, 390, 768, 1024 and 1366px. The captured panel PNGs are byte-identical at all five widths. No returning-user design or production welcome code was changed by this investigation.

With no valid saved plan on that origin, both versions show the existing first-time visitor experience: Start My Plan and the secondary sample-plan path. The UI must not invent a Continue action for a plan that the current origin cannot read.

## Origin explanation

The existing successful PR #67 deployment points to commit `88e1cc9` at:

`https://financial-freedom-45mtivl9d-financial-freedom.vercel.app`

This is a different browser origin from the production domain, and a different hostname from other deployment-specific preview URLs. Browser local storage is scoped to **scheme + hostname + port**, and also belongs to a particular browser/profile. A plan saved on production, another preview hostname, Safari, a separate browser profile or a private window will not automatically appear in this preview's storage.

An automated reproduction saves plan A on one local hostname, opens the identical app on a second hostname and sees the first-time screen, then saves a separate plan B there. Returning to the first hostname restores plan A and Continue. Neither origin overwrites or sees the other origin's plan. This demonstrates the reported symptom without any application-code regression.

Read-only checks of the existing preview's public `app.js`, `storage.js` and HTML found them byte-identical to PR #67's source: [live asset evidence](welcome-investigation/live-preview-assets.json). No deployment was needed for this check.

The user's actual local-storage contents were not inspected or changed. Therefore a specific device's stored-record condition cannot be asserted here. The observed difference is consistent with the preview having empty, separate storage; the tests confirm the expected behavior when a valid record is present.

## How to verify without changing the design

1. Open the **exact original site address** where the plan was saved, using the same device and browser/profile. Do not clear site data or switch to private browsing. Reload it; a valid saved plan should show Continue Your Plan.
2. Open the PR preview URL. If no plan has been saved on that origin, the first-time screen is expected. This does not mean the original plan was deleted.
3. To test returning-user behavior on an empty preview without using production data, explicitly save a disposable test plan using the preview's normal controls, then reload **that same preview URL**. It should show the original Continue panel. Continue should reopen the saved plan.
4. Return to the original site to verify its plan remains available. Changing a hostname, scheme, port, browser or profile changes the storage context. Use the existing backup/export/import features if deliberately transferring a plan; the app does not transfer or replace plans automatically.

If Continue is missing on the same original origin/profile despite a valid saved record, that would need a separate device/data-specific investigation. Do not force the panel visible or clear the stored data as a workaround.

## Coverage added

- First-time and returning visits at all five widths, with actual existing input/autosave handlers creating the saved plan.
- Exact main-versus-PR panel markup, geometry and computed design comparisons, plus paired screenshots.
- Saved record bytes unchanged by opening, reloading and Continue navigation.
- Sample-plan loading and return preserve every financial input. The original sample flow checkpoints the personal draft, so normal save/UI/engagement metadata may update; this behavior is unchanged.
- Different-origin storage isolation, separate plans on each origin, and return to the original origin.
- Valid legacy-plan recovery, and preservation of a corrupt namespaced copy while the existing valid legacy fallback still offers Continue.

[Source/design parity evidence](welcome-investigation/source-and-design-parity.json), [main test evidence](welcome-investigation/main-verification.json), [PR test evidence](welcome-investigation/pr67-verification.json).

| Returning panel | Main | PR #67 |
| --- | --- | --- |
| 375px | [Main](welcome-investigation/main/returning-375.png) | [PR](welcome-investigation/pr67/returning-375.png) |
| 390px | [Main](welcome-investigation/main/returning-390.png) | [PR](welcome-investigation/pr67/returning-390.png) |
| 768px | [Main](welcome-investigation/main/returning-768.png) | [PR](welcome-investigation/pr67/returning-768.png) |
| 1024px | [Main](welcome-investigation/main/returning-1024.png) | [PR](welcome-investigation/pr67/returning-1024.png) |
| 1366px | [Main](welcome-investigation/main/returning-1366.png) | [PR](welcome-investigation/pr67/returning-1366.png) |

## Verification and scope

The three new browser cases pass against both unchanged main and PR #67. **Complete `pnpm test:browser`: 78 passed, zero failures. `pnpm verify`: 1,298 regression tests passed across 67 suites, with all inventory, syntax, security, protected-hash and runner checks green.** This follow-up adds tests and investigation evidence only: no application, styling, storage, recovery, backup or financial-model change. No further deployment or merge is performed. PR #67 remains Draft.
