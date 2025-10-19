const HOST_ATTRIBUTE = 'data-page-augmentor-id';
const HOST_CLASS = 'page-augmentor-host';
const NODE_CLASS = 'page-augmentor-node';
const ALLOWED_STYLE_KEYS = new Set([
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'color',
  'backgroundColor',
  'fontSize',
  'padding',
  'borderRadius',
]);

/** @type {Map<string, import('../common/types.js').InjectedElement>} */
const elements = new Map();
/** @type {Map<string, HTMLElement>} */
const hosts = new Map();

/**
 * Ensures an element is rendered in the DOM, creating or updating it as needed.
 * @param {import('../common/types.js').InjectedElement} element
 * @returns {boolean}
 */
export function ensureElement(element) {
  elements.set(element.id, element);
  let host = hosts.get(element.id);
  if (!host || !document.contains(host)) {
    host = createHost(element);
    const inserted = insertHost(host, element);
    if (!inserted) {
      host.remove();
      return false;
    }
    hosts.set(element.id, host);
  } else {
    applyMetadata(host, element);
  }
  return true;
}

/**
 * Updates an existing element's DOM instance.
 * @param {import('../common/types.js').InjectedElement} element
 * @returns {boolean}
 */
export function updateElement(element) {
  elements.set(element.id, element);
  const host = hosts.get(element.id);
  if (!host || !document.contains(host)) {
    return ensureElement(element);
  }
  applyMetadata(host, element);
  return true;
}

/**
 * Removes an injected element from the DOM.
 * @param {string} elementId
 * @returns {boolean}
 */
export function removeElement(elementId) {
  elements.delete(elementId);
  const host = hosts.get(elementId);
  if (host) {
    hosts.delete(elementId);
    host.remove();
    return true;
  }
  return false;
}

/**
 * Re-inserts all known elements, typically after DOM mutations.
 * @returns {void}
 */
export function reconcileElements() {
  for (const element of elements.values()) {
    ensureElement(element);
  }
}

/**
 * Retrieves a stored element by identifier.
 * @param {string} elementId
 * @returns {import('../common/types.js').InjectedElement | undefined}
 */
export function getElement(elementId) {
  return elements.get(elementId);
}

/**
 * Highlights the injected element by id.
 * @param {string} elementId
 * @returns {boolean}
 */
export function focusElement(elementId) {
  const host = hosts.get(elementId);
  if (!host || !document.contains(host)) {
    return false;
  }
  host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashHighlight(host);
  return true;
}

/**
 * Returns all known elements.
 * @returns {import('../common/types.js').InjectedElement[]}
 */
export function listElements() {
  return Array.from(elements.values());
}

/**
 * Creates a host node with shadow DOM.
 * @param {import('../common/types.js').InjectedElement} element
 * @returns {HTMLElement}
 */
