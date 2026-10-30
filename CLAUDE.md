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
| Unit tests (Vitest, `tests/unit/`) | `npm test` |
| E2E tests (Playwright, `tests/e2e/`, builds first) | `npm run test:e2e` (`HEADED=1` to watch; `LADYBIRD_EXTENSION_DIR` to test another build) |

CI (`.github/workflows/ci.yml`, Node 22) runs compile, both i18n checks, unit tests, build and E2E on every push to main/develop and on PRs. Node >= 22 is required (WXT 0.21). Load the unpacked build from `.output/chrome-mv3/`.

## Architecture

Three extension surfaces communicate via a typed message bus; all message kinds live in `shared/messages.ts` as `MessageType.*` — touching a message always means editing sender, receiver, and the enum together.

### 1. Background (service worker) — `entrypoints/background.ts` → `background/bootstrap.ts`
- Bootstraps side-panel behavior (`openPanelOnActionClick`), instantiates `TabBridge` and `FlowRunnerManager`, and registers the single `runtime.onMessage` listener.
- Routes sidepanel → content messages via `TabBridge` (forwards to requested tab or active tab, re-injects content script if needed).
- Listens to `tabs.onUpdated` / `tabs.onActivated` to broadcast `ACTIVE_PAGE_CONTEXT`. Skips broadcasts whose active tab is one of our own extension URLs (vault unlock window, etc.) so they don't clobber the sidepanel's current-page context.
- `background/runner/` owns flow execution orchestration. After 3.1 the file split is: `stepExecution.ts` (the `FlowRunnerManager` class + dispatcher), `types.ts` (shared types, `RunnerError`, `MAX_*` limits), `vaultUnlockCoord.ts` (1.4 unlock-window coordinator), `runSentinel.ts` (1.13 SW-suspension fail-close sentinel), `flowHelpers.ts`, `stepMessages.ts`, plus `tokenRenderer.ts` / `dataSource.ts` / `jsTransformExecutor.ts`. **`stepExecution.ts` is the source of truth for step/iteration/timeout limits.** No barrel — import directly from `./stepExecution`.
- `transformRuntime.ts` + `transformSandbox.worker.ts` run user JS transforms in a web worker sandbox.

### 2. Content script — `entrypoints/content.ts` + `entrypoints/content/`
- `injection.ts` is now the thin composition root. After 3.2 the actual injection logic lives under `entrypoints/content/injection/` (`registry`, `hostFactory`, `dragController`, `resizeController`, `dropTargets`, `reconciler`, plus existing `shared`, `style`, `selector`, `fileRun`, `runtimeBridge`).
- `flowRunner.ts` is the page-side executor for individual flow steps dispatched by the background runner; also renders in-page popup modals. Vault unlock is **NOT** in-page — see surface 4 below.
- `flowRecorder.ts` records user interactions into flow steps. `picker.ts` drives the selector/area picker. `hiddenRules.ts` applies user-hide-element rules.
- Only the top frame rehydrates persisted elements (1.16). Frame-targeted execution metadata + the F1 per-step `FLOW_RUN_FRAME_PROBE` resolve flow steps to a specific iframe via the persisted `targetFrame.url` locator.

### 3. Sidepanel UI — `entrypoints/sidepanel/` + `ui/sidepanel/`
- `App.tsx` hosts the tabbed shell: **Elements / Flows / Hidden / Overview / Settings** (see `ui/sidepanel/sections/`).
- `components/` holds shared controls. Use these rather than introducing new button/dialog/dropdown primitives — see the UI rules in `AGENTS.md` §3.
- `components/PasswordVaultManager.tsx` + `components/flowSteps/` contain the Password Vault editor and per-step-type editors.
- `hooks/` (populated by 3.3) — `useFlowStepsDraft`, `useElementsWriteQueue`, etc. Cross-section reusable state lives here, not inline.
- `sections/elements/` (populated by 3.3) — sub-components extracted from `ElementsSection.tsx` (`ElementCard`, `ElementStyleEditor`, `ElementBasicsAction`, `pageUrlFormat`, `styleUtils`).

