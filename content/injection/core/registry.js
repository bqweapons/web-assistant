import { applyMetadata, flashHighlight, insertHost, clearPendingContainerAttachment } from '../orchestrator/orchestrator.js';
import { createHost } from '../host/create-host.js';
import { HOST_ATTRIBUTE } from './constants.js';

// コンテンツスクリプトで生成されるホスト要素とメタデータを管理するレジストリ。
// 要素 ID をキーとした Map を利用し、DOM 上のノードとビジネスロジック側の状態を同期させる。

/** @type {Map<string, import('../../../common/types.js').InjectedElement>} */
const elements = new Map();
/** @type {Map<string, HTMLElement>} */
const hosts = new Map();
// 編集対象に指定されている要素 ID の集合。editingMode の有無に関わらず個別制御を可能にする。
const editingElements = new Set();
// グローバル編集モードのフラグ。true の場合はすべてのホスト要素に編集状態のスタイルを適用する。
let editingMode = false;

/**
 * 注入要素のホストを DOM 上に確保し、最新メタデータを反映する。
 * Ensures an injected element host exists and is hydrated.
 * @param {import('../../../common/types.js').InjectedElement} element
 * @returns {boolean}
 */
export function ensureElement(element) {
  // 最新のメタデータをキャッシュに保存し、ホスト要素が存在しない場合は DOM 上に生成する。
  elements.set(element.id, element);
  let host = hosts.get(element.id);
  if (!host || !host.isConnected) {
    // Adopt an existing DOM host first (avoids accidental duplication)
    const adopted = findExistingHostInDom(element.id);
    if (adopted) {
      host = adopted;
      hosts.set(element.id, host);
      applyMetadata(host, element);
    } else {
      host = createHost(element);
      const inserted = insertHost(host, element);
      if (!inserted) {
        // 挿入に失敗した場合は生成したノードを破棄し、保留中の処理もクリアして再試行に備える。
        host.remove();
        clearPendingContainerAttachment(element.id);
        return false;
      }
      hosts.set(element.id, host);
      // Ensure the freshly created host is hydrated immediately so
      // the user sees content on first render (text, href, tooltip, etc.).
      applyMetadata(host, element);
    }
  } else {
    applyMetadata(host, element);
  }
  applyEditingState(host, element.id);
  return true;
}

/**
 * 既存要素の位置やプロパティを更新し、必要に応じてホストを再生成する。
 * Updates an existing injected element and recreates the host when necessary.
 * @param {import('../../../common/types.js').InjectedElement} element
 * @returns {boolean}
 */
export function updateElement(element) {
  const previous = elements.get(element.id);
  elements.set(element.id, element);
  const host = hosts.get(element.id);
  const locationChanged =
    previous &&
    (previous.selector !== element.selector ||
      previous.position !== element.position ||
      hasAreaPositionChanged(previous, element));
  if (!host || !host.isConnected || locationChanged) {
    if (host?.isConnected) {
      host.remove();
    }
    clearPendingContainerAttachment(element.id);
    hosts.delete(element.id);
    // 位置やコンテナが変化した場合は一旦ホストを破棄し、ensureElement で再生成する。
    return ensureElement(element);
  }
  // 位置が変わっていない場合は既存ホストへメタデータを適用し、編集状態も再評価する。
  applyMetadata(host, element);
  applyEditingState(host, element.id);
  return true;
}

/**
 * 指定 ID の要素をレジストリと DOM から削除する。
 * Removes an injected element from the registry and DOM.
 * @param {string} elementId
 * @returns {boolean}
 */
export function removeElement(elementId) {
  elements.delete(elementId);
  const host = hosts.get(elementId);
  clearPendingContainerAttachment(elementId);
  if (host) {
    // DOM からノードを取り除き、レジストリと編集状態の双方から参照を削除する。
    hosts.delete(elementId);
    host.remove();
    editingElements.delete(elementId);
    return true;
  }
  return false;
}

/**
 * レジストリの内容を基に DOM とメモリの状態差分を解消する。
 * Reconciles the DOM against the in-memory registry.
 */
export function reconcileElements() {
  // キャッシュ済みの全要素について ensureElement を呼び出し、DOM 上の齟齬を解消する。
  for (const element of elements.values()) {
    ensureElement(element);
  }
}

/**
 * レジストリからメタデータのみを取得する。
 * Retrieves element metadata from the registry.
 * @param {string} elementId
 * @returns {import('../../../common/types.js').InjectedElement | undefined}
 */
export function getElement(elementId) {
  // メモリ上のレジストリからメタデータのみを取得する。DOM 状態とは独立してアクセスできる。
  return elements.get(elementId);
}

/**
 * レジストリに保持された DOM ホスト要素を返す。
 * Returns the DOM host associated with the element ID.
 * @param {string} elementId
 * @returns {HTMLElement | null}
 */
export function getHost(elementId) {
  // ホスト要素が DOM から切り離されていないかをチェックし、切断済みであれば null を返す。
  const host = hosts.get(elementId);
  return host?.isConnected ? host : null;
}

/**
 * 特定要素の編集状態フラグを更新する。
 * Toggles the editing state for a specific element.
 * @param {string} elementId
 * @param {boolean} editing
 */
export function setEditingElement(elementId, editing) {
  if (!elementId) {
    return;
  }
  if (editing) {
    editingElements.add(elementId);
  } else {
    editingElements.delete(elementId);
  }
  const host = hosts.get(elementId);
  if (host?.isConnected) {
    // 対象ホストが存在する場合のみ編集状態を反映する。すでに DOM から外れているなら何もしない。
    applyEditingState(host, elementId);
  }
}

