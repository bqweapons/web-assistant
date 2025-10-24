const MAX_FLOW_STEPS = 200;
const MAX_FLOW_ITERATIONS = 50;
const MAX_FLOW_WAIT_MS = 60000;
const MAX_FLOW_SOURCE_LENGTH = 8000;

/**
 * @typedef {Object} ExistsCondition
 * @property {'exists'} kind
 * @property {string} selector
 */

/**
 * @typedef {Object} NotCondition
 * @property {'not'} kind
 * @property {FlowCondition} operand
 */

/**
 * @typedef {Object} TextContainsCondition
 * @property {'textContains'} kind
 * @property {string} selector
 * @property {string} value
 */

/**
 * @typedef {Object} AttributeEqualsCondition
 * @property {'attributeEquals'} kind
 * @property {string} selector
 * @property {string} name
 * @property {string} value
 */

/**
 * @typedef {ExistsCondition | NotCondition | TextContainsCondition | AttributeEqualsCondition} FlowCondition
 */

/**
 * @typedef {Object} ClickStep
 * @property {'click'} type
 * @property {string} selector
 * @property {boolean} all
 */

/**
 * @typedef {Object} WaitStep
 * @property {'wait'} type
 * @property {number} ms
 */

/**
 * @typedef {Object} InputStep
 * @property {'input'} type
 * @property {string} selector
 * @property {string} value
 */

/**
 * @typedef {Object} NavigateStep
 * @property {'navigate'} type
 * @property {string} url
 * @property {string | undefined} target
 */

/**
 * @typedef {Object} LogStep
 * @property {'log'} type
 * @property {string} message
 */

/**
 * @typedef {Object} IfStep
 * @property {'if'} type
 * @property {FlowCondition} condition
 * @property {FlowStep[]} thenSteps
 * @property {FlowStep[]} elseSteps
 */

/**
 * @typedef {Object} WhileStep
 * @property {'while'} type
 * @property {FlowCondition} condition
 * @property {FlowStep[]} bodySteps
 * @property {number} maxIterations
 */

/**
 * @typedef {ClickStep | WaitStep | InputStep | NavigateStep | LogStep | IfStep | WhileStep} FlowStep
 */

/**
 * @typedef {Object} FlowDefinition
 * @property {FlowStep[]} steps
 * @property {number} stepCount
 */

/**
 * Attempts to parse and normalize a flow definition from JSON.
 * @param {string} source
 * @returns {{ definition: FlowDefinition | null; error: string | null }}
 */
export function parseActionFlowDefinition(source) {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) {
    return { definition: null, error: null };
  }
  if (trimmed.length > MAX_FLOW_SOURCE_LENGTH) {
    return { definition: null, error: `Flow JSON exceeds the maximum length of ${MAX_FLOW_SOURCE_LENGTH} characters.` };
  }
  let raw;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    return { definition: null, error: 'Flow JSON is invalid.' };
  }
  try {
    const definition = normalizeFlow(raw);
    return { definition, error: null };
  } catch (error) {
    return {
      definition: null,
      error: error instanceof Error ? error.message : 'Invalid flow definition.',
    };
  }
}

/**
 * Normalizes the raw flow into a validated definition.
 * @param {unknown} raw
 * @returns {FlowDefinition}
 */
function normalizeFlow(raw) {
  const stats = { count: 0 };
  const steps = normalizeSteps(raw, 'flow', stats);
  if (steps.length === 0) {
    throw new Error('Provide at least one flow step.');
  }
  if (stats.count > MAX_FLOW_STEPS) {
    throw new Error(`Flows support at most ${MAX_FLOW_STEPS} steps.`);
  }
  return { steps, stepCount: stats.count };
}

/**
 * Normalizes a list of steps.
 * @param {unknown} raw
 * @param {string} path
 * @param {{ count: number }} stats
 * @returns {FlowStep[]}
 */
function normalizeSteps(raw, path, stats) {
  /** @type {unknown[]} */
  let entries = [];
  if (Array.isArray(raw)) {
    entries = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.steps)) {
    entries = raw.steps;
  } else if (raw && typeof raw === 'object') {
    entries = [raw];
  }
  const steps = [];
  entries.forEach((entry, index) => {
    const location = `${path}[${index}]`;
    const normalized = normalizeStep(entry, location, stats);
    if (Array.isArray(normalized)) {
      steps.push(...normalized);
    } else if (normalized) {
      steps.push(normalized);
    }
  });
  return steps;
}

/**
 * Normalizes an individual step.
 * @param {unknown} entry
 * @param {string} path
 * @param {{ count: number }} stats
 * @returns {FlowStep | FlowStep[] | null}
 */
