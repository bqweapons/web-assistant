// Locale keys for common flow-run error codes. Shared by the side panel
// (`formatRunnerError`) and the on-page run notice in the content script,
// so both show the same translated text instead of the runner's English.
export const RUNNER_ERROR_MESSAGES: Record<string, { messageKey: string; fallback: string }> = {
  'missing-selector': {
    messageKey: 'runner_error_missing_selector',
    fallback: 'A step has no selector. Edit the flow and pick the target element.',
  },
  'selector-not-found': {
    messageKey: 'runner_error_selector_not_found',
    fallback: 'The target element was not found on this page.',
  },
  'invalid-selector': {
    messageKey: 'runner_error_invalid_selector',
    fallback: 'A step has an invalid selector.',
  },
  'input-target-invalid': {
    messageKey: 'runner_error_input_target_invalid',
    fallback: 'The target of an input step is not a text field or select box.',
  },
  'select-option-not-found': {
    messageKey: 'runner_error_select_option_not_found',
    fallback: 'No option in the select box matched the value.',
  },
  'assertion-failed': {
    messageKey: 'runner_error_assertion_failed',
    fallback: 'An assert step did not match the expected value.',
  },
  'wait-appear-timeout': {
    messageKey: 'runner_error_wait_appear_timeout',
    fallback: 'Timed out waiting for the element to appear.',
  },
  'wait-disappear-timeout': {
    messageKey: 'runner_error_wait_disappear_timeout',
    fallback: 'Timed out waiting for the element to disappear.',
  },
  'wait-condition-timeout': {
    messageKey: 'runner_error_wait_condition_timeout',
    fallback: 'Timed out waiting for the condition.',
  },
  'navigate-url-missing': {
    messageKey: 'runner_error_navigate_url_missing',
    fallback: 'A navigate step has no URL.',
  },
  'navigate-url-invalid': {
    messageKey: 'runner_error_navigate_url_invalid',
    fallback: 'A navigate step has an invalid URL.',
  },
  'navigate-timeout': {
    messageKey: 'runner_error_navigate_timeout',
    fallback: 'The page took too long to load after navigation.',
  },
  'tab-closed': {
    messageKey: 'runner_error_tab_closed',
    fallback: 'The tab running this flow was closed.',
  },
  'no-active-tab': {
    messageKey: 'runner_error_no_active_tab',
    fallback: 'No active tab to run the flow in.',
  },
  'content_script_not_available_refresh_required': {
    messageKey: 'runner_error_refresh_required',
    fallback: 'Ladybird cannot reach this page yet. Reload the page and try again.',
  },
};
