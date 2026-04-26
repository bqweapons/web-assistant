import type { FlowRunUnlockContextResponse } from '../../../shared/messages';
import type { PendingUnlockRequest } from './types';

// 1.4 — Vault unlock window ↔ runner coordination.
//
// Owns the pending-unlock map, the chrome.windows popup lifecycle, and
// the small set of bookkeeping methods that bootstrap.ts message
// handlers call (SUBMIT / CANCEL / CONTEXT, plus the
// chrome.windows.onRemoved watchdog).
//
// Deliberately does NOT own `awaitVaultUnlock` — that coroutine drives
// run state transitions (paused/running), sentinel refreshes, and log
// emission; those side effects belong to the FlowRunnerManager and
// threading five callbacks through here would be strictly worse than
// leaving them in the class. The class holds a coordinator instance
// and delegates only the map / window operations.
//
// The retired pre-1.4 in-page `promptFlowVaultUnlockOnPage` prompt
// path has already been removed upstream; nothing here references it.
export class VaultUnlockCoordinator {
  // 1.4 — pending vault-unlock requests keyed by runId. At most one
  // entry at a time in practice (activeRunByTab caps concurrent runs
  // globally), but using a Map keeps the lookup shape consistent with
  // the rest of the runner and naturally handles the windowId-indexed
  // lookup that `chrome.windows.onRemoved` needs.
  private readonly pendingUnlockRequests = new Map<string, PendingUnlockRequest>();

  has(runId: string): boolean {
    return this.pendingUnlockRequests.has(runId);
  }

  get(runId: string): PendingUnlockRequest | undefined {
    return this.pendingUnlockRequests.get(runId);
  }

  set(runId: string, entry: PendingUnlockRequest): void {
    this.pendingUnlockRequests.set(runId, entry);
  }

  delete(runId: string): boolean {
    return this.pendingUnlockRequests.delete(runId);
  }

