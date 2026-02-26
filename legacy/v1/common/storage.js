// 注入要素の永続化と監視を扱うストレージユーティリティ。
// 永続化データは chrome.storage.local の単一キーにまとめる設計となっている。
// キーを定数として切り出すことで、読み書き処理の整合性を保ちつつ再利用性を高めている。
import { normalizeSiteUrl } from './url.js';

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
 * InjectedElement を浅いコピー＋入れ子プロパティの複製で再構築する。
 * Rebuilds an InjectedElement with shallow copies of nested structures.
 * @param {import('./types.js').InjectedElement} element
 * @returns {import('./types.js').InjectedElement}
 */
function cloneElement(element) {
  if (!element || typeof element !== 'object') {
    return /** @type {any} */ (element);
  }
  const clone = { ...element };
  if (Array.isArray(element.frameSelectors)) {
    clone.frameSelectors = [...element.frameSelectors];
  }
  if (element.style && typeof element.style === 'object') {
    clone.style = { ...element.style };
  }
  return clone;
}

/**
 * InjectedElement 配列をコピーし、各要素の参照を独立させる。
 * Clones a list of InjectedElement records to avoid shared references.
 * @param {import('./types.js').InjectedElement[]} list
 * @returns {import('./types.js').InjectedElement[]}
 */
function cloneElementList(list) {
  return list.map((item) => cloneElement(item));
}

/**
 * 渡されたデータをストレージへ保存する。
 * Persists the provided payload.
 * @param {Record<string, import('./types.js').InjectedElement[]>} value
 * @returns {Promise<void>}
 */
async function writeStore(value) {
  // chrome.storage only accepts serializable values; callers are expected to pass
  // plain objects and arrays.
  await storageArea().set({ [STORAGE_KEY]: value });
}

/**
 * Retrieves all injected elements that match the provided URL key.
 * @param {string} pageUrl
 * @returns {Promise<import('./types.js').InjectedElement[]>}
 */
export async function getElementsByUrl(pageUrl) {
  const store = await readStore();
  const key = normalizeSiteUrl(pageUrl);
  const list = store[key];
  return Array.isArray(list) ? cloneElementList(list) : [];
}

/**
 * Writes a full list of elements for the provided URL key.
 * @param {string} pageUrl
 * @param {import('./types.js').InjectedElement[]} elements
 * @returns {Promise<void>}
 */
export async function setElementsForUrl(pageUrl, elements) {
  const store = await readStore();
  const key = normalizeSiteUrl(pageUrl);
  const cloned = cloneElementList(Array.isArray(elements) ? elements : []);
  if (cloned.length === 0) {
    delete store[key];
  } else {
    store[key] = cloned.map((item) => ({ ...item, siteUrl: key }));
  }
  await writeStore(store);
}

/**
 * Inserts or updates a single element, returning the updated collection.
 * @param {import('./types.js').InjectedElement} element
 * @param {string | undefined} siteUrl
 * @returns {Promise<import('./types.js').InjectedElement[]>}
 */
export async function upsertElement(element, siteUrl) {
  const key = normalizeSiteUrl(siteUrl || element.siteUrl || element.pageUrl);
  const store = await readStore();
  const list = Array.isArray(store[key]) ? cloneElementList(store[key]) : [];
  const index = list.findIndex((item) => item.id === element.id);
  if (index >= 0) {
    const existing = list[index];
    list[index] = {
      ...element,
      siteUrl: key,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
  } else {
    const now = Date.now();
    list.push({
      ...element,
      siteUrl: key,
      createdAt: element.createdAt || now,
      updatedAt: element.updatedAt || now,
    });
  }
  store[key] = list;
  await writeStore(store);
  return cloneElementList(list);
}

/**
 * Deletes an element by identifier.
 * @param {string} pageUrl
 * @param {string} elementId
 * @returns {Promise<import('./types.js').InjectedElement[]>}
 */
export async function deleteElement(pageUrl, elementId) {
  const store = await readStore();
  const key = normalizeSiteUrl(pageUrl);
  const list = Array.isArray(store[key]) ? cloneElementList(store[key]) : [];
  const filtered = list.filter((item) => item.id !== elementId);
  if (filtered.length === 0) {
    delete store[key];
  } else {
    store[key] = filtered;
  }
  await writeStore(store);
  return cloneElementList(filtered);
}

/**
 * Removes all metadata associated with a URL key.
 * @param {string} pageUrl
 * @returns {Promise<void>}
 */
export async function clearPage(pageUrl) {
  const store = await readStore();
  const key = normalizeSiteUrl(pageUrl);
  if (store[key]) {
    delete store[key];
    await writeStore(store);
  }
}

/**
 * Retrieves the entire storage payload (deep-cloned).
 * @returns {Promise<Record<string, import('./types.js').InjectedElement[]>>}
 */
export async function getFullStore() {
  const store = await readStore();
  const clone = {};
  for (const [pageUrl, list] of Object.entries(store)) {
    if (!Array.isArray(list)) {
      continue;
    }
    clone[pageUrl] = cloneElementList(list).map((item) => ({ ...item, siteUrl: normalizeSiteUrl(pageUrl) }));
  }
  return clone;
}

/**
 * Replaces the entire persisted store with a new payload.
 * @param {Record<string, import('./types.js').InjectedElement[]> | undefined | null} value
 * @returns {Promise<void>}
 */
export async function replaceStore(value) {
  const payload = {};
  if (value && typeof value === 'object') {
    for (const [pageUrl, list] of Object.entries(value)) {
      if (!Array.isArray(list)) {
        continue;
      }
      const siteKey = normalizeSiteUrl(pageUrl);
      const cloned = cloneElementList(list);
      if (cloned.length === 0) {
        continue;
      }
      payload[siteKey] = cloned.map((item) => ({ ...item, siteUrl: siteKey }));
    }
  }
  await writeStore(payload);
}

export { STORAGE_KEY };

