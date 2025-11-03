// ツールチップ要素に関連する選択肢とプレビュー描画ロジックを集約したヘルパー。
// エディタとプレビュー UI が同じ制約・見た目を共有できるよう、共通関数として切り出している。
export const VALID_TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

export const DEFAULT_TOOLTIP_STYLE = {
  color: '#f8fafc',
  backgroundColor: '#111827',
  fontSize: '14px',
  padding: '8px 12px',
  borderRadius: '12px',
};

/**
 * ツールチップ位置選択用のオプション配列を生成する。
 * Produces selector options for tooltip positions.
 * @param {(key: string) => string} t
 * @returns {{ value: string; label: string }[]}
 */
export function getTooltipPositionOptions(t) {
  return Array.from(VALID_TOOLTIP_POSITIONS).map((value) => ({
    value,
    label: t(`tooltip.position.${value}`),
  }));
}

/**
 * プレビューコンテナへツールチップ設定を適用する。
 * Applies tooltip preview attributes and inline styles.
 * @param {HTMLElement | null} container
 * @param {{ tooltipPosition?: string; tooltipPersistent?: boolean; text?: string; style?: Record<string, string> }} payload
 * @param {(key: string) => string} t
 */
export function applyTooltipPreview(container, payload, t) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  container.dataset.previewType = 'tooltip';
  container.className = 'page-augmentor-preview-tooltip';
  const position =
    payload.tooltipPosition && VALID_TOOLTIP_POSITIONS.has(payload.tooltipPosition)
      ? payload.tooltipPosition
      : 'top';
  container.dataset.position = position;
  container.dataset.persistent = payload.tooltipPersistent ? 'true' : 'false';
  container.dataset.previewVisible = 'true';
  container.setAttribute('role', 'group');
  container.tabIndex = -1;

  const trigger = container.querySelector('.page-augmentor-preview-tooltip-trigger');
  if (trigger instanceof HTMLElement) {
    trigger.textContent = 'i';
    trigger.setAttribute('aria-hidden', 'true');
  }

  const bubble = container.querySelector('.page-augmentor-preview-tooltip-bubble');
  if (bubble instanceof HTMLElement) {
    const textValue = payload.text && payload.text.trim() ? payload.text : t('editor.previewTooltip');
    bubble.textContent = textValue;
    bubble.removeAttribute('style');
    if (payload.style) {
      Object.entries(payload.style).forEach(([key, value]) => {
        bubble.style[key] = value;
      });
    }
  }
}
