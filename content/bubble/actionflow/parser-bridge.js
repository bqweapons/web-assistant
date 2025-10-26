import { parseActionFlowDefinition } from '../../../common/flows.js';

/**
 * Validates a raw action-flow source string.
 * @param {string} source
 * @returns {{ stepCount: number; error?: string; definition?: { steps: any[]; stepCount: number } }}
 */
export function validateFlowSource(source) {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) {
    return { stepCount: 0 };
  }

  const { definition, error } = parseActionFlowDefinition(trimmed);
  if (error) {
    return { stepCount: 0, error };
  }
  if (!definition) {
    return { stepCount: 0 };
  }
  return { stepCount: definition.stepCount, definition };
}

/**
 * Attempts to parse a source string into builder-compatible steps.
 * @param {string} source
 * @returns {{ mode: 'builder' | 'advanced'; steps: Array<{ type: 'click' | 'input' | 'wait'; selector?: string; value?: string; ms?: number }>; error: string }}
 */
export function parseFlowForBuilder(source) {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) {
    return { mode: 'builder', steps: [], error: '' };
  }

  const { definition, error } = parseActionFlowDefinition(trimmed);
  if (error) {
    return { mode: 'advanced', steps: [], error };
  }
  if (!definition) {
    return { mode: 'builder', steps: [], error: '' };
  }

  const steps = [];
  for (const step of definition.steps) {
    switch (step.type) {
      case 'click':
        steps.push({ type: 'click', selector: step.selector || '' });
        break;
      case 'input':
        steps.push({ type: 'input', selector: step.selector || '', value: step.value || '' });
        break;
      case 'wait':
        steps.push({
          type: 'wait',
          ms: typeof step.ms === 'number' ? Math.max(0, Math.round(step.ms)) : 1000,
        });
        break;
      default:
        return { mode: 'advanced', steps: [], error: '' };
    }
  }

  return { mode: 'builder', steps, error: '' };
}
