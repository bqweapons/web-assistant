import type {
  FlowConditionOperator,
  FlowRunAtomicStepType,
  FlowRunExecuteResultPayload,
  FlowRunExecuteStepPayload,
} from '../../shared/messages';

const DEFAULT_ACTION_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 120;

const sleep = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.max(0, durationMs));
  });

const asString = (value: unknown) => (typeof value === 'string' ? value : String(value ?? ''));

const normalizeText = (value: unknown) => asString(value).trim();

const toNumber = (value: unknown) => {
  const parsed = Number(normalizeText(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const readElementValue = (element: Element) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value ?? '';
  }
  return (element.textContent || '').trim();
};

const getElementLabel = (element: Element) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return (
      normalizeText(element.getAttribute('aria-label')) ||
      normalizeText(element.getAttribute('name')) ||
      normalizeText(element.id) ||
      normalizeText(element.getAttribute('placeholder')) ||
      element.tagName.toLowerCase()
    );
  }
  if (element instanceof HTMLElement) {
    return (
      normalizeText(element.innerText || element.textContent || '') ||
      normalizeText(element.getAttribute('aria-label')) ||
      normalizeText(element.getAttribute('title')) ||
      normalizeText(element.id) ||
      element.tagName.toLowerCase()
    );
  }
  return element.nodeName.toLowerCase();
};

const isSupportedInputTarget = (element: Element) =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement ||
  (element instanceof HTMLElement && element.isContentEditable);

const applySelectValue = (element: HTMLSelectElement, rawValue: string) => {
  const options = Array.from(element.options);
  const trimmed = normalizeText(rawValue);
  let matched =
    options.find((option) => option.value === rawValue) ||
    options.find((option) => normalizeText(option.label || option.textContent || '') === trimmed);
  if (!matched && trimmed) {
    const lowered = trimmed.toLowerCase();
    matched = options.find(
      (option) => normalizeText(option.label || option.textContent || '').toLowerCase() === lowered,
    );
  }
  if (!matched) {
    return false;
  }
  element.value = matched.value;
  if (element.value !== matched.value) {
    matched.selected = true;
  }
  return true;
};

const queryBySelector = (selector: string) => {
  try {
    return { element: document.querySelector(selector), errorCode: '' };
  } catch {
    return { element: null, errorCode: 'invalid-selector' };
  }
};

const waitForSelector = async (
  selector: string,
  timeoutMs: number,
  pollIntervalMs: number,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const queried = queryBySelector(selector);
    if (queried.errorCode) {
      return queried;
    }
    if (queried.element) {
      return queried;
    }
    await sleep(pollIntervalMs);
  }
  return { element: null, errorCode: '' };
};

const compareByOperator = (actual: string, expected: string, operator: FlowConditionOperator) => {
  if (operator === 'contains') {
    return actual.includes(expected);
  }
  if (operator === 'equals') {
    return actual === expected;
  }
  const left = toNumber(actual);
  const right = toNumber(expected);
  if (left === null || right === null) {
    return false;
  }
  if (operator === 'greater') {
    return left > right;
  }
  if (operator === 'less') {
    return left < right;
  }
  return false;
};

const buildBaseResult = (
  payload: FlowRunExecuteStepPayload,
  overrides: Partial<FlowRunExecuteResultPayload>,
): FlowRunExecuteResultPayload => ({
  ok: false,
  runId: payload.runId,
  requestId: payload.requestId,
  stepId: payload.stepId,
  stepType: payload.stepType,
  ...overrides,
});

