import * as injectModule from '../inject.js';
import { sendMessage, MessageType } from '../common/messaging.js';
import { runtime, state } from './context.js';
import { elementMatchesFrame } from './frame.js';

export async function hydrateElements() {
  try {
    const elements = await sendMessage(MessageType.LIST_BY_URL, { pageUrl: runtime.siteKey || runtime.pageUrl });
    synchronizeElements(elements);
  } catch (error) {
    console.error('[Ladybrid] Failed to hydrate elements', error);
  }
}

function matchesPageScope(element, pageKey, siteKey) {
  if (!element) {
    return false;
  }
  const scope = typeof element.pageUrl === 'string' ? element.pageUrl : '';
  if (!scope) {
    return true; // treat empty as site-wide
  }
  if (siteKey && scope === siteKey) {
    return true;
  }
  return Boolean(pageKey && scope === pageKey);
}

/**
 * Synchronizes the injected DOM with the provided list.
 * @param {import('../common/types.js').InjectedElement[]} list
 */
export function synchronizeElements(list) {
  if (!Array.isArray(list)) {
    return;
  }
  const sorted = [...list].sort((a, b) => {
    const rank = (value) => {
      if (!value || typeof value !== 'object') {
        return 2;
      }
      if (value.type === 'area') {
        return 0;
      }
      if (typeof value.containerId === 'string' && value.containerId) {
        return 1;
      }
      return 2;
    };
    const diff = rank(a) - rank(b);
    return diff === 0 ? 0 : diff;
  });
  const incomingIds = new Set();
  sorted.forEach((element) => {
    if (elementMatchesFrame(element) && matchesPageScope(element, runtime.pageKey, runtime.siteKey)) {
      incomingIds.add(element.id);
      injectModule.ensureElement(element);
    }
  });
  injectModule.listElements().forEach((existing) => {
    if (
      matchesPageScope(existing, runtime.pageKey, runtime.siteKey) &&
      elementMatchesFrame(existing) &&
      !incomingIds.has(existing.id)
    ) {
      if (state.creationElementId && existing.id === state.creationElementId) {
        return;
      }
      injectModule.removeElement(existing.id);
    }
  });
}

