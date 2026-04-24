import type { FlowRecordingEventPayload } from '../../../../shared/messages';
import type { FlowStepData } from '../../../../shared/flowStepMigration';
import { buildStepSummary } from '../../components/flowSteps/summary';
import { createStepTemplate } from '../../components/flowSteps/templates';
import { getConditionOperators, getWaitModes } from '../../components/flowSteps/shortcutConfig';

const getTemplateOptions = () => ({
  waitModes: getWaitModes(),
  conditionOperators: getConditionOperators(),
});

const updateStepField = (step: FlowStepData, fieldId: string, value: string, conditionOperators = getConditionOperators()) => {
  const nextStep = {
    ...step,
    fields: step.fields.map((field) => (field.id === fieldId ? { ...field, value } : field)),
  };
  return {
    ...nextStep,
    summary: buildStepSummary(nextStep, conditionOperators),
  };
};

const getStepFieldValue = (step: FlowStepData, fieldId: string) =>
  step.fields.find((field) => field.id === fieldId)?.value || '';

// F1 — Stamp the recorder's frameUrl into step.targetFrame so replay
// can resolve the right iframe. Absent frameUrl means the recording
// came from the top frame; leave targetFrame off entirely (rather than
// writing `{ url: '' }`) to keep the storage shape minimal.
const withRecordedTargetFrame = (
  step: FlowStepData,
  frameUrl: string | undefined,
): FlowStepData => (frameUrl ? { ...step, targetFrame: { url: frameUrl } } : step);

const buildRecordedStep = (event: FlowRecordingEventPayload): FlowStepData | null => {
  const options = getTemplateOptions();
  if (event.type === 'click' && event.selector) {
    const base = createStepTemplate('click', options);
    const withSelector = updateStepField(base, 'selector', event.selector, options.conditionOperators);
    return withRecordedTargetFrame(withSelector, event.frameUrl);
  }
  if (event.type === 'input' && event.selector) {
    const base = createStepTemplate('input', options);
    const withSelector = updateStepField(base, 'selector', event.selector, options.conditionOperators);
    const withValue = updateStepField(withSelector, 'value', event.value || '', options.conditionOperators);
    return withRecordedTargetFrame(withValue, event.frameUrl);
  }
  return null;
};

export const appendRecordedEventToSteps = (steps: FlowStepData[], event: FlowRecordingEventPayload): FlowStepData[] => {
  const nextStep = buildRecordedStep(event);
  if (!nextStep) {
    return steps;
  }
  if (nextStep.type === 'input' && steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (
      lastStep?.type === 'input' &&
      getStepFieldValue(lastStep, 'selector') === getStepFieldValue(nextStep, 'selector')
    ) {
      const conditionOperators = getConditionOperators();
      const merged = updateStepField(lastStep, 'value', getStepFieldValue(nextStep, 'value'), conditionOperators);
      return [...steps.slice(0, -1), merged];
    }
  }
  return [...steps, nextStep];
};
