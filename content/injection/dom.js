import { parseActionFlowDefinition } from '../../common/flows.js';
import { HOST_ATTRIBUTE, HOST_CLASS, NODE_CLASS } from './constants.js';
import { executeActionFlow } from './flow-runner.js';
import { applyBaseAppearance, applyStyle, getStyleTarget, normalizeTooltipPosition } from './style.js';
import { applyTooltipAppearance, configureTooltipPosition, createTooltipNode } from './tooltip.js';
import { forwardClick, resolveSelector, sanitizeUrl } from './utils.js';

export function createHost(element) {
  const host = document.createElement('span');
  host.className = HOST_CLASS;
  host.setAttribute(HOST_ATTRIBUTE, element.id);
  host.part = 'page-augmentor-host';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: inline-block;
      max-width: max-content;
    }
    .${NODE_CLASS} {
      pointer-events: auto;
      font-family: inherit;
    }
    button.${NODE_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      background-color: #1b84ff;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
    }
    button.${NODE_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.18);
    }
    button.${NODE_CLASS}:focus-visible {
      outline: 2px solid #1b84ff;
      outline-offset: 2px;
    }
    a.${NODE_CLASS} {
      color: #2563eb;
      text-decoration: underline;
      cursor: pointer;
    }
    .${NODE_CLASS}.tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      cursor: help;
      font-family: inherit;
    }
    .${NODE_CLASS}.tooltip[data-persistent='true'] {
      cursor: default;
    }
    .${NODE_CLASS}.tooltip:focus {
      outline: none;
    }
    .tooltip-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 9999px;
      background-color: #2563eb;
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.18);
      user-select: none;
    }
    .tooltip-bubble {
      position: absolute;
      z-index: 10;
      max-width: 240px;
      min-width: max-content;
      padding: 0.45rem 0.75rem;
      border-radius: 0.75rem;
      background-color: #111827;
      color: #f8fafc;
      font-size: 0.85rem;
      line-height: 1.4;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
      opacity: 0;
      pointer-events: none;
      transform: var(--tooltip-hidden-transform, translate3d(-50%, 6px, 0));
      transition: opacity 0.16s ease, transform 0.16s ease;
      white-space: pre-wrap;
    }
    .${NODE_CLASS}.tooltip[data-persistent='true'] .tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
      transform: var(--tooltip-visible-transform, translate3d(-50%, 0, 0));
    }
    .${NODE_CLASS}.tooltip[data-persistent='false']:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-persistent='false']:focus-within .tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
      transform: var(--tooltip-visible-transform, translate3d(-50%, 0, 0));
    }
    .${NODE_CLASS}.tooltip[data-position='top'] .tooltip-bubble {
      bottom: calc(100% + 8px);
      left: 50%;
      --tooltip-hidden-transform: translate3d(-50%, 6px, 0);
      --tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='bottom'] .tooltip-bubble {
      top: calc(100% + 8px);
      left: 50%;
      --tooltip-hidden-transform: translate3d(-50%, -6px, 0);
      --tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='left'] .tooltip-bubble {
      right: calc(100% + 8px);
      top: 50%;
      --tooltip-hidden-transform: translate3d(6px, -50%, 0);
      --tooltip-visible-transform: translate3d(0, -50%, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='right'] .tooltip-bubble {
      left: calc(100% + 8px);
      top: 50%;
      --tooltip-hidden-transform: translate3d(-6px, -50%, 0);
      --tooltip-visible-transform: translate3d(0, -50%, 0);
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
  const node = createNodeForType(element.type);
  shadowRoot.appendChild(node);
  hydrateNode(node, element);
  const styleTarget = getStyleTarget(node);
  applyStyle(styleTarget, element.style);
  return host;
}

export function applyMetadata(host, element) {
  const shadow = host.shadowRoot;
  if (!shadow) {
    return;
  }
  let node = shadow.querySelector(`.${NODE_CLASS}`);
  if (!(node instanceof HTMLElement) || node.dataset.nodeType !== element.type) {
    const replacement = createNodeForType(element.type);
    if (node) {
      shadow.replaceChild(replacement, node);
    } else {
      shadow.appendChild(replacement);
    }
    node = replacement;
  }
  hydrateNode(node, element);
  const styleTarget = getStyleTarget(node);
  applyStyle(styleTarget, element.style);
}

export function insertHost(host, element) {
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

export function flashHighlight(host) {
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

function createNodeForType(type) {
  if (type === 'link') {
    return document.createElement('a');
  }
  if (type === 'tooltip') {
    return createTooltipNode();
  }
  if (type === 'area') {
    return document.createElement('div');
  }
  const button = document.createElement('button');
  button.type = 'button';
  return button;
}

function hydrateNode(node, element) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (element.type === 'link' && node instanceof HTMLAnchorElement) {
    applyBaseAppearance(node, 'link');
    node.textContent = element.text;
    const sanitized = sanitizeUrl(element.href || '');
    if (sanitized) {
      node.setAttribute('href', sanitized);
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    } else {
      node.removeAttribute('href');
    }
    delete node.dataset.href;
    delete node.dataset.actionSelector;
    node.onclick = null;
    node.removeAttribute('aria-describedby');
  } else if (element.type === 'button' && node instanceof HTMLButtonElement) {
    applyBaseAppearance(node, 'button');
    node.textContent = element.text;
    applyButtonBehavior(node, element.href, element.actionSelector, element.actionFlow);
  } else if (element.type === 'tooltip') {
    applyTooltipAppearance(node);
    const bubble = node.querySelector('.tooltip-bubble');
    if (bubble instanceof HTMLElement) {
      bubble.textContent = element.text || '';
      bubble.setAttribute('role', 'tooltip');
      const bubbleId = `page-augmentor-tooltip-${element.id}`;
      bubble.id = bubbleId;
      node.setAttribute('aria-describedby', bubbleId);
    }
    const trigger = node.querySelector('.tooltip-trigger');
    if (trigger instanceof HTMLElement) {
      trigger.textContent = 'ⓘ';
      trigger.setAttribute('aria-hidden', 'true');
    }
    const normalizedPosition = normalizeTooltipPosition(element.tooltipPosition);
    configureTooltipPosition(node, bubble, normalizedPosition);
    const persistent = element.tooltipPersistent ? 'true' : 'false';
    node.dataset.persistent = persistent;
    node.setAttribute('data-persistent', persistent);
    node.setAttribute('role', 'group');
    node.tabIndex = 0;
    node.setAttribute('aria-label', element.text || 'tooltip');
  } else if (element.type === 'area') {
    applyBaseAppearance(node, 'area');
    node.textContent = element.text || '';
    delete node.dataset.href;
    delete node.dataset.actionSelector;
    node.onclick = null;
  }
}

function applyButtonBehavior(node, href, actionSelector, actionFlow) {
  if (!(node instanceof HTMLButtonElement)) {
    return;
  }
  const sanitized = sanitizeUrl(href || '');
  const selector = typeof actionSelector === 'string' ? actionSelector.trim() : '';
  const flowSource = typeof actionFlow === 'string' ? actionFlow.trim() : '';
  let parsedFlow = null;
  if (flowSource) {
    const { definition, error } = parseActionFlowDefinition(flowSource);
    if (error) {
      console.warn('[PageAugmentor] Ignoring invalid action flow:', error);
    } else if (definition) {
      parsedFlow = definition;
      if (selector) {
        parsedFlow = {
          steps: [...definition.steps, { type: 'click', selector, all: false }],
          stepCount: definition.stepCount + 1,
        };
      }
    }
  }
  if (sanitized) {
    node.dataset.href = sanitized;
  } else {
    delete node.dataset.href;
  }
  if (selector) {
    node.dataset.actionSelector = selector;
  } else {
    delete node.dataset.actionSelector;
  }
  if (parsedFlow) {
    node.dataset.actionFlow = String(parsedFlow.stepCount);
  } else {
    delete node.dataset.actionFlow;
  }
  if (!parsedFlow && !selector && !sanitized) {
    node.onclick = null;
    return;
  }
  node.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    let handled = false;
    if (parsedFlow) {
      try {
        handled = await executeActionFlow(node, parsedFlow);
      } catch (error) {
        console.error('[PageAugmentor] Failed to execute flow', error);
      }
    }
    if (handled) {
      return;
    }
    if (selector) {
      const target = resolveSelector(selector);
      if (target) {
        const triggered = forwardClick(target);
        if (!triggered) {
          if (sanitized) {
            window.open(sanitized, '_blank', 'noopener');
          } else if (typeof target.click === 'function') {
            try {
              target.click();
            } catch (clickError) {
              console.warn('[PageAugmentor] Native click fallback failed', clickError);
            }
          }
        }
        return;
      }
    }
    if (sanitized) {
      window.open(sanitized, '_blank', 'noopener');
    }
  };
}
