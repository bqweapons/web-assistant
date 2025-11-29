// Content script entrypoint: initializes runtime and delegates to feature modules
import * as selectorModule from '../selector.js';
import { initRuntime, runtime } from './context.js';
import { getPageContext } from './page-url.js';
import { hydrateElements } from './hydration.js';
import { setupMessageBridge } from './messages.js';
import { setupMutationWatcher } from './mutation-watcher.js';
import { setupAutosave } from './autosave.js';

function setupSpaNavigationWatcher(onChange) {
  if (typeof onChange !== 'function') {
    return;
  }
  const fire = () => {
    try {
      onChange();
    } catch (error) {
      // ignore listener errors to avoid breaking host page
    }
  };
  window.addEventListener('popstate', fire);
  window.addEventListener('hashchange', fire);
  try {
    const { pushState, replaceState } = window.history || {};
    if (typeof pushState === 'function') {
      window.history.pushState = function patchedPushState(...args) {
        const result = pushState.apply(this, args);
        fire();
        return result;
      };
    }
    if (typeof replaceState === 'function') {
      window.history.replaceState = function patchedReplaceState(...args) {
        const result = replaceState.apply(this, args);
        fire();
        return result;
      };
    }
  } catch (_error) {
    // ignore history patch failures
  }
}

(async () => {
  if (window.__pageAugmentorInitialized) {
    return;
  }
  window.__pageAugmentorInitialized = true;

  const frameContext = selectorModule.resolveFrameContext(window);
  const { siteKey, pageKey } = getPageContext();
  const resolvedSiteKey = frameContext.pageUrl || siteKey;
  const resolvedPageKey = pageKey;
  initRuntime({ frameContext, siteKey: resolvedSiteKey, pageKey: resolvedPageKey, pageUrl: resolvedSiteKey });

  await hydrateElements();
  setupSpaNavigationWatcher(async () => {
    const next = getPageContext();
    const nextSiteKey = frameContext.pageUrl || next.siteKey;
    const nextPageKey = next.pageKey;
    if (nextSiteKey === runtime.siteKey && nextPageKey === runtime.pageKey) {
      return;
    }
    initRuntime({ frameContext, siteKey: nextSiteKey, pageKey: nextPageKey, pageUrl: nextSiteKey });
    await hydrateElements();
  });
  setupMessageBridge();
  setupMutationWatcher();
  setupAutosave();
})();

