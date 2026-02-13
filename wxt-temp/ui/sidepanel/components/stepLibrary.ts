export type StepLibraryItem = {
  type: string;
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
};

export const STEP_LIBRARY: StepLibraryItem[] = [
  {
    type: 'click',
    labelKey: 'sidepanel_step_click_label',
    label: 'Click',
    descriptionKey: 'sidepanel_step_click_description',
    description: 'Click an element by selector.',
  },
  {
    type: 'input',
    labelKey: 'sidepanel_step_input_label',
    label: 'Input',
    descriptionKey: 'sidepanel_step_input_description',
    description: 'Type text into a field.',
  },
  {
    type: 'popup',
    labelKey: 'sidepanel_step_popup_label',
    label: 'Popup',
    descriptionKey: 'sidepanel_step_popup_description',
    description: 'Show a popup dialog message.',
  },
  {
    type: 'loop',
    labelKey: 'sidepanel_step_loop_label',
    label: 'Loop',
    descriptionKey: 'sidepanel_step_loop_description',
    description: 'Repeat nested steps for a count.',
  },
  {
    type: 'data-source',
    labelKey: 'sidepanel_step_data_source_label',
    label: 'Data Source',
    descriptionKey: 'sidepanel_step_data_source_description',
    description: 'Load CSV/TSV and loop rows.',
  },
  {
    type: 'if-else',
    labelKey: 'sidepanel_step_if_else_label',
    label: 'If / Else',
    descriptionKey: 'sidepanel_step_if_else_description',
    description: 'Branch steps based on a condition.',
  },
  {
    type: 'wait',
    labelKey: 'sidepanel_step_wait_label',
    label: 'Wait',
    descriptionKey: 'sidepanel_step_wait_description',
    description: 'Pause or wait for element condition.',
  },
  {
    type: 'navigate',
    labelKey: 'sidepanel_step_navigate_label',
    label: 'Navigate',
    descriptionKey: 'sidepanel_step_navigate_description',
    description: 'Go to a URL.',
  },
  {
    type: 'assert',
    labelKey: 'sidepanel_step_assert_label',
    label: 'Assert',
    descriptionKey: 'sidepanel_step_assert_description',
    description: 'Check a value or state.',
  },
];
