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
      { requireConfirm: true, confirmMessage: `Select CSV/TSV for step: ${step.title}` },
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
  return sendRuntimeMessageSafe({
    type: MessageType.START_FLOW_RUN,
    data: {
      flow: snapshot,
      source: 'flows-list',
      dataSourceInputs,
    },
  });
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

export const executeBoundButtonAction = async (element: RuntimeElement) => {
  const flowId = getElementActionFlowId(element).trim();
  if (flowId) {
    const response = await startBoundFlowRun(element);
    if (!response.ok) {
      if (response.error === 'data-source-selection-cancelled') {
        return;
      }
      console.warn('Failed to start bound flow run', {
        flowId,
        error: response.error || 'unknown-error',
      });
    }
    return;
  }

  const actionSelector = getElementActionSelector(element).trim();
  if (!actionSelector) {
    return;
  }
  if (!triggerSelectorAction(actionSelector)) {
    console.warn('Failed to trigger bound action selector', { selector: actionSelector });
  }
};
