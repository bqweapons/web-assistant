import { HOST_ATTRIBUTE, NODE_CLASS } from '../../core/constants.js';
import { generateSelector } from '../../../selector/utils.js';

const VOID_ELEMENT_TAGS = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'KEYGEN',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);

const AUGMENTOR_ROOT_SELECTOR = '[data-page-augmentor-root]';

function isVoidElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  return VOID_ELEMENT_TAGS.has(element.tagName);
}

export function findAreaDropTarget(clientX, clientY, excludeId) {
  const hosts = document.querySelectorAll(`[${HOST_ATTRIBUTE}]`);
  for (const host of hosts) {
    if (!(host instanceof HTMLElement)) continue;
    const elementId = host.getAttribute(HOST_ATTRIBUTE);
    if (!elementId || elementId === excludeId) continue;
    const shadow = host.shadowRoot;
    if (!shadow) continue;
    const areaNode = shadow.querySelector(`.${NODE_CLASS}[data-node-type='area']`);
    if (!(areaNode instanceof HTMLElement)) continue;
    const rect = areaNode.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const content = areaNode.querySelector('.page-augmentor-area-content');
      return {
        id: elementId,
        host,
        areaNode,
        content: content instanceof HTMLElement ? content : areaNode,
      };
    }
  }
  return null;
}

export function findDomDropTarget(clientX, clientY, draggedHost) {
  if (draggedHost instanceof HTMLElement) {
    const previous = draggedHost.style.pointerEvents;
    draggedHost.style.pointerEvents = 'none';
    try {
      const candidates = document.elementsFromPoint(clientX, clientY);
      for (const candidate of candidates) {
        if (!(candidate instanceof HTMLElement)) continue;
        if (candidate === draggedHost || draggedHost.contains(candidate)) continue;
        if (candidate.closest(`[${HOST_ATTRIBUTE}]`)) continue;
        if (candidate.closest(AUGMENTOR_ROOT_SELECTOR)) continue;
        return candidate;
      }
    } finally {
      draggedHost.style.pointerEvents = previous || '';
    }
    return null;
  }
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const candidate of candidates) {
    if (
      candidate instanceof HTMLElement &&
      !candidate.closest(`[${HOST_ATTRIBUTE}]`) &&
      !candidate.closest(AUGMENTOR_ROOT_SELECTOR)
    ) {
      return candidate;
    }
  }
  return null;
}

export function resolveDomDropPlacement(target, clientX, clientY) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target.closest(`[${HOST_ATTRIBUTE}]`)) {
    return null;
  }
  if (target === document.documentElement) {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
      return null;
    }
    const bodyRect = body.getBoundingClientRect();
    return {
      reference: body,
      selector: 'body',
      position: 'append',
      indicator: {
        mode: 'box',
        top: bodyRect.top,
        left: bodyRect.left,
        width: bodyRect.width,
        height: bodyRect.height,
      },
    };
  }
  const rect = target.getBoundingClientRect();
  const height = rect.height || 1;
  const relY = (clientY - rect.top) / height;

  let selector;
  try {
    selector = generateSelector(target);
  } catch (_error) {
    selector = '';
  }
  if (!selector) {
    return null;
  }

  if (isVoidElement(target) || !target.parentElement) {
    const position = relY < 0.5 ? 'before' : 'after';
    const lineTop = position === 'before' ? rect.top : rect.bottom;
    return {
      reference: target,
      selector,
      position,
      indicator: {
        mode: 'line',
        top: lineTop - 2,
        left: rect.left,
        width: rect.width,
        height: 4,
      },
    };
  }

  if (relY < 0.25) {
    return {
      reference: target,
      selector,
      position: 'prepend',
      indicator: {
        mode: 'box',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  if (relY > 0.75) {
    return {
      reference: target,
      selector,
      position: 'append',
      indicator: {
        mode: 'box',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  return {
    reference: target,
    selector,
    position: 'append',
    indicator: {
      mode: 'box',
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  };
}





