import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  MessageType,
  type FlowRunStartSource,
  type FlowRunStatusPayload,
  type RuntimeMessage,
} from '../../../../shared/messages';
import { sendRuntimeMessage } from '../../utils/runtimeMessaging';
import { t } from '../../utils/i18n';
import { toFlowSnapshot, type FlowRecord } from './normalize';

export const getRunnerStateLabel = (state?: FlowRunStatusPayload['state']) => {
  if (state === 'running') {
    return t('sidepanel_flow_runner_state_running', 'Running');
  }
  if (state === 'queued') {
    return t('sidepanel_flow_runner_state_queued', 'Queued');
  }
  if (state === 'succeeded') {
    return t('sidepanel_flow_runner_state_succeeded', 'Succeeded');
  }
  if (state === 'failed') {
    return t('sidepanel_flow_runner_state_failed', 'Failed');
  }
  if (state === 'cancelled') {
    return t('sidepanel_flow_runner_state_cancelled', 'Cancelled');
  }
  return t('sidepanel_label_unknown', 'Unknown');
};

export const formatRunnerError = (code?: string, message?: string) => {
  if (!code && !message) {
    return '';
  }
  if (code === 'site-mismatch' || code === 'cross-site-navigation') {
    return t('sidepanel_flow_runner_error_site_mismatch', 'Flow can only run on the same site.');
  }
  if (code === 'runner-busy') {
    return t('sidepanel_flow_runner_error_busy', 'Another flow is already running.');
  }
  if (code === 'unsupported-step-type') {
    return t('sidepanel_flow_runner_error_unsupported_step', 'Flow has an unsupported step type.');
  }
  return message || code || t('sidepanel_flow_runner_error_unknown', 'Flow run failed.');
};

type UseFlowRunnerResult = {
  runStatus: FlowRunStatusPayload | null;
  runRequestError: string;
  runErrorMessage: string;
  runLogCopyFeedback: string;
  runLogScrollRef: MutableRefObject<HTMLDivElement | null>;
  runLogs: NonNullable<FlowRunStatusPayload['logs']>;
  isRunActive: boolean;
  currentRunFlow: FlowRecord | null;
  startFlowRun: (flow: FlowRecord, source: FlowRunStartSource) => Promise<void>;
  stopFlowRun: () => Promise<void>;
  copyRunLogs: () => Promise<void>;
  clearRunRequestError: () => void;
  formatLogTime: (timestamp: number) => string;
};

export const useFlowRunner = (flows: FlowRecord[]): UseFlowRunnerResult => {
  const [runStatus, setRunStatus] = useState<FlowRunStatusPayload | null>(null);
  const [runRequestError, setRunRequestError] = useState('');
  const [runLogCopyFeedback, setRunLogCopyFeedback] = useState('');
  const runLogScrollRef = useRef<HTMLDivElement | null>(null);

  const runLogs = runStatus?.logs ?? [];
  const lastRunLogId = runLogs.length ? runLogs[runLogs.length - 1]?.id : '';

  const isRunActive = runStatus?.state === 'queued' || runStatus?.state === 'running';

  const runErrorMessage = useMemo(() => {
    if (runRequestError) {
      return runRequestError;
    }
    if (!runStatus?.error) {
      return '';
    }
    return formatRunnerError(runStatus.error.code, runStatus.error.message);
  }, [runRequestError, runStatus?.error]);

  const currentRunFlow = useMemo(
    () => (runStatus?.flowId ? flows.find((flow) => flow.id === runStatus.flowId) ?? null : null),
    [flows, runStatus?.flowId],
  );

  useEffect(() => {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    const handleRuntimeMessage = (rawMessage: RuntimeMessage) => {
      if (!rawMessage?.forwarded || rawMessage.type !== MessageType.FLOW_RUN_STATUS) {
        return;
      }
      setRunStatus(rawMessage.data);
      if (rawMessage.data.state !== 'failed') {
        setRunRequestError('');
      }
    };
    runtime.onMessage.addListener(handleRuntimeMessage);
    return () => runtime.onMessage.removeListener(handleRuntimeMessage);
  }, []);

  const startFlowRun = useCallback(async (flow: FlowRecord, source: FlowRunStartSource) => {
    setRunRequestError('');
    const startedAt = Date.now();
    try {
      const response = await sendRuntimeMessage({
        type: MessageType.START_FLOW_RUN,
        data: {
          flow: toFlowSnapshot(flow),
          source,
        },
      });
      const runId =
        response && typeof response === 'object' && 'runId' in response && typeof response.runId === 'string'
          ? response.runId
          : `run-${startedAt}`;
      setRunStatus((prev) => ({
        runId,
        flowId: flow.id,
        siteKey: flow.siteKey,
        tabId: prev?.tabId ?? 0,
        state: 'queued',
        progress: { completedSteps: 0, totalSteps: Math.max(1, flow.steps.length) },
        startedAt,
        activeUrl: prev?.activeUrl || '',
        currentStepId: prev?.currentStepId,
        endedAt: undefined,
        error: undefined,
        logs: [],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunRequestError(formatRunnerError(message, message));
    }
  }, []);

  const formatLogTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '--:--:--';
    }
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, []);

  const copyRunLogs = useCallback(async () => {
    if (!runLogs.length) {
      setRunLogCopyFeedback(t('sidepanel_flow_runner_logs_empty', 'No logs to copy.'));
      return;
    }
    const output = runLogs
      .map((entry) => `[${formatLogTime(entry.timestamp)}] ${entry.level.toUpperCase()} ${entry.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(output);
      setRunLogCopyFeedback(t('sidepanel_flow_runner_logs_copied', 'Logs copied.'));
    } catch {
      setRunLogCopyFeedback(t('sidepanel_flow_runner_logs_copy_failed', 'Failed to copy logs.'));
    }
  }, [formatLogTime, runLogs]);

  useEffect(() => {
    if (!lastRunLogId) {
      return;
    }
    const container = runLogScrollRef.current;
    if (!container) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [lastRunLogId]);

  const stopFlowRun = useCallback(async () => {
    if (!runStatus?.runId) {
      return;
    }
    setRunRequestError('');
    try {
      await sendRuntimeMessage({
        type: MessageType.STOP_FLOW_RUN,
        data: { runId: runStatus.runId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunRequestError(formatRunnerError(message, message));
    }
  }, [runStatus?.runId]);

  return {
    runStatus,
    runRequestError,
    runErrorMessage,
    runLogCopyFeedback,
    runLogScrollRef,
    runLogs,
    isRunActive,
    currentRunFlow,
    startFlowRun,
    stopFlowRun,
    copyRunLogs,
    clearRunRequestError: () => setRunRequestError(''),
    formatLogTime,
  };
};
