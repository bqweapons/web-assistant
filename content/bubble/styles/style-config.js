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
    { name: 'fontSize', label: t('editor.styles.fontSize'), placeholder: '16px' },
    { name: 'fontWeight', label: t('editor.styles.fontWeight'), placeholder: '600' },
    { name: 'padding', label: t('editor.styles.padding'), placeholder: '8px 16px' },
    { name: 'borderRadius', label: t('editor.styles.borderRadius'), placeholder: '8px' },
    { name: 'textDecoration', label: t('editor.styles.textDecoration'), placeholder: 'underline' },
  ];
}
