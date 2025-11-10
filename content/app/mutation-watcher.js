import * as injectModule from '../inject.js';

export function setupMutationWatcher() {
  let timeoutId = 0;
  const observer = new MutationObserver(() => {
    if (timeoutId) {
      return;
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = 0;
      injectModule.reconcileElements();
    }, 300);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

