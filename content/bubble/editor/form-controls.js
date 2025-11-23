import { createField, styleInput } from '../ui/field.js';
import { applyCardStyle } from '../ui/card.js';
import { createSectionShell } from '../ui/section.js';
import {
  DEFAULT_BASE_INFO_ITEM_MIN_WIDTH,
  DEFAULT_STYLE_ITEM_MIN_WIDTH,
  getStyleFieldConfigs as buildStyleFieldConfigs,
} from './field-config.js';
import { normalizeStyleState } from '../styles/style-normalize.js';
import { DEFAULT_AREA_STYLE, DEFAULT_BUTTON_STYLE, DEFAULT_LINK_STYLE } from '../styles/style-presets.js';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i;
const POSITION_OPTIONS = ['relative', 'absolute', 'fixed', 'static', 'sticky'];

/**
 * Builds form sections (base + style + flow) from a unified config.
 * @param {{
 *   t: import('../../common/i18n.js').TranslateFunction;
 *   sections: Array<{
 *     key: string;
 *     legend: string;
 *     fields?: Array<Record<string, any>>;
 *     isStyle?: boolean;
 *   }>;
 *   getState: () => any;
 *   setState: (patch: Record<string, unknown>) => void;
 *   actionFlowController: ReturnType<typeof import('./action-flow-controller.js').createActionFlowController>;
 *   clearError?: () => void;
 *   onChange?: () => void;
 *   onFieldChange?: (key: string, value?: unknown) => void;
 * }} options
 */
export function buildFormSections({
  t,
  sections = [],
  getState,
  setState,
  actionFlowController,
  clearError,
  onChange,
  onFieldChange,
}) {
  const nodes = {};
  const focusTargets = {};
  const fieldsets = [];
  const visibilityHandlers = [];
  const refreshHandlers = [];
  const typeChangeHandlers = [];
  const resetHandlers = [];
  const styleApi = createStyleApi({ t, clearError, onChange });

  const stateGetter = typeof getState === 'function' ? getState : () => ({});
  const stateSetter = typeof setState === 'function' ? setState : () => {};
  const notifyChange = typeof onChange === 'function' ? onChange : () => {};

  sections.forEach((section) => {
    const { fieldset, applyVisibility, refreshFields, onTypeChange, resetFields } = buildSection({
      section,
      nodes,
      focusTargets,
      getState: stateGetter,
      setState: stateSetter,
      clearError,
      onChange: notifyChange,
      actionFlowController,
      emitFieldChange: typeof onFieldChange === 'function' ? onFieldChange : null,
      styleApi,
      t,
    });
    fieldsets.push(fieldset);
    visibilityHandlers.push(applyVisibility);
    refreshHandlers.push(refreshFields);
    if (onTypeChange) {
      typeChangeHandlers.push(onTypeChange);
    }
    if (resetFields) {
      resetHandlers.push(resetFields);
    }
  });

  return {
    fieldsets,
    nodes,
    focusTargets,
    refreshVisibility: () => visibilityHandlers.forEach((fn) => fn()),
    refreshFields: () => refreshHandlers.forEach((fn) => fn()),
    applyTypeChange: (options = {}) => typeChangeHandlers.forEach((fn) => fn(options)),
    resetFields: (options = {}) => resetHandlers.forEach((fn) => fn(options)),
    resetStyle: styleApi.reset,
    mergeStyle: styleApi.merge,
    getStyle: styleApi.getStyle,
    getNormalizedStyle: styleApi.getNormalizedStyle,
  };
}

