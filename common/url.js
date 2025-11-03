// 拡張機能が window コンテキストを持たない環境（テストやバックグラウンド）で URL を解釈する際の基準。
// 無効なドメインを設定しておくことで、誤ったリクエストが実際の外部ホストへ送信されるのを防ぐ。
const FALLBACK_ORIGIN = 'https://extension.invalid';

/**
 * URL をストレージキーとして扱いやすい正規化済み形式へ変換する。
 * Normalizes a URL so it can be used as a stable storage key.
 * The query string and hash fragment are ignored so that variants of the same page share a key.
 * @param {string} input
 * @param {string} [base]
 * @returns {string}
 */
export function normalizePageUrl(input, base) {
  if (!input) {
    return '';
  }
  const reference = base || (typeof window !== 'undefined' ? window.location.href : FALLBACK_ORIGIN);
  try {
    // URL コンストラクタで正規化することで、スキーム・ホスト・パスを一貫した形式に揃える。
    // ここではクエリおよびハッシュを除外し、同一ページのバリアントを同じキーにまとめる。
    const url = new URL(String(input), reference);
    return `${url.origin}${url.pathname}`;
  } catch (error) {
    const value = String(input || '').trim();
    if (!value) {
      return '';
    }
    // URL としてパースできない場合はフォールバックとして文字列操作を行う。
    // 既知のクエリ文字 '?' やフラグメント '#' を手動で除去し、最低限の安定性を確保する。
    const questionIndex = value.indexOf('?');
    if (questionIndex >= 0) {
      return value.slice(0, questionIndex) || value;
    }
    const hashIndex = value.indexOf('#');
    if (hashIndex >= 0) {
      return value.slice(0, hashIndex) || value;
    }
    return value;
  }
}

/**
 * 渡された window の現在 URL を正規化したキーとして取得する。
 * Convenience helper returning the normalized key for the provided window.
 * @param {Window} [win]
 * @returns {string}
 */
export function currentPageKey(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win || !win.location) {
    return '';
  }
  // Window が提供されている場合、その location.href を正規化して一意なキーを生成する。
  // 省略時はグローバル window を利用し、テスト環境ではモックを注入できるようにする。
  return normalizePageUrl(win.location.href);
}