function normalizeStep(entry, path, stats) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Flow step at ${path} must be an object.`);
  }
  const record = /** @type {Record<string, unknown>} */ (entry);
  const rawType = typeof record.type === 'string' ? record.type : typeof record.action === 'string' ? record.action : '';
  const type = rawType.trim().toLowerCase();
  switch (type) {
    case 'click': {
      stats.count += 1;
      const selector = requireString(record.selector, `Click step at ${path} requires a selector.`);
      return { type: 'click', selector, all: Boolean(record.all) };
    }
    case 'wait': {
      stats.count += 1;
      const msValue =
        record.ms ?? record.milliseconds ?? record.duration ?? record.delay ?? record.value ?? record.time ?? 0;
      const msNumber = Number(msValue);
      if (!Number.isFinite(msNumber)) {
        throw new Error(`Wait step at ${path} requires a duration in milliseconds.`);
      }
      const ms = clampNumber(Math.max(0, msNumber), 0, MAX_FLOW_WAIT_MS);
      return { type: 'wait', ms };
    }
    case 'input': {
      stats.count += 1;
      const selector = requireString(record.selector, `Input step at ${path} requires a selector.`);
      const value = requireString(record.value ?? record.text ?? '', `Input step at ${path} requires a value.`);
      return { type: 'input', selector, value };
    }
    case 'navigate': {
      stats.count += 1;
      const url = requireString(record.url ?? record.href ?? '', `Navigate step at ${path} requires a URL.`);
      const target = optionalString(record.target);
      return { type: 'navigate', url, target };
    }
    case 'log': {
      stats.count += 1;
      const message = requireString(record.message ?? record.text ?? '', `Log step at ${path} requires a message.`);
      return { type: 'log', message };
    }
    case 'if': {
      stats.count += 1;
      const condition = normalizeCondition(record.condition ?? record.test, `${path}.condition`);
      const thenSteps = normalizeSteps(record.then ?? record.thenSteps ?? record.consequent ?? [], `${path}.then`, stats);
      const elseSteps = normalizeSteps(record.else ?? record.elseSteps ?? record.alternate ?? [], `${path}.else`, stats);
      return { type: 'if', condition, thenSteps, elseSteps };
    }
    case 'while': {
      stats.count += 1;
      const condition = normalizeCondition(record.condition ?? record.test, `${path}.condition`);
      const bodySteps = normalizeSteps(record.body ?? record.steps ?? record.do ?? [], `${path}.body`, stats);
      if (bodySteps.length === 0) {
        throw new Error(`While step at ${path} requires at least one nested step.`);
      }
      const iterationValue = Number(record.maxIterations ?? record.iterations ?? record.limit ?? 10);
      const maxIterations = clampInteger(Number.isFinite(iterationValue) ? iterationValue : 10, 1, MAX_FLOW_ITERATIONS);
      return { type: 'while', condition, bodySteps, maxIterations };
    }
    case 'sequence': {
      return normalizeSteps(record.steps ?? record.body ?? record.sequence ?? [], `${path}.steps`, stats);
    }
    default:
      throw new Error(`Unsupported flow step type at ${path}: ${rawType || '(missing)'}.`);
  }
}

/**
 * Normalizes a condition entry.
 * @param {unknown} raw
 * @param {string} path
 * @returns {FlowCondition}
 */
function normalizeCondition(raw, path) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Condition at ${path} must be an object.`);
  }
  const record = /** @type {Record<string, unknown>} */ (raw);
  const rawKind = typeof record.kind === 'string' ? record.kind : typeof record.type === 'string' ? record.type : '';
  const kind = rawKind.trim().toLowerCase();
  switch (kind) {
    case 'exists': {
      const selector = requireString(record.selector, `Condition at ${path} requires a selector.`);
      return { kind: 'exists', selector };
    }
    case 'not': {
      const operand = normalizeCondition(record.operand ?? record.condition ?? record.value, `${path}.operand`);
      return { kind: 'not', operand };
    }
    case 'textcontains': {
      const selector = requireString(record.selector, `Condition at ${path} requires a selector.`);
      const value = requireString(record.value ?? record.text ?? '', `Condition at ${path} requires a value.`);
      return { kind: 'textContains', selector, value };
    }
    case 'attributeequals': {
      const selector = requireString(record.selector, `Condition at ${path} requires a selector.`);
      const name = requireString(record.name, `Condition at ${path} requires an attribute name.`);
      const value = requireString(record.value ?? record.text ?? '', `Condition at ${path} requires an attribute value.`);
      return { kind: 'attributeEquals', selector, name, value };
    }
    default:
      throw new Error(`Unsupported flow condition at ${path}: ${rawKind || '(missing)'}.`);
  }
}

/**
 * Ensures the provided value is a non-empty string.
 * @param {unknown} value
 * @param {string} message
 * @returns {string}
 */
function requireString(value, message) {
  const result = optionalString(value);
  if (!result) {
    throw new Error(message);
  }
  return result;
}

/**
 * Returns a trimmed string or undefined.
 * @param {unknown} value
 * @returns {string | undefined}
 */
function optionalString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Clamps a numeric value.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamps an integer between bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  const rounded = Math.trunc(value);
  return Math.min(Math.max(rounded, min), max);
}

export { MAX_FLOW_ITERATIONS, MAX_FLOW_SOURCE_LENGTH, MAX_FLOW_STEPS, MAX_FLOW_WAIT_MS };