function buildSection({
  section,
  nodes,
  focusTargets,
  getState,
  setState,
  clearError,
  onChange,
  actionFlowController,
  emitFieldChange,
  styleApi,
  t,
}) {
  const isStyleSection = Boolean(section.isStyle);
  const defaultWidth = isStyleSection ? DEFAULT_STYLE_ITEM_MIN_WIDTH : DEFAULT_BASE_INFO_ITEM_MIN_WIDTH;
  const shell = isStyleSection
    ? createStyleSectionShell(
        section.legend,
        typeof t === 'function' ? t('editor.stylesAdvancedToggle') : 'Advanced',
      )
    : createSectionShell({ legendText: section.legend });
  const container = shell.container;
  const advancedContainer = isStyleSection ? shell.advancedContainer : null;
  const handlers = [];
  const stateGetter = typeof getState === 'function' ? getState : () => ({});
  const stateSetter = typeof setState === 'function' ? setState : () => {};
  const notifyChange = typeof onChange === 'function' ? onChange : () => {};

  if (isStyleSection && shell.advancedHint) {
    shell.advancedHint.textContent = typeof t === 'function' ? t('editor.stylesAdvancedHint') : '';
  }

  (section.fields || []).forEach((field) => {
    const builder = pickFieldBuilder(field.type, { styleApi, actionFlowController });
    if (!builder) {
      return;
    }
    const record = builder({
      field,
      defaultWidth,
      clearError,
      getState: stateGetter,
      setState: stateSetter,
      onChange: notifyChange,
      actionFlowController,
      emitFieldChange,
    });
    if (!record || !(record.wrapper instanceof HTMLElement)) {
      return;
    }
    const key = field.key || field.name;
    if (key) {
      nodes[key] = record.wrapper;
      if (record.focusable instanceof HTMLElement) {
        focusTargets[key] = record.focusable;
      }
    }
    const target =
      isStyleSection && field.group === 'advanced' && advancedContainer ? advancedContainer : container;
    target.appendChild(record.wrapper);
    handlers.push({
      wrapper: record.wrapper,
      visibleWhen: field.visibleWhen,
      applyState: record.applyState,
      onTypeChange: record.onTypeChange,
      onReset: record.onReset,
    });
  });

  shell.fieldset.appendChild(container);
  if (isStyleSection && shell.advancedDetails) {
    shell.fieldset.appendChild(shell.advancedDetails);
  }

  const applyVisibility = () => {
    const state = stateGetter() || {};
    handlers.forEach(({ wrapper, visibleWhen }) => {
      if (!(wrapper instanceof HTMLElement)) return;
      const visible = typeof visibleWhen === 'function' ? !!visibleWhen(state) : true;
      wrapper.style.display = visible ? 'flex' : 'none';
    });
  };

  const refreshFields = () => {
    const state = stateGetter() || {};
    handlers.forEach(({ applyState }) => {
      if (typeof applyState === 'function') {
        applyState(state);
      }
    });
  };

  const onTypeChange = (options = {}) => {
    const state = stateGetter() || {};
    handlers.forEach(({ onReset, onTypeChange }) => {
      if (options.applyDefaults && typeof onReset === 'function') {
        onReset({ ...options, state, setState: stateSetter });
      }
      if (typeof onTypeChange === 'function') {
        onTypeChange({ ...options, state, setState: stateSetter });
      }
    });
    if (isStyleSection && styleApi) {
      styleApi.applyTypeChange(options);
    }
  };

  const resetFields = (options = {}) => {
    const state = stateGetter() || {};
    handlers.forEach(({ onReset }) => {
      if (typeof onReset === 'function') {
        onReset({ ...options, state, setState: stateSetter });
      }
    });
    if (isStyleSection && styleApi) {
      styleApi.applyTypeChange({ ...options, applyDefaults: true });
    }
  };

  applyVisibility();
  refreshFields();

  return { fieldset: shell.fieldset, applyVisibility, refreshFields, onTypeChange, resetFields };
}

