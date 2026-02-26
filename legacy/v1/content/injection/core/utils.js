/**
 * リンク先として許可されたスキームのみを通過させる安全な URL を組み立てる。
 * Sanitizes an href so only safe schemes are returned.
 * @param {string} href
 * @returns {string | null}
 */
export function sanitizeUrl(href) {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, window.location.href);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return url.href;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * 無効なセレクターによる例外を飲み込みつつ最初の一致要素を取得する。
 * Resolves the first matching element for a selector, swallowing syntax errors.
 * @param {string} selector
 * @returns {Element | null}
 */
export function resolveSelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (_error) {
    return null;
  }
}

/**
 * キャメルケース文字列を CSS カスタムプロパティ向けのケバブケースへ変換する。
 * Converts camelCase strings to kebab-case.
 * @param {string} value
 * @returns {string}
 */
export function kebabCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 指定ミリ秒だけ待機する Promise を返す。
 * Creates a Promise that resolves after the given milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  const duration = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * 指定要素へマウス・ポインターイベントを合成し、ユーザークリックを模倣する。
 * Synthesizes pointer and mouse events to simulate a click on the target.
 * @param {Element | null} target
 * @returns {boolean}
 */
export function forwardClick(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const baseInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0,
    clientX,
    clientY,
  };
  const pointerInit = {
    ...baseInit,
    pointerType: 'mouse',
    isPrimary: true,
  };
  let triggered = false;
  // イベント生成処理をまとめ、失敗時も後続の発火を続けられるようにする。
  const dispatch = (factory) => {
    try {
      const event = factory();
      target.dispatchEvent(event);
      triggered = true;
    } catch (_error) {
      // ignore failures and continue with other events
    }
  };
  if (typeof PointerEvent === 'function') {
    dispatch(() => new PointerEvent('pointerdown', pointerInit));
  }
  dispatch(() => new MouseEvent('mousedown', baseInit));
  if (typeof PointerEvent === 'function') {
    dispatch(() => new PointerEvent('pointerup', pointerInit));
  }
  dispatch(() => new MouseEvent('mouseup', baseInit));
  dispatch(() => new MouseEvent('click', baseInit));
  if (typeof target.click === 'function') {
    try {
      target.click();
      triggered = true;
    } catch (_error) {
      // native click failed; continue
    }
  }
  return triggered;
}


