// コンテンツスクリプトが利用する注入機能を一箇所にまとめたファサードモジュール。
// 実際の実装は injection/core/registry.js に存在するが、公開 API をここから再エクスポートすることで
// import パスを安定化させ、将来的なディレクトリ構成変更の影響を最小化している。
export {
  ensureElement,
  updateElement,
  removeElement,
  reconcileElements,
  getElement,
  getHost,
  previewElement,
  focusElement,
  listElements,
  setEditingElement,
  setEditingMode,
} from './injection/core/registry.js';

