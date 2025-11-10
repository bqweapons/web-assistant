import * as injectModule from '../inject.js';
import { sendMessage, MessageType } from '../common/messaging.js';
import { state, dirtyIds, runtime } from './context.js';

export function setupAutosave() {
  // Persist drag/placement changes even when the editor bubble isn't open
  window.addEventListener('page-augmentor-draft-update', (event) => {
    try {
      const detail = (event && event.detail) || {};
      const elementId = typeof detail.elementId === 'string' ? detail.elementId : null;
      if (!elementId) return;
      // Skip autosave for unsaved creation drafts; the Save action will persist
      if (state.creationElementId && state.creationElementId === elementId) return;
      // Only persist when there's a real change vs. current element
      const base = injectModule.getElement(elementId);
      if (!base) return;
      const baseStyle = base.style || {};
      const stylePatch = detail && typeof detail.style === 'object' ? detail.style : null;
      const changedStyle = Boolean(
        stylePatch && (
          (Object.prototype.hasOwnProperty.call(stylePatch, 'left') && String(stylePatch.left || '').trim() !== String(baseStyle.left || '').trim()) ||
          (Object.prototype.hasOwnProperty.call(stylePatch, 'top') && String(stylePatch.top || '').trim() !== String(baseStyle.top || '').trim()) ||
          (Object.prototype.hasOwnProperty.call(stylePatch, 'position') && String(stylePatch.position || '').trim() !== String(baseStyle.position || '').trim()) ||
          (Object.prototype.hasOwnProperty.call(stylePatch, 'zIndex') && String(stylePatch.zIndex || '').trim() !== String(baseStyle.zIndex || '').trim()) ||
          (Object.prototype.hasOwnProperty.call(stylePatch, 'width') && String(stylePatch.width || '').trim() !== String(baseStyle.width || '').trim()) ||
          (Object.prototype.hasOwnProperty.call(stylePatch, 'height') && String(stylePatch.height || '').trim() !== String(baseStyle.height || '').trim())
        ),
      );
      const changedContainer = Object.prototype.hasOwnProperty.call(detail || {}, 'containerId') && ((detail.containerId || '') !== (base.containerId || ''));
      const changedFloating = Object.prototype.hasOwnProperty.call(detail || {}, 'floating') && Boolean(detail.floating) !== Boolean(base.floating !== false);
      const changedSelector = Object.prototype.hasOwnProperty.call(detail || {}, 'selector') && detail.selector !== base.selector;
      const changedPosition = Object.prototype.hasOwnProperty.call(detail || {}, 'position') && detail.position !== base.position;
      const changedText = Object.prototype.hasOwnProperty.call(detail || {}, 'text') && (typeof detail.text === 'string' ? detail.text : '') !== (typeof base.text === 'string' ? base.text : '');
      const hasMeaningfulMutation = changedStyle || changedContainer || changedFloating || changedSelector || changedPosition || changedText;
      if (!hasMeaningfulMutation) return;

      const merged = { ...base };
      if (detail && typeof detail.style === 'object') {
        merged.style = { ...(base.style || {}), ...detail.style };
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'containerId')) {
        merged.containerId = typeof detail.containerId === 'string' ? detail.containerId : '';
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'floating')) {
        merged.floating = Boolean(detail.floating);
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'selector')) {
        merged.selector = detail.selector;
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'position')) {
        merged.position = detail.position;
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'text')) {
        merged.text = typeof detail.text === 'string' ? detail.text : merged.text;
      }

      const payload = {
        ...merged,
        id: elementId,
        pageUrl: runtime.pageUrl,
        updatedAt: Date.now(),
      };
      // Update local registry immediately to avoid visual snap-back before background roundtrip
      try {
        injectModule.updateElement(payload);
      } catch (_e) {}
      sendMessage(MessageType.UPDATE, payload).catch(() => {});
      try { dirtyIds.add(elementId); } catch (_e) {}
    } catch (_e) {
      // ignore autosave failures in drag handler
    }
  });
}

