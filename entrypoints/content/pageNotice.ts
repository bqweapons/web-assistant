// Small on-page notice (toast) used when a flow is started from an
// injected button, so the user gets feedback even with the side panel
// closed. Rendered in its own shadow root to avoid page style leakage.

type NoticeTone = 'info' | 'success' | 'error';

const HOST_ID = 'ladybird-page-notice';
const DISPLAY_MS: Record<NoticeTone, number> = { info: 3000, success: 3500, error: 8000 };

let hideTimer = 0;

export const pageI18nMessage = (key: string, fallback: string, vars?: Record<string, string>) => {
  let text = fallback;
  try {
    text = chrome?.i18n?.getMessage?.(key as Parameters<typeof chrome.i18n.getMessage>[0]) || fallback;
  } catch {
    // Extension context invalidated (e.g. after an update); keep fallback.
  }
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(value);
    }
  }
  return text;
};

const ensureNoticeBox = () => {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-ladybird-page-notice', 'true');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .box {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483000;
        max-width: min(360px, calc(100vw - 32px));
        padding: 10px 14px;
        border-radius: 10px;
        font: 600 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #ffffff;
        background: #0f172a;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        pointer-events: none;
        word-break: break-word;
      }
      .box[data-visible='true'] { opacity: 1; transform: none; }
      .box[data-tone='success'] { background: #047857; }
      .box[data-tone='error'] { background: #b91c1c; }
      .detail { display: block; margin-top: 2px; font-weight: 400; }
    `;
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    root.append(style, box);
    (document.body || document.documentElement).appendChild(host);
  }
  return host.shadowRoot?.querySelector<HTMLDivElement>('.box') ?? null;
};

export const showPageNotice = (tone: NoticeTone, title: string, detail?: string) => {
  if (window.top !== window) {
    return;
  }
  const box = ensureNoticeBox();
  if (!box) {
    return;
  }
  box.textContent = title;
  if (detail) {
    const detailNode = document.createElement('span');
    detailNode.className = 'detail';
    detailNode.textContent = detail;
    box.appendChild(detailNode);
  }
  box.dataset.tone = tone;
  box.dataset.visible = 'true';
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    box.dataset.visible = 'false';
  }, DISPLAY_MS[tone]);
};
