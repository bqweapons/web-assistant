/**
 * @typedef {Object} InjectedElement
 * @property {string} id
 * @property {string} pageUrl
 * @property {'button' | 'link' | 'tooltip'} type
 * @property {string} text
 * @property {string | undefined} href
 * @property {string | undefined} actionSelector
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
 * @property {string | undefined} [borderRadius]
 * @property {string | undefined} [textDecoration]
 * @property {string | undefined} [maxWidth]
 */

/**
 * @typedef {Object} MessagePayload
 * @property {string} type
 * @property {any} [data]
 */

export const noop = () => {};

