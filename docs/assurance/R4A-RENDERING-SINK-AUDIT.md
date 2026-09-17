# R4A Rendering Sink Audit

## Scope and result

The audit covered `app.js`, `semiRetirementUi.js`, `weekly-plan.js`, `weekly-planner-export.js`, `index.html`, and the disabled AI results renderer. The application remains template-driven and contains 77 `innerHTML` assignments plus three `insertAdjacentHTML` calls. A wholesale renderer rewrite was explicitly outside R4A, so the patch centralises context handling and tests representative untrusted paths.

| Context | Sources reviewed | Protection/result |
|---|---|---|
| TEXT/HTML | Names, plan and scenario labels, notes, properties, liabilities, incomes, goals, one-off items, Weekly Plan labels and AI text | Existing call sites use `escapeHtml`; the helper now delegates to tested `FFSSecurity.escapeHtml`, including apostrophes. Browser fixture rendered text with no SVG, script or event-handler node. |
| ATTRIBUTE | Values inserted into data/ARIA/input attributes | User-derived text is escaped; dynamic states are constrained values. No dynamic event-handler attributes were found. |
| URL | Download object URLs, internal routes, fixed AI route | Blob URL is generated locally and revoked; navigation uses known application views. `safeUrl` rejects protocol-relative, `javascript:`, `data:` and `vbscript:` values and allows only explicitly configured protocols/relative routes. |
| STYLE | Progress widths, chart positions and colours | Values are calculated/clamped numeric values or internal colour tokens. No user-entered CSS is accepted. Inline style attributes remain, requiring the documented report-only `style-src 'unsafe-inline'` exception. |
| SCRIPT/JSON | Imported plan/Weekly Plan JSON | Parsed as data, recursively validated, migrated only after validation, and never evaluated. Forbidden prototype keys are rejected. |
| FILENAME | Plan, scenario, spreadsheet and PDF downloads | User-derived components are stripped of controls/path separators, limited to 80 characters and restricted to `json`, `xlsx` or `pdf`. |
| XML/report | Excel and printable reports | Workbook strings use XML escaping. Printable/scenario text uses HTML escaping. Focused tests prove malicious-looking names remain inert. |

## Sink search

- `innerHTML`: retained template rendering, 77 assignments reviewed by source category.
- `insertAdjacentHTML`: three first-party templates; interpolated user strings pass through escaping helpers.
- `document.write`: none.
- `DOMParser`: none.
- Dynamic `on*` attribute construction: none found.
- Arbitrary user-controlled `href`/`src`: none found.

## Fixtures

Automated and local-browser checks cover SVG/event-handler strings, script-closing strings, unsafe URL schemes, ampersands/quotes/apostrophes, Unicode, emoji, RTL text, long strings and control/newline content. The actual browser import of `r4a-prototype-pollution-import.json` was rejected while the current plan remained visible and `Object.prototype` remained unchanged.

## Residual risk

The large template-rendering surface remains a maintenance risk. R4B or a later structural stage should progressively replace high-risk templates with `textContent`/DOM construction. Enforcement CSP should not be enabled until report-only telemetry has exercised real preview workflows.
