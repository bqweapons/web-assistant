import type { FlowStepData } from '../../../../shared/flowStepMigration';

const PASSWORD_SELECTOR_PATTERNS = [
  /password/i,
  /passwd/i,
  /\bpwd\b/i,
  /type\s*=\s*["']?password["']?/i,
];

export const isPasswordLikeSelector = (selector: string) => {
  const value = (selector || '').trim();
  if (!value) {
    return false;
  }
  return PASSWORD_SELECTOR_PATTERNS.some((pattern) => pattern.test(value));
};

export const getStepFieldStringValue = (step: FlowStepData, fieldId: string) =>
  step.fields.find((field) => field.id === fieldId)?.value ?? '';

