const ACTION_TYPE_OPTIONS = [
  { value: 'click', type: 'click' },
  { value: 'input', type: 'input' },
  { value: 'wait', type: 'wait' },
];

/**
 * Mounts the action-flow builder UI into the provided container.
 * @param {HTMLElement} container
 * @param {{
 *   t: (key: string, params?: Record<string, any>) => string;
 *   startPicker: (options: { accept?: 'clickable' | 'input'; onSelect?: (selector: string) => void; onCancel?: () => void }) => () => void;
 *   onStepsChange: (steps: Array<{ type: 'click' | 'input' | 'wait'; selector?: string; value?: string; ms?: number }>) => void;
 *   getInitialSteps?: () => Array<{ type: 'click' | 'input' | 'wait'; selector?: string; value?: string; ms?: number }>;
 *   setInvalidIndex?: (index: number) => void;
 *   onMenuToggle?: (open: boolean) => void;
 * }} deps
 * @returns {{ update(nextSteps: Array<any>, invalidIndex?: number): void; dispose(): void }}
 */
export function mountActionBuilder(container, deps) {
  const { t, startPicker, onStepsChange, getInitialSteps, onMenuToggle } = deps;
  let steps = cloneSteps(typeof getInitialSteps === 'function' ? getInitialSteps() : []);
  let invalidIndex = -1;
  let menuVisible = false;
  let stopPicker = null;

  Object.assign(container.style, {
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

  const emptyState = document.createElement('div');
  emptyState.textContent = t('editor.actionBuilder.empty');
  Object.assign(emptyState.style, {
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

  ACTION_TYPE_OPTIONS.forEach((option) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.dataset.actionType = option.type;
    optionButton.textContent = t(`editor.actionBuilder.type.${option.type}`);
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
    optionButton.addEventListener('mouseenter', () => {
      optionButton.style.backgroundColor = '#eef2ff';
    });
    optionButton.addEventListener('mouseleave', () => {
      optionButton.style.backgroundColor = 'transparent';
    });
    optionButton.addEventListener('focus', () => {
      optionButton.style.backgroundColor = '#eef2ff';
    });
    optionButton.addEventListener('blur', () => {
      optionButton.style.backgroundColor = 'transparent';
    });
    optionButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      addStep(option.type);
      hideMenu();
    });
    addActionMenu.appendChild(optionButton);
  });

  addActionButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (addActionButton.disabled) {
      return;
    }
    if (menuVisible) {
      hideMenu();
    } else {
      showMenu();
    }
  });

  addActionContainer.append(addActionButton, addActionMenu);

  container.append(actionStepsContainer, emptyState, addActionContainer);

  function disposeMenuListeners() {
    document.removeEventListener('mousedown', handleMenuOutsideClick, true);
    document.removeEventListener('keydown', handleMenuKeydown, true);
  }

  function hideMenu() {
    if (!menuVisible) {
      return;
    }
    menuVisible = false;
    addActionMenu.style.display = 'none';
    addActionButton.setAttribute('aria-expanded', 'false');
    disposeMenuListeners();
    if (typeof onMenuToggle === 'function') {
      onMenuToggle(false);
    }
  }

  function showMenu() {
    if (menuVisible) {
      return;
    }
    menuVisible = true;
    addActionMenu.style.display = 'flex';
    addActionButton.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', handleMenuOutsideClick, true);
    document.addEventListener('keydown', handleMenuKeydown, true);
    if (typeof onMenuToggle === 'function') {
      onMenuToggle(true);
    }
    requestAnimationFrame(() => {
      const firstOption = addActionMenu.querySelector('button');
      if (firstOption instanceof HTMLButtonElement) {
        firstOption.focus({ preventScroll: true });
      }
    });
  }

  function handleMenuOutsideClick(event) {
    if (!addActionContainer.contains(event.target)) {
      hideMenu();
    }
  }

  function handleMenuKeydown(event) {
    if (event.key === 'Escape') {
      hideMenu();
      addActionButton.focus({ preventScroll: true });
    }
  }

  function addStep(type = 'click') {
    steps = [...steps, createStepTemplate(type)];
    emitChange();
  }

  function removeStep(index) {
    steps = steps.filter((_, idx) => idx !== index);
    emitChange();
  }

  function convertStepType(index, type) {
    const current = steps[index] || {};
    steps = steps.map((step, idx) => (idx === index ? createStepTemplate(type, step) : step));
    if (current.type !== type) {
      emitChange();
    } else {
      render();
    }
  }

  function applyStepPatch(index, patch) {
    steps = steps.map((step, idx) => (idx === index ? { ...step, ...patch } : step));
  }

  function emitChange({ reRender = true } = {}) {
    if (typeof onStepsChange === 'function') {
      onStepsChange(cloneSteps(steps));
    }
    if (reRender) {
      render();
    }
  }

  function stopActivePicker() {
    if (typeof stopPicker === 'function') {
      stopPicker();
      stopPicker = null;
    }
  }

  function render() {
    actionStepsContainer.innerHTML = '';
    emptyState.style.display = steps.length === 0 ? 'block' : 'none';

    steps.forEach((step, index) => {
      const row = createStepRow(step, index);
      if (index === invalidIndex) {
        row.style.border = '1px solid #dc2626';
        row.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.1)';
      } else {
        row.style.border = '1px solid rgba(148, 163, 184, 0.6)';
        row.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.04)';
      }
      actionStepsContainer.appendChild(row);
    });

    if (menuVisible && steps.length === 0) {
      // Keep menu accessible even when empty state visible.
      emptyState.style.display = 'none';
    }
  }

  function createStepRow(step, index) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px',
      borderRadius: '10px',
      backgroundColor: '#ffffff',
    });

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
      removeStep(index);
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
      opt.value = option.type;
      opt.textContent = t(`editor.actionBuilder.type.${option.type}`);
      typeSelect.appendChild(opt);
    });
    typeSelect.value = step.type;
    styleInput(typeSelect);
    typeSelect.addEventListener('change', (event) => {
      convertStepType(index, event.target.value);
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
        const value = Number.parseInt(event.target.value, 10);
        const nextValue = Number.isFinite(value) ? value : 0;
        applyStepPatch(index, { ms: nextValue });
        emitChange({ reRender: false });
      });
      delayInput.addEventListener('change', (event) => {
        const value = Number.parseInt(event.target.value, 10);
        const nextValue = Number.isFinite(value) ? value : 0;
        applyStepPatch(index, { ms: nextValue });
        emitChange();
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
        applyStepPatch(index, { selector: event.target.value });
        emitChange({ reRender: false });
      });
      selectorInput.addEventListener('change', (event) => {
        applyStepPatch(index, { selector: event.target.value });
        emitChange();
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
        event.stopPropagation();
        stopActivePicker();
        row.dataset.picking = 'true';
        const accept = step.type === 'input' ? 'input' : 'clickable';
        stopPicker = startPicker({
          accept,
          onSelect: (selector) => {
            row.dataset.picking = 'false';
            stopPicker = null;
            applyStepPatch(index, { selector });
            emitChange();
          },
          onCancel: () => {
            row.dataset.picking = 'false';
            stopPicker = null;
            render();
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
          applyStepPatch(index, { value: event.target.value });
          emitChange({ reRender: false });
        });
        valueInput.addEventListener('change', (event) => {
          applyStepPatch(index, { value: event.target.value });
          emitChange();
        });

        valueLabel.appendChild(valueInput);
        body.appendChild(valueLabel);
      }
    }

    row.appendChild(body);
    return row;
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

  function createStepTemplate(type, previous = {}) {
    if (type === 'input') {
      return {
        type: 'input',
        selector: typeof previous.selector === 'string' ? previous.selector : '',
        value: typeof previous.value === 'string' ? previous.value : '',
      };
    }
    if (type === 'wait') {
      const ms =
        typeof previous.ms === 'number' && Number.isFinite(previous.ms) && previous.ms >= 0
          ? Math.round(previous.ms)
          : 1000;
      return { type: 'wait', ms };
    }
    return { type: 'click', selector: typeof previous.selector === 'string' ? previous.selector : '' };
  }

  function cloneSteps(list) {
    return Array.isArray(list) ? list.map((step) => ({ ...step })) : [];
  }

  render();

  return {
    update(nextSteps, nextInvalidIndex = -1) {
      steps = cloneSteps(nextSteps);
      invalidIndex = typeof nextInvalidIndex === 'number' ? nextInvalidIndex : -1;
      render();
    },
    setDisabled(disabled) {
      addActionButton.disabled = Boolean(disabled);
      if (disabled) {
        hideMenu();
      }
    },
    dispose() {
      stopActivePicker();
      hideMenu();
      container.innerHTML = '';
      disposeMenuListeners();
    },
  };
}