### 4. Vault unlock window — `entrypoints/vaultUnlock/`
- Dedicated extension-origin popup launched by the SW when a flow needs a secret while the vault is locked (1.4). The master password never enters page DOM.
- `index.html` + `main.tsx` + `UnlockDialog.tsx`. Reuses the sidepanel locale store (`ui/sidepanel/utils/i18n.ts`) so the window follows the user-selected language, not browser UI language.
- Coordination: SW transitions the run to `paused`, opens the window via `chrome.windows.create({type:'popup'})`, awaits `FLOW_RUN_UNLOCK_SUBMIT`, resolves and resumes from the current step on success. Window closure (X / OS) → `chrome.windows.onRemoved` watchdog fails the run as cancelled (with a submit-in-flight guard so a correct password racing a window-close still succeeds).

### Shared layer — `shared/`
- `messages.ts` — runtime message contracts (enum + payload types). **Always the first file to edit when changing cross-surface behavior.**
- `storage.ts` + `siteDataSchema.ts` + `siteDataMigration.ts` + `flowStepMigration.ts` — structured per-site data in `chrome.storage.local` (key `ladybird_sites`) with auto-migration from the legacy v1 schema on upgrade.
- `globalSettings.ts` — extension-wide settings (key `ladybird_global_settings`).
- `secrets.ts` — locally-encrypted Password Vault. Secrets are referenced by binding from flow `input` steps rather than by literal value.
- `importExport.ts` — import/export of site data (with optional vault payload) + parsing of legacy export formats.
- `urlKeys.ts` — canonical `siteKey` / `pageKey` derivation; both content and background must agree on these.

### Flow runtime (summary)
Flows run when an injected element is clicked. Step types: `click`, `input`, `wait`, `assert`, `popup`, `navigate`, `loop`, `if-else`, `data-source`, `set-variable` (whitelist enforced at import / migration in `shared/flowStepMigration.ts`). See `AGENTS.md` §5–§8 for field-level semantics. If the vault is locked during a run, the runner transitions the run to a `paused` state, opens the extension-origin unlock window (`entrypoints/vaultUnlock/`), and resumes from the current step on `FLOW_RUN_UNLOCK_SUBMIT` success; close / cancel fails the run with `secret-vault-unlock-cancelled`. Password fields are policy-blocked from persisting literal values — both at save time and runtime. SW suspension during any non-terminal run is fail-closed via the 1.13 `chrome.storage.session` sentinel + cold-start orphan cleanup.

## Non-obvious conventions

- **i18n is a hard gate.** Any user-visible string edit must update all three files under `public/_locales/{en,ja,zh_CN}/messages.json`, keep `{placeholders}` identical across locales, and pass `npm run i18n:check`. The checker also rejects `?` runs and `�` (mojibake guard).
- **Never patch locale JSON via PowerShell inline strings on Windows** — the console code page corrupts non-ASCII into `????`. Edit the file directly.
- **Ja and zh_CN must not be left as English placeholders** for new strings.
- **UI primitives are fixed.** Use only `btn-primary`, `btn-ghost`, `btn-icon`, `btn-icon-danger`; default all action buttons to icon + label; use the shared `ConfirmDialog` instead of `window.confirm`. Full rules in `AGENTS.md` §3.
- **Do not log secret input values or vault passwords.** Flow step result payloads must not include plain-text `inputValue`.
- **CWS strategy is in-place upgrade** on the same listing/extension ID, so `shared/siteDataMigration.ts` and `shared/flowStepMigration.ts` must keep legacy storage readable. Test an upgrade with real v1 data before releasing; bump the version in both `package.json` and `wxt.config.ts` (they are kept in sync manually).
- **Release checklist:** `i18n:check` → `compile` → `build` → `zip` → manual sanity (sidepanel localized, legacy upgrade migrates, import/export round-trips, flow runner + vault unlock work). See `AGENTS.md` §4.
