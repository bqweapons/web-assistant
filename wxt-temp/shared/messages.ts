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
};

export type PickerResultPayload = {
  selector?: string;
  beforeSelector?: string;
  afterSelector?: string;
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

export type ElementPayload = {
  id: string;
  type: 'button' | 'link' | 'tooltip' | 'area';
  text?: string;
  selector?: string;
  position?: 'append' | 'prepend' | 'before' | 'after';
  beforeSelector?: string;
  afterSelector?: string;
  containerId?: string;
  floating?: boolean;
  layout?: 'row' | 'column';
  href?: string;
  linkTarget?: 'new-tab' | 'same-tab';
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  tooltipPersistent?: boolean;
  style?: ElementStylePayload;
  scope?: 'page' | 'site' | 'global';
  siteUrl?: string;
  pageUrl?: string;
  frameUrl?: string;
  frameSelectors?: string[];
  createdAt?: number;
  updatedAt?: number;
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
  | { type: typeof MessageType.CREATE_ELEMENT; data: { element: ElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.UPDATE_ELEMENT; data: { element: ElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.DELETE_ELEMENT; data: { id: string }; forwarded?: boolean }
  | { type: typeof MessageType.PREVIEW_ELEMENT; data: { element: ElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.FOCUS_ELEMENT; data: { id: string }; forwarded?: boolean }
  | { type: typeof MessageType.SET_EDITING_ELEMENT; data: { id?: string }; forwarded?: boolean }
  | { type: typeof MessageType.ELEMENT_DRAFT_UPDATED; data: { element: ElementPayload }; forwarded?: boolean }
  | { type: typeof MessageType.REHYDRATE_ELEMENTS; data: { elements: ElementPayload[] }; forwarded?: boolean };
