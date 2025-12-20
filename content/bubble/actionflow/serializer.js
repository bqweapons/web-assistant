import { normalizeBuilderSteps, parseBuilderSteps, serializeBuilderSteps } from '../../../common/flow-builder.js';

/**
 * Serializes builder steps into the JSON action-flow payload.
 * @param {Array<{ type: string }>} steps
 * @returns {string}
 */
export function stepsToJSON(steps) {
  return serializeBuilderSteps(steps);
}

/**
 * Attempts to parse a JSON action-flow definition back into builder steps.
 * @param {string} source
 * @returns {{ steps: ReturnType<typeof normalizeBuilderSteps> | null; error?: string }}
 */
export function jsonToSteps(source) {
  const parsed = parseBuilderSteps(source);
  return { steps: parsed.steps, error: parsed.error };
}
