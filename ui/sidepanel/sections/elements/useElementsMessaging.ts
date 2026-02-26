import { MessageType } from '../../../../shared/messages';
import { sendRuntimeMessage } from '../../../../shared/runtimeMessaging';
import { t } from '../../utils/i18n';

export const getInjectionErrorMessage = (code: string) => {
  const normalized = code.trim().toLowerCase();
  if (
    normalized === 'content-unavailable' ||
    normalized.includes('receiving end does not exist') ||
    normalized.includes('could not establish connection')
  ) {
    return t(
      'sidepanel_elements_injection_error_content',
      'Cannot connect to the page script. Reload the page and try again.',
    );
  }
  if (normalized === 'site-mismatch') {
    return t('sidepanel_elements_injection_error_site', 'Current page does not match element site.');
  }
  if (normalized === 'container-not-found') {
    return t('sidepanel_elements_injection_error_container', 'Container not found on page.');
  }
  if (normalized === 'target-not-found') {
    return t('sidepanel_elements_injection_error_target', 'Target element not found.');
  }
  return t('sidepanel_elements_injection_error', 'Failed to inject element: {error}').replace(
    '{error}',
    code,
  );
};

export const sendElementMessage = async (
  type: MessageType,
  payload?: Record<string, unknown>,
  options?: { targetTabId?: number },
) => {
  const response = (await sendRuntimeMessage({
    type,
    data: payload,
    targetTabId: options?.targetTabId,
  })) as {
    ok?: boolean;
    error?: string;
  };
  if (response?.ok === false && response.error) {
    throw new Error(response.error);
  }
};
