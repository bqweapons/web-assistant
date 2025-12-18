import React, { useEffect, useMemo, useState } from 'react';
import { PauseIcon, PlayIcon, StopIcon } from './Icons.jsx';

const STEP_TYPES = ['click', 'input', 'wait', 'navigate', 'log', 'assert'];

function createDefaultStep(type = 'click') {
  switch (type) {
    case 'input':
      return { type: 'input', selector: '', value: '', timeout: undefined, retry: undefined };
    case 'wait':
      return { type: 'wait', ms: 1000, timeout: undefined, retry: undefined };
    case 'navigate':
      return { type: 'navigate', url: '', target: '_self', timeout: undefined, retry: undefined };
    case 'log':
      return { type: 'log', message: '', timeout: undefined, retry: undefined };
    case 'assert':
      return {
        type: 'assert',
        condition: { kind: 'exists', selector: '' },
        message: '',
        timeout: undefined,
        retry: undefined,
      };
    case 'click':
    default:
      return { type: 'click', selector: '', all: false, timeout: undefined, retry: undefined };
  }
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step, index) => {
    if (!step || typeof step !== 'object') {
      return createDefaultStep();
    }
    const base = { ...step };
    if (!base.type || !STEP_TYPES.includes(base.type)) {
      base.type = 'click';
    }
    if (base.type === 'assert') {
      if (!base.condition || typeof base.condition !== 'object') {
        base.condition = { kind: 'exists', selector: '' };
      }
      if (base.condition.kind !== 'exists') {
        base.condition = { kind: 'exists', selector: '' };
      }
    }
    if (typeof base.timeout !== 'number') {
      base.timeout = undefined;
    }
    if (typeof base.retry !== 'number') {
      base.retry = undefined;
    }
    return { id: base.id || `step-${index}`, ...base };
  });
}

