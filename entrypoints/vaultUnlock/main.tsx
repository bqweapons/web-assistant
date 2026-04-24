import { createRoot } from 'react-dom/client';
// 1.4 — The vault unlock window renders a single dialog. It reuses
// the sidepanel's Tailwind base (for consistent tokens / spacing) but
// deliberately does NOT pull in the sidepanel's runtime locale store
// (`ui/sidepanel/utils/i18n.ts`) — that store persists across sessions
// and is scoped to the sidepanel page. Here we read via
// `chrome.i18n.getMessage` so the window localizes to the browser's
// default; the UI surface is small (4 strings) and the follow-up
// option is to sync locale via a dedicated message if needed.
import '../../ui/sidepanel/styles/index.css';
import UnlockDialog from './UnlockDialog';
// Review fix — follow the sidepanel's user-selected locale (shared
// localStorage under this extension origin) rather than
// chrome.i18n.getMessage, which is pinned to the browser UI
// language. Importing the module also primes the message cache;
// the getLocale/t calls below will still return the fallback until
// the cache fetch resolves, so we also re-apply the title on the
// next microtask.
import { t } from '../../ui/sidepanel/utils/i18n';

// Chrome does NOT substitute `__MSG_xxx__` in HTML <title>
// elements, so the tab title previously showed the raw token.
// Set it from JS instead, re-setting once after the locale cache
// finishes loading so the first paint doesn't get stuck on the
// English fallback for non-English users.
const applyTitle = () => {
  const localized = t('vault_unlock_window_title', 'Unlock password vault');
  if (localized) {
    document.title = localized;
  }
};
applyTitle();
setTimeout(applyTitle, 0);
setTimeout(applyTitle, 250);

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<UnlockDialog />);
}
