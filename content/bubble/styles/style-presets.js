export const DEFAULT_BUTTON_STYLE = {
  color: '#ffffff',
  backgroundColor: '#1b84ff',
  fontSize: '12px',
  fontWeight: '600',
  padding: '8px 16px',
  borderRadius: '8px',
};

export const DEFAULT_LINK_STYLE = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export const DEFAULT_AREA_STYLE = {
  backgroundColor: 'transparent',
  color: '#0f172a',
  padding: '16px',
  borderRadius: '14px',
  width: '320px',
  minHeight: '180px',
};

export const VALID_TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

export const DEFAULT_TOOLTIP_STYLE = {
  color: '#f8fafc',
  backgroundColor: 'rgba(17, 24, 39, 0.5)',
  fontSize: '12px',
  padding: '8px 12px',
  borderRadius: '12px',
  width: 'max-content',
};

export const STYLE_PRESETS = [
  { value: '', labelKey: 'editor.styles.presets.custom', styles: null },
  { value: 'button-default', labelKey: 'editor.styles.presets.primary', styles: DEFAULT_BUTTON_STYLE },
  {
    value: 'button-outline',
    labelKey: 'editor.styles.presets.outline',
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
    labelKey: 'editor.styles.presets.floating',
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
  { value: 'link-default', labelKey: 'editor.styles.presets.link', styles: DEFAULT_LINK_STYLE },
  { value: 'area-default', labelKey: 'editor.styles.presets.area', styles: DEFAULT_AREA_STYLE },
];

/**
 * Produces selector options for tooltip positions.
 * @param {(key: string) => string} t
 * @returns {{ value: string; label: string }[]}
 */
export function getTooltipPositionOptions(t) {
  return Array.from(VALID_TOOLTIP_POSITIONS).map((value) => ({
    value,
    label: t(`tooltip.position.${value}`),
  }));
}
