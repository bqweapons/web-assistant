const cssEscape =
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape.bind(CSS)
    : /**
       * @param {string} value
       * @returns {string}
       */
      (value) => String(value).replace(/[^a-zA-Z0-9_\-]/g, (char) => `\\${char}`);

/**
 * Determines whether an id is unique within the provided document context.
 * @param {string} id
 * @param {Document} [contextDocument]
 * @returns {boolean}
 */
function isIdUnique(id, contextDocument) {
  try {
    return (contextDocument || document).querySelectorAll(`#${cssEscape(id)}`).length === 1;
  } catch (error) {
    return false;
  }
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
export function resolveTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest('[data-page-augmentor-root]')) {
    return null;
  }
  return target;
}

/**
 * Generates a unique CSS selector for the provided element using ids or nth-of-type fallback.
 * @param {Element} element
 * @returns {string}
 */
export function generateSelector(element) {
  if (!(element instanceof Element)) {
    throw new Error('Element required for selector generation.');
  }
  const contextDocument = element.ownerDocument || document;
  if (element.id && isIdUnique(element.id, contextDocument)) {
    return `#${cssEscape(element.id)}`;
  }

  const segments = [];
  let current = element;
  while (
    current &&
    current.nodeType === Node.ELEMENT_NODE &&
    current !== contextDocument.documentElement
  ) {
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
}

export { cssEscape };
