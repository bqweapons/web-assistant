import { getLocale, ready as i18nReady, subscribe as subscribeToLocale, t } from '../../common/i18n.js';
import { parseActionFlowDefinition, MAX_FLOW_SOURCE_LENGTH } from '../../common/flows.js';
import {
  DEFAULT_BUTTON_STYLE,
  DEFAULT_LINK_STYLE,
  DEFAULT_TOOLTIP_STYLE,
  DEFAULT_AREA_STYLE,
  getTooltipPositionOptions as buildTooltipPositionOptions,
} from './styles/style-presets.js';
import { createField, styleInput, createSection } from './ui/field.js';
import { createTabGroup } from './ui/tab-group.js';
import { stepsToJSON } from './actionflow/serializer.js';
import { createEditorState } from './state.js';
import { parseFlowForBuilder } from './actionflow/parser-bridge.js';
import { startPicker } from './actionflow/picker.js';
import { attach as attachBubble, detach as detachBubble } from './layout/placement.js';
import { createStyleControls } from './editor/style-controls.js';
import { createActionFlowController } from './editor/action-flow-controller.js';
import {
  getDefaultElementValues,
  resolvePosition,
  resolveTooltipPosition,
} from './editor/defaults.js';
export { getSuggestedStyles } from './editor/defaults.js';

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

