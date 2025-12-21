import React, { useEffect, useMemo, useState } from 'react';
import { normalizeBuilderSteps, validateBuilderSteps } from '../../../common/flow-builder.js';
import { CloseIcon, EditIcon, PauseIcon, PlayIcon, RefreshIcon, StopIcon } from './Icons.jsx';
import { FlowBuilder } from './FlowBuilder.jsx';
import { btnIconSecondary } from '../styles/buttons.js';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js';

export function FlowDrawer({
  open,
  onClose,
  item,
  initialSteps,
  onSave,
  onRun,
  onPause,
  onResume,
  onStop,
  onRefreshSession,
  session,
  busyAction,
  onPickSelector,
  pickerSelection,
  onPickerSelectionHandled,
  pickerError,
  t,
  onSwitchToElement,
}) {
  const [steps, setSteps] = useState(normalizeBuilderSteps(initialSteps));
  const [error, setError] = useState('');
  useBodyScrollLock(open);

  useEffect(() => {
    setSteps(normalizeBuilderSteps(initialSteps));
    setError('');
  }, [initialSteps]);

  useEffect(() => {
    if (!open || !pickerSelection || !pickerSelection.selector) {
      return;
    }
    if (pickerSelection.target?.kind !== 'step' || !Number.isInteger(pickerSelection.target.index)) {
      return;
    }
    const idx = pickerSelection.target.index;
    setSteps((prev) => {
      if (idx < 0 || idx >= prev.length) {
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], selector: pickerSelection.selector };
      return next;
    });
    onPickerSelectionHandled?.();
  }, [open, pickerSelection, onPickerSelectionHandled]);

  const sessionErrorMessage = useMemo(() => {
    if (!session?.error) {
      return '';
    }
    const code = String(session.error.code || '').toLowerCase();
    const map = {
      element_not_found: 'flow.errors.elementNotFound',
      elementnotfound: 'flow.errors.elementNotFound',
      assertion_failed: 'flow.errors.assertionFailed',
      assertionfailed: 'flow.errors.assertionFailed',
      step_timeout: 'flow.errors.stepTimeout',
      steptimeout: 'flow.errors.stepTimeout',
      execution_failed: 'flow.errors.executionFailed',
      executionfailed: 'flow.errors.executionFailed',
      dispatch_failed: 'flow.errors.dispatchFailed',
      dispatchfailed: 'flow.errors.dispatchFailed',
      tab_closed: 'flow.errors.tabClosed',
      tabclosed: 'flow.errors.tabClosed',
      navigation_timeout: 'flow.errors.navigationTimeout',
      navigationtimeout: 'flow.errors.navigationTimeout',
    };
    const key = map[code] || '';
    return key ? t(key) : session.error.message || t('flow.session.error');
  }, [session?.error, t]);

  const validateAndNormalize = () => {
    const validation = validateBuilderSteps(steps);
    if (!validation.valid) {
      const first = validation.errors[0] || null;
      const keyMap = {
        missing_selector: 'editor.actionBuilder.error.selector',
        missing_value: 'editor.actionBuilder.error.value',
        invalid_wait: 'editor.actionBuilder.error.delay',
      };
      const index = typeof first?.index === 'number' ? first.index + 1 : undefined;
      const translated = first?.code && keyMap[first.code] ? t(keyMap[first.code], { index }) : null;
      setError(translated || first?.message || t('flow.session.error'));
      return null;
    }
    setError('');
    const normalized = validation.steps;
    if (JSON.stringify(normalized) !== JSON.stringify(steps)) {
      setSteps(normalized);
    }
    return normalized;
  };

  const handleSave = () => {
    try {
      const normalized = validateAndNormalize();
      if (!normalized) {
        return;
      }
      onSave?.(normalized);
    } catch (err) {
      setError(err?.message || String(err));
    }
  };

  const handleRun = () => {
    const normalized = validateAndNormalize();
    if (!normalized) {
      return;
    }
    setError('');
    onRun?.(normalized);
  };

  const handlePause = () => onPause?.();
  const handleResume = () => onResume?.();
  const handleStop = () => onStop?.();

  const handlePickSelector = (target) => {
    if (!onPickSelector) {
      return;
    }
    onPickSelector(target);
  };

  const flowDirty = useMemo(
    () => JSON.stringify(normalizeBuilderSteps(initialSteps)) !== JSON.stringify(steps),
    [initialSteps, steps],
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transform transition-transform duration-200 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-hidden={!open}
      >
        <div className="mx-auto max-w-4xl rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-slate-900">
                {t('flow.drawer.title')} · {item?.text || t('flow.drawer.untitled')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {onSwitchToElement && (
                <button
                  type="button"
                  className={btnIconSecondary}
                  onClick={onSwitchToElement}
                  aria-label={t('editor.title')}
                  title={t('editor.title')}
                >
                  <EditIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                className={btnIconSecondary}
                onClick={onRefreshSession}
                disabled={busyAction}
                aria-label={t('flow.actions.refresh')}
                title={t('flow.actions.refresh')}
              >
                <RefreshIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={btnIconSecondary}
                onClick={onClose}
                aria-label={t('flow.actions.close')}
                title={t('flow.actions.close')}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="relative px-5 py-4 space-y-4">
            <div className="space-y-3 overflow-y-auto pr-1 max-h-[60vh]">
              <FlowBuilder value={steps} onChange={setSteps} t={t} onPickSelector={handlePickSelector} />
              {pickerError && <p className="text-[11px] text-rose-600">{pickerError}</p>}
              {flowDirty && <p className="text-[11px] text-amber-600">{t('flow.drawer.noteText')}</p>}
            </div>

            {session?.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {sessionErrorMessage}
              </div>
            )}

            <div className="sticky bottom-0 left-0 right-0 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSave}
                  disabled={busyAction}
                >
                  {t('flow.actions.save')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleRun}
                  disabled={busyAction}
                >
                  <PlayIcon className="h-4 w-4" />
                  {t('flow.actions.run')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handlePause}
                  disabled={busyAction}
                >
                  <PauseIcon className="h-4 w-4" />
                  {t('flow.actions.pause')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleResume}
                  disabled={busyAction}
                >
                  <PlayIcon className="h-4 w-4" />
                  {t('flow.actions.resume')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleStop}
                  disabled={busyAction}
                >
                  <StopIcon className="h-4 w-4" />
                  {t('flow.actions.stop')}
                </button>
              </div>

              {(error || flowDirty) && (
                <div className="mt-2 space-y-1">
                  {error && <p className="text-xs text-rose-600">{error}</p>}
                  {flowDirty && <p className="text-[11px] text-amber-600">{t('flow.drawer.noteText')}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
