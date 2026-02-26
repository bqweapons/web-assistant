import { parseActionFlowDefinition } from './flows.js';

const BUILDER_STEP_TYPES = ['click', 'input', 'wait', 'navigate', 'log', 'assert'];

function coerceTimeout(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function coerceRetry(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : undefined;
}

export function createDefaultStep(type = 'click', id) {
  switch (type) {
    case 'input':
      return { id, type: 'input', selector: '', value: '', timeout: undefined, retry: undefined };
    case 'wait':
      return { id, type: 'wait', ms: 1000, timeout: undefined, retry: undefined };
    case 'navigate':
      return { id, type: 'navigate', url: '', target: '_self', timeout: undefined, retry: undefined };
    case 'log':
      return { id, type: 'log', message: '', timeout: undefined, retry: undefined };
    case 'assert':
      return {
        id,
        type: 'assert',
        condition: { kind: 'exists', selector: '' },
        message: '',
        timeout: undefined,
        retry: undefined,
      };
    case 'click':
    default:
      return { id, type: 'click', selector: '', all: false, timeout: undefined, retry: undefined };
  }
}

function sanitizeStep(step, index = 0) {
  if (!step || typeof step !== 'object') {
    return createDefaultStep('click', `step-${index}`);
  }
  const base = { ...step };
  const type = typeof base.type === 'string' && BUILDER_STEP_TYPES.includes(base.type) ? base.type : 'click';
  const normalized = createDefaultStep(type, base.id || `step-${index}`);

  if (typeof base.selector === 'string') {
    normalized.selector = base.selector;
  }
  if (typeof base.value === 'string') {
    normalized.value = base.value;
  }
  if (typeof base.ms === 'number') {
    normalized.ms = Math.max(0, Math.trunc(base.ms));
  }
  if (typeof base.url === 'string') {
    normalized.url = base.url;
  }
  if (typeof base.target === 'string') {
    normalized.target = base.target;
  }
  if (typeof base.message === 'string') {
    normalized.message = base.message;
  }
  if (base.condition && typeof base.condition === 'object') {
    const selector = typeof base.condition.selector === 'string' ? base.condition.selector : '';
    normalized.condition = { kind: 'exists', selector };
  }
  normalized.all = Boolean(base.all);
  normalized.timeout = coerceTimeout(base.timeout ?? base.timeoutMs);
  normalized.retry = coerceRetry(base.retry ?? base.retries);
  return normalized;
}

export function normalizeBuilderSteps(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.steps)) {
    list = raw.steps;
  }
  return list.map((entry, index) => sanitizeStep(entry, index));
}

export function serializeBuilderSteps(rawSteps) {
  const steps = normalizeBuilderSteps(rawSteps).map(({ id, ...rest }) => rest);
  return JSON.stringify({ steps }, null, 2);
}

export function parseBuilderSteps(source) {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) {
    return { steps: [] };
  }
  try {
    const parsed = JSON.parse(trimmed);
    const steps = normalizeBuilderSteps(parsed);
    return { steps };
  } catch (error) {
    return { steps: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export { BUILDER_STEP_TYPES };

/**
 * Parses either a JSON builder payload or a full flow definition string into builder steps.
 * @param {string | undefined | null} source
 * @returns {ReturnType<typeof normalizeBuilderSteps>}
 */
export function builderStepsFromSource(source) {
  const raw = typeof source === 'string' ? source : '';
  if (!raw.trim()) {
    return [];
  }
  const parsed = parseBuilderSteps(raw);
  if (parsed.steps) {
    return parsed.steps;
  }
  const { definition } = parseActionFlowDefinition(raw);
  if (definition && Array.isArray(definition.steps)) {
    return normalizeBuilderSteps(definition.steps);
  }
  return [];
}

/**
 * Validates builder steps and returns normalized steps plus any validation errors.
 * @param {ReturnType<typeof normalizeBuilderSteps> | any[]} rawSteps
 * @returns {{ valid: boolean; steps: ReturnType<typeof normalizeBuilderSteps>; errors: Array<{ index: number; code: string; message: string }> }}
 */
export function validateBuilderSteps(rawSteps) {
  const steps = normalizeBuilderSteps(rawSteps);
  const errors = [];
  const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

  steps.forEach((step, index) => {
    switch (step.type) {
      case 'click':
        if (!isNonEmptyString(step.selector)) {
          errors.push({
            index,
            code: 'missing_selector',
            message: `Step #${index + 1} requires a selector.`,
          });
        }
        break;
      case 'input':
        if (!isNonEmptyString(step.selector)) {
          errors.push({
            index,
            code: 'missing_selector',
            message: `Step #${index + 1} requires a selector.`,
          });
        }
        if (!isNonEmptyString(step.value)) {
          errors.push({
            index,
            code: 'missing_value',
            message: `Step #${index + 1} requires input text.`,
          });
        }
        break;
      case 'wait': {
        const ms = Number(step.ms);
        if (!Number.isFinite(ms) || ms < 0) {
          errors.push({
            index,
            code: 'invalid_wait',
            message: `Step #${index + 1} requires a non-negative wait time.`,
          });
        }
        break;
      }
      case 'navigate':
        if (!isNonEmptyString(step.url)) {
          errors.push({
            index,
            code: 'missing_url',
            message: `Step #${index + 1} requires a URL.`,
          });
        }
        break;
      case 'log':
        if (!isNonEmptyString(step.message)) {
          errors.push({
            index,
            code: 'missing_message',
            message: `Step #${index + 1} requires a log message.`,
          });
        }
        break;
      case 'assert': {
        const condition = step.condition || {};
        const kind = typeof condition.kind === 'string' ? condition.kind : '';
        if (kind === 'exists') {
          if (!isNonEmptyString(condition.selector)) {
            errors.push({
              index,
              code: 'missing_selector',
              message: `Step #${index + 1} requires a selector.`,
            });
          }
        } else {
          errors.push({
            index,
            code: 'invalid_condition',
            message: `Step #${index + 1} requires a valid condition.`,
          });
        }
        break;
      }
      default:
        break;
    }
  });

  return { valid: errors.length === 0, steps, errors };
}
