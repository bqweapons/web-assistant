import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageType,
  type FlowRecordingEventPayload,
  type FlowRecordingStatusPayload,
  type RuntimeMessage,
} from '../../../../shared/messages';
import { sendRuntimeMessage } from '../../../../shared/runtimeMessaging';
import { t } from '../../utils/i18n';

type UseFlowRecordingOptions = {
  pageUrl?: string;
  tabId?: number;
  onRecordingEvent?: (event: FlowRecordingEventPayload) => void;
};

type StopOptions = {
  silent?: boolean;
};

const createSessionId = () =>
  `record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useFlowRecording = ({ pageUrl, tabId, onRecordingEvent }: UseFlowRecordingOptions) => {
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordingFeedback, setRecordingFeedback] = useState('');
  const onRecordingEventRef = useRef(onRecordingEvent);
  const sessionIdRef = useRef<string | null>(null);
  const tabIdRef = useRef<number | undefined>(tabId);
  const pageUrlAtStartRef = useRef('');

  useEffect(() => {
    onRecordingEventRef.current = onRecordingEvent;
  }, [onRecordingEvent]);

  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  const clearSessionState = useCallback((feedback = '') => {
    sessionIdRef.current = null;
    pageUrlAtStartRef.current = '';
    setRecordingSessionId(null);
    setRecordingFeedback(feedback);
  }, []);

  const stopRecording = useCallback(
    async (options?: StopOptions) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }
      clearSessionState(
        options?.silent ? '' : t('sidepanel_flow_recording_feedback_stopped', 'Recording stopped.'),
      );
      try {
        await sendRuntimeMessage({
          type: MessageType.STOP_FLOW_RECORDING,
          data: { sessionId },
          targetTabId: tabIdRef.current,
        });
      } catch {
        // Local state is already cleared; ignore best-effort stop failures.
      }
    },
    [clearSessionState],
  );

  const startRecording = useCallback(async () => {
    if (sessionIdRef.current) {
      return false;
    }
    const sessionId = createSessionId();
    try {
      await sendRuntimeMessage({
        type: MessageType.START_FLOW_RECORDING,
        data: {
          sessionId,
          resumeAfterNavigation: false,
        },
        targetTabId: tabIdRef.current,
      });
    } catch {
      setRecordingFeedback(
        t('sidepanel_flow_recording_feedback_error_start', 'Unable to start recording on the page.'),
      );
      return false;
    }
    sessionIdRef.current = sessionId;
    pageUrlAtStartRef.current = pageUrl || '';
    setRecordingSessionId(sessionId);
    setRecordingFeedback(t('sidepanel_flow_recording_feedback_started', 'Recording started.'));
    return true;
  }, [pageUrl]);

  useEffect(() => {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    const handleMessage = (rawMessage: RuntimeMessage) => {
      if (!rawMessage?.forwarded) {
        return;
      }
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) {
        return;
      }
      if (rawMessage.type === MessageType.FLOW_RECORDING_EVENT) {
        if (rawMessage.data.sessionId !== activeSessionId) {
          return;
        }
        onRecordingEventRef.current?.(rawMessage.data);
        if (rawMessage.data.type === 'password-skipped') {
          setRecordingFeedback(
            t(
              'sidepanel_flow_recording_feedback_password_skipped',
              'Password input was skipped. Add it manually with a Password Vault binding.',
            ),
          );
        } else if (rawMessage.data.type === 'navigation-noted') {
          setRecordingFeedback(
            t(
              'sidepanel_flow_recording_feedback_navigation_not_recorded',
              'Navigation was detected. No Navigate step was added.',
            ),
          );
        }
        return;
      }
      if (rawMessage.type === MessageType.FLOW_RECORDING_STATUS) {
        const data = rawMessage.data as FlowRecordingStatusPayload;
        if (data.sessionId !== activeSessionId) {
          return;
        }
        if (data.reason === 'navigation') {
          clearSessionState(
            t(
              'sidepanel_flow_recording_feedback_interrupted',
              'Navigation interrupted recording. No Navigate step was added.',
            ),
          );
          return;
        }
        if (data.state === 'stopped') {
          clearSessionState(t('sidepanel_flow_recording_feedback_stopped', 'Recording stopped.'));
          return;
        }
        if (data.state === 'error') {
          clearSessionState(
            t('sidepanel_flow_recording_feedback_interrupted', 'Navigation interrupted recording. No Navigate step was added.'),
          );
        }
      }
    };
    runtime.onMessage.addListener(handleMessage);
    return () => runtime.onMessage.removeListener(handleMessage);
  }, [clearSessionState]);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      return;
    }
    const startedUrl = pageUrlAtStartRef.current;
    if (!startedUrl || !pageUrl || pageUrl === startedUrl) {
      return;
    }
    clearSessionState(
      t(
        'sidepanel_flow_recording_feedback_interrupted',
        'Navigation interrupted recording. No Navigate step was added.',
      ),
    );
  }, [clearSessionState, pageUrl]);

  useEffect(() => {
    return () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }
      sessionIdRef.current = null;
      void sendRuntimeMessage({
        type: MessageType.STOP_FLOW_RECORDING,
        data: { sessionId },
        targetTabId: tabIdRef.current,
      }).catch(() => undefined);
    };
  }, []);

  return {
    isRecording: Boolean(recordingSessionId),
    recordingSessionId,
    recordingFeedback,
    setRecordingFeedback,
    startRecording,
    stopRecording,
  };
};
