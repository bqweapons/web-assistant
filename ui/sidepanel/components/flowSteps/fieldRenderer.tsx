import type { ReactNode } from 'react';
import SelectMenu from '../SelectMenu';
import SelectorInput from '../SelectorInput';
import type { SelectorPickerAccept } from '../../../../shared/messages';
import type { StepData, StepField } from './types';

type StepFieldControlProps = {
  step: StepData;
  field: StepField;
  onUpdateField: (stepId: string, fieldId: string, value: string) => void;
  setFieldInputRef: (
    stepId: string,
    fieldId: string,
  ) => (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onFocusField: (stepId: string, fieldId: string) => void;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
};

export const StepFieldControl = ({
  step,
  field,
  onUpdateField,
  setFieldInputRef,
  onFocusField,
  onStartPicker,
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
          void onStartPicker(accept).then((selector) => {
            if (selector) {
              onUpdateField(stepId, field.id, selector);
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
