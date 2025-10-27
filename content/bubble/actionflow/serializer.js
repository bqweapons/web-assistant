/**
 * Serializes builder steps into the JSON action-flow payload.
 * @param {Array<{ type: 'click' | 'input' | 'wait'; selector?: string; value?: string; ms?: number }>} steps
 * @returns {string}
 */
export function stepsToJSON(steps) {
  const normalized = Array.isArray(steps) ? steps : [];
  const payload = normalized.map((step) => {
    if (step.type === 'input') {
      return {
        type: 'input',
        selector: typeof step.selector === 'string' ? step.selector.trim() : '',
        value: step.value,
      };
    }
    if (step.type === 'wait') {
      const ms = Number(step.ms);
      const safeValue = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
      return { type: 'wait', ms: safeValue };
    }
    return {
      type: 'click',
      selector: typeof step.selector === 'string' ? step.selector.trim() : '',
      all: false,
    };
  });

  return JSON.stringify({ steps: payload }, null, 2);
}

/**
 * Attempts to parse a JSON action-flow definition back into builder steps.
 * @param {string} source
 * @returns {{ steps: Array<{ type: 'click' | 'input' | 'wait'; selector?: string; value?: string; ms?: number }> | null; error?: string }}
 */
export function jsonToSteps(source) {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) {
    return { steps: [] };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : null;
    if (!steps) {
      return { steps: null, error: '' };
    }
    const builderSteps = [];
    for (const step of steps) {
      if (!step || typeof step.type !== 'string') {
        return { steps: null, error: '' };
      }
      if (step.type === 'click') {
        builderSteps.push({
          type: 'click',
          selector: typeof step.selector === 'string' ? step.selector : '',
        });
      } else if (step.type === 'input') {
        builderSteps.push({
          type: 'input',
          selector: typeof step.selector === 'string' ? step.selector : '',
          value: typeof step.value === 'string' ? step.value : '',
        });
      } else if (step.type === 'wait') {
        builderSteps.push({
          type: 'wait',
          ms: Number.isFinite(step.ms) ? Math.max(0, Math.round(step.ms)) : 1000,
        });
      } else {
        return { steps: null, error: '' };
      }
    }
    return { steps: builderSteps };
  } catch (error) {
    return { steps: null, error: error instanceof Error ? error.message : String(error) };
  }
}
