/**
 * 注入要素に関連する型定義をまとめたモジュール。
 *
 * @typedef {Object} InjectedElement
 * @property {string} id
 * @property {string} pageUrl
 * @property {string | undefined} [siteUrl]
 * @property {'button' | 'link' | 'tooltip' | 'area'} type
 * @property {string} text
 * @property {string | undefined} href
 * @property {'same-tab' | 'new-tab' | undefined} [linkTarget]
 * @property {string | undefined} actionSelector
 * @property {string | undefined} actionFlow
 * @property {boolean | undefined} [actionFlowLocked]
 * @property {string} selector
 * @property {string[] | undefined} [frameSelectors]
 * @property {string | undefined} [frameLabel]
 * @property {string | undefined} [frameUrl]
 * @property {'append' | 'prepend' | 'before' | 'after'} position
 * @property {'row' | 'column' | undefined} [layout]
 * @property {InjectedElementStyle | undefined} style
 * @property {'top' | 'right' | 'bottom' | 'left' | undefined} [tooltipPosition]
 * @property {boolean | undefined} [tooltipPersistent]
 * @property {string | undefined} [containerId]
 * @property {boolean | undefined} [floating]
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
 * @property {string | undefined} [minHeight]
*/

/**
 * @typedef {Object} MessagePayload
 * @property {string} type
 * @property {any} [data]
 */

// 何もしないダミー関数。コールバック初期値として利用する。
export const noop = () => {};

/**
 * Dependencies passed to drag strategies (DI ports)
 * @typedef {Object} DragDeps
 * @property {(x:number,y:number,excludeId:string)=>any} findAreaDropTarget
 * @property {(dropTarget:any, element: InjectedElement)=>void} showAreaDropPreview
 * @property {(placement:any, element: InjectedElement)=>void} showDomDropPreview
 * @property {(x:number,y:number,draggedHost?:HTMLElement)=>HTMLElement|null} findDomDropTarget
 * @property {(target:Element, x:number, y:number)=>any} resolveDomDropPlacement
 * @property {(indicator:{mode:'line'|'box',top:number,left:number,width:number,height:number})=>void} showDomDropIndicator
 * @property {()=>void} hideDomDropIndicator
 * @property {()=>void} removeDropPreviewHost
 * @property {(host:HTMLElement)=>void} resetHostPosition
 * @property {(id:string)=>void} clearPendingContainerAttachment
 * @property {(selector:string)=>Element|null} resolveSelector
 */

/**
 * Resize strategy dependencies (kept minimal for parity)
 * @typedef {Object} ResizeDeps
 * @property {(node: HTMLElement, element: InjectedElement, host: HTMLElement)=>void} attachResize
 */