  getContext(runId: string): FlowRunUnlockContextResponse {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return { ok: false, code: 'run-not-pending' };
    }
    return {
      ok: true,
      runId: entry.runId,
      flowName: entry.flowName,
      stepTitle: entry.stepTitle,
      siteKey: entry.siteKey,
      attempt: entry.attempt,
      lastErrorMessage: entry.lastErrorMessage,
    };
  }

  getAttempt(runId: string): number {
    return this.pendingUnlockRequests.get(runId)?.attempt ?? 0;
  }

  recordAttemptFailure(runId: string, errorMessage: string): void {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return;
    }
    entry.attempt += 1;
    entry.lastErrorMessage = errorMessage;
  }

  resolve(runId: string): void {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return;
    }
    this.pendingUnlockRequests.delete(runId);
    if (entry.windowId !== null) {
      void this.closeUnlockWindow(entry.windowId);
    }
    entry.resolve();
  }

  reject(runId: string, reason: 'cancelled' | 'interrupted'): void {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return;
    }
    this.pendingUnlockRequests.delete(runId);
    if (entry.windowId !== null) {
      // For explicit cancel (button in the window) we also close the
      // window so the user isn't left staring at a resolved dialog.
      // For `interrupted` (windows.onRemoved), the window is already
      // closing — closeUnlockWindow is a no-op.
      void this.closeUnlockWindow(entry.windowId);
    }
    entry.reject(reason);
  }

  // Review fix — called by the SUBMIT handler in bootstrap before and
  // after the unlockSecretsVault call. The inFlight flag suppresses
  // the windows.onRemoved watchdog's reject so a correct-password
  // submit that races a user-initiated window close doesn't fail the
  // run. Returns true if the entry still exists.
  markSubmitStart(runId: string): boolean {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return false;
    }
    entry.submitInFlight = true;
    return true;
  }

  // Pair to markSubmitStart. Returns whether the window was closed
  // while the submit was in flight — SUBMIT callers use this on the
  // invalid-password path to decide whether to reject the run (window
  // gone, nowhere to retry) or leave it pending.
  markSubmitEnd(runId: string): { closedDuringSubmit: boolean } {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return { closedDuringSubmit: false };
    }
    const closedDuringSubmit = entry.closedDuringSubmit;
    entry.submitInFlight = false;
    entry.closedDuringSubmit = false;
    return { closedDuringSubmit };
  }

  // Review fix — single entry point for the windows.onRemoved
  // watchdog. If the matching entry has submitInFlight=true, record
  // closedDuringSubmit and return without rejecting; the SUBMIT
  // handler's markSubmitEnd will handle the race. Otherwise treat
  // as a user-initiated close and reject the run.
  handleWindowRemoved(windowId: number): void {
    for (const [runId, entry] of this.pendingUnlockRequests) {
      if (entry.windowId !== windowId) {
        continue;
      }
      if (entry.submitInFlight) {
        entry.closedDuringSubmit = true;
        return;
      }
      this.reject(runId, 'cancelled');
      return;
    }
  }

  // 1.4 — Called while awaiting settlement to iterate the map for
  // finalize-driven cleanup. Returns the entry (which has already
  // been removed from the map) so the caller can reject it with the
  // appropriate reason and close the window.
  takeAndReject(runId: string, reason: 'cancelled' | 'interrupted'): void {
    const entry = this.pendingUnlockRequests.get(runId);
    if (!entry) {
      return;
    }
    this.pendingUnlockRequests.delete(runId);
    if (entry.windowId !== null) {
      void this.closeUnlockWindow(entry.windowId);
    }
    entry.reject(reason);
  }

  // 1.4 — `chrome.windows.create` wrapper. Returns the created
  // windowId (numeric) or null if the API is unavailable. Throws on
  // creation failure; caller converts to `secret-vault-unlock-prompt-
  // unavailable`.
  async openUnlockWindow(runId: string): Promise<number | null> {
    const chromeGlobal = typeof chrome !== 'undefined' ? chrome : undefined;
    const windowsApi = chromeGlobal?.windows;
    const runtimeApi = chromeGlobal?.runtime;
    if (!windowsApi?.create || !runtimeApi?.getURL) {
      throw new Error('chrome.windows API unavailable.');
    }
    // WXT's typed `getURL` overloads only accept declared entrypoint
    // paths; the new vaultUnlock entrypoint isn't yet in the auto-
    // generated `PublicPath` union. Cast through `unknown` so the call
    // compiles today and starts being typed correctly once the
    // entrypoint is picked up. No runtime difference.
    const getURL = runtimeApi.getURL as unknown as (path: string) => string;
    const url = getURL(`vaultUnlock.html?runId=${encodeURIComponent(runId)}`);
    const width = 420;
    const height = 370;
    // Review fix — chrome.windows.create does not center by default
    // (it opens at the top-left of the display). Compute position
    // relative to the currently-focused window so the popup lands in
    // the user's line of sight. Tolerate failures silently; a non-
    // centered popup is better than throwing.
    let left: number | undefined;
    let top: number | undefined;
    try {
      const focused = await windowsApi.getLastFocused?.({ populate: false });
      if (focused
        && typeof focused.left === 'number'
        && typeof focused.top === 'number'
        && typeof focused.width === 'number'
        && typeof focused.height === 'number'
      ) {
        left = Math.round(focused.left + (focused.width - width) / 2);
        top = Math.round(focused.top + (focused.height - height) / 2);
      }
    } catch {
      // ignore — fall back to default placement
    }
    const created = await windowsApi.create({
      url,
      type: 'popup',
      focused: true,
      width,
      height,
      ...(left !== undefined ? { left } : {}),
      ...(top !== undefined ? { top } : {}),
    });
    return typeof created?.id === 'number' ? created.id : null;
  }

  async focusUnlockWindow(windowId: number): Promise<void> {
    const windowsApi = chrome?.windows;
    if (!windowsApi?.update) {
      return;
    }
    try {
      await windowsApi.update(windowId, { focused: true });
    } catch (error) {
      console.warn('vault-unlock-window-focus-failed', error);
    }
  }

  async closeUnlockWindow(windowId: number): Promise<void> {
    const windowsApi = chrome?.windows;
    if (!windowsApi?.remove) {
      return;
    }
    try {
      await windowsApi.remove(windowId);
    } catch (error) {
      // Swallow: window may have already been closed by the user or
      // by Chrome's GC. No harm — the pending entry is already gone.
      console.warn('vault-unlock-window-close-failed', error);
    }
  }
}