function pickFieldBuilder(type, { styleApi, actionFlowController }) {
  if (type === 'select') return buildSelectField;
  if (type === 'toggle') return buildToggleField;
  if (type === 'flow') return buildFlowField;
  if (type === 'stylePreset') return styleApi ? (options) => styleApi.buildPresetField(options) : null;
  if (type === 'styleInput') return styleApi ? (options) => styleApi.buildStyleInputField(options) : null;
  if (type === 'customStyle') return styleApi ? (options) => styleApi.buildCustomStyleField(options) : null;
  if (type === 'note') return buildNoteField;
  return buildInputField;
}

function resolveLabel(field, state) {
  if (typeof field.labelForState === 'function') {
    return field.labelForState(state);
  }
  if (typeof field.label === 'function') {
    return field.label(state);
  }
  return field.label || '';
}

function resolvePlaceholder(field, state) {
  if (typeof field.placeholder === 'function') {
    return field.placeholder(state);
  }
  return typeof field.placeholder === 'string' ? field.placeholder : '';
}

function resolveOptions(field, state) {
  if (Array.isArray(field.options)) {
    return field.options;
  }
  if (typeof field.options === 'function') {
    const result = field.options(state);
    return Array.isArray(result) ? result : [];
  }
  return [];
}

function buildInputField({ field, defaultWidth, clearError, getState, setState, onChange, emitFieldChange }) {
  const input = document.createElement('input');
  input.type = 'text';
  if (typeof field.maxLength === 'number') {
    input.maxLength = field.maxLength;
  }
  styleInput(input);
  const created = createField(field.label || '', input);
  const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
  applyCardStyle(created.wrapper, minWidth);
  const stateKey = field.stateKey || field.key;
  const notifyChange = typeof onChange === 'function' ? onChange : () => {};
  const stateGetter = typeof getState === 'function' ? getState : () => ({});
  const stateSetter = typeof setState === 'function' ? setState : () => {};
  const notifyField = typeof emitFieldChange === 'function' ? emitFieldChange : () => {};

  const applyState = (state) => {
    const labelText = resolveLabel(field, state);
    if (labelText && created.label) {
      created.label.textContent = labelText;
    }
    input.placeholder = resolvePlaceholder(field, state);
    const next = stateKey ? state[stateKey] : '';
    const value = typeof next === 'string' ? next : '';
    if (input.value !== value) {
      input.value = value;
    }
    input.disabled = typeof field.disabledWhen === 'function' ? !!field.disabledWhen(state) : false;
  };

  const handleInput = (event) => {
    const value = event.target.value;
    clearError?.();
    stateSetter({ [stateKey]: value });
    if (typeof field.onChange === 'function') {
      field.onChange({ value, state: stateGetter(), setState: stateSetter });
    }
    if (stateKey) {
      notifyField(stateKey, value);
    }
    notifyChange();
  };

  input.addEventListener('input', handleInput);
  input.addEventListener('change', handleInput);

  const onTypeChange = (options) => {
    if (typeof field.onTypeChange === 'function') {
      field.onTypeChange(options);
    }
  };

  const onReset = (options) => {
    if (typeof field.onReset === 'function') {
      field.onReset(options);
    }
  };

  return { wrapper: created.wrapper, applyState, onTypeChange, onReset, focusable: input };
}

