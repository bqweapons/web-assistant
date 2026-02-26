let styleEl = null;

function ensureStyleHost() {
  if (styleEl && styleEl.parentElement) {
    return styleEl;
  }
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-page-augmentor-hidden-rules', 'true');
  document.documentElement.appendChild(styleEl);
  return styleEl;
}

/**
 * Applies hidden rules by injecting CSS selectors.
 * @param {Array<{ selector: string; enabled?: boolean }>} rules
 */
export function applyHiddenRules(rules) {
  if (!Array.isArray(rules)) {
    return;
  }
  const active = rules.filter((rule) => rule && rule.selector && rule.enabled !== false);
  if (active.length === 0) {
    if (styleEl && styleEl.parentElement) {
      styleEl.textContent = '';
    }
    return;
  }
  const host = ensureStyleHost();
  const cssLines = active.map((rule) => {
    const selector = rule.selector.trim();
    if (!selector) {
      return '';
    }
    return `${selector} { display: none !important; visibility: hidden !important; }`;
  });
  host.textContent = cssLines.filter(Boolean).join('\n');
}
