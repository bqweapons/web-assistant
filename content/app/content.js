// Content script entrypoint: initializes runtime and delegates to feature modules
import * as selectorModule from '../selector.js';
import { initRuntime } from './context.js';
import { getPageUrl } from './page-url.js';
import { hydrateElements } from './hydration.js';
import { setupMessageBridge } from './messages.js';
import { setupMutationWatcher } from './mutation-watcher.js';
import { setupAutosave } from './autosave.js';

(async () => {
  if (window.__pageAugmentorInitialized) {
    return;
  }
  window.__pageAugmentorInitialized = true;

  const frameContext = selectorModule.resolveFrameContext(window);
  const pageUrl = frameContext.pageUrl || getPageUrl();
  initRuntime({ frameContext, pageUrl });

  await hydrateElements();
  setupMessageBridge();
  setupMutationWatcher();
  setupAutosave();
})();

