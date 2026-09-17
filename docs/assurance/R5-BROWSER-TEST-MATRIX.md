# R5 Browser Test Matrix

| Check | Source test | Local browser | Vercel preview | Physical device |
|---|---|---|---|---|
| Normal save/reload and truthful status | PASS | PASS: fictional name saved; status updated only after verified write | NOT RUN / not authorised | NOT AVAILABLE |
| Forced failed save/recovery | PASS: injected backend | NOT RUN: browser storage fault injection unavailable without page mutation | NOT RUN | NOT AVAILABLE |
| Complete and Weekly backup controls | PASS: scope and existing import/export suites | UI controls rendered; download retention not claimed | NOT RUN | NOT AVAILABLE |
| Delete all and reload | PASS | PASS: deliberate confirmation, clean home state, saving paused | NOT RUN | NOT AVAILABLE |
| Multi-tab deletion coordination | PASS: two-coordinator event simulation | NOT RUN: functional coordinator coverage used | NOT RUN | NOT AVAILABLE |
| Corrupt storage recovery | PASS: invalid JSON/type retained | NOT RUN: destructive browser fault setup avoided | NOT RUN | NOT AVAILABLE |
| Privacy/Terms placeholders | PASS | PASS: Privacy opened, placeholder visible, Escape closed dialog | NOT RUN | NOT AVAILABLE |
| Responsive controls: 375/390/430/768/1024/1366 | PASS/source | PASS: no page-level horizontal overflow | NOT RUN | NOT AVAILABLE |

Local browser also verified the first-save prompt, `Remind me later`, delete confirmation, post-delete recovery actions, and deliberate write resumption through `Start new plan`. Console warnings/errors: none. No deployment was performed.
