import type { RuntimeMessage } from '../../../shared/messages';

export const sendRuntimeMessage = <TResponse = unknown>(
  message: RuntimeMessage | Record<string, unknown>,
): Promise<TResponse> => {
  return new Promise<TResponse>((resolve, reject) => {
    const runtime = chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new Error('Messaging API unavailable.'));
      return;
    }
    runtime.sendMessage(message, (response) => {
      const lastError = runtime.lastError?.message;
      if (lastError) {
        reject(new Error(lastError));
        return;
      }
      if (response?.ok === false) {
        reject(new Error(response.error || 'Messaging failed.'));
        return;
      }
      if (response && typeof response === 'object' && 'data' in response) {
        resolve((response as { data: TResponse }).data);
        return;
      }
      resolve(response as TResponse);
    });
  });
};

