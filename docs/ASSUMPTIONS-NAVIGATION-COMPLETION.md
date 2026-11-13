# PR #60 — Dedicated Assumptions workspace

Branch: `ui/assumptions-dedicated-workspace`  
Starting PR commit: `aca41aad1fee0959efed420d946b4648a194143c`  
Specification: [implementation brief](ASSUMPTIONS-NAVIGATION-IMPLEMENTATION.md)

## Independent navigation assessment

The existing application already mounts one assumptions editor and one growth comparison inside a separate `data-view-panel="assumptions"`. It is not mounted in Retirement. The discoverability problem was the sidebar entry below Forecast values: that button used `data-assumptions-open` instead of the shared navigation contract.

The five core tabs and other More tools destinations use `data-view`, delegated click handling, `navigateToSection`, `showWorkspace` and `setView`. The shared path selects one panel, updates active classes and `aria-current`, marks More tools as containing the active view, returns focus to its disclosure summary, and scrolls the workspace into view. The assumptions installer previously supplied separate active-state handling because its old entry was outside that shared system.

Workspace navigation has no URL router or browser-history entries. `activeView` is in memory and included in existing UI snapshots; `#privacy` and `#terms` are handled separately. Adding a router would expand scope and change existing semantics, so this implementation preserves history, deep-link behavior and the shared routing functions unchanged.

Two conflicts were addressed: the old special entry would duplicate the new tile, and the existing `.fa-nav` width/margin rule was unsuitable for a More tools tile. The original wrapper's bespoke active-state logic was redundant once Assumptions used `data-view`. Its editor/comparison synchronization is retained.

## Implementation

- Kept Home, My Plan, Goals, Retirement and Weekly in their original order, with unchanged destination IDs and markup.
- Added Assumptions as the first icon tile under More tools, followed by Try a Change, Investments, Super, Reports and Saved Scenarios.
- Removed the old sidebar entry below Forecast values. The Today's/Future dollars controls retain their location and global behavior.
- Reused the existing dedicated panel, single editor mount and single session comparison. Existing Edit in Assumptions field shortcuts remain available.
- Kept the comparison action integrated into the editor header and added the Plan Assumptions label.
- Added What These Affect beside Save: saved-plan forecasts, individual asset precedence, plan-linked retirement rules, independent retirement snapshots, temporary comparisons, wage-growth scope and the illustrative withdrawal rate. Sample mode explicitly explains that applying edits updates only the sample preview.
- Preserved Essential/Advanced sections, validation, Save/Undo/Restore, persistence behavior and comparison state across navigation/redraws. No new leave-page warning or confirmation flow was added.
- Fixed the discovered sticky-header overlap with an Assumptions-only scroll margin. Other workspaces retain their existing scrolling behavior.
- Disabled automatic Git deployment for this exact branch in `vercel.json`, retaining the existing restriction for the earlier mobile branch. No other branch's deployment behavior changes.

The calculator, retirement engines, protected functions, forecast assumptions adapter, growth overlay/view, dollar-basis logic, storage/schema, defaults/sample data, and golden fixtures are unchanged. The navigation test helper now expects the specified sixth More tools tile; its five-primary-tab contract is unchanged.

## Verification

- `pnpm verify`: **63 suites; 1,247 passed; zero failures/skips**. Syntax, inventory, CSP/security, runner/scanner checks, protected hashes and golden regressions pass.
- `pnpm test:browser`: **52 passed; zero failures/skips**, in 143.2 seconds. The two new navigation workflows additionally passed a focused evidence-capture rerun (10.0 seconds).
- Visual review and screenshots completed at all five specified viewport widths, plus mobile/desktop comparisons. No runtime/CSP errors or horizontal overflow were found.
- `git diff --check`: passed. Direct comparison to the starting PR confirms the financial engines, assumptions adapter, growth modules, dollar conversion, storage/schema, defaults and all fixtures are unchanged.
- Remote CI and Draft/deployment status are checked after pushing, with results linked in PR #60.

Two new browser workflows cover:

1. All five main tabs and six More tools routes at 375, 390, 430, 768 and 1366px; one active panel; keyboard activation; More tools focus return/active state; no duplicate mounts or old entry; readable scope copy; no overflow; visible headers; unchanged plan/complete forecast; unchanged browser history.
2. Navigating away/back with unsaved assumption and comparison edits; retained dirty status; unchanged saved financial plan; undo; explicit zero save; restore-defaults staging; round trips through all existing More tools destinations.

The full existing browser suite also exercises sample isolation, opened retirement snapshot independence, validation/storage failures, both dollar bases, comparison overlays, saved plan persistence and financial/report workflows. Visiting Reports retains its pre-existing automatic history/snapshot behavior; navigation is not represented as making all browser storage immutable.

## Screenshots and layout review

| Viewport | Dedicated workspace |
| --- | --- |
| 375px | [Phone](assumptions-navigation/workspace-375.png) |
| 390px | [Phone](assumptions-navigation/workspace-390.png) |
| 430px | [Phone](assumptions-navigation/workspace-430.png) |
| 768px | [Tablet](assumptions-navigation/workspace-768.png) |
| 1366px | [Desktop](assumptions-navigation/workspace-1366.png) |

Growth comparison evidence: [375px](assumptions-navigation/comparison-375.png), [1366px](assumptions-navigation/comparison-1366.png).

These are Chromium viewport tests and visual reviews, not physical-device Safari tests. Real sticky-header visibility is asserted before capture; the unrelated site header is temporarily made static only while taking full workspace crops to avoid Chromium painting it over the evidence, then restored. The existing responsive five-tab layout is preserved. Phone assumptions fields stack; desktop uses the existing two-column grid. The scope explanation remains next to the save controls. The comparison keeps its existing responsive cards and accessible table.

## Limitations and merge readiness

- Workspace navigation remains the existing in-memory/UI-snapshot system. This PR does not introduce bookmarkable workspace URLs or Back/Forward tab navigation; existing history and policy links are preserved.
- Saved retirement scenarios keep independent snapshots. The wording deliberately does not promise universal propagation of global changes.
- Existing financial modelling and legacy projection limitations remain unchanged.
- **Merge-readiness assessment:** no known functional blockers after complete local verification. Ready for owner review, subject to remote CI. Review screenshots and the branch-specific no-deployment setting before approving a merge. Keep PR #60 Draft; do not merge or deploy during this task.
