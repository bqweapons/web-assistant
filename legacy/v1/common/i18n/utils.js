// 国際化メッセージの複製・マージを行う低レベルユーティリティ。
// すべてのロケールで同じキー構造を保てるよう、深いコピーと再帰的な統合処理を提供する。
/**
 * メッセージ辞書全体のディープコピーを作成する。
 * Produces a deep clone of the message dictionary.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function cloneMessages(value) {
  // JSON 経由でシリアライズすることでネストしたオブジェクトを安全にディープコピーする。
  return JSON.parse(JSON.stringify(value));
}

/**
 * 既存のメッセージ辞書へ別の辞書をマージする。
 * Recursively merges one message dictionary into another.
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 */
export function mergeMessages(target, source) {
  Object.keys(source).forEach((key) => {
    const entry = source[key];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      // ネストオブジェクトは再帰的に統合し、既存キーを温存しつつ不足分だけを補完する。
      mergeMessages(target[key], entry);
    } else {
      target[key] = entry;
    }
  });
}
