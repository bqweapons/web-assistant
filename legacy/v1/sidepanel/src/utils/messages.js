// サイドパネルの UI メッセージ整形をまとめた小さなユーティリティ群。
// 生データから表示文言を構築する責務を分離し、React コンポーネント側を薄く保つ。
import { parseActionFlowDefinition } from '../../../common/flows.js';

/**
 * 翻訳キーと置換値を組み合わせたメッセージオブジェクトを生成する。
 * Creates a shape that mirrors the localization message contract used across the UI.
 */
export function createMessage(key, values) {
  return { key, values };
}

/**
 * ピッカーで選択中の要素情報を、ユーザーにわかりやすい文字列へ変換する。
 * Formats a preview descriptor such as `button .class "Text"` or falls back to the default label.
 */
export function formatPreview(preview, t) {
  if (!preview) {
    return t('picker.previewTarget');
  }
  const parts = [];
  if (preview.tag) {
    parts.push(preview.tag);
  }
  if (preview.classes) {
    parts.push(`.${preview.classes}`);
  }
  if (preview.text) {
    parts.push(`"${preview.text}"`);
  }
  return parts.length > 0 ? parts.join(' ') : t('picker.previewTarget');
}

/**
 * アクションフローの JSON を解析し、ステップ数など表示用のサマリーを返す。
 * Returns a simple summary (currently the total step count) when the flow parses successfully.
 */
export function summarizeFlow(actionFlow) {
  if (typeof actionFlow !== 'string') {
    return null;
  }
  const trimmed = actionFlow.trim();
  if (!trimmed) {
    return null;
  }
  const { definition, error } = parseActionFlowDefinition(trimmed);
  if (error || !definition) {
    return null;
  }
  return { steps: definition.stepCount };
}
