# R5 Data Flow Map

| Flow | Source/data | Destination/transport | Persistent | Purpose/status/owner | Retention |
|---|---|---|---|---|---|
| Plan entry | User form values, names, notes, finances | In-memory JavaScript, then same-origin `localStorage` | Yes locally after verified save | Planning; enabled; user/browser profile | Until user/browser clears or app delete-all |
| Scenarios | Plan copies, notes, calculated summaries | Same-origin `localStorage` | Yes | Comparison; enabled | Same as local plan |
| Weekly Plan | Timing, actuals, history, notes | Same-origin `localStorage` | Yes | Weekly operation; enabled | Same as local plan |
| JSON backup | Selected local plan/scenarios/weekly/history | Browser-generated Blob download | Outside app after initiation | User-controlled recovery | UNKNOWN to app |
| Weekly backup | Weekly Plan only | Browser-generated Blob download | Outside app after initiation | Weekly recovery | UNKNOWN to app |
| Excel/PDF/print | Calculated report/weekly display | Browser download or print subsystem | Outside app | Reporting | UNKNOWN to app |
| Static hosting | HTTP request metadata | Vercel/static host over HTTPS | Provider-side may exist | Deliver app assets; enabled | UNKNOWN |
| AI configuration | No plan payload | Same-origin `/api/ai-insights` GET | Not stored by client as provider record | Checks disabled feature state | UNKNOWN provider logging |
| AI generation architecture | Reduced calculated plan summary if enabled and affirmatively consented | Same-origin server route, then OpenAI HTTPS API | Provider handling UNKNOWN | Disabled by exact server flag in accepted R1/R5 | UNKNOWN; legal review required before enablement |
| Analytics/telemetry | None found in app-owned runtime | None | No | Not implemented | N/A |
| Third-party runtime assets/fonts | None found after R4A local dependency hardening | Local static files | Browser cache controlled by browser | UI delivery | Browser-dependent |

`localStorage` is accessible to JavaScript executing under the same origin. It is not server-side encrypted storage and can be exposed by an XSS or browser compromise. R4A lowers script risk but does not make browser storage immune. Hosting request metadata can exist even while financial plan payloads remain local.

