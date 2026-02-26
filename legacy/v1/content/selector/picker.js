import { createOverlay } from './overlay.js';
import { generateSelector, resolveTarget } from './utils.js';
// ページ上で注入対象の DOM 要素を選択するインタラクティブなピッカー。
// バブル UI・ハイライトオーバーレイ・フレーム解決を組み合わせてエディタに必要な情報を収集する。

/**
 * DOM 要素を選択するインタラクティブなピッカーを起動する。
 * Starts the interactive element picker.
 * @param {{
 *   mode?: 'select';
 *   onCancel?: () => void;
 *   onTarget?: (element: Element, selector: string) => void;
 *   filter?: (element: Element) => boolean;
 * }} [options]
 * @returns {{ stop: () => void }}
 */
export function startElementPicker(options = {}) {
  const { mode = 'select', onCancel, onTarget, filter } = options;
  const overlay = createOverlay();
  document.body.appendChild(overlay.container);

  let disposed = false;

  // ホバー中の要素を追跡し、オーバーレイを更新する。
  const handleMouseMove = (event) => {
    const hovered = resolveTarget(event.target);
    if (!hovered || (filter && !filter(hovered))) {
      overlay.hide();
      return;
    }
    overlay.show(hovered);
  };

  // クリックされた要素を確定し、エディタバブルを開く。
  const handleClick = (event) => {
    const target = resolveTarget(event.target);
    if (!target || (filter && !filter(target))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selector = generateSelector(target);
    overlay.show(target);
    removeListeners();
    onTarget?.(target, selector);
    if (mode !== 'select') {
      dispose('cancel');
      return;
    }
    dispose();
  };

  // Escape キーでピッカーをキャンセルできるようにする。
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dispose('cancel');
    }
  };

  // 登録済みのイベントリスナーをまとめて解除する。
  const removeListeners = () => {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  };

  // ピッカー終了時にオーバーレイとバブルを破棄する。
  const dispose = (reason) => {
    if (disposed) {
      return;
    }
    disposed = true;
    removeListeners();
    overlay.dispose();
    if (reason === 'cancel') {
      onCancel?.();
    }
  };

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  return {
    stop() {
      dispose();
    },
  };
}
