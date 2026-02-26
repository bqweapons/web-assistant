import { buildStepSummary } from './summary';
import { t } from '../../utils/i18n';
import type { StepData, StepFieldOption } from './types';

type TemplateOptions = {
  waitModes: StepFieldOption[];
  conditionOperators: StepFieldOption[];
};

export const createStepId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const getOperatorLabel = (options: StepFieldOption[], value: string) =>
  options.find((option) => option.value === value)?.label || value;

export const createStepTemplate = (type: string, options: TemplateOptions): StepData => {
  const containsLabel = getOperatorLabel(options.conditionOperators, 'contains');
  const equalsLabel = getOperatorLabel(options.conditionOperators, 'equals');
  switch (type) {
    case 'click':
      return {
        id: createStepId('click'),
        type: 'click',
        title: t('sidepanel_step_click_label', 'Click'),
        summary: t('sidepanel_step_summary_selector', 'Selector: {value}').replace('{value}', '.btn-primary'),
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
        title: t('sidepanel_step_input_label', 'Input'),
        summary: t('sidepanel_step_summary_value', 'Value: {value}').replace('{value}', 'Example text'),
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
        title: t('sidepanel_step_popup_label', 'Popup'),
        summary: t('sidepanel_step_summary_message', 'Message: {value}').replace('{value}', 'Hello'),
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
        title: t('sidepanel_step_loop_label', 'Loop'),
        summary: t('sidepanel_step_summary_repeat_times', 'Repeat {count} times').replace('{count}', '3'),
        fields: [{ id: 'iterations', label: 'Iterations', placeholder: '3', type: 'number', value: '3' }],
        children: [],
      };
    case 'data-source':
      return {
        id: createStepId('data-source'),
        type: 'data-source',
        title: t('sidepanel_step_data_source_label', 'Data Source'),
        summary: t('sidepanel_steps_file_waiting', 'Awaiting file selection'),
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
        title: t('sidepanel_step_if_else_label', 'If / Else'),
        summary: t('sidepanel_step_summary_if', 'If {selector} {operator} "{value}"')
          .replace('{selector}', '.status')
          .replace('{operator}', containsLabel)
          .replace('{value}', 'Ready'),
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
          { id: 'branch-then', label: t('sidepanel_steps_branch_then', 'Then'), steps: [] },
          { id: 'branch-else', label: t('sidepanel_steps_branch_else', 'Else'), steps: [] },
        ],
      };
    case 'wait':
      return {
        id: createStepId('wait'),
        type: 'wait',
        title: t('sidepanel_step_wait_label', 'Wait'),
        summary: t('sidepanel_step_summary_duration', 'Duration: {value} ms').replace('{value}', '1200'),
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
        title: t('sidepanel_step_navigate_label', 'Navigate'),
        summary: t('sidepanel_step_summary_url', 'URL: {value}').replace('{value}', 'https://example.com'),
        fields: [
          { id: 'url', label: 'URL', placeholder: 'https://example.com', type: 'text', value: '' },
        ],
      };
    case 'assert':
      return {
        id: createStepId('assert'),
        type: 'assert',
        title: t('sidepanel_step_assert_label', 'Assert'),
        summary: t('sidepanel_step_summary_expect', 'Expect {selector} {operator} "{value}"')
          .replace('{selector}', '.status')
          .replace('{operator}', equalsLabel)
          .replace('{value}', 'Ready'),
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
        title: t('sidepanel_steps_template_new_title', 'New step'),
        summary: t('sidepanel_steps_template_new_summary', 'Configure step details'),
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
