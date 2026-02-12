import { MessageType, type ElementPayload, type RuntimeMessage } from '../../shared/messages';

type RegistryEntry = {
  element: ElementPayload;
  node: HTMLElement;
  root?: ShadowRoot;
  content?: HTMLElement;
  cleanup?: () => void;
};
type RuntimeMessenger = { sendMessage?: (message: unknown) => void };

const registry = new Map<string, RegistryEntry>();
const HOST_ATTR = 'data-ladybird-element';
const HIGHLIGHT_COLOR = 'rgba(27, 132, 255, 0.35)';
const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

const parseCustomCss = (raw?: string) => {
  if (!raw) {
    return {} as Record<string, string>;
  }
  const rules: Record<string, string> = {};
  raw
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [property, ...rest] = segment.split(':');
      if (!property || rest.length === 0) {
        return;
      }
      const value = rest.join(':').trim();
      if (!value) {
        return;
      }
      const key = property
        .trim()
        .toLowerCase()
        .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      if (!key) {
        return;
      }
      rules[key] = value;
    });
  return rules;
};

const applyInlineStyles = (node: HTMLElement, element: ElementPayload) => {
  const inline = element.style?.inline || {};
  const custom = parseCustomCss(element.style?.customCss || '');
  const merged: Record<string, string> = { ...inline, ...custom };
  Object.entries(merged).forEach(([key, value]) => {
    if (!value) return;
    // @ts-ignore style indexing
    node.style[key] = value;
  });
  if (element.floating) {
    node.style.position = node.style.position || 'absolute';
  }
};

