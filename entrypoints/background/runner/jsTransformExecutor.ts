import { runSafeTransformCode } from '../transformRuntime';
import type { FlowRowContext } from './tokenRenderer';

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

type PendingTransformRequest = {
  resolve: (output: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type JsTransformInput = {
  code: string;
  value: string;
  row?: FlowRowContext;
  timeoutMs?: number;
};

const JS_TRANSFORM_DEFAULT_TIMEOUT_MS = 300;
const JS_TRANSFORM_MIN_TIMEOUT_MS = 50;
const JS_TRANSFORM_MAX_TIMEOUT_MS = 5_000;

export class JsTransformExecutor {
  private worker: Worker | null = null;

  private requestSequence = 0;

  private readonly pendingRequests = new Map<string, PendingTransformRequest>();

  private normalizeTransformTimeout(value?: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return JS_TRANSFORM_DEFAULT_TIMEOUT_MS;
    }
    return Math.min(JS_TRANSFORM_MAX_TIMEOUT_MS, Math.max(JS_TRANSFORM_MIN_TIMEOUT_MS, Math.trunc(value)));
  }

  private clearTransformRequest(requestId: string) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);
  }

  private terminateTransformWorker(reason: string) {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    const error = new Error(reason);
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(requestId);
    }
  }

  private ensureTransformWorker() {
    if (this.worker) {
      return this.worker;
    }
    if (typeof Worker === 'undefined') {
      throw new Error('Worker API unavailable for JS transform sandbox.');
    }
    const worker = new Worker(new URL('../transformSandbox.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<JsTransformResponse>) => {
      const response = event.data;
      if (!response || typeof response.id !== 'string') {
        return;
      }
      const pending = this.pendingRequests.get(response.id);
      if (!pending) {
        return;
      }
      this.clearTransformRequest(response.id);
      if (response.ok) {
        pending.resolve(response.output);
        return;
      }
      pending.reject(new Error(response.error || 'JS transform failed.'));
    });
    worker.addEventListener('error', (event: ErrorEvent) => {
      const message = event.message || 'JS transform sandbox worker crashed.';
      this.terminateTransformWorker(message);
    });
    this.worker = worker;
    return worker;
  }

  private async runJsTransformInlineFallback(input: {
    code: string;
    value: string;
    row?: FlowRowContext;
    timeoutMs: number;
  }) {
    const execution = Promise.resolve(
      runSafeTransformCode({
        code: input.code,
        input: input.value,
        row: input.row,
        nowTimestamp: Date.now(),
      }),
    );
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`JS transform timed out after ${input.timeoutMs}ms.`));
      }, input.timeoutMs);
    });
    return Promise.race([execution, timeout]);
  }

  async run(input: JsTransformInput) {
    const timeoutMs = this.normalizeTransformTimeout(input.timeoutMs);
    if (typeof Worker === 'undefined') {
      return this.runJsTransformInlineFallback({
        code: input.code,
        value: input.value,
        row: input.row,
        timeoutMs,
      });
    }
    const worker = this.ensureTransformWorker();
    const requestId = `t-${Date.now()}-${(this.requestSequence += 1)}`;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.clearTransformRequest(requestId);
        this.terminateTransformWorker(`JS transform timed out after ${timeoutMs}ms.`);
        reject(new Error(`JS transform timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pendingRequests.set(requestId, { resolve, reject, timer });
      const request: JsTransformRequest = {
        id: requestId,
        code: input.code,
        input: input.value,
        row: input.row ?? {},
        nowTimestamp: Date.now(),
      };
      worker.postMessage(request);
    });
  }
}
