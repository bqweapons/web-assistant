import { getLocale, ready as i18nReady, subscribe as subscribeToLocale, t } from '../common/i18n.js';
import { parseActionFlowDefinition, MAX_FLOW_SOURCE_LENGTH } from '../common/flows.js';

const HIGHLIGHT_BORDER_COLOR = '#1b84ff';
const HIGHLIGHT_FILL_COLOR = 'rgba(27, 132, 255, 0.2)';

const VALID_POSITIONS = new Set(['append', 'prepend', 'before', 'after']);
const VALID_TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

function getStyleFieldConfigs() {
  return [
    { name: 'color', label: t('editor.styles.color'), placeholder: '#2563eb', colorPicker: true },
    { name: 'backgroundColor', label: t('editor.styles.backgroundColor'), placeholder: '#1b84ff', colorPicker: true },
    { name: 'fontSize', label: t('editor.styles.fontSize'), placeholder: '16px' },
    { name: 'fontWeight', label: t('editor.styles.fontWeight'), placeholder: '600' },
    { name: 'padding', label: t('editor.styles.padding'), placeholder: '8px 16px' },
    { name: 'borderRadius', label: t('editor.styles.borderRadius'), placeholder: '8px' },
    { name: 'textDecoration', label: t('editor.styles.textDecoration'), placeholder: 'underline' },
  ];
}

const DEFAULT_BUTTON_STYLE = {
  color: '#ffffff',
  backgroundColor: '#1b84ff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '8px 16px',
  borderRadius: '8px',
};

const DEFAULT_LINK_STYLE = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const DEFAULT_TOOLTIP_STYLE = {
  color: '#f8fafc',
  backgroundColor: '#111827',
  fontSize: '14px',
  padding: '8px 12px',
  borderRadius: '12px',
};

function getTypeOptions() {
  return [
    { value: 'button', label: t('type.button') },
    { value: 'link', label: t('type.link') },
    { value: 'tooltip', label: t('type.tooltip') },
  ];
}

function getPositionLabels() {
  return {
    append: t('position.append'),
    prepend: t('position.prepend'),
    before: t('position.before'),
    after: t('position.after'),
  };
}

function getTooltipPositionOptions() {
  return ['top', 'right', 'bottom', 'left'].map((value) => ({ value, label: t(`tooltip.position.${value}`) }));
}

const cssEscape = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
  ? CSS.escape.bind(CSS)
  : /**
     * @param {string} value
     * @returns {string}
     */
    (value) => String(value).replace(/[^a-zA-Z0-9_\-]/g, (char) => `\\${char}`);

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

/**
 * Starts the interactive element picker.
 * @param {{
 *   mode?: 'create' | 'edit';
 *   onSubmit?: (payload: {
 *     selector: string;
 *     type: 'button' | 'link' | 'tooltip';
 *     text: string;
 *     href?: string;
 *     actionSelector?: string;
 *     tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
 *     tooltipPersistent?: boolean;
 *     position: 'append' | 'prepend' | 'before' | 'after';
 *     style?: import('../common/types.js').InjectedElementStyle;
 *     frameSelectors?: string[];
 *     frameLabel?: string;
 *     frameUrl?: string;
 *   }) => void;
 *   onCancel?: () => void;
 *   onTarget?: (target: Element, selector: string) => void;
 *   defaults?: Partial<import('../common/types.js').InjectedElement>;
 *   filter?: (element: Element) => boolean;
 * }} options
 * @returns {{ stop: () => void }}
 */
export function startElementPicker(options = {}) {
  const { mode = 'create', onSubmit, onCancel, onTarget, defaults = {}, filter } = options;
  const overlay = createOverlay();
  document.body.appendChild(overlay.container);
  const bubble = getElementBubble();

  let disposed = false;

  const handleMouseMove = (event) => {
    const hovered = resolveTarget(event.target);
    if (!hovered || (filter && !filter(hovered))) {
      overlay.hide();
      return;
    }
    overlay.show(hovered);
  };

  const handleClick = (event) => {
    const target = resolveTarget(event.target);
    if (!target || (filter && !filter(target))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selector = generateSelector(target);
    overlay.show(target);
    removeListeners();
    const suggestedStyle = getSuggestedStyles(target);
 bubble.open({
    mode,
    selector,
    target,
    values: defaults,
    suggestedStyle,
    onSubmit(result) {
      dispose();
      const frameMetadata = resolveFrameContext(target.ownerDocument?.defaultView || window);
      onSubmit?.({
        ...result,
        selector,
        frameSelectors: frameMetadata.frameSelectors,
        frameLabel: frameMetadata.frameLabel,
        frameUrl: frameMetadata.frameUrl,
      });
    },
      onCancel() {
        dispose('cancel');
      },
    });
    onTarget?.(target, selector);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dispose('cancel');
    }
  };

  const removeListeners = () => {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  };

  const dispose = (reason) => {
    if (disposed) {
      return;
    }
    disposed = true;
    removeListeners();
    bubble.close();
    overlay.dispose();
    if (reason === 'cancel') {
      onCancel?.();
    }
  };

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  return {
    stop() {
      dispose();
    },
  };
}

/**
 * Opens the editor bubble for an existing element.
 * @param {{
 *   target: Element;
 *   selector: string;
 *   values: Partial<import('../common/types.js').InjectedElement>;
 *   onSubmit?: (payload: {
 *     type: 'button' | 'link' | 'tooltip';
 *     text: string;
 *     href?: string;
 *     actionSelector?: string;
 *     tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
 *     tooltipPersistent?: boolean;
 *     position: 'append' | 'prepend' | 'before' | 'after';
 *     style?: import('../common/types.js').InjectedElementStyle;
 *   }) => void;
 *   onCancel?: () => void;
 *   onPreview?: (payload: {
 *     type: 'button' | 'link' | 'tooltip';
 *     text: string;
 *     href?: string;
 *     actionSelector?: string;
 *     tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
 *     tooltipPersistent?: boolean;
 *     position: 'append' | 'prepend' | 'before' | 'after';
 *     style?: import('../common/types.js').InjectedElementStyle;
 *   }) => void;
 }} options
 * @returns {{ close: () => void }}
 */
export function openElementEditor(options) {
  const { target, selector, values = {}, onSubmit, onCancel, onPreview } = options;
  const bubble = getElementBubble();
  bubble.open({
    mode: 'edit',
    selector,
    target,
    values,
    suggestedStyle: values.style || {},
    onSubmit(result) {
      onSubmit?.(result);
    },
    onPreview,
    onCancel() {
      onCancel?.();
    },
  });
  return {
    close() {
      bubble.close();
    },
  };
}