const createHostWithShadow = (element: ElementPayload) => {
  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, element.id);
  host.dataset.type = element.type;
  host.dataset.shadow = 'true';
  host.style.position = 'relative';
  host.style.boxSizing = 'border-box';
  host.style.display = 'block';
  host.style.pointerEvents = 'auto';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; }
    .ladybird-reset {
      all: unset;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1.4;
      pointer-events: auto;
    }
    .ladybird-area {
      background: rgba(46, 125, 50, 0.08);
      border: 1px dashed rgba(46, 125, 50, 0.4);
      border-radius: 14px;
      padding: 10px;
      color: #0f172a;
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
  `;
  root.appendChild(style);
  return { host, root };
};

const createElementNode = (element: ElementPayload) => {
  const { host, root } = createHostWithShadow(element);
  let node: HTMLElement;
  switch (element.type) {
    case 'button': {
      const button = document.createElement('button');
      button.textContent = element.text || 'Button';
      button.type = 'button';
      button.className = 'ladybird-reset ladybird-button';
      node = button;
      break;
    }
    case 'link': {
      const anchor = document.createElement('a');
      anchor.textContent = element.text || element.href || 'Link';
      anchor.href = element.href || '#';
      anchor.target = element.linkTarget === 'same-tab' ? '_self' : '_blank';
      anchor.rel = 'noreferrer noopener';
      anchor.className = 'ladybird-reset ladybird-link';
      node = anchor;
      break;
    }
    case 'tooltip': {
      const tooltip = document.createElement('div');
      tooltip.textContent = element.text || 'Tooltip';
      tooltip.className = 'ladybird-reset ladybird-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.zIndex = '2147482001';
      node = tooltip;
      break;
    }
    case 'area':
    default: {
      const area = document.createElement('div');
      area.className = 'ladybird-reset ladybird-area';
      area.style.display = 'flex';
      area.style.flexDirection = element.layout === 'column' ? 'column' : 'row';
      area.style.gap = area.style.gap || '8px';
      area.style.minHeight = area.style.minHeight || '48px';
      node = area;
      break;
    }
  }
  // floating elements need positioning on the host so absolute coords anchor to viewport
  if (element.floating) {
    applyInlineStyles(host, element);
    applyInlineStyles(node, element);
  } else {
    applyInlineStyles(node, element);
  }
  root.appendChild(node);
  return { host, root, content: node };
};

const resolveTarget = (selector?: string) => {
  if (!selector) return null;
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch (error) {
    console.warn('Invalid selector', selector, error);
    return null;
  }
};

const insertNode = (host: HTMLElement, element: ElementPayload) => {
  const containerEntry = element.containerId ? registry.get(element.containerId) : null;
  const containerTarget = containerEntry?.content || containerEntry?.node || null;
  if (containerTarget) {
    containerTarget.appendChild(host);
    return { ok: true };
  }
  if (element.containerId && !containerTarget) {
    return { ok: false, error: 'container-not-found' };
  }

  if (!element.selector && element.type !== 'tooltip') {
    document.body.appendChild(host);
    return { ok: true };
  }

  if (element.floating) {
    if (!host.style.position || host.style.position === 'relative') {
      host.style.position = 'fixed';
    }
    if (!host.style.zIndex) {
      host.style.zIndex = '2147482000';
    }
    document.body.appendChild(host);
    return { ok: true };
  }

  const target = resolveTarget(element.selector);
  if (!target || !target.parentElement) {
    return { ok: false, error: 'target-not-found' };
  }

  const parent = target.parentElement;
  const beforeNode = element.beforeSelector ? resolveTarget(element.beforeSelector) : null;
  const afterNode = element.afterSelector ? resolveTarget(element.afterSelector) : null;

  if (beforeNode && beforeNode.parentElement === parent) {
    parent.insertBefore(host, beforeNode);
    return { ok: true };
  }
  if (afterNode && afterNode.parentElement === parent) {
    if (afterNode.nextSibling) {
      parent.insertBefore(host, afterNode.nextSibling);
    } else {
      parent.appendChild(host);
    }
    return { ok: true };
  }

  const position = element.position || 'append';
  if (position === 'prepend') {
    target.insertBefore(host, target.firstChild);
    return { ok: true };
  }
  if (position === 'before') {
    parent.insertBefore(host, target);
    return { ok: true };
  }
  if (position === 'after') {
    if (target.nextSibling) {
      parent.insertBefore(host, target.nextSibling);
    } else {
      parent.appendChild(host);
    }
    return { ok: true };
  }
  target.appendChild(host);
  return { ok: true };
};

const placeTooltip = (host: HTMLElement, element: ElementPayload) => {
  const target = resolveTarget(element.selector);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const tooltip = registry.get(element.id || '')?.content as HTMLElement | null;
  if (!tooltip) return;
  const offset = 6;
  const pos = element.tooltipPosition || 'top';
  const top = pos === 'top' ? rect.top - offset : pos === 'bottom' ? rect.bottom + offset : rect.top;
  const left = pos === 'left' ? rect.left - offset : pos === 'right' ? rect.right + offset : rect.left;
  tooltip.style.position = 'fixed';
  tooltip.style.top = `${Math.max(0, top)}px`;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.zIndex = '2147482001';
};

const removeExistingHosts = (id: string) => {
  const selector = `[${HOST_ATTR}="${id}"]`;
  document.querySelectorAll(selector).forEach((node) => {
    if (node instanceof HTMLElement) {
      node.remove();
    }
  });
};

const injectElement = (element: ElementPayload) => {
  if (!element?.id || !element.type) {
    return { ok: false, error: 'invalid-element' };
  }
  const siteKey = normalizeSiteKey(element.siteUrl || '');
  const currentSite = normalizeSiteKey(window.location.host || '');
  if (siteKey && currentSite && siteKey !== currentSite && !currentSite.endsWith(siteKey)) {
    return { ok: false, error: 'site-mismatch' };
  }
  removeExistingHosts(element.id);
  const existing = registry.get(element.id);
  if (existing?.node.isConnected) {
    existing.node.remove();
  }
  const { host, root, content } = createElementNode(element);
  if (element.floating) {
    host.style.position = host.style.position || 'fixed';
    host.style.zIndex = host.style.zIndex || '2147482000';
  }
  const inserted = insertNode(host, element);
  if (!inserted.ok) {
    host.remove();
    return { ok: false, error: inserted.error || 'insert-failed' };
  }
  if (element.type === 'tooltip') {
    placeTooltip(host, element);
  }
  registry.set(element.id, { element, node: host, root, content, cleanup: existing?.cleanup });
  return { ok: true };
};

const removeElement = (id: string) => {
  const entry = registry.get(id);
  if (!entry) return false;
  entry.cleanup?.();
  entry.node.remove();
  registry.delete(id);
  return true;
};

const rehydrateElements = (elements: ElementPayload[]) => {
  Array.from(registry.keys()).forEach((key) => removeElement(key));
  elements.forEach((element) => injectElement(element));
};

const highlightElement = (id: string) => {
  const entry = registry.get(id);
  if (!entry?.node) return false;
  const target = entry.node;
  const rect = target.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.border = `2px solid ${HIGHLIGHT_COLOR}`;
  overlay.style.backgroundColor = HIGHLIGHT_COLOR;
  overlay.style.borderRadius = '6px';
  overlay.style.zIndex = '2147483646';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  document.body.appendChild(overlay);
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => overlay.remove(), 1200);
  return true;
};

export const handleInjectionMessage = (message: RuntimeMessage) => {
  switch (message.type) {
    case MessageType.CREATE_ELEMENT:
    case MessageType.UPDATE_ELEMENT:
    case MessageType.PREVIEW_ELEMENT: {
      const element = message.data?.element;
      if (!element) {
        return { ok: false, error: 'invalid-element' };
      }
      return injectElement(element);
    }
    case MessageType.DELETE_ELEMENT: {
      const id = message.data?.id;
      if (!id) {
        return { ok: false, error: 'invalid-element-id' };
      }
      removeElement(id);
      return { ok: true };
    }
    case MessageType.REHYDRATE_ELEMENTS: {
      const elements = message.data?.elements || [];
      rehydrateElements(Array.isArray(elements) ? elements : []);
      return { ok: true };
    }
    case MessageType.FOCUS_ELEMENT: {
      const id = message.data?.id;
      if (!id) {
        return { ok: false, error: 'invalid-element-id' };
      }
      const focused = highlightElement(id);
      return { ok: focused, error: focused ? undefined : 'element-not-found' };
    }
    default:
      return undefined;
  }
};

export const resetInjectionRegistry = () => {
  Array.from(registry.keys()).forEach((key) => removeElement(key));
};

export const registerPageContextIfNeeded = (runtime?: RuntimeMessenger) => {
  if (!runtime?.sendMessage) return;
  const href = window.location.href;
  if (!href) return;
  runtime.sendMessage({
    type: MessageType.PAGE_CONTEXT_PING,
    data: { url: href, title: document.title || undefined },
  });
};
