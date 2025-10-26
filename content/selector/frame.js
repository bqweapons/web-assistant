import { normalizePageUrl } from '../common/url.js';
import { generateSelector } from './utils.js';

/**
 * Resolves metadata about the current frame hierarchy.
 * @param {Window} [win]
 * @returns {{
 *   frameSelectors: string[];
 *   frameLabel: string;
 *   frameUrl: string;
 *   pageUrl: string;
 *   sameOriginWithTop: boolean;
 * }}
 */
export function resolveFrameContext(win = window) {
  const targetWindow = win || window;
  const { selectors, sameOrigin } = collectFrameSelectors(targetWindow);
  const frameElement = safeFrameElement(targetWindow);
  const frameUrl = tryGetWindowUrl(targetWindow);
  const topUrl = sameOrigin ? tryGetWindowUrl(safeTopWindow(targetWindow)) : '';
  const pageUrl = normalizePageUrl(topUrl || frameUrl);
  const frameLabel = selectors.length > 0 ? describeFrameElement(frameElement) : '';
  return {
    frameSelectors: sameOrigin ? selectors : [],
    frameLabel: frameLabel || '',
    frameUrl: frameUrl || '',
    pageUrl: pageUrl || '',
    sameOriginWithTop: sameOrigin && Boolean(pageUrl) && Boolean(frameUrl),
  };
}

function collectFrameSelectors(win) {
  const selectors = [];
  let current = win;
  let sameOrigin = true;
  while (current && current !== current.parent) {
    if (!canAccessParent(current)) {
      sameOrigin = false;
      break;
    }
    const frameElement = safeFrameElement(current);
    if (!(frameElement instanceof Element)) {
      sameOrigin = false;
      break;
    }
    selectors.unshift(generateSelector(frameElement));
    try {
      current = current.parent;
    } catch (error) {
      sameOrigin = false;
      break;
    }
  }
  return { selectors: sameOrigin ? selectors : [], sameOrigin };
}

function canAccessParent(win) {
  try {
    if (win === win.parent) {
      return false;
    }
    void win.parent.document;
    return true;
  } catch (error) {
    return false;
  }
}

function safeFrameElement(win) {
  try {
    return win.frameElement || null;
  } catch (error) {
    return null;
  }
}

function safeTopWindow(win) {
  try {
    return win.top;
  } catch (error) {
    return win;
  }
}

function tryGetWindowUrl(win) {
  try {
    const { origin, pathname, search } = win.location;
    return `${origin}${pathname}${search}`;
  } catch (error) {
    return '';
  }
}

function describeFrameElement(element) {
  if (!(element instanceof Element)) {
    return '';
  }
  const localName = element.localName || 'frame';
  if (element.id) {
    return `${localName}#${element.id}`;
  }
  const name = element.getAttribute('name');
  if (name) {
    return `${localName}[name="${name}"]`;
  }
  const title = element.getAttribute('title');
  if (title) {
    return `${localName}[title="${title}"]`;
  }
  const src = element.getAttribute('src');
  if (src) {
    const normalized = normalizeFrameSource(src, element.ownerDocument);
    return `${localName}[src*="${normalized}"]`;
  }
  return localName;
}

function normalizeFrameSource(src, doc) {
  try {
    const base = doc?.location?.href || window.location.href;
    const url = new URL(src, base);
    return `${url.origin}${url.pathname}`.slice(0, 120);
  } catch (error) {
    return src.slice(0, 120);
  }
}