function buildSelectField({ field, defaultWidth, clearError, getState, setState, onChange, emitFieldChange }) {
  const select = document.createElement('select');
  styleInput(select);
  const created = createField(field.label || '', select);
  const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
  applyCardStyle(created.wrapper, minWidth);
  const stateKey = field.stateKey || field.key;
  const notifyChange = typeof onChange === 'function' ? onChange : () => {};
  const stateGetter = typeof getState === 'function' ? getState : () => ({});
  const stateSetter = typeof setState === 'function' ? setState : () => {};
  const notifyField = typeof emitFieldChange === 'function' ? emitFieldChange : () => {};

  const syncOptions = (state) => {
    const options = resolveOptions(field, state);
    select.innerHTML = '';
    options.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
  };

  const applyState = (state) => {
    const labelText = resolveLabel(field, state);
    if (labelText && created.label) {
      created.label.textContent = labelText;
    }
    syncOptions(state);
    const next = stateKey ? state[stateKey] : '';
    const value = typeof next === 'string' ? next : '';
    if (select.value !== value) {
      select.value = value;
    }
    select.disabled = typeof field.disabledWhen === 'function' ? !!field.disabledWhen(state) : false;
  };

  const handleChange = (event) => {
    const value = event.target.value;
    clearError?.();
    stateSetter({ [stateKey]: value });
    if (typeof field.onChange === 'function') {
      field.onChange({ value, state: stateGetter(), setState: stateSetter });
    }
    if (stateKey) {
      notifyField(stateKey, value);
    }
    notifyChange();
  };

  select.addEventListener('input', handleChange);
  select.addEventListener('change', handleChange);

  const onTypeChange = (options) => {
    if (typeof field.onTypeChange === 'function') {
      field.onTypeChange(options);
    }
  };

  const onReset = (options) => {
    if (typeof field.onReset === 'function') {
      field.onReset(options);
    }
  };

  return { wrapper: created.wrapper, applyState, onTypeChange, onReset, focusable: select };
}

function buildToggleField({ field, defaultWidth, clearError, getState, setState, onChange, emitFieldChange }) {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  Object.assign(checkbox.style, {
    width: '16px',
    height: '16px',
    margin: '0',
    cursor: 'pointer',
    borderRadius: '4px',
    border: '1px solid rgba(148, 163, 184, 0.6)',
    accentColor: '#2563eb',
  });

  const labelText = document.createElement('span');
  Object.assign(labelText.style, {
    fontSize: '13px',
    color: '#0f172a',
  });

  const row = document.createElement('label');
  Object.assign(row.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  });
  row.append(checkbox, labelText);

  const hint = document.createElement('p');
  Object.assign(hint.style, {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });

  const fieldWrapper = createField(field.label || '');
  fieldWrapper.wrapper.append(row, hint);
  const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
  applyCardStyle(fieldWrapper.wrapper, minWidth);
  const stateKey = field.stateKey || field.key;
  const notifyChange = typeof onChange === 'function' ? onChange : () => {};
  const stateGetter = typeof getState === 'function' ? getState : () => ({});
  const stateSetter = typeof setState === 'function' ? setState : () => {};
  const notifyField = typeof emitFieldChange === 'function' ? emitFieldChange : () => {};

  const applyState = (state) => {
    const labelContent = resolveLabel(field, state);
    labelText.textContent = labelContent || '';
    if (typeof field.hint === 'function') {
      hint.textContent = field.hint(state) || '';
    } else if (typeof field.hint === 'string') {
      hint.textContent = field.hint;
    }
    const value = Boolean(stateKey ? state[stateKey] : false);
    checkbox.checked = value;
    checkbox.disabled = typeof field.disabledWhen === 'function' ? !!field.disabledWhen(state) : false;
  };

  const handleChange = (event) => {
    const checked = Boolean(event.target.checked);
    clearError?.();
    stateSetter({ [stateKey]: checked });
    if (typeof field.onChange === 'function') {
      field.onChange({ value: checked, state: stateGetter(), setState: stateSetter });
    }
    if (stateKey) {
      notifyField(stateKey, checked);
    }
    notifyChange();
  };

  checkbox.addEventListener('input', handleChange);
  checkbox.addEventListener('change', handleChange);

  const onTypeChange = (options) => {
    if (typeof field.onTypeChange === 'function') {
      field.onTypeChange(options);
    }
  };

  const onReset = (options) => {
    if (typeof field.onReset === 'function') {
      field.onReset(options);
    }
  };

  return { wrapper: fieldWrapper.wrapper, applyState, onTypeChange, onReset, focusable: checkbox };
}