const executeClick = async (payload: FlowRunExecuteStepPayload): Promise<FlowRunExecuteResultPayload> => {
  const selector = normalizeText(payload.selector);
  if (!selector) {
    return buildBaseResult(payload, { errorCode: 'missing-selector', error: 'Selector is required.' });
  }
  const timeoutMs = payload.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
  const pollIntervalMs = payload.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const queried = await waitForSelector(selector, timeoutMs, pollIntervalMs);
  if (queried.errorCode) {
    return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
  }
  if (!queried.element) {
    return buildBaseResult(payload, { errorCode: 'selector-not-found', error: 'Element not found.' });
  }
  if (queried.element instanceof HTMLElement) {
    queried.element.click();
  } else {
    queried.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  return buildBaseResult(payload, {
    ok: true,
    details: {
      selector,
      elementText: getElementLabel(queried.element),
    },
  });
};

const executeInput = async (payload: FlowRunExecuteStepPayload): Promise<FlowRunExecuteResultPayload> => {
  const selector = normalizeText(payload.selector);
  if (!selector) {
    return buildBaseResult(payload, { errorCode: 'missing-selector', error: 'Selector is required.' });
  }
  const timeoutMs = payload.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
  const pollIntervalMs = payload.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const queried = await waitForSelector(selector, timeoutMs, pollIntervalMs);
  if (queried.errorCode) {
    return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
  }
  if (!queried.element) {
    return buildBaseResult(payload, { errorCode: 'selector-not-found', error: 'Element not found.' });
  }
  if (!isSupportedInputTarget(queried.element)) {
    return buildBaseResult(payload, { errorCode: 'input-target-invalid', error: 'Target is not an input control.' });
  }
  const nextValue = asString(payload.value ?? '');
  const fieldName = getElementLabel(queried.element);
  if (queried.element instanceof HTMLInputElement || queried.element instanceof HTMLTextAreaElement) {
    queried.element.focus();
    queried.element.value = nextValue;
    queried.element.dispatchEvent(new Event('input', { bubbles: true }));
    queried.element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (queried.element instanceof HTMLSelectElement) {
    queried.element.focus();
    if (!applySelectValue(queried.element, nextValue)) {
      return buildBaseResult(payload, {
        errorCode: 'select-option-not-found',
        error: 'No option matched the provided value.',
      });
    }
    queried.element.dispatchEvent(new Event('input', { bubbles: true }));
    queried.element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (queried.element instanceof HTMLElement && queried.element.isContentEditable) {
    queried.element.focus();
    queried.element.textContent = nextValue;
    queried.element.dispatchEvent(new Event('input', { bubbles: true }));
    queried.element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return buildBaseResult(payload, {
    ok: true,
    details: {
      selector,
      fieldName,
      inputValue: nextValue,
    },
  });
};

const executePopup = async (payload: FlowRunExecuteStepPayload): Promise<FlowRunExecuteResultPayload> => {
  const message = asString(payload.message ?? '');
  window.alert(message);
  return buildBaseResult(payload, {
    ok: true,
    details: {
      popupMessage: message,
    },
  });
};

const evaluateConditionFromElement = (
  payload: FlowRunExecuteStepPayload,
  element: Element,
): FlowRunExecuteResultPayload => {
  const operator = payload.operator ?? 'contains';
  const expected = asString(payload.expected ?? '');
  const actual = readElementValue(element);
  const matched = compareByOperator(actual, expected, operator);
  return buildBaseResult(payload, {
    ok: true,
    conditionMatched: matched,
    actual,
    details: {
      selector: normalizeText(payload.selector),
      operator,
      expected,
      actual,
    },
  });
};

const executeAssert = async (payload: FlowRunExecuteStepPayload): Promise<FlowRunExecuteResultPayload> => {
  const selector = normalizeText(payload.selector);
  if (!selector) {
    return buildBaseResult(payload, { errorCode: 'missing-selector', error: 'Selector is required.' });
  }
  const timeoutMs = payload.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
  const pollIntervalMs = payload.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const queried = await waitForSelector(selector, timeoutMs, pollIntervalMs);
  if (queried.errorCode) {
    return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
  }
  if (!queried.element) {
    return buildBaseResult(payload, { errorCode: 'selector-not-found', error: 'Element not found.' });
  }
  const evaluated = evaluateConditionFromElement(payload, queried.element);
  if (!evaluated.conditionMatched) {
    return buildBaseResult(payload, {
      errorCode: 'assertion-failed',
      error: 'Assertion failed.',
      actual: evaluated.actual,
      conditionMatched: false,
    });
  }
  return evaluated;
};

const executeCondition = async (payload: FlowRunExecuteStepPayload): Promise<FlowRunExecuteResultPayload> => {
  const selector = normalizeText(payload.selector);
  if (!selector) {
    return buildBaseResult(payload, { errorCode: 'missing-selector', error: 'Selector is required.' });
  }
  const timeoutMs = payload.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
  const pollIntervalMs = payload.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const queried = await waitForSelector(selector, timeoutMs, pollIntervalMs);
  if (queried.errorCode) {
    return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
  }
  if (!queried.element) {
    return buildBaseResult(payload, { ok: true, conditionMatched: false });
  }
  return evaluateConditionFromElement(payload, queried.element);
};

const executeWait = async (payload: FlowRunExecuteStepPayload): Promise<FlowRunExecuteResultPayload> => {
  const mode = payload.mode ?? 'time';
  if (mode === 'time') {
    const duration = Number(payload.durationMs ?? 0);
    const normalizedDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    await sleep(normalizedDuration);
    return buildBaseResult(payload, {
      ok: true,
      details: {
        mode: 'time',
        durationMs: normalizedDuration,
      },
    });
  }

  const selector = normalizeText(payload.selector);
  if (!selector) {
    return buildBaseResult(payload, { errorCode: 'missing-selector', error: 'Selector is required.' });
  }
  const timeoutMs = payload.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
  const pollIntervalMs = payload.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  if (mode === 'appear') {
    while (Date.now() - startedAt <= timeoutMs) {
      const queried = queryBySelector(selector);
      if (queried.errorCode) {
        return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
      }
      if (queried.element) {
        return buildBaseResult(payload, {
          ok: true,
          conditionMatched: true,
          details: {
            selector,
            mode: 'appear',
            elementText: getElementLabel(queried.element),
          },
        });
      }
      await sleep(pollIntervalMs);
    }
    return buildBaseResult(payload, {
      errorCode: 'wait-appear-timeout',
      error: 'Timed out waiting for selector to appear.',
    });
  }

  if (mode === 'disappear') {
    while (Date.now() - startedAt <= timeoutMs) {
      const queried = queryBySelector(selector);
      if (queried.errorCode) {
        return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
      }
      if (!queried.element) {
        return buildBaseResult(payload, {
          ok: true,
          conditionMatched: true,
          details: {
            selector,
            mode: 'disappear',
          },
        });
      }
      await sleep(pollIntervalMs);
    }
    return buildBaseResult(payload, {
      errorCode: 'wait-disappear-timeout',
      error: 'Timed out waiting for selector to disappear.',
    });
  }

  while (Date.now() - startedAt <= timeoutMs) {
    const queried = queryBySelector(selector);
    if (queried.errorCode) {
      return buildBaseResult(payload, { errorCode: queried.errorCode, error: 'Selector is invalid.' });
    }
    if (queried.element) {
      const evaluated = evaluateConditionFromElement(payload, queried.element);
      if (evaluated.conditionMatched) {
        return evaluated;
      }
    }
    await sleep(pollIntervalMs);
  }
  return buildBaseResult(payload, { errorCode: 'wait-condition-timeout', error: 'Condition wait timed out.' });
};

const executeByType: Record<
  FlowRunAtomicStepType,
  (payload: FlowRunExecuteStepPayload) => Promise<FlowRunExecuteResultPayload>
> = {
  click: executeClick,
  input: executeInput,
  popup: executePopup,
  wait: executeWait,
  assert: executeAssert,
  condition: executeCondition,
};

export const executeFlowRunStep = async (
  payload: FlowRunExecuteStepPayload,
): Promise<FlowRunExecuteResultPayload> => {
  const handler = executeByType[payload.stepType];
  if (!handler) {
    return {
      ok: false,
      runId: payload.runId,
      requestId: payload.requestId,
      stepId: payload.stepId,
      stepType: payload.stepType,
      errorCode: 'unsupported-step-type',
      error: `Unsupported step type: ${payload.stepType}`,
    };
  }
  try {
    return await handler(payload);
  } catch (error) {
    return {
      ok: false,
      runId: payload.runId,
      requestId: payload.requestId,
      stepId: payload.stepId,
      stepType: payload.stepType,
      errorCode: 'step-execution-exception',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
