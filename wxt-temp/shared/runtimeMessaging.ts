import type { RuntimeMessage } from './messages';

export const sendRuntimeMessage = <TResponse = unknown>(
  message: RuntimeMessage | Record<string, unknown>,
  runtimeApi = chrome?.runtime,
): Promise<TResponse> => {
  return new Promise<TResponse>((resolve, reject) => {
    if (!runtimeApi?.sendMessage) {
      reject(new Error('Messaging API unavailable.'));
      return;
    }
    runtimeApi.sendMessage(message, (response) => {
      const lastError = runtimeApi.lastError?.message;
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