function buildFlowField({ field, defaultWidth, actionFlowController, getState }) {
  if (!actionFlowController) {
    return null;
  }
  const wrapper = actionFlowController.summaryField.wrapper;
  const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
  applyCardStyle(wrapper, minWidth);
  const stateGetter = typeof getState === 'function' ? getState : () => ({});

  const onTypeChange = (options) => {
    if (typeof field.onTypeChange === 'function') {
      field.onTypeChange(options);
    }
  };

  const onReset = (options) => {
    if (typeof field.onReset === 'function') {
      field.onReset(options);
    }
  };

  const applyState = (state) => {
    const snapshot = state || stateGetter() || {};
    if (typeof field.disabledWhen === 'function' && typeof actionFlowController.setDisabled === 'function') {
      actionFlowController.setDisabled(!!field.disabledWhen(snapshot));
    }
    if (typeof actionFlowController.setSummaryHint === 'function') {
      if (typeof field.summaryHint === 'function') {
        actionFlowController.setSummaryHint(field.summaryHint(snapshot));
      } else if (typeof field.summaryHint === 'string') {
        actionFlowController.setSummaryHint(field.summaryHint);
      } else {
        actionFlowController.setSummaryHint();
      }
    }
    if (typeof actionFlowController.setButtonPlacement === 'function') {
      if (typeof field.buttonPlacement === 'function') {
        actionFlowController.setButtonPlacement(field.buttonPlacement(snapshot));
      } else if (typeof field.buttonPlacement === 'string') {
        actionFlowController.setButtonPlacement(field.buttonPlacement);
      } else {
        actionFlowController.setButtonPlacement('row');
      }
    }
    if (field.builderConfig && typeof actionFlowController.setBuilderConfig === 'function') {
      const config =
        typeof field.builderConfig === 'function' ? field.builderConfig(snapshot) : { ...field.builderConfig };
      actionFlowController.setBuilderConfig(config);
    }
  };

  return { wrapper, onTypeChange, onReset, focusable: actionFlowController.openButton, applyState };
}

function buildNoteField({ field }) {
  const note = document.createElement('p');
  note.textContent = field.message || '';
  Object.assign(note.style, {
    margin: '0',
    fontSize: '11px',
    color: '#94a3b8',
    flex: '1 1 100%',
  });
  return { wrapper: note };
}

