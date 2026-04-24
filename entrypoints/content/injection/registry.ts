import type { StructuredElementRecord } from '../../../shared/siteDataSchema';
import type { RegistryEntry } from './types';
import { toRuntimeElementPayload, type RuntimeElement } from './shared';

export const registry = new Map<string, RegistryEntry>();

export const pendingReattachIds = new Set<string>();
export const pendingPlacementById = new Map<string, StructuredElementRecord>();

const renderOrderById = new Map<string, number>();
let renderOrderCounter = 0;

let editingElementId: string | null = null;
let highlightedAreaId: string | null = null;

export const getEditingElementId = () => editingElementId;
export const setEditingElementId = (value: string | null) => {
  editingElementId = value;
};

export const getHighlightedAreaId = () => highlightedAreaId;
export const setHighlightedAreaId = (value: string | null) => {
  highlightedAreaId = value;
};

export const getEntryRuntime = (entry: RegistryEntry): RuntimeElement => toRuntimeElementPayload(entry.element);

export const setRenderOrderFromElements = (elements: StructuredElementRecord[]) => {
  renderOrderById.clear();
  elements.forEach((element, index) => {
    renderOrderById.set(element.id, index);
  });
  renderOrderCounter = elements.length;
};

export const ensureRenderOrder = (id: string) => {
  const existing = renderOrderById.get(id);
  if (typeof existing === 'number') {
    return existing;
  }
  const next = renderOrderCounter;
  renderOrderCounter += 1;
  renderOrderById.set(id, next);
  return next;
};

export const deleteRenderOrder = (id: string) => {
  renderOrderById.delete(id);
};

export const clearRenderOrder = () => {
  renderOrderById.clear();
  renderOrderCounter = 0;
};
