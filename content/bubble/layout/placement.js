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
  const { offset = 12, onRequestClose, getPreferredSide } = options;
  let closed = false;

  const update = () => {
    if (!target || !target.isConnected) {
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

    const minLeft = offset;
    const maxLeft = window.innerWidth - bubbleWidth - offset;
    const requestedSide =
      typeof getPreferredSide === 'function' ? getPreferredSide() : bubble.dataset.pageAugmentorPlacement || 'right';
    const preferredSide = requestedSide === 'left' ? 'left' : 'right';
    const leftCandidate = rect.left - bubbleWidth - offset;
    const rightCandidate = rect.right + offset;
    const fitsLeft = leftCandidate >= minLeft;
    const fitsRight = rightCandidate <= maxLeft;

    let resolvedSide = preferredSide;
    if (resolvedSide === 'left' && !fitsLeft && fitsRight) {
      resolvedSide = 'right';
    } else if (resolvedSide === 'right' && !fitsRight && fitsLeft) {
      resolvedSide = 'left';
    }

    let left = resolvedSide === 'left' ? leftCandidate : rightCandidate;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    bubble.dataset.pageAugmentorPlacement = resolvedSide;
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
