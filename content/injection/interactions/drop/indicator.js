let domDropIndicator = null;

function ensureDomDropIndicator() {
  if (domDropIndicator && domDropIndicator.isConnected) {
    return domDropIndicator;
  }
  const indicator = document.createElement('div');
  indicator.dataset.pageAugmentorRoot = 'drop-indicator';
  Object.assign(indicator.style, {
    position: 'fixed',
    zIndex: '2147482001',
    pointerEvents: 'none',
    borderRadius: '10px',
    border: '2px dashed rgba(37, 99, 235, 0.55)',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    boxSizing: 'border-box',
    display: 'none',
    transition: 'none',
  });
  document.body.appendChild(indicator);
  domDropIndicator = indicator;
  return indicator;
}

export function showDomDropIndicator(indicator) {
  if (!indicator) {
    hideDomDropIndicator();
    return;
  }
  const node = ensureDomDropIndicator();
  if (!node.isConnected) {
    document.body.appendChild(node);
  }
  const { top, left, width, height, mode } = indicator;
  const safeTop = Number.isFinite(top) ? Math.max(0, top) : 0;
  const safeLeft = Number.isFinite(left) ? Math.max(0, left) : 0;
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const minHeight = mode === 'line' ? 2 : 4;
  const safeHeight = Number.isFinite(height) ? Math.max(minHeight, height) : minHeight;
  node.style.display = 'block';
  node.style.left = `${Math.round(safeLeft)}px`;
  node.style.top = `${Math.round(safeTop)}px`;
  node.style.width = `${Math.round(safeWidth)}px`;
  node.style.height = `${Math.round(safeHeight)}px`;
  if (mode === 'line') {
    node.style.border = 'none';
    node.style.borderRadius = '9999px';
    node.style.backgroundColor = 'rgba(37, 99, 235, 0.8)';
  } else {
    node.style.border = '2px dashed rgba(37, 99, 235, 0.55)';
    node.style.borderRadius = '12px';
    node.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
  }
}

export function hideDomDropIndicator() {
  if (domDropIndicator) {
    domDropIndicator.style.display = 'none';
  }
}



