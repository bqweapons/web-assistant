import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import SelectMenu from './SelectMenu';
import SelectorInput from './SelectorInput';
import StepPicker from './StepPicker';
import { t } from '../utils/i18n';
import type { SelectorPickerAccept } from '../../../shared/messages';

type StepFieldOption = {
  value: string;
  label: string;
};

type StepField = {
  id: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox';
  value: string;
  withPicker?: boolean;
  options?: StepFieldOption[];
  showWhen?: { fieldId: string; value?: string; values?: string[] };
};

type DataSourceMeta = {
  fileName?: string;
  fileType?: 'csv' | 'tsv';
  columns?: string[];
  rowCount?: number;
  error?: string;
  rawText?: string;
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

type AddStepPlaceholderProps = {
  label: string;
  ariaLabel: string;
  onPick: (type: string) => void;
  onDropReorder?: () => void;
  canDrop?: boolean;
};

function AddStepPlaceholder({ label, ariaLabel, onPick, onDropReorder, canDrop }: AddStepPlaceholderProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleActivate = () => {
    triggerRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-lg border border-dashed border-border/60 bg-secondary px-3 py-2 shadow-sm transition hover:border-border/80 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={ariaLabel}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest?.('[data-step-picker]') || target.closest?.('[data-step-picker-menu]')) {
          return;
        }
        handleActivate();
      }}
      onDragOver={(event) => {
        if (!onDropReorder) {
          return;
        }
        if (canDrop) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={(event) => {
        if (!onDropReorder || !canDrop) {
          return;
        }
        event.preventDefault();
        onDropReorder();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
    >
      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <StepPicker ariaLabel={ariaLabel} onPick={onPick} buttonRef={triggerRef} />
        <span>{label}</span>
      </div>
    </div>
  );
}

const WAIT_MODES: StepFieldOption[] = [
  { value: 'time', label: t('sidepanel_step_wait_mode_time', 'Time delay') },
  { value: 'condition', label: t('sidepanel_step_wait_mode_condition', 'Element condition') },
];

const CONDITION_OPERATORS: StepFieldOption[] = [
  { value: 'contains', label: t('sidepanel_step_condition_contains', 'Contains') },
  { value: 'equals', label: t('sidepanel_step_condition_equals', 'Equals') },
  { value: 'greater', label: t('sidepanel_step_condition_greater', 'Greater than') },
  { value: 'less', label: t('sidepanel_step_condition_less', 'Less than') },
];

const FIELD_LABEL_KEYS: Record<string, string> = {
  Selector: 'sidepanel_field_selector',
  Value: 'sidepanel_field_value',
  Iterations: 'sidepanel_field_iterations',
  'Wait for': 'sidepanel_field_wait_for',
  'Duration (ms)': 'sidepanel_field_duration_ms',
  Operator: 'sidepanel_field_operator',
  URL: 'sidepanel_field_url',
  'Header row': 'sidepanel_steps_header_row',
};

const DEFAULT_STEPS: StepData[] = [
  {
    id: 'step-ds-1',
    type: 'data-source',
    title: 'Load data source',
    summary: 'Awaiting file selection',
    fields: [
      {
        id: 'headerRow',
        label: 'Header row',
        type: 'checkbox',
        value: 'true',
      },
    ],
    dataSource: {
      fileName: '',
      fileType: 'csv',
      columns: [],
      rowCount: 0,
      rawText: '',
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

const STEP_TYPE_LABELS: Record<string, string> = {
  click: t('sidepanel_step_click_label', 'Click'),
  input: t('sidepanel_step_input_label', 'Input'),
  loop: t('sidepanel_step_loop_label', 'Loop'),
  'data-source': t('sidepanel_step_data_source_label', 'Data Source'),
  'if-else': t('sidepanel_step_if_else_label', 'If / Else'),
  wait: t('sidepanel_step_wait_label', 'Wait'),
  navigate: t('sidepanel_step_navigate_label', 'Navigate'),
  assert: t('sidepanel_step_assert_label', 'Assert'),
};

type FlowStepsBuilderProps = {
  steps?: StepData[];
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
};

export default function FlowStepsBuilder({ steps = DEFAULT_STEPS, onStartPicker }: FlowStepsBuilderProps) {
  const [draftSteps, setDraftSteps] = useState<StepData[]>(steps);
  const [activeStepId, setActiveStepId] = useState('');
  const [activeFieldTarget, setActiveFieldTarget] = useState<{ stepId: string; fieldId: string } | null>(null);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<
    | null
    | {
        stepId: string;
        context:
          | { scope: 'root' }
          | { scope: 'children'; parentId: string }
          | { scope: 'branch'; parentId: string; branchId: string };
      }
  >(null);

  const getFieldLabel = (label: string) => {
    const key = FIELD_LABEL_KEYS[label];
    return key ? t(key, label) : label;
  };

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

  useEffect(() => {
    setDraftSteps(steps);
    setActiveStepId((prev) => {
      if (prev && findStepById(steps, prev)) {
        return prev;
      }
      return '';
    });
  }, [steps]);

  const isSameContext = (
    left:
      | { scope: 'root' }
      | { scope: 'children'; parentId: string }
      | { scope: 'branch'; parentId: string; branchId: string },
    right:
      | { scope: 'root' }
      | { scope: 'children'; parentId: string }
      | { scope: 'branch'; parentId: string; branchId: string },
  ) => {
    if (left.scope !== right.scope) {
      return false;
    }
    if (left.scope === 'root' && right.scope === 'root') {
      return true;
    }
    if (left.scope === 'children' && right.scope === 'children') {
      return left.parentId === right.parentId;
    }
    if (left.scope === 'branch' && right.scope === 'branch') {
      return left.parentId === right.parentId && left.branchId === right.branchId;
    }
    return false;
  };

  const reorderList = (items: StepData[], fromId: string, toId?: string) => {
    const fromIndex = items.findIndex((item) => item.id === fromId);
    if (fromIndex === -1) {
      return items;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (!toId) {
      next.push(moved);
      return next;
    }
    const targetIndex = next.findIndex((item) => item.id === toId);
    if (targetIndex === -1) {
      next.push(moved);
      return next;
    }
    next.splice(targetIndex, 0, moved);
    return next;
  };

  const reorderWithinContext = (
    items: StepData[],
    context:
      | { scope: 'root' }
      | { scope: 'children'; parentId: string }
      | { scope: 'branch'; parentId: string; branchId: string },
    fromId: string,
    toId?: string,
  ) => {
    if (context.scope === 'root') {
      return reorderList(items, fromId, toId);
    }
    return updateSteps(items, context.parentId, (step) => {
      if (context.scope === 'children') {
        const nextChildren = reorderList(step.children ?? [], fromId, toId);
        return { ...step, children: nextChildren };
      }
      if (context.scope === 'branch') {
        const nextBranches =
          step.branches?.map((branch) => {
            if (branch.id !== context.branchId) {
              return branch;
            }
            return { ...branch, steps: reorderList(branch.steps, fromId, toId) };
          }) ?? [];
        return { ...step, branches: nextBranches };
      }
      return step;
    });
  };

  const updateSteps = (items: StepData[], stepId: string, updater: (step: StepData) => StepData) =>
    items.map((step) => {
      if (step.id === stepId) {
        return updater(step);
      }
      let nextStep = step;
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
    const currentValue = getFieldValue(step, field.showWhen.fieldId);
    if (field.showWhen.values) {
      return field.showWhen.values.includes(currentValue);
    }
    if (field.showWhen.value !== undefined) {
      return currentValue === field.showWhen.value;
    }
    return true;
  };

  const getOperatorLabel = (value: string) =>
    CONDITION_OPERATORS.find((option) => option.value === value)?.label || value;

  const buildStepSummary = (step: StepData) => {
    const selector = getFieldValue(step, 'selector');
    const value = getFieldValue(step, 'value');
    const operator = getFieldValue(step, 'operator');
    const expected = getFieldValue(step, 'expected');
    const mode = getFieldValue(step, 'mode');
    const duration = getFieldValue(step, 'duration');
    const url = getFieldValue(step, 'url');
    const iterations = getFieldValue(step, 'iterations');
    const operatorLabel = operator ? getOperatorLabel(operator) : '';

    switch (step.type) {
      case 'click':
        return t('sidepanel_step_summary_selector', 'Selector: {value}').replace(
          '{value}',
          selector || t('sidepanel_field_not_set', 'Not set'),
        );
      case 'input':
        if (value) {
          return t('sidepanel_step_summary_value', 'Value: {value}').replace('{value}', value);
        }
        return selector
          ? t('sidepanel_step_summary_selector', 'Selector: {value}').replace('{value}', selector)
          : t('sidepanel_step_summary_input', 'Input');
      case 'loop':
        return iterations
          ? t('sidepanel_step_summary_repeat_times', 'Repeat {count} times').replace('{count}', iterations)
          : t('sidepanel_step_summary_repeat_steps', 'Repeat steps');
      case 'data-source': {
        if (step.dataSource?.error) {
          return t('sidepanel_steps_file_parse_error', 'Failed to parse file');
        }
        if (step.dataSource?.columns?.length) {
          return t('sidepanel_steps_columns_rows', '{columns} columns | {rows} rows')
            .replace('{columns}', String(step.dataSource.columns.length))
            .replace('{rows}', String(step.dataSource.rowCount ?? 0));
        }
        return step.dataSource?.fileName
          ? t('sidepanel_steps_columns_missing', 'No columns detected')
          : t('sidepanel_steps_file_waiting', 'Awaiting file selection');
      }
      case 'if-else':
        if (selector || expected || operatorLabel) {
          return t('sidepanel_step_summary_if', 'If {selector} {operator} \"{value}\"')
            .replace('{selector}', selector || t('sidepanel_field_selector', 'Selector'))
            .replace('{operator}', operatorLabel || t('sidepanel_step_condition_is', 'is'))
            .replace('{value}', expected || '');
        }
        return t('sidepanel_step_summary_conditional', 'Conditional check');
      case 'wait':
        if (mode === 'condition') {
          return t('sidepanel_step_summary_wait_until', 'Wait until {selector} {operator} \"{value}\"')
            .replace('{selector}', selector || t('sidepanel_field_selector', 'Selector'))
            .replace('{operator}', operatorLabel || t('sidepanel_step_condition_is', 'is'))
            .replace('{value}', expected || '');
        }
        return t('sidepanel_step_summary_duration', 'Duration: {value} ms').replace(
          '{value}',
          duration || '0',
        );
      case 'navigate':
        return t('sidepanel_step_summary_url', 'URL: {value}').replace(
          '{value}',
          url || t('sidepanel_field_not_set', 'Not set'),
        );
      case 'assert':
        return t('sidepanel_step_summary_expect', 'Expect {selector} {operator} \"{value}\"')
          .replace('{selector}', selector || t('sidepanel_field_selector', 'Selector'))
          .replace('{operator}', operatorLabel || t('sidepanel_step_condition_is', 'is'))
          .replace('{value}', expected || '');
      default:
        return step.summary || step.title;
    }
  };

  const updateField = (stepId: string, fieldId: string, value: string) => {
    setDraftSteps((prev) =>
      updateSteps(prev, stepId, (step) => {
        let nextFields = step.fields.map((field) =>
          field.id === fieldId ? { ...field, value } : field,
        );
        if (step.type === 'wait' && fieldId === 'mode' && value === 'time') {
          const durationIndex = nextFields.findIndex((field) => field.id === 'duration');
          if (durationIndex === -1) {
            nextFields = [
              ...nextFields,
              {
                id: 'duration',
                label: 'Duration (ms)',
                placeholder: '1200',
                type: 'number',
                value: '1200',
                showWhen: { fieldId: 'mode', value: 'time' },
              },
            ];
          } else if (!nextFields[durationIndex].value) {
            nextFields = nextFields.map((field, index) =>
              index === durationIndex ? { ...field, value: '1200' } : field,
            );
          }
        }
        const nextStep = { ...step, fields: nextFields };
        if (step.type === 'data-source' && fieldId === 'headerRow' && step.dataSource?.rawText) {
          const sourceType = step.dataSource?.fileType || 'csv';
          const headerRow = nextFields.find((field) => field.id === 'headerRow')?.value;
          const hasHeader = headerRow ? headerRow === 'true' : true;
          try {
            const delimiter = sourceType === 'tsv' ? '\t' : ',';
            const meta = extractDelimitedMeta(step.dataSource.rawText, delimiter, hasHeader);
            return {
              ...nextStep,
              summary:
                meta.columns.length > 0
                  ? t('sidepanel_steps_columns_rows', '{columns} columns | {rows} rows')
                      .replace('{columns}', String(meta.columns.length))
                      .replace('{rows}', String(meta.rowCount))
                  : t('sidepanel_steps_columns_missing', 'No columns detected'),
              dataSource: {
                ...step.dataSource,
                columns: meta.columns,
                rowCount: meta.rowCount,
                error: '',
              },
            };
          } catch {
            return {
              ...nextStep,
              summary: t('sidepanel_steps_file_parse_error', 'Failed to parse file'),
              dataSource: {
                ...step.dataSource,
                columns: [],
                rowCount: 0,
                error: t('sidepanel_steps_file_parse_error', 'Failed to parse file'),
              },
            };
          }
        }
        return {
          ...nextStep,
          summary: buildStepSummary(nextStep),
        };
      }),
    );
  };

  const createStepId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const createStepTemplate = (type: string): StepData => {
    switch (type) {
      case 'click':
        return {
          id: createStepId('click'),
          type: 'click',
          title: 'Click element',
          summary: 'Selector: .btn-primary',
          fields: [
            {
              id: 'selector',
              label: 'Selector',
              placeholder: '.btn-primary',
              type: 'text',
              value: '',
              withPicker: true,
            },
          ],
        };
      case 'input':
        return {
          id: createStepId('input'),
          type: 'input',
          title: 'Fill input',
          summary: 'Value: Example text',
          fields: [
            {
              id: 'selector',
              label: 'Selector',
              placeholder: 'input[name="title"]',
              type: 'text',
              value: '',
              withPicker: true,
            },
            { id: 'value', label: 'Value', placeholder: 'Example text', type: 'text', value: '' },
          ],
        };
      case 'loop':
        return {
          id: createStepId('loop'),
          type: 'loop',
          title: 'Repeat steps',
          summary: 'Repeat 3 times',
          fields: [{ id: 'iterations', label: 'Iterations', placeholder: '3', type: 'number', value: '3' }],
          children: [],
        };
      case 'data-source':
        return {
          id: createStepId('data-source'),
          type: 'data-source',
          title: 'Load data source',
          summary: 'Awaiting file selection',
          fields: [
            {
              id: 'headerRow',
              label: 'Header row',
              type: 'checkbox',
              value: 'true',
            },
          ],
          dataSource: {
            fileName: '',
            fileType: 'csv',
            columns: [],
            rowCount: 0,
            rawText: '',
          },
          children: [],
        };
      case 'if-else':
        return {
          id: createStepId('if-else'),
          type: 'if-else',
          title: 'Conditional check',
          summary: 'If .status contains "Ready"',
          fields: [
            { id: 'selector', label: 'Selector', placeholder: '.status', type: 'text', value: '.status' },
            { id: 'operator', label: 'Operator', type: 'select', value: 'contains', options: CONDITION_OPERATORS },
            { id: 'expected', label: 'Value', placeholder: 'Ready', type: 'text', value: 'Ready' },
          ],
          branches: [
            { id: 'branch-then', label: 'Then', steps: [] },
            { id: 'branch-else', label: 'Else', steps: [] },
          ],
        };
      case 'wait':
        return {
          id: createStepId('wait'),
          type: 'wait',
          title: 'Wait',
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
              withPicker: true,
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
        };
      case 'navigate':
        return {
          id: createStepId('navigate'),
          type: 'navigate',
          title: 'Navigate',
          summary: 'URL: https://example.com',
          fields: [
            { id: 'url', label: 'URL', placeholder: 'https://example.com', type: 'text', value: '' },
          ],
        };
      case 'assert':
        return {
          id: createStepId('assert'),
          type: 'assert',
          title: 'Assert text',
          summary: 'Expect .status equals "Ready"',
          fields: [
            { id: 'selector', label: 'Selector', placeholder: '.status', type: 'text', value: '.status' },
            { id: 'operator', label: 'Operator', type: 'select', value: 'equals', options: CONDITION_OPERATORS },
            { id: 'expected', label: 'Value', placeholder: 'Ready', type: 'text', value: 'Ready' },
          ],
        };
      default:
        return {
          id: createStepId('step'),
          type,
          title: 'New step',
          summary: 'Configure step details',
          fields: [],
        };
    }
  };

  const createInputStepWithValue = (value: string) => {
    const step = createStepTemplate('input');
    const nextFields = step.fields.map((field) =>
      field.id === 'value' ? { ...field, value } : field,
    );
    const nextStep = { ...step, fields: nextFields };
    return { ...nextStep, summary: buildStepSummary(nextStep) };
  };

  const addStep = (
    type: string,
    target:
      | { scope: 'root' }
      | { scope: 'children'; stepId: string }
      | { scope: 'branch'; stepId: string; branchId: string },
  ) => {
    const newStep = createStepTemplate(type);
    if (target.scope === 'root') {
      setDraftSteps((prev) => [...prev, newStep]);
      setActiveStepId(newStep.id);
      return;
    }
    setDraftSteps((prev) =>
      updateSteps(prev, target.stepId, (step) => {
        if (target.scope === 'children') {
          const nextChildren = [...(step.children ?? []), newStep];
          return { ...step, children: nextChildren };
        }
        if (target.scope === 'branch') {
          const nextBranches =
            step.branches?.map((branch) => {
              if (branch.id !== target.branchId) {
                return branch;
              }
              return { ...branch, steps: [...branch.steps, newStep] };
            }) ?? [];
          return { ...step, branches: nextBranches };
        }
        return step;
      }),
    );
    setActiveStepId(newStep.id);
  };

  const removeStepById = (items: StepData[], stepId: string) => {
    const next: StepData[] = [];
    for (const step of items) {
      if (step.id === stepId) {
        continue;
      }
      let nextStep = step;
      if (step.children?.length) {
        const nextChildren = removeStepById(step.children, stepId);
        nextStep = { ...nextStep, children: nextChildren };
      }
      if (step.branches?.length) {
        const nextBranches = step.branches.map((branch) => ({
          ...branch,
          steps: removeStepById(branch.steps, stepId),
        }));
        nextStep = { ...nextStep, branches: nextBranches };
      }
      next.push(nextStep);
    }
    return next;
  };

  const handleDeleteStep = (stepId: string) => {
    setDraftSteps((prev) => {
      const next = removeStepById(prev, stepId);
      setActiveStepId((current) => {
        if (current && findStepById(next, current)) {
          return current;
        }
        return '';
      });
      return next;
    });
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

  const insertColumnToken = (column: string, fallbackStepId?: string) => {
    const token = normalizeColumnToken(column);
    if (!token) {
      return;
    }
    if (fallbackStepId) {
      const newStep = createInputStepWithValue(token);
      setDraftSteps((prev) => {
        if (!findStepById(prev, fallbackStepId)) {
          return prev;
        }
        return updateSteps(prev, fallbackStepId, (step) => {
          const nextChildren = [...(step.children ?? []), newStep];
          return { ...step, children: nextChildren };
        });
      });
      setActiveStepId(newStep.id);
      setActiveFieldTarget({ stepId: newStep.id, fieldId: 'value' });
      return;
    }
    setDraftSteps((prev) => {
      const target = activeFieldTarget;
      if (!target) {
        return prev;
      }
      setActiveFieldTarget(target);
      setActiveStepId(target.stepId);
      return updateSteps(prev, target.stepId, (step) => {
        const nextFields = step.fields.map((field) => {
          if (field.id !== target.fieldId) {
            return field;
          }
          const nextValue = field.value ? `${field.value} ${token}` : token;
          return { ...field, value: nextValue };
        });
        const nextStep = { ...step, fields: nextFields };
        return { ...nextStep, summary: buildStepSummary(nextStep) };
      });
    });
  };

  const parseDelimitedRows = (text: string, delimiter: string) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === '\r' || char === '\n') {
        if (inQuotes) {
          current += char;
          continue;
        }
        if (char === '\r' && text[i + 1] === '\n') {
          i += 1;
        }
        row.push(current);
        current = '';
        rows.push(row);
        row = [];
        continue;
      }
      if (char === delimiter && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }
      current += char;
    }

    row.push(current);
    rows.push(row);
    return rows.filter((nextRow) => nextRow.some((cell) => cell.trim() !== ''));
  };

  const extractDelimitedMeta = (text: string, delimiter: string, hasHeader: boolean) => {
    const rows = parseDelimitedRows(text, delimiter);
    if (rows.length === 0) {
      return { columns: [] as string[], rowCount: 0 };
    }
    const headerParts = rows[0];
    const columns = hasHeader
      ? headerParts.map((value) => value.trim()).filter(Boolean)
      : headerParts.map((_, index) => `column${index + 1}`);
    const rowCount = Math.max(0, rows.length - (hasHeader ? 1 : 0));
    return { columns, rowCount };
  };

  const handleDataSourceFileChange = (stepId: string, file: File | null) => {
    if (!file) {
      return;
    }
    const name = file.name.toLowerCase();
    const inferredType = name.endsWith('.tsv') ? 'tsv' : name.endsWith('.csv') ? 'csv' : '';
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setDraftSteps((prev) => {
        const step = findStepById(prev, stepId);
        if (!step) {
          return prev;
        }
        const sourceType = inferredType || step.dataSource?.fileType || 'csv';
        const headerRow = getFieldValue(step, 'headerRow');
        const hasHeader = headerRow ? headerRow === 'true' : true;
        let columns: string[] = [];
        let rowCount = 0;
        let error = '';
        try {
          const delimiter = sourceType === 'tsv' ? '\t' : ',';
          const meta = extractDelimitedMeta(text, delimiter, hasHeader);
          columns = meta.columns;
          rowCount = meta.rowCount;
        } catch {
          error = 'Failed to parse file.';
        }
        return updateSteps(prev, stepId, (item) => ({
          ...item,
          summary: error
            ? 'Failed to parse file'
            : columns.length > 0
              ? `${columns.length} columns | ${rowCount} rows`
              : 'No columns detected',
          dataSource: {
            fileName: file.name,
            fileType: sourceType as 'csv' | 'tsv',
            columns,
            rowCount,
            error,
            rawText: text,
          },
        }));
      });
    };
    reader.readAsText(file);
  };

  const renderStepList = (
    items: StepData[],
    depth = 0,
    options?: {
      context?:
        | { scope: 'root' }
        | { scope: 'children'; parentId: string }
        | { scope: 'branch'; parentId: string; branchId: string };
      addPlaceholder?: { label: string; ariaLabel: string; onPick: (type: string) => void };
    },
  ) => {
    const listContext = options?.context;
    return (
    <div className={depth > 0 ? 'grid gap-2 border-l border-border/70 pl-3' : 'grid gap-2'}>
      {items.map((step, index) => {
        const isActive = step.id === activeStepId;
        const isLoop = step.type === 'loop';
        const isIfElse = step.type === 'if-else';
        const isDataSource = step.type === 'data-source';
        const isCollapsed = collapsedSteps[step.id] ?? (isDataSource ? true : false);
        const dataSourceCount = isDataSource ? step.children?.length ?? 0 : 0;
        const dataSourceMeta = step.dataSource;
        const typeLabel = STEP_TYPE_LABELS[step.type] ?? step.type;
        const isDragging = dragState?.stepId === step.id;
        const canDropHere = dragState && listContext ? isSameContext(dragState.context, listContext) : false;
        const handleDrop = () => {
          if (!dragState || !listContext || !canDropHere || dragState.stepId === step.id) {
            return;
          }
          setDraftSteps((prev) => reorderWithinContext(prev, listContext, dragState.stepId, step.id));
          setDragState(null);
        };
        return (
          <div
            key={step.id}
            className={`rounded-lg border border-border bg-card shadow-sm transition ${
              isDragging ? 'opacity-60' : ''
            }`}
            onDragOver={(event) => {
              if (!canDropHere || dragState?.stepId === step.id) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              if (!canDropHere || dragState?.stepId === step.id) {
                return;
              }
              event.preventDefault();
              handleDrop();
            }}
          >
            <button
              type="button"
              className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveStepId(isActive ? '' : step.id)}
              draggable={Boolean(listContext)}
              onDragStart={(event) => {
                if (!listContext) {
                  return;
                }
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', step.id);
                setDragState({ stepId: step.id, context: listContext });
              }}
              onDragEnd={() => setDragState(null)}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold text-foreground">{step.title}</p>
                  <span className="badge-pill text-[9px] uppercase tracking-wide">{typeLabel}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{step.summary}</p>
              </div>
              <button
                type="button"
                className="btn-icon btn-icon-danger ml-auto h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={t('sidepanel_steps_delete', 'Delete step')}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteStep(step.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>
            {isActive ? (
              <div className="px-3 pb-3">
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  {(() => {
                    const visibleFields = step.fields
                      .filter((field) => shouldShowField(step, field))
                      .filter((field) => !(isDataSource && field.id === 'headerRow'));
                    if (step.type !== 'wait') {
                      return visibleFields.map((field) => (
                        <label key={field.id} className="grid gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {getFieldLabel(field.label)}
                          </span>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const showPicker = field.withPicker || field.id === 'selector';
                              if (field.type === 'select') {
                                return (
                                  <SelectMenu
                                    value={field.value}
                                    options={field.options ?? []}
                                    useInputStyle={false}
                                    buttonClassName="btn-ghost h-9 w-full justify-between px-2 text-xs"
                                    onChange={(value) => updateField(step.id, field.id, value)}
                                  />
                                );
                              }
                              if (field.type === 'checkbox') {
                                return (
                                  <label className="flex items-center gap-2 text-xs text-foreground">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4"
                                      checked={field.value === 'true'}
                                      onChange={(event) =>
                                        updateField(step.id, field.id, event.target.checked ? 'true' : 'false')
                                      }
                                    />
                                  </label>
                                );
                              }
                              if (field.type === 'textarea') {
                                return (
                                  <textarea
                                    className="input h-20"
                                    value={field.value}
                                    onChange={(event) => updateField(step.id, field.id, event.target.value)}
                                    placeholder={field.placeholder}
                                    onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                                  />
                                );
                              }
                            if (showPicker) {
                              return (
                                <SelectorInput
                                  value={field.value}
                                  placeholder={field.placeholder}
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  onChange={(value) => updateField(step.id, field.id, value)}
                                  onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                                  onPick={() => {
                                    setActiveFieldTarget({ stepId: step.id, fieldId: field.id });
                                    if (!onStartPicker) {
                                      return;
                                    }
                                    const accept: SelectorPickerAccept =
                                      step.type === 'input' ? 'input' : 'selector';
                                    void onStartPicker(accept).then((selector) => {
                                      if (selector) {
                                        updateField(step.id, field.id, selector);
                                      }
                                    });
                                  }}
                                />
                              );
                            }
                              return (
                                <input
                                  className="input"
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  value={field.value}
                                  onChange={(event) => updateField(step.id, field.id, event.target.value)}
                                  placeholder={field.placeholder}
                                  onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                                />
                              );
                            })()}
                          </div>
                        </label>
                      ));
                    }
                    const rendered: ReactNode[] = [];
                    const expectedField = visibleFields.find((field) => field.id === 'expected');
                    const durationField = visibleFields.find((field) => field.id === 'duration');
                    visibleFields.forEach((field) => {
                      if (field.id === 'expected') {
                        return;
                      }
                      if (field.id === 'duration') {
                        return;
                      }
                      if (field.id === 'mode' && durationField) {
                        rendered.push(
                          <div
                            key="mode-duration"
                            className="grid grid-cols-[auto,minmax(0,1fr),auto,minmax(0,1fr)] items-center gap-2"
                          >
                            <span className="text-xs font-semibold text-muted-foreground">
                              {getFieldLabel(field.label)}
                            </span>
                            <SelectMenu
                              value={field.value}
                              options={field.options ?? []}
                              useInputStyle={false}
                              buttonClassName="btn-ghost h-9 w-full justify-between px-2 text-xs"
                              onChange={(value) => updateField(step.id, field.id, value)}
                            />
                            <span className="text-xs font-semibold text-muted-foreground">
                              {durationField.label}
                            </span>
                            <input
                              className="input w-full"
                              type="number"
                              value={durationField.value}
                              onChange={(event) => updateField(step.id, durationField.id, event.target.value)}
                              placeholder={durationField.placeholder}
                              onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: durationField.id })}
                            />
                          </div>,
                        );
                        return;
                      }
                      if (field.id === 'operator' && expectedField) {
                        rendered.push(
                          <div key="operator-expected" className="grid gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t('sidepanel_step_condition_label', 'Condition')}
                          </span>
                            <div className="grid grid-cols-2 gap-2">
                              <SelectMenu
                                value={field.value}
                                options={field.options ?? []}
                                useInputStyle={false}
                                buttonClassName="btn-ghost h-9 w-full justify-between px-2 text-xs"
                                onChange={(value) => updateField(step.id, field.id, value)}
                              />
                              <input
                                className="input"
                                type="text"
                                value={expectedField.value}
                                onChange={(event) => updateField(step.id, expectedField.id, event.target.value)}
                                placeholder={expectedField.placeholder}
                                onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: expectedField.id })}
                              />
                            </div>
                          </div>,
                        );
                        return;
                      }
                      rendered.push(
                        <label key={field.id} className="grid gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {getFieldLabel(field.label)}
                          </span>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const showPicker = field.withPicker || field.id === 'selector';
                              if (field.type === 'select') {
                                return (
                                  <SelectMenu
                                    value={field.value}
                                    options={field.options ?? []}
                                    useInputStyle={false}
                                    buttonClassName="btn-ghost h-9 w-full justify-between px-2 text-xs"
                                    onChange={(value) => updateField(step.id, field.id, value)}
                                  />
                                );
                              }
                              if (field.type === 'checkbox') {
                                return (
                                  <label className="flex items-center gap-2 text-xs text-foreground">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4"
                                      checked={field.value === 'true'}
                                      onChange={(event) =>
                                        updateField(step.id, field.id, event.target.checked ? 'true' : 'false')
                                      }
                                    />
                                  </label>
                                );
                              }
                              if (field.type === 'textarea') {
                                return (
                                  <textarea
                                    className="input h-20"
                                    value={field.value}
                                    onChange={(event) => updateField(step.id, field.id, event.target.value)}
                                    placeholder={field.placeholder}
                                    onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                                  />
                                );
                              }
                              if (showPicker) {
                              return (
                                <SelectorInput
                                  value={field.value}
                                  placeholder={field.placeholder}
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  onChange={(value) => updateField(step.id, field.id, value)}
                                  onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                                  onPick={() => {
                                    setActiveFieldTarget({ stepId: step.id, fieldId: field.id });
                                    if (!onStartPicker) {
                                      return;
                                    }
                                    const accept: SelectorPickerAccept =
                                      step.type === 'input' ? 'input' : 'selector';
                                    void onStartPicker(accept).then((selector) => {
                                      if (selector) {
                                        updateField(step.id, field.id, selector);
                                      }
                                    });
                                  }}
                                />
                              );
                            }
                              return (
                                <input
                                  className="input"
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  value={field.value}
                                  onChange={(event) => updateField(step.id, field.id, event.target.value)}
                                  placeholder={field.placeholder}
                                  onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: field.id })}
                                />
                              );
                            })()}
                          </div>
                        </label>,
                      );
                    });
                    return rendered;
                  })()}
                  {isDataSource ? (
                    <div className="grid gap-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t('sidepanel_steps_file_label', 'File')}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="btn-ghost h-9 cursor-pointer px-3 text-xs">
                            {t('sidepanel_steps_choose_file', 'Choose file')}
                            <input
                              type="file"
                              accept=".csv,.tsv,text/csv,text/tab-separated-values"
                              className="hidden"
                              onChange={(event) =>
                                handleDataSourceFileChange(step.id, event.target.files?.[0] ?? null)
                              }
                            />
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {dataSourceMeta?.fileName ||
                              t('sidepanel_steps_no_file_selected', 'No file selected')}
                          </span>
                        </div>
                        {dataSourceMeta?.error ? (
                          <span className="text-[11px] text-destructive">{dataSourceMeta.error}</span>
                        ) : null}
                      </label>
                      {dataSourceMeta?.fileName ? (
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={getFieldValue(step, 'headerRow') === 'true'}
                            onChange={(event) =>
                              updateField(step.id, 'headerRow', event.target.checked ? 'true' : 'false')
                            }
                          />
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t('sidepanel_steps_header_row', 'Header row')}
                          </span>
                        </label>
                      ) : null}
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                          <span>{t('sidepanel_steps_columns', 'Columns')}</span>
                          <span>
                            {dataSourceMeta?.columns?.length
                              ? t('sidepanel_steps_columns_count', '{count} cols').replace(
                                  '{count}',
                                  String(dataSourceMeta.columns.length),
                                )
                              : t('sidepanel_steps_columns_na', 'N/A')}
                          </span>
                        </div>
                        {dataSourceMeta?.columns && dataSourceMeta.columns.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {dataSourceMeta.columns.map((column) => (
                              <button
                                key={column}
                                type="button"
                                className="btn-ghost h-7 px-2 text-[10px]"
                                onClick={() => insertColumnToken(column, step.id)}
                                title={t('sidepanel_steps_insert_column', 'Insert {column}').replace('{column}', column)}
                              >
                                {column}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {t('sidepanel_steps_columns_empty', 'Select a file to load columns.')}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {t('sidepanel_steps_columns_hint', 'Click a column to create an Input step with')}
                          <span> </span>
                          <code>{'{{row.column}}'}</code>.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {isLoop || isDataSource ? (
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                    onClick={() =>
                      setCollapsedSteps((prev) => ({
                        ...prev,
                        [step.id]: !isCollapsed,
                      }))
                    }
                  >
                    <ChevronRight className={`h-3 w-3 transition ${isCollapsed ? '' : 'rotate-90'}`} />
                    <span>
                      {isDataSource
                        ? t('sidepanel_steps_per_row', 'Steps per row')
                        : t('sidepanel_steps_in_loop', 'Steps in loop')}
                    </span>
                  </button>
                  {isDataSource ? (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {t('sidepanel_steps_count', '{count} steps')
                        .replace('{count}', String(dataSourceCount))}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {t('sidepanel_steps_count', '{count} steps')
                        .replace('{count}', String(step.children?.length ?? 0))}
                    </span>
                  )}
                </div>
                {!isCollapsed ? (
                  <div className="mt-2">
                    {renderStepList(step.children ?? [], depth + 1, {
                      context: { scope: 'children', parentId: step.id },
                      addPlaceholder: {
                        label: isDataSource
                          ? t('sidepanel_steps_add_per_row', 'Add step per row')
                          : t('sidepanel_steps_add_in_loop', 'Add step in loop'),
                        ariaLabel: isDataSource
                          ? t('sidepanel_steps_add_to_data_source', 'Add step to data source')
                          : t('sidepanel_steps_add_to_loop', 'Add step to loop'),
                        onPick: (type) => addStep(type, { scope: 'children', stepId: step.id }),
                      },
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {isIfElse && step.branches?.length ? (
              <div className="px-3 pb-3">
                {step.branches.map((branch) => (
                  <div key={branch.id} className="mt-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                        onClick={() =>
                          setCollapsedBranches((prev) => ({
                            ...prev,
                            [`${step.id}:${branch.id}`]:
                              !(prev[`${step.id}:${branch.id}`] ?? false),
                          }))
                        }
                      >
                        <ChevronRight
                          className={`h-3 w-3 transition ${
                            collapsedBranches[`${step.id}:${branch.id}`] ? '' : 'rotate-90'
                          }`}
                        />
                        <span>{branch.label}</span>
                      </button>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {t('sidepanel_steps_count', '{count} steps')
                          .replace('{count}', String(branch.steps.length))}
                      </span>
                    </div>
                    {!collapsedBranches[`${step.id}:${branch.id}`] ? (
                      <div className="mt-2">
                        {renderStepList(branch.steps ?? [], depth + 1, {
                          context: { scope: 'branch', parentId: step.id, branchId: branch.id },
                          addPlaceholder: {
                            label: t('sidepanel_steps_add_to_branch', 'Add step to {label}').replace(
                              '{label}',
                              branch.label,
                            ),
                            ariaLabel: t('sidepanel_steps_add_to_branch', 'Add step to {label}').replace(
                              '{label}',
                              branch.label,
                            ),
                            onPick: (type) =>
                              addStep(type, { scope: 'branch', stepId: step.id, branchId: branch.id }),
                          },
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {options?.addPlaceholder ? (
        <AddStepPlaceholder
          label={options.addPlaceholder.label}
          ariaLabel={options.addPlaceholder.ariaLabel}
          onPick={options.addPlaceholder.onPick}
          canDrop={dragState && listContext ? isSameContext(dragState.context, listContext) : false}
          onDropReorder={() => {
            const dropContext = listContext;
            if (!dragState || !dropContext) {
              return;
            }
            setDraftSteps((prev) => reorderWithinContext(prev, dropContext, dragState.stepId));
            setDragState(null);
          }}
        />
      ) : null}
    </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('sidepanel_steps_title', 'Steps')}
        </span>
      </div>
      <div className="max-h-[35.5vh] overflow-y-auto pr-1" data-step-scroll>
        {renderStepList(draftSteps, 0, {
          context: { scope: 'root' },
          addPlaceholder: {
            label: t('sidepanel_steps_add', 'Add step'),
            ariaLabel: t('sidepanel_steps_add', 'Add step'),
            onPick: (type) => addStep(type, { scope: 'root' }),
          },
        })}
      </div>
    </div>
  );
}
