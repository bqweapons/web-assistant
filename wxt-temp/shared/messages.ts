export const MessageType = {
  START_PICKER: 'START_PICKER',
  CANCEL_PICKER: 'CANCEL_PICKER',
  PICKER_RESULT: 'PICKER_RESULT',
  PICKER_CANCELLED: 'PICKER_CANCELLED',
  PICKER_INVALID: 'PICKER_INVALID',
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

export type RuntimeMessage =
  | { type: typeof MessageType.START_PICKER; data?: PickerStartPayload; forwarded?: boolean }
  | { type: typeof MessageType.CANCEL_PICKER; data?: undefined; forwarded?: boolean }
  | { type: typeof MessageType.PICKER_RESULT; data: PickerResultPayload; forwarded?: boolean }
  | { type: typeof MessageType.PICKER_CANCELLED; data?: PickerCancelledPayload; forwarded?: boolean }
  | { type: typeof MessageType.PICKER_INVALID; data?: PickerInvalidPayload; forwarded?: boolean };
