# R5 Privacy Claims Audit

Corrected claims:

- Replaced `anonymous financial summary` with a factual reduced-summary statement. Removing direct identifiers does not guarantee anonymity.
- Replaced `securely analysed` with an architecture statement describing the same-origin server route and third-party AI provider if AI is enabled in future.
- Footer now says plan data is stored in this browser/device and is not automatically available on another device.
- Export status says download initiated, not that a backup was successfully retained.

No claim is made that no data ever leaves the device. Static hosting receives ordinary request metadata; downloaded/printed data leaves app memory under user control; and the disabled AI architecture would transmit a reduced financial summary only after future enablement and consent.

Local security boundary: same-origin executing JavaScript can access `localStorage`; local storage is not encryption or server-side secure storage; XSS/browser compromise may expose it; and clearing browser/site data can remove it. Processing location, provider log retention and provider deletion behavior are UNKNOWN.

Public-release blocker: Privacy and Terms content remains explicit placeholder text pending professional legal review.

