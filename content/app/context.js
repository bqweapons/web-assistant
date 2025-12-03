// Shared runtime context and mutable state for the content app
import { getPageContext } from './page-url.js';

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
  /** @type {string} */
  siteKey: '',
  /** @type {string} */
  pageKey: '',
};

/**
 * Initialize runtime context for this frame.
 * @param {{ frameContext: any; pageUrl?: string; siteKey?: string; pageKey?: string }} params
 */
export function initRuntime(params) {
  runtime.frameContext = params?.frameContext || null;
  runtime.siteKey = params?.siteKey || params?.pageUrl || '';
  runtime.pageKey = params?.pageKey || params?.pageUrl || runtime.siteKey || '';
  runtime.pageUrl = runtime.siteKey;
}

export function refreshPageContextFromLocation() {
  try {
    const next = getPageContext();
    if (next.siteKey) {
      runtime.siteKey = next.siteKey;
      runtime.pageUrl = next.siteKey;
    }
    if (next.pageKey) {
      runtime.pageKey = next.pageKey;
    }
  } catch (_error) {
    // ignore refresh errors
  }
}

