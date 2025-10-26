const DEFAULT_STATE = {
  type: 'button',
  text: '',
  href: '',
  position: 'append',
  style: {},
  actionFlowMode: 'builder',
  actionFlow: '',
  actionFlowError: '',
  actionFlowSteps: 0,
  actionSteps: [],
  tooltipPosition: 'top',
  tooltipPersistent: false,
};

/**
 * Creates a state container for the element editor.
 * @param {Partial<typeof DEFAULT_STATE>} [initial]
 * @returns {{
 *   get(): typeof DEFAULT_STATE;
 *   patch(partial: Partial<typeof DEFAULT_STATE>): void;
 *   subscribe(listener: (state: typeof DEFAULT_STATE) => void): () => void;
 *   snapshot(): typeof DEFAULT_STATE;
 *   restore(snapshot: typeof DEFAULT_STATE): void;
 * }}
 */
export function createEditorState(initial = {}) {
  let state = mergeState(DEFAULT_STATE, initial);
  const listeners = new Set();

  function emit() {
    const snapshot = cloneState(state);
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (_error) {
        // Ignore listener failures.
      }
    });
  }

  return {
    get() {
      return cloneState(state);
    },
    patch(partial) {
      state = mergeState(state, partial);
      emit();
    },
    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot() {
      return cloneState(state);
    },
    restore(snapshot) {
      state = mergeState(DEFAULT_STATE, snapshot);
      emit();
    },
  };
}

function mergeState(base, patch) {
  const next = {
    ...base,
    ...patch,
  };
  next.style = cloneRecord(patch.style !== undefined ? patch.style : base.style);
  next.actionSteps = cloneArray(patch.actionSteps !== undefined ? patch.actionSteps : base.actionSteps);
  return next;
}

function cloneArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (item && typeof item === 'object' ? { ...item } : item));
}

function cloneRecord(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return { ...value };
}

function cloneState(value) {
  return {
    type: value.type,
    text: value.text,
    href: value.href,
    position: value.position,
    style: cloneRecord(value.style),
    actionFlowMode: value.actionFlowMode,
    actionFlow: value.actionFlow,
    actionFlowError: value.actionFlowError,
    actionFlowSteps: value.actionFlowSteps,
    actionSteps: cloneArray(value.actionSteps),
    tooltipPosition: value.tooltipPosition,
    tooltipPersistent: Boolean(value.tooltipPersistent),
  };
}
