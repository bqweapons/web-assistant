import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  MessageType,
  type FlowRunUnlockContextResponse,
  type FlowRunUnlockSubmitResponse,
} from '../../shared/messages';
import { sendRuntimeMessage } from '../../shared/runtimeMessaging';
// Review fix — reuse the sidepanel's locale store instead of calling
// `chrome.i18n.getMessage`. Both the sidepanel and this unlock window
// run under the same chrome-extension:// origin, so they share
// localStorage — the sidepanel's `sidepanel.locale` key is therefore
// directly readable here and the window will match whatever language
// the user picked in the sidepanel. `chrome.i18n.getMessage` by
// contrast ignores that selection and always follows the browser UI
// language.
import { t, useLocale } from '../../ui/sidepanel/utils/i18n';

type Stage =
  | { kind: 'loading' }
  | { kind: 'ready'; context: FlowRunUnlockContextResponse & { ok: true } }
  | { kind: 'submitting' }
  | { kind: 'terminal-not-pending' }
  | { kind: 'error'; message: string };

const parseRunIdFromUrl = (): string | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('runId');
  } catch {
    return null;
  }
};

export default function UnlockDialog() {
  // Review fix — subscribe to the sidepanel's locale store so this
  // window re-renders if the user changes language in the sidepanel
  // while the unlock prompt is open. Return value unused; the hook
  // itself plugs into the store via useSyncExternalStore.
  useLocale();
  const runId = parseRunIdFromUrl();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [attempt, setAttempt] = useState(1);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 1.4 — Fetch display context on mount: flow name, step title,
  // attempt counter, last error. If the SW says `run-not-pending`
  // (e.g. SW suspended + restarted; see 1.13), freeze into a terminal
  // state so the user knows to close the window + retry from sidepanel.
  useEffect(() => {
    let cancelled = false;
    if (!runId) {
      setStage({ kind: 'terminal-not-pending' });
      return;
    }
    (async () => {
      try {
        const response = await sendRuntimeMessage<FlowRunUnlockContextResponse>({
          type: MessageType.FLOW_RUN_UNLOCK_CONTEXT,
          data: { runId },
        });
        if (cancelled) return;
        if (!response.ok) {
          setStage({ kind: 'terminal-not-pending' });
          return;
        }
        setAttempt(response.attempt);
        setLastErrorMessage(response.lastErrorMessage);
        setStage({ kind: 'ready', context: response });
      } catch (error) {
        if (cancelled) return;
        setStage({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (stage.kind === 'ready') {
      // Focus the password field whenever we land on the ready stage
      // (first mount, or after an invalid-password retry).
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [stage.kind]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!runId || stage.kind !== 'ready') {
        return;
      }
      if (!password) {
        setLastErrorMessage(
          t('vault_unlock_error_empty_password', 'Please enter the master password.'),
        );
        return;
      }
      setStage({ kind: 'submitting' });
      try {
        const response = await sendRuntimeMessage<FlowRunUnlockSubmitResponse>({
          type: MessageType.FLOW_RUN_UNLOCK_SUBMIT,
          data: { runId, password },
        });
        if (response.ok) {
          // SW will close this window via chrome.windows.remove after
          // resolvePendingUnlock; fallback to self-close so slow IPC
          // doesn't leave the user staring at a resolved dialog.
          setPassword('');
          window.close();
          return;
        }
        if (response.code === 'run-not-pending') {
          setStage({ kind: 'terminal-not-pending' });
          setPassword('');
          return;
        }
        // invalid-password
        setAttempt(response.attempt);
        setLastErrorMessage(
          t(
            'vault_unlock_error_invalid_password',
            'Invalid master password.',
          ),
        );
        setPassword('');
        setStage({ kind: 'ready', context: stage.context });
      } catch (error) {
        setLastErrorMessage(error instanceof Error ? error.message : String(error));
        setPassword('');
        setStage({ kind: 'ready', context: stage.context });
      }
    },
    [password, runId, stage],
  );

  const handleCancel = useCallback(async () => {
    if (!runId) {
      window.close();
      return;
    }
    try {
      await sendRuntimeMessage({
        type: MessageType.FLOW_RUN_UNLOCK_CANCEL,
        data: { runId },
      });
    } catch {
      // Ignore — SW's onRemoved watchdog will also reject the run
      // once this window closes.
    }
    window.close();
  }, [runId]);

  const submitting = stage.kind === 'submitting';
  const disabled = submitting || stage.kind === 'terminal-not-pending' || stage.kind === 'loading';

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <ShieldAlert className="h-4 w-4 text-primary" />
          {t('vault_unlock_window_title', 'Unlock password vault')}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            'vault_unlock_window_description',
            'A flow is waiting for the password vault master password. The password stays inside the extension and is not sent to the page.',
          )}
        </p>

        {stage.kind === 'ready' ? (
          <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
            {stage.context.flowName ? (
              <div>
                <span className="font-semibold text-foreground">
                  {t('vault_unlock_context_flow', 'Flow')}:
                </span>{' '}
                {stage.context.flowName}
              </div>
            ) : null}
            {stage.context.stepTitle ? (
              <div>
                <span className="font-semibold text-foreground">
                  {t('vault_unlock_context_step', 'Step')}:
                </span>{' '}
                {stage.context.stepTitle}
              </div>
            ) : null}
            {stage.context.siteKey ? (
              <div>
                <span className="font-semibold text-foreground">
                  {t('vault_unlock_context_site', 'Site')}:
                </span>{' '}
                {stage.context.siteKey}
              </div>
            ) : null}
            {attempt > 1 ? (
              <div className="text-amber-600">
                {t('vault_unlock_context_attempt', 'Attempt {count}').replace(
                  '{count}',
                  String(attempt),
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {stage.kind === 'terminal-not-pending' ? (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {t(
              'vault_unlock_error_run_not_pending',
              'This flow run was interrupted (the background task may have been suspended). Close this window and run the flow again from the sidepanel.',
            )}
          </div>
        ) : null}

        {stage.kind === 'error' ? (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {stage.message}
          </div>
        ) : null}

        <form className="mt-3 space-y-2" onSubmit={handleSubmit}>
          <label className="block text-[11px] font-semibold text-muted-foreground">
            {t('vault_unlock_password_label', 'Master password')}
          </label>
          <input
            ref={inputRef}
            type="password"
            autoComplete="current-password"
            className="input w-full min-w-0 text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t(
              'vault_unlock_password_placeholder',
              'Password vault master password',
            )}
            disabled={disabled}
          />
          {lastErrorMessage && stage.kind !== 'terminal-not-pending' ? (
            <div className="text-[11px] text-destructive">{lastErrorMessage}</div>
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={handleCancel}
              disabled={submitting}
            >
              {t('vault_unlock_cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary text-xs"
              disabled={disabled || !password}
            >
              {submitting
                ? t('vault_unlock_submitting', 'Unlocking…')
                : t('vault_unlock_submit', 'Unlock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
