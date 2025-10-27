// DOM へ注入する要素の生成・更新・動作制御をまとめたモジュール。
import { parseActionFlowDefinition } from '../common/flows.js';

/** @typedef {import('../common/flows.js').FlowDefinition} FlowDefinition */
/** @typedef {import('../common/flows.js').FlowCondition} FlowCondition */
/** @typedef {import('../common/flows.js').FlowStep} FlowStep */

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
  'fontWeight',
  'lineHeight',
  'padding',
  'border',
  'borderRadius',
  'textDecoration',
  'maxWidth',
  'boxShadow',
  'width',
  'height',
  'zIndex',
]);

const TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

/** @type {Map<string, import('../common/types.js').InjectedElement>} */
const elements = new Map();
/** @type {Map<string, HTMLElement>} */
const hosts = new Map();

/**
 * 要素を DOM 上に生成・更新して確実に表示する。
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
 * 既存要素の DOM インスタンスを更新する。
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
 * 注入済み要素を DOM から削除する。
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
 * DOM 変化後などに既知の要素を再挿入する。
 * Re-inserts all known elements, typically after DOM mutations.
 * @returns {void}
 */
export function reconcileElements() {
  for (const element of elements.values()) {
    ensureElement(element);
  }
}

/**
 * ID に対応する要素データを取得する。
 * Retrieves a stored element by identifier.
 * @param {string} elementId
 * @returns {import('../common/types.js').InjectedElement | undefined}
 */
export function getElement(elementId) {
  return elements.get(elementId);
}

/**
 * 指定 ID のホスト要素を返す。
 * Retrieves the host element for a stored id.
 * @param {string} elementId
 * @returns {HTMLElement | null}
 */
export function getHost(elementId) {
  const host = hosts.get(elementId);
  return host && document.contains(host) ? host : null;
}

/**
 * ストレージを書き換えずにプレビュー内容を適用する。
 * Applies an unsaved preview to an element without mutating stored data.
 * @param {string} elementId
 * @param {Partial<import('../common/types.js').InjectedElement>} overrides
 */
export function previewElement(elementId, overrides) {
  const base = elements.get(elementId);
  if (!base) {
    return;
  }
  const host = hosts.get(elementId);
  if (!host || !document.contains(host)) {
    return;
  }
  const merged = {
    ...base,
    ...overrides,
    style: {
      ...(base.style || {}),
      ...(overrides?.style || {}),
    },
  };
  applyMetadata(host, merged);
}

/**
 * 指定 ID の要素を強調表示し、画面内へスクロールする。
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
 * すべての保持要素を配列で返す。
 * Returns all known elements.
 * @returns {import('../common/types.js').InjectedElement[]}
 */
export function listElements() {
  return Array.from(elements.values());
}

/**
 * Shadow DOM を備えたホストノードを生成する。
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

/**
 * テキストやスタイルなどのメタデータをホストへ適用する。
 * Applies metadata (text, href, style) to an existing host.
 * @param {HTMLElement} host
 * @param {import('../common/types.js').InjectedElement} element
 */
