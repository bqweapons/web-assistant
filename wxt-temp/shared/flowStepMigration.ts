type JsonRecord = Record<string, unknown>;

export type FlowStepField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox';
  withPicker?: boolean;
  options?: Array<{ value: string; label: string }>;
  showWhen?: { fieldId: string; value?: string; values?: string[] };
};

export type FlowDataSourceMeta = {
  fileName?: string;
  fileType?: 'csv' | 'tsv';
  columns?: string[];
  rowCount?: number;
  error?: string;
  rawText?: string;
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
  return normalized;
};

export const isFlowStepData = (value: unknown): value is FlowStepData =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
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
  const type = typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : 'step';
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
