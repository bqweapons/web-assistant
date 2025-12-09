import { createOverlay } from '../../selector/overlay.js';
import { generateSelector, resolveTarget } from '../../selector/utils.js';

const CLICKABLE_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'image']);
const INPUT_EXCLUDED_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'image',
  'checkbox',
  'radio',
  'file',
  'color',
  'range',
  'hidden',
]);

const DEFAULT_PICKER_HINT = 'Click a target element, then press Esc to cancel.';

/**
 * Starts the DOM picker overlay.
 * @param {{
 *   accept?: 'clickable' | 'input';
 *   hint?: string;
 *   onSelect?: (selector: string) => void;
 *   onCancel?: () => void;
 * }} [options]
 * @returns {() => void} stop function
 */
export function startPicker(options = {}) {
  const { accept = 'clickable', hint, onSelect, onCancel } = options;
  const finder = accept === 'input' ? findInputElement : findClickableElement;
  const overlay = createOverlay();
  document.body.appendChild(overlay.container);
  const hintText = typeof hint === 'string' && hint.trim() ? hint.trim() : DEFAULT_PICKER_HINT;

  const hintBar = document.createElement('div');
  hintBar.textContent = hintText;
  hintBar.setAttribute('role', 'status');
  hintBar.setAttribute('aria-live', 'polite');
  Object.assign(hintBar.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 14px',
    borderRadius: '999px',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    color: '#f8fafc',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.01em',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.35)',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });
  overlay.container.appendChild(hintBar);

  const originalCursor = document.body.style.cursor;
  document.body.style.cursor = 'crosshair';

  let active = true;

  const stop = (reason = 'cancel') => {
    if (!active) {
      return;
    }
    active = false;
    document.removeEventListener('mousemove', handleMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeydown, true);
    overlay.dispose();
    document.body.style.cursor = originalCursor || '';
    if (reason !== 'select' && typeof onCancel === 'function') {
      onCancel();
    }
  };

  const handleMove = (event) => {
    if (!active) {
      return;
    }
    const candidate = finder(event.target);
    if (!candidate) {
      overlay.hide();
      return;
    }
    overlay.show(candidate);
  };

  const handleClick = (event) => {
    if (!active) {
      return;
    }
    const candidate = finder(event.target);
    if (!candidate) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selector = generateSelector(candidate);
    if (typeof onSelect === 'function') {
      onSelect(selector);
    }
    stop('select');
  };

  const handleKeydown = (event) => {
    if (!active) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stop('cancel');
    }
  };

  document.addEventListener('mousemove', handleMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeydown, true);

  return (reason) => stop(reason);
}

/**
 * Attempts to find a clickable element from the provided target.
 * @param {EventTarget | null} target
 * @returns {Element | null}
 */
export function findClickableElement(target) {
  let current = resolveTarget(target);
  while (current) {
    if (isClickableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Attempts to find an input element from the provided target.
 * @param {EventTarget | null} target
 * @returns {Element | null}
 */
export function findInputElement(target) {
  let current = resolveTarget(target);
  while (current) {
    if (current instanceof HTMLLabelElement && current.control) {
      if (isTypeableInputElement(current.control)) {
        return current.control;
      }
    }
    if (isTypeableInputElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isClickableElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  if (element instanceof HTMLButtonElement) {
    return true;
  }
  if (element instanceof HTMLInputElement && CLICKABLE_INPUT_TYPES.has(element.type)) {
    return true;
  }
  if (element instanceof HTMLAnchorElement && element.href) {
    return true;
  }
  const role = element.getAttribute('role');
  if (role && ['button', 'link'].includes(role.toLowerCase())) {
    return true;
  }
  if (typeof element.onclick === 'function') {
    return true;
  }
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex !== null && Number(tabIndex) >= 0) {
    return true;
  }
  try {
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') {
      return true;
    }
  } catch (_error) {
    // Ignore style lookup failures.
  }
  return false;
}

function isTypeableInputElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  if (element instanceof HTMLTextAreaElement) {
    return true;
  }
  if (element instanceof HTMLInputElement) {
    const type = element.type ? element.type.toLowerCase() : '';
    return !INPUT_EXCLUDED_TYPES.has(type);
  }
  if (element instanceof HTMLSelectElement) {
    return true;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }
  return false;
}
