import { getLocale, ready as i18nReady, subscribe as subscribeToLocale, t } from '../../common/i18n.js';
import { parseActionFlowDefinition, MAX_FLOW_SOURCE_LENGTH } from '../../common/flows.js';
import {
  DEFAULT_BUTTON_STYLE,
  DEFAULT_LINK_STYLE,
  DEFAULT_TOOLTIP_STYLE,
  DEFAULT_AREA_STYLE,
} from './styles/style-presets.js';
import { buildFormSections } from './editor/form-controls.js';
import { getFormSections } from './editor/form-config.js';
import { getTypeOptions } from './editor/field-config.js';
import { stepsToJSON } from './actionflow/serializer.js';
import { createEditorState } from './state.js';
import { parseFlowForBuilder } from './actionflow/parser-bridge.js';
import { startPicker } from './actionflow/picker.js';
import { attach as attachBubble, detach as detachBubble } from './layout/placement.js';
import { createActionFlowController } from './editor/action-flow-controller.js';
import {
  getDefaultElementValues,
  resolvePosition,
  resolveTooltipPosition,
} from './editor/defaults.js';
import { normalizeSiteUrl, normalizePageLocation } from '../../common/url.js';
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

  let refreshUI = () => {};

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

  const actionFlowInput = actionFlowController.input;
  const openActionFlowButton = actionFlowController.openButton;

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

  let suppressAutoRefresh = false;

  const formSections = buildFormSections({
    t,
    sections: getFormSections(t),
    getState: () => state,
    setState,
    actionFlowController,
    clearError: () => {
      errorLabel.textContent = '';
    },
    onFieldChange: (key) => {
      if (key === 'type') {
        suppressAutoRefresh = true;
        handleTypeChange({ applyDefaults: true });
        suppressAutoRefresh = false;
      }
    },
    onChange: () => {
      if (suppressAutoRefresh) return;
      refreshUI();
    },
  });
  const focusTargets = formSections.focusTargets || {};
  const refreshFields = () => formSections.refreshFields();
  const updateVisibility = () => formSections.refreshVisibility();

  formSections.fieldsets.forEach((fieldset) => panel.appendChild(fieldset));
  formBody.append(panel);

  const updateActiveTabTitle = () => {
    headerTitle.textContent = t('editor.sections.basics.title');
    headerSubtitle.textContent = t('editor.sections.basics.description');
    const typeLabel = getTypeOptions(t).find(({ value }) => value === state.type)?.label || '';
    headerTypeBadge.textContent = typeLabel;
  };

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

  const resolveCurrentUrls = () => {
    try {
      const site = normalizeSiteUrl(window.location.href);
      const page = normalizePageLocation(window.location.href);
      return { site, page };
    } catch (_e) {
      return { site: '', page: '' };
    }
  };

  let currentSiteUrl = resolveCurrentUrls().site;
  let currentPageUrl = resolveCurrentUrls().page;

  const clearError = () => {
    errorLabel.textContent = '';
  };

  const resetStyleState = (source, suggestions) => {
    formSections.resetStyle(source, suggestions);
  };

  const focusField = (key) => {
    const target = focusTargets[key];
    if (target instanceof HTMLElement && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  };

  const validateSubmission = (payload) => {
    if (payload.type !== 'area' && !payload.text) {
      errorLabel.textContent = t('editor.errorTextRequired');
      focusField('text');
      return false;
    }
    if (payload.type === 'link' && !state.href.trim()) {
      errorLabel.textContent = t('editor.errorUrlRequired');
      focusField('href');
      return false;
    }
    if (payload.type === 'button' && payload.href && !payload.actionFlow) {
      errorLabel.textContent = t('editor.errorActionRequiredForUrl');
      if (openActionFlowButton && typeof openActionFlowButton.focus === 'function') {
        openActionFlowButton.focus({ preventScroll: true });
      }
      return false;
    }
    return true;
  };

  const buildPayload = () => {
    const textValue = state.text.trim();
    const hrefValue = state.href.trim();
    const position = resolvePosition(state.position);
    const style = formSections.getNormalizedStyle();
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
    if (type === 'button' && typeof state.actionFlowLocked === 'boolean') {
      payload.actionFlowLocked = state.actionFlowLocked;
    }
    const selectorText = typeof state.selector === 'string' ? state.selector.trim() : '';
    if (selectorText) {
      payload.selector = selectorText;
    }
    const rawContainerId = typeof state.containerId === 'string' ? state.containerId.trim() : '';
    if (rawContainerId) {
      payload.containerId = rawContainerId;
      payload.floating = false;
    } else {
      // Explicitly clear container to avoid merging old area ids on save.
      payload.containerId = '';
      payload.floating = Boolean(state.floating);
    }
    if (type === 'link') {
      if (hrefValue) {
        payload.href = hrefValue;
      }
      payload.linkTarget = linkTarget;
    } else if (type === 'button') {
      if (hrefValue) {
        payload.href = hrefValue;
      }
      const flowValue = (state.actionFlow || '').trim();
      if (flowValue) {
        const { definition, error } = parseActionFlowDefinition(flowValue);
        if (error || !definition) {
          errorLabel.textContent = t('editor.errorFlowInvalid', { error: error || '' });
          return null;
        }
        errorLabel.textContent = '';
        payload.actionFlow = flowValue;
      } else {
        delete payload.actionFlow;
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
    payload.siteUrl = currentSiteUrl || '';
    payload.pageUrl =
      state.scope === 'site'
        ? currentSiteUrl || currentPageUrl || ''
        : currentPageUrl || currentSiteUrl || '';
    return payload;
  };

  const updatePreview = (options = { propagate: true }) => {
    const payload = buildPayload();
    if (!payload) {
      actionFlowController.validateInput();
      return;
    }
    if (options.propagate && typeof previewHandler === 'function') {
      previewHandler(payload);
    }
  };

  refreshUI = (options = {}) => {
    refreshFields();
    updateVisibility();
    actionFlowController.syncUI();
    actionFlowController.validateInput();
    actionFlowController.updateSummary();
    updateActiveTabTitle();
    if (!options.skipPreview) {
      updatePreview();
    }
  };

  const handleTypeChange = ({ applyDefaults = false, skipPreview = false } = {}) => {
    actionFlowController.hideMenu();
    const styleDefaults =
      state.type === 'link'
        ? DEFAULT_LINK_STYLE
        : state.type === 'tooltip'
          ? DEFAULT_TOOLTIP_STYLE
          : state.type === 'area'
            ? DEFAULT_AREA_STYLE
            : DEFAULT_BUTTON_STYLE;

    if (state.type !== 'button') {
      stopActionPicker('cancel');
    }
    clearError();

    formSections.applyTypeChange({
      applyDefaults,
      styleDefaults: applyDefaults ? styleDefaults : null,
    });
    refreshUI({ skipPreview });
    return true;
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
    const styleSource = detail?.draftSource;
    const hasTextUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'text');
    const hasTypeUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'type');
    const hasContainerUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'containerId');
    const hasFloatingUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'floating');
    const hasBubbleSideUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'bubbleSide');
    const hasSelectorUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'selector');
    const hasPositionUpdate = Object.prototype.hasOwnProperty.call(detail || {}, 'position');
    const nextPatch = {};
    const allowStyleMerge = stylePatch && Object.keys(stylePatch).length > 0 && (styleSource === 'drag' || styleSource === 'resize');
    if (allowStyleMerge) {
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
    if (hasTypeUpdate) {
      const nextType =
        detail.type === 'link' || detail.type === 'tooltip' || detail.type === 'area' ? detail.type : 'button';
      nextPatch.type = nextType;
    }
    if (Object.keys(nextPatch).length === 0) {
      return;
    }
    setState(nextPatch);
    if (allowStyleMerge) {
      formSections.mergeStyle(stylePatch);
    }
    const refreshedByTypeChange = hasTypeUpdate ? handleTypeChange({ applyDefaults: true }) || true : false;
    if (hasBubbleSideUpdate) {
      bubble.dataset.pageAugmentorPlacement = 'bottom';
    }
    if (hasSelectorUpdate) {
      selectorValue.textContent = state.selector;
    }
    if (hasContainerUpdate || hasFloatingUpdate || hasBubbleSideUpdate || hasSelectorUpdate || hasPositionUpdate) {
      placementControls?.update();
    }
    if (!refreshedByTypeChange) {
      refreshUI();
    }
  };

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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    if (!validateSubmission(payload)) {
      return;
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
      const initialFocus =
        focusTargets.text ||
        focusTargets.actionFlow ||
        bubble.querySelector('input, textarea, select');
      if (initialFocus instanceof HTMLElement && typeof initialFocus.focus === 'function') {
        initialFocus.focus({ preventScroll: true });
      }
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
      currentSiteUrl = typeof values?.siteUrl === 'string' ? values.siteUrl : '';
      currentPageUrl = typeof values?.pageUrl === 'string' ? values.pageUrl : currentSiteUrl;
      currentTarget = target;
      selectorValue.textContent = selector;
      state.selector = typeof selector === 'string' ? selector.trim() : '';
      previewHandler = typeof onPreview === 'function' ? onPreview : null;
      currentElementId = typeof values?.id === 'string' ? values.id : null;
      const initial = getDefaultElementValues(values, suggestedStyle, t);
      const initialScope = currentSiteUrl && currentPageUrl && currentSiteUrl === currentPageUrl ? 'site' : 'page';
      // Refresh with live location to avoid stale persisted pageUrl when scope toggles
      const live = resolveCurrentUrls();
      currentSiteUrl = live.site || currentSiteUrl;
      currentPageUrl = live.page || currentPageUrl;
      const initialPatch = {
        type: initial.type,
        text: initial.text,
        href: initial.href,
        actionFlow: initial.actionFlow || '',
        actionFlowError: '',
        actionFlowSteps: 0,
        actionFlowMode: 'builder',
        actionSteps: [],
        actionFlowLocked: initial.actionFlowLocked,
        position: initial.position,
        tooltipPosition: initial.tooltipPosition,
        tooltipPersistent: initial.tooltipPersistent,
        layout: initial.layout || 'row',
        linkTarget: initial.linkTarget || 'new-tab',
        containerId: typeof initial.containerId === 'string' ? initial.containerId : '',
        floating: initial.floating !== false,
        bubbleSide: 'bottom',
        scope: initialScope,
        siteUrl: currentSiteUrl || '',
        pageUrl: currentPageUrl || '',
        style: initial.style || {},
      };
      setState(initialPatch);
      state = editorState.get();
      let initialFlowSource = state.actionFlow;
      if (state.type === 'button' && (!initialFlowSource || !initialFlowSource.trim())) {
        const inheritedSelector = typeof values.actionSelector === 'string' ? values.actionSelector.trim() : '';
        if (inheritedSelector) {
          initialFlowSource = JSON.stringify({ steps: [{ type: 'click', selector: inheritedSelector }] }, null, 2);
          setState({ actionFlow: initialFlowSource });
          state = editorState.get();
        }
      }
      const parsedFlow =
        state.type === 'button' ? parseFlowForBuilder(initialFlowSource) : { mode: 'builder', steps: [], error: '' };
      if (state.type === 'button' && parsedFlow.mode === 'builder') {
        setState({
          actionFlowMode: 'builder',
          actionSteps: parsedFlow.steps,
          actionFlow: parsedFlow.steps.length ? stepsToJSON(parsedFlow.steps) : '',
        });
        state = editorState.get();
        actionFlowInput.value = state.actionFlow;
      } else if (state.type === 'button' && parsedFlow.mode === 'advanced') {
        setState({
          actionFlowMode: 'advanced',
          actionFlow: initial.actionFlow || '',
          actionFlowError: parsedFlow.error || '',
        });
        state = editorState.get();
        actionFlowInput.value = state.actionFlow;
      } else {
        actionFlowInput.value = state.actionFlow;
      }
      resetStyleState(initial.style, initial.styleSuggestions);
      stopActionPicker('cancel');
      handleTypeChange({ skipPreview: true });
      saveButton.textContent = mode === 'edit' ? t('editor.saveUpdate') : t('editor.saveCreate');
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
