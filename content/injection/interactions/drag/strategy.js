import { attachAreaDragBehavior } from './area.js';
import { attachFloatingDragBehavior } from './floating.js';

/**
 * @typedef {Object} DragDeps
 * @property {(x:number,y:number,excludeId:string)=>any} findAreaDropTarget
 * @property {(placement:any, element: any)=>void} showDomDropPreview
 * @property {(dropTarget:any, element:any)=>void} showAreaDropPreview
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
 * Attaches the appropriate drag behavior based on element type.
 * @param {HTMLElement} node
 * @param {import('../../../../common/types.js').InjectedElement} element
 * @param {object} deps - Dependencies required by floating drag (area drag ignores)
 */
export function attachDragBehavior(node, element, deps /** @type {DragDeps} */) {
  if (!element || !element.type) return;
  if (element.type === 'area') {
    attachAreaDragBehavior(node, element);
    return;
  }
  attachFloatingDragBehavior(node, element, deps);
}


