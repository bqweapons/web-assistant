import { createField, styleInput } from '../ui/field.js';
import { stepsToJSON } from '../actionflow/serializer.js';

/**
 * Creates the action flow controls used by the element editor.
 * @param {{
 *   t: import('../../common/i18n.js').TranslateFunction;
 *   MAX_FLOW_SOURCE_LENGTH: number;
 *   parseActionFlowDefinition: typeof import('../../common/flows.js').parseActionFlowDefinition;
 *   startPicker: typeof import('../actionflow/picker.js').startPicker;
 *   stopPicker: (reason?: 'cancel' | 'select') => void;
 *   getState: () => any;
 *   setState: (patch: Record<string, unknown>) => void;
 *   showError: (message: string) => void;
 * }} options
*/
export function createActionFlowController(options) {
  const {
    t,
    MAX_FLOW_SOURCE_LENGTH,
    parseActionFlowDefinition,
    startPicker,
    stopPicker,
    getState,
    setState,
    showError,
  } = options;

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
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
    zIndex: '50',
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

  const actionFlowHint = document.createElement('p');
  actionFlowHint.textContent = t('editor.actionFlowHintDefault', { limit: MAX_FLOW_SOURCE_LENGTH });
  Object.assign(actionFlowHint.style, {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  actionFlowHint.dataset.defaultColor = '#94a3b8';
  actionFlowField.wrapper.append(actionFlowHint);

  const flowBubble = document.createElement('div');
  flowBubble.dataset.pageAugmentorRoot = 'picker-flow-bubble';
  Object.assign(flowBubble.style, {
    position: 'fixed',
    top: '24px',
    right: '24px',
    width: '420px',
    maxHeight: '92vh',
    minHeight: '420px',
    padding: '22px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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
    paddingRight: '8px',
    flex: '1 1 auto',
    minHeight: '0',
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

  let actionMenuVisible = false;
  let actionBuilderInvalidIndex = -1;
  let flowBubbleAttached = false;
  let flowSnapshot = null;
  let attachMainBubble = () => {};
  let detachMainBubble = () => {};

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

  function hideActionMenu() {
    if (!actionMenuVisible) {
      return;
    }
    actionMenuVisible = false;
    addActionMenu.style.display = 'none';
    addActionButton.setAttribute('aria-expanded', 'false');
    flowBubbleBody.style.overflowY = 'auto';
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
    flowBubbleBody.style.overflowY = 'visible';
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

  const updateActionFlowSummary = () => {
    const state = getState();
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

  const updateActionFlowFromSteps = ({ updateHint = true } = {}) => {
    const state = getState();
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

    const serialized = stepsToJSON(state.actionSteps);
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
    const state = getState();
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
    const state = getState();
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    hideActionMenu();
    state.actionSteps = [...state.actionSteps, createStepTemplate(type)];
    refreshActionBuilderState();
    updateActionFlowFromSteps();
  };

  const removeActionStep = (index) => {
    const state = getState();
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    state.actionSteps = state.actionSteps.filter((_, idx) => idx !== index);
    refreshActionBuilderState();
    updateActionFlowFromSteps();
  };

  const updateActionStep = (index, patch) => {
    const state = getState();
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    state.actionSteps = state.actionSteps.map((step, idx) => (idx === index ? { ...step, ...patch } : step));
    updateActionFlowFromSteps();
    refreshActionBuilderState();
  };

  const convertActionStepType = (index, type) => {
    const state = getState();
    if (state.actionFlowMode !== 'builder') {
      return;
    }
    const current = state.actionSteps[index] || {};
    state.actionSteps = state.actionSteps.map((step, idx) => (idx === index ? createStepTemplate(type, step) : step));
    if (current.type !== type) {
      updateActionFlowFromSteps();
    }
    refreshActionBuilderState();
  };

  const createActionStepRow = (step, index) => {
    const state = getState();
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
        const currentState = getState();
        currentState.actionSteps[index] = {
          ...currentState.actionSteps[index],
          ms: Number.isFinite(nextValue) ? nextValue : 0,
        };
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
        const currentState = getState();
        currentState.actionSteps[index] = {
          ...currentState.actionSteps[index],
          selector: event.target.value,
        };
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
        const currentState = getState();
        const currentStep = currentState.actionSteps[index];
        const accept = currentStep && currentStep.type === 'input' ? 'input' : step.type === 'input' ? 'input' : 'clickable';
        startPicker({
          accept,
          source: 'builder',
          onSelect: (selector) => {
            row.dataset.picking = 'false';
            const nextState = getState();
            nextState.actionSteps[index] = { ...nextState.actionSteps[index], selector };
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
          const currentState = getState();
          currentState.actionSteps[index] = {
            ...currentState.actionSteps[index],
            value: event.target.value,
          };
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
    const state = getState();
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

  const handleFlowKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      flowCancelButton.click();
    }
  };

  const restoreFlowState = (snapshot) => {
    if (!snapshot) {
      return;
    }
    const state = getState();
    state.actionFlow = snapshot.actionFlow || '';
    state.actionFlowError = snapshot.actionFlowError || '';
    state.actionFlowSteps = snapshot.actionFlowSteps || 0;
    state.actionFlowMode = snapshot.actionFlowMode || 'builder';
    state.actionSteps = Array.isArray(snapshot.actionSteps) ? snapshot.actionSteps.map((step) => ({ ...step })) : [];
    actionFlowInput.value = state.actionFlow;
    refreshActionBuilderState();
    updateActionFlowFromSteps({ updateHint: false });
    syncActionFlowUI();
    updateActionFlowSummary();
  };

  const closeFlowEditor = ({ reopen = true } = {}) => {
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
      attachMainBubble();
      updateActionFlowSummary();
    }
  };

  const openFlowEditor = () => {
    const state = getState();
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

    detachMainBubble();
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
    updateActionFlowFromSteps({ updateHint: false });
    syncActionFlowUI();
    updateActionFlowSummary();
  };

  openActionFlowButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const state = getState();
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
    const state = getState();
    if (state.type !== 'button') {
      flowSnapshot = null;
      closeFlowEditor({ reopen: true });
      return;
    }

    if (state.actionFlowMode === 'builder') {
      const serialized = stepsToJSON(Array.isArray(state.actionSteps) ? state.actionSteps : []);
      setState({ actionFlow: serialized });
      const { definition, error } = parseActionFlowDefinition(serialized.trim());
      if (error || !definition) {
        showError(t('editor.errorFlowInvalid', { error: error || '' }));
        return;
      }
      state.actionFlow = serialized;
      state.actionFlowSteps = definition.stepCount;
      state.actionFlowError = '';
      actionFlowInput.value = serialized;
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

  actionFlowInput.addEventListener('input', (event) => {
    const state = getState();
    if (state.actionFlowMode === 'builder') {
      event.target.value = state.actionFlow;
      return;
    }
    state.actionFlow = event.target.value;
    validateActionFlowInput();
    updateActionFlowSummary();
  });

  actionFlowInput.addEventListener('change', (event) => {
    const state = getState();
    if (state.actionFlowMode === 'builder') {
      event.target.value = state.actionFlow;
      return;
    }
    state.actionFlow = event.target.value;
    validateActionFlowInput();
    updateActionFlowSummary();
  });

  const validateActionFlowInput = () => {
    const state = getState();
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

  return {
    field: actionFlowField,
    summaryField: actionFlowSummaryField,
    input: actionFlowInput,
    summary: {
      text: actionFlowSummaryText,
      hint: actionFlowSummaryHint,
    },
    hint: actionFlowHint,
    editorHost: actionFlowEditorHost,
    flowBubble,
    flowCancelButton,
    flowSaveButton,
    openButton: openActionFlowButton,
    updateSummary: updateActionFlowSummary,
    updateFromSteps: updateActionFlowFromSteps,
    refreshBuilder: refreshActionBuilderState,
    syncUI: syncActionFlowUI,
    validateInput: validateActionFlowInput,
    hideMenu: hideActionMenu,
    closeFlowEditor,
    openFlowEditor,
    restoreFlowState,
    setMainBubbleControls({ attach, detach }) {
      if (typeof attach === 'function') {
        attachMainBubble = attach;
      }
      if (typeof detach === 'function') {
        detachMainBubble = detach;
      }
    },
    getFlowSnapshot: () => flowSnapshot,
  };
}
