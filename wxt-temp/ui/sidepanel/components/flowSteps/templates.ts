import { buildStepSummary } from './summary';
import type { StepData, StepFieldOption } from './types';

type TemplateOptions = {
  waitModes: StepFieldOption[];
  conditionOperators: StepFieldOption[];
};

export const createStepId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const createStepTemplate = (type: string, options: TemplateOptions): StepData => {
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
    case 'popup':
      return {
        id: createStepId('popup'),
        type: 'popup',
        title: 'Show popup',
        summary: 'Message: Hello',
        fields: [
          {
            id: 'message',
            label: 'Message',
            placeholder: 'Hello',
            type: 'text',
            value: 'Hello',
          },
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
          {
            id: 'operator',
            label: 'Operator',
            type: 'select',
            value: 'contains',
            options: options.conditionOperators,
          },
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
          { id: 'mode', label: 'Wait for', type: 'select', value: 'time', options: options.waitModes },
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
            showWhen: { fieldId: 'mode', values: ['condition', 'appear', 'disappear'] },
          },
          {
            id: 'operator',
            label: 'Operator',
            type: 'select',
            value: 'contains',
            options: options.conditionOperators,
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
          {
            id: 'operator',
            label: 'Operator',
            type: 'select',
            value: 'equals',
            options: options.conditionOperators,
          },
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

export const createInputStepWithValue = (
  value: string,
  options: TemplateOptions,
) => {
  const step = createStepTemplate('input', options);
  const nextFields = step.fields.map((field) =>
    field.id === 'value' ? { ...field, value } : field,
  );
  const nextStep = { ...step, fields: nextFields };
  return { ...nextStep, summary: buildStepSummary(nextStep, options.conditionOperators) };
};
