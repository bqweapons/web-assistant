/// <reference lib="webworker" />

import { runSafeTransformCode } from './transformRuntime';

type JsTransformRequest = {
  id: string;
  code: string;
  input: string;
  row: Record<string, string>;
  nowTimestamp: number;
};

type JsTransformResponse =
  | {
      id: string;
      ok: true;
      output: string;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

self.addEventListener('message', async (event: MessageEvent<JsTransformRequest>) => {
  const payload = event.data;
  if (!payload || typeof payload.id !== 'string') {
    return;
  }
  let response: JsTransformResponse;
  try {
    const output = runSafeTransformCode({
      code: payload.code,
      input: payload.input,
      row: payload.row,
      nowTimestamp: payload.nowTimestamp,
    });
    response = {
      id: payload.id,
      ok: true,
      output,
    };
  } catch (error) {
    response = {
      id: payload.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(response);
});
