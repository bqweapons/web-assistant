export const DEFAULT_BUTTON_STYLE = {
  color: '#ffffff',
  backgroundColor: '#1b84ff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '8px 16px',
  borderRadius: '8px',
};

/**
 * プレビュー用ボタン要素に標準スタイルを適用する。
 * Applies the default preview styling to button nodes.
 * @param {HTMLElement | null} element
 */
export function applyButtonPreview(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.removeAttribute('style');
  element.style.cursor = 'default';
  element.style.fontFamily = 'inherit';
  element.style.display = 'inline-flex';
  element.style.alignItems = 'center';
  element.style.justifyContent = 'center';
  element.style.padding = '8px 16px';
  element.style.borderRadius = '8px';
  element.style.backgroundColor = '#1b84ff';
  element.style.color = '#fff';
  element.style.fontSize = '16px';
  element.style.fontWeight = '600';
  element.style.lineHeight = '1.2';
  element.style.border = 'none';
  element.style.textDecoration = 'none';
  element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.12)';
}
