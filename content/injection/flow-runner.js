import { FLOW_MAX_DEPTH, FLOW_MAX_RUNTIME_MS, FLOW_SELF_SELECTOR } from './constants.js';
import { delay, forwardClick, sanitizeUrl } from './utils.js';

/**
 * Executes the configured action flow.
 * @param {HTMLElement} node
 * @param {import('../../common/flows.js').FlowDefinition} definition
 * @returns {Promise<boolean>}
 */
export async function executeActionFlow(node, definition) {
  if (!definition || !Array.isArray(definition.steps) || definition.steps.length === 0) {
    return false;
  }
  const context = {
    root: node,
    document: node.ownerDocument || document,
    performed: false,
    startTime: Date.now(),
  };
  await runFlowSteps(definition.steps, context, 0);
  return context.performed;
}

/**
 * @typedef {Object} FlowExecutionContext
 * @property {HTMLElement} root
 * @property {Document} document
 * @property {boolean} performed
 * @property {number} startTime
 */

/**
 * Executes a list of flow steps sequentially.
 * @param {import('../../common/flows.js').FlowStep[]} steps
 * @param {FlowExecutionContext} context
 * @param {number} depth
 */
async function runFlowSteps(steps, context, depth) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return;
  }
  if (depth > FLOW_MAX_DEPTH) {
    throw new Error('Flow exceeded maximum nesting depth.');
  }
  for (const step of steps) {
    await runFlowStep(step, context, depth);
    enforceRuntimeLimit(context);
  }
}

/**
 * Executes a single flow step.
 * @param {import('../../common/flows.js').FlowStep} step
 * @param {FlowExecutionContext} context
 * @param {number} depth
 */
async function runFlowStep(step, context, depth) {
  if (!step) {
    return;
  }
  switch (step.type) {
    case 'click': {
      let targets = [];
      if (step.all) {
        targets = resolveFlowElements(step.selector, context);
      } else {
        const single = resolveFlowElement(step.selector, context);
        if (single) {
          targets = [single];
        }
      }
      if (targets.length === 0) {
        break;
      }
      targets.forEach((target) => {
        const triggered = forwardClick(target);
        if (!triggered && typeof target.click === 'function') {
          try {
            target.click();
          } catch (error) {
            console.warn('[PageAugmentor] Flow click fallback failed', error);
          }
        }
      });
      context.performed = true;
      break;
    }
    case 'wait': {
      await delay(step.ms);
      break;
    }
    case 'input': {
      const target = resolveFlowElement(step.selector, context);
      if (target && applyInputValue(target, step.value)) {
        context.performed = true;
      }
      break;
    }
    case 'navigate': {
      const sanitized = sanitizeUrl(step.url);
      if (sanitized) {
        const target = step.target || '_blank';
        window.open(sanitized, target, 'noopener');
        context.performed = true;
      }
      break;
    }
    case 'log': {
      console.info('[PageAugmentor][Flow]', step.message);
      break;
    }
    case 'if': {
      const outcome = evaluateFlowCondition(step.condition, context);
      await runFlowSteps(outcome ? step.thenSteps : step.elseSteps, context, depth + 1);
      break;
    }
    case 'while': {
      let iterations = 0;
      while (iterations < step.maxIterations && evaluateFlowCondition(step.condition, context)) {
        iterations += 1;
        await runFlowSteps(step.bodySteps, context, depth + 1);
        enforceRuntimeLimit(context);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Ensures flow execution stays within the runtime budget.
 * @param {FlowExecutionContext} context
 */
function enforceRuntimeLimit(context) {
  if (Date.now() - context.startTime > FLOW_MAX_RUNTIME_MS) {
    throw new Error('Flow execution exceeded the time limit.');
  }
}

function resolveFlowElement(selector, context) {
  const [element] = resolveFlowElements(selector, context);
  return element || null;
}

function resolveFlowElements(selector, context) {
  if (!selector) {
    return [];
  }
  if (selector === FLOW_SELF_SELECTOR) {
    return context.root ? [context.root] : [];
  }
  try {
    return Array.from((context.document || document).querySelectorAll(selector));
  } catch (error) {
    console.warn('[PageAugmentor] Invalid flow selector', selector, error);
    return [];
  }
}

function applyInputValue(element, value) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus({ preventScroll: true });
    element.value = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus({ preventScroll: true });
    element.textContent = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function evaluateFlowCondition(condition, context) {
  if (!condition) {
    return false;
  }
  switch (condition.kind) {
    case 'exists':
      return Boolean(resolveFlowElement(condition.selector, context));
    case 'not':
      return !evaluateFlowCondition(condition.operand, context);
    case 'textContains': {
      const target = resolveFlowElement(condition.selector, context);
      if (!target) {
        return false;
      }
      const text = (target.textContent || '').toLowerCase();
      return text.includes(condition.value.toLowerCase());
    }
    case 'attributeEquals': {
      const target = resolveFlowElement(condition.selector, context);
      if (!target) {
        return false;
      }
      return target.getAttribute(condition.name) === condition.value;
    }
    default:
      return false;
  }
}
