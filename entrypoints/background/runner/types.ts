import type {
  FlowRunAtomicStepType,
  FlowRunDataSourceInput,
  FlowRunExecuteResultPayload,
  FlowRunExecuteStepPayload,
  FlowRunFlowSnapshot,
  FlowRunLogEntry,
  FlowRunStartPayload,
  FlowRunStepRequestId,
  FlowRunState,
  RuntimeMessage,
} from '../../../shared/messages';
import type { TabBridge } from '../runtime/tabBridge';

// Runtime ceilings and step-loop timing. Per AGENTS.md §7, this file is
// the source of truth for these caps. They are intentionally conservative
// — large enough for realistic flows, small enough that a misconfigured
// or malicious flow is bounded. If any needs to be user-configurable,
// expose it through globalSettings and respect both the setting and the
// hard ceiling here.
export const STEP_ACTION_TIMEOUT_MS = 10_000;
export const WAIT_SELECTOR_TIMEOUT_MS = 6_000;
export const NAVIGATION_TIMEOUT_MS = 20_000;
export const CONDITION_POLL_INTERVAL_MS = 120;
export const STATUS_THROTTLE_MS = 200;
export const STEP_MESSAGE_RETRY_TIMEOUT_MS = 60_000;
export const STEP_MESSAGE_RETRY_INTERVAL_MS = 250;
export const STEP_RESULT_WAIT_GRACE_MS = 1_200;
export const STEP_RESULT_WAIT_MIN_MS = 1_000;
export const ENABLE_EVENT_DRIVEN_RECOVERY = true;
export const MAX_RUN_LOG_ENTRIES = 500;
export const MAX_TOTAL_STEPS_EXECUTED = 10_000;
export const MAX_LOOP_ITERATIONS = 5_000;
export const MAX_RUN_DURATION_MS = 10 * 60 * 1000;
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][0-9A-Za-z_]*$/;

export const REDACTED_PLACEHOLDER = '[REDACTED]';

// 1.5 — Broad detection: whole-value match (isSecretTokenValue) is too
// narrow; a field like "prefix-{{secret.X}}-suffix" still leaks after
// resolution. This scans for any secret token anywhere in the raw field.
export const SECRET_TOKEN_ANYWHERE = /\{\{\s*secret\.[^{}]+\s*\}\}/;
export const VARIABLE_TOKEN_ANYWHERE = /\{\{\s*var\.([A-Za-z_][0-9A-Za-z_]*)\s*\}\}/g;

export const redactIfTainted = (value: string | undefined, tainted: boolean) =>
  tainted ? REDACTED_PLACEHOLDER : value ?? '';

export const isRawFieldTainted = (rawValue: string, taintedVariables: Set<string>) => {
  if (!rawValue) {
    return false;
  }
  if (SECRET_TOKEN_ANYWHERE.test(rawValue)) {
    return true;
  }
  for (const match of rawValue.matchAll(VARIABLE_TOKEN_ANYWHERE)) {
    if (taintedVariables.has(match[1])) {
      return true;
    }
  }
  return false;
};

export type FlowRunError = {
  code: string;
  message: string;
  phase?: 'dispatch' | 'execute' | 'result-wait' | 'navigate';
  recoverable?: boolean;
};

export type InFlightRecoverSource = 'timeout' | 'tab-updated' | 'page-ping';
export type InFlightStepStatus = 'dispatched' | 'awaiting_result' | 'superseded';

export type InFlightAtomicStep = {
  stepId: string;
  stepType: FlowRunAtomicStepType;
  payload: FlowRunExecuteStepPayload;
  attempt: number;
  currentRequestId: FlowRunStepRequestId;
  stepStartUrl: string;
  lastKnownUrl: string;
  deadlineAt: number;
  startedAt: number;
  status: InFlightStepStatus;
  recoverSource?: InFlightRecoverSource;
};

export type FlowRunInternal = {
  runId: string;
  flow: FlowRunFlowSnapshot;
  source: FlowRunStartPayload['source'];
  dataSourceInputs: Record<string, FlowRunDataSourceInput>;
  tabId: number;
  targetFrameId?: number;
  siteKey: string;
  state: FlowRunState;
  currentStepId?: string;
  progress: {
    completedSteps: number;
    totalSteps: number;
  };
  error?: FlowRunError;
  startedAt: number;
  endedAt?: number;
  activeUrl: string;
  cancelRequested: boolean;
  abortReason?: FlowRunError;
  lastStatusPushAt: number;
  logs: FlowRunLogEntry[];
  logSequence: number;
  variables: Record<string, string>;
  // 1.5 taint tracking. Contains variable names whose current value is
  // secret-derived (from {{secret.*}} resolution, from a JS transform whose
  // input was tainted, or from an executeRead on a sensitive DOM element).
  // `set-variable` mutates this Set — add on tainted assignment, delete on
  // explicit clean assignment. `toStatusPayload` does NOT broadcast
  // `variables`, so leakage only needs to be guarded on log/payload sinks.
  taintedVariables: Set<string>;
  executedStepCount: number;
  statusTimer?: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  inFlightAtomic?: InFlightAtomicStep;
};