let sharedBubble = /** @type {ReturnType<typeof createElementBubble> | null} */ (null);
let sharedBubbleLocale = getLocale();

subscribeToLocale(() => {
  sharedBubbleLocale = null;
  if (sharedBubble) {
    sharedBubble.destroy();
    sharedBubble = null;
  }
});

i18nReady.then(() => {
  sharedBubbleLocale = null;
  if (sharedBubble) {
    sharedBubble.destroy();
    sharedBubble = null;
  }
});

function getElementBubble() {
  const currentLocale = getLocale();
  if (!sharedBubble || sharedBubbleLocale !== currentLocale) {
    if (sharedBubble) {
      sharedBubble.destroy();
    }
    sharedBubble = createElementBubble();
    sharedBubbleLocale = currentLocale;
  }
  return sharedBubble;
}

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
function resolveTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest('[data-page-augmentor-root]')) {
    return null;
  }
  return target;
}

/**
 * Creates the overlay used to highlight hovered elements.
 * @returns {{ container: HTMLDivElement; show: (element: Element) => void; hide: () => void; dispose: () => void }}
 */
function createOverlay() {
  const container = document.createElement('div');
  container.dataset.pageAugmentorRoot = 'picker-overlay';
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
  });

  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'absolute',
    pointerEvents: 'none',
    border: `2px solid ${HIGHLIGHT_BORDER_COLOR}`,
    backgroundColor: HIGHLIGHT_FILL_COLOR,
    borderRadius: '4px',
    transition: 'all 0.05s ease-out',
    boxSizing: 'border-box',
    opacity: '0',
  });

  container.appendChild(highlight);

  return {
    container,
    show(element) {
      const rect = element.getBoundingClientRect();
      Object.assign(highlight.style, {
        opacity: '1',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    },
    hide() {
      highlight.style.opacity = '0';
    },
    dispose() {
      container.remove();
    },
  };
}

function createElementBubble() {
  const bubble = document.createElement('div');
  bubble.dataset.pageAugmentorRoot = 'picker-element-bubble';
  Object.assign(bubble.style, {
    position: 'fixed',
    zIndex: '2147483647',
    maxWidth: '340px',
    minWidth: '260px',
    maxHeight: '85vh',
    padding: '18px',
    borderRadius: '16px',
    backgroundColor: '#ffffff',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
    color: '#0f172a',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity 0.16s ease, transform 0.16s ease',
    pointerEvents: 'auto',
    backdropFilter: 'blur(16px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  });

  bubble.addEventListener('click', (event) => event.stopPropagation());
  bubble.addEventListener('mousedown', (event) => event.stopPropagation());

  const title = document.createElement('h3');
  title.textContent = t('editor.title');
  Object.assign(title.style, {
    margin: '0 0 10px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
  });

  const selectorWrapper = document.createElement('div');
  Object.assign(selectorWrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    margin: '0',
  });

  const selectorTitle = document.createElement('span');
  selectorTitle.textContent = t('editor.selectorLabel');
  Object.assign(selectorTitle.style, {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: '0.03em',
  });

  const selectorValue = document.createElement('code');
  Object.assign(selectorValue.style, {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 8px',
    borderRadius: '8px',
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    fontSize: '12px',
    color: '#0f172a',
    lineHeight: '1.4',
    wordBreak: 'break-all',
  });

  selectorWrapper.append(selectorTitle, selectorValue);

  const previewWrapper = document.createElement('div');
  Object.assign(previewWrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
    margin: '0',
  });

  const previewLabel = document.createElement('span');
  previewLabel.textContent = t('editor.previewLabel');
  Object.assign(previewLabel.style, {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  });

  const previewTooltipStyle = document.createElement('style');
  previewTooltipStyle.textContent = `
    .page-augmentor-preview-tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      cursor: help;
      font-family: inherit;
    }
    .page-augmentor-preview-tooltip[data-persistent='true'] {
      cursor: default;
    }
    .page-augmentor-preview-tooltip:focus {
      outline: none;
    }
    .page-augmentor-preview-tooltip-trigger {
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
    .page-augmentor-preview-tooltip-bubble {
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
      transform: var(--preview-tooltip-hidden-transform, translate3d(-50%, 6px, 0));
      transition: opacity 0.16s ease, transform 0.16s ease;
      white-space: pre-wrap;
    }
    .page-augmentor-preview-tooltip[data-preview-visible='true'] .page-augmentor-preview-tooltip-bubble,
    .page-augmentor-preview-tooltip[data-persistent='true'] .page-augmentor-preview-tooltip-bubble,
    .page-augmentor-preview-tooltip[data-persistent='false']:hover .page-augmentor-preview-tooltip-bubble,
    .page-augmentor-preview-tooltip[data-persistent='false']:focus-within .page-augmentor-preview-tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
      transform: var(--preview-tooltip-visible-transform, translate3d(-50%, 0, 0));
    }
    .page-augmentor-preview-tooltip[data-position='top'] .page-augmentor-preview-tooltip-bubble {
      bottom: calc(100% + 8px);
      left: 50%;
      --preview-tooltip-hidden-transform: translate3d(-50%, 6px, 0);
      --preview-tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .page-augmentor-preview-tooltip[data-position='bottom'] .page-augmentor-preview-tooltip-bubble {
      top: calc(100% + 8px);
      left: 50%;
      --preview-tooltip-hidden-transform: translate3d(-50%, -6px, 0);
      --preview-tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .page-augmentor-preview-tooltip[data-position='left'] .page-augmentor-preview-tooltip-bubble {
      right: calc(100% + 8px);
      top: 50%;
      --preview-tooltip-hidden-transform: translate3d(6px, -50%, 0);
      --preview-tooltip-visible-transform: translate3d(0, -50%, 0);
    }
    .page-augmentor-preview-tooltip[data-position='right'] .page-augmentor-preview-tooltip-bubble {
      left: calc(100% + 8px);
      top: 50%;
      --preview-tooltip-hidden-transform: translate3d(-6px, -50%, 0);
      --preview-tooltip-visible-transform: translate3d(0, -50%, 0);
    }
  `;

  let previewElement = document.createElement('button');
  previewElement.tabIndex = -1;
  previewElement.style.cursor = 'default';
  previewElement.addEventListener('click', (event) => event.preventDefault());
  previewWrapper.append(previewLabel, previewTooltipStyle, previewElement);

  const form = document.createElement('form');
  Object.assign(form.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: '1 1 auto',
    minHeight: '0',
  });

  const formBody = document.createElement('div');
  Object.assign(formBody.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: '1 1 auto',
    minHeight: '0',
    overflowY: 'auto',
    paddingTop: '6px',
  });

  const typeSelect = document.createElement('select');
  getTypeOptions().forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    typeSelect.appendChild(option);
  });
  styleInput(typeSelect);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.placeholder = t('editor.textPlaceholder');
  textInput.maxLength = 160;
  styleInput(textInput);

  const hrefInput = document.createElement('input');
  hrefInput.type = 'url';
  hrefInput.placeholder = t('editor.hrefPlaceholder');
  styleInput(hrefInput);

  const actionInput = document.createElement('input');
  actionInput.type = 'text';
  actionInput.placeholder = t('editor.actionPlaceholder');
  actionInput.autocomplete = 'off';
  styleInput(actionInput);
  actionInput.style.flex = '1';
  actionInput.style.width = 'auto';

  const actionPickButton = document.createElement('button');
  actionPickButton.type = 'button';
  actionPickButton.textContent = t('editor.actionPick');
  actionPickButton.dataset.state = 'idle';
  Object.assign(actionPickButton.style, {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    backgroundColor: '#f1f5f9',
    fontSize: '12px',
    fontWeight: '600',
    color: '#2563eb',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  const actionControls = document.createElement('div');
  Object.assign(actionControls.style, {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  });
  actionControls.append(actionInput, actionPickButton);

  const actionFlowInput = document.createElement('textarea');
  actionFlowInput.placeholder = t('editor.actionFlowPlaceholder');
  actionFlowInput.rows = 6;
  actionFlowInput.spellcheck = false;
  styleInput(actionFlowInput);
  actionFlowInput.style.minHeight = '120px';
  actionFlowInput.style.fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  actionFlowInput.style.whiteSpace = 'pre';
  actionFlowInput.style.resize = 'vertical';

  const positionSelect = document.createElement('select');
  const positionLabels = getPositionLabels();
  ['append', 'prepend', 'before', 'after'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = positionLabels[value] || value;
    positionSelect.appendChild(option);
  });
  styleInput(positionSelect);

  const tooltipPositionSelect = document.createElement('select');
  getTooltipPositionOptions().forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    tooltipPositionSelect.appendChild(option);
  });
  styleInput(tooltipPositionSelect);

  const tooltipPersistentCheckbox = document.createElement('input');
  tooltipPersistentCheckbox.type = 'checkbox';
  tooltipPersistentCheckbox.style.width = '16px';
  tooltipPersistentCheckbox.style.height = '16px';
  tooltipPersistentCheckbox.style.margin = '0';
  tooltipPersistentCheckbox.style.cursor = 'pointer';
  tooltipPersistentCheckbox.style.borderRadius = '4px';
  tooltipPersistentCheckbox.style.border = '1px solid rgba(148, 163, 184, 0.6)';
  tooltipPersistentCheckbox.style.accentColor = '#2563eb';

  const tooltipPersistentLabel = document.createElement('span');
  tooltipPersistentLabel.textContent = t('editor.tooltipPersistenceCheckbox');
  Object.assign(tooltipPersistentLabel.style, {
    fontSize: '13px',
    color: '#0f172a',
  });

  const tooltipPersistentRow = document.createElement('label');
  Object.assign(tooltipPersistentRow.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  });
  tooltipPersistentRow.append(tooltipPersistentCheckbox, tooltipPersistentLabel);

  const tooltipPersistentHint = document.createElement('p');
  tooltipPersistentHint.textContent = t('editor.tooltipPersistenceHint');
  Object.assign(tooltipPersistentHint.style, {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });

  const typeField = createField(t('editor.typeLabel'), typeSelect);
  const textField = createField(t('editor.textLabel'), textInput);
  const hrefField = createField(t('editor.hrefLabel'), hrefInput);
  const actionField = createField(t('editor.actionLabel'));
  const actionHint = document.createElement('p');
  const defaultActionHintText = t('editor.actionHintDefault');
  actionHint.textContent = defaultActionHintText;
  Object.assign(actionHint.style, {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  actionHint.dataset.defaultColor = '#94a3b8';
  actionField.wrapper.append(actionControls, actionHint);
  const actionFlowField = createField(t('editor.actionFlowLabel'), actionFlowInput);
  const actionFlowHint = document.createElement('p');
  actionFlowHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
  Object.assign(actionFlowHint.style, {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  actionFlowHint.dataset.defaultColor = '#94a3b8';
  actionFlowField.wrapper.append(actionFlowHint);
  const tooltipPositionField = createField(t('editor.tooltipPositionLabel'), tooltipPositionSelect);
  tooltipPositionField.wrapper.style.display = 'none';
  const tooltipPersistentField = createField(t('editor.tooltipPersistenceLabel'));
  tooltipPersistentField.wrapper.append(tooltipPersistentRow, tooltipPersistentHint);
  tooltipPersistentField.wrapper.style.display = 'none';
  const positionField = createField(t('editor.positionLabel'), positionSelect);

  const styleFieldset = document.createElement('fieldset');
  Object.assign(styleFieldset.style, {
    border: '1px dashed rgba(148, 163, 184, 0.6)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  });

  const styleLegend = document.createElement('legend');
  styleLegend.textContent = t('editor.stylesLegend');
  Object.assign(styleLegend.style, {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    padding: '0 6px',
  });
  styleFieldset.appendChild(styleLegend);

  const styleInputs = new Map();
  const styleState = {};
  const styleFieldConfigs = getStyleFieldConfigs();
  styleFieldConfigs.forEach(({ name }) => {
    styleState[name] = '';
  });

  styleFieldConfigs.forEach((config) => {
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = config.placeholder || '';
    styleInput(textInput);

    let colorInput = null;
    if (config.colorPicker) {
      colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = config.placeholder && config.placeholder.startsWith('#') ? config.placeholder : '#ffffff';
      colorInput.dataset.defaultValue = colorInput.value;
      Object.assign(colorInput.style, {
        width: '42px',
        height: '36px',
        padding: '0',
        borderRadius: '10px',
        border: 'none',
        background: '#ffffff',
        cursor: 'pointer',
      });
      colorInput.addEventListener('focus', () => {
        colorInput.style.borderColor = '#2563eb';
        colorInput.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
      });
      colorInput.addEventListener('blur', () => {
        colorInput.style.borderColor = 'rgba(148, 163, 184, 0.6)';
        colorInput.style.boxShadow = 'none';
      });
    }

    const field = createField(config.label);
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    });
    inputRow.appendChild(textInput);
    if (colorInput) {
      inputRow.appendChild(colorInput);
    }
    field.wrapper.appendChild(inputRow);
    styleFieldset.appendChild(field.wrapper);
    styleInputs.set(config.name, { text: textInput, color: colorInput });
  });

  const styleHint = document.createElement('p');
  styleHint.textContent = t('editor.stylesHint');
  Object.assign(styleHint.style, {
    margin: '0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  styleFieldset.appendChild(styleHint);

  const errorLabel = document.createElement('p');
  errorLabel.textContent = '';
  Object.assign(errorLabel.style, {
    margin: '0px 0 0 0',
    fontSize: '12px',
    color: '#dc2626',
    minHeight: '16px',
  });

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 0 0',
    borderTop: '1px solid rgba(226, 232, 240, 0.9)',
    backgroundColor: '#ffffff',
  });

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = t('editor.cancel');
  Object.assign(cancelButton.style, {
    padding: '7px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    backgroundColor: '#f8fafc',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
  });

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.textContent = t('editor.save');
  Object.assign(saveButton.style, {
    padding: '7px 12px',
    borderRadius: '10px',
    border: 'none',
    backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(79, 70, 229, 0.18)',
  });

  actions.append(cancelButton, saveButton);

  const sectionsTabs = createTabGroup();

  const basicSection = sectionsTabs.addSection(
    t('editor.sections.basics.title'),
    t('editor.sections.basics.description'),
  );
  basicSection.content.append(typeField.wrapper, textField.wrapper, hrefField.wrapper);

  const behaviorSection = sectionsTabs.addSection(
    t('editor.sections.behavior.title'),
    t('editor.sections.behavior.description'),
  );
  behaviorSection.content.append(actionField.wrapper, actionFlowField.wrapper);

  const tooltipSection = sectionsTabs.addSection(
    t('editor.sections.tooltip.title'),
    t('editor.sections.tooltip.description'),
  );
  tooltipSection.content.append(tooltipPositionField.wrapper, tooltipPersistentField.wrapper);
  tooltipSection.setVisible(false);

  const placementSection = sectionsTabs.addSection(
    t('editor.sections.placement.title'),
    t('editor.sections.placement.description'),
  );
  placementSection.content.append(positionField.wrapper);

  const appearanceSection = sectionsTabs.addSection(
    t('editor.sections.appearance.title'),
    t('editor.sections.appearance.description'),
  );
  appearanceSection.content.append(styleFieldset);

  formBody.append(sectionsTabs.container);

  form.append(formBody, actions);

  bubble.append(title, selectorWrapper, previewWrapper, form, errorLabel);

  /** @type {Element | null} */
  let currentTarget = null;
  /** @type {() => void} */
  let cancelHandler = () => {};
  /** @type {(payload: { type: 'button' | 'link' | 'tooltip'; text: string; href?: string; actionSelector?: string; tooltipPosition?: 'top' | 'right' | 'bottom' | 'left'; tooltipPersistent?: boolean; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void} */
  let submitHandler = () => {};
  /** @type {null | ((payload: { type: 'button' | 'link' | 'tooltip'; text: string; href?: string; actionSelector?: string; tooltipPosition?: 'top' | 'right' | 'bottom' | 'left'; tooltipPersistent?: boolean; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void)} */
  let previewHandler = null;
  /** @type {null | ((reason?: 'cancel' | 'select') => void)} */
  let actionPickerCleanup = null;
  let originalCursor = '';
  let isAttached = false;

  const state = {
    type: 'button',
    text: '',
    href: '',
    actionSelector: '',
    actionFlow: '',
    actionFlowError: '',
    actionFlowSteps: 0,
    position: 'append',
    tooltipPosition: 'top',
    tooltipPersistent: false,
  };

  const clearError = () => {
    errorLabel.textContent = '';
  };

  [
    textInput,
    hrefInput,
    actionInput,
    actionFlowInput,
    typeSelect,
    positionSelect,
    tooltipPositionSelect,
    tooltipPersistentCheckbox,
  ].forEach((input) => {
    input.addEventListener('input', clearError);
    input.addEventListener('change', clearError);
  });

  const resetStyleState = (source) => {
    styleFieldConfigs.forEach(({ name }) => {
      const value = source && typeof source[name] === 'string' ? source[name] : '';
      styleState[name] = value;
      const record = styleInputs.get(name);
      if (!record) {
        return;
      }
      record.text.value = value || '';
      if (record.color) {
        if (value && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i.test(value)) {
          record.color.value = value;
          record.color.dataset.defaultValue = value;
        } else {
          const fallback =
            (source && typeof source[name] === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i.test(source[name])
              ? source[name]
              : record.color.dataset.defaultValue) || '#ffffff';
          record.color.value = fallback;
          record.color.dataset.defaultValue = fallback;
        }
      }
    });
  };

  const buildPayload = () => {
    const textValue = state.text.trim();
    const hrefValue = state.href.trim();
    const position = VALID_POSITIONS.has(state.position) ? state.position : 'append';
    const style = normalizeStyleState(styleState);
    const type = state.type === 'link' ? 'link' : state.type === 'tooltip' ? 'tooltip' : 'button';
    const payload = {
      type,
      text: textValue,
      position,
      style,
    };
    if (type === 'link') {
      if (hrefValue) {
        payload.href = hrefValue;
      }
    } else if (type === 'button') {
      if (hrefValue) {
        payload.href = hrefValue;
      }
      const actionValue = state.actionSelector.trim();
      if (actionValue) {
        payload.actionSelector = actionValue;
      }
      const flowValue = state.actionFlow.trim();
      if (flowValue) {
        payload.actionFlow = flowValue;
      }
    } else if (type === 'tooltip') {
      const tooltipPosition = VALID_TOOLTIP_POSITIONS.has(state.tooltipPosition)
        ? state.tooltipPosition
        : 'top';
      payload.tooltipPosition = tooltipPosition;
      payload.tooltipPersistent = Boolean(state.tooltipPersistent);
    }
    return payload;
  };

  const updateActionHint = () => {
    const value = state.type === 'button' ? state.actionSelector.trim() : '';
    if (value) {
      actionHint.textContent = t('editor.actionHintSelected', { selector: value });
      actionHint.style.color = '#0f172a';
    } else {
      actionHint.textContent = defaultActionHintText;
      actionHint.style.color = actionHint.dataset.defaultColor || '#94a3b8';
    }
    if (state.type !== 'button') {
      actionFlowHint.textContent = '';
      return;
    }
    const flowValue = state.actionFlow.trim();
    if (!flowValue) {
      actionFlowHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
      actionFlowHint.style.color = actionFlowHint.dataset.defaultColor || '#94a3b8';
    } else if (state.actionFlowError) {
      actionFlowHint.textContent = t('editor.actionFlowHintError', { error: state.actionFlowError });
      actionFlowHint.style.color = '#dc2626';
    } else if (state.actionFlowSteps > 0) {
      actionFlowHint.textContent = t('editor.actionFlowHintConfigured', { count: state.actionFlowSteps });
      actionFlowHint.style.color = '#0f172a';
    } else {
      actionFlowHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
      actionFlowHint.style.color = actionFlowHint.dataset.defaultColor || '#94a3b8';
    }
  };

  const validateActionFlowInput = () => {
    if (state.type !== 'button') {
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
      return;
    }
    const trimmed = state.actionFlow.trim();
    if (!trimmed) {
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
      return;
    }
    const { definition, error } = parseActionFlowDefinition(trimmed);
    if (error) {
      state.actionFlowError = error;
      state.actionFlowSteps = 0;
    } else if (definition) {
      state.actionFlowError = '';
      state.actionFlowSteps = definition.stepCount;
    } else {
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
    }
  };

  const ensurePreviewElement = (type) => {
    if (type === 'tooltip') {
      if (
        !(previewElement instanceof HTMLElement) ||
        previewElement.dataset.previewType !== 'tooltip'
      ) {
        const replacement = createPreviewTooltipNode();
        previewWrapper.replaceChild(replacement, previewElement);
        previewElement = replacement;
      }
      return;
    }
    const desiredTag = type === 'link' ? 'a' : 'button';
    if (
      previewElement.dataset.previewType === 'tooltip' ||
      previewElement.tagName.toLowerCase() !== desiredTag
    ) {
      const replacement = document.createElement(desiredTag);
      replacement.tabIndex = -1;
      replacement.style.cursor = 'default';
      replacement.addEventListener('click', (event) => event.preventDefault());
      previewWrapper.replaceChild(replacement, previewElement);
      previewElement = replacement;
    }
    delete previewElement.dataset.previewType;
    if (type === 'link') {
      previewElement.setAttribute('href', '#');
      previewElement.setAttribute('role', 'link');
    } else {
      previewElement.removeAttribute('href');
    }
  };

  const createPreviewTooltipNode = () => {
    const container = document.createElement('div');
    container.dataset.previewType = 'tooltip';
    container.className = 'page-augmentor-preview-tooltip';
    container.dataset.position = 'top';
    container.dataset.persistent = 'false';
    container.dataset.previewVisible = 'true';
    container.tabIndex = -1;
    const trigger = document.createElement('span');
    trigger.className = 'page-augmentor-preview-tooltip-trigger';
    trigger.textContent = 'ⓘ';
    trigger.setAttribute('aria-hidden', 'true');
    const bubble = document.createElement('div');
    bubble.className = 'page-augmentor-preview-tooltip-bubble';
    bubble.textContent = t('editor.previewTooltip');
    container.append(trigger, bubble);
    return container;
  };

  const updatePreview = (options = { propagate: true }) => {
    const payload = buildPayload();
    ensurePreviewElement(payload.type);
    if (payload.type === 'tooltip') {
      applyTooltipPreview(previewElement, payload);
    } else {
      previewElement.textContent =
        payload.text || (payload.type === 'link' ? t('editor.previewLink') : t('editor.previewButton'));
      applyPreviewBase(previewElement, payload.type);
      if (payload.style) {
        Object.entries(payload.style).forEach(([key, value]) => {
          previewElement.style[key] = value;
        });
      }
    }
    if (options.propagate && typeof previewHandler === 'function') {
      previewHandler(payload);
    }
    updateActionHint();
  };

  const handleTypeChange = (applyDefaults = false) => {
    const isLink = state.type === 'link';
    const isButton = state.type === 'button';
    const isTooltip = state.type === 'tooltip';

    hrefInput.required = isLink;
    hrefInput.disabled = isTooltip;
    hrefInput.placeholder = isLink
      ? t('editor.hrefPlaceholder')
      : isTooltip
        ? t('editor.hrefTooltipPlaceholder')
        : t('editor.hrefOptionalPlaceholder');
    hrefField.label.textContent = isLink
      ? t('editor.hrefLabel')
      : isTooltip
        ? t('editor.hrefTooltipLabel')
        : t('editor.hrefOptionalLabel');
    hrefField.wrapper.style.display = isTooltip ? 'none' : 'flex';

    actionField.wrapper.style.display = isButton ? 'flex' : 'none';
    actionInput.disabled = !isButton;
    actionPickButton.disabled = !isButton;
    actionPickButton.style.cursor = isButton ? 'pointer' : 'not-allowed';
    actionPickButton.style.opacity = isButton ? '1' : '0.6';
    actionFlowField.wrapper.style.display = isButton ? 'flex' : 'none';
    actionFlowInput.disabled = !isButton;
    if (!isButton) {
      stopActionPicker('cancel');
    }
    behaviorSection.setVisible(isButton);

    tooltipPositionField.wrapper.style.display = isTooltip ? 'flex' : 'none';
    tooltipPositionSelect.disabled = !isTooltip;
    tooltipPersistentField.wrapper.style.display = isTooltip ? 'flex' : 'none';
    tooltipPersistentCheckbox.disabled = !isTooltip;
    tooltipSection.setVisible(isTooltip);

    textInput.placeholder = isTooltip ? t('editor.tooltipTextPlaceholder') : t('editor.textPlaceholder');

    validateActionFlowInput();
    updateActionHint();
    if (applyDefaults) {
      const defaults = isLink
        ? DEFAULT_LINK_STYLE
        : isTooltip
          ? DEFAULT_TOOLTIP_STYLE
          : DEFAULT_BUTTON_STYLE;
      resetStyleState(defaults);
      if (isTooltip) {
        state.tooltipPosition = 'top';
        tooltipPositionSelect.value = 'top';
        state.tooltipPersistent = false;
        tooltipPersistentCheckbox.checked = false;
      }
    }
    updatePreview();
  };

  typeSelect.addEventListener('change', (event) => {
    const selected = event.target.value;
    state.type = selected === 'link' ? 'link' : selected === 'tooltip' ? 'tooltip' : 'button';
    handleTypeChange(true);
  });

  textInput.addEventListener('input', (event) => {
    state.text = event.target.value;
    updatePreview();
  });

  hrefInput.addEventListener('input', (event) => {
    state.href = event.target.value;
    updatePreview();
  });

  actionInput.addEventListener('input', (event) => {
    state.actionSelector = event.target.value;
    updatePreview();
  });

  actionFlowInput.addEventListener('input', (event) => {
    state.actionFlow = event.target.value;
    validateActionFlowInput();
    updateActionHint();
  });

  actionFlowInput.addEventListener('change', (event) => {
    state.actionFlow = event.target.value;
    validateActionFlowInput();
    updateActionHint();
  });

  positionSelect.addEventListener('change', (event) => {
    state.position = event.target.value;
    updatePreview();
  });

  tooltipPositionSelect.addEventListener('change', (event) => {
    clearError();
    state.tooltipPosition = event.target.value;
    updatePreview();
  });

  tooltipPersistentCheckbox.addEventListener('change', (event) => {
    clearError();
    state.tooltipPersistent = Boolean(event.target.checked);
    updatePreview();
  });

  actionPickButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actionPickButton.disabled) {
      return;
    }
    if (actionPickerCleanup) {
      stopActionPicker('cancel');
    } else {
      startActionPicker();
    }
  });

  function setActionPickerState(picking) {
    if (picking) {
      actionPickButton.textContent = t('editor.actionCancel');
      actionPickButton.dataset.state = 'picking';
      actionPickButton.style.backgroundColor = '#e0e7ff';
      actionPickButton.style.borderColor = '#6366f1';
      actionHint.textContent = t('editor.actionHintPicking');
      actionHint.style.color = '#2563eb';
    } else {
      actionPickButton.textContent = t('editor.actionPick');
      actionPickButton.dataset.state = 'idle';
      actionPickButton.style.backgroundColor = '#f1f5f9';
      actionPickButton.style.borderColor = 'rgba(148, 163, 184, 0.6)';
      updateActionHint();
    }
  }

  function startActionPicker() {
    if (actionPickerCleanup) {
      return;
    }
    const overlay = createOverlay();
    document.body.appendChild(overlay.container);
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'copy';
    setActionPickerState(true);

    const handleMove = (event) => {
      const candidate = findClickableElement(event.target);
      if (!candidate) {
        overlay.hide();
        return;
      }
      overlay.show(candidate);
    };

    const handleClick = (event) => {
      const candidate = findClickableElement(event.target);
      if (!candidate) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const selector = generateSelector(candidate);
      state.actionSelector = selector;
      actionInput.value = selector;
      updatePreview();
      stopActionPicker('select');
      actionInput.focus({ preventScroll: true });
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        stopActionPicker('cancel');
      }
    };

    actionPickerCleanup = (reason = 'cancel') => {
      document.removeEventListener('mousemove', handleMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeydown, true);
      overlay.dispose();
      document.body.style.cursor = originalCursor || '';
      originalCursor = '';
      setActionPickerState(false);
      actionPickerCleanup = null;
      if (reason !== 'select') {
        updateActionHint();
      }
    };

    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);
  }

  function stopActionPicker(reason = 'cancel') {
    if (actionPickerCleanup) {
      actionPickerCleanup(reason);
    }
  }

  styleFieldConfigs.forEach(({ name }) => {
    const record = styleInputs.get(name);
    if (!record) {
      return;
    }
    record.text.addEventListener('input', clearError);
    record.text.addEventListener('change', clearError);
    record.text.addEventListener('input', (event) => {
      styleState[name] = event.target.value;
      if (record.color && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i.test(event.target.value.trim())) {
        const hex = event.target.value.trim();
        record.color.value = hex;
        record.color.dataset.defaultValue = hex;
      }
      updatePreview();
    });
    record.text.addEventListener('change', (event) => {
      styleState[name] = event.target.value;
      updatePreview();
    });
    if (record.color) {
      record.color.addEventListener('input', clearError);
      record.color.addEventListener('change', clearError);
      record.color.addEventListener('input', (event) => {
        styleState[name] = event.target.value;
        record.text.value = event.target.value;
        record.color.dataset.defaultValue = event.target.value;
        updatePreview();
      });
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload.text) {
      errorLabel.textContent = t('editor.errorTextRequired');
      textInput.focus({ preventScroll: true });
      return;
    }
    if (payload.type === 'link' && !state.href.trim()) {
      errorLabel.textContent = t('editor.errorUrlRequired');
      hrefInput.focus({ preventScroll: true });
      return;
    }
    if (payload.type === 'button') {
      const flowValue = state.actionFlow.trim();
      if (flowValue) {
        const { definition, error } = parseActionFlowDefinition(flowValue);
        if (error || !definition) {
          errorLabel.textContent = t('editor.errorFlowInvalid', { error: error || '' });
          actionFlowInput.focus({ preventScroll: true });
          return;
        }
        payload.actionFlow = flowValue;
      } else {
        delete payload.actionFlow;
      }
    }
    submitHandler(payload);
  });

  cancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    cancelHandler();
  });

  const handleScroll = () => updatePosition();
  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelHandler();
    }
  };

  function attach() {
    if (isAttached) {
      return;
    }
    isAttached = true;
    document.body.appendChild(bubble);
    requestAnimationFrame(() => {
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0)';
      textInput.focus({ preventScroll: true });
    });
    updatePosition();
    window.addEventListener('resize', updatePosition, true);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeydown, true);
  }

  function detach() {
    if (!isAttached) {
      return;
    }
    stopActionPicker('cancel');
    isAttached = false;
    window.removeEventListener('resize', updatePosition, true);
    document.removeEventListener('scroll', handleScroll, true);
    document.removeEventListener('keydown', handleKeydown, true);
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(6px)';
    setTimeout(() => {
      if (!isAttached && bubble.isConnected) {
        bubble.remove();
      }
    }, 160);
  }

  function updatePosition() {
    if (!currentTarget || !document.contains(currentTarget)) {
      cancelHandler();
      return;
    }
    const rect = currentTarget.getBoundingClientRect();
    const bubbleWidth = bubble.offsetWidth || 300;
    const bubbleHeight = bubble.offsetHeight || 320;

    let top = rect.top;
    if (top + bubbleHeight + 12 > window.innerHeight) {
      top = window.innerHeight - bubbleHeight - 12;
    }
    top = Math.max(12, top);

    let left = rect.right + 12;
    left = Math.max(12, Math.min(window.innerWidth - bubbleWidth - 12, left));

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  }

  return {
    open(config) {
      const { selector, target, values, suggestedStyle, onSubmit, onCancel, onPreview, mode } = config;
      currentTarget = target;
      selectorValue.textContent = selector;
      previewHandler = typeof onPreview === 'function' ? onPreview : null;
      const initial = defaultElementValues(values, suggestedStyle);
      state.type = initial.type;
      state.text = initial.text;
      state.href = initial.href;
      state.actionSelector = initial.actionSelector;
      state.actionFlow = initial.actionFlow;
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
      state.position = initial.position;
      state.tooltipPosition = initial.tooltipPosition;
      state.tooltipPersistent = initial.tooltipPersistent;
      typeSelect.value = state.type;
      textInput.value = state.text;
      hrefInput.value = state.href;
      actionInput.value = state.actionSelector;
      actionFlowInput.value = state.actionFlow;
      positionSelect.value = state.position;
      tooltipPositionSelect.value = state.tooltipPosition;
      tooltipPersistentCheckbox.checked = state.tooltipPersistent;
      resetStyleState(initial.style);
      stopActionPicker('cancel');
      setActionPickerState(false);
      handleTypeChange();
      errorLabel.textContent = '';
      title.textContent = mode === 'edit' ? t('editor.titleEdit') : t('editor.titleCreate');
      saveButton.textContent = mode === 'edit' ? t('editor.saveUpdate') : t('editor.saveCreate');
      validateActionFlowInput();
      updatePreview({ propagate: false });
      submitHandler = (payload) => {
        detach();
        currentTarget = null;
        onSubmit(payload);
      };
      cancelHandler = () => {
        detach();
        currentTarget = null;
        onCancel();
      };
      attach();
    },
    close() {
      detach();
      currentTarget = null;
    },
    destroy() {
      detach();
      if (bubble.isConnected) {
        bubble.remove();
      }
    },
  };
}

