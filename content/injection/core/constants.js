// レジストリや DOM 検索で利用するデータ属性・CSS クラス名を集中管理する。
export const HOST_ATTRIBUTE = 'data-page-augmentor-id';
export const HOST_CLASS = 'page-augmentor-host';
export const NODE_CLASS = 'page-augmentor-node';

// ユーザー設定から適用を許可するスタイルプロパティのホワイトリスト。
// Set を利用して O(1) チェックを可能にし、任意のスタイル注入を防ぐ。
export const ALLOWED_STYLE_KEYS = new Set([
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'color',
  'backgroundColor',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'padding',
  'border',
  'borderRadius',
  'textDecoration',
  'maxWidth',
  'boxShadow',
  'width',
  'height',
  'minHeight',
  'zIndex',
]);

// ツールチップ表示位置に許容される値。UI 側のバリデーションと整合させる。
export const TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

// フローエンジンが内部で使用する制限値。:self は注入ボタン自身を指すためのエイリアス。
export const FLOW_SELF_SELECTOR = ':self';
export const FLOW_MAX_RUNTIME_MS = 10000;
export const FLOW_MAX_DEPTH = 8;

// ドラッグによる配置時のデフォルト Z-index を指定し、既存ページのスタック順序と競合しにくくする。
export const Z_INDEX_FLOATING_DEFAULT = '2147482000';
export const Z_INDEX_HOST_DEFAULT = '1000';


