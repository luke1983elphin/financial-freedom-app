# Browser-Local Privacy Boundary

- Core plan data is stored in this browser on this device and is not automatically available on another device.
- A complete backup or Weekly Plan backup is a downloaded file controlled by the user; initiating a download does not prove the file was retained safely.
- Removing direct identifiers from a reduced summary does not by itself guarantee anonymity.
- No claim is made that no data ever leaves the device: static hosting receives ordinary request metadata and downloaded/printed data leaves app memory under user control.
- AI is disabled for this release candidate. Any future enabled route would require an updated notice and consent before a reduced financial summary is sent to an AI provider.

Local security boundary: same-origin executing JavaScript can access `localStorage`; local storage is not encrypted storage and is not server-side secure storage; browser or script compromise may expose it; and clearing browser/site data can remove it. Processing location, provider-log retention and provider-deletion behavior depend on the deployed providers and must be confirmed before public release.

Privacy and Terms remain drafts pending professional Australian legal/regulatory review.
