/* eslint-disable no-undef */
import { runtime } from './context.js';
import { beginPicker } from './picker.js';
import { beginCreationSession } from './creation.js';
import { stopPicker } from './picker.js';
import { openEditorBubble } from './editor.js';
import { applyEditingMode } from './editing-mode.js';
import { matchesFrameSelectors, elementMatchesFrame } from './frame.js';
import { synchronizeElements } from './hydration.js';
import * as injectModule from '../inject.js';
import { MessageType } from '../common/messaging.js';

export function setupMessageBridge() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }
    if (message.pageUrl && message.pageUrl !== runtime.pageUrl) {
      return;
    }
    switch (message.type) {
      case MessageType.REHYDRATE: {
        synchronizeElements(message.data || []);
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.UPDATE: {
        if (message.data && elementMatchesFrame(message.data)) {
          injectModule.updateElement(message.data);
        } else if (message.data?.id) {
          const existing = injectModule.getElement(message.data.id);
          if (existing && elementMatchesFrame(existing)) {
            injectModule.updateElement({ ...existing, ...message.data });
          }
        }
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.DELETE: {
        if (message.data?.id) {
          if (elementMatchesFrame(message.data)) {
            injectModule.removeElement(message.data.id);
          } else {
            const existing = injectModule.getElement(message.data.id);
            if (existing && elementMatchesFrame(existing)) {
              injectModule.removeElement(message.data.id);
            }
          }
        }
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.FOCUS_ELEMENT: {
        if (message.data?.id && matchesFrameSelectors(message.data.frameSelectors)) {
          const success = injectModule.focusElement(message.data.id);
          sendResponse?.({ ok: success });
        }
        break;
      }
      case MessageType.START_PICKER: {
        beginPicker(message.data || {});
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.INIT_CREATE: {
        beginCreationSession(message.data || {});
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.CANCEL_PICKER: {
        stopPicker();
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.OPEN_EDITOR: {
        if (message.data?.id && matchesFrameSelectors(message.data.frameSelectors)) {
          const opened = openEditorBubble(message.data.id);
          sendResponse?.({ ok: opened });
        }
        break;
      }
      case MessageType.SET_EDIT_MODE: {
        applyEditingMode(Boolean(message.data?.enabled));
        sendResponse?.({ ok: true });
        break;
      }
      default:
        break;
    }
    return true;
  });
}
