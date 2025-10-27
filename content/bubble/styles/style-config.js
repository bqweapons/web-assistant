/**
 * Builds the field configuration list for style inputs.
 * @param {(key: string, params?: Record<string, any>) => string} t
 * @returns {Array<{ name: string; label: string; placeholder: string; colorPicker?: boolean }>}
 */
export function getStyleFieldConfigs(t) {
  return [
    { name: 'color', label: t('editor.styles.color'), placeholder: '#2563eb', colorPicker: true },
    {
      name: 'backgroundColor',
      label: t('editor.styles.backgroundColor'),
      placeholder: '#1b84ff',
      colorPicker: true,
    },
    { name: 'position', label: t('editor.styles.position'), placeholder: 'relative' },
    { name: 'top', label: t('editor.styles.top'), placeholder: '12px' },
    { name: 'left', label: t('editor.styles.left'), placeholder: '12px' },
    { name: 'right', label: t('editor.styles.right'), placeholder: '' },
    { name: 'bottom', label: t('editor.styles.bottom'), placeholder: '' },
    { name: 'zIndex', label: t('editor.styles.zIndex'), placeholder: '1000' },
    { name: 'width', label: t('editor.styles.width'), placeholder: '260px' },
    { name: 'height', label: t('editor.styles.height'), placeholder: '120px' },
    { name: 'boxShadow', label: t('editor.styles.boxShadow'), placeholder: '0 12px 32px rgba(15, 23, 42, 0.18)' },
    { name: 'fontSize', label: t('editor.styles.fontSize'), placeholder: '16px' },
    { name: 'fontWeight', label: t('editor.styles.fontWeight'), placeholder: '600' },
    { name: 'padding', label: t('editor.styles.padding'), placeholder: '8px 16px' },
    { name: 'border', label: t('editor.styles.border'), placeholder: '1px solid rgba(148, 163, 184, 0.4)' },
    { name: 'borderRadius', label: t('editor.styles.borderRadius'), placeholder: '8px' },
  ];
}