function createStyleSectionShell(legendText, summaryText = 'Advanced') {
  const { fieldset, legend, container } = createSectionShell({ legendText });
  const advancedDetails = document.createElement('details');
  advancedDetails.open = false;
  Object.assign(advancedDetails.style, {
    borderTop: '1px solid rgba(226, 232, 240, 0.6)',
    paddingTop: '8px',
  });
  const advancedSummary = document.createElement('summary');
  advancedSummary.textContent = summaryText;
  Object.assign(advancedSummary.style, {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
    marginBottom: '8px',
  });
  const advancedContainer = document.createElement('div');
  Object.assign(advancedContainer.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'stretch',
  });
  const advancedHint = document.createElement('p');
  Object.assign(advancedHint.style, {
    margin: '6px 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  advancedDetails.append(advancedSummary, advancedContainer, advancedHint);
  return { fieldset, legend, container, advancedDetails, advancedContainer, advancedHint };
}

function createStyleApi({ t, clearError, onChange }) {
  const styleFieldConfigs = buildStyleFieldConfigs(t);
  const styleState = {};
  const styleInputs = new Map();
  const notifyChange = typeof onChange === 'function' ? onChange : () => {};
  const presets = [
    { value: '', label: t('editor.styles.presets.custom'), styles: null },
    { value: 'button-default', label: t('editor.styles.presets.primary'), styles: DEFAULT_BUTTON_STYLE },
    {
      value: 'button-outline',
      label: t('editor.styles.presets.outline'),
      styles: {
        backgroundColor: 'transparent',
        color: '#2563eb',
        border: '2px solid #2563eb',
        padding: '8px 16px',
        borderRadius: '10px',
      },
    },
    {
      value: 'floating-card',
      label: t('editor.styles.presets.floating'),
      styles: {
        backgroundColor: '#ffffff',
        color: '#0f172a',
        border: '1px solid rgba(15, 23, 42, 0.12)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
        position: 'relative',
      },
    },
    { value: 'link-default', label: t('editor.styles.presets.link'), styles: DEFAULT_LINK_STYLE },
    { value: 'area-default', label: t('editor.styles.presets.area'), styles: DEFAULT_AREA_STYLE },
  ];

  styleFieldConfigs.forEach((field) => {
    const name = field.key || field.name;
    if (!name) return;
    styleState[name] = '';
  });

  let presetSelect = null;
  let customCss = null;

  const adjustableFields = new Set(
    styleFieldConfigs
      .filter((field) => field.adjustable)
      .map((field) => field.key || field.name)
      .filter(Boolean),
  );

  const applyStylesToInputs = (styles = {}) => {
    Object.entries(styles).forEach(([name, rawValue]) => {
      if (typeof rawValue !== 'string') {
        return;
      }
      const record = styleInputs.get(name);
      if (!record) {
        return;
      }
      const value = rawValue;
      styleState[name] = value;
      record.text.value = value;
      if (record.select) {
        record.select.value = value || record.select.value;
      }
      if (record.color) {
        const trimmed = value.trim();
        const fallback = record.color.dataset.defaultValue || '#ffffff';
        if (trimmed && HEX_COLOR_PATTERN.test(trimmed)) {
          record.color.value = trimmed;
          record.color.dataset.defaultValue = trimmed;
        } else {
          record.color.value = fallback;
        }
      }
    });
  };

  const resetStyleState = (source = {}, suggestions = {}) => {
    styleFieldConfigs.forEach((field) => {
      const name = field.key || field.name;
      if (!name) return;
      const value = source && typeof source[name] === 'string' ? source[name] : '';
      styleState[name] = value;
      const record = styleInputs.get(name);
      if (!record) {
        return;
      }
      record.text.value = value || '';
      if (record.select) {
        record.select.value = value || record.select.value;
      }
      const basePlaceholder = record.text.dataset.defaultPlaceholder || record.text.placeholder || '';
      if (suggestions && typeof suggestions[name] === 'string') {
        const hint = suggestions[name].trim();
        record.text.placeholder = hint || basePlaceholder;
      } else {
        record.text.placeholder = basePlaceholder;
      }
      if (record.color) {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (trimmed && HEX_COLOR_PATTERN.test(trimmed)) {
          record.color.value = trimmed;
          record.color.dataset.defaultValue = trimmed;
        } else {
          let fallback = record.color.dataset.defaultValue;
          if (!fallback || !HEX_COLOR_PATTERN.test(fallback)) {
            fallback = '#ffffff';
          }
          record.color.value = fallback;
          record.color.dataset.defaultValue = fallback;
        }
      }
    });
    if (presetSelect) {
      presetSelect.value = '';
    }
    if (customCss) {
      customCss.value = '';
    }
  };

  const mergeStyle = (partial = {}) => {
    applyStylesToInputs(partial);
  };

  const buildPresetField = ({ field, defaultWidth, clearError, onChange }) => {
    presetSelect = document.createElement('select');
    presets.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.value;
      option.textContent = preset.label;
      presetSelect.appendChild(option);
    });
    styleInput(presetSelect);
    const fieldNode = createField(field.label || '', presetSelect);
    const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
    applyCardStyle(fieldNode.wrapper, minWidth);
    const notify = typeof onChange === 'function' ? onChange : () => {};

    presetSelect.addEventListener('change', () => {
      clearError?.();
      const preset = presets.find((option) => option.value === presetSelect.value);
      if (!preset || !preset.styles) {
        notify();
        return;
      }
      styleFieldConfigs.forEach((field) => {
        const name = field.key || field.name;
        if (!name) return;
        const record = styleInputs.get(name);
        styleState[name] = '';
        if (!record) {
          return;
        }
        record.text.value = '';
        if (record.color) {
          const fallback = record.color.dataset.defaultValue || '#ffffff';
          record.color.value = fallback;
        }
      });
      applyStylesToInputs(preset.styles);
      notify();
    });

    return { wrapper: fieldNode.wrapper, select: presetSelect };
  };

  const buildStyleInputField = ({ field, defaultWidth, clearError, onChange }) => {
    const name = field.key || field.name;
    if (!name) {
      return null;
    }
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = field.placeholder || '';
    textInput.dataset.defaultPlaceholder = field.placeholder || '';
    styleInput(textInput);
    let colorInput = null;
    if (field.colorPicker) {
      colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = field.placeholder && field.placeholder.startsWith('#') ? field.placeholder : '#ffffff';
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

    const fieldNode = createField(field.label);
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    });

    if (name === 'position') {
      const positionSelect = document.createElement('select');
      POSITION_OPTIONS.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        positionSelect.appendChild(option);
      });
      styleInput(positionSelect);
      const syncPosition = (event) => {
        styleState[name] = event.target.value;
        textInput.value = event.target.value;
        notifyChange();
      };
      positionSelect.addEventListener('change', syncPosition);
      positionSelect.addEventListener('input', syncPosition);
      positionSelect.value = textInput.value || 'relative';
      inputRow.appendChild(positionSelect);
      textInput.style.display = 'none';
      textInput.dataset.linkedSelect = 'true';
      textInput.value = positionSelect.value;
      textInput.dataset.defaultPlaceholder = positionSelect.value;
    }

    inputRow.appendChild(textInput);
    if (colorInput) {
      inputRow.appendChild(colorInput);
    }

    let incBtn = null;
    let decBtn = null;
    if (adjustableFields.has(name)) {
      const makeBtn = (label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        Object.assign(btn.style, {
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          border: '1px solid rgba(148, 163, 184, 0.6)',
          background: '#ffffff',
          color: '#0f172a',
          cursor: 'pointer',
        });
        return btn;
      };
      decBtn = makeBtn('-');
      incBtn = makeBtn('+');
      inputRow.append(decBtn, incBtn);
    }

    let palette = null;
    if (field.colorPicker) {
      const colors = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#000000', '#ffffff', 'transparent'];
      palette = document.createElement('div');
      Object.assign(palette.style, {
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        marginTop: '4px',
      });
      colors.forEach((hex) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        Object.assign(swatch.style, {
          width: '18px',
          height: '18px',
          borderRadius: '6px',
          border: '1px solid rgba(148, 163, 184, 0.6)',
          background:
            hex === 'transparent'
              ? 'repeating-conic-gradient(#cbd5e1 0% 25%, #f1f5f9 0% 50%) 0 0/8px 8px'
              : hex,
          cursor: 'pointer',
        });
        swatch.dataset.value = hex;
        palette.appendChild(swatch);
      });
    }

    fieldNode.wrapper.appendChild(inputRow);
    if (palette) {
      fieldNode.wrapper.appendChild(palette);
    }
    const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
    applyCardStyle(fieldNode.wrapper, minWidth);

    styleInputs.set(name, {
      text: textInput,
      color: colorInput,
      inc: incBtn,
      dec: decBtn,
      palette,
      select: textInput.dataset.linkedSelect ? inputRow.querySelector('select') : null,
    });

    const handleChange = (value) => {
      clearError?.();
      styleState[name] = value;
      notifyChange();
    };

    const handleTextInput = (event) => {
      const value = event.target.value;
      styleState[name] = value;
      if (colorInput && HEX_COLOR_PATTERN.test(value.trim())) {
        const hex = value.trim();
        colorInput.value = hex;
        colorInput.dataset.defaultValue = hex;
      }
      handleChange(value);
    };

    textInput.addEventListener('input', handleTextInput);
    textInput.addEventListener('change', handleTextInput);

    if (colorInput) {
      const syncColor = (event) => {
        const value = event.target.value;
        styleState[name] = value;
        textInput.value = value;
        colorInput.dataset.defaultValue = value;
        handleChange(value);
      };
      colorInput.addEventListener('input', syncColor);
      colorInput.addEventListener('change', syncColor);
      if (palette) {
        palette.querySelectorAll('button').forEach((btn) => {
          btn.addEventListener('click', () => {
            const value = btn.dataset.value || '';
            styleState[name] = value;
            textInput.value = value;
            if (colorInput && HEX_COLOR_PATTERN.test(value)) {
              colorInput.value = value;
              colorInput.dataset.defaultValue = value;
            }
            handleChange(value);
          });
        });
      }
    }

    if (adjustableFields.has(name) && (incBtn || decBtn)) {
      const adjust = (delta) => {
        clearError?.();
        const current = parseInt((textInput.value || '').replace(/[^0-9-]/g, ''), 10);
        let fallback = 0;
        if (name === 'fontSize') fallback = 12;
        else if (name === 'fontWeight') fallback = 400;
        else if (name.startsWith('padding')) fallback = 12;
        const base = Number.isFinite(current) ? current : fallback;
        const next = Math.max(0, base + delta);
        const unit = name === 'fontWeight' ? '' : 'px';
        const value = `${next}${unit}`;
        styleState[name] = value;
        textInput.value = value;
        notifyChange();
      };
      incBtn?.addEventListener('click', () => adjust(+1));
      decBtn?.addEventListener('click', () => adjust(-1));
    }

    return { wrapper: fieldNode.wrapper, focusable: textInput };
  };

  const buildCustomStyleField = ({ field, defaultWidth, clearError, onChange }) => {
    customCss = document.createElement('textarea');
    customCss.placeholder = 'color: #2563eb; text-transform: uppercase;';
    Object.assign(customCss.style, {
      width: '100%',
      minHeight: '64px',
      borderRadius: '10px',
      border: '1px solid rgba(148, 163, 184, 0.6)',
      background: 'rgba(241, 245, 249, 0.6)',
      fontSize: '12px',
      color: '#0f172a',
      padding: '8px 10px',
      boxSizing: 'border-box',
    });
    const customField = createField(field.label || '', customCss);
    const minWidth = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
    applyCardStyle(customField.wrapper, minWidth);
    const notify = typeof onChange === 'function' ? onChange : () => {};

    const toCamel = (prop) => prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    customCss.addEventListener('input', () => {
      clearError?.();
      const text = customCss.value || '';
      const updates = {};
      text
        .split(';')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((decl) => {
          const idx = decl.indexOf(':');
          if (idx === -1) return;
          const key = toCamel(decl.slice(0, idx));
          const value = decl.slice(idx + 1).trim();
          if (Object.prototype.hasOwnProperty.call(styleState, key) && value) {
            updates[key] = value;
          }
        });
      Object.assign(styleState, updates);
      applyStylesToInputs(updates);
      notify();
    });

    const applyState = () => {
      customCss.value = '';
    };

    return { wrapper: customField.wrapper, textarea: customCss, applyState };
  };

  return {
    buildPresetField,
    buildStyleInputField,
    buildCustomStyleField,
    reset: resetStyleState,
    merge: mergeStyle,
    getStyle: () => ({ ...styleState }),
    getNormalizedStyle: () => normalizeStyleState(styleState, () => styleFieldConfigs),
    applyTypeChange({ applyDefaults, styleDefaults, styleSuggestions }) {
      if (applyDefaults && styleDefaults) {
        resetStyleState(styleDefaults, styleSuggestions);
      }
    },
  };
}
