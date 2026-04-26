import {
  applyInlineStyles,
  formatCustomCss,
  mergeStyleRules,
  normalizeStyleRules,
  parseCustomCss,
} from './style';
import {
  getElementAfterSelector,
  getElementBeforeSelector,
  getElementContainerId,
  getElementHref,
  getElementLayout,
  getElementLinkTarget,
  getElementPosition,
  getElementSelector,
  getElementTooltipPosition,
  getElementType,
  isElementFloating,
  type RuntimeElement,
} from './shared';
import { registry } from './registry';
import {
  EDITING_ATTR,
  FLOATING_Z_INDEX,
  HOST_ATTR,
} from './types';

export const applyHostPlacementStyles = (host: HTMLElement, element: RuntimeElement) => {
  const merged = mergeStyleRules(element);
  const nextPosition = merged.position?.trim();
  host.style.position = nextPosition || (isElementFloating(element) ? 'absolute' : host.style.position || 'relative');
  host.style.left = merged.left?.trim() || '';
  host.style.top = merged.top?.trim() || '';
  host.style.right = merged.right?.trim() || '';
  host.style.bottom = merged.bottom?.trim() || '';
  host.style.zIndex = merged.zIndex?.trim() || '';
};

export const applyHostContainerOrderStyle = (host: HTMLElement, element: RuntimeElement) => {
  const rules = mergeStyleRules(element);
  const order = rules.order?.trim() || '';
  host.style.order = getElementContainerId(element) ? order : '';
};

export const stripPositioningFromStyle = (style?: RuntimeElement['style']) => {
  const merged = {
    ...(style?.inline || {}),
    ...parseCustomCss(style?.customCss || ''),
  };
  delete merged.position;
  delete merged.left;
  delete merged.top;
  delete merged.right;
  delete merged.bottom;
  delete merged.zIndex;
  const normalized = normalizeStyleRules(merged);
  return {
    preset: style?.preset,
    inline: normalized,
    customCss: formatCustomCss(normalized),
  };
};

