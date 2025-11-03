import { createOverlay } from './overlay.js';
import { getElementBubble, getSuggestedStyles } from './bubble.js';
import { generateSelector, resolveTarget } from './utils.js';
import { resolveFrameContext } from './frame.js';

/**
 * Starts the interactive element picker.
 * @param {{
 *   mode?: 'create' | 'edit';
 *   onSubmit?: (result: import('../../common/types.js').InjectedElement) => void;
 *   onCancel?: () => void;
 *   onTarget?: (element: Element, selector: string) => void;
 *   defaults?: Record<string, unknown>;
 *   filter?: (element: Element) => boolean;
 * }} [options]
 * @returns {{ stop: () => void }}
 */
export function startElementPicker(options = {}) {
  const { mode = 'create', onSubmit, onCancel, onTarget, defaults = {}, filter } = options;
  const overlay = createOverlay();
  document.body.appendChild(overlay.container);
  const bubble = getElementBubble();

  let disposed = false;

  const handleMouseMove = (event) => {
    const hovered = resolveTarget(event.target);
    if (!hovered || (filter && !filter(hovered))) {
      overlay.hide();
      return;
    }
    overlay.show(hovered);
  };

  const handleClick = (event) => {
    const target = resolveTarget(event.target);
    if (!target || (filter && !filter(target))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selector = generateSelector(target);
    overlay.show(target);
    removeListeners();
    const suggestedStyle = getSuggestedStyles(target);
    bubble.open({
      mode,
      selector,
      target,
      values: defaults,
      suggestedStyle,
      onSubmit(result) {
        dispose();
        const frameMetadata = resolveFrameContext(target.ownerDocument?.defaultView || window);
        onSubmit?.({
          ...result,
          selector,
          frameSelectors: frameMetadata.frameSelectors,
          frameLabel: frameMetadata.frameLabel,
          frameUrl: frameMetadata.frameUrl,
        });
      },
      onCancel() {
        dispose('cancel');
      },
    });
    onTarget?.(target, selector);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dispose('cancel');
    }
  };

  const removeListeners = () => {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  };

  const dispose = (reason) => {
    if (disposed) {
      return;
    }
    disposed = true;
    removeListeners();
    bubble.close();
    overlay.dispose();
    if (reason === 'cancel') {
      onCancel?.();
    }
  };

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  return {
    stop() {
      dispose();
    },
  };
}
