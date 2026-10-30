import {
  MessageType,
  type FlowRunDataSourceInput,
  type FlowRunFlowSnapshot,
} from '../../../shared/messages';
import { inferDataSourceFileType, requestDataSourceFile } from '../../../shared/filePicker';
import { getSiteData } from '../../../shared/storage';
import { deriveSiteKey } from '../../../shared/siteDataSchema';
import {
  getElementActionFlowId,
  getElementActionSelector,
  normalizeSiteKey,
  toFlowSnapshot,
  type RuntimeElement,
} from './shared';
import { sendRuntimeMessageSafe } from './runtimeBridge';
import { pageI18nMessage, showPageNotice } from '../pageNotice';
import { RUNNER_ERROR_MESSAGES } from '../../../shared/runnerErrorMessages';

type DataSourceStepDescriptor = {
  id: string;
  title: string;
  fileType: 'csv' | 'tsv';
};

const collectDataSourceSteps = (
  steps: FlowRunFlowSnapshot['steps'],
  sink: DataSourceStepDescriptor[] = [],
): DataSourceStepDescriptor[] => {
  for (const step of steps) {
    if (step.type === 'data-source') {
      sink.push({
        id: step.id,
        title: step.title || step.id,
        fileType: step.dataSource?.fileType === 'tsv' ? 'tsv' : 'csv',
      });
    }
    if (Array.isArray(step.children) && step.children.length > 0) {
      collectDataSourceSteps(step.children, sink);
    }
    if (Array.isArray(step.branches) && step.branches.length > 0) {
      for (const branch of step.branches) {
        collectDataSourceSteps(branch.steps ?? [], sink);
      }
    }
  }
  return sink;
};

const collectDataSourceInputsForRun = async (snapshot: FlowRunFlowSnapshot) => {
  const stepDescriptors = collectDataSourceSteps(snapshot.steps);
  if (stepDescriptors.length === 0) {
    return {} as Record<string, FlowRunDataSourceInput>;
  }
  const selectedInputs: Record<string, FlowRunDataSourceInput> = {};
  for (const step of stepDescriptors) {
    const file = await requestDataSourceFile(
      { title: step.title, fileType: step.fileType },
      {
        requireConfirm: true,
        confirmMessage: pageI18nMessage('page_run_data_source_confirm', `Select a CSV/TSV file for step: ${step.title}`, {
          name: step.title,
        }),
      },
    );
    if (!file) {
      throw new Error('data-source-selection-cancelled');
    }
    selectedInputs[step.id] = {
      fileName: file.name,
      fileType: inferDataSourceFileType(file.name, step.fileType),
      rawText: await file.text(),
    };
  }
  return selectedInputs;
};

const startBoundFlowRun = async (element: RuntimeElement) => {
  const flowId = getElementActionFlowId(element).trim();
  if (!flowId) {
    return { ok: false, error: 'action-flow-missing' } as const;
  }
  const fallbackSiteKey = normalizeSiteKey(window.location.host || '');
  const siteKey = normalizeSiteKey(deriveSiteKey(element.context.siteKey || '') || fallbackSiteKey);
  if (!siteKey) {
    return { ok: false, error: 'site-key-missing' } as const;
  }
  const siteData = await getSiteData(siteKey);
  const matchedFlow = siteData.flows.find((flow) => flow?.id === flowId);
  const snapshot = toFlowSnapshot(matchedFlow, siteKey);
  if (!snapshot) {
    return { ok: false, error: `flow-not-found:${flowId}` } as const;
  }
  let dataSourceInputs: Record<string, FlowRunDataSourceInput> = {};
  try {
    dataSourceInputs = await collectDataSourceInputsForRun(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'data-source-selection-cancelled' } as const;
  }
  const response = await sendRuntimeMessageSafe({
    type: MessageType.START_FLOW_RUN,
    data: {
      flow: snapshot,
      source: 'page-button',
      dataSourceInputs,
    },
  });
  return response.ok ? ({ ok: true, flowName: snapshot.name } as const) : response;
};

const triggerSelectorAction = (selector: string) => {
  if (!selector.trim()) {
    return false;
  }
  let target: Element | null = null;
  try {
    target = document.querySelector(selector);
  } catch {
    return false;
  }
  if (!target) {
    return false;
  }
  if (target instanceof HTMLElement) {
    target.click();
    return true;
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};

const describeStartError = (error: string) => {
  if (error.startsWith('flow-not-found')) {
    return pageI18nMessage('page_run_flow_missing', 'The flow linked to this button no longer exists.');
  }
  if (/already running/i.test(error)) {
    return pageI18nMessage('sidepanel_flow_runner_error_busy', 'Another flow is already running.');
  }
  const mapped = RUNNER_ERROR_MESSAGES[error];
  if (mapped) {
    return pageI18nMessage(mapped.messageKey, mapped.fallback);
  }
  return pageI18nMessage('page_run_start_failed', 'Could not start the flow. Open the Ladybird side panel for details.');
};

// Ignore repeat clicks on the same button while its run is being started.
const startingElementIds = new Set<string>();

export const executeBoundButtonAction = async (element: RuntimeElement) => {
  const flowId = getElementActionFlowId(element).trim();
  if (flowId) {
    if (startingElementIds.has(element.id)) {
      return;
    }
    startingElementIds.add(element.id);
    try {
      const response = await startBoundFlowRun(element);
      if (!response.ok) {
        if (response.error === 'data-source-selection-cancelled') {
          return;
        }
        console.warn('Failed to start bound flow run', {
          flowId,
          error: response.error || 'unknown-error',
        });
        showPageNotice('error', describeStartError(response.error || ''));
        return;
      }
      showPageNotice(
        'info',
        pageI18nMessage('page_run_started', `Running flow: ${response.flowName}`, { name: response.flowName }),
      );
    } finally {
      startingElementIds.delete(element.id);
    }
    return;
  }

  const actionSelector = getElementActionSelector(element).trim();
  if (!actionSelector) {
    return;
  }
  if (!triggerSelectorAction(actionSelector)) {
    console.warn('Failed to trigger bound action selector', { selector: actionSelector });
    showPageNotice(
      'error',
      pageI18nMessage('page_run_action_target_missing', 'The element this button should click was not found on this page.'),
    );
  }
};
