/**
 * @typedef {Object} InjectedElement
 * @property {string} id
 * @property {string} pageUrl
 * @property {'button' | 'link'} type
 * @property {string} text
 * @property {string | undefined} href
 * @property {string} selector
 * @property {'append' | 'prepend' | 'before' | 'after'} position
 * @property {InjectedElementStyle | undefined} style
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
 * @property {string | undefined} [padding]
 * @property {string | undefined} [borderRadius]
 */

/**
 * @typedef {Object} MessagePayload
 * @property {string} type
 * @property {any} [data]
 */

export const noop = () => {};
