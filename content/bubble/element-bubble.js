const VALID_POSITIONS = new Set(['append', 'prepend', 'before', 'after']);

/**
 * Creates the element editor bubble instance.
 * @param {{
 *   t: (key: string, params?: Record<string, any>) => string;
 *   ui: {
 *     createField: (label: string, control?: HTMLElement | null) => { wrapper: HTMLElement; label: HTMLElement };
 *     styleInput: (element: HTMLElement) => void;
 *     createSection: (title: string, description?: string) => { section: HTMLElement; content: HTMLElement };
 *     createTabGroup: () => {
 *       container: HTMLElement;
 *       addSection: (title: string, description?: string) => {
 *         tabButton: HTMLButtonElement;
 *         section: HTMLElement;
 *         content: HTMLElement;
 *         visible: boolean;
 *         setVisible: (visible: boolean) => void;
 *       };
 *       activate: (sectionObj: any) => void;
 *     };
 *   };
 *   preview: {
 *     ensurePreviewElement: (current: HTMLElement | null, type: 'button' | 'link' | 'tooltip') => HTMLElement;
 *     applyPreview: (previewEl: HTMLElement, payload: any, t: (key: string, params?: Record<string, any>) => string) => void;
 *     ensureTooltipPreviewStyle: (root: HTMLElement) => void;
 *   };
 *   actionflow: {
 *     mountBuilder: (container: HTMLElement, deps: any) => { update: (steps: any[], invalidIndex?: number) => void; setDisabled: (disabled: boolean) => void; dispose: () => void };
 *     validateFlowSource: (source: string) => { stepCount: number; error?: string; definition?: any };
 *     stepsToJSON: (steps: any[]) => string;
 *     parseFlowForBuilder: (source: string) => { mode: 'builder' | 'advanced'; steps: any[]; error: string };
 *     startPicker: (options: any) => () => void;
 *   };
 *   stateFactory: (initial?: any) => {
 *     get(): any;
 *     patch(partial: any): void;
 *     subscribe(listener: (state: any) => void): () => void;
 *     snapshot(): any;
 *     restore(snapshot: any): void;
 *   };
 *   layout: {
 *     attach: (node: HTMLElement) => void;
 *     detach: (node: HTMLElement) => void;
 *     positionRelativeTo: (target: Element | null, bubble: HTMLElement, options?: { offset?: number; onRequestClose?: () => void }) => { update(): void; dispose(): void };
 *   };
 *   styles: {
 *     getStyleFieldConfigs: (t: (key: string, params?: Record<string, any>) => string) => Array<{ name: string; label: string; placeholder: string; colorPicker?: boolean }>;
 *     normalizeStyleState: (styleState: Record<string, string>, getConfigs: () => Array<{ name: string }>) => Record<string, string> | undefined;
 *   };
 *   tooltip: {
 *     VALID_TOOLTIP_POSITIONS: Set<string>;
 *     getPositionOptions: (t: (key: string, params?: Record<string, any>) => string) => Array<{ value: string; label: string }>;
 *   };
 *   defaults: {
 *     button: Record<string, string>;
 *     link: Record<string, string>;
 *     tooltip: Record<string, string>;
 *   };
 *   flows: {
 *     MAX_FLOW_SOURCE_LENGTH: number;
 *   };
 * }} deps
 * @returns {{ open(config: any): void; close(): void; destroy(): void }}
 */
export function createElementBubble(deps) {
  const {
    t,
    ui,
    preview,
    actionflow,
    stateFactory,
    layout,
    styles,
    tooltip,
    defaults,
    flows,
  } = deps;

  if (!t || !ui || !preview || !actionflow || !stateFactory || !layout || !styles || !tooltip || !defaults || !flows) {
    throw new Error('Missing dependencies for createElementBubble');
  }

  const state = stateFactory();
  let currentState = state.get();

  const bubble = document.createElement('div');
  bubble.dataset.pageAugmentorRoot = 'picker-element-bubble';
  Object.assign(bubble.style, {
    position: 'fixed',
    zIndex: '2147483647',
    maxWidth: '340px',
    minWidth: '260px',
    maxHeight: '85vh',
    padding: '18px',
    borderRadius: '16px',
    backgroundColor: '#ffffff',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
    color: '#0f172a',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity 0.16s ease, transform 0.16s ease',
    pointerEvents: 'auto',
    backdropFilter: 'blur(16px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  });

  bubble.addEventListener('click', (event) => event.stopPropagation());
  bubble.addEventListener('mousedown', (event) => event.stopPropagation());

  const title = document.createElement('h3');
  title.textContent = t('editor.title');
  Object.assign(title.style, {
    margin: '0 0 10px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
  });

  const selectorWrapper = document.createElement('div');
  Object.assign(selectorWrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    margin: '0',
  });

  const selectorTitle = document.createElement('span');
  selectorTitle.textContent = t('editor.selectorLabel');
  Object.assign(selectorTitle.style, {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: '0.03em',
  });

  const selectorValue = document.createElement('code');
  Object.assign(selectorValue.style, {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 8px',
    borderRadius: '8px',
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    fontSize: '12px',
    color: '#0f172a',
    lineHeight: '1.4',
    wordBreak: 'break-all',
  });

  selectorWrapper.append(selectorTitle, selectorValue);

  const previewWrapper = document.createElement('div');
  Object.assign(previewWrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
    margin: '0',
  });

  const previewLabel = document.createElement('span');
  previewLabel.textContent = t('editor.previewLabel');
  Object.assign(previewLabel.style, {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  });

  preview.ensureTooltipPreviewStyle(previewWrapper);

  let previewElement = document.createElement('button');
  previewElement.tabIndex = -1;
  previewElement.style.cursor = 'default';
  previewElement.addEventListener('click', (event) => event.preventDefault());
  previewWrapper.append(previewLabel, previewElement);

  const form = document.createElement('form');
  Object.assign(form.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: '1 1 auto',
    minHeight: '0',
  });

  const formBody = document.createElement('div');
  Object.assign(formBody.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: '1 1 auto',
    minHeight: '0',
    overflowY: 'auto',
    paddingTop: '6px',
  });

  bubble.append(title, selectorWrapper, previewWrapper, form);

  return {
    open(config) {
      console.warn('Not implemented', config);
    },
    close() {},
    destroy() {},
  };
}