function defaultElementValues(values = {}, suggestedStyle = {}) {
  const type = values.type === 'link' ? 'link' : values.type === 'tooltip' ? 'tooltip' : 'button';
  const text = typeof values.text === 'string' ? values.text : '';
  const href = typeof values.href === 'string' ? values.href : '';
  const actionSelector = typeof values.actionSelector === 'string' ? values.actionSelector : '';
  const actionFlow = typeof values.actionFlow === 'string' ? values.actionFlow : '';
  const position = VALID_POSITIONS.has(values.position)
    ? /** @type {'append' | 'prepend' | 'before' | 'after'} */ (values.position)
    : 'append';
  const tooltipPosition =
    values.tooltipPosition && VALID_TOOLTIP_POSITIONS.has(values.tooltipPosition)
      ? /** @type {'top' | 'right' | 'bottom' | 'left'} */ (values.tooltipPosition)
      : 'top';
  const tooltipPersistent = Boolean(values.tooltipPersistent);
  const defaults =
    type === 'link' ? DEFAULT_LINK_STYLE : type === 'tooltip' ? DEFAULT_TOOLTIP_STYLE : DEFAULT_BUTTON_STYLE;
  const style = {};
  const configs = getStyleFieldConfigs();
  configs.forEach(({ name }) => {
    if (values.style && typeof values.style[name] === 'string') {
      style[name] = values.style[name];
    } else if (suggestedStyle && typeof suggestedStyle[name] === 'string') {
      style[name] = suggestedStyle[name];
    } else {
      style[name] = '';
    }
    if (!style[name] && defaults && defaults[name]) {
      style[name] = defaults[name];
    }
  });
  return {
    type,
    text,
    href,
    actionSelector,
    actionFlow,
    position,
    tooltipPosition,
    tooltipPersistent,
    style,
  };
}

