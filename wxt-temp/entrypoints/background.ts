export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    const result = chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    if (result && typeof result.catch === 'function') {
      result.catch((error) => {
        console.warn('Failed to enable side panel action click', error);
      });
    }
  }
});
