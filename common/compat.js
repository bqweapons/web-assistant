/**
 * Retrieves the currently active tab in the focused window.
 * @returns {Promise<chrome.tabs.Tab | undefined>}
 */
export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Indicates whether the side panel API is available.
 * @returns {boolean}
 */
export function supportsSidePanel() {
  return Boolean(chrome.sidePanel?.open);
}

/**
 * Opens the extension's side panel if available, otherwise falls back to a tab.
 * @returns {Promise<void>}
 */
export async function openSidePanelOrTab() {
  if (supportsSidePanel()) {
    const tab = await getActiveTab();
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      await chrome.sidePanel.setOptions({
        windowId: tab.windowId,
        path: 'sidepanel/sidepanel.html',
      });
      return;
    }
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html') });
}
