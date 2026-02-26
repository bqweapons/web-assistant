const TARGET_HIGHLIGHT_CLASS = 'page-augmentor-target-highlight';

function ensureTargetHighlightStyles() {
  if (document.getElementById('page-augmentor-target-highlight-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'page-augmentor-target-highlight-style';
  style.textContent = `
      .${TARGET_HIGHLIGHT_CLASS} {
        outline: 2px solid rgba(37, 99, 235, 0.55) !important;
        outline-offset: 2px !important;
        transition: outline-color 0.2s ease;
      }
    `;
  document.head?.appendChild(style);
}

export function highlightPlacementTarget(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  ensureTargetHighlightStyles();
  element.classList.add(TARGET_HIGHLIGHT_CLASS);
  window.setTimeout(() => {
    try {
      element.classList.remove(TARGET_HIGHLIGHT_CLASS);
    } catch (_error) {
      // Element may have been removed; ignore cleanup failures
    }
  }, 1200);
}

