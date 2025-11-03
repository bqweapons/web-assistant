// 注入要素の永続化と監視を扱うストレージユーティリティ。
// 永続化データは chrome.storage.local の単一キーにまとめる設計となっている。
// キーを定数として切り出すことで、読み書き処理の整合性を保ちつつ再利用性を高めている。
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
  // chrome.storage はシリアライズ可能な値しか扱えないため、
  // 渡された値をそのまま保存する前提で、上位層で plain object へ整形している。
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
  const list = store[pageUrl];
  return Array.isArray(list) ? cloneElementList(list) : [];
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
  // 新しい配列に展開して保存することで、呼び出し元が参照を保持していても
  // 直接ミューテーションできないようにし、データの整合性を保っている。
  const cloned = cloneElementList(Array.isArray(elements) ? elements : []);
  if (cloned.length === 0) {
    delete store[pageUrl];
  } else {
    store[pageUrl] = cloned;
  }
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
  const list = Array.isArray(store[element.pageUrl])
    ? cloneElementList(store[element.pageUrl])
    : [];
  const index = list.findIndex((item) => item.id === element.id);
  if (index >= 0) {
    const existing = list[index];
    // 既存エントリがある場合、作成日時はそのまま残し、更新日時のみ上書きする。
    // また、渡された要素に含まれていないプロパティも existing を展開することで保持する。
    list[index] = {
      ...existing,
      ...element,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
  } else {
    const now = Date.now();
    // 新規作成の場合、createdAt / updatedAt が未指定でも現在時刻で補完し、
    // タイムスタンプが欠落するケースを防いでいる。
    list.push({
      ...element,
      createdAt: element.createdAt || now,
      updatedAt: element.updatedAt || now,
    });
  }
  store[element.pageUrl] = list;
  await writeStore(store);
  return cloneElementList(list);
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
  const list = Array.isArray(store[pageUrl]) ? cloneElementList(store[pageUrl]) : [];
  const filtered = list.filter((item) => item.id !== elementId);
  if (filtered.length === 0) {
    // リストが空になった場合はキー自体を削除する。無駄な空配列を残さないことで
    // ストレージ容量を節約しつつ、observePage での差分検出もシンプルにしている。
    delete store[pageUrl];
  } else {
    store[pageUrl] = filtered;
  }
  await writeStore(store);
  return cloneElementList(filtered);
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
    // 存在しないキーに対して書き込みを行わないことで無駄な I/O を避ける。
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
  const store = await readStore();
  const clone = {};
  for (const [pageUrl, list] of Object.entries(store)) {
    if (!Array.isArray(list)) {
      continue;
    }
    clone[pageUrl] = cloneElementList(list);
  }
  return clone;
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
      // 変更が発生したページ単位でコールバックを発火させる。
      // undefined の旧値も許容し、呼び出し側で差分表示やリフレッシュ制御を行えるようにする。
      const nextList = Array.isArray(newValue?.[url]) ? cloneElementList(newValue[url]) : [];
      const previousList = Array.isArray(oldValue?.[url]) ? cloneElementList(oldValue[url]) : undefined;
      callback(nextList, previousList, url);
    });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * ストレージ全体を別のペイロードで置き換える。
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
      // オブジェクトを深いコピーで保持し、参照共有による外部からのミューテーションを防ぐ。
      payload[pageUrl] = cloneElementList(list);
      if (payload[pageUrl].length === 0) {
        delete payload[pageUrl];
      }
    }
  }
  await writeStore(payload);
}

export { STORAGE_KEY };
