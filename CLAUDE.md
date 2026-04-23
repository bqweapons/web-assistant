# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository orientation

**Ladybird** is a Manifest V3 browser extension (Chrome + Firefox) that injects no-code buttons, links, tooltips, areas, and automation flows into web pages. Built with [WXT](https://wxt.dev) + React 19 + TypeScript + Tailwind v4.

- **Mainline:** WXT app at the repo root. All new work goes here.
- **Legacy:** `legacy/v1/` is the previous MV3 implementation, kept only for reference, debugging, and emergency hotfixes. Do not add new features there.
- **Docs site:** `docs/` hosts the static landing + privacy policy pages served by `scripts/dev.mjs`.

`AGENTS.md` at the repo root is the authoritative convention + action-flow reference — read it before non-trivial changes. Much of what follows points back to it.

## Commands

All commands run from the repo root.

| Task | Command |
| --- | --- |
| Install deps | `npm install` (runs `wxt prepare` postinstall) |
| Dev (Chrome, launches docs server + WXT with `WXT_DEV_START_URL` pointed at `docs/index.html`) | `npm run dev` |
| Dev (WXT only, no docs server) | `npm run dev:wxt` |
| Dev (Firefox) | `npm run dev:firefox` |
| Typecheck | `npm run compile` (tsc `--noEmit`) |
| Locale validation | `npm run i18n:check` |
| Unused locale keys report | `npm run i18n:unused-check` |
| Production build (Chrome) | `npm run build` (runs `i18n:check` first) |
| Production build (Firefox) | `npm run build:firefox` |
| Distributable zip | `npm run zip` / `npm run zip:firefox` |

No test runner is wired up; `i18n:check` and `compile` are the CI gates. Load the unpacked build from `.output/chrome-mv3/`.

## Architecture

Three extension surfaces communicate via a typed message bus; all message kinds live in `shared/messages.ts` as `MessageType.*` — touching a message always means editing sender, receiver, and the enum together.

### 1. Background (service worker) — `entrypoints/background.ts` → `background/bootstrap.ts`
- Bootstraps side-panel behavior (`openPanelOnActionClick`), instantiates `TabBridge` and `FlowRunnerManager`, and registers the single `runtime.onMessage` listener.
- Routes sidepanel → content messages via `TabBridge` (forwards to requested tab or active tab, re-injects content script if needed).
- Listens to `tabs.onUpdated` / `tabs.onActivated` to broadcast `ACTIVE_PAGE_CONTEXT`.
- `background/runner/` owns flow execution orchestration (`FlowRunnerManager.ts`, `stepExecution.ts`, `tokenRenderer.ts`, `dataSource.ts`, `jsTransformExecutor.ts`). **This is the source of truth for step/iteration/timeout limits.**
- `transformRuntime.ts` + `transformSandbox.worker.ts` run user JS transforms in a web worker sandbox.

### 2. Content script — `entrypoints/content.ts` + `entrypoints/content/`
- `injection.ts` injects and rehydrates structured elements (button/link/tooltip/area) onto the page.
- `flowRunner.ts` is the page-side executor for individual flow steps dispatched by the background runner; also renders in-page modals (popups, vault-unlock prompt).
- `flowRecorder.ts` records user interactions into flow steps. `picker.ts` drives the selector/area picker. `hiddenRules.ts` applies user-hide-element rules.
- Only the top frame rehydrates persisted elements; frame-targeted execution metadata prevents duplicate runs across iframes.

### 3. Sidepanel UI — `entrypoints/sidepanel/` + `ui/sidepanel/`
- `App.tsx` hosts the tabbed shell: **Elements / Flows / Hidden / Overview / Settings** (see `ui/sidepanel/sections/`).
- `components/` holds shared controls. Use these rather than introducing new button/dialog/dropdown primitives — see the UI rules in `AGENTS.md` §3.
- `components/PasswordVaultManager.tsx` + `components/flowSteps/` contain the Password Vault editor and per-step-type editors.

### Shared layer — `shared/`
- `messages.ts` — runtime message contracts (enum + payload types). **Always the first file to edit when changing cross-surface behavior.**
- `storage.ts` + `siteDataSchema.ts` + `siteDataMigration.ts` + `flowStepMigration.ts` — structured per-site data in `chrome.storage.local` (key `ladybird_sites`) with auto-migration from the legacy v1 schema on upgrade.
- `globalSettings.ts` — extension-wide settings (key `ladybird_global_settings`).
- `secrets.ts` — locally-encrypted Password Vault. Secrets are referenced by binding from flow `input` steps rather than by literal value.
- `importExport.ts` — import/export of site data (with optional vault payload) + parsing of legacy export formats.
- `urlKeys.ts` — canonical `siteKey` / `pageKey` derivation; both content and background must agree on these.

### Flow runtime (summary)
Flows run when an injected element is clicked. Step types: `click`, `wait`, `input`, `navigate`, `log`, `if`, `while`, `popup`. See `AGENTS.md` §5–§8 for field-level semantics. If the vault is locked during a run, the runner shows an in-page unlock modal and resumes the current step on success; cancel fails the run. Password fields are policy-blocked from persisting literal values — both at save time and runtime.

## Non-obvious conventions

- **i18n is a hard gate.** Any user-visible string edit must update all three files under `public/_locales/{en,ja,zh_CN}/messages.json`, keep `{placeholders}` identical across locales, and pass `npm run i18n:check`. The checker also rejects `?` runs and `�` (mojibake guard).
- **Never patch locale JSON via PowerShell inline strings on Windows** — the console code page corrupts non-ASCII into `????`. Edit the file directly.
- **Ja and zh_CN must not be left as English placeholders** for new strings.
- **UI primitives are fixed.** Use only `btn-primary`, `btn-ghost`, `btn-icon`, `btn-icon-danger`; default all action buttons to icon + label; use the shared `ConfirmDialog` instead of `window.confirm`. Full rules in `AGENTS.md` §3.
- **Do not log secret input values or vault passwords.** Flow step result payloads must not include plain-text `inputValue`.
- **CWS strategy is in-place upgrade** on the same listing/extension ID, so `shared/siteDataMigration.ts` and `shared/flowStepMigration.ts` must keep legacy storage readable. Test an upgrade with real v1 data before releasing; bump the version in both `package.json` and `wxt.config.ts` (they are kept in sync manually).
- **Release checklist:** `i18n:check` → `compile` → `build` → `zip` → manual sanity (sidepanel localized, legacy upgrade migrates, import/export round-trips, flow runner + vault unlock work). See `AGENTS.md` §4.
