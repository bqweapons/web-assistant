# Code Review Fixes — 2026-04-23

Source: 4-agent parallel code review + 2 user-reported bugs
Branch: `develop`
Owner: bqweapons

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` deferred
Severity tags match the original review summary (`🔴 HIGH` / `🟡 MED` / `🟢 LOW/debt`).

---

## Phase 0 — User-reported bugs (quick wins, merge first)

**Goal:** unblock daily editing workflow before tackling security.

- [x] **0.1** JS transform editor closes on input — split the single effect into two: one for prop-sync (skips when our own commit round-trips back), one for `resetKey`-triggered UI-state reset. Editor/picker state no longer nuked on every keystroke.
- [x] **0.2** Flow save race after adding last step — introduced `commitSteps` helper that fires `onChange(next)` synchronously from the mutation site. Removed the `useEffect([draftSteps]) → onChange` reconciliation; dropped `syncingFromPropsRef` / `initializedRef`. All 10 mutation sites now call `commitSteps`.
- [x] **0.3** Typecheck + i18n pass (`npm run compile` ✓, `npm run i18n:check` ✓).
- [ ] **0.4** User-side manual verification before moving on.

### Phase 0 change summary

Single file touched: [FlowStepsBuilder.tsx](ui/sidepanel/components/FlowStepsBuilder.tsx).

- Removed: `syncingFromPropsRef`, `initializedRef`, and the `useEffect([draftSteps])` onChange dispatcher.
- Added: `draftStepsRef` (tracks latest committed draft) + `commitSteps(updater)` helper that updates local state + ref and fires `onChange(next)` synchronously.
- Split the combined `[resetKey, steps]` effect into two single-purpose effects:
  - `[steps]` — mirror external steps into local state, skip when matching our own latest commit.
  - `[resetKey]` — reset editor UI state (`activeStepId`, `activeFieldTarget`, `transformEditorTarget`, `variablePickerTarget`, `inputValueModes`, `collapsedSteps`, `collapsedBranches`, `dragState`) only when `resetKey` actually transitions.
- Replaced all mutating `setDraftSteps(...)` call sites (`updateField`, `addStep`, `handleDeleteStep`, `insertColumnToken`, `insertInputValueShortcut`, `updateFieldTransform`, `handleDataSourceFileChange`, drag reorder ×2) with `commitSteps(...)`.
- `handleDeleteStep`: lifted inner `setActiveStepId` out of the reducer (used `draftStepsRef.current` post-commit).
- `insertColumnToken` fallback branch: lifted the no-op `setActiveFieldTarget(target)` out of the reducer.

---

## Phase 1 — Security ship-blockers (🔴)

### 1a. Password Vault crypto & handling

- [ ] **1.1** (**architectural change, not a local patch**) Stop round-tripping the derived AES key to `chrome.storage.session`. Target: key lives only as a non-extractable `CryptoKey` in the SW's memory. **Scope:** `shared/secrets.ts` is imported directly by 6 files across sidepanel/background ([SettingsSection.tsx](ui/sidepanel/sections/SettingsSection.tsx), [PasswordVaultManager.tsx](ui/sidepanel/components/PasswordVaultManager.tsx), [InputSecretValueControl.tsx](ui/sidepanel/components/flowSteps/InputSecretValueControl.tsx), [FlowsSection.tsx](ui/sidepanel/sections/FlowsSection.tsx) + `isSecretTokenValue`, [FlowStepsBuilder.tsx](ui/sidepanel/components/FlowStepsBuilder.tsx) + `isSecretTokenValue`, [stepExecution.ts](entrypoints/background/runner/stepExecution.ts)). Sidepanel callers currently invoke `unlockSecretsVault` / `listSecrets` / `setSecret` etc. directly. Making the key SW-only requires:
  - Designating SW as owner of the derived `CryptoKey`.
  - Adding `SECRETS_*` runtime messages for each vault operation sidepanel needs.
  - Reworking sidepanel components from sync-ish local calls to async message round-trips (including status polling).
  - Keeping `isSecretTokenValue` (pure) in the shared module since it needs no key.
  - Setting [secrets.ts:283](shared/secrets.ts#L283) `extractable=false` and dropping `exportAesKeyRaw` + session-persist paths ([secrets.ts:98-103,224-237,332-340](shared/secrets.ts#L98-L103)) is the *last* step, after the boundary is in place.

  Estimate: non-trivial, 1–2 day refactor. Could be staged behind Phase 1b/1c if we want to land easier wins first.

- [ ] **1.2** Raise KDF strength. Options: PBKDF2-SHA256 ≥600k iterations **or** migrate to Argon2id (via libsodium / `argon2-browser`). Include a one-shot upgrade path for existing vaults.
- [x] **1.3** Replace `window.prompt` for vault master password at [SettingsSection.tsx](ui/sidepanel/sections/SettingsSection.tsx) with masked modal. New component [PasswordPromptDialog.tsx](ui/sidepanel/components/PasswordPromptDialog.tsx) (masked `<input type="password">` + show/hide toggle + Esc-to-cancel + Enter-to-submit + backdrop-click-cancel). Async bridge: `promptVaultPassword({title,message,submitLabel}): Promise<string|null>`. 3 call sites migrated (export, import-create, import-unlock). 5 new locale keys added to all three locales (`_title_export`, `_title_create`, `_title_unlock`, `_placeholder`, `_submit`). i18n:check ✓ compile ✓. `window.confirm` calls in the same file remain — they are Phase 2 (2.10 scope).
- [-] ~~**1.4** Move vault-unlock prompt out of page DOM.~~ **Deferred / reframed.** AGENTS.md §7 lines 160, 164 specify in-page prompt as the designed behavior — moving it would contradict repo source-of-truth. Threat remains real (page scripts can listen capture-phase `keydown` on `window`). Replaced by **1.4′** below.
- [x] **1.4′** Hardened the in-page vault-unlock modal at [flowRunner.ts](entrypoints/content/flowRunner.ts). **Explicitly defense-in-depth, not threat elimination.** A page listener registered on window-capture BEFORE our modal opens still wins — browser event-model limitation, not a code bug. Changes:
  - Added `shieldHandler` attached to **both** `window` and `document` capture-phase for `keydown`/`keypress`/`keyup`/`paste`/`copy`/`cut` while a passwordField modal is open. Events whose `composedPath` does not include the modal host get `stopImmediatePropagation()` + `preventDefault()` (when cancelable). Events originating inside the closed shadow host pass through normally so modal hotkeys still work.
  - Shield only activates when `options.passwordField` is set, so the benign popup-message modal is unaffected.
  - Shield registered **before** `onKeyDown` so external events are blocked in capture order before the modal hotkey handler would react.
  - `isTrusted` guard on `onKeyDown` and on `shieldHandler`: synthetic `dispatchEvent` keystrokes get blocked (shield) and never trigger modal hotkeys. Real keystrokes (`isTrusted=true`) still flow normally.
  - `input.value = ''` cleared at `close()` before node cleanup.
  - Closed shadow root preserved.
  - **Known limitation (documented in code comment):** page listeners registered on `window`-capture **before** the modal opens will still see every keystroke. See **1.4-spec** below for the spec-level discussion on moving the prompt out of the page DOM.

- [ ] **1.4-spec** (discussion, not code) Should the threat model include "malicious page actively sniffs master password"? If yes, the long-term answer is to move the unlock entry out of page DOM (extension popup/sidepanel). This requires an AGENTS.md amendment to §7 lines 160/164. No code change until the spec discussion lands.

### 1b. Secret taint / leakage

- [x] **1.5** Secret taint propagation. Added `ResolvedFieldValue = {value, tainted}` and `BuiltAtomicPayload = {payload, taintedFields: Set<'value'|'expected'|'message'|'selector'>}` as a **parallel** structure (taint flag does NOT ride inside the cross-message payload). `FlowRunInternal.taintedVariables: Set<string>` tracks which variables currently hold secret-derived values. Taint sources: any `{{secret.*}}` in raw field text; `{{var.X}}` when X is in `taintedVariables`; JS transform whose input was tainted (strictest propagation — cannot prove transform stripped secret material). `set-variable` adds to / deletes from `taintedVariables` based on the resolved `tainted` flag. `formatAtomicStartMessage` and `formatAtomicSuccessMessage` redact `expected` / `message` when their taint flag is set. `formatAtomicSuccessMessage` result type was narrowed to exclude `actual` + `sensitive` and its `details` field omits `actual` — compile-time guard against accidental plaintext reintroduction. `toStatusPayload` got a taint-boundary comment to prevent regressions.
- [x] **1.6** Password-field read redaction. New `isSensitiveInputElement` in [flowRunner.ts](entrypoints/content/flowRunner.ts) detects `type='password'` + `autocomplete` contains `password` / `cc-number` / `cc-csc` / `one-time-code`. `executeRead` preserves `actual` (legit flows pipe read values to later steps) but marks `sensitive: true` so the runner taints the destination variable. `evaluateConditionFromElement` strips both top-level and `details.actual` when sensitive — comparison already happened inside the content script; `conditionMatched` stays complete. `executeAssert` carries the `sensitive` flag through its failure path. `FlowRunExecuteResultPayload.sensitive?: boolean` added to [shared/messages.ts](shared/messages.ts).

**Batch 5 deliberate out-of-scope:**
- Declassify mechanism for JS transform: deferred; design note says it should be a standalone `declassify` step type (audit-able in sidepanel + exports), NOT a flag hidden in js-transform config.
- Condition-step vault-unlock retry path: `executeConditionStep` doesn't thread through `promptVaultUnlockAndRetry`. Pre-existing gap flagged earlier; comment added in-place; separate ticket.
- One-shot storage migration to clean poisoned pre-fix `updatedAt` values (from 1.10 tail). Separate follow-up.
- Known-limitation comment in content script calls out: `-webkit-text-security` faux-password fields and selector-based heuristics are intentionally NOT detected.
- [ ] **1.7** JS transform sandbox escape at [transformRuntime.ts:319-360,450-452](entrypoints/background/transformRuntime.ts#L319-L360) via `String.constructor`. Options: (a) whitelist identifiers; (b) swap to QuickJS-wasm / ShadowRealm; (c) block `.constructor` on member access.

### 1c. Site / injection boundary

- [x] **1.8** `endsWith` site-match bypass fixed at [injection.ts:1589](entrypoints/content/injection.ts#L1589). Replaced `currentSite.endsWith(siteKey)` with `currentSite.endsWith('.' + siteKey)`. `evil-google.com` no longer satisfies siteKey `google.com`; legit subdomains (e.g. `app.google.com`) still match.
- [x] **1.9** Added `stripDangerousKeys` deep-sanitize pass at the top of [parseImportPayload](shared/importExport.ts) that drops `__proto__` / `constructor` / `prototype` keys from the whole input tree before any normalizer sees it. Defense-in-depth: modern V8 `JSON.parse` already promotes `__proto__` to own-property (non-mutating), but this guards against callers parsing with different tools and against future edits that might use the `obj[userKey] = v` pattern. Idempotent, one deep copy per import. compile ✓ i18n ✓.
- [x] **1.10** Capped incoming `updatedAt` in [mergeById](shared/importExport.ts) at `Date.now()`. **Clamp applied to the stored item itself, not just to the comparison value** — the first-pass fix only clamped the compared value, which left the attack path open: a forged `MAX_SAFE_INTEGER` could still win its first overwrite AND permanently poison local state so legitimate future imports could never replace it. Now we shallow-copy the record with a clamped `updatedAt` before comparison+storage. Tie-break semantics ("incoming wins on `>=`") preserved. Surfacing a summary-warning when clamping kicks in is **not** in 1.10 scope — deferred. **Known follow-up:** items already stored with forged timestamps from a pre-fix build won't self-heal; a one-shot migration at storage-read time could cap any local `updatedAt > now` to clean up. Deferred.

### 1d. Runtime limits (AGENTS.md §7 claims source-of-truth)

- [x] **1.11** Added hard ceilings in [stepExecution.ts](entrypoints/background/runner/stepExecution.ts):
  - `MAX_TOTAL_STEPS_EXECUTED = 10_000` — tracked via `FlowRunInternal.executedStepCount` (incremented at top of `executeStep`, checked in `ensureRunHealthy`).
  - `MAX_LOOP_ITERATIONS = 5_000` — validated at loop-step entry AND at data-source row-count gate (covers the CSV row-explosion path flagged in the review).
  - `MAX_RUN_DURATION_MS = 10 * 60 * 1000` — checked via `Date.now() - run.startedAt` in `ensureRunHealthy`. Since `ensureRunHealthy` fires at every step boundary + every loop/data-source iteration, a stuck/runaway flow fails with `run-duration-exceeded` at the next checkpoint rather than hanging forever.
  - Three new `RunnerError` codes emitted: `run-duration-exceeded`, `run-step-count-exceeded`, `loop-iterations-exceeded`, `data-source-rows-exceeded`. All `recoverable: false`.
  - Comment points to AGENTS.md §7 as the source-of-truth claim these constants satisfy.
  - **Not in scope:** making any of these user-configurable; per-step timeout caps beyond existing ones; SW suspension recovery (that is 1.13).
- [x] **1.12** `chrome.tabs.onRemoved` wired. New `FlowRunnerManager.onTabRemoved(tabId)` method in [stepExecution.ts](entrypoints/background/runner/stepExecution.ts) — drives `finalizeRun(run, 'failed', { code: 'tab-closed', … })` which already handles `clearInFlightAtomic` + `cancelPendingRequests` + `releaseActiveRun` + `scheduleCleanup`. Listener registered in [bootstrap.ts](entrypoints/background/bootstrap.ts) next to `onUpdated`/`onActivated`. Closes the gap where tab close left `activeRunByTab` populated until the 60s dispatch timeout and blocked next `start()` with `runner-busy`.
  - **First pass had a race (user caught)**: `onTabRemoved` originally set `cancelRequested = true`, but `finalizeRun`'s own `cancelPendingRequests` rejects the awaiting coroutine which then wakes `executeRun`'s catch — and that catch branches on `cancelRequested`, calling `finalizeRun(run, 'cancelled')` again and overwriting the tab-closed error code. Two fixes applied together:
    1. `onTabRemoved` no longer sets `cancelRequested` — tab-close is a runtime failure, not a user cancel.
    2. `finalizeRun` is now **idempotent**: top-level `isRunFinalized` guard returns early, so first-finalize-wins. Also hardens any future path where a second finalize could race in.
- [ ] **1.13** MV3 SW suspension strategy: persist minimal run state (or explicitly fail-close on revival with a user notice).

### 1e. Concurrency / persistence

- [ ] **1.14** Single-writer storage. [storage.ts](shared/storage.ts) has **one** module-level `writeQueue` (line 26). That serializes writes *within* whatever V8 isolate loaded the module — but because the same module gets loaded independently in the SW and the sidepanel (separate isolates), each context has its own `writeQueue` instance. Two concurrent edits from those two contexts can race on the whole-document write at [storage.ts:253-278](shared/storage.ts#L253-L278) (last-write-wins on the full `sites` object). Fix: make SW the sole writer, route sidepanel writes through a runtime message. (Same direction original review proposed, just with the evidence stated correctly.)

### 1f. Content / UI correctness

- [x] **1.15** React-controlled input compatibility. Added native-setter helper `setControlledValue` in [flowRunner.ts](entrypoints/content/flowRunner.ts) using `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set` (+ same for `HTMLTextAreaElement` and `HTMLSelectElement`). Migrated 2 call sites: `executeInput` value write and `applySelectValue`. Framework-controlled inputs (React, Vue `.prop`) now see a genuine value change on the next `input`/`change` dispatch. Contenteditable path unchanged — plain contenteditable works with `textContent` + `input` event; Lexical/Slate/ProseMirror still need a dedicated `beforeinput`/IME-aware path (not in 1.15 scope).
- [ ] **1.16** Content script frame-scoping + proper cleanup at [content.ts:193,303](entrypoints/content.ts#L193). Top-frame guard for element messages; remove reliance on `main()`'s returned disposer.
- [-] ~~**1.17** Background listener always responds.~~ **Downgraded to observation.** Both [bootstrap.ts:105,200](entrypoints/background/bootstrap.ts#L105) and [content.ts:299](entrypoints/content.ts#L299) return `undefined` for unmatched message types, which is the standard Chrome `onMessage` pattern (lets other listeners have a chance; callers that aren't expecting a reply get none, which is correct). Review agent had no concrete hang/timeout call chain; forcing `sendResponse({ok:false})` on unmatched types risks turning "not my message" into "false failure" downstream. **No action** unless we observe a real hang; revisit with the specific sender+receiver pair if one shows up.

---

## Phase 2 — Medium severity (🟡)

- [x] **2.1** URL scheme allowlist in `navigate` at [stepExecution.ts](entrypoints/background/runner/stepExecution.ts). Added explicit `parsed.protocol !== 'http:' && parsed.protocol !== 'https:'` check after `new URL(...)`. New error code `navigate-unsupported-scheme`. Was previously blocked only by the cross-site check's side effect (`deriveSiteKeyFromUrl` returns '' for non-http schemes) — "defense-by-accident"; now explicit. Covers `javascript:`, `data:`, `blob:`, `file:`, `chrome-extension:`, etc.
- [ ] **2.2** Clear vault/secret UI state on vault lock + step switch at [InputSecretValueControl.tsx:66](ui/sidepanel/components/flowSteps/InputSecretValueControl.tsx#L66) and [PasswordVaultManager.tsx:48-63](ui/sidepanel/components/PasswordVaultManager.tsx#L48-L63).
- [x] **2.3** Recorder: added `hasSensitiveAutocomplete` helper in [flowRecorder.ts](entrypoints/content/flowRecorder.ts), mirrors 1.6's `isSensitiveInputElement` criterion (autocomplete contains `password` / `cc-number` / `cc-csc` / `one-time-code`). `getInputKind` now returns `'password'` for these even when `type !== 'password'` — covers "show password" toggles (`type=text` + `autocomplete=current-password`), credit-card, and OTP/MFA fields. Downstream recording paths (`handleInput` password-skipped emit, `handleInputActivity` early-return) are unchanged and pick up the widened detection for free. Same limits as 1.6: no selector-based heuristics, no `-webkit-text-security` detection.
- [x] **2.4** Legacy import step-type whitelist in [flowStepMigration.ts](shared/flowStepMigration.ts). New `VALID_USER_STEP_TYPES` set (10 user-facing types: `click`, `input`, `wait`, `assert`, `popup`, `navigate`, `loop`, `if-else`, `data-source`, `set-variable`; explicitly excludes internal payload-only types `condition` and `read`) + `isValidStepType` predicate. Wired into:
  - `isFlowStepData` — the predicate that gates almost every downstream acceptance of persisted step data.
  - `normalizeLegacyActionStep` — top-level rejection with null return for unknown types, keeping the storage invariant clean.
  - Historical aliases `open` / `goto` normalized to `navigate` BEFORE the whitelist check so legit old data still imports.
  - Generic "Legacy {type} step" fallback preserved for whitelisted types that lack explicit legacy handlers (e.g. legacy 'assert' / 'loop'); runtime behavior unchanged. Belts the prototype-pollution defense from 1.9 with a layer that even survives accidental introduction of a non-pollution but still-unwanted type.
- [ ] **2.5** Tighten `sendRuntimeMessage` union in [runtimeMessaging.ts:3-29](shared/runtimeMessaging.ts#L3-L29).
- [ ] **2.6** Unify `urlKeys.ts` vs `siteDataSchema.ts` site/page key derivation; handle userinfo, port, `file://` casing.
- [ ] **2.7** `storage.ts` quota-exceeded handling + corruption-recovery backup at [storage.ts:68-79,220-223](shared/storage.ts#L68-L79).
- [ ] **2.8** Focus trap on all modals, especially vault viewer; replace vault-backdrop `<div onClick>` with `<button>` at [PasswordVaultManager.tsx:464](ui/sidepanel/components/PasswordVaultManager.tsx#L464).
- [ ] **2.9** Remove nested interactives at [FlowStepsBuilder.tsx:690-712](ui/sidepanel/components/FlowStepsBuilder.tsx#L690-L712).
- [ ] **2.10** Scrub ad-hoc btn classes per AGENTS.md §3 ([ElementsSection.tsx:1885,2073+](ui/sidepanel/sections/ElementsSection.tsx#L1885), [ConfirmDialog.tsx:88](ui/sidepanel/components/ConfirmDialog.tsx#L88)).
- [ ] **2.11** Idempotent background bootstrap — guard `tabs.onUpdated/onActivated` at [bootstrap.ts:205,223](entrypoints/background/bootstrap.ts#L205).

---

## Phase 3 — Architecture debt (🟢, decomp only, no behavior change)

- [ ] **3.1** Split [stepExecution.ts](entrypoints/background/runner/stepExecution.ts) (1753 LOC); dedupe the two ~75-line vault-unlock loops.
- [ ] **3.2** Split [injection.ts](entrypoints/content/injection.ts) (1884 LOC) into `registry/hostFactory/dragController/resizeController/dropTargets/reconciler`.
- [ ] **3.3** Split [ElementsSection.tsx](ui/sidepanel/sections/ElementsSection.tsx) (2422 LOC) + [FlowStepsBuilder.tsx](ui/sidepanel/components/FlowStepsBuilder.tsx) (1491 LOC). Populate empty [ui/sidepanel/hooks/](ui/sidepanel/hooks/).
- [ ] **3.4** Rename/relocate misleading [FlowRunnerManager.ts](entrypoints/background/runner/FlowRunnerManager.ts) one-line barrel.
- [ ] **3.5** Deduplicate `normalizeStyle` / `resolvePageKey` / site-key derivation across `importExport.ts` / `siteDataMigration.ts` / `urlKeys.ts` / `siteDataSchema.ts`.
- [ ] **3.6** Version `flowStepMigration.ts`.
- [ ] **3.7** Introduce runtime schema validator (zod/valibot) at import/message boundaries.

---

## Working rules

1. One phase per commit batch. Don't mix security fixes with refactors.
2. After each phase: `npm run compile` + `npm run i18n:check` must pass.
3. UI-visible string changes → update all three locales + run i18n check.
4. Pause at phase boundaries so the user can manually verify.
5. If a task is blocked (`[!]`), write one line of why and move on.

## Change log

- 2026-04-23 — doc created, Phase 0 kicked off.
- 2026-04-23 — Phase 0 landed (0.1–0.3 done, 0.4 awaiting user verification).
- 2026-04-23 — Doc corrections after user review:
  - 1.4 deferred (contradicts AGENTS.md §7 in-page-prompt design); replaced by 1.4′ "harden in-page modal".
  - 1.1 scope rewritten — flagged as architectural change, not a local patch; 6 call sites enumerated.
  - 1.14 evidence corrected — one module-level `writeQueue` per V8 isolate, not "two instances".
  - 1.17 downgraded to observation — no concrete hang call chain from review; forcing `sendResponse` could cause false failures.
- 2026-04-23 — 1.4′ refined to "defense-in-depth, not threat elimination"; `isTrusted` only blocks synthetic events, capture-order precedence isn't guaranteed. Added 1.4-spec discussion placeholder.
- 2026-04-23 — Phase 1 starting with 1.3 + 1.15 + 1.8 (independent, small blast radius). 1.3 requires all-three locale updates.
- 2026-04-23 — Phase 1 batch 1 landed (1.3 + 1.15 + 1.8). compile ✓ i18n:check ✓. Awaiting user manual smoke before picking next Phase 1 items.
- 2026-04-23 — User override on batch sequencing: next batch is **1.9 + 1.10 only** (not merged with 1.11/1.12 — those touch runner lifecycle state machine and need a separate batch with manual smoke between). 1.11+1.12 → 1.4′ → 1.5+1.6 is the confirmed downstream order.
- 2026-04-23 — Phase 1 batch 2 landed (1.9 + 1.10). No UI, no locale, single file [importExport.ts](shared/importExport.ts). compile ✓ i18n:check ✓. Awaiting review before opening batch 3 (1.11+1.12).
- 2026-04-23 — 1.10 first-pass was **incomplete** (user caught it): original patch only clamped the comparison value, not the stored item — attacker still wins first overwrite AND poisons local state permanently. Re-fixed by shallow-copying the incoming record with clamped `updatedAt` before comparison + storage. compile ✓. Added known-follow-up: one-shot migration for already-poisoned pre-fix data.
- 2026-04-23 — Phase 1 batch 3 landed (1.11 + 1.12). Files touched: [stepExecution.ts](entrypoints/background/runner/stepExecution.ts), [bootstrap.ts](entrypoints/background/bootstrap.ts). compile ✓ i18n:check ✓. Awaiting review before opening batch 4 (1.4′).
- 2026-04-23 — 1.12 re-fix after user review: `onTabRemoved` no longer sets `cancelRequested` (semantic fix); `finalizeRun` made idempotent via `isRunFinalized` guard at top (defensive robustness — first-finalize-wins). Observability of `tab-closed` error code preserved end-to-end. compile ✓.
- 2026-04-23 — **Second regression from the idempotency guard (user caught):** `stop()` used to do a half-inline finalize and relied on `executeRun`'s catch to call `finalizeRun(cancelled)` a second time for `releaseActiveRun` + `scheduleCleanup`. With `finalizeRun` now idempotent that second call early-returns, and `activeRunByTab` leaks — re-introducing the exact `runner-busy` symptom 1.12 was meant to fix. Fixed by routing `stop()` through `finalizeRun` (unifies the terminal path: one function owns terminal cleanup). compile ✓.
- 2026-04-23 — Phase 1 batch 4 landed (1.4′). Single file: [flowRunner.ts](entrypoints/content/flowRunner.ts). Added capture-phase keyboard/clipboard shield around the in-page vault modal + `isTrusted` guards + input.value clear on close. compile ✓ i18n:check ✓. **Explicitly defense-in-depth; pre-registered window-capture page listeners still win.**
- 2026-04-23 — Phase 1 batch 5 landed (1.5 + 1.6). Files touched: [shared/messages.ts](shared/messages.ts), [flowRunner.ts](entrypoints/content/flowRunner.ts), [stepExecution.ts](entrypoints/background/runner/stepExecution.ts). Taint carrier = parallel `BuiltAtomicPayload` (literal union `TaintedPayloadField` = `value` | `expected` | `message` | `selector`) + `taintedVariables: Set<string>` in run state. Strictest transform propagation, explicit clean on set-variable. Content-side sensitive-element detection taints downstream variables; condition steps strip `actual` on the content side so only `conditionMatched` reaches the runner. `formatAtomicSuccessMessage` result type narrowed via `Omit` to keep `actual` out by construction. Four items deliberately deferred (declassify, condition vault-unlock retry, migration for pre-fix poisoned timestamps, `-webkit-text-security`/selector heuristics). compile ✓ i18n:check ✓.
- 2026-04-23 — Phase 1 batch 6 landed (2.1 + 2.3 + 2.4). Files touched: [stepExecution.ts](entrypoints/background/runner/stepExecution.ts), [flowRecorder.ts](entrypoints/content/flowRecorder.ts), [flowStepMigration.ts](shared/flowStepMigration.ts). Three independent boundary fixes: explicit navigate scheme allowlist, recorder-side autocomplete sensitive-field skip (mirrors 1.6), legacy import type whitelist belts the prototype-pollution fix from 1.9. compile ✓ i18n:check ✓.
- 2026-04-23 — Batch 5 follow-up (user review caught 3 gaps):
  - **Password input gate now accepts taint-propagated values (necessary fix).** Was: `payload.valueSource = isSecretTokenValue(rawValue) ? 'secret' : 'literal'` — only hit on exact `{{secret.X}}` raw match. Consequence: `{{var.X}}` where X is tainted (including via sensitive DOM read), transform outputs derived from secrets, and composed templates like `prefix-{{secret.X}}-suffix` all hit `password-literal-blocked` in content despite batch 5's pipeline marking them tainted. Now `payload.valueSource = resolvedInputValue.tainted ? 'secret' : 'literal'` — authoritative taint flag drives the gate. Removed now-unused `isSecretTokenValue` import.
  - **JS transform sandbox variable-leak channel closed (necessary fix).** Was: `context.variables` passed wholesale into sandbox. PoC: transform code `return variables.x` extracts a tainted variable's plaintext without any token appearing in the raw field, bypassing `isRawFieldTainted` — output then released as untainted. Fix: sanitize the variables map before handing to sandbox, replacing tainted entries with `[REDACTED]` placeholder (option C from user's review). User code still gets a readable string (not undefined) and behavior is predictable; real secret never crosses into the sandbox via this channel. row/loop untouched (not taint sources).
  - **`formatAtomicSuccessMessage` Omit widened to include `details.expected`.** `expected` echoes back from content verbatim and inherits full payload taint but has no dedicated redaction path. Not currently consumed by any formatter — fix is purely a type-level guard against future regressions (the same rationale as the original `actual` omission). `details.popupMessage` intentionally stayed — it's consumed as a fallback and manually redacted via the `message` taint flag; noted as a future cleanup target.
  - compile ✓ i18n:check ✓.
