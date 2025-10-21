const HIGHLIGHT_BORDER_COLOR = '#1b84ff';
const HIGHLIGHT_FILL_COLOR = 'rgba(27, 132, 255, 0.2)';

const VALID_POSITIONS = new Set(['append', 'prepend', 'before', 'after']);
const STYLE_FIELD_CONFIGS = [
  { name: 'color', label: 'Text color', placeholder: '#2563eb', colorPicker: true },
  { name: 'backgroundColor', label: 'Background', placeholder: '#1b84ff', colorPicker: true },
  { name: 'fontSize', label: 'Font size', placeholder: '16px' },
  { name: 'fontWeight', label: 'Font weight', placeholder: '600' },
  { name: 'padding', label: 'Padding', placeholder: '8px 16px' },
  { name: 'borderRadius', label: 'Border radius', placeholder: '8px' },
  { name: 'textDecoration', label: 'Text decoration', placeholder: 'underline' },
];

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
  if (element.id && isIdUnique(element.id)) {
    return `#${cssEscape(element.id)}`;
  }

  const segments = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
    let segment = current.localName;
    if (!segment) {
      break;
    }
    if (current.id && isIdUnique(current.id)) {
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
 *   onSubmit?: (payload: { selector: string; type: 'button' | 'link'; text: string; href?: string; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void;
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
        onSubmit?.({ ...result, selector });
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
 *   onSubmit?: (payload: { type: 'button' | 'link'; text: string; href?: string; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void;
 *   onCancel?: () => void;
 *   onPreview?: (payload: { type: 'button' | 'link'; text: string; href?: string; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void;
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

function getElementBubble() {
  if (!sharedBubble) {
    sharedBubble = createElementBubble();
  }
  return sharedBubble;
}

/**
 * Determines whether an id is unique within the document.
 * @param {string} id
 * @returns {boolean}
 */
function isIdUnique(id) {
  return document.querySelectorAll(`#${cssEscape(id)}`).length === 1;
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
  });

  bubble.addEventListener('click', (event) => event.stopPropagation());
  bubble.addEventListener('mousedown', (event) => event.stopPropagation());

  const title = document.createElement('h3');
  title.textContent = 'Element settings';
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
    marginBottom: '12px',
  });

  const selectorTitle = document.createElement('span');
  selectorTitle.textContent = 'Target selector';
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
    marginBottom: '12px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
  });

  const previewLabel = document.createElement('span');
  previewLabel.textContent = 'Live preview';
  Object.assign(previewLabel.style, {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  });

  let previewElement = document.createElement('button');
  previewElement.tabIndex = -1;
  previewElement.style.cursor = 'default';
  previewElement.addEventListener('click', (event) => event.preventDefault());
  previewWrapper.append(previewLabel, previewElement);

  const form = document.createElement('form');
  Object.assign(form.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });

  const typeSelect = document.createElement('select');
  ['button', 'link'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value === 'button' ? 'Button' : 'Link';
    typeSelect.appendChild(option);
  });
  styleInput(typeSelect);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.placeholder = 'Element text';
  textInput.maxLength = 160;
  styleInput(textInput);

  const hrefInput = document.createElement('input');
  hrefInput.type = 'url';
  hrefInput.placeholder = 'https://example.com';
  styleInput(hrefInput);

  const positionSelect = document.createElement('select');
  ['append', 'prepend', 'before', 'after'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    positionSelect.appendChild(option);
  });
  styleInput(positionSelect);

  const typeField = createField('Element type', typeSelect);
  const textField = createField('Text content', textInput);
  const hrefField = createField('Destination URL', hrefInput);
  const positionField = createField('Insert position', positionSelect);

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
  styleLegend.textContent = 'Style overrides';
  Object.assign(styleLegend.style, {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    padding: '0 6px',
  });
  styleFieldset.appendChild(styleLegend);

  const styleInputs = new Map();
  const styleState = {};
  STYLE_FIELD_CONFIGS.forEach(({ name }) => {
    styleState[name] = '';
  });

  STYLE_FIELD_CONFIGS.forEach((config) => {
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
        border: '1px solid rgba(148, 163, 184, 0.6)',
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
  styleHint.textContent = 'Leave fields blank to keep the default appearance.';
  Object.assign(styleHint.style, {
    margin: '0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  styleFieldset.appendChild(styleHint);

  const errorLabel = document.createElement('p');
  errorLabel.textContent = '';
  Object.assign(errorLabel.style, {
    margin: '4px 0 0 0',
    fontSize: '12px',
    color: '#dc2626',
    minHeight: '16px',
  });

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  });

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
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
  saveButton.textContent = 'Save';
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
  form.append(
    typeField.wrapper,
    textField.wrapper,
    hrefField.wrapper,
    positionField.wrapper,
    styleFieldset,
    actions,
  );

  bubble.append(title, selectorWrapper, previewWrapper, form, errorLabel);

  /** @type {Element | null} */
  let currentTarget = null;
  /** @type {() => void} */
  let cancelHandler = () => {};
  /** @type {(payload: { type: 'button' | 'link'; text: string; href?: string; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void} */
  let submitHandler = () => {};
  /** @type {null | ((payload: { type: 'button' | 'link'; text: string; href?: string; position: 'append' | 'prepend' | 'before' | 'after'; style?: import('../common/types.js').InjectedElementStyle }) => void)} */
  let previewHandler = null;
  let isAttached = false;

  const state = {
    type: 'button',
    text: '',
    href: '',
    position: 'append',
  };

  const clearError = () => {
    errorLabel.textContent = '';
  };

  [textInput, hrefInput, typeSelect, positionSelect].forEach((input) => {
    input.addEventListener('input', clearError);
    input.addEventListener('change', clearError);
  });

  const resetStyleState = (source) => {
    STYLE_FIELD_CONFIGS.forEach(({ name }) => {
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
    return {
      type: state.type === 'link' ? 'link' : 'button',
      text: textValue,
      href: hrefValue ? hrefValue : undefined,
      position,
      style,
    };
  };

  const ensurePreviewElement = (type) => {
    const desiredTag = type === 'link' ? 'a' : 'button';
    if (previewElement.tagName.toLowerCase() !== desiredTag) {
      const replacement = document.createElement(desiredTag);
      replacement.tabIndex = -1;
      replacement.style.cursor = 'default';
      replacement.addEventListener('click', (event) => event.preventDefault());
      previewWrapper.replaceChild(replacement, previewElement);
      previewElement = replacement;
    }
    if (type === 'link') {
      previewElement.setAttribute('href', '#');
      previewElement.setAttribute('role', 'link');
    } else {
      previewElement.removeAttribute('href');
    }
  };

  const updatePreview = (options = { propagate: true }) => {
    const payload = buildPayload();
    ensurePreviewElement(payload.type);
    previewElement.textContent =
      payload.text || (payload.type === 'link' ? 'Link preview' : 'Button preview');
    applyPreviewBase(previewElement, payload.type);
    if (payload.style) {
      Object.entries(payload.style).forEach(([key, value]) => {
        previewElement.style[key] = value;
      });
    }
    if (options.propagate && typeof previewHandler === 'function') {
      previewHandler(payload);
    }
  };

  const handleTypeChange = (applyDefaults = false) => {
    const isLink = state.type === 'link';
    hrefInput.required = isLink;
    hrefInput.placeholder = isLink ? 'https://example.com' : 'https://example.com (optional)';
    hrefField.label.textContent = isLink ? 'Destination URL' : 'Optional URL';
    if (applyDefaults) {
      const defaults = state.type === 'link' ? DEFAULT_LINK_STYLE : DEFAULT_BUTTON_STYLE;
      resetStyleState(defaults);
    }
    updatePreview();
  };

  typeSelect.addEventListener('change', (event) => {
    state.type = event.target.value === 'link' ? 'link' : 'button';
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

  positionSelect.addEventListener('change', (event) => {
    state.position = event.target.value;
    updatePreview();
  });

  STYLE_FIELD_CONFIGS.forEach(({ name }) => {
    const record = styleInputs.get(name);
    if (!record) {
      return;
    }
    record.text.addEventListener('input', clearError);
    record.text.addEventListener('change', clearError);
    record.text.addEventListener('input', (event) => {
      styleState[name] = event.target.value;
      if (record.color && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i.test(event.target.value.trim())) {
        record.color.value = event.target.value.trim();
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
        updatePreview();
      });
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload.text) {
      errorLabel.textContent = 'Please provide text content.';
      textInput.focus({ preventScroll: true });
      return;
    }
    if (payload.type === 'link' && !state.href.trim()) {
      errorLabel.textContent = 'Links require a destination URL.';
      hrefInput.focus({ preventScroll: true });
      return;
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
    let top = rect.top + rect.height / 2 - bubbleHeight / 2;
    top = Math.max(12, Math.min(window.innerHeight - bubbleHeight - 12, top));

    let left = rect.right + 12;
    if (left + bubbleWidth + 12 > window.innerWidth) {
      left = rect.left - bubbleWidth - 12;
    }
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
      state.position = initial.position;
      typeSelect.value = state.type;
      textInput.value = state.text;
      hrefInput.value = state.href;
      positionSelect.value = state.position;
      resetStyleState(initial.style);
      handleTypeChange();
      errorLabel.textContent = '';
      title.textContent = mode === 'edit' ? 'Edit element' : 'Add element';
      saveButton.textContent = mode === 'edit' ? 'Save changes' : 'Create element';
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
  };
}

function defaultElementValues(values = {}, suggestedStyle = {}) {
  const type = values.type === 'link' ? 'link' : 'button';
  const text = typeof values.text === 'string' ? values.text : '';
  const href = typeof values.href === 'string' ? values.href : '';
  const position = VALID_POSITIONS.has(values.position)
    ? /** @type {'append' | 'prepend' | 'before' | 'after'} */ (values.position)
    : 'append';
  const defaults = type === 'link' ? DEFAULT_LINK_STYLE : DEFAULT_BUTTON_STYLE;
  const style = {};
  STYLE_FIELD_CONFIGS.forEach(({ name }) => {
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
  return { type, text, href, position, style };
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
  STYLE_FIELD_CONFIGS.forEach(({ name }) => {
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
    element.style.padding = '10';
    element.style.backgroundColor = 'transparent';
  } else {
    element.style.display = 'inline-flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.padding = '8px 16px';
    element.style.borderRadius = '8px';
    element.style.backgroundColor = '#1b84ff';
    element.style.color = '#fff';
    element.style.fontSize = '0.95rem';
    element.style.border = 'none';
    element.style.textDecoration = 'none';
    element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.12)';
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






