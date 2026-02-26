# Ladybird

[English](README.md) / [日本語](README.ja.md) / [简体中文](README.zh-CN.md)

---

## Overview

Ladybird is a Manifest V3 browser extension for adding no-code buttons, links, tooltips, areas, and automation flows to web pages.

This repository now uses the **WXT-based implementation as the primary mainline** (previously developed under `wxt-temp/`). The previous root implementation is archived under `legacy/v1/`.

Core capabilities:
- Sidepanel management for `Elements` / `Flows` / `Hidden` / `Overview` / `Settings`
- Action flow builder (`click`, `wait`, `input`, `navigate`, `log`, `if`, `while`, `popup`)
- Password Vault for secure reusable inputs in flows
- Import / export (including optional vault data export)
- Multi-language UI (`en`, `ja`, `zh_CN`)

## Chrome Web Store

https://chromewebstore.google.com/detail/ladybird-no-code-buttons/nefpepdpcjejamkgpndlfehkffkfgbpe


## Quick Start (Mainline WXT)

Run from the repository root.

### Install dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```

### Validate and build
```bash
npm run i18n:check
npm run compile
npm run build
```

### Package a zip for distribution
```bash
npm run zip
```

### Load into Chrome (development)
Load the unpacked extension from:
- `.output/chrome-mv3/`

## Usage

1. Open the Ladybird sidepanel on the active tab.
2. Create or edit elements in **Elements** (button/link/tooltip/area).
3. Attach automation flows in **Flows**.
4. Use **Hidden** to hide page elements.
5. Use **Overview** to inspect and delete saved site data.
6. Use **Settings** for import/export, language, and Password Vault viewing.

### Password Vault (Flows)
- Use the Password Vault UI when binding password inputs in flow steps.
- Password fields are blocked from plain-text persistence in flows.
- If the vault is locked during a run, Ladybird can prompt for vault unlock directly on the page and continue the current step.
- If you forget the vault password, the vault **cannot be recovered**. You must reset it (saved vault passwords are deleted).

## Action Flow (Overview)

Flows run when an injected button is clicked and can automate page interactions before fallback behavior (linked URL or selector action).

Supported step families include:
- `click`
- `wait`
- `input`
- `navigate`
- `log`
- `if` / `while`
- `popup`

See `AGENTS.md` for the detailed action-flow reference (step fields, conditions, runtime limits, frame behavior, vault usage).

## Migration from Legacy (Important)

The previous root implementation has been moved to:
- `legacy/v1/`

### Upgrading existing users on the same listing

Because the upgrade keeps the **same Chrome Web Store listing / extension ID**, browser local storage remains under the same extension.

Ladybird includes compatibility logic to migrate legacy stored data (for example old `injectedElements`) to the new structured storage on upgrade.

Recommended pre-release and support guidance:
1. Test upgrade with real legacy data before publishing.
2. Keep export/import available as a manual recovery path.
3. If Password Vault data is exported/imported:
   - Export can optionally include vault passwords (requires vault password confirmation)
   - Import may require creating/unlocking the vault before vault data is restored

Notes:
- If you forget the vault password, saved vault passwords cannot be recovered.
- Resetting the vault deletes saved vault passwords; flow bindings remain but must be rebound.

## Repository Layout

### WXT Version
- `entrypoints/` background + content script entrypoints
- `ui/` sidepanel UI
- `shared/` shared contracts, storage, import/export, secrets
- `public/_locales/` i18n message bundles
- `scripts/` dev and validation scripts

### Legacy archive
- `legacy/v1/` previous root implementation (reference / maintenance only)

### Supporting material
- `docs/` docs and policy content
- `release/` historical artifacts, review notes, and store assets

## Contributing / Developer Notes

See `AGENTS.md` for:
- repository conventions
- build/release workflow
- i18n rules
- action-flow reference

## Privacy / Limitations

- Data is stored locally in `chrome.storage.local` unless you explicitly export it.
- Password Vault secrets are encrypted locally and require the vault password to unlock.
- Cross-origin iframe automation is not supported.
- Some sites with strict CSP or highly dynamic DOM behavior may limit injection stability.
