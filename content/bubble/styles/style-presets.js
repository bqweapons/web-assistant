export const DEFAULT_BUTTON_STYLE = {
  color: '#ffffff',
  backgroundColor: '#1b84ff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '8px 16px',
  borderRadius: '8px',
};

export const DEFAULT_LINK_STYLE = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export const DEFAULT_AREA_STYLE = {
  backgroundColor: 'rgba(37, 99, 235, 0.12)',
  color: '#0f172a',
  padding: '16px',
  borderRadius: '14px',
  width: '320px',
  minHeight: '180px',
};

export const VALID_TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

export const DEFAULT_TOOLTIP_STYLE = {
  color: '#f8fafc',
  backgroundColor: '#111827',
  fontSize: '14px',
  padding: '8px 12px',
  borderRadius: '12px',
};

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