let tabIdCounter = 0;

function createTabGroup() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: '1 1 auto',
    minHeight: '0',
  });

  const tabList = document.createElement('div');
  tabList.setAttribute('role', 'tablist');
  Object.assign(tabList.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
  });

  const panels = document.createElement('div');
  Object.assign(panels.style, {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: '0',
  });

  container.append(tabList, panels);

  /** @type {{
   *  tabButton: HTMLButtonElement;
   *  section: HTMLElement;
   *  content: HTMLElement;
   *  visible: boolean;
   *  setVisible: (visible: boolean) => void;
   * }[]} */
  const sections = [];
  /** @type {null | typeof sections[number]} */
  let activeSection = null;

  function applyTabState(sectionObj, isActive) {
    sectionObj.tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
    sectionObj.tabButton.style.backgroundColor = isActive
      ? 'rgba(59, 130, 246, 0.12)'
      : 'transparent';
    sectionObj.tabButton.style.borderColor = isActive
      ? 'rgba(59, 130, 246, 0.35)'
      : 'rgba(148, 163, 184, 0.45)';
    sectionObj.tabButton.style.color = isActive ? '#1d4ed8' : '#475569';
    // sectionObj.tabButton.style.boxShadow = isActive ? '0 6px 18px rgba(37, 99, 235, 0.16)' : 'none';
  }

  function ensureActiveSection() {
    if (activeSection && activeSection.visible) {
      return;
    }
    const next = sections.find((section) => section.visible);
    if (next) {
      activate(next);
    }
  }

  function activate(sectionObj) {
    if (!sectionObj.visible) {
      return;
    }
    if (activeSection === sectionObj) {
      sectionObj.section.style.display = 'flex';
      applyTabState(sectionObj, true);
      return;
    }
    if (activeSection) {
      activeSection.section.style.display = 'none';
      applyTabState(activeSection, false);
    }
    activeSection = sectionObj;
    sectionObj.section.style.display = 'flex';
    applyTabState(sectionObj, true);
  }

  return {
    container,
    addSection(titleText, descriptionText = '') {
      const { section, content } = createSection(titleText, descriptionText);
      section.style.display = 'none';

      const tabButton = document.createElement('button');
      tabButton.type = 'button';
      tabButton.textContent = titleText;
      tabButton.setAttribute('role', 'tab');
      const tabId = `page-augmentor-tab-${++tabIdCounter}`;
      const panelId = `${tabId}-panel`;
      tabButton.id = tabId;
      section.id = panelId;
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-labelledby', tabId);
      tabButton.setAttribute('aria-controls', panelId);
      Object.assign(tabButton.style, {
        border: '1px solid rgba(148, 163, 184, 0.45)',
        background: 'transparent',
        borderRadius: '999px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: '#475569',
        cursor: 'pointer',
        transition: 'all 0.16s ease',
        boxShadow: 'none',
      });

      const sectionObj = {
        tabButton,
        section,
        content,
        visible: true,
        setVisible(visible) {
          if (sectionObj.visible === visible) {
            return;
          }
          sectionObj.visible = visible;
          tabButton.style.display = visible ? '' : 'none';
          if (!visible) {
            section.style.display = 'none';
            applyTabState(sectionObj, false);
            if (activeSection === sectionObj) {
              activeSection = null;
              ensureActiveSection();
            }
          } else {
            ensureActiveSection();
          }
        },
      };

      tabButton.addEventListener('mouseenter', () => {
        if (activeSection === sectionObj || !sectionObj.visible) {
          return;
        }
        tabButton.style.borderColor = 'rgba(148, 163, 184, 0.65)';
        tabButton.style.backgroundColor = 'rgba(148, 163, 184, 0.12)';
      });
      tabButton.addEventListener('mouseleave', () => {
        if (activeSection === sectionObj || !sectionObj.visible) {
          return;
        }
        tabButton.style.backgroundColor = 'transparent';
        tabButton.style.borderColor = 'rgba(148, 163, 184, 0.45)';
      });

      tabButton.addEventListener('click', () => activate(sectionObj));

      sections.push(sectionObj);
      tabList.appendChild(tabButton);
      panels.appendChild(section);

      if (!activeSection && sectionObj.visible) {
        activate(sectionObj);
      }

      return sectionObj;
    },
    activate,
  };
}

