import { useEffect, useRef, type RefObject } from 'react';

// 2.8 — focus trap shared by every sidepanel modal (ConfirmDialog,
// PasswordPromptDialog, PasswordVaultManager viewer, FlowDrawer, Drawer).
//
// Behavior contract:
//   - On open: if the panel does NOT already contain `document.activeElement`,
//     focus the first tabbable element. Skipping when the panel already has
//     focus preserves dialog-owned explicit focus calls (e.g.
//     PasswordPromptDialog focuses its <input> via requestAnimationFrame).
//   - Tab at the last tabbable wraps to the first; Shift+Tab at the first
//     wraps to the last. Tab outside the panel cannot escape.
//   - Escape calls `onEscape` once. Single owner — host components must NOT
//     register their own Escape listener; if they have one, remove it when
//     adopting this hook to avoid double-fire (cancel-then-cancel) which can
//     prematurely advance flows that re-open the modal in onCancel.
//   - On close: restore focus to whatever held it before open.
//
// Nested-modal handling (2.8-follow — caught during review):
//   Multiple modals can be open simultaneously (e.g. the password-vault
//   viewer opens a ConfirmDialog for delete confirmation). Each open trap
//   used to register its own document-capture keydown listener, and all of
//   them fired on every keystroke. Consequences:
//     - Escape hit onEscape on every stacked trap, closing the whole chain.
//     - Tab saw the activeElement sitting inside the child dialog from the
//       parent's view — parent's `!panel.contains(active)` branch pulled
//       focus back into the parent, breaking Tab navigation inside the
//       child.
//   Fix: module-level `trapStack` of per-open-cycle symbols. On mount each
//   trap pushes; on unmount it pops. The keydown handler short-circuits
//   unless its own ID is the top of stack. Non-top traps stay registered
//   (so they resume when the modal above them closes) but act as no-ops.
//
// Intentionally not implemented: aria-hidden of background tree, scroll lock
// (FlowDrawer handles its own), portal-mounting. Scope is keyboard focus
// behavior only.

const trapStack: symbol[] = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const collectTabbable = (root: HTMLElement): HTMLElement[] => {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((node) => {
    if (node.hasAttribute('disabled')) {
      return false;
    }
    if (node.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    // offsetParent === null on display:none subtrees; covers most "not
    // visible" cases without an expensive computed-style lookup.
    if (node.offsetParent === null && node.tagName !== 'BODY') {
      // Allow elements positioned `fixed` (offsetParent is null but they're
      // visible). `getClientRects` gives us a cheap fallback signal.
      if (node.getClientRects().length === 0) {
        return false;
      }
    }
    return true;
  });
};

export const useFocusTrap = (
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  onEscape?: () => void,
) => {
  // Stable refs so we can re-read latest callbacks without restarting the
  // effect on every render. The effect only depends on `open`.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const previousActiveElement =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    // One symbol per open-cycle. Allocated here (not at hook-call level)
    // so close→reopen gets a fresh identity; there's no state to stale.
    const trapId = Symbol('focusTrap');
    trapStack.push(trapId);
    const isTop = () => trapStack.length > 0 && trapStack[trapStack.length - 1] === trapId;

    // Initial focus: only if panel doesn't already own focus. Lets host
    // components drive their own preferred focus target (e.g. an input
    // rather than the panel itself). Only run for the top-of-stack trap
    // — a trap that opens while sitting under another (rare, but possible
    // during a rapid reflow) must not yank focus away from what the
    // active top-level modal already owns.
    if (isTop() && !panel.contains(document.activeElement)) {
      const tabbables = collectTabbable(panel);
      const target = tabbables[0] ?? panel;
      target.focus();
    }

    const handleKey = (event: KeyboardEvent) => {
      // Nested-modal guard: only the top-of-stack trap handles keys.
      // Non-top traps return immediately so parent modals don't yank
      // focus away from a child dialog (Tab) or double-cancel on Escape.
      if (!isTop()) {
        return;
      }
      if (event.key === 'Escape') {
        if (onEscapeRef.current) {
          event.preventDefault();
          onEscapeRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const tabbables = collectTabbable(panel);
      if (tabbables.length === 0) {
        // Nothing tabbable inside; trap by keeping focus on the panel.
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      const idx = trapStack.indexOf(trapId);
      if (idx !== -1) {
        trapStack.splice(idx, 1);
      }
      // Restore prior focus on close. Guard against the prior element
      // having been removed from the DOM during the modal's lifetime
      // (`focus` on a detached node is a no-op but the typeof check is
      // cheaper than letting it fail silently).
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        if (document.contains(previousActiveElement)) {
          previousActiveElement.focus();
        }
      }
    };
  }, [open, panelRef]);
};
