export type StepFieldOption = {
  value: string;
  label: string;
};

export type StepField = {
  id: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox';
  value: string;
  withPicker?: boolean;
  options?: StepFieldOption[];
  showWhen?: { fieldId: string; value?: string; values?: string[] };
  transform?: {
    mode: 'js';
    code: string;
    enabled?: boolean;
    timeoutMs?: number;
  };
};

export type DataSourceMeta = {
  fileName?: string;
  fileType?: 'csv' | 'tsv';
  columns?: string[];
  rowCount?: number;
  error?: string;
  rawText?: string;
};

export type StepData = {
  id: string;
  type: string;
  title: string;
  summary: string;
  fields: StepField[];
  children?: StepData[];
  branches?: Array<{ id: string; label: string; steps: StepData[] }>;
  dataSource?: DataSourceMeta;
};
