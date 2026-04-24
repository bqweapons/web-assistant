import type { ReactNode } from 'react';
import SelectMenu from '../SelectMenu';
import SelectorInput from '../SelectorInput';
import type { SelectorPickerAccept } from '../../../../shared/messages';
import type { StepData, StepField } from './types';

// F1 — Flow picker returns the selector plus, when the pick fired
// inside an iframe, the frame's URL. The handler below writes the
// selector into the step field AND (if present) threads `frameUrl`
// into `step.targetFrame` via `onUpdateStepTargetFrame`.
export type FlowPickerResult = {
  selector: string;
  frameUrl?: string;
};

type StepFieldControlProps = {
  step: StepData;
  field: StepField;
  onUpdateField: (stepId: string, fieldId: string, value: string) => void;
  setFieldInputRef: (
    stepId: string,
    fieldId: string,
  ) => (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onFocusField: (stepId: string, fieldId: string) => void;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<FlowPickerResult | null>;
  // F1 — Called after a picker result that carries frame metadata.
  // Pass `undefined` to clear an existing targetFrame (e.g. when a
  // manual selector edit replaces a picked one — caller's choice).
  onUpdateStepTargetFrame?: (stepId: string, frameUrl: string | undefined) => void;
};

export const StepFieldControl = ({
  step,
  field,
  onUpdateField,
  setFieldInputRef,
  onFocusField,
  onStartPicker,
  onUpdateStepTargetFrame,
}: StepFieldControlProps): ReactNode => {
  const stepId = step.id;
  const showPicker = field.withPicker || field.id === 'selector';
  if (field.type === 'select') {
    return (
      <SelectMenu
        value={field.value}
        options={field.options ?? []}
        useInputStyle={false}
        buttonClassName="btn-ghost h-9 w-full min-w-0 justify-between px-2 text-xs"
        onChange={(value) => onUpdateField(stepId, field.id, value)}
      />
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          data-flow-step-id={stepId}
          data-flow-field-id={field.id}
          type="checkbox"
          className="h-4 w-4"
          checked={field.value === 'true'}
          onChange={(event) => onUpdateField(stepId, field.id, event.target.checked ? 'true' : 'false')}
        />
      </label>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        ref={setFieldInputRef(stepId, field.id)}
        data-flow-step-id={stepId}
        data-flow-field-id={field.id}
        className="input min-w-0 h-20"
        value={field.value}
        onChange={(event) => onUpdateField(stepId, field.id, event.target.value)}
        placeholder={field.placeholder}
        onFocus={() => onFocusField(stepId, field.id)}
      />
    );
  }
  if (showPicker) {
    return (
      <SelectorInput
        inputRef={setFieldInputRef(stepId, field.id)}
        dataStepId={stepId}
        dataFieldId={field.id}
        value={field.value}
        placeholder={field.placeholder}
        type={field.type === 'number' ? 'number' : 'text'}
        onChange={(value) => onUpdateField(stepId, field.id, value)}
        onFocus={() => onFocusField(stepId, field.id)}
        onPick={() => {
          onFocusField(stepId, field.id);
          if (!onStartPicker) {
            return;
          }
          const accept: SelectorPickerAccept = step.type === 'input' ? 'input' : 'selector';
          void onStartPicker(accept).then((result) => {
            if (!result) {
              return;
            }
            onUpdateField(stepId, field.id, result.selector);
            // F1 — only update targetFrame when the picker result
            // actually carries a frameUrl (iframe pick). A top-frame
            // pick leaves any pre-existing targetFrame alone — the
            // user may be re-picking a selector in a step that was
            // originally recorded inside an iframe they still want
            // to target. Explicit clearing is not in this batch.
            if (result.frameUrl && onUpdateStepTargetFrame) {
              onUpdateStepTargetFrame(stepId, result.frameUrl);
            }
          });
        }}
      />
    );
  }
  return (
    <input
      ref={setFieldInputRef(stepId, field.id)}
      data-flow-step-id={stepId}
      data-flow-field-id={field.id}
      className="input min-w-0"
      type={field.type === 'number' ? 'number' : 'text'}
      value={field.value}
      onChange={(event) => onUpdateField(stepId, field.id, event.target.value)}
      placeholder={field.placeholder}
      onFocus={() => onFocusField(stepId, field.id)}
    />
  );
};
