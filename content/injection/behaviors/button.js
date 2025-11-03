import { parseActionFlowDefinition } from '../../common/flows.js';
import { forwardClick, resolveSelector, sanitizeUrl, executeActionFlow } from '../core/index.js';

export function applyButtonBehavior(node, href, actionSelector, actionFlow) {
  if (!(node instanceof HTMLButtonElement)) {
    return;
  }
  const sanitized = sanitizeUrl(href || '');
  const selector = typeof actionSelector === 'string' ? actionSelector.trim() : '';
  const flowSource = typeof actionFlow === 'string' ? actionFlow.trim() : '';
  let parsedFlow = null;
  if (flowSource) {
    const { definition, error } = parseActionFlowDefinition(flowSource);
    if (error) {
      console.warn('[PageAugmentor] Ignoring invalid action flow:', error);
    } else if (definition) {
      parsedFlow = definition;
      if (selector) {
        parsedFlow = {
          steps: [...definition.steps, { type: 'click', selector, all: false }],
          stepCount: definition.stepCount + 1,
        };
      }
    }
  }
  if (sanitized) {
    node.dataset.href = sanitized;
  } else {
    delete node.dataset.href;
  }
  if (selector) {
    node.dataset.actionSelector = selector;
  } else {
    delete node.dataset.actionSelector;
  }
  if (parsedFlow) {
    node.dataset.actionFlow = String(parsedFlow.stepCount);
  } else {
    delete node.dataset.actionFlow;
  }
  if (!parsedFlow && !selector && !sanitized) {
    node.onclick = null;
    return;
  }
  node.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    let handled = false;
    if (parsedFlow) {
      try {
        handled = await executeActionFlow(node, parsedFlow);
      } catch (error) {
        console.error('[PageAugmentor] Failed to execute flow', error);
      }
    }
    if (handled) {
      return;
    }
    if (selector) {
      const target = resolveSelector(selector);
      if (target) {
        const triggered = forwardClick(target);
        if (!triggered) {
          if (sanitized) {
            window.open(sanitized, '_blank', 'noopener');
          } else if (typeof target.click === 'function') {
            try {
              target.click();
            } catch (clickError) {
              console.warn('[PageAugmentor] Native click fallback failed', clickError);
            }
          }
        }
        return;
      }
    }
    if (sanitized) {
      window.open(sanitized, '_blank', 'noopener');
    }
  };
}





