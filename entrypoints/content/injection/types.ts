import type { StructuredElementRecord } from '../../../shared/siteDataSchema';

export type RegistryEntry = {
  element: StructuredElementRecord;
  node: HTMLElement;
  root?: ShadowRoot;
  content?: HTMLElement;
  cleanup?: () => void;
};

export type RuntimeMessenger = { sendMessage?: (message: unknown) => void };

export type DropIndicator = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type DomDropPlacement = {
  reference: HTMLElement;
  selector: string;
  position: 'before' | 'after' | 'append';
  beforeSelector?: string;
  afterSelector?: string;
  indicator: DropIndicator;
};

export type ElementMutationPatch = {
  selector?: string;
  position?: StructuredElementRecord['placement']['position'];
  beforeSelector?: string;
  afterSelector?: string;
  containerId?: string;
  mode?: StructuredElementRecord['placement']['mode'];
};

export const HOST_ATTR = 'data-ladybird-element';
export const EDITING_ATTR = 'data-ladybird-editing';
export const HIGHLIGHT_COLOR = 'rgba(27, 132, 255, 0.55)';
export const FLOATING_Z_INDEX = '2147482000';
export const DRAG_Z_INDEX = '2147483200';
export const MIN_SIZE = 24;
