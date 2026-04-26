// 1.14 — Sidepanel / non-SW write client for site data. Forwards writes
// to the SW via runtime messages; the SW holds the sole `writeQueue` and
// performs the actual `chrome.storage.local.set`. API shape matches the
// pre-1.14 `setSiteData` / `setAllSitesData` exports of `shared/storage.ts`
// so the sidepanel callers change nothing but the import source.
//
// Must NOT import from `entrypoints/background/siteStorage.ts` — that
// module is SW-only. Sidepanel bundles that pulled it in would duplicate
// the writer realm.

import { MessageType } from './messages';
import { sendRuntimeMessage } from './runtimeMessaging';
import type { StructuredSiteData } from './siteDataSchema';

export const setSiteData = async (
  siteKey: string,
  data: Partial<StructuredSiteData>,
): Promise<void> => {
  await sendRuntimeMessage({
    type: MessageType.SITES_SET_SITE,
    data: { siteKey, data },
  });
};

export const setAllSitesData = async (
  sites: Record<string, StructuredSiteData>,
): Promise<void> => {
  await sendRuntimeMessage({
    type: MessageType.SITES_SET_ALL,
    data: { sites },
  });
};
