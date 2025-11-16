import { NODE_CLASS, TOOLTIP_POSITIONS } from '../core/constants.js';
import { normalizeTooltipPosition } from '../ui/style.js';

// ツールチップUIユーティリティ
// このファイルはツールチップ要素の生成・外観適用・位置調整・ビューポートガードを提供します。

export function createTooltipNode() {
  // 新しいツールチップコンテナ要素を作成して外観を適用して返す
  const container = document.createElement('div');
  applyTooltipAppearance(container);
  return container;
}

export function applyTooltipAppearance(node) {
  // 要素がHTMLElementでなければ何もしない
  if (!(node instanceof HTMLElement)) {
    return;
  }
  // 基本クラス名とデータ属性をセット
  node.className = `${NODE_CLASS} tooltip`;
  node.dataset.nodeType = 'tooltip';
  // 有効な位置でなければデフォルトを 'top' にする
  if (!TOOLTIP_POSITIONS.has(node.dataset.position || '')) {
    node.dataset.position = 'top';
  }
  // persistent が 'true' か 'false' でなければ 'false' を設定
  if (node.dataset.persistent !== 'true' && node.dataset.persistent !== 'false') {
    node.dataset.persistent = 'false';
  }
  // data-* 属性を明示的にセット（CSS 用）
  node.setAttribute('data-position', node.dataset.position);
  node.setAttribute('data-persistent', node.dataset.persistent);
  node.setAttribute('role', 'group');
  node.tabIndex = 0;

  // トリガー要素（アイコン等）を確保
  let trigger = node.querySelector('.tooltip-trigger');
  if (!(trigger instanceof HTMLElement)) {
    trigger = document.createElement('span');
    trigger.className = 'tooltip-trigger';
    node.insertBefore(trigger, node.firstChild);
  }
  trigger.textContent = 'i';
  // トリガーは補助的な表示なのでスクリーンリーダーから隠す
  trigger.setAttribute('aria-hidden', 'true');

  // バブル要素（実際に表示される説明）を確保
  let bubble = node.querySelector('.tooltip-bubble');
  if (!(bubble instanceof HTMLElement)) {
    bubble = document.createElement('div');
    bubble.className = 'tooltip-bubble';
    node.appendChild(bubble);
  }
  bubble.setAttribute('role', 'tooltip');
}

// アクティブなツールチップコンテナの集合
const activeTooltipContainers = new Set();
// グローバルガードが既にバインドされているかのフラグ
let tooltipGuardsBound = false;

export function configureTooltipPosition(container, bubble, position) {
  // 位置を正規化してデータ属性に反映し、バブルの位置スタイルをリセットする
  const normalized = normalizeTooltipPosition(position);
  container.dataset.position = normalized;
  container.setAttribute('data-position', normalized);
  if (bubble instanceof HTMLElement) {
    // 明示的に位置関連のスタイルをクリアして、CSSトランスフォームの変数も削除
    bubble.style.top = '';
    bubble.style.bottom = '';
    bubble.style.left = '';
    bubble.style.right = '';
    bubble.style.removeProperty('--tooltip-hidden-transform');
    bubble.style.removeProperty('--tooltip-visible-transform');
  }
}

export function bindTooltipViewportGuards(container) {
  // HTMLElement 以外は無視
  if (!(container instanceof HTMLElement)) {
    return;
  }
  // 同じコンテナに複数回バインドしないようにする
  if (container.dataset.tooltipGuard === 'true') {
    return;
  }
  container.dataset.tooltipGuard = 'true';

  // アクティブ集合に追加し、グローバルリスナーを確保
  activeTooltipContainers.add(container);
  ensureGlobalTooltipGuards();

  // マウスやフォーカスで位置調整をスケジュールする
  const schedule = () => queueTooltipForAdjustment(container);
  container.addEventListener('mouseenter', schedule);
  container.addEventListener('focus', schedule);
  container.addEventListener('pointerdown', schedule);
}

function ensureGlobalTooltipGuards() {
  // 既にバインド済みなら何もしない
  if (tooltipGuardsBound) {
    return;
  }
  tooltipGuardsBound = true;
  // スクロールやリサイズ時に全アクティブツールチップの位置調整を予約する関数
  const scheduleAll = () => {
    window.requestAnimationFrame(() => {
      activeTooltipContainers.forEach((container) => {
        adjustTooltipViewport(container);
      });
    });
  };
  window.addEventListener('scroll', scheduleAll, { passive: true });
  window.addEventListener('resize', scheduleAll);
}

function queueTooltipForAdjustment(container) {
  // HTMLElement チェックとアクティブ集合への追加、次のアニメフレームで調整
  if (!(container instanceof HTMLElement)) {
    return;
  }
  activeTooltipContainers.add(container);
  window.requestAnimationFrame(() => adjustTooltipViewport(container));
}

function adjustTooltipViewport(container) {
  // 保守的な型チェックと DOM 接続状態の確認
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!container.isConnected) {
    // DOM から切断されていたら集合から削除
    activeTooltipContainers.delete(container);
    return;
  }
  const bubble = container.querySelector('.tooltip-bubble');
  if (!(bubble instanceof HTMLElement)) {
    return;
  }
  // ビューポート幅に応じて最大幅を決定（左右マージンを確保）
  const maxWidth = Math.min(320, Math.max(180, window.innerWidth - 32));
  bubble.style.maxWidth = `${maxWidth}px`;

  const margin = 16;
  const current = container.dataset.position || 'top';
  let desired = current;
  const rect = bubble.getBoundingClientRect();

  // 横方向のはみ出しを補正（right <-> left）
  if (desired === 'right' && rect.right > window.innerWidth - margin) {
    desired = 'left';
  } else if (desired === 'left' && rect.left < margin) {
    desired = 'right';
  }

  // 縦方向のはみ出しを補正（top <-> bottom）
  if (desired === 'top' && rect.top < margin) {
    desired = 'bottom';
  } else if (desired === 'bottom' && rect.bottom > window.innerHeight - margin) {
    desired = 'top';
  }

  // 位置が変わったら適用する
  if (desired !== current) {
    configureTooltipPosition(container, bubble, desired);
  }
}
