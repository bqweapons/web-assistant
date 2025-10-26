import { getLocale, ready as i18nReady, subscribe as subscribeToLocale, t } from '../../common/i18n.js';
import { parseActionFlowDefinition, MAX_FLOW_SOURCE_LENGTH } from '../../common/flows.js';
import { createOverlay } from './overlay.js';
import { generateSelector, resolveTarget } from './utils.js';

/**
 * @typedef {Object} ActionClickStep
 * @property {'click'} type
 * @property {string} selector
 *
 * @typedef {Object} ActionInputStep
 * @property {'input'} type
 * @property {string} selector
 * @property {string} value
 *
 * @typedef {Object} ActionWaitStep
 * @property {'wait'} type
 * @property {number} ms
 *
 * @typedef {ActionClickStep | ActionInputStep | ActionWaitStep} ActionBuilderStep
 */

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

/**
 *
 * Opens the editor bubble for an existing element.
 * @param {{}} options
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

export function getElementBubble() {
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
// Builds the editor bubble DOM structure.
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
  const actionFlowField = createField(t('editor.actionFlowLabel'), actionFlowInput);
  const actionFlowSummaryField = createField(t('editor.actionFlowLabel'));
  const actionFlowSummaryRow = document.createElement('div');
  Object.assign(actionFlowSummaryRow.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  });
  const actionFlowSummaryText = document.createElement('span');
  Object.assign(actionFlowSummaryText.style, {
    fontSize: '13px',
    color: '#0f172a',
    flex: '1 1 auto',
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap',
  });
  const openActionFlowButton = document.createElement('button');
  openActionFlowButton.type = 'button';
  openActionFlowButton.textContent = t('editor.actionFlowConfigure');
  Object.assign(openActionFlowButton.style, {
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(99, 102, 241, 0.35)',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    whiteSpace: 'nowrap',
  });
  actionFlowSummaryRow.append(actionFlowSummaryText, openActionFlowButton);
  const actionFlowSummaryHint = document.createElement('p');
  Object.assign(actionFlowSummaryHint.style, {
    margin: '6px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  actionFlowSummaryHint.dataset.defaultColor = '#94a3b8';
  actionFlowSummaryText.textContent = t('editor.actionFlowSummaryEmpty');
  actionFlowSummaryHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
  actionFlowSummaryField.wrapper.append(actionFlowSummaryRow, actionFlowSummaryHint);
  const actionFlowEditorHost = document.createElement('div');
  actionFlowEditorHost.style.display = 'none';
  actionFlowEditorHost.appendChild(actionFlowField.wrapper);
  const ACTION_TYPE_OPTIONS = [
    { value: 'click', label: t('editor.actionBuilder.type.click') },
    { value: 'input', label: t('editor.actionBuilder.type.input') },
    { value: 'wait', label: t('editor.actionBuilder.type.wait') },
  ];
  const actionFlowBuilder = document.createElement('div');
  Object.assign(actionFlowBuilder.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
    border: '1px dashed rgba(148, 163, 184, 0.6)',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
  });
  const actionStepsContainer = document.createElement('div');
  Object.assign(actionStepsContainer.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });
  const actionBuilderEmpty = document.createElement('div');
  actionBuilderEmpty.textContent = t('editor.actionBuilder.empty');
  Object.assign(actionBuilderEmpty.style, {
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
    padding: '16px',
    borderRadius: '8px',
    border: '1px dashed rgba(148, 163, 184, 0.6)',
    backgroundColor: '#fff',
  });
  const addActionContainer = document.createElement('div');
  Object.assign(addActionContainer.style, {
    alignSelf: 'flex-start',
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '6px',
  });
  const addActionButton = document.createElement('button');
  addActionButton.type = 'button';
  addActionButton.textContent = t('editor.actionBuilder.add');
  addActionButton.setAttribute('aria-haspopup', 'true');
  addActionButton.setAttribute('aria-expanded', 'false');
  Object.assign(addActionButton.style, {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(99, 102, 241, 0.5)',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
  });
  const addActionMenu = document.createElement('div');
  addActionMenu.setAttribute('role', 'menu');
  Object.assign(addActionMenu.style, {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '0',
    display: 'none',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    borderRadius: '10px',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    backgroundColor: '#ffffff',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)',
    zIndex: '5',
    minWidth: '200px',
  });
  ACTION_TYPE_OPTIONS.forEach(({ value, label }) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.textContent = label;
    optionButton.dataset.actionType = value;
    optionButton.setAttribute('role', 'menuitem');
    Object.assign(optionButton.style, {
      border: 'none',
      background: 'transparent',
      color: '#312e81',
      fontSize: '13px',
      fontWeight: '600',
      textAlign: 'left',
      padding: '8px 10px',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.12s ease',
    });
    const resetOptionBackground = () => {
      optionButton.style.backgroundColor = 'transparent';
    };
    const highlightOptionBackground = () => {
      optionButton.style.backgroundColor = '#eef2ff';
    };
    optionButton.addEventListener('mouseenter', highlightOptionBackground);
    optionButton.addEventListener('mouseleave', resetOptionBackground);
    optionButton.addEventListener('focus', highlightOptionBackground);
    optionButton.addEventListener('blur', resetOptionBackground);
    optionButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      addActionStep(value);
      hideActionMenu();
    });
    addActionMenu.appendChild(optionButton);
  });
  addActionButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (addActionButton.disabled) {
      return;
    }
    toggleActionMenu();
  });
  addActionContainer.append(addActionButton, addActionMenu);
  const actionBuilderAdvancedNote = document.createElement('div');
  actionBuilderAdvancedNote.textContent = t('editor.actionBuilder.advancedNotice');
  Object.assign(actionBuilderAdvancedNote.style, {
    fontSize: '12px',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    padding: '10px 12px',
    display: 'none',
  });
  actionFlowBuilder.append(actionStepsContainer, actionBuilderEmpty, addActionContainer, actionBuilderAdvancedNote);
  actionFlowField.wrapper.appendChild(actionFlowBuilder);

  let actionBuilderInvalidIndex = -1;
  let actionMenuVisible = false;
  function hideActionMenu() {
    if (!actionMenuVisible) {
      return;
    }
    actionMenuVisible = false;
    addActionMenu.style.display = 'none';
    addActionButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', handleMenuOutsideClick, true);
    document.removeEventListener('keydown', handleMenuKeydown, true);
  }
  function showActionMenu() {
    if (actionMenuVisible) {
      return;
    }
    actionMenuVisible = true;
    addActionMenu.style.display = 'flex';
    addActionButton.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', handleMenuOutsideClick, true);
    document.addEventListener('keydown', handleMenuKeydown, true);
    requestAnimationFrame(() => {
      const firstOption = addActionMenu.querySelector('button');
      if (firstOption instanceof HTMLButtonElement) {
        firstOption.focus({ preventScroll: true });
      }
    });
  }
  function toggleActionMenu() {
    if (actionMenuVisible) {
      hideActionMenu();
    } else {
      showActionMenu();
    }
  }
  const handleMenuOutsideClick = (event) => {
    if (!addActionContainer.contains(event.target)) {
      hideActionMenu();
    }
  };
  const handleMenuKeydown = (event) => {
    if (event.key === 'Escape') {
      hideActionMenu();
      addActionButton.focus({ preventScroll: true });
    }
  };

  const createStepTemplate = (type, previous = {}) => {
    if (type === 'input') {
      return { type: 'input', selector: previous.selector || '', value: previous.value || '' };
    }
    if (type === 'wait') {
      const ms =
        typeof previous.ms === 'number' && Number.isFinite(previous.ms) && previous.ms >= 0
          ? Math.round(previous.ms)
          : 1000;
      return { type: 'wait', ms };
    }
    return { type: 'click', selector: previous.selector || '' };
  };

  const parseFlowForBuilder = (source) => {
    const trimmed = typeof source === 'string' ? source.trim() : '';
    if (!trimmed) {
      return { mode: 'builder', steps: [], error: '' };
    }
    const { definition, error } = parseActionFlowDefinition(trimmed);
    if (error) {
      return { mode: 'advanced', steps: [], error };
    }
    if (!definition) {
      return { mode: 'builder', steps: [], error: '' };
    }
    const steps = [];
    for (const step of definition.steps) {
      switch (step.type) {
        case 'click':
          steps.push({ type: 'click', selector: step.selector || '' });
          break;
        case 'input':
          steps.push({ type: 'input', selector: step.selector || '', value: step.value || '' });
          break;
        case 'wait':
          steps.push({ type: 'wait', ms: typeof step.ms === 'number' ? Math.max(0, Math.round(step.ms)) : 1000 });
          break;
        default:
          return { mode: 'advanced', steps: [], error: '' };
      }
    }
    return { mode: 'builder', steps, error: '' };
  };

  const serializeActionSteps = (steps) => {
    const payload = steps.map((step) => {
      if (step.type === 'input') {
        return { type: 'input', selector: step.selector.trim(), value: step.value };
      }
      if (step.type === 'wait') {
        return { type: 'wait', ms: Math.max(0, Math.round(step.ms)) };
      }
      return { type: 'click', selector: step.selector.trim(), all: false };
    });
    return JSON.stringify({ steps: payload }, null, 2);
  };

  const updateActionFlowFromSteps = ({ updateHint = true } = {}) => {
    if (state.actionFlowMode !== 'builder' || state.type !== 'button') {
      return state.actionFlow;
    }
    actionBuilderInvalidIndex = -1;
    if (state.actionSteps.length === 0) {
      state.actionFlow = '';
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
      actionFlowInput.value = '';
      if (updateHint) {
        updateActionFlowSummary();
      }
      return '';
    }
    for (let index = 0; index < state.actionSteps.length; index += 1) {
      const step = state.actionSteps[index];
      if (step.type === 'wait') {
        const ms = Number(step.ms);
        if (!Number.isFinite(ms) || ms < 0) {
          state.actionFlowError = t('editor.actionBuilder.error.delay', { index: index + 1 });
          state.actionFlowSteps = 0;
          state.actionFlow = '';
          actionBuilderInvalidIndex = index;
          if (updateHint) {
            updateActionFlowSummary();
          }
          return null;
        }
      } else {
        const selector = (step.selector || '').trim();
        if (!selector) {
          state.actionFlowError = t('editor.actionBuilder.error.selector', { index: index + 1 });
          state.actionFlowSteps = 0;
          state.actionFlow = '';
          actionBuilderInvalidIndex = index;
          if (updateHint) {
            updateActionFlowSummary();
          }
          return null;
        }
        if (step.type === 'input') {
          if (!((step.value || '').trim())) {
            state.actionFlowError = t('editor.actionBuilder.error.value', { index: index + 1 });
            state.actionFlowSteps = 0;
            state.actionFlow = '';
            actionBuilderInvalidIndex = index;
            if (updateHint) {
              updateActionFlowSummary();
            }
            return null;
          }
        }
      }
    }
    const serialized = serializeActionSteps(state.actionSteps);
    state.actionFlow = serialized;
    state.actionFlowError = '';
    state.actionFlowSteps = state.actionSteps.length;
    actionFlowInput.value = serialized;
    if (updateHint) {
      updateActionFlowSummary();
    }
    return serialized;
  };

  const refreshActionBuilderState = () => {
    hideActionMenu();
    if (state.actionFlowMode !== 'builder') {
      actionStepsContainer.innerHTML = '';
      actionBuilderEmpty.style.display = 'none';
      return;
    }
    actionStepsContainer.innerHTML = '';
    if (state.actionSteps.length === 0) {
      actionBuilderEmpty.style.display = 'block';
    } else {
      actionBuilderEmpty.style.display = 'none';
      state.actionSteps.forEach((step, index) => {
        actionStepsContainer.appendChild(createActionStepRow(step, index));
      });
    }
  };

  const addActionStep = (type = 'click') => {
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    hideActionMenu();
    state.actionSteps = [...state.actionSteps, createStepTemplate(type)];
    refreshActionBuilderState();
    updateActionFlowFromSteps();
  };

  const removeActionStep = (index) => {
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    state.actionSteps = state.actionSteps.filter((_, idx) => idx !== index);
    refreshActionBuilderState();
    updateActionFlowFromSteps();
  };

  const updateActionStep = (index, patch) => {
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    state.actionSteps = state.actionSteps.map((step, idx) => (idx === index ? { ...step, ...patch } : step));
    updateActionFlowFromSteps();
    refreshActionBuilderState();
  };

  const convertActionStepType = (index, type) => {
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    const current = state.actionSteps[index] || {};
    state.actionSteps = state.actionSteps.map((step, idx) =>
      idx === index ? createStepTemplate(type, step) : step,
    );
    if (current.type !== type) {
      updateActionFlowFromSteps();
    }
    refreshActionBuilderState();
  };

  const createActionStepRow = (step, index) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(148, 163, 184, 0.6)',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    });
    if (index === actionBuilderInvalidIndex) {
      row.style.border = '1px solid #dc2626';
      row.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.1)';
    }

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    });
    const badge = document.createElement('span');
    badge.textContent = `#${index + 1}`;
    Object.assign(badge.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '28px',
      height: '28px',
      borderRadius: '999px',
      background: 'rgba(99, 102, 241, 0.1)',
      color: '#4f46e5',
      fontSize: '12px',
      fontWeight: '600',
    });
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = t('editor.actionBuilder.remove');
    Object.assign(removeButton.style, {
      border: 'none',
      background: 'transparent',
      color: '#dc2626',
      fontSize: '12px',
      cursor: 'pointer',
      fontWeight: '600',
    });
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      removeActionStep(index);
    });
    header.append(badge, removeButton);
    row.appendChild(header);

    const typeLabel = document.createElement('label');
    typeLabel.textContent = t('editor.actionBuilder.typeLabel');
    Object.assign(typeLabel.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#0f172a',
    });
    const typeSelect = document.createElement('select');
    ACTION_TYPE_OPTIONS.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      typeSelect.appendChild(opt);
    });
    typeSelect.value = step.type;
    styleInput(typeSelect);
    typeSelect.addEventListener('change', (event) => {
      convertActionStepType(index, event.target.value);
    });
    typeLabel.appendChild(typeSelect);
    row.appendChild(typeLabel);

    const body = document.createElement('div');
    Object.assign(body.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });

    if (step.type === 'wait') {
      const delayLabel = document.createElement('label');
      delayLabel.textContent = t('editor.actionBuilder.delayLabel');
      Object.assign(delayLabel.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#0f172a',
      });
      const delayInput = document.createElement('input');
      delayInput.type = 'number';
      delayInput.min = '0';
      delayInput.step = '100';
      delayInput.value = typeof step.ms === 'number' ? String(step.ms) : '1000';
      styleInput(delayInput);
      delayInput.addEventListener('input', (event) => {
        const nextValue = Number.parseInt(event.target.value, 10);
        state.actionSteps[index] = { ...state.actionSteps[index], ms: Number.isFinite(nextValue) ? nextValue : 0 };
        updateActionFlowFromSteps();
      });
      delayLabel.appendChild(delayInput);
      body.appendChild(delayLabel);
    } else {
      const selectorLabel = document.createElement('label');
      selectorLabel.textContent = t('editor.actionBuilder.selectorLabel');
      Object.assign(selectorLabel.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#0f172a',
      });
      const selectorRow = document.createElement('div');
      Object.assign(selectorRow.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      });
      const selectorInput = document.createElement('input');
      selectorInput.type = 'text';
      selectorInput.placeholder = t('editor.actionBuilder.selectorPlaceholder');
      selectorInput.value = step.selector || '';
      styleInput(selectorInput);
      selectorInput.addEventListener('input', (event) => {
        state.actionSteps[index] = { ...state.actionSteps[index], selector: event.target.value };
        updateActionFlowFromSteps({ updateHint: false });
      });
      const pickButton = document.createElement('button');
      pickButton.type = 'button';
      pickButton.textContent = t('editor.actionBuilder.pick');
      Object.assign(pickButton.style, {
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(99, 102, 241, 0.6)',
        backgroundColor: '#eef2ff',
        color: '#4f46e5',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
      });
      pickButton.addEventListener('click', (event) => {
        event.preventDefault();
        row.dataset.picking = 'true';
        startActionPicker({
          source: 'builder',
          onSelect: (selector) => {
            row.dataset.picking = 'false';
            state.actionSteps[index] = { ...state.actionSteps[index], selector };
            updateActionFlowFromSteps();
            refreshActionBuilderState();
          },
          onCancel: () => {
            row.dataset.picking = 'false';
            refreshActionBuilderState();
          },
        });
      });
      selectorRow.append(selectorInput, pickButton);
      selectorLabel.appendChild(selectorRow);
      body.appendChild(selectorLabel);

      if (step.type === 'input') {
        const valueLabel = document.createElement('label');
        valueLabel.textContent = t('editor.actionBuilder.valueLabel');
        Object.assign(valueLabel.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#0f172a',
        });
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.placeholder = t('editor.actionBuilder.valuePlaceholder');
        valueInput.value = step.value || '';
        styleInput(valueInput);
        valueInput.addEventListener('input', (event) => {
          state.actionSteps[index] = { ...state.actionSteps[index], value: event.target.value };
          updateActionFlowFromSteps({ updateHint: false });
        });
        valueLabel.appendChild(valueInput);
        body.appendChild(valueLabel);
      }
    }

    row.appendChild(body);
    return row;
  };

  const syncActionFlowUI = () => {
    const isButton = state.type === 'button';
    actionFlowField.wrapper.style.display = isButton ? 'flex' : 'none';
    addActionButton.disabled = !isButton || state.actionFlowMode !== 'builder';
    if (addActionButton.disabled) {
      hideActionMenu();
    }
    if (!isButton) {
      hideActionMenu();
      actionFlowBuilder.style.display = 'none';
      actionBuilderAdvancedNote.style.display = 'none';
      actionFlowInput.style.display = 'none';
      return;
    }
    if (state.actionFlowMode === 'builder') {
      actionFlowBuilder.style.display = 'flex';
      actionBuilderAdvancedNote.style.display = 'none';
      actionFlowInput.style.display = 'none';
      refreshActionBuilderState();
      updateActionFlowFromSteps({ updateHint: false });
    } else {
      hideActionMenu();
      actionFlowBuilder.style.display = 'none';
      actionBuilderAdvancedNote.style.display = 'block';
      actionFlowInput.style.display = 'block';
    }
  };
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
    textInput.dataset.defaultPlaceholder = config.placeholder || '';
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

  const flowBubble = document.createElement('div');
  flowBubble.dataset.pageAugmentorRoot = 'picker-flow-bubble';
  Object.assign(flowBubble.style, {
    position: 'fixed',
    top: '24px',
    right: '24px',
    width: '360px',
    maxHeight: '85vh',
    padding: '20px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    opacity: '0',
    transform: 'translateY(12px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
    zIndex: '2147483647',
    pointerEvents: 'auto',
  });
  flowBubble.addEventListener('click', (event) => event.stopPropagation());
  flowBubble.addEventListener('mousedown', (event) => event.stopPropagation());

  const flowBubbleTitle = document.createElement('h3');
  flowBubbleTitle.textContent = t('editor.actionFlowTitle');
  Object.assign(flowBubbleTitle.style, {
    margin: '0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#0f172a',
  });

  const flowBubbleDescription = document.createElement('p');
  flowBubbleDescription.textContent = t('editor.actionFlowDescription');
  Object.assign(flowBubbleDescription.style, {
    margin: '0',
    fontSize: '12px',
    color: '#64748b',
    lineHeight: '1.5',
  });

  const flowBubbleBody = document.createElement('div');
  Object.assign(flowBubbleBody.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    paddingRight: '4px',
  });
  flowBubbleBody.appendChild(actionFlowField.wrapper);

  const flowBubbleActions = document.createElement('div');
  Object.assign(flowBubbleActions.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(226, 232, 240, 0.9)',
  });

  const flowCancelButton = document.createElement('button');
  flowCancelButton.type = 'button';
  flowCancelButton.textContent = t('editor.cancel');
  Object.assign(flowCancelButton.style, {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    backgroundColor: '#f8fafc',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
  });

  const flowSaveButton = document.createElement('button');
  flowSaveButton.type = 'button';
  flowSaveButton.textContent = t('editor.save');
  Object.assign(flowSaveButton.style, {
    padding: '8px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(79, 70, 229, 0.9)',
    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(79, 70, 229, 0.28)',
  });

  flowBubbleActions.append(flowCancelButton, flowSaveButton);
  flowBubble.append(flowBubbleTitle, flowBubbleDescription, flowBubbleBody, flowBubbleActions);

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
  behaviorSection.content.append(actionFlowSummaryField.wrapper);

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
  let flowBubbleAttached = false;
  let flowSnapshot = null;

  const state = {
    type: 'button',
    text: '',
    href: '',
    actionFlow: '',
    actionFlowError: '',
    actionFlowSteps: 0,
    actionFlowMode: 'builder',
    actionSteps: /** @type {Array<ActionBuilderStep>} */ ([]),
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
    actionFlowInput,
    typeSelect,
    positionSelect,
    tooltipPositionSelect,
    tooltipPersistentCheckbox,
  ].forEach((input) => {
    input.addEventListener('input', clearError);
    input.addEventListener('change', clearError);
  });

  const resetStyleState = (source, suggestions) => {
    styleFieldConfigs.forEach(({ name }) => {
      const value = source && typeof source[name] === 'string' ? source[name] : '';
      styleState[name] = value;
      const record = styleInputs.get(name);
      if (!record) {
        return;
      }
      record.text.value = value || '';
      const basePlaceholder = record.text.dataset.defaultPlaceholder || record.text.placeholder || '';
      if (suggestions && typeof suggestions[name] === 'string') {
        const hint = suggestions[name].trim();
        record.text.placeholder = hint || basePlaceholder;
      } else {
        record.text.placeholder = basePlaceholder;
      }
      if (record.color) {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        const hexPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i;
        if (trimmed && hexPattern.test(trimmed)) {
          record.color.value = trimmed;
          record.color.dataset.defaultValue = trimmed;
        } else {
          let fallback = record.color.dataset.defaultValue;
          if (!fallback || !hexPattern.test(fallback)) {
            fallback = '#ffffff';
          }
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
      if (state.actionFlowMode === 'builder') {
        const serialized = updateActionFlowFromSteps({ updateHint: true });
        if (serialized && !state.actionFlowError) {
          payload.actionFlow = serialized;
        } else if (!state.actionFlowError) {
          delete payload.actionFlow;
        }
      } else {
        const flowValue = state.actionFlow.trim();
        if (flowValue) {
          payload.actionFlow = flowValue;
        } else {
          delete payload.actionFlow;
        }
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

  const validateActionFlowInput = () => {
    if (state.type !== 'button') {
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
      return;
    }
    if (state.actionFlowMode === 'builder') {
      updateActionFlowFromSteps({ updateHint: false });
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
    trigger.textContent = 'i';
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
    updateActionFlowSummary();
  };

  const handleTypeChange = (applyDefaults = false) => {
    hideActionMenu();
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

    actionFlowSummaryField.wrapper.style.display = isButton ? 'flex' : 'none';
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
    updateActionFlowSummary();
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
    syncActionFlowUI();
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

  actionFlowInput.addEventListener('input', (event) => {
    if (state.actionFlowMode === 'builder') {
      event.target.value = state.actionFlow;
      return;
    }
    state.actionFlow = event.target.value;
    validateActionFlowInput();
    updateActionFlowSummary();
  });

  actionFlowInput.addEventListener('change', (event) => {
    if (state.actionFlowMode === 'builder') {
      event.target.value = state.actionFlow;
      return;
    }
    state.actionFlow = event.target.value;
    validateActionFlowInput();
    updateActionFlowSummary();
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

  function startActionPicker(options = {}) {
    if (actionPickerCleanup) {
      return;
    }
    const { onSelect, onCancel } = options;
    const overlay = createOverlay();
    document.body.appendChild(overlay.container);
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

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
      if (typeof onSelect === 'function') {
        onSelect(selector);
      }
      stopActionPicker('select');
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
      if (typeof onCancel === 'function' && reason !== 'select') {
        onCancel();
      }
      actionPickerCleanup = null;
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
      if (state.actionFlowMode === 'builder') {
        const serialized = updateActionFlowFromSteps({ updateHint: true });
        if (state.actionFlowError) {
          errorLabel.textContent = state.actionFlowError;
          return;
        }
        if (serialized) {
          const { error } = parseActionFlowDefinition(serialized);
          if (error) {
            errorLabel.textContent = t('editor.errorFlowInvalid', { error });
            return;
          }
          payload.actionFlow = serialized;
        } else {
          delete payload.actionFlow;
        }
      } else {
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
    }
    submitHandler(payload);
  });

  cancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    cancelHandler();
  });

  const updateActionFlowSummary = () => {
    if (state.type !== 'button') {
      actionFlowSummaryText.textContent = t('editor.actionFlowSummaryUnavailable');
      actionFlowSummaryText.style.color = '#64748b';
      actionFlowSummaryHint.textContent = '';
      openActionFlowButton.disabled = true;
      openActionFlowButton.style.opacity = '0.6';
      openActionFlowButton.style.cursor = 'not-allowed';
      actionFlowHint.textContent = '';
      actionFlowHint.style.color = actionFlowHint.dataset.defaultColor || '#94a3b8';
      return;
    }
    openActionFlowButton.disabled = false;
    openActionFlowButton.style.opacity = '1';
    openActionFlowButton.style.cursor = 'pointer';
    if (state.actionFlowError) {
      actionFlowSummaryText.textContent = t('editor.actionFlowSummaryError', { error: state.actionFlowError });
      actionFlowSummaryText.style.color = '#dc2626';
      actionFlowSummaryHint.textContent = t('editor.actionFlowHintError', { error: state.actionFlowError });
      actionFlowSummaryHint.style.color = '#dc2626';
      actionFlowHint.textContent = t('editor.actionFlowHintError', { error: state.actionFlowError });
      actionFlowHint.style.color = '#dc2626';
      return;
    }
    if (state.actionFlowSteps > 0) {
      actionFlowSummaryText.textContent = t('editor.actionFlowSummaryConfigured', { count: state.actionFlowSteps });
      actionFlowSummaryText.style.color = '#0f172a';
      actionFlowSummaryHint.textContent = t('editor.actionFlowHintConfigured', { count: state.actionFlowSteps });
      actionFlowSummaryHint.style.color = '#0f172a';
      actionFlowHint.textContent = t('editor.actionFlowHintConfigured', { count: state.actionFlowSteps });
      actionFlowHint.style.color = '#0f172a';
    } else {
      actionFlowSummaryText.textContent = t('editor.actionFlowSummaryEmpty');
      actionFlowSummaryText.style.color = '#64748b';
      actionFlowSummaryHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
      actionFlowSummaryHint.style.color = actionFlowSummaryHint.dataset.defaultColor || '#94a3b8';
      actionFlowHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
      actionFlowHint.style.color = actionFlowHint.dataset.defaultColor || '#94a3b8';
    }
    if (state.actionFlowMode !== 'builder') {
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
    }
  };

  const restoreFlowState = (snapshot) => {
    if (!snapshot) {
      return;
    }
    state.actionFlow = snapshot.actionFlow || '';
    state.actionFlowError = snapshot.actionFlowError || '';
    state.actionFlowSteps = snapshot.actionFlowSteps || 0;
    state.actionFlowMode = snapshot.actionFlowMode || 'builder';
    state.actionSteps = Array.isArray(snapshot.actionSteps)
      ? snapshot.actionSteps.map((step) => ({ ...step }))
      : [];
    actionFlowInput.value = state.actionFlow;
    refreshActionBuilderState();
    validateActionFlowInput();
    syncActionFlowUI();
    updateActionFlowSummary();
  };

  const handleFlowKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      flowCancelButton.click();
    }
  };

  const closeFlowEditor = (options = { reopen: true }) => {
    const { reopen = true } = options;
    if (flowBubbleAttached) {
      flowBubbleAttached = false;
      flowBubble.style.opacity = '0';
      flowBubble.style.transform = 'translateY(12px)';
      setTimeout(() => {
        if (!flowBubbleAttached && flowBubble.isConnected) {
          flowBubble.remove();
        }
      }, 200);
    }
    document.removeEventListener('keydown', handleFlowKeydown, true);
    flowSnapshot = null;
    actionFlowEditorHost.appendChild(actionFlowField.wrapper);
    if (reopen) {
      attach();
      updateActionFlowSummary();
      updatePreview({ propagate: false });
    }
  };

  const openFlowEditor = () => {
    if (flowBubbleAttached || state.type !== 'button') {
      return;
    }
    flowSnapshot = {
      actionFlow: state.actionFlow,
      actionFlowError: state.actionFlowError,
      actionFlowSteps: state.actionFlowSteps,
      actionFlowMode: state.actionFlowMode,
      actionSteps: state.actionSteps.map((step) => ({ ...step })),
    };
    detach();
    flowBubbleBody.appendChild(actionFlowField.wrapper);
    flowBubble.style.opacity = '0';
    flowBubble.style.transform = 'translateY(12px)';
    document.body.appendChild(flowBubble);
    flowBubbleAttached = true;
    document.addEventListener('keydown', handleFlowKeydown, true);
    requestAnimationFrame(() => {
      flowBubble.style.opacity = '1';
      flowBubble.style.transform = 'translateY(0)';
    });
    refreshActionBuilderState();
    syncActionFlowUI();
    validateActionFlowInput();
    updateActionFlowSummary();
  };

  openActionFlowButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.type !== 'button') {
      return;
    }
    openFlowEditor();
  });

  flowCancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    restoreFlowState(flowSnapshot);
    flowSnapshot = null;
    closeFlowEditor({ reopen: true });
  });

  flowSaveButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (state.type !== 'button') {
      flowSnapshot = null;
      closeFlowEditor({ reopen: true });
      return;
    }
    if (state.actionFlowMode === 'builder') {
      const serialized = updateActionFlowFromSteps({ updateHint: true });
      if (serialized === null || state.actionFlowError) {
        return;
      }
      const { error } = parseActionFlowDefinition(serialized);
      if (error) {
        state.actionFlowError = error;
        state.actionFlowSteps = 0;
        updateActionFlowSummary();
        refreshActionBuilderState();
        return;
      }
      state.actionFlow = serialized;
    } else {
      const flowValue = state.actionFlow.trim();
      if (flowValue) {
        const { definition, error } = parseActionFlowDefinition(flowValue);
        if (error || !definition) {
          state.actionFlowError = error || t('editor.errorFlowInvalid', { error: '' });
          updateActionFlowSummary();
          return;
        }
        state.actionFlowSteps = definition.stepCount;
        state.actionFlowError = '';
        state.actionFlow = flowValue;
      } else {
        state.actionFlow = '';
        state.actionFlowSteps = 0;
        state.actionFlowError = '';
      }
    }
    flowSnapshot = null;
    updateActionFlowSummary();
    closeFlowEditor({ reopen: true });
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
    hideActionMenu();
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
      state.actionFlow = initial.actionFlow || '';
      state.actionFlowError = '';
      state.actionFlowSteps = 0;
      state.actionFlowMode = 'builder';
      state.actionSteps = [];
      state.position = initial.position;
      state.tooltipPosition = initial.tooltipPosition;
      state.tooltipPersistent = initial.tooltipPersistent;
      typeSelect.value = state.type;
      textInput.value = state.text;
      hrefInput.value = state.href;
      let initialFlowSource = state.actionFlow;
      if (state.type === 'button' && (!initialFlowSource || !initialFlowSource.trim())) {
        const inheritedSelector = typeof values.actionSelector === 'string' ? values.actionSelector.trim() : '';
        if (inheritedSelector) {
          initialFlowSource = JSON.stringify({ steps: [{ type: 'click', selector: inheritedSelector }] }, null, 2);
          state.actionFlow = initialFlowSource;
        }
      }
      const parsedFlow =
        state.type === 'button' ? parseFlowForBuilder(initialFlowSource) : { mode: 'builder', steps: [], error: '' };
      if (state.type === 'button' && parsedFlow.mode === 'builder') {
        state.actionFlowMode = 'builder';
        state.actionSteps = parsedFlow.steps;
        state.actionFlow = state.actionSteps.length ? serializeActionSteps(state.actionSteps) : '';
        actionFlowInput.value = state.actionFlow;
        actionBuilderAdvancedNote.style.display = 'none';
      } else if (state.type === 'button' && parsedFlow.mode === 'advanced') {
        state.actionFlowMode = 'advanced';
        state.actionFlow = initial.actionFlow || '';
        state.actionFlowError = parsedFlow.error || '';
        actionFlowInput.value = state.actionFlow;
      } else {
        actionFlowInput.value = state.actionFlow;
      }
      positionSelect.value = state.position;
      tooltipPositionSelect.value = state.tooltipPosition;
      tooltipPersistentCheckbox.checked = state.tooltipPersistent;
      resetStyleState(initial.style, initial.styleSuggestions);
      stopActionPicker('cancel');
      refreshActionBuilderState();
      handleTypeChange();
      syncActionFlowUI();
      errorLabel.textContent = '';
      title.textContent = mode === 'edit' ? t('editor.titleEdit') : t('editor.titleCreate');
      saveButton.textContent = mode === 'edit' ? t('editor.saveUpdate') : t('editor.saveCreate');
      validateActionFlowInput();
      updatePreview({ propagate: false });
      submitHandler = (payload) => {
        closeFlowEditor({ reopen: false });
        detach();
        currentTarget = null;
        onSubmit(payload);
      };
      cancelHandler = () => {
        closeFlowEditor({ reopen: false });
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

/**
 * 
 * @param {Partial<import('../common/types.js').InjectedElement>} values
 * @param {Record<string, string>} suggestedStyle
 * @returns {{
 * }}
 */
function defaultElementValues(values = {}, suggestedStyle = {}) {
  const type = values.type === 'link' ? 'link' : values.type === 'tooltip' ? 'tooltip' : 'button';
  const text = typeof values.text === 'string' ? values.text : '';
  const href = typeof values.href === 'string' ? values.href : '';
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
  const styleSuggestions = {};
  const configs = getStyleFieldConfigs();
  configs.forEach(({ name }) => {
    const providedRaw = values.style && typeof values.style[name] === 'string' ? values.style[name] : '';
    const provided = typeof providedRaw === 'string' ? providedRaw.trim() : '';
    if (provided) {
      style[name] = provided;
    } else if (defaults && typeof defaults[name] === 'string') {
      style[name] = defaults[name];
    } else {
      style[name] = '';
    }
    if (suggestedStyle && typeof suggestedStyle[name] === 'string') {
      const hint = suggestedStyle[name].trim();
      if (hint) {
        styleSuggestions[name] = hint;
      }
    }
  });
  return {
    type,
    text,
    href,
    actionFlow,
    position,
    tooltipPosition,
    tooltipPersistent,
    style,
    styleSuggestions,
  };
}

let tabIdCounter = 0;

// Creates the tabbed layout for editor sections.
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

// Creates section metadata and helpers.
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

// Adds a heading and description wrapper to a section node.
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

// Creates a form field wrapper with label and control.
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

/**
 * 
 * @param {Record<string, string>} styleState
 * @returns {Record<string, string> | undefined}
 */
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

/**
 * 
 * @param {HTMLElement} element
 * @param {'button' | 'link'} type
 */
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
 * 
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
    trigger.textContent = 'i';
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

/**
 * 
 * @param {EventTarget | null} target
 * @returns {Element | null}
 */
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

/**
 * 
 * @param {Element} element
 * @returns {boolean}
 */
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

/**
 * 
 * @param {Window} [win]
 * @returns {{ frameSelectors: string[]; frameLabel: string; frameUrl: string; pageUrl: string; sameOriginWithTop: boolean }}
 */
/**
 *
 * @param {Element} target
 * @returns {Record<string, string>}
 */
export function getSuggestedStyles(target) {
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