function getTypeOptions() {
  return [
    { value: 'button', label: t('type.button') },
    { value: 'link', label: t('type.link') },
    { value: 'tooltip', label: t('type.tooltip') },
    { value: 'area', label: t('type.area') },
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
  return buildTooltipPositionOptions(t);
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

  // Preview UI removed

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
  const positionField = createField(t('editor.positionLabel'), positionSelect);
  const tooltipPositionField = createField(t('editor.tooltipPositionLabel'), tooltipPositionSelect);
  const tooltipPersistentField = createField(t('editor.tooltipPersistenceLabel'));
  tooltipPersistentField.wrapper.append(tooltipPersistentRow, tooltipPersistentHint);

  const editorState = createEditorState();
  let state = editorState.get();
  let uiUpdateListener = null;
  const setState = (patch) => {
    editorState.patch({ ...state, ...patch });
    state = editorState.get();
  };

  const actionFlowController = createActionFlowController({
    t,
    MAX_FLOW_SOURCE_LENGTH,
    parseActionFlowDefinition,
    parseFlowForBuilder,
    startPicker: (config) => startActionPicker(config),
    stopPicker: (reason) => stopActionPicker(reason),
    getState: () => state,
    setState,
    showError: (message) => {
      errorLabel.textContent = message;
    },
  });

  const actionFlowField = actionFlowController.field;
  const actionFlowSummaryField = actionFlowController.summaryField;
  const actionFlowInput = actionFlowController.input;
  const actionFlowHint = actionFlowController.hint;
  const openActionFlowButton = actionFlowController.openButton;
  const actionFlowEditorHost = actionFlowController.editorHost;
  const styleControls = createStyleControls({ t });
  const styleFieldset = styleControls.fieldset;

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(148, 163, 184, 0.2)',
  });

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = t('editor.cancel');
  Object.assign(cancelButton.style, {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  });

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.textContent = t('editor.saveCreate');
  Object.assign(saveButton.style, {
    padding: '8px 16px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.25)',
  });

  actions.append(cancelButton, saveButton);

  const errorLabel = document.createElement('p');
  errorLabel.textContent = '';
  Object.assign(errorLabel.style, {
    margin: '0',
    minHeight: '18px',
    fontSize: '12px',
    color: '#dc2626',
  });

  const sectionsTabs = createTabGroup();

  const basicSection = sectionsTabs.addSection(
    t('editor.sections.basics.title'),
    t('editor.sections.basics.description'),
  );
  basicSection.content.append(
    typeField.wrapper,
    textField.wrapper,
    hrefField.wrapper,
    tooltipPositionField.wrapper,
    tooltipPersistentField.wrapper,
  );

  const behaviorSection = sectionsTabs.addSection(
    t('editor.sections.behavior.title'),
    t('editor.sections.behavior.description'),
  );
  behaviorSection.content.append(actionFlowSummaryField.wrapper);

  // const placementSection = sectionsTabs.addSection(
  //   t('editor.sections.placement.title'),
  //   t('editor.sections.placement.description'),
  // );
  // placementSection.content.append(positionField.wrapper);

  const appearanceSection = sectionsTabs.addSection(
    t('editor.sections.appearance.title'),
    t('editor.sections.appearance.description'),
  );
  appearanceSection.content.append(styleFieldset);

  formBody.append(sectionsTabs.container);

  form.append(formBody, actions);

  bubble.append(title, selectorWrapper, form, errorLabel);

  /** @type {Element | null} */
  let currentTarget = null;
  /** @type {() => void} */
  let cancelHandler = () => {};
  /** @type {(payload: { type: 'button' | 'link' | 'tooltip' | 'area'; text: string; href?: string; actionSelector?: string; tooltipPosition?: 'top' | 'right' | 'bottom' | 'left'; tooltipPersistent?: boolean; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../../common/types.js').InjectedElementStyle }) => void} */
  let submitHandler = () => {};
  /** @type {null | ((payload: { type: 'button' | 'link' | 'tooltip' | 'area'; text: string; href?: string; actionSelector?: string; tooltipPosition?: 'top' | 'right' | 'bottom' | 'left'; tooltipPersistent?: boolean; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../../common/types.js').InjectedElementStyle }) => void)} */
  let previewHandler = null;
  /** @type {null | ((reason?: 'cancel' | 'select') => void)} */
  let actionPickerCleanup = null;
  let isAttached = false;
  let placementControls = null;
  let currentElementId = null;
  let draftUpdateListener = null;

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
    styleControls.reset(source, suggestions);
  };

  const buildPayload = () => {
    const textValue = state.text.trim();
    const hrefValue = state.href.trim();
    const position = resolvePosition(state.position);
    const style = styleControls.getNormalizedStyle();
    const type =
      state.type === 'link' || state.type === 'tooltip' || state.type === 'area' ? state.type : 'button';
    const payload = {
      type,
      text: textValue,
      position,
      style,
    };
    const selectorText = typeof state.selector === 'string' ? state.selector.trim() : '';
    if (selectorText) {
      payload.selector = selectorText;
    }
    if (state.containerId && typeof state.containerId === 'string' && state.containerId.trim()) {
      payload.containerId = state.containerId.trim();
    } else {
      delete payload.containerId;
    }
    payload.floating = Boolean(state.floating);
    if (type === 'link') {
      if (hrefValue) {
        payload.href = hrefValue;
      }
    } else if (type === 'button') {
      if (hrefValue) {
        payload.href = hrefValue;
      }
      if (state.actionFlowMode === 'builder') {
        const actionSteps = Array.isArray(state.actionSteps) ? state.actionSteps : [];
        if (actionSteps.length === 0) {
          setState({ actionFlow: '' });
          errorLabel.textContent = '';
          delete payload.actionFlow;
        } else {
          const serialized = stepsToJSON(actionSteps);
          setState({ actionFlow: serialized });
          const { definition, error } = parseActionFlowDefinition(serialized.trim());
          if (error || !definition) {
            errorLabel.textContent = t('editor.errorFlowInvalid', { error: error || '' });
            return null;
          }
          errorLabel.textContent = '';
          payload.actionFlow = serialized;
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
      const tooltipPosition = resolveTooltipPosition(state.tooltipPosition);
      payload.tooltipPosition = tooltipPosition;
      payload.tooltipPersistent = Boolean(state.tooltipPersistent);
    } else if (type === 'area') {
      delete payload.href;
      delete payload.actionFlow;
    }
    return payload;
  };

  const updatePreview = (options = { propagate: true }) => {
    const payload = buildPayload();
    if (!payload) {
      actionFlowController.updateSummary();
      return;
    }
    if (options.propagate && typeof previewHandler === 'function') {
      previewHandler(payload);
    }
    actionFlowController.updateSummary();
  };

  const handleTypeChange = (applyDefaults = false) => {
    actionFlowController.hideMenu();
    const isLink = state.type === 'link';
    const isButton = state.type === 'button';
    const isTooltip = state.type === 'tooltip';
    const isArea = state.type === 'area';

    hrefInput.required = isLink;
    hrefInput.disabled = isTooltip || isArea;
    hrefInput.placeholder = isLink
      ? t('editor.hrefPlaceholder')
      : isTooltip || isArea
        ? t('editor.hrefTooltipPlaceholder')
        : t('editor.hrefOptionalPlaceholder');
    hrefField.label.textContent = isLink
      ? t('editor.hrefLabel')
      : isTooltip
        ? t('editor.hrefTooltipLabel')
        : t('editor.hrefOptionalLabel');
    hrefField.wrapper.style.display = isTooltip || isArea ? 'none' : 'flex';

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

    textInput.placeholder = isTooltip
      ? t('editor.tooltipTextPlaceholder')
      : isArea
        ? t('editor.areaTextPlaceholder')
        : t('editor.textPlaceholder');

    actionFlowController.validateInput();
    actionFlowController.updateSummary();
    if (applyDefaults) {
      const defaults = isLink
        ? DEFAULT_LINK_STYLE
        : isTooltip
          ? DEFAULT_TOOLTIP_STYLE
          : isArea
            ? DEFAULT_AREA_STYLE
            : DEFAULT_BUTTON_STYLE;
      resetStyleState(defaults);
      if (isTooltip) {
        state.tooltipPosition = 'top';
        tooltipPositionSelect.value = 'top';
        state.tooltipPersistent = false;
        tooltipPersistentCheckbox.checked = false;
      } else if (isArea) {
        state.href = '';
        hrefInput.value = '';
        state.actionFlow = '';
        state.actionSteps = [];
        state.actionFlowMode = 'builder';
        tooltipPositionSelect.value = 'top';
        tooltipPersistentCheckbox.checked = false;
      }
    }
    actionFlowController.syncUI();
    updatePreview();
  };

  const handleDraftUpdate = (event) => {
    if (!event || typeof event !== 'object') {
      return;
    }
    const detail = event.detail || {};
    if (!detail || (currentElementId && detail.elementId && detail.elementId !== currentElementId)) {
      return;
    }
    const stylePatch = detail && typeof detail.style === 'object' ? detail.style : null;
    const hasTextUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'text');
    const hasContainerUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'containerId');
    const hasFloatingUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'floating');
    const hasBubbleSideUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'bubbleSide');
    const hasSelectorUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'selector');
    const hasPositionUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'position');
    const nextPatch = {};
    if (stylePatch) {
      nextPatch.style = { ...state.style, ...stylePatch };
    }
    if (hasContainerUpdate) {
      const containerValue = typeof detail.containerId === 'string' ? detail.containerId : '';
      nextPatch.containerId = containerValue;
    }
    if (hasFloatingUpdate) {
      nextPatch.floating = Boolean(detail.floating);
    }
    if (hasBubbleSideUpdate) {
      nextPatch.bubbleSide = detail.bubbleSide === 'left' ? 'left' : 'right';
    }
    if (hasSelectorUpdate) {
      const selectorValue =
        typeof detail.selector === 'string' ? detail.selector.trim() : state.selector;
      nextPatch.selector = selectorValue;
    }
    if (hasPositionUpdate) {
      const positionValue = typeof detail.position === 'string' ? detail.position : state.position;
      nextPatch.position = positionValue;
    }
    if (hasTextUpdate) {
      const textValue = typeof detail.text === 'string' ? detail.text : '';
      nextPatch.text = textValue;
    }
    if (Object.keys(nextPatch).length === 0) {
      return;
    }
    setState(nextPatch);
    if (stylePatch) {
      styleControls.merge(stylePatch);
    }
    if (hasBubbleSideUpdate) {
      bubble.dataset.pageAugmentorPlacement = state.bubbleSide === 'left' ? 'left' : 'right';
    }
    if (hasTextUpdate) {
      textInput.value = state.text;
    }
    if (hasSelectorUpdate) {
      selectorValue.textContent = state.selector;
    }
    if (hasPositionUpdate) {
      positionSelect.value = state.position;
    }
    if (hasContainerUpdate || hasFloatingUpdate || hasBubbleSideUpdate || hasSelectorUpdate || hasPositionUpdate) {
      placementControls?.update();
    }
    updatePreview();
  };

  typeSelect.addEventListener('change', (event) => {
    const selected = event.target.value;
    state.type = selected === 'link' ? 'link' : selected === 'tooltip' ? 'tooltip' : selected === 'area' ? 'area' : 'button';
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
    actionFlowController.validateInput();
    actionFlowController.updateSummary();
  });

  actionFlowInput.addEventListener('change', (event) => {
    if (state.actionFlowMode === 'builder') {
      event.target.value = state.actionFlow;
      return;
    }
    state.actionFlow = event.target.value;
    actionFlowController.validateInput();
    actionFlowController.updateSummary();
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
    const { accept = 'clickable', onSelect, onCancel } = options;
    const stop = startPicker({
      accept,
      onSelect: (selector) => {
        if (typeof onSelect === 'function') {
          onSelect(selector);
        }
        actionPickerCleanup = null;
      },
      onCancel: () => {
        if (typeof onCancel === 'function') {
          onCancel();
        }
        actionPickerCleanup = null;
      },
    });
    actionPickerCleanup = (reason) => {
      stop(reason);
      actionPickerCleanup = null;
    };
  }

  function stopActionPicker(reason = 'cancel') {
    if (actionPickerCleanup) {
      const cleanup = actionPickerCleanup;
      actionPickerCleanup = null;
      cleanup(reason);
    }
  }

  styleControls.attachInteractions({
    clearError,
    updatePreview,
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    if (payload.type !== 'area' && !payload.text) {
      errorLabel.textContent = t('editor.errorTextRequired');
      textInput.focus({ preventScroll: true });
      return;
    }
    if (payload.type === 'link' && !state.href.trim()) {
      errorLabel.textContent = t('editor.errorUrlRequired');
      hrefInput.focus({ preventScroll: true });
      return;
    }
    if (payload.type === 'button' && payload.href && !payload.actionFlow) {
      errorLabel.textContent = t('editor.errorActionRequiredForUrl');
      openActionFlowButton.focus({ preventScroll: true });
      return;
    }
    if (payload.type === 'button') {
      if (state.actionFlowMode === 'builder') {
        const serialized = stepsToJSON(Array.isArray(state.actionSteps) ? state.actionSteps : []);
        setState({ actionFlow: serialized });
        const { definition, error } = parseActionFlowDefinition(serialized.trim());
        if (error || !definition) {
          errorLabel.textContent = t('editor.errorFlowInvalid', { error: error || '' });
          return;
        }
        if (definition.stepCount > 0) {
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

  function attach() {
    if (isAttached) {
      return;
    }
    isAttached = true;
    bubble.dataset.pageAugmentorPlacement = 'right';
    attachBubble(bubble);
    const margin = 32;
    const desiredTop = 96;
    const updateFixedPlacement = () => {
      const bubbleHeight = bubble.offsetHeight || 0;
      const maxTop = Math.max(margin, window.innerHeight - bubbleHeight - margin);
      const top = Math.min(maxTop, Math.max(margin, desiredTop));
      const side = state.bubbleSide === 'left' ? 'left' : 'right';
      bubble.dataset.pageAugmentorPlacement = side;
      if (side === 'left') {
        bubble.style.left = `${margin}px`;
        bubble.style.right = 'auto';
      } else {
        bubble.style.left = 'auto';
        bubble.style.right = `${margin}px`;
      }
      bubble.style.bottom = 'auto';
      bubble.style.top = `${Math.round(top)}px`;
    };
    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelHandler();
      }
    };
    placementControls = {
      update: updateFixedPlacement,
      dispose() {
        window.removeEventListener('resize', updateFixedPlacement);
        window.removeEventListener('keydown', handleKeydown, true);
      },
    };
    window.addEventListener('resize', updateFixedPlacement);
    window.addEventListener('keydown', handleKeydown, true);
    updateFixedPlacement();
    requestAnimationFrame(() => {
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0)';
      updateFixedPlacement();
      textInput.focus({ preventScroll: true });
    });
    draftUpdateListener = (event) => handleDraftUpdate(event);
    window.addEventListener('page-augmentor-draft-update', draftUpdateListener);
    uiUpdateListener = (event) => {
      const detail = (event && event.detail) || {};
      if (!detail || (currentElementId && detail.elementId && detail.elementId !== currentElementId)) return;
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'bubbleSide')) {
        state.bubbleSide = detail.bubbleSide === 'left' ? 'left' : 'right';
        placementControls?.update();
      }
    };
    window.addEventListener('page-augmentor-ui-update', uiUpdateListener);
  }

  function detach() {
    if (!isAttached) {
      return;
    }
    stopActionPicker('cancel');
    actionFlowController.hideMenu();
    isAttached = false;
    placementControls?.dispose();
    placementControls = null;
    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(6px)';
    setTimeout(() => {
      if (!isAttached && bubble.isConnected) {
        detachBubble(bubble);
      }
    }, 160);
    if (draftUpdateListener) {
      window.removeEventListener('page-augmentor-draft-update', draftUpdateListener);
      draftUpdateListener = null;
    }
    if (uiUpdateListener) {
      window.removeEventListener('page-augmentor-ui-update', uiUpdateListener);
      uiUpdateListener = null;
    }
  }

  actionFlowController.setMainBubbleControls({ attach, detach });

  return {
    open(config) {
      const { selector, target, values, suggestedStyle, onSubmit, onCancel, onPreview, mode } = config;
      currentTarget = target;
      selectorValue.textContent = selector;
      state.selector = typeof selector === 'string' ? selector.trim() : '';
      previewHandler = typeof onPreview === 'function' ? onPreview : null;
      currentElementId = typeof values?.id === 'string' ? values.id : null;
      const initial = getDefaultElementValues(values, suggestedStyle, t);
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
      state.containerId = typeof initial.containerId === 'string' ? initial.containerId : '';
      state.floating = initial.floating !== false;
      state.bubbleSide = 'right';
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
        state.actionFlow = state.actionSteps.length ? stepsToJSON(state.actionSteps) : '';
        actionFlowInput.value = state.actionFlow;
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
      actionFlowController.refreshBuilder();
      handleTypeChange();
      actionFlowController.syncUI();
      errorLabel.textContent = '';
      title.textContent = mode === 'edit' ? t('editor.titleEdit') : t('editor.titleCreate');
      saveButton.textContent = mode === 'edit' ? t('editor.saveUpdate') : t('editor.saveCreate');
      actionFlowController.validateInput();
      updatePreview({ propagate: false });
      submitHandler = (payload) => {
        actionFlowController.closeFlowEditor({ reopen: false });
        detach();
        currentTarget = null;
        onSubmit(payload);
      };
      cancelHandler = () => {
        actionFlowController.closeFlowEditor({ reopen: false });
        detach();
        currentTarget = null;
        onCancel();
      };
      attach();
    },
    close() {
      detach();
      currentTarget = null;
      currentElementId = null;
    },
    destroy() {
      detach();
      if (bubble.isConnected) {
        bubble.remove();
      }
    },
  };
}

