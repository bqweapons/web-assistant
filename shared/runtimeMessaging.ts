import type { RuntimeMessage } from './messages';

// 2.5 — Removed the `| Record<string, unknown>` escape hatch. Callers must
// pass a discriminated `RuntimeMessage`; if a local abstraction genuinely
// needs to be type-loose (e.g. a helper that forwards any element-injection
// message kind), it should cast explicitly at its own boundary so the audit
// surface is visible. The prior union accepted anything, silently defeating
// the discriminated message contract.
export const sendRuntimeMessage = <TResponse = unknown>(
  message: RuntimeMessage,
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