// 1.5 — Result of resolving one step field. `tainted=true` means the value
// is secret-derived (via {{secret.*}}, {{var.X}} where X is tainted, OR via
// a JS transform whose input was tainted). Runner-internal ONLY — never
// cross a messaging boundary as this wrapper.
export type ResolvedFieldValue = {
  value: string;
  tainted: boolean;
};

// 1.5 — Parallel struct so taintedFields never rides inside the payload
// itself. The payload crosses `runtime.sendMessage` to the content script;
// a taint flag hitching on the payload (even with an underscore prefix)
// is one `delete` away from leaking. Literal union keeps the set tight:
// adding a new taint-carrying payload field is a compile error until you
// opt it in here.
export type TaintedPayloadField = 'value' | 'expected' | 'message' | 'selector';
export type BuiltAtomicPayload = {
  payload: FlowRunExecuteStepPayload;
  taintedFields: Set<TaintedPayloadField>;
};

export class RunnerError extends Error {
  readonly code: string;
  readonly phase?: FlowRunError['phase'];
  readonly recoverable?: boolean;

  constructor(
    code: string,
    message: string,
    options?: { phase?: FlowRunError['phase']; recoverable?: boolean },
  ) {
    super(message);
    this.code = code;
    this.phase = options?.phase;
    this.recoverable = options?.recoverable;
  }
}

export type FlowRunnerManagerOptions = {
  runtime?: {
    sendMessage?: (message: RuntimeMessage) => void;
  };
  tabBridge: TabBridge;
  statusThrottleMs?: number;
  // 1.13 — unique marker for this SW lifetime. Stamped into every run
  // sentinel so next cold-start's orphan-cleanup can distinguish our own
  // sentinels from those left behind by a previous suspended SW.
  swInstanceId?: string;
  // 1.13 — promise that resolves once bootstrap's orphan-cleanup pass has
  // finished. `start()` awaits this before writing a new sentinel, so a
  // fresh sentinel is never in storage at the instant cleanup enumerates
  // keys. Defaults to an already-resolved promise when absent (tests /
  // standalone construction).
  orphanCleanupPromise?: Promise<void>;
};

export type PendingStepRequest = {
  runId: string;
  stepId: string;
  stepType: FlowRunAtomicStepType;
  resolve: (value: FlowRunExecuteResultPayload) => void;
  reject: (reason?: unknown) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
};

// 1.4 — Per-run pending vault unlock. Created by `awaitVaultUnlock`
// when a step hits `secret-vault-locked`; resolved by the SW's
// FLOW_RUN_UNLOCK_SUBMIT handler on password verification success,
// or rejected by FLOW_RUN_UNLOCK_CANCEL / `chrome.windows.onRemoved`
// when the user closes the unlock window. `attempt` is a
// display-only counter; it increments on each wrong-password
// submit and is surfaced via FLOW_RUN_UNLOCK_CONTEXT so the
// unlock window can render "attempt N" and the last error.
export type PendingUnlockRequest = {
  runId: string;
  stepId: string;
  flowName: string | null;
  stepTitle: string | null;
  siteKey: string | null;
  windowId: number | null;
  attempt: number;
  lastErrorMessage?: string;
  // Review fix — set true while FLOW_RUN_UNLOCK_SUBMIT is running
  // unlockSecretsVault. The `chrome.windows.onRemoved` watchdog must
  // not reject a pending unlock whose submit is in flight — otherwise
  // a user who hits Unlock with the correct password and immediately
  // closes the window races the watchdog, which fails the run even
  // though the vault actually unlocked successfully.
  submitInFlight: boolean;
  // Set by the onRemoved watchdog when a close arrives while a submit
  // is in flight. The SUBMIT handler reads this on the
  // invalid-password path and rejects the run (since the window is
  // gone and there's nowhere to retry).
  closedDuringSubmit: boolean;
  resolve: () => void;
  reject: (reason: 'cancelled' | 'interrupted') => void;
};
