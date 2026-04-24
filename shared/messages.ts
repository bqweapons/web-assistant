import type { FlowStepData } from './flowStepMigration';
import type { StructuredElementRecord, StructuredSiteData } from './siteDataSchema';
import type { SecretVaultStatus, SecretVaultTransferPayload } from './secrets';

export const MessageType = {
  START_PICKER: 'START_PICKER',
  CANCEL_PICKER: 'CANCEL_PICKER',
  PICKER_RESULT: 'PICKER_RESULT',
  PICKER_CANCELLED: 'PICKER_CANCELLED',
  PICKER_INVALID: 'PICKER_INVALID',
  GET_ACTIVE_PAGE_CONTEXT: 'GET_ACTIVE_PAGE_CONTEXT',
  ACTIVE_PAGE_CONTEXT: 'ACTIVE_PAGE_CONTEXT',
  PAGE_CONTEXT_PING: 'PAGE_CONTEXT_PING',
  CREATE_ELEMENT: 'CREATE_ELEMENT',
  UPDATE_ELEMENT: 'UPDATE_ELEMENT',
  DELETE_ELEMENT: 'DELETE_ELEMENT',
  PREVIEW_ELEMENT: 'PREVIEW_ELEMENT',
  FOCUS_ELEMENT: 'FOCUS_ELEMENT',
  SET_EDITING_ELEMENT: 'SET_EDITING_ELEMENT',
  ELEMENT_DRAFT_UPDATED: 'ELEMENT_DRAFT_UPDATED',
  REHYDRATE_ELEMENTS: 'REHYDRATE_ELEMENTS',
  START_FLOW_RECORDING: 'START_FLOW_RECORDING',
  STOP_FLOW_RECORDING: 'STOP_FLOW_RECORDING',
  FLOW_RECORDING_EVENT: 'FLOW_RECORDING_EVENT',
  FLOW_RECORDING_STATUS: 'FLOW_RECORDING_STATUS',
  START_FLOW_RUN: 'START_FLOW_RUN',
  STOP_FLOW_RUN: 'STOP_FLOW_RUN',
  FLOW_RUN_STATUS: 'FLOW_RUN_STATUS',
  FLOW_RUN_EXECUTE_STEP: 'FLOW_RUN_EXECUTE_STEP',
  FLOW_RUN_STEP_RESULT: 'FLOW_RUN_STEP_RESULT',
  // 1.4 — Vault unlock coordination between the extension-origin
  // unlock window, the SW, and the runner. Replaces the retired
  // `FLOW_RUN_VAULT_UNLOCK_PROMPT` page-facing message: the master
  // password must never transit through page DOM. See 1.4-spec.md.
  FLOW_RUN_UNLOCK_CONTEXT: 'FLOW_RUN_UNLOCK_CONTEXT',
  FLOW_RUN_UNLOCK_SUBMIT: 'FLOW_RUN_UNLOCK_SUBMIT',
  FLOW_RUN_UNLOCK_CANCEL: 'FLOW_RUN_UNLOCK_CANCEL',
  // 1.1 — sidepanel vault operations routed through the SW so the AES key
  // stays in SW memory only. Background owns the key; sidepanel is a pure
  // client. See `shared/secretsClient.ts` for the sidepanel wrapper and
  // `entrypoints/background/secretsVault.ts` for the SW-side state.
  SECRETS_STATUS: 'SECRETS_STATUS',
  SECRETS_UNLOCK: 'SECRETS_UNLOCK',
  SECRETS_LOCK: 'SECRETS_LOCK',
  SECRETS_RESET: 'SECRETS_RESET',
  SECRETS_RESOLVE: 'SECRETS_RESOLVE',
  SECRETS_UPSERT: 'SECRETS_UPSERT',
  SECRETS_DELETE: 'SECRETS_DELETE',
  SECRETS_EXPORT_TRANSFER: 'SECRETS_EXPORT_TRANSFER',
  SECRETS_IMPORT_TRANSFER: 'SECRETS_IMPORT_TRANSFER',
  // 1.14 — sidepanel write operations routed through the SW so that the
  // persisted-write path lives in a single realm with a single serialized
  // queue. Sidepanel (and any other non-SW caller) reaches these via
  // `shared/siteStorageClient.ts`; the SW owns the writer module at
  // `entrypoints/background/siteStorage.ts`. Content scripts remain
  // read-only and no longer trigger writebacks (they run in the host page
  // origin, which `navigator.locks` cannot coordinate with chrome-extension
  // origin — structurally removing the write capability is the correct
  // fix, not trying to serialize a cross-origin race).
  SITES_SET_SITE: 'SITES_SET_SITE',
  SITES_SET_ALL: 'SITES_SET_ALL',
  // 1.13 — sidepanel-initiated query for run-failure notices that the SW
  // synthesized during cold-start orphan cleanup. Orphan broadcast alone
  // is lossy when the sidepanel isn't open; this pull channel lets a
  // sidepanel mounting later drain the queue and render the failure.
  // Response: `{ ok: true, data: { notifications: FlowRunStatusPayload[] } }`.
  FLOW_RUN_PENDING_FAILURES_QUERY: 'FLOW_RUN_PENDING_FAILURES_QUERY',
  // F1 — Per-step frame resolution. Runner broadcasts this to each
  // known frame (via chrome.tabs.sendMessage with explicit frameId)
  // right before dispatching a selector-carrying atomic step. Each
  // content listener replies with `{matched}`; runner picks the winner.
  FLOW_RUN_FRAME_PROBE: 'FLOW_RUN_FRAME_PROBE',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export type PickerAccept = 'selector' | 'input' | 'area';
export type SelectorPickerAccept = Exclude<PickerAccept, 'area'>;

export type PickerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PickerStartPayload = {
  accept?: PickerAccept;
  disallowInput?: boolean;
  showInsertionMarker?: boolean;
};

export type PickerResultPayload = {
  selector?: string;
  beforeSelector?: string;
  afterSelector?: string;
  containerId?: string;
  rect?: PickerRect;
  // F1 — When the picker fires inside an iframe (window.top !== window),
  // the content script stamps the frame's location.href here so the
  // sidepanel can persist a step-level `targetFrame.url` locator and the
  // runner can resolve it back to a frameId at dispatch time. Absent
  // when the pick happened in the top frame.
  frameUrl?: string;
};

export type PickerCancelledPayload = {
  reason?: string;
};

export type PickerInvalidPayload = {
  reason?: string;
};

export type PageContextPayload = {
  url: string;
  siteKey: string;
  pageKey: string;
  title?: string;
  tabId?: number;
  timestamp?: number;
  hasAccess?: boolean;
};

export type PageContextPingPayload = {
  url?: string;
  title?: string;
};

export type ElementStylePayload = {
  preset?: string;
  inline?: Record<string, string>;
  customCss?: string;
};

export type MessageElementPayload = StructuredElementRecord;

export type FlowRecordingState = 'idle' | 'recording' | 'stopped' | 'error';
export type FlowRecordingEventType = 'click' | 'input' | 'password-skipped' | 'navigation-noted';

export type FlowRecordingStartPayload = {
  sessionId: string;
  siteKey?: string;
  pageKey?: string;
  flowId?: string;
  resumeAfterNavigation?: boolean;
};

export type FlowRecordingStopPayload = {
  sessionId: string;
};

export type FlowRecordingEventPayload = {
  sessionId: string;
  eventId: string;
  timestamp: number;
  type: FlowRecordingEventType;
  url: string;
  selector?: string;
  value?: string;
  inputKind?: 'text' | 'textarea' | 'select' | 'contenteditable' | 'password';
  message?: string;
  // F1 — Non-top-frame origin of the captured event. Set iff the
  // recorder firing this event was running inside an iframe
  // (window.top !== window); the recording→step conversion writes this
  // into step.targetFrame.url so replay can resolve the frame again.
  frameUrl?: string;
};

// F1 — Frame-probe payloads. Sent to every frame of a tab as part of
// per-step frame resolution (only when the step carries a selector and
// there's no run-level targetFrameId override). Request is minimal
// by design — the sender already knows each frame's URL from
// webNavigation.getAllFrames, so the probe only needs to report back
// whether the selector resolves to a node in that frame's document.
export type FlowRunFrameProbeRequest = {
  selector: string;
};

export type FlowRunFrameProbeResult = {
  matched: boolean;
};

export type FlowRecordingStatusPayload = {
  sessionId: string;
  state: FlowRecordingState;
  reason?: string;
  url?: string;
};

// 1.4 — `paused` is a first-class run state: the runner enters it
// when a step hits `secret-vault-locked` and an extension-origin
// unlock window is opened. Sidepanel renders this distinctly from
// `running`, and the Run button is guarded against double-start.
// Same `FlowRunState` value lands in the sentinel (1.13) so orphan
// cleanup treats it as an unfinished interruptible state.
export type FlowRunState = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';
export type FlowRunStartSource = 'flows-list' | 'flow-drawer-save-run';
export type FlowConditionOperator = 'contains' | 'equals' | 'greater' | 'less';
export type FlowRunAtomicStepType = 'click' | 'input' | 'wait' | 'assert' | 'condition' | 'popup' | 'read';
export type FlowRunLogLevel = 'info' | 'success' | 'error';

export type FlowRunLogEntry = {
  id: string;
  timestamp: number;
  level: FlowRunLogLevel;
  message: string;
  stepId?: string;
  stepType?: FlowRunAtomicStepType | 'navigate' | 'loop' | 'if-else' | 'data-source' | 'set-variable';
};

export type FlowRunExecutionDetails = {
  selector?: string;
  elementText?: string;
  fieldName?: string;
  popupMessage?: string;
  mode?: 'time' | 'condition' | 'appear' | 'disappear';
  durationMs?: number;
  operator?: FlowConditionOperator;
  expected?: string;
  actual?: string;
};

export type FlowRunDataSourceInput = {
  fileName: string;
  fileType: 'csv' | 'tsv';
  rawText: string;
};

export type FlowRunStepRequestId = string;

export type FlowRunFlowSnapshot = {
  id: string;
  name: string;
  description: string;
  scope?: 'page' | 'site' | 'global';
  siteKey: string;
  pageKey?: string | null;
  steps: FlowStepData[];
  updatedAt: number;
};

export type FlowRunStartPayload = {
  flow: FlowRunFlowSnapshot;
  source: FlowRunStartSource;
  dataSourceInputs?: Record<string, FlowRunDataSourceInput>;
};

export type FlowRunStopPayload = {
  runId: string;
};

export type FlowRunStatusPayload = {
  runId: string;
  flowId: string;
  siteKey: string;
  tabId: number;
  state: FlowRunState;
  currentStepId?: string;
  progress: {
    completedSteps: number;
    totalSteps: number;
  };
  error?: {
    code: string;
    message: string;
    phase?: 'dispatch' | 'execute' | 'result-wait' | 'navigate';
    recoverable?: boolean;
  };
  startedAt: number;
  endedAt?: number;
  activeUrl: string;
  logs: FlowRunLogEntry[];
};

export type FlowRunExecuteStepPayload = {
  runId: string;
  requestId: FlowRunStepRequestId;
  attempt: number;
  stepId: string;
  stepType: FlowRunAtomicStepType;
  selector?: string;
  value?: string;
  valueSource?: 'literal' | 'secret';
  message?: string;
  mode?: 'time' | 'condition' | 'appear' | 'disappear';
  durationMs?: number;
  operator?: FlowConditionOperator;
  expected?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  targetFrameId?: number;
  topFrameOnly?: boolean;
};

export type FlowRunExecuteResultPayload = {
  ok: boolean;
  runId: string;
  requestId: FlowRunStepRequestId;
  stepId: string;
  stepType: FlowRunAtomicStepType;
  conditionMatched?: boolean;
  // 1.6 taint signalling:
  // - `read` step: `actual` IS returned (user may legitimately want the value
  //   flowing into a subsequent step); `sensitive: true` marks it so the
  //   runner must add the resulting variable to `taintedVariables`.
  // - `condition`/`assert`/`wait-condition`: comparison happens in the
  //   content script; `actual` is OMITTED (undefined) when `sensitive: true`
  //   because nothing downstream needs it and keeping it would only add a
  //   leak surface. `conditionMatched` stays complete.
  actual?: string;
  sensitive?: boolean;
  details?: FlowRunExecutionDetails;
  error?: string;
  errorCode?: string;
};

// 1.4 — Vault unlock window coordination. The extension-origin
// unlock surface (entrypoints/vaultUnlock/) queries context on mount,
// submits the master password for verification, and can explicitly
// cancel. The master password never enters page DOM — these messages
// travel chrome-extension ↔ chrome-extension only.
export type FlowRunUnlockContextRequest = {
  runId: string;
};

export type FlowRunUnlockContextResponse =
  | {
      ok: true;
      runId: string;
      flowName: string | null;
      stepTitle: string | null;
      siteKey: string | null;
      // 1-based, incremented on each wrong-password attempt. Displayed
      // in the unlock window so the user can tell retries are landing.
      attempt: number;
      // Surfaces the most recent failure reason for UI display — e.g.
      // 'Invalid master password'. Absent when the window mounts for
      // the first time or after a successful retry reset.
      lastErrorMessage?: string;
    }
  | {
      ok: false;
      code: 'run-not-pending';
    };

export type FlowRunUnlockSubmitRequest = {
  runId: string;
  password: string;
};

export type FlowRunUnlockSubmitResponse =
  | { ok: true }
  | { ok: false; code: 'invalid-password'; attempt: number }
  | { ok: false; code: 'run-not-pending' };

export type FlowRunUnlockCancelRequest = {
  runId: string;
};

export type FlowRunUnlockCancelResponse = {
  ok: true;
};

export type RuntimeMessage =
  | { type: typeof MessageType.START_PICKER; data?: PickerStartPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.CANCEL_PICKER; data?: undefined; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.PICKER_RESULT; data: PickerResultPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.PICKER_CANCELLED; data?: PickerCancelledPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.PICKER_INVALID; data?: PickerInvalidPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.GET_ACTIVE_PAGE_CONTEXT; data?: undefined; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.ACTIVE_PAGE_CONTEXT; data: PageContextPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.PAGE_CONTEXT_PING; data?: PageContextPingPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.CREATE_ELEMENT; data: { element: MessageElementPayload }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.UPDATE_ELEMENT; data: { element: MessageElementPayload }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.DELETE_ELEMENT; data: { id: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.PREVIEW_ELEMENT; data: { element: MessageElementPayload }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FOCUS_ELEMENT; data: { id: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SET_EDITING_ELEMENT; data: { id?: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.ELEMENT_DRAFT_UPDATED; data: { element: MessageElementPayload }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.REHYDRATE_ELEMENTS; data: { elements: MessageElementPayload[] }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.START_FLOW_RECORDING; data: FlowRecordingStartPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.STOP_FLOW_RECORDING; data: FlowRecordingStopPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RECORDING_EVENT; data: FlowRecordingEventPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RECORDING_STATUS; data: FlowRecordingStatusPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.START_FLOW_RUN; data: FlowRunStartPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.STOP_FLOW_RUN; data: FlowRunStopPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_STATUS; data: FlowRunStatusPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_EXECUTE_STEP; data: FlowRunExecuteStepPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_STEP_RESULT; data: FlowRunExecuteResultPayload; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_UNLOCK_CONTEXT; data: FlowRunUnlockContextRequest; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_UNLOCK_SUBMIT; data: FlowRunUnlockSubmitRequest; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_UNLOCK_CANCEL; data: FlowRunUnlockCancelRequest; forwarded?: boolean; targetTabId?: number }
  // 1.1 — SECRETS_* messages. All responses go back via `{ ok: true, data }`
  // (the common pattern in this module's `respondPromise` helper). `data`
  // field here reflects the REQUEST payload only; response shapes are
  // documented at the handler in `entrypoints/background/bootstrap.ts`
  // and consumed in `shared/secretsClient.ts`.
  | { type: typeof MessageType.SECRETS_STATUS; data?: undefined; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_UNLOCK; data: { password: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_LOCK; data?: undefined; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_RESET; data?: undefined; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_RESOLVE; data: { name: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_UPSERT; data: { name: string; value: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_DELETE; data: { name: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_EXPORT_TRANSFER; data: { password: string }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SECRETS_IMPORT_TRANSFER; data: { payload: SecretVaultTransferPayload; password: string }; forwarded?: boolean; targetTabId?: number }
  // 1.14 — `data` shapes mirror the legacy `setSiteData` / `setAllSitesData`
  // signatures so the client wrapper is a direct rename. Response is `{ ok: true }`
  // with no data payload (void-equivalent); write errors (quota, storage) come
  // back as `{ ok: false, error }` through `respondPromise`.
  | { type: typeof MessageType.SITES_SET_SITE; data: { siteKey: string; data: Partial<StructuredSiteData> }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.SITES_SET_ALL; data: { sites: Record<string, StructuredSiteData> }; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_PENDING_FAILURES_QUERY; data?: undefined; forwarded?: boolean; targetTabId?: number }
  | { type: typeof MessageType.FLOW_RUN_FRAME_PROBE; data: FlowRunFrameProbeRequest; forwarded?: boolean; targetTabId?: number };

// 1.1 — response shape registry. Used by `shared/secretsClient.ts` to type
// the resolved value from each `sendRuntimeMessage` call. Keeping this
// separate from the RuntimeMessage union avoids making the union itself
// carry response data, which would conflict with how the runtime wraps
// everything in `{ ok, data, error }`.
export type SecretsMessageResponse = {
  [MessageType.SECRETS_STATUS]: SecretVaultStatus;
  [MessageType.SECRETS_UNLOCK]: SecretVaultStatus;
  [MessageType.SECRETS_LOCK]: { locked: true };
  [MessageType.SECRETS_RESET]: SecretVaultStatus;
  [MessageType.SECRETS_RESOLVE]: { value: string };
  [MessageType.SECRETS_UPSERT]: SecretVaultStatus;
  [MessageType.SECRETS_DELETE]: SecretVaultStatus;
  [MessageType.SECRETS_EXPORT_TRANSFER]: SecretVaultTransferPayload | null;
  [MessageType.SECRETS_IMPORT_TRANSFER]: SecretVaultStatus;
};
