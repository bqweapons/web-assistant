/**
 * Builds the field configuration list for style inputs.
 * @param {(key: string, params?: Record<string, any>) => string} t
 * @returns {Array<{ name: string; label: string; placeholder: string; colorPicker?: boolean }>}
 */
export const DEFAULT_STYLE_ITEM_MIN_WIDTH = 260;

export function getStyleFieldConfigs(t) {
  return [
    { name: 'color', label: t('editor.styles.color'), placeholder: '#2563eb', colorPicker: true, group: 'basic' },
    {
      name: 'backgroundColor',
      label: t('editor.styles.backgroundColor'),
      placeholder: '#1b84ff',
      colorPicker: true,
      group: 'basic',
    },
    { name: 'position', label: t('editor.styles.position'), placeholder: 'relative', minWidth: 200, group: 'advanced' },
    { name: 'top', label: t('editor.styles.top'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'left', label: t('editor.styles.left'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'right', label: t('editor.styles.right'), placeholder: '', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'bottom', label: t('editor.styles.bottom'), placeholder: '', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'zIndex', label: t('editor.styles.zIndex'), placeholder: '1000', minWidth: 220, group: 'advanced' },
    { name: 'width', label: t('editor.styles.width'), placeholder: '260px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'height', label: t('editor.styles.height'), placeholder: '120px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'fontWeight', label: t('editor.styles.fontWeight'), placeholder: '600', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'paddingTop', label: t('editor.styles.paddingTop'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'paddingRight', label: t('editor.styles.paddingRight'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'paddingBottom', label: t('editor.styles.paddingBottom'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'paddingLeft', label: t('editor.styles.paddingLeft'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { name: 'fontSize', label: t('editor.styles.fontSize'), placeholder: '12px', minWidth: 220, group: 'basic', adjustable: true },
    { name: 'boxShadow', label: t('editor.styles.boxShadow'), placeholder: '0 12px 32px rgba(15, 23, 42, 0.18)', minWidth: 220, group: 'advanced' },
    { name: 'border', label: t('editor.styles.border'), placeholder: '1px solid rgba(148, 163, 184, 0.4)', minWidth: 220, group: 'advanced' },
    { name: 'borderRadius', label: t('editor.styles.borderRadius'), placeholder: '8px', minWidth: 220, group: 'advanced' },
  ];
}
