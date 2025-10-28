export const DEFAULT_AREA_STYLE = {
  backgroundColor: 'rgba(37, 99, 235, 0.12)',
  border: '1px dashed rgba(37, 99, 235, 0.4)',
  color: '#0f172a',
  padding: '16px',
  borderRadius: '14px',
  width: '320px',
  minHeight: '180px',
};

export function applyAreaPreview(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.removeAttribute('style');
  element.dataset.previewType = 'area';
  element.style.display = 'block';
  element.style.minHeight = '80px';
  element.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
  element.style.border = '1px dashed rgba(37, 99, 235, 0.4)';
  element.style.borderRadius = '14px';
  element.style.color = '#0f172a';
  element.style.fontFamily = 'inherit';
  element.style.padding = '16px';
  element.style.position = 'relative';
  element.style.boxSizing = 'border-box';
  element.style.lineHeight = '1.5';
}
