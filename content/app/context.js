// Shared runtime context and mutable state for the content app

export const state = {
  pickerSession: /** @type {{ stop: () => void } | null} */ (null),
  editorSession: /** @type {{ close: () => void } | null} */ (null),
  activeEditorElementId: /** @type {string | null} */ (null),
  creationElementId: /** @type {string | null} */ (null),
  editingMode: false,
};

export const dirtyIds = new Set();

export const runtime = {
  /** @type {ReturnType<import('../selector.js').resolveFrameContext> | any} */
  frameContext: null,
  /** @type {string} */
  pageUrl: '',
};

/**
 * Initialize runtime context for this frame.
 * @param {{ frameContext: any; pageUrl: string }} params
 */
export function initRuntime(params) {
  runtime.frameContext = params?.frameContext || null;
  runtime.pageUrl = params?.pageUrl || '';
}

