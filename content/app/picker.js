import { sendMessage, MessageType } from '../common/messaging.js';
import * as selectorModule from '../selector.js';
import { state, runtime } from './context.js';
import { closeEditorBubble } from './editor.js';
import { describeElement } from './describe.js';

export function beginPicker(options = {}) {
  stopPicker();
  closeEditorBubble();
  document.body.style.cursor = 'crosshair';
  state.pickerSession = selectorModule.startElementPicker({
    mode: options.mode || 'create',
    onTarget(target, selector) {
      const metadata = selectorModule.resolveFrameContext(target.ownerDocument?.defaultView || window);
      sendMessage(MessageType.PICKER_RESULT, {
        pageUrl: runtime.pageUrl,
        selector,
        frameSelectors: metadata.frameSelectors,
        frameLabel: metadata.frameLabel,
        frameUrl: metadata.frameUrl,
        preview: describeElement(target),
      }).catch((error) => console.error('[PageAugmentor] Failed to send picker result', error));
    },
    onSubmit(payload) {
      stopPicker();
      const elementPayload = {
        ...payload,
        pageUrl: runtime.pageUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sendMessage(MessageType.CREATE, elementPayload).catch((error) =>
        console.error('[PageAugmentor] Failed to save new element', error),
      );
    },
    onCancel() {
      stopPicker();
      sendMessage(MessageType.PICKER_CANCELLED, { pageUrl: runtime.pageUrl }).catch((error) =>
        console.error('[PageAugmentor] Failed to report picker cancel', error),
      );
    },
  });
}

export function stopPicker() {
  if (state.pickerSession) {
    try {
      state.pickerSession.stop();
    } catch (error) {
      console.warn('[PageAugmentor] Failed to stop picker cleanly', error);
    }
    state.pickerSession = null;
  }
  document.body.style.cursor = '';
}

