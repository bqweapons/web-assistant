/**
 * Applies a unified card style with fluid width and consistent spacing.
 * @param {HTMLElement} node
 * @param {number} [minWidth=220]
 */
export function applyCardStyle(node, minWidth = 220) {
  if (!(node instanceof HTMLElement)) return;
  Object.assign(node.style, {
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderRadius: '12px',
    padding: '4px 12px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: `1 1 ${minWidth}px`,
    minWidth: `${minWidth}px`,
  });
}
