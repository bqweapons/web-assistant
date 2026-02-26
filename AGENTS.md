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
  - `content.ts` content entrypoint and runtime message handling
  - `content/flowRunner.ts` page-side flow step execution + modal UI helpers
- `ui/sidepanel/`
  - `App.tsx` sidepanel tabs/header
  - `sections/` Elements / Flows / Hidden / Overview / Settings
  - `components/` shared controls and flow editor UI
- `shared/`
  - `messages.ts` runtime message contracts
  - `storage.ts` structured site data persistence + legacy import migration
  - `importExport.ts` import/export + legacy format parsing
  - `secrets.ts` Password Vault (local encrypted secrets)
- `public/_locales/{en,ja,zh_CN}/messages.json`
  - sidepanel/content i18n resources
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
- For special user prompts (for example Password Vault unlock), the UI is shown in the page (top frame preferred) and the current step continues after successful user input.

### Password Vault interaction during runs
- If a flow needs a secret and the vault is locked:
  - The runner requests an **in-page vault unlock prompt**
  - The user enters the vault password in the page modal
  - On success, the flow continues from the current step (not from the beginning)
- If the user cancels:
  - The flow fails with a user-facing cancellation error
- If the page refreshes/navigates during prompt:
  - The run fails quickly (no long timeout wait)

### Safety / privacy
- Vault passwords entered in page prompts are not logged and not stored in flow logs.
- Flow step result payloads should not include plain-text `inputValue`.
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
