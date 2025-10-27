/**
 * フォーカス中ウィンドウでアクティブなタブを取得するユーティリティ。
 * Retrieves the currently active tab in the focused window.
 * @returns {Promise<chrome.tabs.Tab | undefined>}
 */
export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * サイドパネル API が利用可能かどうかを判定する。
 * Indicates whether the side panel API is available.
 * @returns {boolean}
 */
export function supportsSidePanel() {
  return Boolean(chrome.sidePanel?.open);
}

/**
 * サイドパネルが利用可能なら開き、不可なら新規タブを開くフォールバック処理。
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
