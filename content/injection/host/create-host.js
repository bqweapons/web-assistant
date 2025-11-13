import { HOST_ATTRIBUTE, HOST_CLASS, NODE_CLASS } from '../core/index.js';
import { applyStyle, getStyleTarget, createTooltipNode, applyBaseAppearance } from '../ui/index.js';

/**
 * 要素タイプごとに適切な初期ノードを生成する。
 * Creates an initial shadow node for a given element type.
 * @param {import('../../../common/types.js').InjectedElement['type']} type
 * @returns {HTMLElement}
 */
function createNodeForType(type) {
  if (type === 'link') {
    return document.createElement('a');
  }
  if (type === 'tooltip') {
    return createTooltipNode();
  }
  if (type === 'area') {
    const wrapper = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'page-augmentor-area-header';
    const content = document.createElement('div');
    content.className = 'page-augmentor-area-content';
    wrapper.append(header, content);
    return wrapper;
  }
  const button = document.createElement('button');
  button.type = 'button';
  return button;
}

/**
 * 注入要素を囲むホストコンテナと Shadow DOM を構築する。
 * Creates the host container and shadow DOM scaffold for an injected element.
 * @param {import('../../../common/types.js').InjectedElement} element
 * @returns {HTMLElement}
 */
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
    }
    .${NODE_CLASS} {
      pointer-events: auto;
      font-family: inherit;
      /* Ensure resize handles positioned relative to node bounds */
      position: relative;
    }
    :host([data-page-augmentor-global-editing='true']) .${NODE_CLASS} {
      outline: 1px dashed rgba(37, 99, 235, 0.35);
      outline-offset: 1px;
    }
    :host([data-page-augmentor-editing='true']) .${NODE_CLASS} {
      outline: 2px solid rgba(37, 99, 235, 0.75);
      outline-offset: 2px;
      box-shadow: 0 0 0 4px rgba(191, 219, 254, 0.6);
    }
    :host([data-page-augmentor-editing='true']) .${NODE_CLASS} .page-augmentor-resize-handle {
      display: block !important;
    }
    :host([data-page-augmentor-global-editing='true']) .${NODE_CLASS}[data-node-type='area'] ,
    :host([data-page-augmentor-editing='true']) .${NODE_CLASS}[data-node-type='area'] {
      cursor: move;
    }
    .page-augmentor-resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #ffffff;
      border: 2px solid rgba(37, 99, 235, 0.9);
      border-radius: 9999px;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
      display: none;
      pointer-events: auto;
      z-index: 1;
    }
    .page-augmentor-resize-handle.nw { left: -6px; top: -6px; cursor: nwse-resize; }
    .page-augmentor-resize-handle.ne { right: -6px; top: -6px; cursor: nesw-resize; }
    .page-augmentor-resize-handle.sw { left: -6px; bottom: -6px; cursor: nesw-resize; }
    .page-augmentor-resize-handle.se { right: -6px; bottom: -6px; cursor: nwse-resize; }
    .page-augmentor-resize-handle.n { top: -6px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .page-augmentor-resize-handle.s { bottom: -6px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .page-augmentor-resize-handle.w { left: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
    .page-augmentor-resize-handle.e { right: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
    :host([data-page-augmentor-preview='true']) {
      opacity: 0.65;
    }
    :host([data-page-augmentor-preview='true']) .${NODE_CLASS} {
      pointer-events: none;
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
    .${NODE_CLASS}[data-node-type='area'] {
      touch-action: none;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .${NODE_CLASS}.page-augmentor-area-dragging {
      cursor: grabbing;
      opacity: 0.92;
    }
    .${NODE_CLASS}.page-augmentor-floating-dragging {
      cursor: grabbing;
      opacity: 0.96;
    }
    .${NODE_CLASS}[data-node-type='area'] .page-augmentor-area-header {
      font-weight: 600;
      font-size: 0.95rem;
      color: #1f2937;
    }
    .${NODE_CLASS}[data-node-type='area'] .page-augmentor-area-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      /* Prevent children from stretching to full width */
      align-items: flex-start;
    }
    .${NODE_CLASS}[data-node-type='area'].page-augmentor-area-drop-target {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35);
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
  `;
  shadowRoot.appendChild(style);
  const node = createNodeForType(element.type);
  // Ensure the initial node matches the expected runtime selector
  // so orchestrator.applyMetadata() can reuse it instead of creating
  // a duplicate fallback node on first render.
  if (node instanceof HTMLElement) {
    if (element.type === 'tooltip') {
      // createTooltipNode() already applies NODE_CLASS and dataset
      // via applyTooltipAppearance().
    } else {
      applyBaseAppearance(node, element.type);
    }
  }
  shadowRoot.appendChild(node);
  const styleTarget = getStyleTarget(node);
  applyStyle(styleTarget, element.style);
  return host;
}