function StepEditor({ index, step, onChange, onDelete, onPick, t }) {
  const update = (patch) => onChange({ ...step, ...patch });

  const renderFields = () => {
    switch (step.type) {
      case 'click':
        return (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.selector')}
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={step.selector || ''}
                  onChange={(event) => update({ selector: event.target.value })}
                  placeholder="button[type=submit]"
                />
                {onPick && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                    onClick={() => onPick(index)}
                  >
                    {t('editor.actionPick')}
                  </button>
                )}
              </div>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={Boolean(step.all)}
                onChange={(event) => update({ all: event.target.checked })}
              />
              {t('flow.form.clickAll')}
            </label>
          </>
        );
      case 'input':
        return (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.selector')}
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={step.selector || ''}
                  onChange={(event) => update({ selector: event.target.value })}
                  placeholder="input[name=email]"
                />
                {onPick && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                    onClick={() => onPick(index)}
                  >
                    {t('editor.actionPick')}
                  </button>
                )}
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.value')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={step.value || ''}
                onChange={(event) => update({ value: event.target.value })}
                placeholder={t('flow.form.valuePlaceholder')}
              />
            </label>
          </>
        );
      case 'wait':
        return (
          <label className="block text-xs font-semibold text-slate-700">
            {t('flow.form.ms')}
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={Number.isFinite(step.ms) ? step.ms : 1000}
              onChange={(event) => update({ ms: Number(event.target.value) || 0 })}
              placeholder="1000"
            />
          </label>
        );
      case 'navigate':
        return (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.url')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={step.url || ''}
                onChange={(event) => update({ url: event.target.value })}
                placeholder="https://example.com"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.target')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={step.target || ''}
                onChange={(event) => update({ target: event.target.value })}
                placeholder="_blank"
              />
            </label>
          </>
        );
      case 'log':
        return (
          <label className="block text-xs font-semibold text-slate-700">
            {t('flow.form.message')}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={step.message || ''}
              onChange={(event) => update({ message: event.target.value })}
              placeholder={t('flow.form.messagePlaceholder')}
            />
          </label>
        );
      case 'assert': {
        const selector = step.condition?.selector || '';
        return (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.assertSelector')}
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={selector}
                  onChange={(event) =>
                    update({
                      condition: { kind: 'exists', selector: event.target.value },
                      message: step.message || '',
                    })
                  }
                  placeholder="div.success"
                />
                {onPick && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                    onClick={() => onPick(index)}
                  >
                    {t('editor.actionPick')}
                  </button>
                )}
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {t('flow.form.message')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={step.message || ''}
                onChange={(event) => update({ message: event.target.value })}
                placeholder={t('flow.form.assertMessagePlaceholder')}
              />
            </label>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            {index + 1}
          </span>
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
            value={step.type}
            onChange={(event) => {
              const nextType = event.target.value;
              const template = createDefaultStep(nextType);
              update({ ...template, id: step.id || template.id });
            }}
          >
            {STEP_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`flow.form.type.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-rose-500 hover:text-rose-600"
          onClick={onDelete}
        >
          {t('flow.actions.deleteStep')}
        </button>
      </div>

      <div className="space-y-3">{renderFields()}</div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          {t('flow.form.timeout')}
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={Number.isFinite(step.timeout) ? step.timeout : ''}
            onChange={(event) => update({ timeout: Number(event.target.value) || undefined })}
            placeholder={t('flow.form.timeoutPlaceholder')}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('flow.form.retry')}
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={Number.isFinite(step.retry) ? step.retry : ''}
            onChange={(event) => update({ retry: Number(event.target.value) || undefined })}
            placeholder="0"
          />
        </label>
      </div>
    </div>
  );
}

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
}) {
  const [steps, setSteps] = useState(normalizeSteps(initialSteps));
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('flow');
  const [properties, setProperties] = useState({
    text: item?.text || '',
    selector: item?.selector || '',
  });

  useEffect(() => {
    setSteps(normalizeSteps(initialSteps));
    setError('');
  }, [initialSteps]);

  useEffect(() => {
    setProperties({
      text: item?.text || '',
      selector: item?.selector || '',
    });
  }, [item?.id]);

  useEffect(() => {
    if (!pickerSelection || !pickerSelection.selector) {
      return;
    }
    if (pickerSelection.target?.kind === 'step' && Number.isInteger(pickerSelection.target.index)) {
      const idx = pickerSelection.target.index;
      setSteps((prev) => {
        if (idx < 0 || idx >= prev.length) {
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], selector: pickerSelection.selector };
        return next;
      });
    } else if (pickerSelection.target?.kind === 'property') {
      setProperties((prev) => ({ ...prev, selector: pickerSelection.selector }));
    }
    onPickerSelectionHandled?.();
  }, [pickerSelection, onPickerSelectionHandled]);

  const statusLabel = useMemo(() => {
    const status = session?.status || 'idle';
    return t(`flow.status.${status}`, { defaultValue: status });
  }, [session?.status, t]);

  const currentProgress = useMemo(() => {
    if (!session || !Array.isArray(session.steps)) {
      return null;
    }
    const total = session.steps.length;
    const index = Number.isFinite(session.currentIndex) ? session.currentIndex : 0;
    return `${Math.min(index + 1, total)} / ${total}`;
  }, [session]);

  const handleStepChange = (index, nextStep) => {
    const next = [...steps];
    next[index] = nextStep;
    setSteps(next);
  };

  const handleAddStep = () => {
    setSteps((prev) => [...prev, createDefaultStep('click')]);
  };

  const handleSave = () => {
    try {
      setError('');
      onSave?.(steps, properties);
    } catch (err) {
      setError(err?.message || String(err));
    }
  };

  const handleRun = () => {
    setError('');
    onRun?.(steps);
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

  const flowDirty = useMemo(() => JSON.stringify(normalizeSteps(initialSteps)) !== JSON.stringify(steps), [initialSteps, steps]);
  const propertiesDirty = useMemo(
    () =>
      (properties.text || '') !== (item?.text || '') ||
      (properties.selector || '') !== (item?.selector || ''),
    [item?.selector, item?.text, properties.selector, properties.text],
  );

  const renderPropertiesTab = () => (
    <div className="space-y-4">
      <label className="block text-xs font-semibold text-slate-700">
        {t('editor.textLabel')}
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={properties.text}
          onChange={(event) => setProperties((prev) => ({ ...prev, text: event.target.value }))}
          placeholder={t('editor.textPlaceholder')}
        />
      </label>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.selectorLabel')}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.selector}
            onChange={(event) => setProperties((prev) => ({ ...prev, selector: event.target.value }))}
            placeholder="main button"
          />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handlePickSelector({ kind: 'property' })}
            disabled={busyAction}
          >
            {t('editor.actionPick')}
          </button>
        </div>
        {pickerError && activeTab === 'properties' && (
          <p className="text-[11px] text-rose-600">{pickerError}</p>
        )}
      </div>
      {(propertiesDirty || flowDirty) && (
        <p className="text-[11px] text-amber-600">{t('flow.drawer.noteText')}</p>
      )}
    </div>
  );

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 transform transition-transform duration-200 ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto max-w-5xl rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-slate-900">
              {t('flow.drawer.title')} · {item?.text || t('flow.drawer.untitled')}
            </h3>
            <p className="text-xs text-slate-500">{t('flow.drawer.subtitle', { status: statusLabel })}</p>
            <div className="mt-1 inline-flex gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-700">
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${activeTab === 'properties' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                {t('editor.title')}
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${activeTab === 'flow' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setActiveTab('flow')}
              >
                {t('flow.drawer.title')}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              onClick={onRefreshSession}
              disabled={busyAction}
            >
              {t('flow.actions.refresh')}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              onClick={onClose}
            >
              {t('flow.actions.close')}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[2fr,1fr]">
          <div className="space-y-3 overflow-y-auto pr-1 max-h-[60vh]">
            {activeTab === 'properties' ? (
              renderPropertiesTab()
            ) : (
              <>
                {steps.map((step, index) => (
                  <StepEditor
                key={step.id || index}
                index={index}
                step={step}
                t={t}
                onChange={(next) => handleStepChange(index, next)}
                onDelete={() => setSteps(steps.filter((_, i) => i !== index))}
                onPick={(idx) => handlePickSelector({ kind: 'step', index: idx })}
              />
            ))}

                <button
                  type="button"
                  className="mt-2 inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-white"
                  onClick={handleAddStep}
                >
                  {t('flow.actions.addStep')}
                </button>
              </>
            )}
          </div>
          <aside className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">{t('flow.session.status')}</p>
                <p className="text-sm text-slate-900">{statusLabel}</p>
            {currentProgress && (
              <p className="text-xs text-slate-500">{t('flow.session.progress', { progress: currentProgress })}</p>
            )}
          </div>
        </div>

            {session?.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {session.error.message || t('flow.session.error')}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSave}
                disabled={busyAction}
              >
                {t('flow.actions.save')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleRun}
                disabled={busyAction}
              >
                <PlayIcon className="h-4 w-4" />
                {t('flow.actions.run')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handlePause}
                disabled={busyAction}
              >
                <PauseIcon className="h-4 w-4" />
                {t('flow.actions.pause')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleResume}
                disabled={busyAction}
              >
                <PlayIcon className="h-4 w-4" />
                {t('flow.actions.resume')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleStop}
                disabled={busyAction}
              >
                <StopIcon className="h-4 w-4" />
                {t('flow.actions.stop')}
              </button>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{t('flow.drawer.noteTitle')}</p>
              <p className="mt-1">{t('flow.drawer.noteText')}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
