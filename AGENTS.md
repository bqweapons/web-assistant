# AGENTS.md

Repository conventions and action-flow reference for Ladybird (WXT mainline).

## 1. Repository Scope & Primary App

- **Primary app (mainline):** the WXT-based extension in the repository root.
- **Legacy app:** archived under `legacy/v1/` (previous root implementation).
- New feature work should target the root WXT app unless a legacy hotfix is explicitly requested.

## 2. Project Structure (WXT Mainline)

### Core folders
- `entrypoints/`
  - `background/` background runtime, runner, tab bridge
    - `runner/` flow execution: `stepExecution.ts` (FlowRunnerManager class), `types.ts` (shared types + `MAX_*` limits), `vaultUnlockCoord.ts` (1.4 unlock-window coordination), `runSentinel.ts` (1.13 SW-suspension fail-close), `flowHelpers.ts`, `stepMessages.ts`, `tokenRenderer.ts`, `dataSource.ts`, `jsTransformExecutor.ts`
  - `content.ts` content entrypoint and runtime message handling
  - `content/flowRunner.ts` page-side flow step execution + in-page popup modals
  - `content/injection/` injection logic split (3.2): `registry`, `hostFactory`, `dragController`, `resizeController`, `dropTargets`, `reconciler`, plus `shared`, `style`, `selector`, `fileRun`, `runtimeBridge`. `entrypoints/content/injection.ts` is the thin composition root.
  - `vaultUnlock/` (1.4) dedicated extension-origin window for vault unlock — `index.html` + `main.tsx` + `UnlockDialog.tsx`. Master password never enters page DOM.
- `ui/sidepanel/`
  - `App.tsx` sidepanel tabs/header
  - `sections/` Elements / Flows / Hidden / Overview / Settings
  - `sections/elements/` (3.3) extracted sub-components from ElementsSection (`ElementCard`, `ElementStyleEditor`, `ElementBasicsAction`, helpers)
  - `components/` shared controls and flow editor UI
  - `hooks/` (3.3) reusable hooks: `useFlowStepsDraft`, `useElementsWriteQueue`, etc.
  - `utils/i18n.ts` shared locale store (also consumed by `entrypoints/vaultUnlock/`)
- `shared/`
  - `messages.ts` runtime message contracts (single source of truth for the typed message bus)
  - `storage.ts` + `siteDataSchema.ts` + `siteDataMigration.ts` + `flowStepMigration.ts` structured site data persistence + legacy migration (with 3.6 `_v` version stamp on flow steps)
  - `importExport.ts` import/export + legacy format parsing (3.7 zod schema validation at the import envelope)
  - `secrets.ts` Password Vault (local encrypted secrets)
- `public/_locales/{en,ja,zh_CN}/messages.json`
  - sidepanel/content/vaultUnlock i18n resources
- `scripts/`
  - `dev.mjs` dev runner helper
  - `check-locales.mjs` locale integrity gate

### Legacy archive
- `legacy/v1/` contains the previous MV3 implementation and its original build/package scripts.

## 3. Working Conventions (Developer / Agent Rules)

### Build and verification (run from repo root)
- `npm run i18n:check` - validates locale JSON, key parity, placeholders, and suspicious encoding damage
- `npm run compile` - TypeScript typecheck (`tsc --noEmit`)
- `npm run build` - WXT production build (runs `i18n:check` first)
- `npm run zip` - build distributable zip via WXT

### i18n rules (strict)
- Any UI text change must update all three locale files:
  - `public/_locales/en/messages.json`
  - `public/_locales/ja/messages.json`
  - `public/_locales/zh_CN/messages.json`
- Keep placeholders identical across locales (for example `{count}`, `{name}`).
- Do **not** use PowerShell inline non-ASCII text to patch locale JSON (Windows code page can corrupt text into `????`).
- Run `npm run i18n:check` after locale edits.
- Locale text must not contain mojibake / garbled characters. If any locale string is corrupted, fix it before finishing the task.
- Do not leave newly added UI strings as English-only placeholders in `ja` / `zh_CN`.