/**
 * 全要素に適用されるグローバル編集モードを切り替える。
 * Switches the global editing mode for all hosts.
 * @param {boolean} enabled
 */
export function setEditingMode(enabled) {
  editingMode = Boolean(enabled);
  for (const [elementId, host] of hosts.entries()) {
    if (host?.isConnected) {
      // グローバルモードの切り替えでは、全ホストに対して一括でデータ属性を更新する。
      applyEditingState(host, elementId);
    }
  }
}

/**
 * 永続化データを変更せずにプレビュー用の一時的上書きを適用する。
 * Applies transient preview overrides to a host.
 * @param {string} elementId
 * @param {Partial<import('../../../common/types.js').InjectedElement>} [overrides]
 */
export function previewElement(elementId, overrides) {
  const base = elements.get(elementId);
  if (!base) {
    return;
  }
  const host = hosts.get(elementId);
  if (!host || !host.isConnected) {
    return;
  }
  const merged = {
    ...base,
    ...overrides,
    style: {
      ...(base.style || {}),
      ...(overrides?.style || {}),
    },
  };
  // プレビューではスタイルオブジェクトを浅いマージで統合し、恒久的な更新を伴わずに見た目だけを変更する。
  applyMetadata(host, merged);
}

/**
 * 対象ホストへスクロールし視覚的強調を与える。
 * Scrolls to a host and highlights it momentarily.
 * @param {string} elementId
 * @returns {boolean}
 */
export function focusElement(elementId) {
  const host = hosts.get(elementId);
  if (!host || !host.isConnected) {
    return false;
  }
  // ビューポート中央付近へスクロールし、flashHighlight で視覚的なフィードバックを与える。
  host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashHighlight(host);
  return true;
}

/**
 * レジストリに保持されている全要素を配列で返す。
 * Lists all registered elements.
 * @returns {import('../../../common/types.js').InjectedElement[]}
 */
export function listElements() {
  // 内部キャッシュから値を配列として取り出し、呼び出し側で自由に並べ替えられるようにする。
  return Array.from(elements.values());
}

/**
 * area タイプの要素で位置スタイルが変更されたかを判定する。
 * Determines whether an area element changed its positioned styles.
 * @param {import('../../../common/types.js').InjectedElement | undefined} previous
 * @param {import('../../../common/types.js').InjectedElement | undefined} next
 * @returns {boolean}
 */
function hasAreaPositionChanged(previous, next) {
  // area タイプの場合のみ位置の変更を検出し、他のタイプでは常に false を返す。
  // スタイル文字列は trim して比較し、余分な空白による偽陽性を防いでいる。
  if (!previous || !next || previous.type !== 'area' || next.type !== 'area') {
    return false;
  }
  const prevStyle = previous.style || {};
  const nextStyle = next.style || {};
  const prevLeft = typeof prevStyle.left === 'string' ? prevStyle.left.trim() : '';
  const nextLeft = typeof nextStyle.left === 'string' ? nextStyle.left.trim() : '';
  const prevTop = typeof prevStyle.top === 'string' ? prevStyle.top.trim() : '';
  const nextTop = typeof nextStyle.top === 'string' ? nextStyle.top.trim() : '';
  return prevLeft !== nextLeft || prevTop !== nextTop;
}

/**
 * ホスト要素へ編集状態を示すデータ属性を設定する。
 * Applies editing-state data attributes to the host element.
 * @param {HTMLElement | Element | null} host
 * @param {string} elementId
 */
function applyEditingState(host, elementId) {
  // 編集状態は data 属性で管理し、CSS 側で視覚的な変化を与える。
  if (!(host instanceof HTMLElement)) {
    return;
  }
  if (editingMode) {
    host.dataset.pageAugmentorGlobalEditing = 'true';
  } else {
    delete host.dataset.pageAugmentorGlobalEditing;
  }
  if (editingElements.has(elementId)) {
    host.dataset.pageAugmentorEditing = 'true';
  } else {
    delete host.dataset.pageAugmentorEditing;
  }
}

/**
 * 属性セレクターで利用する値をエスケープする。
 * Escapes a value for safe attribute selector usage.
 * @param {string} value
 * @returns {string}
 */
function escapeAttributeSelector(value) {
  // querySelector でホスト要素を検索する際に、ID に含まれる特殊文字をエスケープする。
  // CSS.escape が利用できないブラウザ向けに手動エスケープをフォールバックとして用意し、
  // ダブルクォートやバックスラッシュ、閉じ角括弧など属性セレクターを壊す文字を退避する。
  try {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
  } catch (_e) {}
  return String(value).replace(/["\\\]]/g, '\\$&');
}

/**
 * DOM 上に既存するホスト要素を検索する。
 * Searches the DOM for an existing host element.
 * @param {string} elementId
 * @returns {HTMLElement | null}
 */
function findExistingHostInDom(elementId) {
  // すでに DOM 上に存在するホスト要素を優先的に再利用し、重複挿入を避ける。
  try {
    if (!elementId) return null;
    const escaped = escapeAttributeSelector(elementId);
    const node = document.querySelector(`[${HOST_ATTRIBUTE}="${escaped}"]`);
    return node instanceof HTMLElement ? node : null;
  } catch (_e) {
    return null;
  }
}

