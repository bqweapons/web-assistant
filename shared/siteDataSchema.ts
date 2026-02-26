import type { FlowStepData } from './flowStepMigration';

type JsonRecord = Record<string, unknown>;

export type StructuredFrameContext = {
  url?: string;
  selectors?: string[];
};

export type StructuredElementRecord = {
  id: string;
  text: string;
  scope: 'page' | 'site' | 'global';
  context: {
    siteKey: string;
    pageKey: string | null;
    frame: StructuredFrameContext | null;
  };
  placement: {
    mode: 'dom' | 'floating' | 'container';
    selector: string;
    position: 'append' | 'prepend' | 'before' | 'after';
    relativeTo: {
      before?: string;
      after?: string;
    };
    containerId?: string;
  };
  style: {
    preset?: string;
    inline: Record<string, string>;
    customCss: string;
  };
  behavior: {
    type: 'button' | 'link' | 'tooltip' | 'area';
    href?: string;
    target?: 'new-tab' | 'same-tab';
    actionSelector?: string;
    actionFlowId?: string;
    actionFlowLocked?: boolean;
    layout?: 'row' | 'column';
    tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
    tooltipPersistent?: boolean;
  };
  createdAt: number;
  updatedAt: number;
};

export type StructuredFlowRecord = {
  id: string;
  name: string;
  description: string;
  scope?: 'page' | 'site' | 'global';
  siteKey?: string;
  pageKey?: string | null;
  steps: FlowStepData[];
  updatedAt: number;
};

export type StructuredHiddenRecord = {
  id: string;
  name: string;
  note?: string;
  scope?: 'page' | 'site' | 'global';
  siteKey?: string;
  pageKey?: string | null;
  selector: string;
  enabled?: boolean;
  updatedAt: number;
};

export type StructuredSiteData = {
  elements: StructuredElementRecord[];
  flows: StructuredFlowRecord[];
  hidden: StructuredHiddenRecord[];
};

export type StructuredStoragePayload = {
  sites: Record<string, StructuredSiteData>;
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

export const deriveSiteKey = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey(trimmed.split(/[?#]/)[0] || trimmed);
    }
    const host = parsed.host || parsed.hostname || '';
    return normalizeSiteKey(host || trimmed);
  } catch {
    return normalizeSiteKey(trimmed);
  }
};

export const buildDefaultSiteUrl = (siteKey: string) => {
  if (!siteKey) {
    return '';
  }
  if (siteKey.startsWith('http://') || siteKey.startsWith('https://') || siteKey.startsWith('file://')) {
    return siteKey;
  }
  if (siteKey.startsWith('/')) {
    return `file://${siteKey}`;
  }
  return `https://${siteKey}`;
};

export const isStructuredElementRecord = (raw: unknown): raw is StructuredElementRecord =>
  isRecord(raw) &&
  isRecord(raw.context) &&
  isRecord(raw.placement) &&
  isRecord(raw.behavior);
