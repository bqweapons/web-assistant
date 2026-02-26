import { t } from '../../utils/i18n';
import type { StepData, StepField, StepFieldOption } from './types';

export const getFieldValue = (step: StepData, fieldId: string) =>
  step.fields.find((field) => field.id === fieldId)?.value ?? '';

export const shouldShowField = (step: StepData, field: StepField) => {
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

const getOperatorLabel = (operators: StepFieldOption[], value: string) =>
  operators.find((option) => option.value === value)?.label || value;

export const buildStepSummary = (step: StepData, operators: StepFieldOption[]) => {
  const selector = getFieldValue(step, 'selector');
  const value = getFieldValue(step, 'value');
  const message = getFieldValue(step, 'message');
  const operator = getFieldValue(step, 'operator');
  const expected = getFieldValue(step, 'expected');
  const mode = getFieldValue(step, 'mode');
  const duration = getFieldValue(step, 'duration');
  const url = getFieldValue(step, 'url');
  const iterations = getFieldValue(step, 'iterations');
  const operatorLabel = operator ? getOperatorLabel(operators, operator) : '';

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
    case 'popup':
      return t('sidepanel_step_summary_message', 'Message: {value}').replace(
        '{value}',
        message || t('sidepanel_field_not_set', 'Not set'),
      );
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
        return t('sidepanel_step_summary_if', 'If {selector} {operator} "{value}"')
          .replace('{selector}', selector || t('sidepanel_field_selector', 'Selector'))
          .replace('{operator}', operatorLabel || t('sidepanel_step_condition_is', 'is'))
          .replace('{value}', expected || '');
      }
      return t('sidepanel_step_summary_conditional', 'Conditional check');
    case 'wait':
      if (mode === 'condition') {
        return t('sidepanel_step_summary_wait_until', 'Wait until {selector} {operator} "{value}"')
          .replace('{selector}', selector || t('sidepanel_field_selector', 'Selector'))
          .replace('{operator}', operatorLabel || t('sidepanel_step_condition_is', 'is'))
          .replace('{value}', expected || '');
      }
      if (mode === 'appear') {
        return t('sidepanel_step_summary_wait_appear', 'Wait until {selector} appears').replace(
          '{selector}',
          selector || t('sidepanel_field_selector', 'Selector'),
        );
      }
      if (mode === 'disappear') {
        return t('sidepanel_step_summary_wait_disappear', 'Wait until {selector} disappears').replace(
          '{selector}',
          selector || t('sidepanel_field_selector', 'Selector'),
        );
      }
      return t('sidepanel_step_summary_duration', 'Duration: {value} ms').replace('{value}', duration || '0');
    case 'navigate':
      return t('sidepanel_step_summary_url', 'URL: {value}').replace(
        '{value}',
        url || t('sidepanel_field_not_set', 'Not set'),
      );
    case 'assert':
      return t('sidepanel_step_summary_expect', 'Expect {selector} {operator} "{value}"')
        .replace('{selector}', selector || t('sidepanel_field_selector', 'Selector'))
        .replace('{operator}', operatorLabel || t('sidepanel_step_condition_is', 'is'))
        .replace('{value}', expected || '');
    default:
      return step.summary || step.title;
  }
};
