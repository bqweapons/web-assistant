import type { PickerAccept, PickerRect, PickerResultPayload } from '../../shared/messages';

const HIGHLIGHT_BORDER_COLOR = '#1b84ff';
const HIGHLIGHT_FILL_COLOR = 'rgba(27, 132, 255, 0.2)';
const INPUT_TYPES = new Set(['text', 'password', 'email', 'number', 'search']);

const cssEscape =
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape.bind(CSS)
    : (value: string) => String(value).replace(/[^a-zA-Z0-9_\-]/g, (char) => `\\${char}`);

type PickerSession = {
  stop: () => void;
};

let currentSession: PickerSession | null = null;

const isIdUnique = (id: string, contextDocument: Document) => {
  try {
    return contextDocument.querySelectorAll(`#${cssEscape(id)}`).length === 1;
  } catch {
    return false;
  }
};

const nthOfType = (element: Element) => {
  const parent = element.parentElement;
  if (!parent) {
    return 1;
  }
  const siblings = Array.from(parent.children).filter((node) => node.localName === element.localName);
  return siblings.indexOf(element) + 1;
};

const generateSelector = (element: Element) => {
  if (!(element instanceof Element)) {
    throw new Error('Element required for selector generation.');
  }
  const contextDocument = element.ownerDocument || document;
  if (element.id && isIdUnique(element.id, contextDocument)) {
    return `#${cssEscape(element.id)}`;
  }
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== contextDocument.documentElement) {
    let segment = current.localName;
    if (!segment) {
      break;
    }
    if (current.id && isIdUnique(current.id, current.ownerDocument || contextDocument)) {
      segment = `${segment}#${cssEscape(current.id)}`;
      segments.unshift(segment);
      break;
    }
    const nth = nthOfType(current);
    if (nth > 1) {
      segment += `:nth-of-type(${nth})`;
    }
    segments.unshift(segment);
    current = current.parentElement;
  }
  return segments.join(' > ');
};

const resolveSiblingSelector = (element: Element | null) => {
  if (!element) {
    return undefined;
  }
  try {
    return generateSelector(element);
  } catch {
    return undefined;
  }
};

const resolveTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest('[data-picker-overlay]')) {
    return null;
  }
  return target;
};

const isInputTarget = (element: Element) => {
  if (element.getAttribute('contenteditable') === 'true') {
    return true;
  }
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') {
    return true;
  }
  if (tag === 'input') {
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return INPUT_TYPES.has(type);
  }
  return false;
};

const createOverlay = () => {
  const container = document.createElement('div');
  container.dataset.pickerOverlay = 'true';
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
  });

  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'absolute',
    pointerEvents: 'none',
    border: `2px solid ${HIGHLIGHT_BORDER_COLOR}`,
    backgroundColor: HIGHLIGHT_FILL_COLOR,
    borderRadius: '4px',
    transition: 'all 0.05s ease-out',
    boxSizing: 'border-box',
    opacity: '0',
  });
  container.appendChild(highlight);

  return {
    container,
    show(element: Element) {
      const rect = element.getBoundingClientRect();
      Object.assign(highlight.style, {
        opacity: '1',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    },
    hide() {
      highlight.style.opacity = '0';
    },
    dispose() {
      container.remove();
    },
  };
};

export const startPicker = (options: {
  accept?: PickerAccept;
  disallowInput?: boolean;
  onResult: (payload: PickerResultPayload) => void;
  onCancel: () => void;
  onInvalid?: (reason?: string) => void;
}): PickerSession => {
  if (currentSession) {
    currentSession.stop();
  }
  const { accept = 'selector', disallowInput = false, onResult, onCancel, onInvalid } = options;
  const overlay = createOverlay();
  const root = document.body || document.documentElement;
  root.appendChild(overlay.container);
  if (document.body) {
    document.body.style.cursor = 'crosshair';
  }

  let disposed = false;

  const isAllowed = (element: Element) => {
    if (accept === 'input') {
      return isInputTarget(element);
    }
    if (disallowInput && isInputTarget(element)) {
      return false;
    }
    return true;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (accept === 'area') {
      return;
    }
    const hovered = resolveTarget(event.target);
    if (!hovered || !isAllowed(hovered)) {
      overlay.hide();
      return;
    }
    overlay.show(hovered);
  };

  const handleClick = (event: MouseEvent) => {
    if (accept === 'area') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = resolveTarget(event.target);
    if (!target) {
      return;
    }
    if (!isAllowed(target)) {
      event.preventDefault();
      event.stopPropagation();
      onInvalid?.(accept === 'input' ? 'input-required' : disallowInput ? 'input-not-allowed' : 'invalid-target');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selector = generateSelector(target);
    const beforeSelector = resolveSiblingSelector(target.previousElementSibling);
    const afterSelector = resolveSiblingSelector(target.nextElementSibling);
    overlay.show(target);
    onResult({ selector, beforeSelector, afterSelector });
    dispose();
  };

  const selectionBox = document.createElement('div');
  Object.assign(selectionBox.style, {
    position: 'fixed',
    border: `2px solid ${HIGHLIGHT_BORDER_COLOR}`,
    backgroundColor: HIGHLIGHT_FILL_COLOR,
    borderRadius: '4px',
    pointerEvents: 'none',
    opacity: '0',
  });
  overlay.container.appendChild(selectionBox);
  let selecting = false;
  let startX = 0;
  let startY = 0;
  let startClientX = 0;
  let startClientY = 0;

  const updateSelectionBox = (clientX: number, clientY: number) => {
    const left = Math.min(startClientX, clientX);
    const top = Math.min(startClientY, clientY);
    const width = Math.abs(clientX - startClientX);
    const height = Math.abs(clientY - startClientY);
    Object.assign(selectionBox.style, {
      opacity: '1',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (accept !== 'area' || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selecting = true;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startX = event.clientX + window.scrollX;
    startY = event.clientY + window.scrollY;
    updateSelectionBox(event.clientX, event.clientY);
  };

  const handleAreaMove = (event: MouseEvent) => {
    if (accept !== 'area' || !selecting) {
      return;
    }
    updateSelectionBox(event.clientX, event.clientY);
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (accept !== 'area' || !selecting) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selecting = false;
    const endX = event.clientX + window.scrollX;
    const endY = event.clientY + window.scrollY;
    const rect: PickerRect = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    };
    onResult({ rect });
    dispose();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      dispose();
    }
  };

  const removeListeners = () => {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('mousemove', handleAreaMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
  };

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    removeListeners();
    overlay.dispose();
    if (document.body) {
      document.body.style.cursor = '';
    }
  };

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleAreaMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('keydown', handleKeyDown, true);

  currentSession = { stop: dispose };
  return currentSession;
};

export const stopPicker = () => {
  if (!currentSession) {
    return;
  }
  currentSession.stop();
  currentSession = null;
};