function applyMetadata(host, element) {
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

/**
 * 要素タイプに応じた DOM ノードを生成する。
 * Creates an element that matches the requested type.
 * @param {'button' | 'link' | 'tooltip' | 'area'} type
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
    return document.createElement('div');
  }
  const button = document.createElement('button');
  button.type = 'button';
  return button;
}

/**
 * メタデータに基づきテキスト・振る舞い・属性を適用する。
 * Applies text, behaviors, and attributes for the provided element metadata.
 * @param {HTMLElement} node
 * @param {import('../common/types.js').InjectedElement} element
 */
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

/**
 * トリガーとバブルを含むツールチップ要素を生成する。
 * Creates a tooltip container with trigger and bubble nodes.
 * @returns {HTMLElement}
 */
function createTooltipNode() {
  const container = document.createElement('div');
  applyTooltipAppearance(container);
  return container;
}

/**
 * ツールチップに必要なマークアップと属性を整える。
 * Ensures tooltip markup and baseline attributes exist on the provided node.
 * @param {HTMLElement} node
 */
function applyTooltipAppearance(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  node.className = `${NODE_CLASS} tooltip`;
  node.dataset.nodeType = 'tooltip';
  if (!TOOLTIP_POSITIONS.has(node.dataset.position || '')) {
    node.dataset.position = 'top';
  }
  if (node.dataset.persistent !== 'true' && node.dataset.persistent !== 'false') {
    node.dataset.persistent = 'false';
  }
  node.setAttribute('data-position', node.dataset.position);
  node.setAttribute('data-persistent', node.dataset.persistent);
  node.setAttribute('role', 'group');
  node.tabIndex = 0;

  let trigger = node.querySelector('.tooltip-trigger');
  if (!(trigger instanceof HTMLElement)) {
    trigger = document.createElement('span');
    trigger.className = 'tooltip-trigger';
    node.insertBefore(trigger, node.firstChild);
  }
  trigger.textContent = 'ⓘ';
  trigger.setAttribute('aria-hidden', 'true');

  let bubble = node.querySelector('.tooltip-bubble');
  if (!(bubble instanceof HTMLElement)) {
    bubble = document.createElement('div');
    bubble.className = 'tooltip-bubble';
    node.appendChild(bubble);
  }
  bubble.setAttribute('role', 'tooltip');
}

/**
 * ツールチップ位置に応じて属性とスタイルを更新する。
 * Updates data attributes and inline adjustments for tooltip placement.
 * @param {HTMLElement} container
 * @param {Element | null} bubble
 * @param {'top' | 'right' | 'bottom' | 'left'} position
 */
function configureTooltipPosition(container, bubble, position) {
  const normalized = normalizeTooltipPosition(position);
  container.dataset.position = normalized;
  container.setAttribute('data-position', normalized);
  if (bubble instanceof HTMLElement) {
    bubble.style.top = '';
    bubble.style.bottom = '';
    bubble.style.left = '';
    bubble.style.right = '';
    bubble.style.removeProperty('--tooltip-hidden-transform');
    bubble.style.removeProperty('--tooltip-visible-transform');
  }
}

/**
 * スタイル上書きの適用先となる DOM ノードを決定する。
 * Determines which DOM node should receive style overrides.
 * @param {HTMLElement} node
 * @returns {HTMLElement | null}
 */
function getStyleTarget(node) {
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  if (node.dataset.nodeType === 'tooltip') {
    const bubble = node.querySelector('.tooltip-bubble');
    if (bubble instanceof HTMLElement) {
      return bubble;
    }
  }
  return node;
}

/**
 * ツールチップの位置指定を正規化する。
 * Normalizes tooltip placement values.
 * @param {string | undefined} position
 * @returns {'top' | 'right' | 'bottom' | 'left'}
 */
function normalizeTooltipPosition(position) {
  if (position && TOOLTIP_POSITIONS.has(position)) {
    return /** @type {'top' | 'right' | 'bottom' | 'left'} */ (position);
  }
  return 'top';
}

/**
 * 保存されたセレクターと挿入位置に従ってホストを挿入する。
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
 * ボタン要素にナビゲーションや委譲クリックなどの挙動を設定する。
 * Configures optional click navigation or delegated actions for button elements.
 * @param {HTMLButtonElement} node
 * @param {string | undefined} href
 * @param {string | undefined} actionSelector
 * @param {string | undefined} actionFlow
 */
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

const FLOW_SELF_SELECTOR = ':self';
const FLOW_MAX_RUNTIME_MS = 10000;
const FLOW_MAX_DEPTH = 8;

/**
 * @typedef {Object} FlowExecutionContext
 * @property {HTMLElement} root
 * @property {Document} document
 * @property {boolean} performed
 * @property {number} startTime
 */

/**
 * 設定されたアクションフローを順次実行する。
 * Executes the configured action flow.
 * @param {HTMLElement} node
 * @param {FlowDefinition} definition
 * @returns {Promise<boolean>}
 */
async function executeActionFlow(node, definition) {
  if (!definition || !Array.isArray(definition.steps) || definition.steps.length === 0) {
    return false;
  }
  /** @type {FlowExecutionContext} */
  const context = {
    root: node,
    document: node.ownerDocument || document,
    performed: false,
    startTime: Date.now(),
  };
  await runFlowSteps(definition.steps, context, 0);
  return context.performed;
}

/**
 * フローステップを順番に実行する。
 * Executes a list of flow steps sequentially.
 * @param {FlowStep[]} steps
 * @param {FlowExecutionContext} context
 * @param {number} depth
 */
async function runFlowSteps(steps, context, depth) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return;
  }
  if (depth > FLOW_MAX_DEPTH) {
    throw new Error('Flow exceeded maximum nesting depth.');
  }
  for (const step of steps) {
    await runFlowStep(step, context, depth);
    enforceRuntimeLimit(context);
  }
}

