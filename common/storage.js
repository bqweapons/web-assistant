// 注入要素の永続化と監視を扱うストレージユーティリティ。
const STORAGE_KEY = 'injectedElements';

/**
 * 注入要素メタデータを保持するストレージ領域を返す。
 * Returns the storage area that holds the injected element metadata.
 * @returns {chrome.storage.StorageArea}
 */
function storageArea() {
  return chrome.storage.local;
}

/**
 * 永続化済みデータ全体を読み込む。
 * Reads the entire persisted payload.
 * @returns {Promise<Record<string, import('./types.js').InjectedElement[]>>}
 */
async function readStore() {
  const result = await storageArea().get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

/**
 * 渡されたデータをストレージへ保存する。
 * Persists the provided payload.
 * @param {Record<string, import('./types.js').InjectedElement[]>} value
 * @returns {Promise<void>}
 */
async function writeStore(value) {
  await storageArea().set({ [STORAGE_KEY]: value });
}

/**
 * 指定した URL に紐づく注入要素一覧を取得する。
 * Retrieves all injected elements that match the provided URL.
 * @param {string} pageUrl
 * @returns {Promise<import('./types.js').InjectedElement[]>}
 */
export async function getElementsByUrl(pageUrl) {
  const store = await readStore();
  return store[pageUrl] ? [...store[pageUrl]] : [];
}

/**
 * 指定した URL に対する要素リストを丸ごと保存する。
 * Writes a full list of elements for the provided URL.
 * @param {string} pageUrl
 * @param {import('./types.js').InjectedElement[]} elements
 * @returns {Promise<void>}
 */
export async function setElementsForUrl(pageUrl, elements) {
  const store = await readStore();
  store[pageUrl] = [...elements];
  await writeStore(store);
}

/**
 * 要素を追加または更新し、最新の一覧を返す。
 * Inserts or updates a single element, returning the updated collection.
 * @param {import('./types.js').InjectedElement} element
 * @returns {Promise<import('./types.js').InjectedElement[]>}
 */
export async function upsertElement(element) {
  const store = await readStore();
  const list = store[element.pageUrl] || [];
  const index = list.findIndex((item) => item.id === element.id);
  if (index >= 0) {
    const existing = list[index];
    list[index] = {
      ...existing,
      ...element,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
  } else {
    const now = Date.now();
    list.push({
      ...element,
      createdAt: element.createdAt || now,
      updatedAt: element.updatedAt || now,
    });
  }
  store[element.pageUrl] = list;
  await writeStore(store);
  return [...list];
}

/**
 * 要素 ID を指定して削除する。
 * Deletes an element by identifier.
 * @param {string} pageUrl
 * @param {string} elementId
 * @returns {Promise<import('./types.js').InjectedElement[]>}
 */
export async function deleteElement(pageUrl, elementId) {
  const store = await readStore();
  const list = store[pageUrl] || [];
  const filtered = list.filter((item) => item.id !== elementId);
  if (filtered.length === 0) {
    delete store[pageUrl];
  } else {
    store[pageUrl] = filtered;
  }
  await writeStore(store);
  return [...filtered];
}

/**
 * 指定 URL に紐づくメタデータをすべて削除する。
 * Removes all metadata associated with a URL.
 * @param {string} pageUrl
 * @returns {Promise<void>}
 */
export async function clearPage(pageUrl) {
  const store = await readStore();
  if (store[pageUrl]) {
    delete store[pageUrl];
    await writeStore(store);
  }
}

/**
 * ストレージに保存されたデータ全体を取得する。
 * Retrieves the entire storage payload.
 * @returns {Promise<Record<string, import('./types.js').InjectedElement[]>>}
 */
export async function getFullStore() {
  return readStore();
}

/**
 * ストレージ変更を監視し、データ更新時にコールバックを呼び出す。
 * Subscribes to storage changes on the storage key, invoking the callback when data changes.
 * @param {(current: import('./types.js').InjectedElement[], previous: import('./types.js').InjectedElement[] | undefined, pageUrl: string) => void} callback
 * @returns {() => void} unsubscribe handler
 */
export function observePage(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
      return;
    }
    const { newValue = {}, oldValue = {} } = changes[STORAGE_KEY];
    const pageUrls = new Set([
      ...Object.keys(newValue || {}),
      ...Object.keys(oldValue || {}),
    ]);
    pageUrls.forEach((url) => {
      callback(newValue?.[url] || [], oldValue?.[url], url);
    });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export { STORAGE_KEY };
