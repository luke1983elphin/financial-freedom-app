# R4A External Resource Inventory

## Production browser surface

| Host | Resource | Purpose | Runtime required | Financial-data exposure | Treatment |
|---|---|---|---|---|---|
| Same origin | `security.js`, application scripts | Application runtime | Yes | These first-party scripts can access browser plan data | KEEP, local only |
| Same origin | `tailwind-static.css`, `styles.css` | Application styling | Yes | CSS receives no plan payload | KEEP, local only |
| `cdn.tailwindcss.com` | Development Tailwind compiler | Previously generated utility CSS in the browser | No | Third-party script executed in the plan-data origin | REMOVED |
| `api.openai.com` | OpenAI provider | Server-side AI request in `api/ai-insights.js` | Disabled in R1 | Browser has no direct provider request; the server route remains disabled by exact server flag | DISABLED |
| Any other third-party host | Scripts, styles, fonts, analytics, images or APIs | None found in runtime HTML | No | None observed | NOT PRODUCTION |

## Evidence

- `index.html` contains eight relative script sources and two relative stylesheet sources.
- `scripts/verify-browser-security.mjs` fails if the Tailwind CDN or an unexpected absolute script host is reintroduced.
- Local browser inspection observed only same-origin scripts and styles and no third-party browser request declarations.
- Fonts are system fonts. Icons and charts are rendered by first-party HTML/CSS/SVG logic.
- Spreadsheet XML namespace URLs are identifiers embedded in generated files, not browser network requests.

No replacement CDN was introduced.