function createHost(element) {
  const host = document.createElement('span');
  host.className = HOST_CLASS;
  host.setAttribute(HOST_ATTRIBUTE, element.id);
  host.part = 'page-augmentor-host';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: inline-flex;
      max-width: max-content;
    }
    button, a {
      all: unset;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      background-color: #1b84ff;
      color: #fff;
      text-decoration: none;
      font-size: 0.95rem;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    button:hover, a:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.18);
    }
    button:focus-visible, a:focus-visible {
      outline: 2px solid #1b84ff;
      outline-offset: 2px;
    }
    .${NODE_CLASS} {
      pointer-events: auto;
    }
    .flash-outline {
      animation: flash-outline 1.1s ease-out forwards;
    }
    @keyframes flash-outline {
      0% {
        box-shadow: 0 0 0 0 rgba(27, 132, 255, 0.7);
      }
      100% {
        box-shadow: 0 0 0 12px rgba(27, 132, 255, 0);
      }
    }
  `;
  shadowRoot.appendChild(style);

  const node = element.type === 'link' ? document.createElement('a') : document.createElement('button');
  node.className = NODE_CLASS;
  node.textContent = element.text;
  if (element.type === 'link') {
    const sanitized = sanitizeUrl(element.href || '');
    if (sanitized) {
      node.setAttribute('href', sanitized);
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }
  } else if (node instanceof HTMLButtonElement) {
    node.type = 'button';
    applyButtonBehavior(node, element.href);
  }
  shadowRoot.appendChild(node);
  applyStyle(node, element.style);
  return host;
}

/**
 * Applies metadata (text, href, style) to an existing host.
 * @param {HTMLElement} host
 * @param {import('../common/types.js').InjectedElement} element
 */
function applyMetadata(host, element) {
  const shadow = host.shadowRoot;
  if (!shadow) {
    return;
  }
  const node = shadow.querySelector(`.${NODE_CLASS}`);
  if (!node) {
    return;
  }
  node.textContent = element.text;
  if (element.type === 'link') {
    const sanitized = sanitizeUrl(element.href || '');
    if (sanitized) {
      node.setAttribute('href', sanitized);
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    } else {
      node.removeAttribute('href');
    }
  } else {
    node.removeAttribute('href');
    applyButtonBehavior(/** @type {HTMLButtonElement} */ (node), element.href);
  }
  applyStyle(node, element.style);
}

/**
 * Attempts to insert a host using the stored selector and position.
 * @param {HTMLElement} host
 * @param {import('../common/types.js').InjectedElement} element
 * @returns {boolean}
 */
function insertHost(host, element) {
  const target = resolveSelector(element.selector);
  if (!target) {
    return false;
  }
  switch (element.position) {
    case 'append':
      target.appendChild(host);
      break;
    case 'prepend':
      target.insertBefore(host, target.firstChild);
      break;
    case 'before':
      if (!target.parentElement) {
        return false;
      }
      target.parentElement.insertBefore(host, target);
      break;
    case 'after':
      if (!target.parentElement) {
        return false;
      }
      target.parentElement.insertBefore(host, target.nextSibling);
      break;
    default:
      target.appendChild(host);
  }
  return true;
}

/**
 * Configures optional click navigation for button elements.
 * @param {HTMLButtonElement} node
 * @param {string | undefined} href
 */
function applyButtonBehavior(node, href) {
  if (!(node instanceof HTMLButtonElement)) {
    return;
  }
  const sanitized = sanitizeUrl(href || '');
  if (sanitized) {
    node.dataset.href = sanitized;
    node.onclick = (event) => {
      event.preventDefault();
      window.open(sanitized, '_blank', 'noopener');
    };
  } else {
    delete node.dataset.href;
    node.onclick = null;
  }
}

/**
 * Applies user-provided styles from the whitelist to the node.
 * @param {HTMLElement} node
 * @param {import('../common/types.js').InjectedElementStyle | undefined} style
 */
function applyStyle(node, style) {
  const whitelist = style || {};
  ALLOWED_STYLE_KEYS.forEach((key) => {
    const value = whitelist[key];
    if (typeof value === 'string' && value.trim() !== '') {
      node.style[key] = value.trim();
    } else {
      node.style.removeProperty(kebabCase(key));
    }
  });
}

/**
 * Converts camelCase keys to kebab-case CSS property names.
 * @param {string} value
 * @returns {string}
 */
function kebabCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Attempts to parse and validate provided URLs.
 * @param {string} href
 * @returns {string | null}
 */
function sanitizeUrl(href) {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, window.location.href);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return url.href;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Resolves a selector safely.
 * @param {string} selector
 * @returns {Element | null}
 */
function resolveSelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (error) {
    return null;
  }
}

/**
 * Plays a short highlight animation around the host element.
 * @param {HTMLElement} host
 */
function flashHighlight(host) {
  const shadow = host.shadowRoot;
  if (!shadow) {
    return;
  }
  const node = shadow.querySelector(`.${NODE_CLASS}`);
  if (!node) {
    return;
  }
  node.classList.remove('flash-outline');
  void node.offsetWidth; // force reflow
  node.classList.add('flash-outline');
}
