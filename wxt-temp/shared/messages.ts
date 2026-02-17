import type { FlowStepData } from './flowStepMigration';
import type { StructuredElementRecord } from './siteDataSchema';

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
  START_FLOW_RUN: 'START_FLOW_RUN',
  STOP_FLOW_RUN: 'STOP_FLOW_RUN',
  FLOW_RUN_STATUS: 'FLOW_RUN_STATUS',
  FLOW_RUN_EXECUTE_STEP: 'FLOW_RUN_EXECUTE_STEP',
  FLOW_RUN_STEP_RESULT: 'FLOW_RUN_STEP_RESULT',
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

export type FlowRunState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type FlowRunStartSource = 'flows-list' | 'flow-drawer-save-run';
export type FlowConditionOperator = 'contains' | 'equals' | 'greater' | 'less';
export type FlowRunAtomicStepType = 'click' | 'input' | 'wait' | 'assert' | 'condition' | 'popup';
export type FlowRunLogLevel = 'info' | 'success' | 'error';

export type FlowRunLogEntry = {
  id: string;
  timestamp: number;
  level: FlowRunLogLevel;
  message: string;
  stepId?: string;
  stepType?: FlowRunAtomicStepType | 'navigate' | 'loop' | 'if-else' | 'data-source';
};

export type FlowRunExecutionDetails = {
  selector?: string;
  elementText?: string;
  fieldName?: string;
  inputValue?: string;
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
  message?: string;
  mode?: 'time' | 'condition' | 'appear' | 'disappear';
  durationMs?: number;
  operator?: FlowConditionOperator;
  expected?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export type FlowRunExecuteResultPayload = {
  ok: boolean;
  runId: string;
  requestId: FlowRunStepRequestId;
  stepId: string;
  stepType: FlowRunAtomicStepType;
  conditionMatched?: boolean;
  actual?: string;
  details?: FlowRunExecutionDetails;
  error?: string;
  errorCode?: string;
};

export type RuntimeMessage =
  | { type: typeof MessageType.START_PICKER; data?: PickerStartPayload; forwarded?: boolean }
  | { type: typeof MessageType.CANCEL_PICKER; data?: undefined; forwarded?: boolean }
  | { type: typeof MessageType.PICKER_RESULT; data: PickerResultPayload; forwarded?: boolean }
  | { type: typeof MessageType.PICKER_CANCELLED; data?: PickerCancelledPayload; forwarded?: boolean }
  | { type: typeof MessageType.PICKER_INVALID; data?: PickerInvalidPayload; forwarded?: boolean }
  | { type: typeof MessageType.GET_ACTIVE_PAGE_CONTEXT; data?: undefined; forwarded?: boolean }
  | { type: typeof MessageType.ACTIVE_PAGE_CONTEXT; data: PageContextPayload; forwarded?: boolean }
  | { type: typeof MessageType.PAGE_CONTEXT_PING; data?: PageContextPingPayload; forwarded?: boolean }
  | { type: typeof MessageType.CREATE_ELEMENT; data: { element: MessageElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.UPDATE_ELEMENT; data: { element: MessageElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.DELETE_ELEMENT; data: { id: string }; forwarded?: boolean }
  | { type: typeof MessageType.PREVIEW_ELEMENT; data: { element: MessageElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.FOCUS_ELEMENT; data: { id: string }; forwarded?: boolean }
  | { type: typeof MessageType.SET_EDITING_ELEMENT; data: { id?: string }; forwarded?: boolean }
  | { type: typeof MessageType.ELEMENT_DRAFT_UPDATED; data: { element: MessageElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.REHYDRATE_ELEMENTS; data: { elements: MessageElementPayload[] }; forwarded?: boolean }
  | { type: typeof MessageType.START_FLOW_RUN; data: FlowRunStartPayload; forwarded?: boolean }
  | { type: typeof MessageType.STOP_FLOW_RUN; data: FlowRunStopPayload; forwarded?: boolean }
  | { type: typeof MessageType.FLOW_RUN_STATUS; data: FlowRunStatusPayload; forwarded?: boolean }
  | { type: typeof MessageType.FLOW_RUN_EXECUTE_STEP; data: FlowRunExecuteStepPayload; forwarded?: boolean }
  | { type: typeof MessageType.FLOW_RUN_STEP_RESULT; data: FlowRunExecuteResultPayload; forwarded?: boolean };