function createSection(titleText, descriptionText = '') {
  const section = document.createElement('section');
  Object.assign(section.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });

  const title = document.createElement('h4');
  title.textContent = titleText;
  Object.assign(title.style, {
    margin: '0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0f172a',
  });
  header.appendChild(title);

  if (descriptionText) {
    const description = document.createElement('p');
    description.textContent = descriptionText;
    Object.assign(description.style, {
      margin: '0',
      fontSize: '12px',
      color: '#64748b',
      lineHeight: '1.5',
    });
    header.appendChild(description);
  }

  const content = document.createElement('div');
  Object.assign(content.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });

  section.append(header, content);
  return { section, content };
}

function createField(labelText, control = null) {
  const wrapper = document.createElement('label');
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontWeight: '500',
    color: '#0f172a',
  });
  const label = document.createElement('span');
  label.textContent = labelText;
  Object.assign(label.style, {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: '#64748b',
  });
  wrapper.appendChild(label);
  if (control) {
    wrapper.appendChild(control);
  }
  return { wrapper, label };
}

function styleInput(element) {
  Object.assign(element.style, {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
  });
  element.addEventListener('focus', () => {
    element.style.borderColor = '#2563eb';
    element.style.backgroundColor = '#ffffff';
    element.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
  });
  element.addEventListener('blur', () => {
    element.style.borderColor = 'rgba(148, 163, 184, 0.6)';
    element.style.backgroundColor = 'rgba(241, 245, 249, 0.6)';
    element.style.boxShadow = 'none';
  });
}

