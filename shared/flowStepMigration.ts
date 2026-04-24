type JsonRecord = Record<string, unknown>;

// 2.4 — Authoritative list of step `type` values that user-authored flows can
// carry. Source of truth is `createStepTemplate` in ui templates.ts. Anything
// else (including `__proto__`, `constructor`, or arbitrary legacy keys) is
// rejected at import / normalization time; downstream `executeStep` would
// fail at runtime anyway with `unsupported-step-type`, but dropping at the
// boundary keeps storage clean and protects against future code paths that
// might trust `step.type` without re-validating.
// Intentionally excluded: `condition` and `read` are payload-level stepType
// values the runner builds internally (see buildReadPayload, condition
// payloads in buildAtomicPayload). Users never author them.
const VALID_USER_STEP_TYPES = new Set<string>([
  'click',
  'input',
  'wait',
  'assert',
  'popup',
  'navigate',
  'loop',
  'if-else',
  'data-source',
  'set-variable',
]);
const isValidStepType = (value: unknown): value is string =>
  typeof value === 'string' && VALID_USER_STEP_TYPES.has(value);

export type FlowStepField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox';
  withPicker?: boolean;
  options?: Array<{ value: string; label: string }>;
  showWhen?: { fieldId: string; value?: string; values?: string[] };
  transform?: {
    mode: 'js';
    code: string;
    enabled?: boolean;
    timeoutMs?: number;
  };
};

export type FlowDataSourceMeta = {
  fileName?: string;
  fileType?: 'csv' | 'tsv';
  columns?: string[];
  rowCount?: number;
  error?: string;
  rawText?: string;
};

// F1 — Optional frame locator persisted on a step. Populated by the
// recorder / picker when the captured element lives inside an iframe;
// resolved back to a concrete `frameId` at dispatch time via the
// runner's `FLOW_RUN_FRAME_PROBE` pass. Field name is `url` (not
// `frameUrl`) to line up with the existing element `context.frame.url`
// shape and to leave room for future sibling fields without renaming.
export type FlowStepTargetFrame = {
  url: string;
};

export type FlowStepData = {
  id: string;
  type: string;
  title: string;
  summary: string;
  fields: FlowStepField[];
  dataSource?: FlowDataSourceMeta;
  children?: FlowStepData[];
  branches?: Array<{ id: string; label: string; steps: FlowStepData[] }>;
  targetFrame?: FlowStepTargetFrame;
};

