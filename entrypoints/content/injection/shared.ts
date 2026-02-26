import type { FlowRunFlowSnapshot } from '../../../shared/messages';
import { normalizeFlowSteps } from '../../../shared/flowStepMigration';
import { deriveSiteKey, isStructuredElementRecord, type StructuredElementRecord } from '../../../shared/siteDataSchema';
import { normalizeSiteKey as normalizeSharedSiteKey } from '../../../shared/urlKeys';

export type RuntimeElement = StructuredElementRecord;

export const normalizeSiteKey = normalizeSharedSiteKey;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const toStructuredElementPayload = (value: unknown): StructuredElementRecord | null => {
  return isStructuredElementRecord(value) ? value : null;
};

export const toRuntimeElementPayload = (value: StructuredElementRecord): RuntimeElement => value;

export const getElementType = (element: RuntimeElement): RuntimeElement['behavior']['type'] => element.behavior.type;
export const getElementSelector = (element: RuntimeElement) => element.placement.selector || '';
export const getElementPosition = (element: RuntimeElement) => element.placement.position || 'append';
export const getElementBeforeSelector = (element: RuntimeElement) => element.placement.relativeTo.before;
export const getElementAfterSelector = (element: RuntimeElement) => element.placement.relativeTo.after;
export const getElementContainerId = (element: RuntimeElement) => element.placement.containerId;
export const getElementMode = (element: RuntimeElement) =>
  element.placement.mode === 'floating' || element.placement.mode === 'container'
    ? element.placement.mode
    : 'dom';
export const isElementFloating = (element: RuntimeElement) => getElementMode(element) === 'floating';
export const getElementLayout = (element: RuntimeElement) => element.behavior.layout;
export const getElementHref = (element: RuntimeElement) => element.behavior.href;
export const getElementLinkTarget = (element: RuntimeElement) => element.behavior.target;
export const getElementActionSelector = (element: RuntimeElement) => element.behavior.actionSelector || '';
export const getElementActionFlowId = (element: RuntimeElement) => element.behavior.actionFlowId || '';
export const getElementTooltipPosition = (element: RuntimeElement) => element.behavior.tooltipPosition;

const toFlowTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
};

export const toFlowSnapshot = (value: unknown, fallbackSiteKey: string): FlowRunFlowSnapshot | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) {
    return null;
  }
  const flowSiteKey = normalizeSiteKey(
    deriveSiteKey(typeof value.siteKey === 'string' ? value.siteKey : '') || fallbackSiteKey,
  );
  if (!flowSiteKey) {
    return null;
  }
  const normalizedSteps = normalizeFlowSteps(value.steps, {
    flowId: value.id,
    keepNumber: false,
    sanitizeExisting: true,
  });
  if (!Array.isArray(normalizedSteps)) {
    return null;
  }
  const scope =
    value.scope === 'page' || value.scope === 'site' || value.scope === 'global'
      ? value.scope
      : 'site';
  return {
    id: value.id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : 'Untitled flow',
    description: typeof value.description === 'string' ? value.description : '',
    scope,
    siteKey: flowSiteKey,
    pageKey: typeof value.pageKey === 'string' ? value.pageKey : null,
    steps: normalizedSteps,
    updatedAt: toFlowTimestamp(value.updatedAt),
  };
};