function normalizeStyleState(styleState) {
  const entries = {};
  getStyleFieldConfigs().forEach(({ name }) => {
    const value = typeof styleState[name] === 'string' ? styleState[name].trim() : '';
    if (value) {
      entries[name] = value;
    }
  });
  return Object.keys(entries).length ? entries : undefined;
}

function applyPreviewBase(element, type) {
  element.removeAttribute('style');
  element.style.cursor = 'default';
  element.style.fontFamily = 'inherit';
  if (type === 'link') {
    element.style.display = 'inline';
    element.style.color = '#2563eb';
    element.style.textDecoration = 'underline';
    element.style.padding = '0';
    element.style.lineHeight = 'inherit';
    element.style.backgroundColor = 'transparent';
  } else {
    element.style.display = 'inline-flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.padding = '8px 16px';
    element.style.borderRadius = '8px';
    element.style.backgroundColor = '#1b84ff';
    element.style.color = '#fff';
    element.style.fontSize = '16px';
    element.style.fontWeight = '600';
    element.style.lineHeight = '1.2';
    element.style.border = 'none';
    element.style.textDecoration = 'none';
    element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.12)';
  }
}

/**
 * Applies tooltip preview styling and content.
 * @param {HTMLElement} container
 * @param {{ text: string; tooltipPosition?: string; tooltipPersistent?: boolean; style?: import('../common/types.js').InjectedElementStyle }} payload
 */