export type NormalizeFlowStepsOptions = {
  flowId?: string;
  keepNumber?: boolean;
  sanitizeExisting?: boolean;
  idFactory?: (prefix: string) => string;
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const defaultIdFactory = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const asText = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

const buildLegacySummary = (type: string, selector: string, value: string) => {
  if (type === 'input') {
    return value ? `Value: ${value}` : selector ? `Selector: ${selector}` : 'Input';
  }
  if (type === 'set-variable') {
    return selector ? `Set ${selector} = ${value}` : 'Variable not set';
  }
  if (type === 'click') {
    return selector ? `Selector: ${selector}` : 'Click';
  }
  if (type === 'navigate') {
    return value ? `URL: ${value}` : 'Navigate';
  }
  if (type === 'wait') {
    return value ? `Duration: ${value} ms` : selector ? `Wait for: ${selector}` : 'Wait';
  }
  return type ? `Legacy ${type} step` : 'Legacy step';
};

const isFlowStepField = (value: unknown): value is FlowStepField =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.value === 'string';

const normalizeFlowStepField = (raw: unknown, idFactory: (prefix: string) => string): FlowStepField | null => {
  if (!isFlowStepField(raw)) {
    return null;
  }
  const normalized: FlowStepField = {
    id: raw.id.trim() || idFactory('field-import'),
    label: raw.label,
    value: raw.value,
  };
  if (typeof raw.placeholder === 'string') {
    normalized.placeholder = raw.placeholder;
  }
  if (
    raw.type === 'text' ||
    raw.type === 'number' ||
    raw.type === 'textarea' ||
    raw.type === 'select' ||
    raw.type === 'checkbox'
  ) {
    normalized.type = raw.type;
  }
  if (typeof raw.withPicker === 'boolean') {
    normalized.withPicker = raw.withPicker;
  }
  if (Array.isArray(raw.options)) {
    normalized.options = raw.options
      .map((option) => {
        if (!isRecord(option)) {
          return null;
        }
        if (typeof option.value !== 'string' || typeof option.label !== 'string') {
          return null;
        }
        return { value: option.value, label: option.label };
      })
      .filter((item): item is { value: string; label: string } => Boolean(item));
  }
  if (isRecord(raw.showWhen) && typeof raw.showWhen.fieldId === 'string') {
    const showWhen: FlowStepField['showWhen'] = { fieldId: raw.showWhen.fieldId };
    if (typeof raw.showWhen.value === 'string') {
      showWhen.value = raw.showWhen.value;
    }
    if (Array.isArray(raw.showWhen.values)) {
      showWhen.values = raw.showWhen.values.filter((item): item is string => typeof item === 'string');
    }
    normalized.showWhen = showWhen;
  }
  if (
    isRecord(raw.transform) &&
    raw.transform.mode === 'js' &&
    typeof raw.transform.code === 'string'
  ) {
    const transform: NonNullable<FlowStepField['transform']> = {
      mode: 'js',
      code: raw.transform.code,
    };
    if (typeof raw.transform.enabled === 'boolean') {
      transform.enabled = raw.transform.enabled;
    }
    if (typeof raw.transform.timeoutMs === 'number' && Number.isFinite(raw.transform.timeoutMs)) {
      transform.timeoutMs = raw.transform.timeoutMs;
    }
    normalized.transform = transform;
  }
  return normalized;
};

const findFieldById = (fields: FlowStepField[], fieldId: string) =>
  fields.find((field) => field.id === fieldId);

const normalizeSetVariableFields = (fields: FlowStepField[]): FlowStepField[] => {
  const nameField = findFieldById(fields, 'name');
  const selectorField = findFieldById(fields, 'selector');
  const valueField = findFieldById(fields, 'value');
  const sourceModeField = findFieldById(fields, 'sourceMode');
  const fallbackMode = selectorField?.value?.trim() ? 'selector' : 'value';
  const sourceMode =
    sourceModeField?.value === 'selector' || sourceModeField?.value === 'value'
      ? sourceModeField.value
      : fallbackMode;

  return [
    {
      id: 'name',
      label: nameField?.label || 'Name',
      value: nameField?.value || '',
      placeholder: nameField?.placeholder || 'username',
      type: 'text',
    },
    {
      id: 'sourceMode',
      label: sourceModeField?.label || 'Source',
      value: sourceMode,
      type: 'select',
      options: [
        { value: 'value', label: 'Value' },
        { value: 'selector', label: 'Selector' },
      ],
    },
    {
      id: 'selector',
      label: selectorField?.label || 'Selector',
      value: selectorField?.value || '',
      placeholder: selectorField?.placeholder || '.user-email',
      type: 'text',
      withPicker: true,
      showWhen: { fieldId: 'sourceMode', value: 'selector' },
    },
    {
      id: 'value',
      label: valueField?.label || 'Value',
      value: valueField?.value || '',
      placeholder: valueField?.placeholder || '{{row.email}}',
      type: valueField?.type === 'number' ? 'number' : 'text',
      transform: valueField?.transform,
      showWhen: { fieldId: 'sourceMode', value: 'value' },
    },
  ];
};

export const isFlowStepData = (value: unknown): value is FlowStepData =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  // 2.4 — reject unknown step types at the predicate level so both
  // normalizeExistingFlowStep (which guards on isFlowStepData) and any other
  // downstream gate refuses to accept e.g. `__proto__` or arbitrary legacy
  // names. Keeps the storage invariant "every FlowStepData.type is runnable".
  isValidStepType(value.type) &&
  typeof value.title === 'string' &&
  typeof value.summary === 'string' &&
  Array.isArray(value.fields) &&
  value.fields.every((field) => isFlowStepField(field));

const normalizeExistingFlowStep = (
  raw: unknown,
  idFactory: (prefix: string) => string,
): FlowStepData | null => {
  if (!isFlowStepData(raw)) {
    return null;
  }
  const normalized: FlowStepData = {
    id: raw.id.trim() || idFactory('step-import'),
    type: raw.type.trim() || 'step',
    title: raw.title || 'Step',
    summary: raw.summary || raw.title || 'Step',
    fields: raw.fields
      .map((field) => normalizeFlowStepField(field, idFactory))
      .filter((field): field is FlowStepField => Boolean(field)),
  };
  if (normalized.type === 'set-variable') {
    normalized.fields = normalizeSetVariableFields(normalized.fields);
  }
  if (Array.isArray(raw.children)) {
    const children = raw.children
      .map((child) => normalizeExistingFlowStep(child, idFactory))
      .filter((child): child is FlowStepData => Boolean(child));
    if (children.length > 0) {
      normalized.children = children;
    }
  }
  if (Array.isArray(raw.branches)) {
    const branches = raw.branches
      .map((branch) => {
        if (!isRecord(branch) || typeof branch.id !== 'string' || typeof branch.label !== 'string') {
          return null;
        }
        const steps = Array.isArray(branch.steps)
          ? branch.steps
              .map((step) => normalizeExistingFlowStep(step, idFactory))
              .filter((step): step is FlowStepData => Boolean(step))
          : [];
        return {
          id: branch.id.trim() || idFactory('branch-import'),
          label: branch.label || 'Branch',
          steps,
        };
      })
      .filter(
        (branch): branch is { id: string; label: string; steps: FlowStepData[] } => Boolean(branch),
      );
    if (branches.length > 0) {
      normalized.branches = branches;
    }
  }
  // F1 — preserve targetFrame through normalization. Structural check
  // only: we trust the `url` string; the runner will probe frames at
  // dispatch time and cope with stale / unreachable URLs there.
  if (isRecord(raw.targetFrame) && typeof (raw.targetFrame as { url?: unknown }).url === 'string') {
    const url = (raw.targetFrame as { url: string }).url.trim();
    if (url) {
      normalized.targetFrame = { url };
    }
  }
  if (isRecord(raw.dataSource)) {
    normalized.dataSource = {};
    if (typeof raw.dataSource.fileName === 'string') {
      normalized.dataSource.fileName = raw.dataSource.fileName;
    }
    if (raw.dataSource.fileType === 'csv' || raw.dataSource.fileType === 'tsv') {
      normalized.dataSource.fileType = raw.dataSource.fileType;
    }
    if (Array.isArray(raw.dataSource.columns)) {
      normalized.dataSource.columns = raw.dataSource.columns.filter(
        (column): column is string => typeof column === 'string',
      );
    }
    if (typeof raw.dataSource.rowCount === 'number' && Number.isFinite(raw.dataSource.rowCount)) {
      normalized.dataSource.rowCount = raw.dataSource.rowCount;
    }
    if (typeof raw.dataSource.error === 'string') {
      normalized.dataSource.error = raw.dataSource.error;
    }
    if (typeof raw.dataSource.rawText === 'string') {
      normalized.dataSource.rawText = raw.dataSource.rawText;
    }
  }
  return normalized;
};

const normalizeLegacyActionStep = (
  raw: unknown,
  index: number,
  flowId: string,
): FlowStepData | null => {
  if (!isRecord(raw)) {
    return null;
  }
  // 2.4 — Drop legacy steps with unknown types entirely instead of wrapping
  // them in a generic "Legacy step" shell. The generic fallback used to
  // accept any type string including `__proto__` / arbitrary garbage; that
  // storage would later fail at runtime with `unsupported-step-type` anyway,
  // so rejecting at import is both safer and cleaner (less zombie data).
  // Historical aliases from older extension versions (open/goto → navigate)
  // are normalized *before* the whitelist check so legit old data still
  // imports cleanly.
  const rawType = typeof raw.type === 'string' ? raw.type.trim() : '';
  const canonicalType = rawType === 'open' || rawType === 'goto' ? 'navigate' : rawType;
  if (!isValidStepType(canonicalType)) {
    return null;
  }
  const type = canonicalType;
  const selector = asText(raw.selector);
  const stepId = `${flowId}-legacy-step-${index + 1}`;
  const baseFields: FlowStepField[] = [];

  if (selector) {
    baseFields.push({
      id: 'selector',
      label: 'Selector',
      value: selector,
      type: 'text',
      withPicker: true,
    });
  }

  if (type === 'input') {
    const value = asText(raw.value);
    return {
      id: stepId,
      type: 'input',
      title: 'Fill input',
      summary: buildLegacySummary('input', selector, value),
      fields: [
        ...baseFields,
        {
          id: 'value',
          label: 'Value',
          value,
          type: 'text',
        },
      ],
    };
  }

  if (type === 'set-variable') {
    const name = asText(raw.name);
    const value = asText(raw.value);
    const selectorValue = asText(raw.selector);
    const sourceMode = selectorValue ? 'selector' : 'value';
    return {
      id: stepId,
      type: 'set-variable',
      title: 'Set Variable',
      summary: buildLegacySummary('set-variable', name, value),
      fields: [
        {
          id: 'name',
          label: 'Name',
          value: name,
          type: 'text',
        },
        {
          id: 'sourceMode',
          label: 'Source',
          value: sourceMode,
          type: 'select',
          options: [
            { value: 'value', label: 'Value' },
            { value: 'selector', label: 'Selector' },
          ],
        },
        {
          id: 'selector',
          label: 'Selector',
          value: selectorValue,
          type: 'text',
          withPicker: true,
          showWhen: { fieldId: 'sourceMode', value: 'selector' },
        },
        {
          id: 'value',
          label: 'Value',
          value,
          type: 'text',
          showWhen: { fieldId: 'sourceMode', value: 'value' },
        },
      ],
    };
  }

  if (type === 'click') {
    const fields = [...baseFields];
    if (typeof raw.all === 'boolean') {
      fields.push({
        id: 'all',
        label: 'All matches',
        value: raw.all ? 'true' : 'false',
        type: 'checkbox',
      });
    }
    return {
      id: stepId,
      type: 'click',
      title: 'Click element',
      summary: buildLegacySummary('click', selector, ''),
      fields,
    };
  }

  if (type === 'wait') {
    const duration = asText(raw.duration || raw.timeout || raw.timeoutMs || raw.ms);
    const mode = selector ? 'condition' : 'time';
    const fields: FlowStepField[] = [
      {
        id: 'mode',
        label: 'Wait for',
        value: mode,
        type: 'select',
      },
    ];
    if (duration) {
      fields.push({
        id: 'duration',
        label: 'Duration (ms)',
        value: duration,
        type: 'number',
      });
    }
    if (selector) {
      fields.push({
        id: 'selector',
        label: 'Selector',
        value: selector,
        type: 'text',
        withPicker: true,
      });
    }
    return {
      id: stepId,
      type: 'wait',
      title: 'Wait',
      summary: buildLegacySummary('wait', selector, duration),
      fields,
    };
  }

  if (type === 'navigate' || type === 'open' || type === 'goto') {
    const url = asText(raw.url || raw.href || raw.value);
    return {
      id: stepId,
      type: 'navigate',
      title: 'Navigate',
      summary: buildLegacySummary('navigate', '', url),
      fields: [
        {
          id: 'url',
          label: 'URL',
          value: url,
          type: 'text',
        },
      ],
    };
  }

  const fallbackFields = Object.entries(raw)
    .filter(([key]) => key !== 'type')
    .map(([key, value]) => ({
      id: key,
      label: key,
      value: asText(value),
      type: 'text' as const,
    }))
    .filter((field) => field.value);

  return {
    id: stepId,
    type,
    title: type ? `Legacy ${type} step` : 'Legacy step',
    summary: buildLegacySummary(type, selector, ''),
    fields: fallbackFields,
  };
};

export const normalizeFlowSteps = (
  rawSteps: unknown,
  options: NormalizeFlowStepsOptions = {},
): FlowStepData[] | number => {
  const keepNumber = options.keepNumber ?? true;
  const sanitizeExisting = options.sanitizeExisting ?? false;
  const idFactory = options.idFactory ?? defaultIdFactory;
  const flowId = options.flowId?.trim() || idFactory('flow');

  if (keepNumber && typeof rawSteps === 'number' && Number.isFinite(rawSteps)) {
    return rawSteps;
  }
  if (!Array.isArray(rawSteps)) {
    return [];
  }

  if (!sanitizeExisting && rawSteps.every((step) => isFlowStepData(step))) {
    return rawSteps as FlowStepData[];
  }

  return rawSteps
    .map((step, index) => {
      if (isFlowStepData(step)) {
        return sanitizeExisting ? normalizeExistingFlowStep(step, idFactory) : step;
      }
      return normalizeLegacyActionStep(step, index, flowId);
    })
    .filter((step): step is FlowStepData => Boolean(step));
};
