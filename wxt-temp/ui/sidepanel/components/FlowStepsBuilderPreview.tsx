import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import SelectMenu from './SelectMenu';

type StepFieldOption = {
  value: string;
  label: string;
};

type StepField = {
  id: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  value: string;
  withPicker?: boolean;
  options?: StepFieldOption[];
  showWhen?: { fieldId: string; value: string };
};

type DataSourceMeta = {
  fileName?: string;
  columns?: string[];
  rowCount?: number;
  error?: string;
};

type StepData = {
  id: string;
  type: string;
  title: string;
  summary: string;
  fields: StepField[];
  children?: StepData[];
  branches?: Array<{ id: string; label: string; steps: StepData[] }>;
  dataSource?: DataSourceMeta;
};

const WAIT_MODES: StepFieldOption[] = [
  { value: 'time', label: 'Time delay' },
  { value: 'condition', label: 'Element condition' },
];

const CONDITION_OPERATORS: StepFieldOption[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'greater', label: 'Greater than' },
  { value: 'less', label: 'Less than' },
];

const DATA_SOURCE_TYPES: StepFieldOption[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' },
  { value: 'json', label: 'JSON' },
];

const HEADER_ROW_OPTIONS: StepFieldOption[] = [
  { value: 'header', label: 'Header row' },
  { value: 'none', label: 'No header' },
];