/**
 * 単一のフローステップを実行する。
 * Executes a single flow step.
 * @param {FlowStep} step
 * @param {FlowExecutionContext} context
 * @param {number} depth
 */
async function runFlowStep(step, context, depth) {
  if (!step) {
    return;
  }
  switch (step.type) {
    case 'click': {
      let targets = [];
      if (step.all) {
        targets = resolveFlowElements(step.selector, context);
      } else {
        const single = resolveFlowElement(step.selector, context);
        if (single) {
          targets = [single];
        }
      }
      if (targets.length === 0) {
        break;
      }
      targets.forEach((target) => {
        const triggered = forwardClick(target);
        if (!triggered && typeof target.click === 'function') {
          try {
            target.click();
          } catch (error) {
            console.warn('[PageAugmentor] Flow click fallback failed', error);
          }
        }
      });
      context.performed = true;
      break;
    }
    case 'wait': {
      await delay(step.ms);
      break;
    }
    case 'input': {
      const target = resolveFlowElement(step.selector, context);
      if (target) {
        if (applyInputValue(target, step.value)) {
          context.performed = true;
        }
      }
      break;
    }
    case 'navigate': {
      const sanitized = sanitizeUrl(step.url);
      if (sanitized) {
        const target = step.target || '_blank';
        window.open(sanitized, target, 'noopener');
        context.performed = true;
      }
      break;
    }
    case 'log': {
      console.info('[PageAugmentor][Flow]', step.message);
      break;
    }
    case 'if': {
      const outcome = evaluateFlowCondition(step.condition, context);
      await runFlowSteps(outcome ? step.thenSteps : step.elseSteps, context, depth + 1);
      break;
    }
    case 'while': {
      let iterations = 0;
      while (iterations < step.maxIterations && evaluateFlowCondition(step.condition, context)) {
        iterations += 1;
        await runFlowSteps(step.bodySteps, context, depth + 1);
        enforceRuntimeLimit(context);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * フロー実行が制限時間を超えないようにチェックする。
 * Ensures flow execution stays within the runtime budget.
 * @param {FlowExecutionContext} context
 */
function enforceRuntimeLimit(context) {
  if (Date.now() - context.startTime > FLOW_MAX_RUNTIME_MS) {
    throw new Error('Flow execution exceeded the time limit.');
  }
}

/**
 * フロー用セレクターで最初に一致した要素を返す。
 * Resolves the first matching element for a flow selector.
 * @param {string} selector
 * @param {FlowExecutionContext} context
 * @returns {Element | null}
 */
function resolveFlowElement(selector, context) {
  const [element] = resolveFlowElements(selector, context);
  return element || null;
}

/**
 * フロー用セレクターで一致した要素をすべて返す。
 * Resolves all matching elements for a flow selector.
 * @param {string} selector
 * @param {FlowExecutionContext} context
 * @returns {Element[]}
 */
function resolveFlowElements(selector, context) {
  if (!selector) {
    return [];
  }
  if (selector === FLOW_SELF_SELECTOR) {
    return context.root ? [context.root] : [];
  }
  try {
    return Array.from((context.document || document).querySelectorAll(selector));
  } catch (error) {
    console.warn('[PageAugmentor] Invalid flow selector', selector, error);
    return [];
  }
}

/**
 * 入力要素または編集可能要素に値を入力する。
 * Applies a value to an input-like element.
 * @param {Element} element
 * @param {string} value
 * @returns {boolean}
 */
function applyInputValue(element, value) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus({ preventScroll: true });
    element.value = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus({ preventScroll: true });
    element.textContent = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

/**
 * フロー条件を評価して真偽を返す。
 * Evaluates a flow condition.
 * @param {FlowCondition} condition
 * @param {FlowExecutionContext} context
 * @returns {boolean}
 */
function evaluateFlowCondition(condition, context) {
  if (!condition) {
    return false;
  }
  switch (condition.kind) {
    case 'exists':
      return Boolean(resolveFlowElement(condition.selector, context));
    case 'not':
      return !evaluateFlowCondition(condition.operand, context);
    case 'textContains': {
      const target = resolveFlowElement(condition.selector, context);
      if (!target) {
        return false;
      }
      const text = (target.textContent || '').toLowerCase();
      return text.includes(condition.value.toLowerCase());
    }
    case 'attributeEquals': {
      const target = resolveFlowElement(condition.selector, context);
      if (!target) {
        return false;
      }
      return target.getAttribute(condition.name) === condition.value;
    }
    default:
      return false;
  }
}

/**
 * 指定ミリ秒分の待機を行う。
 * Waits for the requested duration.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  const duration = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * 指定要素に対してポインタークリックを擬似的に発火させる。
 * Attempts to emulate a pointer click on the provided element.
 * @param {Element} target
 * @returns {boolean} whether any event dispatch succeeded
 */
function forwardClick(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const baseInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0,
    clientX,
    clientY,
  };
  const pointerInit = {
    ...baseInit,
    pointerType: 'mouse',
    isPrimary: true,
  };
  let triggered = false;
  const dispatch = (factory) => {
    try {
      const event = factory();
      target.dispatchEvent(event);
      triggered = true;
    } catch (error) {
      // ignore failures and continue with other events
    }
  };
  if (typeof PointerEvent === 'function') {
    dispatch(() => new PointerEvent('pointerdown', pointerInit));
  }
  dispatch(() => new MouseEvent('mousedown', baseInit));
  if (typeof PointerEvent === 'function') {
    dispatch(() => new PointerEvent('pointerup', pointerInit));
  }
  dispatch(() => new MouseEvent('mouseup', baseInit));
  dispatch(() => new MouseEvent('click', baseInit));
  if (typeof target.click === 'function') {
    try {
      target.click();
      triggered = true;
    } catch (error) {
      // ignore failures when invoking click directly
    }
  }
  return triggered;
}

/**
 * 許可されたスタイルキーのみをノードへ適用する。
 * Applies user-provided styles from the whitelist to the node.
 * @param {HTMLElement | null} node
 * @param {import('../common/types.js').InjectedElementStyle | undefined} style
 */
function applyStyle(node, style) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
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
 * 要素タイプごとの基本スタイルを適用する。
 * Applies baseline styling for the element type.
 * @param {HTMLElement} node
 * @param {'button' | 'link' | 'area'} type
 */
function applyBaseAppearance(node, type) {
  node.className = NODE_CLASS;
  node.dataset.nodeType = type;
  node.removeAttribute('style');
  node.style.fontFamily = 'inherit';
  if (type === 'area') {
    node.style.display = 'block';
    node.style.boxSizing = 'border-box';
    node.style.minHeight = '80px';
    node.style.padding = '16px';
    node.style.borderRadius = '14px';
    node.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
    node.style.border = '1px dashed rgba(37, 99, 235, 0.4)';
    node.style.position = 'relative';
    node.style.color = '#0f172a';
    node.style.lineHeight = '1.5';
    node.style.cursor = 'default';
    return;
  }
  if (type === 'link') {
    node.removeAttribute('type');
    node.style.display = 'inline';
    node.style.color = '#2563eb';
    node.style.textDecoration = 'underline';
    node.style.backgroundColor = 'transparent';
    node.style.padding = '0.5rem 1rem';
    node.style.lineHeight = 'inherit';
    node.style.border = 'none';
    node.style.cursor = 'pointer';
    if (node instanceof HTMLAnchorElement) {
      node.setAttribute('role', 'link');
    }
  } else {
    if (node instanceof HTMLButtonElement) {
      node.type = 'button';
    }
    node.style.display = 'inline-flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.padding = '0.5rem 1rem';
    node.style.borderRadius = '8px';
    node.style.backgroundColor = '#1b84ff';
    node.style.color = '#ffffff';
    node.style.fontSize = '16px';
    node.style.fontWeight = '600';
    node.style.lineHeight = '1.2';
    node.style.border = 'none';
    node.style.textDecoration = 'none';
    node.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.12)';
    node.style.cursor = 'pointer';
  }
}

/**
 * camelCase のキーを kebab-case の CSS プロパティ名へ変換する。
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


