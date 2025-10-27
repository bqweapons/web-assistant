import { createField, styleInput } from '../ui/field.js';
import { getStyleFieldConfigs as buildStyleFieldConfigs } from '../styles/style-config.js';
import { normalizeStyleState } from '../styles/style-normalize.js';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i;

/**
 * Creates the style controls for the element bubble editor.
 * @param {{ t: import('../../common/i18n.js').TranslateFunction }} options
 * @returns {{
 *   fieldset: HTMLFieldSetElement;
 *   reset(source: Record<string, string>, suggestions?: Record<string, string>): void;
 *   attachInteractions(callbacks: {
 *     clearError: () => void;
 *     updatePreview: () => void;
 *   }): void;
 *   getStyle(): Record<string, string>;
 *   getNormalizedStyle(): Record<string, string>;
 * }}
 */
export function createStyleControls({ t }) {
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
  const styleFieldConfigs = buildStyleFieldConfigs(t);

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

  function resetStyleState(source = {}, suggestions = {}) {
    styleFieldConfigs.forEach(({ name }) => {
      const value = source && typeof source[name] === 'string' ? source[name] : '';
      styleState[name] = value;
      const record = styleInputs.get(name);
      if (!record) {
        return;
      }
      record.text.value = value || '';
      const basePlaceholder =
        record.text.dataset.defaultPlaceholder || record.text.placeholder || '';
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
  }

  function attachInteractions({ clearError, updatePreview }) {
    styleFieldConfigs.forEach(({ name }) => {
      const record = styleInputs.get(name);
      if (!record) {
        return;
      }
      record.text.addEventListener('input', (event) => {
        clearError();
        const value = event.target.value;
        styleState[name] = value;
        if (record.color && HEX_COLOR_PATTERN.test(value.trim())) {
          const hex = value.trim();
          record.color.value = hex;
          record.color.dataset.defaultValue = hex;
        }
        updatePreview();
      });
      record.text.addEventListener('change', (event) => {
        clearError();
        styleState[name] = event.target.value;
        updatePreview();
      });
      if (record.color) {
        record.color.addEventListener('input', (event) => {
          clearError();
          styleState[name] = event.target.value;
          record.text.value = event.target.value;
          record.color.dataset.defaultValue = event.target.value;
          updatePreview();
        });
        record.color.addEventListener('change', (event) => {
          clearError();
          styleState[name] = event.target.value;
          record.text.value = event.target.value;
          record.color.dataset.defaultValue = event.target.value;
          updatePreview();
        });
      }
    });
  }

  return {
    fieldset: styleFieldset,
    reset: resetStyleState,
    attachInteractions,
    getStyle() {
      return { ...styleState };
    },
    getNormalizedStyle() {
      return normalizeStyleState(styleState);
    },
  };
}
