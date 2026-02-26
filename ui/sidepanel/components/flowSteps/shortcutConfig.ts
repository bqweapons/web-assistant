import {
  AlignLeft,
  AlignRight,
  Calendar,
  Clock3,
  Hash,
  Replace,
  Scissors,
  Timer,
} from 'lucide-react';
import { t } from '../../utils/i18n';
import type { StepFieldOption } from './types';

export const getWaitModes = (): StepFieldOption[] => [
  { value: 'time', label: t('sidepanel_step_wait_mode_time', 'Time delay') },
  { value: 'condition', label: t('sidepanel_step_wait_mode_condition', 'Element condition') },
  { value: 'appear', label: t('sidepanel_step_wait_mode_appear', 'Element appears') },
  { value: 'disappear', label: t('sidepanel_step_wait_mode_disappear', 'Element disappears') },
];

export const getConditionOperators = (): StepFieldOption[] => [
  { value: 'contains', label: t('sidepanel_step_condition_contains', 'Contains') },
  { value: 'equals', label: t('sidepanel_step_condition_equals', 'Equals') },
  { value: 'greater', label: t('sidepanel_step_condition_greater', 'Greater than') },
  { value: 'less', label: t('sidepanel_step_condition_less', 'Less than') },
];

export const FIELD_LABEL_KEYS: Record<string, string> = {
  Selector: 'sidepanel_field_selector',
  Value: 'sidepanel_field_value',
  Message: 'sidepanel_field_message',
  Iterations: 'sidepanel_field_iterations',
  'Wait for': 'sidepanel_field_wait_for',
  'Duration (ms)': 'sidepanel_field_duration_ms',
  Operator: 'sidepanel_field_operator',
  URL: 'sidepanel_field_url',
  'Header row': 'sidepanel_steps_header_row',
};

export const getInputValueShortcuts = () => [
  {
    id: 'date',
    token: '{{now.date}}',
    label: t('sidepanel_step_input_shortcut_date', 'Insert current date'),
    icon: Calendar,
  },
  {
    id: 'time',
    token: '{{now.time}}',
    label: t('sidepanel_step_input_shortcut_time', 'Insert current time'),
    icon: Clock3,
  },
  {
    id: 'datetime',
    token: '{{now.datetime}}',
    label: t('sidepanel_step_input_shortcut_datetime', 'Insert current date and time'),
    icon: Timer,
  },
  {
    id: 'timestamp',
    token: '{{now.timestamp}}',
    label: t('sidepanel_step_input_shortcut_timestamp', 'Insert current timestamp'),
    icon: Hash,
  },
];

export const getTransformCodeShortcuts = () => [
  {
    id: 'replace',
    label: t('sidepanel_step_input_transform_replace', 'Replace'),
    icon: Replace,
    code: `const value = String(input ?? '');
return helpers.replace(value, '-', '');`,
  },
  {
    id: 'left-pad',
    label: t('sidepanel_step_input_transform_leftpad', 'Left pad'),
    icon: AlignLeft,
    code: `const value = String(input ?? '');
return helpers.leftPad(value, 8, '0');`,
  },
  {
    id: 'right-pad',
    label: t('sidepanel_step_input_transform_rightpad', 'Right pad'),
    icon: AlignRight,
    code: `const value = String(input ?? '');
return helpers.rightPad(value, 8, ' ');`,
  },
  {
    id: 'substr',
    label: t('sidepanel_step_input_transform_substr', 'Substring'),
    icon: Scissors,
    code: `const value = String(input ?? '');
return helpers.substr(value, 0, 4);`,
  },
];