function applyTooltipPreview(container, payload) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.dataset.previewType = 'tooltip';
  container.className = 'page-augmentor-preview-tooltip';
  const position =
    payload.tooltipPosition && VALID_TOOLTIP_POSITIONS.has(payload.tooltipPosition)
      ? payload.tooltipPosition
      : 'top';
  container.dataset.position = position;
  container.dataset.persistent = payload.tooltipPersistent ? 'true' : 'false';
  container.dataset.previewVisible = 'true';
  container.setAttribute('role', 'group');
  container.tabIndex = -1;

  const trigger = container.querySelector('.page-augmentor-preview-tooltip-trigger');
  if (trigger instanceof HTMLElement) {
    trigger.textContent = 'ⓘ';
    trigger.setAttribute('aria-hidden', 'true');
  }

  const bubble = container.querySelector('.page-augmentor-preview-tooltip-bubble');
  if (bubble instanceof HTMLElement) {
    const textValue = payload.text && payload.text.trim() ? payload.text : t('editor.previewTooltip');
    bubble.textContent = textValue;
    bubble.removeAttribute('style');
    if (payload.style) {
      Object.entries(payload.style).forEach(([key, value]) => {
        bubble.style[key] = value;
      });
    }
  }
}

const CLICKABLE_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'image']);

