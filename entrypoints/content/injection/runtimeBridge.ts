import type { RuntimeMessage } from '../../../shared/messages';
import { sendRuntimeMessage } from '../../../shared/runtimeMessaging';

export const sendRuntimeMessageSafe = async (message: RuntimeMessage) => {
  try {
    const data = await sendRuntimeMessage(message);
    return { ok: true, data } as const;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } as const;
  }
};
