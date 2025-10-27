/**
 * 注入要素に関連する型定義をまとめたモジュール。
 *
 * @typedef {Object} InjectedElement
 * @property {string} id
 * @property {string} pageUrl
 * @property {'button' | 'link' | 'tooltip' | 'area'} type
 * @property {string} text
 * @property {string | undefined} href
 * @property {string | undefined} actionSelector
 * @property {string | undefined} actionFlow
 * @property {string} selector
 * @property {string[] | undefined} [frameSelectors]
 * @property {string | undefined} [frameLabel]
 * @property {string | undefined} [frameUrl]
 * @property {'append' | 'prepend' | 'before' | 'after'} position
 * @property {InjectedElementStyle | undefined} style
 * @property {'top' | 'right' | 'bottom' | 'left' | undefined} [tooltipPosition]
 * @property {boolean | undefined} [tooltipPersistent]
 * @property {number} createdAt
 * @property {number | undefined} updatedAt
 */

/**
 * @typedef {Object} InjectedElementStyle
 * @property {'static' | 'relative' | 'absolute' | 'fixed' | undefined} [position]
 * @property {string | undefined} [top]
 * @property {string | undefined} [left]
 * @property {string | undefined} [right]
 * @property {string | undefined} [bottom]
 * @property {string | undefined} [color]
 * @property {string | undefined} [backgroundColor]
 * @property {string | undefined} [fontSize]
 * @property {string | undefined} [fontWeight]
 * @property {string | undefined} [lineHeight]
 * @property {string | undefined} [padding]
 * @property {string | undefined} [border]
 * @property {string | undefined} [borderRadius]
 * @property {string | undefined} [textDecoration]
 * @property {string | undefined} [maxWidth]
 * @property {string | undefined} [boxShadow]
 * @property {string | undefined} [width]
 * @property {string | undefined} [height]
 * @property {string | undefined} [zIndex]
*/

/**
 * @typedef {Object} MessagePayload
 * @property {string} type
 * @property {any} [data]
 */

// 何もしないダミー関数。コールバック初期値として利用する。
export const noop = () => {};

