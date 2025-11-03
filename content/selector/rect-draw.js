/**
 * 位置とサイズを指定する矩形描画オーバーレイを開始する。
 * Starts a rectangle drawing overlay to choose position and size.
 * - Shows a full-screen overlay and crosshair cursor.
 * - User drags to draw a rectangle; on release, calls onComplete with page coords.
 * - Escape cancels.
 * @param {{ onComplete?: (rect: { left: number; top: number; width: number; height: number }) => void; onCancel?: () => void }} [options]
 * @returns {{ stop: () => void }}
 */
export function startRectDraw(options = {}) {
  const { onComplete, onCancel } = options;

  const overlay = document.createElement('div');
  overlay.dataset.pageAugmentorRoot = 'rect-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483646',
    cursor: 'crosshair',
    background: 'transparent',
  });

  const canvas = document.createElement('div');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  });
  overlay.appendChild(canvas);

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    border: '2px dashed rgba(37, 99, 235, 0.75)',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderRadius: '12px',
    pointerEvents: 'none',
    display: 'none',
  });
  canvas.appendChild(box);

  let disposed = false;
  let drawing = false;
  let startX = 0;
  let startY = 0;

  // 表示領域外へはみ出さないよう値をクランプするヘルパー。
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // ドラッグ開始時に初期座標を記録し、矩形の描画を開始する。
  const handlePointerDown = (event) => {
    if (event.button !== 0 && event.button !== -1) return;
    drawing = true;
    startX = event.clientX;
    startY = event.clientY;
    box.style.display = 'block';
    updateBox(event.clientX, event.clientY);
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    event.preventDefault();
    event.stopPropagation();
  };

  // 現在のポインタ位置に応じて矩形サイズと位置を更新する。
  const updateBox = (currentX, currentY) => {
    const x1 = clamp(startX, 0, window.innerWidth);
    const y1 = clamp(startY, 0, window.innerHeight);
    const x2 = clamp(currentX, 0, window.innerWidth);
    const y2 = clamp(currentY, 0, window.innerHeight);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.max(1, Math.abs(x2 - x1));
    const height = Math.max(1, Math.abs(y2 - y1));
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  };

  // ドラッグ中のポインタ移動で矩形を描画する。
  const handlePointerMove = (event) => {
    if (!drawing) return;
    updateBox(event.clientX, event.clientY);
    event.preventDefault();
  };

  // ドラッグ終了時に座標を確定させ、コールバックへ結果を渡す。
  const handlePointerUp = (event) => {
    if (!drawing) return;
    drawing = false;
    window.removeEventListener('pointermove', handlePointerMove, true);
    window.removeEventListener('pointerup', handlePointerUp, true);
    // Compute final rect in page coordinates
    const rect = box.getBoundingClientRect();
    const left = Math.round(rect.left + window.scrollX);
    const top = Math.round(rect.top + window.scrollY);
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    dispose();
    if (width > 2 && height > 2) {
      onComplete?.({ left, top, width, height });
    } else {
      onCancel?.();
    }
    event.preventDefault();
    event.stopPropagation();
  };

  // Escape キーで描画操作をキャンセルする。
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      dispose('cancel');
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // オーバーレイとイベントリスナーを破棄する共通処理。
  const dispose = (reason) => {
    if (disposed) return;
    disposed = true;
    overlay.removeEventListener('pointerdown', handlePointerDown, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('pointermove', handlePointerMove, true);
    window.removeEventListener('pointerup', handlePointerUp, true);
    overlay.remove();
    if (reason === 'cancel') {
      onCancel?.();
    }
  };

  overlay.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('keydown', handleKeyDown, true);
  document.body.appendChild(overlay);

  return {
    stop() {
      dispose('cancel');
    },
  };
}

