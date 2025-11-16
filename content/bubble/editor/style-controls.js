import { createField, styleInput } from '../ui/field.js';
import { getStyleFieldConfigs as buildStyleFieldConfigs } from '../styles/style-config.js';
import { normalizeStyleState } from '../styles/style-normalize.js';
import {
  DEFAULT_BUTTON_STYLE,
  DEFAULT_LINK_STYLE,
  DEFAULT_AREA_STYLE,
} from '../styles/style-presets.js';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i;
const ADVANCED_FIELDS = new Set(['position', 'top', 'right', 'bottom', 'left', 'zIndex', 'boxShadow']);

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
  const stylePresets = [
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

  styleFieldConfigs.forEach(({ name }) => {
    styleState[name] = '';
  });

  const presetSelect = document.createElement('select');
  stylePresets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.value;
    option.textContent = preset.label;
    presetSelect.appendChild(option);
  });
  styleInput(presetSelect);

  const presetField = createField(t('editor.styles.presetsLabel'), presetSelect);
  styleFieldset.appendChild(presetField.wrapper);

  const basicContainer = document.createElement('div');
  Object.assign(basicContainer.style, {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  });
  styleFieldset.appendChild(basicContainer);

  const advancedDetails = document.createElement('details');
  advancedDetails.open = false;
  Object.assign(advancedDetails.style, {
    borderTop: '1px solid rgba(226, 232, 240, 0.6)',
    paddingTop: '8px',
  });
  const advancedSummary = document.createElement('summary');
  advancedSummary.textContent = t('editor.stylesAdvancedToggle');
  Object.assign(advancedSummary.style, {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
    marginBottom: '8px',
  });
  advancedDetails.appendChild(advancedSummary);
  const advancedContainer = document.createElement('div');
  Object.assign(advancedContainer.style, {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  });
  advancedDetails.appendChild(advancedContainer);

  const advancedHint = document.createElement('p');
  advancedHint.textContent = t('editor.stylesAdvancedHint');
  Object.assign(advancedHint.style, {
    margin: '6px 0 0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  advancedDetails.appendChild(advancedHint);
  styleFieldset.appendChild(advancedDetails);

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

    // Font size quick adjust buttons
    let incBtn = null;
    let decBtn = null;
    if (config.name === 'fontSize') {
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
      decBtn = makeBtn('−');
      incBtn = makeBtn('+');
      inputRow.append(decBtn, incBtn);
    }

    // Color palette swatches for color fields
    let palette = null;
    if (config.colorPicker) {
      const colors = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#000000', '#ffffff'];
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
          background: hex,
          cursor: 'pointer',
        });
        swatch.dataset.value = hex;
        palette.appendChild(swatch);
      });
    }
    field.wrapper.appendChild(inputRow);
    if (palette) {
      field.wrapper.appendChild(palette);
    }
    if (ADVANCED_FIELDS.has(config.name)) {
      advancedContainer.appendChild(field.wrapper);
    } else {
      basicContainer.appendChild(field.wrapper);
    }
    styleInputs.set(config.name, { text: textInput, color: colorInput, inc: incBtn, dec: decBtn, palette });
  });

  // Custom CSS textarea in Advanced
  const customCss = document.createElement('textarea');
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
  const customCssField = createField(t('editor.styles.customCss'), customCss);
  advancedContainer.appendChild(customCssField.wrapper);

  const styleHint = document.createElement('p');
  styleHint.textContent = t('editor.stylesHint');
  Object.assign(styleHint.style, {
    margin: '0',
    fontSize: '11px',
    color: '#94a3b8',
  });
  styleFieldset.appendChild(styleHint);

  function applyStylesToInputs(styles = {}) {
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
  }

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
    presetSelect.value = '';
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
        if (record.palette) {
          record.palette.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
              clearError();
              const value = btn.dataset.value || '';
              styleState[name] = value;
              record.text.value = value;
              if (record.color) {
                record.color.value = value;
                record.color.dataset.defaultValue = value;
              }
              updatePreview();
            });
          });
        }
      }

      if (name === 'fontSize' && (record.inc || record.dec)) {
        const adjust = (delta) => {
          clearError();
          const current = parseInt((record.text.value || '').replace(/[^0-9-]/g, ''), 10);
          const base = Number.isFinite(current) ? current : 16;
          const next = Math.max(8, base + delta);
          const value = `${next}px`;
          styleState[name] = value;
          record.text.value = value;
          updatePreview();
        };
        record.inc?.addEventListener('click', () => adjust(+1));
        record.dec?.addEventListener('click', () => adjust(-1));
      }
    });

    presetSelect.addEventListener('change', () => {
      clearError();
      const preset = stylePresets.find((option) => option.value === presetSelect.value);
      if (!preset || !preset.styles) {
        return;
      }
      styleFieldConfigs.forEach(({ name }) => {
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
      updatePreview();
    });

    // Parse and apply custom CSS declarations
    const toCamel = (prop) => prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    customCss.addEventListener('input', () => {
      clearError();
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
      updatePreview();
    });
  }

  return {
    fieldset: styleFieldset,
    reset: resetStyleState,
    merge(partial = {}) {
      applyStylesToInputs(partial);
    },
    attachInteractions,
    getStyle() {
      return { ...styleState };
    },
    getNormalizedStyle() {
      return normalizeStyleState(styleState, () => styleFieldConfigs);
    },
  };
}
