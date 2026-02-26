# Chrome Web Store Listing Copy (Ladybird)

This directory stores reusable Chrome Web Store listing text for the existing Ladybird listing (same listing / same extension ID, in-place upgrades).

## Files and CWS fields

- `en/short-description.txt` -> CWS `Short description`
- `en/detailed-description.txt` -> CWS `Detailed description`
- `en/whats-new.txt` -> CWS `What’s new in this version`
- `ja/short-description.txt` -> CWS `Short description` (Japanese)
- `ja/detailed-description.txt` -> CWS `Detailed description` (Japanese)
- `ja/whats-new.txt` -> CWS `What’s new in this version` (Japanese)
- `zh-CN/short-description.txt` -> CWS `Short description` (Simplified Chinese)
- `zh-CN/detailed-description.txt` -> CWS `Detailed description` (Simplified Chinese)
- `zh-CN/whats-new.txt` -> CWS `What’s new in this version` (Simplified Chinese)

## Maintenance rules

- Update all three languages together (`en`, `ja`, `zh-CN`) when user-facing behavior changes.
- Keep feature claims aligned with the current implementation in this repository.
- Prefer practical wording over marketing-heavy wording.
- Keep `whats-new.txt` focused on user-visible changes for the current release.
- Do not describe internal refactors as end-user release highlights.

## Short description character counts

- `en/short-description.txt`: 122 chars
- `ja/short-description.txt`: 58 chars
- `zh-CN/short-description.txt`: 47 chars

## Release copy checks (before pasting into CWS)

1. Verify the extension version is incremented above the currently published CWS version.
2. Re-check text against current behavior (especially Password Vault, import/export, and flow runner UX).
3. Confirm all three languages are updated.
4. Keep privacy and security statements consistent with `docs/PRIVACY-POLICY*.md`.
