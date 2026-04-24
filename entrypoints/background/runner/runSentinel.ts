// 1.13 — Flow-run sentinel persistence. Written at run start, refreshed on
// step transitions, deleted at finalize. Lives in `chrome.storage.session`
// (cleared on browser restart; survives SW suspend), so a revived SW can
// detect runs that were mid-flight when the previous SW instance was
// suspended and broadcast a `sw-suspended-during-run` failure to the
// sidepanel instead of leaving it stuck on "running".
//
// Orphan vs our own: every sentinel carries the `swInstanceId` of the SW
// that wrote it. A sentinel whose id != current SW's id is an orphan.
// New run-starts `await` the orphan-cleanup promise before writing their
// own sentinel, so there's no race where cleanup would sweep a fresh
// sentinel; the instance-id check is belt-and-braces for pathological
// interleavings (e.g. cold-start called twice within one SW lifetime).
//
// Writes are fire-and-forget: `chrome.storage.session.set/remove` returns
// a Promise we don't await. The write IPC is scheduled immediately; under
// typical SW suspension timing (~30s idle), the IPC completes well before
// suspension. The tiny race of "SW suspends microseconds after finalize
// fires remove()" is covered by writing the terminal state to the
// sentinel IMMEDIATELY before the remove, so even if the remove doesn't
// land, next cold-start's orphan-cleanup sees state != queued/running
// and cleans silently without broadcasting a ghost failed status.

export const SENTINEL_PREFIX = 'ladybird_run_sentinel_';
export const SW_SUSPENDED_ERROR_CODE = 'sw-suspended-during-run';

// 1.4 — `paused` mirrors FlowRunState's new value. 1.13 orphan-cleanup
// treats it as an unfinished interruptible state alongside queued /
// running: a SW cold-start with a stale `paused` sentinel broadcasts
// `failed` with `sw-suspended-during-run`, same fail-close policy.
export type RunSentinelState =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type RunSentinel = {
  runId: string;
  flowId: string;
  tabId: number;
  siteKey: string;
  startedAt: number;
  totalSteps: number;
  completedSteps: number;
  currentStepId?: string;
  state: RunSentinelState;
  activeUrl: string;
  swInstanceId: string;
};

const keyFor = (runId: string) => `${SENTINEL_PREFIX}${runId}`;

type SessionStorage = {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
};

const getSessionStorage = (): SessionStorage | null => {
  if (typeof chrome === 'undefined') {
    return null;
  }
  const session = chrome.storage?.session as SessionStorage | undefined;
  return session ?? null;
};

export const writeRunSentinel = (sentinel: RunSentinel): void => {
  const session = getSessionStorage();
  if (!session) {
    return;
  }
  void session.set({ [keyFor(sentinel.runId)]: sentinel }).catch((error) => {
    console.warn('run-sentinel-write-failed', error);
  });
};

export const removeRunSentinel = (runId: string): void => {
  const session = getSessionStorage();
  if (!session) {
    return;
  }
  void session.remove(keyFor(runId)).catch((error) => {
    console.warn('run-sentinel-remove-failed', error);
  });
};

const isValidState = (value: unknown): value is RunSentinelState =>
  value === 'queued' ||
  value === 'running' ||
  value === 'paused' ||
  value === 'succeeded' ||
  value === 'failed' ||
  value === 'cancelled';

const isRunSentinel = (value: unknown): value is RunSentinel => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.runId === 'string' &&
    typeof v.flowId === 'string' &&
    typeof v.tabId === 'number' &&
    typeof v.siteKey === 'string' &&
    typeof v.startedAt === 'number' &&
    typeof v.totalSteps === 'number' &&
    typeof v.completedSteps === 'number' &&
    (typeof v.currentStepId === 'string' || typeof v.currentStepId === 'undefined') &&
    isValidState(v.state) &&
    typeof v.activeUrl === 'string' &&
    typeof v.swInstanceId === 'string'
  );
};