function findClickableElement(target) {
  let current = resolveTarget(target);
  while (current) {
    if (isClickableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isClickableElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  if (element instanceof HTMLButtonElement) {
    return true;
  }
  if (element instanceof HTMLInputElement && CLICKABLE_INPUT_TYPES.has(element.type)) {
    return true;
  }
  if (element instanceof HTMLAnchorElement && element.href) {
    return true;
  }
  const role = element.getAttribute('role');
  if (role && ['button', 'link'].includes(role.toLowerCase())) {
    return true;
  }
  if (typeof element.onclick === 'function') {
    return true;
  }
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex !== null && Number(tabIndex) >= 0) {
    return true;
  }
  try {
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') {
      return true;
    }
  } catch (error) {
    // ignore style lookup failures
  }
  return false;
}

export function resolveFrameContext(win = window) {
  const targetWindow = win || window;
  const { selectors, sameOrigin } = collectFrameSelectors(targetWindow);
  const frameElement = safeFrameElement(targetWindow);
  const frameUrl = tryGetWindowUrl(targetWindow);
  const topUrl = sameOrigin ? tryGetWindowUrl(safeTopWindow(targetWindow)) : '';
  const pageUrl = topUrl || frameUrl;
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

function getSuggestedStyles(target) {
  if (!(target instanceof Element)) {
    return {};
  }
  const computed = window.getComputedStyle(target);
  const maybe = (value) => (value && value !== 'auto' ? value : '');
  const background = computed.backgroundColor;
  return {
    color: maybe(computed.color),
    backgroundColor:
      background && background !== 'rgba(0, 0, 0, 0)' ? background : '',
    fontSize: maybe(computed.fontSize),
    fontWeight: maybe(computed.fontWeight),
    padding: maybe(computed.padding),
    borderRadius: maybe(computed.borderRadius),
  };
}






