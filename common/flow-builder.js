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
