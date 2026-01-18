import { MessageType, type RuntimeMessage } from '../shared/messages';
import { startPicker, stopPicker } from './content/picker';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  allFrames: true,
  main() {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
      const message = rawMessage as RuntimeMessage | undefined;
      if (!message?.type || message.forwarded) {
        return;
      }
      switch (message.type) {
        case MessageType.START_PICKER: {
          const accept = message.data?.accept;
          const disallowInput = message.data?.disallowInput ?? false;
          startPicker({
            accept,
            disallowInput,
            onResult(payload) {
              runtime.sendMessage({
                type: MessageType.PICKER_RESULT,
                data: payload,
              });
            },
            onCancel() {
              runtime.sendMessage({
                type: MessageType.PICKER_CANCELLED,
                data: { reason: 'cancelled' },
              });
            },
            onInvalid(reason) {
              runtime.sendMessage({
                type: MessageType.PICKER_INVALID,
                data: { reason: reason || 'invalid-target' },
              });
            },
          });
          sendResponse?.({ ok: true });
          return true;
        }
        case MessageType.CANCEL_PICKER: {
          stopPicker();
          sendResponse?.({ ok: true });
          return true;
        }
        default:
          return;
      }
    });
  },
});
