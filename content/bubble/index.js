// エディタバブル関連の公開 API を一括エクスポートするファサード。
// コンテンツスクリプト内からは `content/bubble` を参照するだけで主要関数へアクセスできる。
export { openElementEditor, getElementBubble, getSuggestedStyles } from './element-bubble.js';
