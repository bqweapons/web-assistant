import { sendMessage, MessageType } from '../common/messaging.js';
import * as selectorModule from '../selector.js';
import { state, runtime, refreshPageContextFromLocation } from './context.js';
import { closeEditorBubble } from './editor.js';
import { describeElement } from './describe.js';

export function beginPicker(options = {}) {
  stopPicker();
  closeEditorBubble();
  refreshPageContextFromLocation();
  document.body.style.cursor = 'crosshair';
  const selectionOnly =
    options.mode === 'select' || options.source === 'flow-drawer' || options.accept === 'selector' || options.accept === 'input';
  const mode = selectionOnly ? 'select' : options.mode || 'create';
  state.pickerSession = selectorModule.startElementPicker({
    mode,
    onTarget(target, selector) {
      const metadata = selectorModule.resolveFrameContext(target.ownerDocument?.defaultView || window);
      sendMessage(MessageType.PICKER_RESULT, {
        pageUrl: runtime.pageUrl,
        siteUrl: runtime.siteKey || runtime.pageUrl,
        selector,
        frameSelectors: metadata.frameSelectors,
        frameLabel: metadata.frameLabel,
        frameUrl: metadata.frameUrl,
        preview: describeElement(target),
      })
        .catch((error) => console.error('[Ladybrid] Failed to send picker result', error))
        .finally(() => {
          if (selectionOnly) {
            stopPicker();
          }
        });
    },
    onSubmit(payload) {
      // Flow drawer only needs the selector; do not create elements.
      if (selectionOnly) {
        return;
      }
      stopPicker();
      const scope = options.scope === 'site' ? 'site' : 'page';
      const elementPayload = {
        ...payload,
        siteUrl: runtime.siteKey || runtime.pageUrl,
        pageUrl: scope === 'site' ? runtime.siteKey || runtime.pageUrl : runtime.pageKey || runtime.pageUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sendMessage(MessageType.CREATE, elementPayload).catch((error) =>
        console.error('[Ladybrid] Failed to save new element', error),
      );
    },
    onCancel() {
      stopPicker();
      sendMessage(MessageType.PICKER_CANCELLED, { pageUrl: runtime.pageUrl }).catch((error) =>
        console.error('[Ladybrid] Failed to report picker cancel', error),
      );
    },
  });
}

export function stopPicker() {
  if (state.pickerSession) {
    try {
      state.pickerSession.stop();
    } catch (error) {
      console.warn('[Ladybrid] Failed to stop picker cleanly', error);
    }
    state.pickerSession = null;
  }
  document.body.style.cursor = '';
}
