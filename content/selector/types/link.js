export const DEFAULT_LINK_STYLE = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export function applyLinkPreview(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.removeAttribute('style');
  element.style.cursor = 'default';
  element.style.fontFamily = 'inherit';
  element.style.display = 'inline';
  element.style.color = '#2563eb';
  element.style.textDecoration = 'underline';
  element.style.padding = '0';
  element.style.lineHeight = 'inherit';
  element.style.backgroundColor = 'transparent';
}
