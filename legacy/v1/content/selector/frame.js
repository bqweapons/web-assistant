// フレーム階層を解析し、ピッカーやストレージへ必要なメタデータを提供するユーティリティ。
// 同一オリジンチェックやセレクター生成を集約し、他モジュールが安全にフレーム情報へアクセスできるようにする。
import { normalizePageUrl } from '../../common/url.js';
import { generateSelector } from './utils.js';

/**
 * 現在のフレーム階層に関するメタデータを収集する。
 * Resolves metadata about the current frame hierarchy.
 * @param {Window} [win]
 * @returns {{
 *   frameSelectors: string[];
 *   frameLabel: string;
 *   frameUrl: string;
 *   pageUrl: string;
 *   sameOriginWithTop: boolean;
 * }}
 */
export function resolveFrameContext(win = window) {
  const targetWindow = win || window;
  const { selectors, sameOrigin } = collectFrameSelectors(targetWindow);
  const frameElement = safeFrameElement(targetWindow);
  const frameUrl = tryGetWindowUrl(targetWindow);
  const topUrl = sameOrigin ? tryGetWindowUrl(safeTopWindow(targetWindow)) : '';
  const pageUrl = normalizePageUrl(topUrl || frameUrl);
  const frameLabel = selectors.length > 0 ? describeFrameElement(frameElement) : '';
  return {
    frameSelectors: sameOrigin ? selectors : [],
    frameLabel: frameLabel || '',
    frameUrl: frameUrl || '',
    pageUrl: pageUrl || '',
    sameOriginWithTop: sameOrigin && Boolean(pageUrl) && Boolean(frameUrl),
  };
}

/**
 * フレームからトップウィンドウまでのセレクター経路を構築する。
 * Collects frame selectors up to the top window.
 * @param {Window} win
 * @returns {{ selectors: string[]; sameOrigin: boolean }}
 */
function collectFrameSelectors(win) {
  const selectors = [];
  let current = win;
  let sameOrigin = true;
  while (current && current !== current.parent) {
    if (!canAccessParent(current)) {
      sameOrigin = false;
      break;
    }
    const frameElement = safeFrameElement(current);
    if (!(frameElement instanceof Element)) {
      sameOrigin = false;
      break;
    }
    selectors.unshift(generateSelector(frameElement));
    try {
      current = current.parent;
    } catch (error) {
      sameOrigin = false;
      break;
    }
  }
  return { selectors: sameOrigin ? selectors : [], sameOrigin };
}

/**
 * 親ウィンドウへアクセスできるかどうかを判定する。
 * Determines if the parent window is same-origin accessible.
 * @param {Window} win
 * @returns {boolean}
 */
function canAccessParent(win) {
  try {
    if (win === win.parent) {
      return false;
    }
    void win.parent.document;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * フレーム要素への参照取得時にクロスオリジン例外を吸収する。
 * Safely resolves the frameElement for a window.
 * @param {Window} win
 * @returns {Element | null}
 */
function safeFrameElement(win) {
  try {
    return win.frameElement || null;
  } catch (error) {
    return null;
  }
}

/**
 * トップウィンドウを取得し、クロスオリジン例外時は自身を返す。
 * Safely resolves the top window reference.
 * @param {Window} win
 * @returns {Window}
 */
function safeTopWindow(win) {
  try {
    return win.top;
  } catch (error) {
    return win;
  }
}

/**
 * Window.location から URL を安全に取得する。
 * Safely extracts a window URL without throwing on cross-origin.
 * @param {Window} win
 * @returns {string}
 */
function tryGetWindowUrl(win) {
  try {
    const { origin, pathname, search } = win.location;
    return `${origin}${pathname}${search}`;
  } catch (error) {
    return '';
  }
}

/**
 * フレーム要素を可読なラベル文字列へ変換する。
 * Produces a human-readable label for the frame element.
 * @param {Element | null} element
 * @returns {string}
 */
function describeFrameElement(element) {
  if (!(element instanceof Element)) {
    return '';
  }
  const localName = element.localName || 'frame';
  if (element.id) {
    return `${localName}#${element.id}`;
  }
  const name = element.getAttribute('name');
  if (name) {
    return `${localName}[name="${name}"]`;
  }
  const title = element.getAttribute('title');
  if (title) {
    return `${localName}[title="${title}"]`;
  }
  const src = element.getAttribute('src');
  if (src) {
    const normalized = normalizeFrameSource(src, element.ownerDocument);
    return `${localName}[src*="${normalized}"]`;
  }
  return localName;
}

/**
 * フレームの src からホスト＋パス部分のみを抽出し短縮する。
 * Normalizes the frame source attribute to a comparable string.
 * @param {string} src
 * @param {Document | null} doc
 * @returns {string}
 */
function normalizeFrameSource(src, doc) {
  try {
    const base = doc?.location?.href || window.location.href;
    const url = new URL(src, base);
    return `${url.origin}${url.pathname}`.slice(0, 120);
  } catch (error) {
    return src.slice(0, 120);
  }
}
