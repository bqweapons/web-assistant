import type { FlowStepData, FlowStepField } from '../../../shared/flowStepMigration';

export type FlowRowContext = Record<string, string>;

export type FlowLoopContext = {
  index: number;
};

export type FlowRenderContext = {
  row?: FlowRowContext;
  loop?: FlowLoopContext;
  variables: Record<string, string>;
};

const ROW_TOKEN_PATTERN = /{{\s*row(?:\.([A-Za-z0-9_$]+)|\[\s*["']([^"']+)["']\s*\])\s*}}/g;
const VARIABLE_TOKEN_PATTERN = /{{\s*var\.([A-Za-z_][0-9A-Za-z_]*)\s*}}/g;
const LOOP_INDEX_TOKEN_PATTERN = /{{\s*loop\.index\s*}}/g;
const NOW_TOKEN_PATTERN = /{{\s*now\.(date|time|datetime|timestamp)\s*}}/g;

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

const formatNowToken = (tokenType: string, now: Date) => {
  const year = now.getFullYear();
  const month = toTwoDigits(now.getMonth() + 1);
  const day = toTwoDigits(now.getDate());
  const hours = toTwoDigits(now.getHours());
  const minutes = toTwoDigits(now.getMinutes());
  const seconds = toTwoDigits(now.getSeconds());
  if (tokenType === 'date') {
    return `${year}-${month}-${day}`;
  }
  if (tokenType === 'time') {
    return `${hours}:${minutes}:${seconds}`;
  }
  if (tokenType === 'datetime') {
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  if (tokenType === 'timestamp') {
    return String(now.getTime());
  }
  return '';
};

export const getStepFieldRawValue = (step: FlowStepData, fieldId: string) =>
  step.fields.find((field) => field.id === fieldId)?.value ?? '';

export const getStepField = (step: FlowStepData, fieldId: string): FlowStepField | undefined =>
  step.fields.find((field) => field.id === fieldId);

export const renderWithContext = (input: string, context: FlowRenderContext) => {
  if (!input) {
    return input;
  }
  const now = new Date();
  const withNow = input.replace(NOW_TOKEN_PATTERN, (_full, tokenType: string) =>
    formatNowToken(tokenType, now),
  );
  const withVariables = withNow.replace(VARIABLE_TOKEN_PATTERN, (_full, variableName: string) =>
    variableName in context.variables ? context.variables[variableName] : '',
  );
  const withLoop = withVariables.replace(LOOP_INDEX_TOKEN_PATTERN, () =>
    typeof context.loop?.index === 'number' ? String(context.loop.index) : '',
  );
  const row = context.row;
  return withLoop.replace(
    ROW_TOKEN_PATTERN,
    (_full, dotKey: string | undefined, bracketKey: string | undefined) => {
      const key = dotKey || bracketKey || '';
      if (!row) {
        return '';
      }
      return key in row ? row[key] : '';
    },
  );
};

export const getRenderedStepFieldValue = (step: FlowStepData, fieldId: string, context: FlowRenderContext) =>
  renderWithContext(getStepFieldRawValue(step, fieldId), context);

export const toNonNegativeInteger = (input: string, fallback = 0) => {
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const truncateForLog = (value: string, maxLength = 120) =>
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}...` : value;

export const microYield = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
