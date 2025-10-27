const STYLE_SELECTOR = 'style[data-page-augmentor-tooltip-preview]';

const TOOLTIP_PREVIEW_STYLES = `
    .page-augmentor-preview-tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      cursor: help;
      font-family: inherit;
    }
    .page-augmentor-preview-tooltip[data-persistent='true'] {
      cursor: default;
    }
    .page-augmentor-preview-tooltip:focus {
      outline: none;
    }
    .page-augmentor-preview-tooltip-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 9999px;
      background-color: #2563eb;
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.18);
      user-select: none;
    }
    .page-augmentor-preview-tooltip-bubble {
      position: absolute;
      z-index: 10;
      max-width: 240px;
      min-width: max-content;
      padding: 0.45rem 0.75rem;
      border-radius: 0.75rem;
      background-color: #111827;
      color: #f8fafc;
      font-size: 0.85rem;
      line-height: 1.4;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
      opacity: 0;
      pointer-events: none;
      transform: var(--preview-tooltip-hidden-transform, translate3d(-50%, 6px, 0));
      transition: opacity 0.16s ease, transform 0.16s ease;
      white-space: pre-wrap;
    }
    .page-augmentor-preview-tooltip[data-preview-visible='true'] .page-augmentor-preview-tooltip-bubble,
    .page-augmentor-preview-tooltip[data-persistent='true'] .page-augmentor-preview-tooltip-bubble,
    .page-augmentor-preview-tooltip[data-persistent='false']:hover .page-augmentor-preview-tooltip-bubble,
    .page-augmentor-preview-tooltip[data-persistent='false']:focus-within .page-augmentor-preview-tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
      transform: var(--preview-tooltip-visible-transform, translate3d(-50%, 0, 0));
    }
    .page-augmentor-preview-tooltip[data-position='top'] .page-augmentor-preview-tooltip-bubble {
      bottom: calc(100% + 8px);
      left: 50%;
      --preview-tooltip-hidden-transform: translate3d(-50%, 6px, 0);
      --preview-tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .page-augmentor-preview-tooltip[data-position='bottom'] .page-augmentor-preview-tooltip-bubble {
      top: calc(100% + 8px);
      left: 50%;
      --preview-tooltip-hidden-transform: translate3d(-50%, -6px, 0);
      --preview-tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .page-augmentor-preview-tooltip[data-position='left'] .page-augmentor-preview-tooltip-bubble {
      right: calc(100% + 8px);
      top: 50%;
      --preview-tooltip-hidden-transform: translate3d(6px, -50%, 0);
      --preview-tooltip-visible-transform: translate3d(0, -50%, 0);
    }
    .page-augmentor-preview-tooltip[data-position='right'] .page-augmentor-preview-tooltip-bubble {
      left: calc(100% + 8px);
      top: 50%;
      --preview-tooltip-hidden-transform: translate3d(-6px, -50%, 0);
      --preview-tooltip-visible-transform: translate3d(0, -50%, 0);
    }
`;

/**
 * Ensures the tooltip preview styles are injected into the provided root.
 * @param {HTMLElement} root
 */
export function ensureTooltipPreviewStyle(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }
  if (root.querySelector(STYLE_SELECTOR)) {
    return;
  }
  const style = document.createElement('style');
  style.dataset.pageAugmentorTooltipPreview = 'true';
  style.textContent = TOOLTIP_PREVIEW_STYLES;
  root.appendChild(style);
}