const DEFAULT_STEPS: StepData[] = [
  {
    id: 'step-ds-1',
    type: 'data-source',
    title: 'Load data source',
    summary: 'Awaiting file selection',
    fields: [
      { id: 'sourceType', label: 'Source type', type: 'select', value: 'csv', options: DATA_SOURCE_TYPES },
      { id: 'headerRow', label: 'Header row (CSV/TSV)', type: 'select', value: 'header', options: HEADER_ROW_OPTIONS },
      {
        id: 'jsonPath',
        label: 'JSON path',
        placeholder: 'data.items',
        type: 'text',
        value: '',
        showWhen: { fieldId: 'sourceType', value: 'json' },
      },
    ],
    dataSource: {
      fileName: '',
      columns: [],
      rowCount: 0,
    },
    children: [
      {
        id: 'step-ds-1-1',
        type: 'input',
        title: 'Fill title field',
        summary: 'Value: {{row.title}}',
        fields: [
          {
            id: 'selector',
            label: 'Selector',
            placeholder: 'input[name="title"]',
            type: 'text',
            value: 'input[name="title"]',
            withPicker: true,
          },
          { id: 'value', label: 'Value', placeholder: '{{row.title}}', type: 'text', value: '{{row.title}}' },
        ],
      },
      {
        id: 'step-ds-1-2',
        type: 'click',
        title: 'Submit row',
        summary: 'Selector: button[type="submit"]',
        fields: [
          {
            id: 'selector',
            label: 'Selector',
            placeholder: 'button[type="submit"]',
            type: 'text',
            value: 'button[type="submit"]',
            withPicker: true,
          },
        ],
      },
    ],
  },
  {
    id: 'step-1',
    type: 'click',
    title: 'Click primary button',
    summary: 'Selector: .btn-primary',
    fields: [
      { id: 'selector', label: 'Selector', placeholder: '.btn-primary', type: 'text', value: '.btn-primary', withPicker: true },
    ],
  },
  {
    id: 'step-2',
    type: 'loop',
    title: 'Repeat steps',
    summary: 'Repeat 3 times',
    fields: [
      { id: 'iterations', label: 'Iterations', placeholder: '3', type: 'number', value: '3' },
    ],
    children: [
      {
        id: 'step-2-1',
        type: 'input',
        title: 'Fill title field',
        summary: 'Value: Sample title',
        fields: [
          {
            id: 'selector',
            label: 'Selector',
            placeholder: 'input[name="title"]',
            type: 'text',
            value: 'input[name="title"]',
            withPicker: true,
          },
          { id: 'value', label: 'Value', placeholder: 'Sample title', type: 'text', value: 'Sample title' },
        ],
      },
      {
        id: 'step-2-2',
        type: 'click',
        title: 'Submit row',
        summary: 'Selector: button[type="submit"]',
        fields: [
          {
            id: 'selector',
            label: 'Selector',
            placeholder: 'button[type="submit"]',
            type: 'text',
            value: 'button[type="submit"]',
            withPicker: true,
          },
        ],
      },
    ],
  },
  {
    id: 'step-if-1',
    type: 'if-else',
    title: 'Check status label',
    summary: 'If .status contains "Ready"',
    fields: [
      { id: 'selector', label: 'Selector', placeholder: '.status', type: 'text', value: '.status' },
      { id: 'operator', label: 'Operator', type: 'select', value: 'contains', options: CONDITION_OPERATORS },
      { id: 'expected', label: 'Value', placeholder: 'Ready', type: 'text', value: 'Ready' },
    ],
    branches: [
      {
        id: 'branch-then',
        label: 'Then',
        steps: [
          {
            id: 'step-if-1-1',
            type: 'click',
            title: 'Continue flow',
            summary: 'Selector: .btn-continue',
            fields: [
              {
                id: 'selector',
                label: 'Selector',
                placeholder: '.btn-continue',
                type: 'text',
                value: '.btn-continue',
                withPicker: true,
              },
            ],
          },
        ],
      },
      {
        id: 'branch-else',
        label: 'Else',
        steps: [
          {
            id: 'step-if-1-2',
            type: 'wait',
            title: 'Wait for ready state',
            summary: 'Wait until .status contains "Ready"',
            fields: [
              { id: 'mode', label: 'Wait for', type: 'select', value: 'condition', options: WAIT_MODES },
              {
                id: 'selector',
                label: 'Selector',
                placeholder: '.status',
                type: 'text',
                value: '.status',
                showWhen: { fieldId: 'mode', value: 'condition' },
              },
              {
                id: 'operator',
                label: 'Operator',
                type: 'select',
                value: 'contains',
                options: CONDITION_OPERATORS,
                showWhen: { fieldId: 'mode', value: 'condition' },
              },
              {
                id: 'expected',
                label: 'Value',
                placeholder: 'Ready',
                type: 'text',
                value: 'Ready',
                showWhen: { fieldId: 'mode', value: 'condition' },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'step-3',
    type: 'wait',
    title: 'Wait for response',
    summary: 'Duration: 1200 ms',
    fields: [
      { id: 'mode', label: 'Wait for', type: 'select', value: 'time', options: WAIT_MODES },
      {
        id: 'duration',
        label: 'Duration (ms)',
        placeholder: '1200',
        type: 'number',
        value: '1200',
        showWhen: { fieldId: 'mode', value: 'time' },
      },
      {
        id: 'selector',
        label: 'Selector',
        placeholder: '.status',
        type: 'text',
        value: '.status',
        showWhen: { fieldId: 'mode', value: 'condition' },
      },
      {
        id: 'operator',
        label: 'Operator',
        type: 'select',
        value: 'contains',
        options: CONDITION_OPERATORS,
        showWhen: { fieldId: 'mode', value: 'condition' },
      },
      {
        id: 'expected',
        label: 'Value',
        placeholder: 'Ready',
        type: 'text',
        value: 'Ready',
        showWhen: { fieldId: 'mode', value: 'condition' },
      },
    ],
  },
  {
    id: 'step-4',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-5',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-6',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-7',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-8',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-9',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-10',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-11',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-12',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
  {
    id: 'step-13',
    type: 'navigate',
    title: 'Open stats page',
    summary: 'URL: https://note.com/sitesettings/stats',
    fields: [
      {
        id: 'url',
        label: 'URL',
        placeholder: 'https://example.com',
        type: 'text',
        value: 'https://note.com/sitesettings/stats',
      },
    ],
  },
];

const STEP_TYPES = [
  { value: 'click', label: 'Click' },
  { value: 'input', label: 'Input' },
  { value: 'loop', label: 'Loop' },
  { value: 'data-source', label: 'Data Source' },
  { value: 'if-else', label: 'If / Else' },
  { value: 'wait', label: 'Wait' },
  { value: 'navigate', label: 'Navigate' },
  { value: 'assert', label: 'Assert' },
];

export default function FlowStepsBuilderPreview({ steps = DEFAULT_STEPS }: { steps?: StepData[] }) {
  const [draftSteps, setDraftSteps] = useState<StepData[]>(steps);
  const [activeStepId, setActiveStepId] = useState(steps[0]?.id || '');
  const [activeFieldTarget, setActiveFieldTarget] = useState<{ stepId: string; fieldId: string } | null>(null);

  const findStepById = (items: StepData[], stepId: string): StepData | undefined => {
    for (const step of items) {
      if (step.id === stepId) {
        return step;
      }
      if (step.children?.length) {
        const match = findStepById(step.children, stepId);
        if (match) {
          return match;
        }
      }
      if (step.branches?.length) {
        for (const branch of step.branches) {
          const match = findStepById(branch.steps, stepId);
          if (match) {
            return match;
          }
        }
      }
    }
    return undefined;
  };

  const updateSteps = (items: StepData[], stepId: string, updater: (step: StepData) => StepData) =>
    items.map((step) => {
      let nextStep = step;
      if (step.id === stepId) {
        nextStep = updater(step);
      }
      if (step.children?.length) {
        const nextChildren = updateSteps(step.children, stepId, updater);
        if (nextChildren !== step.children) {
          nextStep = { ...nextStep, children: nextChildren };
        }
      }
      if (step.branches?.length) {
        let branchesChanged = false;
        const nextBranches = step.branches.map((branch) => {
          const nextBranchSteps = updateSteps(branch.steps, stepId, updater);
          if (nextBranchSteps !== branch.steps) {
            branchesChanged = true;
            return { ...branch, steps: nextBranchSteps };
          }
          return branch;
        });
        if (branchesChanged) {
          nextStep = { ...nextStep, branches: nextBranches };
        }
      }
      return nextStep;
    });

  const getFieldValue = (step: StepData, fieldId: string) =>
    step.fields.find((field) => field.id === fieldId)?.value ?? '';

  const shouldShowField = (step: StepData, field: StepField) => {
    if (!field.showWhen) {
      return true;
    }
    return getFieldValue(step, field.showWhen.fieldId) === field.showWhen.value;
  };

  const updateField = (stepId: string, fieldId: string, value: string) => {
    setDraftSteps((prev) =>
      updateSteps(prev, stepId, (step) => {
        const nextFields = step.fields.map((field) =>
          field.id === fieldId ? { ...field, value } : field,
        );
        return { ...step, fields: nextFields };
      }),
    );
  };

  const updateStepType = (stepId: string, type: string) => {
    setDraftSteps((prev) =>
      updateSteps(prev, stepId, (step) => ({ ...step, type })),
    );
  };

  const normalizeColumnToken = (column: string) => {
    const trimmed = column.trim();
    if (!trimmed) {
      return '';
    }
    const safeKey = /^[A-Za-z_][0-9A-Za-z_]*$/.test(trimmed);
    if (safeKey) {
      return `{{row.${trimmed}}}`;
    }
    const escaped = trimmed.replace(/"/g, '\\"');
    return `{{row["${escaped}"]}}`;
  };

  const insertColumnToken = (column: string) => {
    if (!activeFieldTarget) {
      return;
    }
    const token = normalizeColumnToken(column);
    if (!token) {
      return;
    }
    setDraftSteps((prev) =>
      updateSteps(prev, activeFieldTarget.stepId, (step) => {
        const nextFields = step.fields.map((field) => {
          if (field.id !== activeFieldTarget.fieldId) {
            return field;
          }
          const nextValue = field.value ? `${field.value} ${token}` : token;
          return { ...field, value: nextValue };
        });
        return { ...step, fields: nextFields };
      }),
    );
  };

  const splitDelimitedLine = (line: string, delimiter: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const extractDelimitedMeta = (text: string, delimiter: string, hasHeader: boolean) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      return { columns: [] as string[], rowCount: 0 };
    }
    const headerLine = lines[0];
    const headerParts = splitDelimitedLine(headerLine, delimiter);
    const columns = hasHeader
      ? headerParts.map((value) => value.trim()).filter(Boolean)
      : headerParts.map((_, index) => `Column ${index + 1}`);
    const rowCount = Math.max(0, lines.length - (hasHeader ? 1 : 0));
    return { columns, rowCount };
  };

  const getJsonAtPath = (data: unknown, path: string) => {
    if (!path.trim()) {
      return data;
    }
    return path
      .split('.')
      .filter(Boolean)
      .reduce<unknown>((current, segment) => {
        if (current === null || current === undefined) {
          return undefined;
        }
        if (Array.isArray(current)) {
          const index = Number(segment);
          if (!Number.isNaN(index)) {
            return current[index];
          }
          return current;
        }
        if (typeof current === 'object') {
          return (current as Record<string, unknown>)[segment];
        }
        return undefined;
      }, data);
  };

  const extractJsonMeta = (text: string, jsonPath: string) => {
    const parsed = JSON.parse(text);
    const scoped = getJsonAtPath(parsed, jsonPath);
    if (Array.isArray(scoped)) {
      const firstObject = scoped.find((item) => item && typeof item === 'object');
      const columns = firstObject && typeof firstObject === 'object' ? Object.keys(firstObject as object) : [];
      return { columns, rowCount: scoped.length };
    }
    if (scoped && typeof scoped === 'object') {
      return { columns: Object.keys(scoped as object), rowCount: 1 };
    }
    return { columns: [], rowCount: 0 };
  };

  const handleDataSourceFileChange = (stepId: string, file: File | null) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setDraftSteps((prev) => {
        const step = findStepById(prev, stepId);
        if (!step) {
          return prev;
        }
        const sourceType = getFieldValue(step, 'sourceType') || 'csv';
        const headerRow = getFieldValue(step, 'headerRow') || 'header';
        const jsonPath = getFieldValue(step, 'jsonPath');
        let columns: string[] = [];
        let rowCount = 0;
        let error = '';
        try {
          if (sourceType === 'json') {
            const meta = extractJsonMeta(text, jsonPath);
            columns = meta.columns;
            rowCount = meta.rowCount;
          } else {
            const delimiter = sourceType === 'tsv' ? '\t' : ',';
            const meta = extractDelimitedMeta(text, delimiter, headerRow !== 'none');
            columns = meta.columns;
            rowCount = meta.rowCount;
          }
        } catch {
          error = 'Failed to parse file.';
        }
        return updateSteps(prev, stepId, (item) => ({
          ...item,
          summary: error
            ? 'Failed to parse file'
            : columns.length > 0
              ? `${columns.length} columns • ${rowCount} rows`
              : 'No columns detected',
          dataSource: {
            fileName: file.name,
            columns,
            rowCount,
            error,
          },
        }));
      });
    };
    reader.readAsText(file);
  };

  const renderStepList = (items: StepData[], depth = 0) => (
    <div className={depth > 0 ? 'grid gap-2 border-l border-border/70 pl-3' : 'grid gap-2'}>
      {items.map((step, index) => {
        const isActive = step.id === activeStepId;
        const isLoop = step.type === 'loop';
        const isIfElse = step.type === 'if-else';
        const isDataSource = step.type === 'data-source';
        const dataSourceMeta = step.dataSource;
        return (
          <div key={step.id} className="rounded-lg border border-border bg-card">
            <button
              type="button"
              className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveStepId(isActive ? '' : step.id)}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold text-foreground">{step.title}</p>
                  {isLoop ? (
                    <span className="badge-pill text-[9px] uppercase tracking-wide">Loop</span>
                  ) : null}
                  {isIfElse ? (
                    <span className="badge-pill text-[9px] uppercase tracking-wide">If / Else</span>
                  ) : null}
                  {isDataSource ? (
                    <span className="badge-pill text-[9px] uppercase tracking-wide">Data Source</span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{step.summary}</p>
              </div>
              <span className="btn-icon btn-icon-danger ml-auto h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
            {isActive ? (
              <div className="px-3 pb-3">
                <div className="mt-3 grid gap-3 text-xs text-muted-foreground">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">Type</span>
                    <SelectMenu
                      value={step.type}
                      options={STEP_TYPES}
                      useInputStyle={false}
                      buttonClassName="btn-ghost h-9 w-full justify-between px-2 text-xs"
                      onChange={(value) => updateStepType(step.id, value)}
                    />
                  </label>
                  {step.fields
                    .filter((field) => shouldShowField(step, field))
                    .map((field) => (
                      <label key={field.id} className="grid gap-1">
                        <span className="text-xs font-semibold text-muted-foreground">{field.label}</span>
                        <div className="flex items-center gap-2">
                          {field.type === 'select' ? (
                            <SelectMenu
                              value={field.value}
                              options={field.options ?? []}
                              useInputStyle={false}
                              buttonClassName="btn-ghost h-9 w-full justify-between px-2 text-xs"
                              onChange={(value) => updateField(step.id, field.id, value)}
                            />
                          ) : field.type === 'textarea' ? (
                            <textarea
                              className="input h-20"
                              value={field.value}
                              onChange={(event) => updateField(step.id, field.id, event.target.value)}
                              placeholder={field.placeholder}
                              onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                            />
                          ) : (
                            <input
                              className="input"
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={field.value}
                              onChange={(event) => updateField(step.id, field.id, event.target.value)}
                              placeholder={field.placeholder}
                              onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                            />
                          )}
                          {field.withPicker ? (
                            <button type="button" className="btn-ghost h-9 px-3 text-xs">
                              Pick
                            </button>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  {isDataSource ? (
                    <div className="grid gap-3">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-muted-foreground">File</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="btn-ghost h-9 cursor-pointer px-3 text-xs">
                            Choose file
                            <input
                              type="file"
                              accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json"
                              className="hidden"
                              onChange={(event) =>
                                handleDataSourceFileChange(step.id, event.target.files?.[0] ?? null)
                              }
                            />
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {dataSourceMeta?.fileName || 'No file selected'}
                          </span>
                        </div>
                        {dataSourceMeta?.error ? (
                          <span className="text-[11px] text-destructive">{dataSourceMeta.error}</span>
                        ) : null}
                      </label>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                          <span>Columns</span>
                          <span>{dataSourceMeta?.rowCount ? `${dataSourceMeta.rowCount} rows` : '—'}</span>
                        </div>
                        {dataSourceMeta?.columns && dataSourceMeta.columns.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {dataSourceMeta.columns.map((column) => (
                              <button
                                key={column}
                                type="button"
                                className="btn-ghost h-7 px-2 text-[10px]"
                                onClick={() => insertColumnToken(column)}
                                title={`Insert ${column}`}
                              >
                                {column}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Select a file to load columns.</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          Click a column to insert <code>{'{{row.column}}'}</code> into the last focused field.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {(isLoop || isDataSource) && step.children?.length ? (
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>{isDataSource ? 'Steps per row' : 'Steps in loop'}</span>
                  <button
                    type="button"
                    className="btn-ghost h-7 w-7 p-0"
                    aria-label={isDataSource ? 'Add step to data source' : 'Add step to loop'}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2">{renderStepList(step.children, depth + 1)}</div>
              </div>
            ) : null}
            {isIfElse && step.branches?.length ? (
              <div className="px-3 pb-3">
                {step.branches.map((branch) => (
                  <div key={branch.id} className="mt-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>{branch.label}</span>
                      <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label={`Add step to ${branch.label}`}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2">{renderStepList(branch.steps, depth + 1)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Steps</span>
        <button type="button" className="btn-ghost h-7 w-7 p-0" aria-label="Add step">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[35.5vh] overflow-y-auto pr-1">{renderStepList(draftSteps)}</div>
    </div>
  );
}