### UI consistency rules
- All visible action buttons should use `icon + label` by default. Pure text buttons are only acceptable for intentionally minimal text-only controls, not for normal primary/secondary actions.
- Use only existing shared button styles. Do not introduce undefined button classes. The approved set is:
  - `btn-primary` — rectangular primary (main call-to-action).
  - `btn-ghost` — rectangular secondary / neutral.
  - `btn-icon` — circular icon-only (base for `btn-icon-primary` / `btn-icon-danger`).
  - `btn-icon-primary` — circular icon-only with primary fill; use when a rectangular `btn-primary` won't fit (e.g. Drawer title-bar actions). Must be combined with `btn-icon`.
  - `btn-icon-danger` — circular icon-only with destructive color. Must be combined with `btn-icon`.
  - `btn-danger` — rectangular destructive (dialog confirms for delete / discard). Do not compose with `btn-ghost` / `btn-primary`.
  - `btn-toolbar` — compact icon-only (24×24) for toolbar clusters (font-size, bold, italic, alignment). Use `bg-accent text-accent-foreground` or the `aria-pressed:` variant for active state.
- If two sibling actions belong to the same action group (for example `Save / Cancel`, `Bind / New`), prefer rendering them on one row and splitting the available width evenly.
- If button labels are too long for the sidepanel width, shorten the label and keep the icon instead of allowing layout-breaking wrapping.
- Reuse existing visual patterns across sections. Delete, save, cancel, clear, close, unlock, and confirm actions should look and behave consistently.

### Dialog and dropdown rules
- Use the shared `ConfirmDialog` for normal in-app delete / discard confirmations. Do not use `window.confirm` for routine sidepanel confirmation flows.
- If a confirmation dialog is opened from inside another modal, verify its `z-index` so the dialog is visible above the parent modal.
- Utility actions inside dialogs (close, delete, small tool actions) should prefer circular `btn-icon` styling.
- Dropdowns and select menus must respect the available space inside drawers / sidepanels. Large menus must clamp height dynamically and scroll internally instead of expanding the layout.

### Password Vault UI rules
- Password-related flows should prefer Password Vault bindings over literal values.
- Password warnings or blocked-state guidance should use warning / destructive styling instead of normal muted helper text.
- Password Vault UI work should preserve add / edit / delete flows and keep them visually aligned with the rest of the sidepanel.
- When Password Vault UI logic grows, extract it into dedicated components / hooks instead of expanding already-large section components.
- Closing, resetting, or re-locking vault-related UI must clear transient state (editor state, pending delete state, revealed values, etc.).

### Message contract changes
When changing runtime messages:
1. Update `shared/messages.ts`
2. Update sender(s)
3. Update receiver(s) in content/background/sidepanel
4. Verify error handling paths and i18n messages

### Sensitive data / Password Vault rules
- Do not log plain-text input values or vault passwords.
- Flow execution logs must remain non-sensitive.
- Password fields should use Password Vault bindings, not literal flow values.
- If a vault operation fails due to lock state, prefer user-facing recovery UX (page unlock prompt or clear sidepanel error).

### Legacy policy
- `legacy/v1` is for comparison, debugging, and emergency maintenance only.
- Avoid introducing new product features into `legacy/v1`.

## 4. Release / Packaging Workflow (Mainline)

### Build output
- Unpacked extension: `.output/chrome-mv3/`
- Zip package: produced by `npm run zip`

### Chrome Web Store strategy
- Release on the **same CWS listing** (same extension ID), as an in-place upgrade.
- Existing users receive updates without reinstalling the extension.
- Validate upgrade compatibility before release, including legacy storage auto-migration.
- Increment the extension version above the currently published CWS version before uploading.

### Release checklist (minimum)
1. `npm run i18n:check`
2. `npm run compile`
3. `npm run build`
4. `npm run zip`
5. Manual sanity checks:
   - sidepanel opens and tabs localize correctly
   - upgrade path from old local data works (legacy storage auto-migration)
   - import/export works (including optional vault export/import)
   - flow runner works
   - Password Vault unlock/reset flows work

## 5. Action Flow Reference (WXT Mainline)

Action flows run when an injected button is clicked. A flow can automate page interactions before falling back to an attached URL or selector behavior.

### Authoring notes
- Flows are authored in the sidepanel **Flows** UI.
- Advanced users may still use secret tokens in `input` values (for example `{{secret.login_password}}`), but the preferred path is the Password Vault binding UI.
- Flows and flow steps are persisted in structured site data under `chrome.storage.local`.

### Supported step types
- `click`
  - Clicks a matched DOM element.
  - Selector required.
