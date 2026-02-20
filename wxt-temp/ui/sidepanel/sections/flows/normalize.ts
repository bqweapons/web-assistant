import type { FlowRunFlowSnapshot } from '../../../../shared/messages';
import { normalizeFlowSteps } from '../../../../shared/flowStepMigration';
import { deriveSiteKey, type StructuredFlowRecord } from '../../../../shared/siteDataSchema';
import type { StepData as FlowStepData } from '../../components/FlowStepsBuilder';

export type FlowRecord = StructuredFlowRecord & {
  scope: 'page' | 'site' | 'global';
  siteKey: string;
  pageKey: string | null;
  steps: FlowStepData[];
  updatedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
};

export const formatTimestamp = (value: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    const formatted = date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    if (formatted) {
      return formatted;
    }
  } catch {
    // Fallback to a stable formatter below.
  }
  const pad = (segment: number) => String(segment).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const countNestedSteps = (steps: FlowStepData[]): number =>
  steps.reduce((total, step) => {
    const childCount = Array.isArray(step.children) ? countNestedSteps(step.children) : 0;
    const branchCount = Array.isArray(step.branches)
      ? step.branches.reduce((sum, branch) => sum + countNestedSteps(branch.steps ?? []), 0)
      : 0;
    return total + 1 + childCount + branchCount;
  }, 0);

export const getStepCount = (value: FlowStepData[]) => countNestedSteps(value);

export const normalizeFlow = (
  value: unknown,
  fallbackSiteKey: string,
  fallbackName: string,
): FlowRecord | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : '';
  if (!id) {
    return null;
  }
  const resolvedSiteKey =
    deriveSiteKey(typeof value.siteKey === 'string' ? value.siteKey : '') || fallbackSiteKey;
  if (!resolvedSiteKey) {
    return null;
  }
  const normalizedSteps = normalizeFlowSteps(value.steps, {
    flowId: id,
    keepNumber: false,
    sanitizeExisting: true,
  });
  return {
    id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : fallbackName,
    description: typeof value.description === 'string' ? value.description : '',
    scope: value.scope === 'page' || value.scope === 'global' ? value.scope : 'site',
    siteKey: resolvedSiteKey,
    pageKey: typeof value.pageKey === 'string' ? value.pageKey : null,
    steps: Array.isArray(normalizedSteps) ? (normalizedSteps as FlowStepData[]) : [],
    updatedAt: toTimestamp(value.updatedAt),
  };
};

export const toFlowSnapshot = (flow: FlowRecord): FlowRunFlowSnapshot => ({
  id: flow.id,
  name: flow.name,
  description: flow.description,
  scope: flow.scope,
  siteKey: flow.siteKey,
  pageKey: flow.pageKey,
  steps: flow.steps,
  updatedAt: flow.updatedAt,
});
