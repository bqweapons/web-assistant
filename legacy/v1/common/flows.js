const MAX_FLOW_STEPS = 200;
const MAX_FLOW_ITERATIONS = 50;
const MAX_FLOW_WAIT_MS = 10000;
const MAX_FLOW_SOURCE_LENGTH = 8000;
const FLOW_VERSION = 1;

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
 * @property {number | undefined} timeout
 * @property {number | undefined} retry
 */

/**
 * @typedef {Object} WaitStep
 * @property {'wait'} type
 * @property {number} ms
 * @property {number | undefined} timeout
 * @property {number | undefined} retry
 */

/**
 * @typedef {Object} InputStep
 * @property {'input'} type
 * @property {string} selector
 * @property {string} value
 * @property {number | undefined} timeout
 * @property {number | undefined} retry
 */

/**
 * @typedef {Object} NavigateStep
 * @property {'navigate'} type
 * @property {string} url
 * @property {string | undefined} target
 * @property {string | undefined} pageKey
 * @property {string | undefined} targetUrl
 * @property {number | undefined} timeout
 * @property {number | undefined} retry
 */

/**
 * @typedef {Object} LogStep
 * @property {'log'} type
 * @property {string} message
 * @property {number | undefined} timeout
 * @property {number | undefined} retry
 */

/**
 * @typedef {Object} AssertStep
 * @property {'assert'} type
 * @property {FlowCondition} condition
 * @property {string | undefined} message
 * @property {number | undefined} timeout
 * @property {number | undefined} retry
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
 * @typedef {ClickStep | WaitStep | InputStep | NavigateStep | LogStep | AssertStep | IfStep | WhileStep} FlowStep
 */

/**
 * @typedef {Object} FlowDefinition
 * @property {number} version
 * @property {FlowStep[]} steps
 * @property {number} stepCount
 */

/**
 * Migrates legacy flow definitions to the current version.
 * @param {any} raw
 * @returns {any}
 */
function migrateFlow(raw) {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }
  // Placeholder for future migrations; currently pass through.
  return raw;
}

/**
 * JSON 文字列からフロー定義を解析し、正規化された構造に変換する。
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
 * 生のフローデータを検証し、正規化された定義へ整形する。
 * Normalizes the raw flow into a validated definition.
 * @param {unknown} raw
 * @returns {FlowDefinition}
 */
function normalizeFlow(raw) {
  const migrated = migrateFlow(raw);
  const stats = { count: 0 };
  const steps = normalizeSteps(migrated, 'flow', stats);
  if (steps.length === 0) {
    throw new Error('Provide at least one flow step.');
  }
  if (stats.count > MAX_FLOW_STEPS) {
    throw new Error(`Flows support at most ${MAX_FLOW_STEPS} steps.`);
  }
  return { version: FLOW_VERSION, steps, stepCount: stats.count };
}

/**
 * ステップ配列を正規化し、統計情報を更新する。
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
 * 単一ステップを判別して正しい形式へ変換する。
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
  const timeout = normalizeTimeout(record.timeout ?? record.timeoutMs);
  const retry = normalizeRetry(record.retry ?? record.retries);
  switch (type) {
    case 'click': {
      stats.count += 1;
      const selector = requireString(record.selector, `Click step at ${path} requires a selector.`);
      return { type: 'click', selector, all: Boolean(record.all), timeout, retry };
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
      return { type: 'wait', ms, timeout, retry };
    }
    case 'input': {
      stats.count += 1;
      const selector = requireString(record.selector, `Input step at ${path} requires a selector.`);
      const value = requireString(record.value ?? record.text ?? '', `Input step at ${path} requires a value.`);
      return { type: 'input', selector, value, timeout, retry };
    }
    case 'navigate': {
      stats.count += 1;
      const url = requireString(record.url ?? record.href ?? '', `Navigate step at ${path} requires a URL.`);
      const target = optionalString(record.target);
      const pageKey = optionalString(record.pageKey);
      const targetUrl = optionalString(record.targetUrl);
      return { type: 'navigate', url, target, pageKey, targetUrl, timeout, retry };
    }
    case 'openpage': {
      stats.count += 1;
      const url = requireString(record.url ?? record.href ?? '', `Open page step at ${path} requires a URL.`);
      const target = optionalString(record.target);
      const pageKey = optionalString(record.pageKey);
      const targetUrl = optionalString(record.targetUrl);
      return { type: 'navigate', url, target, pageKey, targetUrl, timeout, retry };
    }
    case 'log': {
      stats.count += 1;
      const message = requireString(record.message ?? record.text ?? '', `Log step at ${path} requires a message.`);
      return { type: 'log', message, timeout, retry };
    }
    case 'assert': {
      stats.count += 1;
      const condition = normalizeCondition(record.condition ?? record.test, `${path}.condition`);
      const message = optionalString(record.message ?? record.text);
      return { type: 'assert', condition, message, timeout, retry };
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
 * 条件定義を解釈して正規化する。
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
 * 値が空でない文字列であることを確認する。
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
 * トリム済み文字列を返し、空の場合は undefined を返す。
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
 * 数値を指定範囲に収める。
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
 * 整数値を指定範囲で丸め込む。
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

/**
 * 正のタイムアウト値を正規化する、E
 * @param {unknown} raw
 * @returns {number | undefined}
 */
function normalizeTimeout(raw) {
  if (!Number.isFinite(raw)) {
    return undefined;
  }
  const value = Number(raw);
  if (value <= 0) {
    return undefined;
  }
  return value;
}

/**
 * 正のリトライ回数を正規化する、E
 * @param {unknown} raw
 * @returns {number | undefined}
 */
function normalizeRetry(raw) {
  if (!Number.isFinite(raw)) {
    return undefined;
  }
  const value = Math.max(0, Math.trunc(Number(raw)));
  return value;
}

export { MAX_FLOW_ITERATIONS, MAX_FLOW_SOURCE_LENGTH, MAX_FLOW_STEPS, MAX_FLOW_WAIT_MS };