- `wait`
  - Waits for a duration (`ms`) or a condition (depending on mode/UI).
- `input`
  - Writes text to `input`, `textarea`, `select`, or contenteditable targets and dispatches change/input events.
  - Password fields are protected by Password Vault policy.
- `navigate`
  - Navigates / opens a URL (sanitized runtime behavior).
- `log`
  - Adds a runtime log entry (non-sensitive).
- `if`
  - Executes `then` or `else` branch based on a condition.
- `while`
  - Repeats a body while a condition remains true (subject to iteration limits).
- `popup`
  - Displays a modal popup on the page and waits for user confirmation (`OK`) before continuing.

## 6. Conditions (Flow Logic)

Common condition kinds include:
- `exists` - selector exists
- `not` - negates nested operand
- `textContains` - text contains value
- `attributeEquals` - attribute matches expected value

Conditions are validated at save time. Invalid shapes should not be persisted.

## 7. Runtime Behavior, Limits, and Safeguards

### Execution behavior
- Flow steps execute in the relevant frame context.
- Step execution messages include frame targeting metadata to avoid duplicate execution in multiple frames.
- For user prompts other than the vault unlock (popup confirmation, etc.), the UI is shown in the page (top frame preferred) and the current step continues after successful user input.
- **The vault unlock prompt is NOT an in-page prompt** — see the next section.

### Password Vault interaction during runs
- The master password is **never** entered into page DOM. The threat model includes page scripts actively sniffing keystrokes.
- If a flow needs a secret and the vault is locked:
  - The runner transitions the run to a new `paused` state (visible to the sidepanel, persisted in the 1.13 run sentinel).
  - The SW opens a dedicated extension-origin unlock window (`chrome-extension://<id>/vaultUnlock.html`, `chrome.windows.create({type:'popup'})`).
  - The user enters the master password into that window — chrome-extension origin only; page scripts cannot observe it.
  - On success, the SW resolves the pending unlock, closes the window, transitions the run back to `running`, and the flow **resumes from the current step** (not from the beginning).
- Failure paths (all surface as failed runs with an appropriate error code):
  - User clicks Cancel → `secret-vault-unlock-cancelled`.
  - User closes the window via X or OS / Chrome kills it → same code, via the `chrome.windows.onRemoved` watchdog.
  - Wrong password submitted → stays inside the unlock window; retry counter increments; run remains `paused` until success, cancel, or close.
  - SW suspended while the run is `paused` → next cold-start's 1.13 orphan cleanup treats `paused` as an unfinished state and broadcasts `failed` with `sw-suspended-during-run`.
- The pre-1.4 in-page modal path (`promptFlowVaultUnlockOnPage`, `FLOW_RUN_VAULT_UNLOCK_PROMPT`) and its 1.4′ capture-phase keyboard shield were retired in the 1.4 batch; see [1.4-spec.md](1.4-spec.md).

### Safety / privacy
- The master password never crosses the page-DOM boundary. It lives in the extension-origin unlock window for one JS turn and then inside the SW's AES-key derivation; no page script can observe either realm.
- Flow step result payloads must not include plain-text `inputValue` (1.5 taint tracking).
- Password fields using literal values are blocked by policy (save-time and runtime protection).

### Typical limits (implementation-enforced)
- Total step count cap
- Loop iteration cap
- Overall runtime timeout / per-step timeout

Use the current implementation in `entrypoints/background/runner/stepExecution.ts` and `shared/messages.ts` as source of truth when updating limits.

## 8. Best Practices (Flows)

- Prefer stable selectors over brittle nth-child selectors where possible.
- Keep waits short and condition-based when available.
- Use `popup` for explicit user checkpoints in semi-automated flows.
- For login/password flows:
  - Use Password Vault bindings
  - Avoid literal credentials in flow steps
- Re-test flows after major site UI changes.

## 9. Debugging Tips

- Check sidepanel flow run status and logs first.
- If a flow silently fails while the sidepanel is closed, verify whether a page-side prompt (popup/vault unlock) is waiting.
- For `secret-not-found`, rebind the password in the flow step (vault may have been reset).
- For i18n issues, run `npm run i18n:check` before assuming runtime bugs.

## 10. Legacy Reference Notes

- Historical action-flow reference for the old implementation is kept in `release/AGENTS.md`.
- Treat that file as archival reference only; update this root `AGENTS.md` for current behavior.
