const HIGHLIGHT_BORDER_COLOR = '#1b84ff';
const HIGHLIGHT_FILL_COLOR = 'rgba(27, 132, 255, 0.2)';

const cssEscape = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
  ? CSS.escape.bind(CSS)
  : /**
     * @param {string} value
     * @returns {string}
     */
    (value) => String(value).replace(/[^a-zA-Z0-9_\-]/g, (char) => `\\${char}`);

/**
 * Generates a unique CSS selector for the provided element using ids or nth-of-type fallback.
 * @param {Element} element
 * @returns {string}
 */
export function generateSelector(element) {
  if (!(element instanceof Element)) {
    throw new Error('Element required for selector generation.');
  }
  if (element.id && isIdUnique(element.id)) {
    return `#${cssEscape(element.id)}`;
  }

  const segments = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
    let segment = current.localName;
    if (!segment) {
      break;
    }
    if (current.id && isIdUnique(current.id)) {
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
}

/**
 * Starts the interactive element picker.
 * @param {{ onPick: (element: Element, selector: string) => void; onCancel?: () => void; filter?: (element: Element) => boolean }} options
 * @returns {{ stop: () => void }}
 */
export function startElementPicker(options) {
  const { onPick, onCancel, filter } = options;
  const overlay = createOverlay();
  document.body.appendChild(overlay.container);

  const handleMouseMove = (event) => {
    const hovered = resolveTarget(event.target);
    if (!hovered || (filter && !filter(hovered))) {
      overlay.hide();
      return;
    }
    overlay.show(hovered);
  };

  const handleClick = (event) => {
    const target = resolveTarget(event.target);
    if (!target || (filter && !filter(target))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cleanup();
    const selector = generateSelector(target);
    onPick(target, selector);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup();
      onCancel?.();
    }
  };

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  const cleanup = () => {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    overlay.dispose();
  };

  return { stop: cleanup };
}

/**
 * Determines whether an id is unique within the document.
 * @param {string} id
 * @returns {boolean}
 */
function isIdUnique(id) {
  return document.querySelectorAll(`#${cssEscape(id)}`).length === 1;
}

/**
 * Calculates the position of the element among siblings of the same type.
 * @param {Element} element
 * @returns {number}
 */
function nthOfType(element) {
  const parent = element.parentElement;
  if (!parent) {
    return 1;
  }
  const siblings = Array.from(parent.children).filter((node) => node.localName === element.localName);
  return siblings.indexOf(element) + 1;
}

/**
 * Resolves the best candidate element from an event target.
 * @param {EventTarget | null} target
 * @returns {Element | null}
 */
function resolveTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest('[data-page-augmentor-root]')) {
    return null;
  }
  return target;
}

/**
 * Creates the overlay used to highlight hovered elements.
 * @returns {{ container: HTMLDivElement; show: (element: Element) => void; hide: () => void; dispose: () => void }}
 */
function createOverlay() {
  const container = document.createElement('div');
  container.dataset.pageAugmentorRoot = 'picker-overlay';
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
    show(element) {
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
}
