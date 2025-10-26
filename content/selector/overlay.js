const HIGHLIGHT_BORDER_COLOR = '#1b84ff';
const HIGHLIGHT_FILL_COLOR = 'rgba(27, 132, 255, 0.2)';

/**
 * Creates the overlay used to highlight hovered elements.
 * @returns {{ container: HTMLDivElement; show: (element: Element) => void; hide: () => void; dispose: () => void }}
 */
export function createOverlay() {
  const container = document.createElement('div');
  container.dataset.pageAugmentorRoot = 'picker-overlay';
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
  });

  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'absolute',
    pointerEvents: 'none',
    border: `2px solid ${HIGHLIGHT_BORDER_COLOR}`,
    backgroundColor: HIGHLIGHT_FILL_COLOR,
    borderRadius: '4px',
    transition: 'all 0.05s ease-out',
    boxSizing: 'border-box',
    opacity: '0',
  });

  container.appendChild(highlight);

  return {
    container,
    show(element) {
      const rect = element.getBoundingClientRect();
      Object.assign(highlight.style, {
        opacity: '1',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    },
    hide() {
      highlight.style.opacity = '0';
    },
    dispose() {
      container.remove();
    },
  };
}