export const readOrphanSentinels = async (
  currentSwInstanceId: string,
): Promise<{ orphans: RunSentinel[]; strayKeys: string[] }> => {
  const session = getSessionStorage();
  if (!session) {
    return { orphans: [], strayKeys: [] };
  }
  try {
    const all = await session.get(null);
    const orphans: RunSentinel[] = [];
    const strayKeys: string[] = [];
    for (const [key, value] of Object.entries(all ?? {})) {
      if (!key.startsWith(SENTINEL_PREFIX)) {
        continue;
      }
      if (!isRunSentinel(value)) {
        strayKeys.push(key);
        continue;
      }
      if (value.swInstanceId === currentSwInstanceId) {
        continue;
      }
      orphans.push(value);
    }
    return { orphans, strayKeys };
  } catch (error) {
    console.warn('run-sentinel-read-failed', error);
    return { orphans: [], strayKeys: [] };
  }
};

export const removeSentinelKeys = async (keys: string[]): Promise<void> => {
  const session = getSessionStorage();
  if (!session || keys.length === 0) {
    return;
  }
  try {
    await session.remove(keys);
  } catch (error) {
    console.warn('run-sentinel-bulk-remove-failed', error);
  }
};

export const sentinelKeyForRunId = (runId: string): string => keyFor(runId);

// 1.13 (fix) — Pending failure notices. Orphan broadcast alone is lossy:
// if the sidepanel isn't listening at the instant of the SW cold-start
// broadcast, the FLOW_RUN_STATUS message is dropped. Alongside the
// broadcast we also APPEND each synthesized failure payload here, so a
// sidepanel mounting later can query + drain them and render the orphan
// failure. Drained on query, so each notice is delivered at most once.
//
// Bounded queue: at most one orphan exists per SW cold-start (one active
// run at a time), but a user laptop that sleeps repeatedly without ever
// reopening the sidepanel could accumulate them. Cap at 10 (drop oldest).

const PENDING_FAILURES_KEY = 'ladybird_run_pending_failures';
const PENDING_FAILURES_MAX = 10;

// Loose structural type to avoid importing FlowRunStatusPayload here
// (this file is bundled into the SW only; shared/messages already owns
// the shape). Stored verbatim — sidepanel will cast on query.
type StoredFailureNotice = Record<string, unknown>;

const isStoredFailureNotice = (value: unknown): value is StoredFailureNotice =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const appendPendingFailureNotices = async (
  notices: StoredFailureNotice[],
): Promise<void> => {
  const session = getSessionStorage();
  if (!session || notices.length === 0) {
    return;
  }
  try {
    const existing = await session.get(PENDING_FAILURES_KEY);
    const rawArray = existing?.[PENDING_FAILURES_KEY];
    const current: StoredFailureNotice[] = Array.isArray(rawArray)
      ? rawArray.filter(isStoredFailureNotice)
      : [];
    const merged = [...current, ...notices];
    const trimmed =
      merged.length > PENDING_FAILURES_MAX
        ? merged.slice(merged.length - PENDING_FAILURES_MAX)
        : merged;
    await session.set({ [PENDING_FAILURES_KEY]: trimmed });
  } catch (error) {
    console.warn('run-sentinel-append-pending-failures-failed', error);
  }
};

// Read-and-clear. Returned array is what the caller should render; after
// this call the key is gone so the next query sees an empty list.
export const takePendingFailureNotices = async (): Promise<StoredFailureNotice[]> => {
  const session = getSessionStorage();
  if (!session) {
    return [];
  }
  try {
    const existing = await session.get(PENDING_FAILURES_KEY);
    const rawArray = existing?.[PENDING_FAILURES_KEY];
    const current: StoredFailureNotice[] = Array.isArray(rawArray)
      ? rawArray.filter(isStoredFailureNotice)
      : [];
    if (current.length === 0) {
      return [];
    }
    await session.remove(PENDING_FAILURES_KEY);
    return current;
  } catch (error) {
    console.warn('run-sentinel-take-pending-failures-failed', error);
    return [];
  }
};
