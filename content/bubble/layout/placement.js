/**
 * Attaches the bubble node to the document body.
 * @param {HTMLElement} node
 */
export function attach(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (!document.body.contains(node)) {
    document.body.appendChild(node);
  }
}

/**
 * Detaches the bubble node from the document body.
 * @param {HTMLElement} node
 */
export function detach(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (node.parentElement) {
    node.parentElement.removeChild(node);
  }
}

/**
 * Positions a bubble relative to its target and wires global listeners.
 * @param {Element | null} target
 * @param {HTMLElement} bubble
 * @param {{ offset?: number; onRequestClose?: () => void }} [options]
 * @returns {{ update(): void; dispose(): void }}
 */
export function positionRelativeTo(target, bubble, options = {}) {
  const { offset = 12, onRequestClose } = options;
  let closed = false;

  const update = () => {
    if (!target || !document.contains(target)) {
      if (!closed && typeof onRequestClose === 'function') {
        closed = true;
        onRequestClose();
      }
      return;
    }

    const rect = target.getBoundingClientRect();
    const bubbleWidth = bubble.offsetWidth || 300;
    const bubbleHeight = bubble.offsetHeight || 320;

    let top = rect.top;
    if (top + bubbleHeight + offset > window.innerHeight) {
      top = window.innerHeight - bubbleHeight - offset;
    }
    top = Math.max(offset, top);

    let left = rect.right + offset;
    left = Math.max(offset, Math.min(window.innerWidth - bubbleWidth - offset, left));

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  };

  const handleResize = () => update();
  const handleScroll = () => update();
  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!closed && typeof onRequestClose === 'function') {
        closed = true;
        onRequestClose();
      }
    }
  };

  window.addEventListener('resize', handleResize, true);
  document.addEventListener('scroll', handleScroll, true);
  document.addEventListener('keydown', handleKeydown, true);

  update();

  return {
    update,
    dispose() {
      window.removeEventListener('resize', handleResize, true);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeydown, true);
    },
  };
}