const createHostWithShadow = (element: RuntimeElement) => {
  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, element.id);
  host.setAttribute(EDITING_ATTR, 'false');
  host.dataset.type = getElementType(element);
  host.dataset.shadow = 'true';
  host.style.position = 'relative';
  host.style.boxSizing = 'border-box';
  host.style.display = 'inline-block';
  host.style.pointerEvents = 'auto';

  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: inline-block;
      box-sizing: border-box;
      position: relative;
      pointer-events: auto;
      vertical-align: top;
    }
    * { box-sizing: border-box; }
    .ladybird-reset {
      all: unset;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1.4;
      pointer-events: auto;
    }
    .ladybird-edit-target {
      display: block;
      width: auto;
      min-height: 1px;
    }
    :host([data-ladybird-editing='true']) .ladybird-edit-target {
      outline: 2px dashed rgba(27, 132, 255, 0.8);
      outline-offset: 2px;
    }
    .ladybird-area {
      background: rgba(46, 125, 50, 0.08);
      border: 1px dashed rgba(46, 125, 50, 0.4);
      border-radius: 14px;
      padding: 10px;
      color: #0f172a;
      min-height: 48px;
      display: flex;
      gap: 8px;
    }
    .ladybird-area.ladybird-area-drop-target {
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.42) inset;
      background: rgba(34, 197, 94, 0.12);
    }
    .ladybird-button {
      background: #1b84ff;
      color: #ffffff;
      border-radius: 8px;
      padding: 8px 16px;
      font-weight: 600;
      font-size: 12px;
      border: none;
      cursor: pointer;
    }
    .ladybird-link {
      color: #2563eb;
      text-decoration: underline;
      font-size: 12px;
      cursor: pointer;
    }
    .ladybird-tooltip {
      background: #0f172a;
      color: #ffffff;
      border-radius: 10px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      pointer-events: none;
    }
    .ladybird-resize-handle {
      position: absolute;
      width: 11px;
      height: 11px;
      border-radius: 9999px;
      border: 1px solid #ffffff;
      background: #1b84ff;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
      z-index: 3;
      display: none;
      pointer-events: auto;
    }
    :host([data-ladybird-editing='true']) .ladybird-resize-handle {
      display: block;
    }
    .ladybird-resize-handle[data-ladybird-resize-handle='e'] {
      right: -6px;
      top: 50%;
      transform: translate(50%, -50%);
      cursor: ew-resize;
    }
    .ladybird-resize-handle[data-ladybird-resize-handle='s'] {
      left: 50%;
      bottom: -6px;
      transform: translate(-50%, 50%);
      cursor: ns-resize;
    }
    .ladybird-resize-handle[data-ladybird-resize-handle='se'] {
      right: -6px;
      bottom: -6px;
      transform: translate(50%, 50%);
      cursor: nwse-resize;
    }
  `;
  root.appendChild(style);
  return { host, root };
};

export const createElementNode = (element: RuntimeElement) => {
  const { host, root } = createHostWithShadow(element);
  let node: HTMLElement;

  switch (getElementType(element)) {
    case 'button': {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = element.text || 'Button';
      button.className = 'ladybird-reset ladybird-edit-target ladybird-button';
      node = button;
      break;
    }
    case 'link': {
      const anchor = document.createElement('a');
      anchor.textContent = element.text || getElementHref(element) || 'Link';
      anchor.href = getElementHref(element) || '#';
      anchor.target = getElementLinkTarget(element) === 'same-tab' ? '_self' : '_blank';
      anchor.rel = 'noreferrer noopener';
      anchor.className = 'ladybird-reset ladybird-edit-target ladybird-link';
      node = anchor;
      break;
    }
    case 'tooltip': {
      const tooltip = document.createElement('div');
      tooltip.textContent = element.text || 'Tooltip';
      tooltip.className = 'ladybird-reset ladybird-edit-target ladybird-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.zIndex = '2147482001';
      node = tooltip;
      break;
    }
    case 'area':
    default: {
      const area = document.createElement('div');
      area.className = 'ladybird-reset ladybird-edit-target ladybird-area';
      area.style.flexDirection = getElementLayout(element) === 'column' ? 'column' : 'row';
      node = area;
      break;
    }
  }

  if (isElementFloating(element)) {
    applyHostPlacementStyles(host, element);
    applyInlineStyles(node, element, { omitPositioning: true });
  } else {
    applyInlineStyles(node, element);
  }
  applyHostContainerOrderStyle(host, element);

  root.appendChild(node);
  return { host, root, content: node };
};

export const resolveTarget = (selector?: string) => {
  if (!selector) {
    return null;
  }
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch {
    return null;
  }
};

export const removeExistingHosts = (id: string, exceptNode?: HTMLElement) => {
  const selector = `[${HOST_ATTR}="${id}"]`;
  document.querySelectorAll(selector).forEach((node) => {
    if (node instanceof HTMLElement && node !== exceptNode) {
      node.remove();
    }
  });
};

export const insertNode = (host: HTMLElement, element: RuntimeElement) => {
  const containerId = getElementContainerId(element);
  const containerEntry = containerId ? registry.get(containerId) : null;
  const containerTarget = containerEntry?.content || containerEntry?.node || null;
  if (containerTarget) {
    containerTarget.appendChild(host);
    return { ok: true };
  }
  if (containerId && !containerTarget) {
    return { ok: false, error: 'container-not-found' };
  }

  if (isElementFloating(element)) {
    if (!host.style.position || host.style.position === 'relative') {
      host.style.position = 'absolute';
    }
    if (!host.style.zIndex) {
      host.style.zIndex = FLOATING_Z_INDEX;
    }
    document.body.appendChild(host);
    return { ok: true };
  }

  const beforeNode = getElementBeforeSelector(element) ? resolveTarget(getElementBeforeSelector(element)) : null;
  if (beforeNode?.parentElement) {
    beforeNode.parentElement.insertBefore(host, beforeNode);
    return { ok: true };
  }

  const afterNode = getElementAfterSelector(element) ? resolveTarget(getElementAfterSelector(element)) : null;
  if (afterNode?.parentElement) {
    if (afterNode.nextSibling) {
      afterNode.parentElement.insertBefore(host, afterNode.nextSibling);
    } else {
      afterNode.parentElement.appendChild(host);
    }
    return { ok: true };
  }

  const selector = getElementSelector(element);
  const target = resolveTarget(selector);
  if (!target || !target.parentElement) {
    if (!selector && getElementType(element) !== 'tooltip') {
      document.body.appendChild(host);
      return { ok: true };
    }
    return { ok: false, error: 'target-not-found' };
  }

  const position = getElementPosition(element);
  if (position === 'prepend') {
    target.insertBefore(host, target.firstChild);
    return { ok: true };
  }
  if (position === 'before') {
    target.parentElement.insertBefore(host, target);
    return { ok: true };
  }
  if (position === 'after') {
    if (target.nextSibling) {
      target.parentElement.insertBefore(host, target.nextSibling);
    } else {
      target.parentElement.appendChild(host);
    }
    return { ok: true };
  }

  target.appendChild(host);
  return { ok: true };
};

export const placeTooltip = (element: RuntimeElement) => {
  const target = resolveTarget(getElementSelector(element));
  const entry = registry.get(element.id);
  const tooltip = entry?.content || null;
  if (!(target instanceof HTMLElement) || !(tooltip instanceof HTMLElement)) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const offset = 6;
  const position = getElementTooltipPosition(element) || 'top';
  const top =
    position === 'top'
      ? rect.top - offset
      : position === 'bottom'
        ? rect.bottom + offset
        : rect.top;
  const left =
    position === 'left'
      ? rect.left - offset
      : position === 'right'
        ? rect.right + offset
        : rect.left;

  tooltip.style.position = 'fixed';
  tooltip.style.top = `${Math.max(0, top)}px`;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.zIndex = '2147482001';
};
