export type StepLibraryItem = {
  type: string;
  label: string;
  description: string;
};

export const STEP_LIBRARY: StepLibraryItem[] = [
  { type: 'click', label: 'Click', description: 'Click an element by selector.' },
  { type: 'input', label: 'Input', description: 'Type text into a field.' },
  { type: 'loop', label: 'Loop', description: 'Repeat nested steps for a count.' },
  { type: 'data-source', label: 'Data Source', description: 'Load CSV/TSV and loop rows.' },
  { type: 'if-else', label: 'If / Else', description: 'Branch steps based on a condition.' },
  { type: 'wait', label: 'Wait', description: 'Pause or wait for element condition.' },
  { type: 'navigate', label: 'Navigate', description: 'Go to a URL.' },
  { type: 'assert', label: 'Assert', description: 'Check a value or state.' },
];
