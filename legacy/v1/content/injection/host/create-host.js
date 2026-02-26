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
    const content = document.createElement('div');
    content.className = 'page-augmentor-area-content';
    wrapper.append(content);
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
      position: relative;
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
      box-shadow: 0 0 0 4px rgba(191, 219, 254, 0.6);
    }
    :host([data-page-augmentor-editing='true']) .${NODE_CLASS} .page-augmentor-resize-handle {
      display: block !important;
    }
    :host([data-page-augmentor-global-editing='true']) .${NODE_CLASS}[data-node-type='area'] ,
    :host([data-page-augmentor-editing='true']) .${NODE_CLASS}[data-node-type='area'] {
      cursor: move;
    }
    :host([data-page-augmentor-global-editing='true']) .${NODE_CLASS} {
      animation: page-augmentor-editing-blink 1.2s ease-in-out infinite;
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
    .${NODE_CLASS}[data-node-type='area'] .page-augmentor-area-content {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.5rem;
      /* Prevent children from stretching to full width */
      align-items: flex-start;
    }
    .${NODE_CLASS}[data-node-type='area'].page-augmentor-area-drop-target {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35);
    }
    .${NODE_CLASS}.tooltip {
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
    .${NODE_CLASS}.tooltip .tooltip-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 9999px;
      background-color: rgba(15, 23, 42, 0.08);
      color: #0f172a;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
    }
    .${NODE_CLASS}.tooltip .tooltip-bubble {
      position: absolute;
      z-index: 10;
      background-color: rgba(17, 24, 39, 0.5);
      color: #f8fafc;
      font-size: 14px;
      padding: 8px 12px;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.5);
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 0.16s ease, transform 0.16s ease;
      white-space: normal;
      width: max-content;
      max-width: 320px;
    }
    .${NODE_CLASS}.tooltip .tooltip-bubble::after {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
    }
    .${NODE_CLASS}.tooltip[data-position='top'] .tooltip-bubble {
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translate(-50%, 4px);
    }
    .${NODE_CLASS}.tooltip[data-position='bottom'] .tooltip-bubble {
      top: calc(100% + 8px);
      left: 50%;
      transform: translate(-50%, -4px);
    }
    .${NODE_CLASS}.tooltip[data-position='left'] .tooltip-bubble {
      right: calc(100% + 8px);
      top: 50%;
      transform: translate(4px, -50%);
    }
    .${NODE_CLASS}.tooltip[data-position='right'] .tooltip-bubble {
      left: calc(100% + 8px);
      top: 50%;
      transform: translate(-4px, -50%);
    }
    .${NODE_CLASS}.tooltip[data-position='top'] .tooltip-bubble::after {
      border-width: 6px 6px 0 6px;
      border-style: solid;
      border-color: rgba(17, 24, 39, 0.5) transparent transparent transparent;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
    }
    .${NODE_CLASS}.tooltip[data-position='bottom'] .tooltip-bubble::after {
      border-width: 0 6px 6px 6px;
      border-style: solid;
      border-color: transparent transparent rgba(17, 24, 39, 0.5) transparent;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
    }
    .${NODE_CLASS}.tooltip[data-position='left'] .tooltip-bubble::after {
      border-width: 6px 0 6px 6px;
      border-style: solid;
      border-color: transparent transparent transparent rgba(17, 24, 39, 0.5);
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
    }
    .${NODE_CLASS}.tooltip[data-position='right'] .tooltip-bubble::after {
      border-width: 6px 6px 6px 0;
      border-style: solid;
      border-color: transparent rgba(17, 24, 39, 0.5) transparent transparent;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
    }
    .${NODE_CLASS}.tooltip:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip:focus-within .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-persistent='true'] .tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
    }
    .${NODE_CLASS}.tooltip[data-position='top']:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='top']:focus-within .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='top'][data-persistent='true'] .tooltip-bubble {
      transform: translate(-50%, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='bottom']:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='bottom']:focus-within .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='bottom'][data-persistent='true'] .tooltip-bubble {
      transform: translate(-50%, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='left']:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='left']:focus-within .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='left'][data-persistent='true'] .tooltip-bubble {
      transform: translate(0, -50%);
    }
    .${NODE_CLASS}.tooltip[data-position='right']:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='right']:focus-within .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-position='right'][data-persistent='true'] .tooltip-bubble {
      transform: translate(0, -50%);
    }
    .${NODE_CLASS}.flash-outline {
      animation: page-augmentor-flash-outline 0.9s ease-out;
    }
    @keyframes page-augmentor-editing-blink {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.0);
      }
      50% {
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.45);
      }
    }
    @keyframes page-augmentor-flash-outline {
      0% {
        outline-offset: 3px;
        box-shadow:
          0 0 0 2px rgba(56, 189, 248, 0.8),
          0 0 0 20px rgba(125, 211, 252, 0.6);
      }
      100% {
        outline: none;
        outline-offset: 0;
        box-shadow: none;
      }
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




