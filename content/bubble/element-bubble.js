import { getLocale, ready as i18nReady, subscribe as subscribeToLocale, t } from '../../common/i18n.js';
import { parseActionFlowDefinition, MAX_FLOW_SOURCE_LENGTH } from '../../common/flows.js';
import {
  DEFAULT_BUTTON_STYLE,
  DEFAULT_LINK_STYLE,
  DEFAULT_TOOLTIP_STYLE,
  DEFAULT_AREA_STYLE,
  getTooltipPositionOptions as buildTooltipPositionOptions,
} from './styles/style-presets.js';
import { createField, styleInput } from './ui/field.js';
import { applyCardStyle } from './ui/card.js';
import { createBaseInfoSection } from './editor/base-info-controls.js';
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
    width: '100%',
    maxWidth: '100vw',
    minWidth: '0',
    minHeight: '300px',
    maxHeight: '40vh',
    padding: '12px 16px',
    borderRadius: '18px 18px 0 0',
    backgroundColor: '#ffffff',
    boxShadow: '0 -6px 24px rgba(15, 23, 42, 0.14)',
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
    boxSizing: 'border-box',
  });

  bubble.addEventListener('click', (event) => event.stopPropagation());
  bubble.addEventListener('mousedown', (event) => event.stopPropagation());

  const selectorWrapper = document.createElement('div');
  selectorWrapper.style.display = 'none';
  const selectorTitle = document.createElement('span');
  selectorTitle.textContent = t('editor.selectorLabel');
  const selectorValue = document.createElement('code');
  selectorWrapper.append(selectorTitle, selectorValue);

  const headerBar = document.createElement('div');
  Object.assign(headerBar.style, {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1.4fr) 1.2fr auto',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 10px 10px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: '#f9fafb',
    position: 'sticky',
    top: '0',
    zIndex: '1',
  });

  const headerContext = document.createElement('div');
  Object.assign(headerContext.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '0',
  });

  const headerTitleStack = document.createElement('div');
  Object.assign(headerTitleStack.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '0',
  });

  const headerTitle = document.createElement('div');
  headerTitle.textContent = t('editor.title');
  Object.assign(headerTitle.style, {
    fontSize: '14px',
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: '1.2',
  });

  const headerTypeBadge = document.createElement('span');
  Object.assign(headerTypeBadge.style, {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '999px',
    backgroundColor: '#e0e7ff',
    color: '#312e81',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  });

  const headerSubtitle = document.createElement('div');
  headerSubtitle.textContent = '';
  Object.assign(headerSubtitle.style, {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: '1.3',
    minHeight: '14px',
  });

  const headerTitleRow = document.createElement('div');
  Object.assign(headerTitleRow.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '0',
  });
  headerTitleRow.append(headerTitle, headerTypeBadge);

  headerTitleStack.append(headerTitleRow, headerSubtitle);
  headerContext.append(headerTitleStack);

  const headerActions = document.createElement('div');
  Object.assign(headerActions.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
  });

  // Preview UI removed

  const form = document.createElement('form');
  Object.assign(form.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    flex: '1 1 auto',
    minHeight: '0',
  });

  const formBody = document.createElement('div');
  Object.assign(formBody.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: '1 1 auto',
    minHeight: '0',
    overflowY: 'auto',
    padding: '10px 2px 6px',
  });

  const typeSelect = document.createElement('select');
  getTypeOptions().forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    typeSelect.appendChild(option);
  });
  styleInput(typeSelect);
  typeSelect.disabled = true;
  typeSelect.style.display = 'none';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.placeholder = t('editor.textPlaceholder');
  textInput.maxLength = 160;
  styleInput(textInput);

  const hrefInput = document.createElement('input');
  hrefInput.type = 'text';
  hrefInput.placeholder = t('editor.hrefPlaceholder');
  styleInput(hrefInput);

  const areaLayoutSelect = document.createElement('select');
  [
    { value: 'row', label: t('editor.areaLayout.horizontal') },
    { value: 'column', label: t('editor.areaLayout.vertical') },
  ].forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    areaLayoutSelect.appendChild(option);
  });
  styleInput(areaLayoutSelect);

  const linkTargetSelect = document.createElement('select');
  [
    { value: 'new-tab', label: t('editor.linkTarget.newTab') },
    { value: 'same-tab', label: t('editor.linkTarget.sameTab') },
  ].forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    linkTargetSelect.appendChild(option);
  });
  styleInput(linkTargetSelect);

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
  const linkTargetField = createField(t('editor.linkTargetLabel'), linkTargetSelect);
  const positionField = createField(t('editor.positionLabel'), positionSelect);
  const tooltipPositionField = createField(t('editor.tooltipPositionLabel'), tooltipPositionSelect);
  const tooltipPersistentField = createField(t('editor.tooltipPersistenceLabel'));
  tooltipPersistentField.wrapper.append(tooltipPersistentRow, tooltipPersistentHint);
  const areaLayoutField = createField(t('editor.areaLayoutLabel'), areaLayoutSelect);

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

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = t('editor.cancel');
  Object.assign(cancelButton.style, {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '12px',
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
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.25)',
  });

  headerActions.append(cancelButton, saveButton);

  const errorLabel = document.createElement('p');
  errorLabel.textContent = '';
  Object.assign(errorLabel.style, {
    margin: '0',
    minHeight: '18px',
    fontSize: '12px',
    color: '#dc2626',
  });

  const panel = document.createElement('section');
  Object.assign(panel.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });

  const baseInfoNodes = {
    text: textField.wrapper,
    href: hrefField.wrapper,
    linkTarget: linkTargetField.wrapper,
    actionFlow: actionFlowSummaryField.wrapper,
    tooltipPosition: tooltipPositionField.wrapper,
    tooltipPersistent: tooltipPersistentField.wrapper,
    areaLayout: areaLayoutField.wrapper,
  };

  const baseInfoSection = createBaseInfoSection({
    t,
    nodes: baseInfoNodes,
    getState: () => state,
  });

  panel.append(baseInfoSection.fieldset, styleFieldset);
  formBody.append(panel);

  const updateActiveTabTitle = () => {
    headerTitle.textContent = t('editor.sections.basics.title');
    headerSubtitle.textContent = t('editor.sections.basics.description');
    const typeLabel = getTypeOptions().find(({ value }) => value === state.type)?.label || '';
    headerTypeBadge.textContent = typeLabel;
  };
  updateActiveTabTitle();

  headerBar.append(headerContext, headerActions);
  form.append(headerBar, formBody);

  bubble.append(form, errorLabel);

  /** @type {Element | null} */
  let currentTarget = null;
  /** @type {() => void} */
  let cancelHandler = () => {};
  /** @type {(payload: { type: 'button' | 'link' | 'tooltip' | 'area'; text: string; href?: string; linkTarget?: 'same-tab' | 'new-tab'; actionSelector?: string; tooltipPosition?: 'top' | 'right' | 'bottom' | 'left'; tooltipPersistent?: boolean; position: 'append' | 'prepend' | 'before' | 'after'; layout?: 'row' | 'column'; style?: import('../../common/types.js').InjectedElementStyle }) => void} */
  let submitHandler = () => {};
  /** @type {null | ((payload: { type: 'button' | 'link' | 'tooltip' | 'area'; text: string; href?: string; linkTarget?: 'same-tab' | 'new-tab'; actionSelector?: string; tooltipPosition?: 'top' | 'right' | 'bottom' | 'left'; tooltipPersistent?: boolean; position: 'append' | 'prepend' | 'before' | 'after'; layout?: 'row' | 'column'; style?: import('../../common/types.js').InjectedElementStyle }) => void)} */
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
    areaLayoutSelect,
    linkTargetSelect,
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
    const layout = state.layout === 'column' ? 'column' : 'row';
    const linkTarget = state.linkTarget === 'same-tab' ? 'same-tab' : 'new-tab';
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
      payload.linkTarget = linkTarget;
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
      payload.layout = layout;
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

    linkTargetField.wrapper.style.display = isLink ? 'flex' : 'none';
    linkTargetSelect.disabled = !isLink;

    actionFlowSummaryField.wrapper.style.display = isButton ? 'flex' : 'none';
    actionFlowField.wrapper.style.display = isButton ? 'flex' : 'none';
    actionFlowInput.disabled = !isButton;
    if (!isButton) {
      stopActionPicker('cancel');
    }
    tooltipPositionField.wrapper.style.display = isTooltip ? 'flex' : 'none';
    tooltipPositionSelect.disabled = !isTooltip;
    tooltipPersistentField.wrapper.style.display = isTooltip ? 'flex' : 'none';
    tooltipPersistentCheckbox.disabled = !isTooltip;

    textField.wrapper.style.display = isArea ? 'none' : 'flex';
    textInput.placeholder = isTooltip ? t('editor.tooltipTextPlaceholder') : t('editor.textPlaceholder');

    areaLayoutField.wrapper.style.display = isArea ? 'flex' : 'none';
    areaLayoutSelect.disabled = !isArea;

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
        state.layout = 'row';
        areaLayoutSelect.value = 'row';
      } else if (isLink) {
        state.linkTarget = 'new-tab';
        linkTargetSelect.value = 'new-tab';
      }
    }
    actionFlowController.syncUI();
    baseInfoSection.updateVisibility?.();
    updatePreview();
    updateActiveTabTitle();
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
      nextPatch.bubbleSide = 'bottom';
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
      bubble.dataset.pageAugmentorPlacement = 'bottom';
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

  areaLayoutSelect.addEventListener('change', (event) => {
    const value = event.target.value === 'column' ? 'column' : 'row';
    state.layout = value;
    updatePreview();
  });

  linkTargetSelect.addEventListener('change', (event) => {
    const value = event.target.value === 'same-tab' ? 'same-tab' : 'new-tab';
    state.linkTarget = value;
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
    bubble.dataset.pageAugmentorPlacement = 'bottom';
    attachBubble(bubble);
    const edgeGap = 0;
    const updateFixedPlacement = () => {
      const viewportHeight = window.innerHeight || 0;
      const targetHeight = Math.max(260, Math.floor(viewportHeight * 0.7));
      const availableHeight = Math.max(viewportHeight - 12, 0);
      const cappedHeight = availableHeight ? Math.min(targetHeight, availableHeight) : targetHeight;
      const maxHeight = availableHeight
        ? Math.min(Math.max(200, cappedHeight), availableHeight)
        : Math.max(200, cappedHeight);
      bubble.dataset.pageAugmentorPlacement = 'bottom';
      bubble.style.left = `${edgeGap}px`;
      bubble.style.right = `${edgeGap}px`;
      bubble.style.bottom = `${edgeGap}px`;
      bubble.style.top = 'auto';
      bubble.style.maxHeight = `${maxHeight}px`;
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
        state.bubbleSide = 'bottom';
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
      state.layout = initial.layout || 'row';
      state.linkTarget = initial.linkTarget || 'new-tab';
      state.containerId = typeof initial.containerId === 'string' ? initial.containerId : '';
      state.floating = initial.floating !== false;
      state.bubbleSide = 'bottom';
      typeSelect.value = state.type;
      textInput.value = state.text;
      hrefInput.value = state.href;
      areaLayoutSelect.value = state.layout === 'column' ? 'column' : 'row';
      linkTargetSelect.value = state.linkTarget === 'same-tab' ? 'same-tab' : 'new-tab';
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
      updateActiveTabTitle();
      saveButton.textContent = mode === 'edit' ? t('editor.saveUpdate') : t('editor.saveCreate');
      actionFlowController.validateInput();
      updatePreview({ propagate: false });
      baseInfoSection.updateVisibility?.();
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

