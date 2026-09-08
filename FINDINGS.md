# Assurance Findings

## R4A findings

| ID | Finding | Status | Classification |
|---|---|---|---|
| R4A-F01 | Production HTML executed the unpinned Tailwind development CDN compiler in the financial-data origin. | Corrected in source | FIX IN R4A |
| R4A-F02 | Plan and Weekly Plan imports lacked consistent size, recursive shape, numeric/date and prototype-key validation. | Corrected in source | FIX IN R4A |
| R4A-F03 | Rendering safety depended on a local escaping helper without centralized context utilities or direct browser fixtures. | Reduced; structural template risk remains | FIX IN R4A / defer structural refactor |
| R4A-F04 | Security response headers and CSP were not represented in deployment source. | Report-only configuration prepared, not deployed | OWNER VERIFICATION REQUIRED |
| R4A-F05 | Online package advisory lookup could not reach the registry. | Open | MANUAL REVIEW |
| R4A-F06 | Existing local-storage corruption/recovery behavior was not redesigned. | Open for R5 | OUT OF R4A SCOPE |
| R4A-F07 | Preview CSP telemetry, physical-device checks and native PDF output inspection were unavailable. | Open | OWNER / NEXT CONTROLLED PREVIEW |

Earlier R1-R3 findings and decisions remain governed by their accepted evidence. R4A did not change their financial conclusions or reopen their formulas.
