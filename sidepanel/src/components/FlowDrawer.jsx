import React, { useEffect, useMemo, useState } from 'react';
import { BUILDER_STEP_TYPES, createDefaultStep, normalizeBuilderSteps } from '../../../common/flow-builder.js';
import { PauseIcon, PlayIcon, StopIcon } from './Icons.jsx';

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
            {BUILDER_STEP_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`flow.form.type.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="text-xs font-semibold text-rose-500 hover:text-rose-600" onClick={onDelete}>
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
  const [steps, setSteps] = useState(normalizeBuilderSteps(initialSteps));
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('flow');
  const [properties, setProperties] = useState({
    type: item?.type || 'button',
    text: item?.text || '',
    selector: item?.selector || '',
    actionSelector: item?.actionSelector || '',
    href: item?.href || '',
    linkTarget: item?.linkTarget || 'new-tab',
    tooltipPosition: item?.tooltipPosition || 'top',
    tooltipPersistent: Boolean(item?.tooltipPersistent),
    actionFlowLocked: Boolean(item?.actionFlowLocked),
  });

  useEffect(() => {
    setSteps(normalizeBuilderSteps(initialSteps));
    setError('');
  }, [initialSteps]);

  useEffect(() => {
    setProperties({
      type: item?.type || 'button',
      text: item?.text || '',
      selector: item?.selector || '',
      actionSelector: item?.actionSelector || '',
      href: item?.href || '',
      linkTarget: item?.linkTarget || 'new-tab',
      tooltipPosition: item?.tooltipPosition || 'top',
      tooltipPersistent: Boolean(item?.tooltipPersistent),
      actionFlowLocked: Boolean(item?.actionFlowLocked),
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
    } else if (pickerSelection.target?.kind === 'action') {
      setProperties((prev) => ({ ...prev, actionSelector: pickerSelection.selector }));
    }
    onPickerSelectionHandled?.();
  }, [pickerSelection, onPickerSelectionHandled]);

  const statusLabel = useMemo(() => {
    const status = session?.status || 'idle';
    return t(`flow.status.${status}`, { defaultValue: status });
  }, [session?.status, t]);

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
    setSteps((prev) => [...prev, createDefaultStep('click', `step-${Date.now()}`)]);
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

  const flowDirty = useMemo(
    () => JSON.stringify(normalizeBuilderSteps(initialSteps)) !== JSON.stringify(steps),
    [initialSteps, steps],
  );
  const propertiesDirty = useMemo(
    () =>
      (properties.text || '') !== (item?.text || '') ||
      (properties.selector || '') !== (item?.selector || '') ||
      (properties.actionSelector || '') !== (item?.actionSelector || '') ||
      (properties.href || '') !== (item?.href || '') ||
      (properties.linkTarget || '') !== (item?.linkTarget || '') ||
      Boolean(properties.tooltipPersistent) !== Boolean(item?.tooltipPersistent) ||
      (properties.tooltipPosition || '') !== (item?.tooltipPosition || '') ||
      Boolean(properties.actionFlowLocked) !== Boolean(item?.actionFlowLocked),
    [
      item?.actionFlowLocked,
      item?.actionSelector,
      item?.href,
      item?.selector,
      item?.text,
      item?.linkTarget,
      item?.tooltipPersistent,
      item?.tooltipPosition,
      properties.actionFlowLocked,
      properties.actionSelector,
      properties.href,
      properties.linkTarget,
      properties.selector,
      properties.text,
      properties.tooltipPersistent,
      properties.tooltipPosition,
    ],
  );

  const renderPropertiesTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-800">
          {t('type.' + (properties.type || 'button')) || properties.type || 'button'}
        </span>
        {properties.type === 'button' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={Boolean(properties.actionFlowLocked)}
              onChange={(event) => setProperties((prev) => ({ ...prev, actionFlowLocked: event.target.checked }))}
            />
            <span>{t('editor.actionFlowSummaryUnavailable')}</span>
          </label>
        )}
      </div>
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
        <label className="block text-xs font-semibold text-slate-700">{t('editor.selectorLabel')}</label>
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
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">{t('editor.actionLabel')}</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.actionSelector}
            onChange={(event) => setProperties((prev) => ({ ...prev, actionSelector: event.target.value }))}
            placeholder={t('editor.actionPlaceholder')}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handlePickSelector({ kind: 'action' })}
            disabled={busyAction}
          >
            {t('editor.actionPick')}
          </button>
        </div>
      </div>
      <label className="block text-xs font-semibold text-slate-700">
        {t('editor.hrefLabel')}
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={properties.href}
          onChange={(event) => setProperties((prev) => ({ ...prev, href: event.target.value }))}
          placeholder={t('editor.hrefPlaceholder')}
        />
      </label>
      {properties.type === 'link' && (
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.linkTargetLabel')}
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.linkTarget || 'new-tab'}
            onChange={(event) => setProperties((prev) => ({ ...prev, linkTarget: event.target.value }))}
          >
            <option value="new-tab">{t('editor.linkTarget.newTab')}</option>
            <option value="same-tab">{t('editor.linkTarget.sameTab')}</option>
          </select>
        </label>
      )}
      {properties.type === 'tooltip' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700">
            {t('tooltip.position.top')}
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={properties.tooltipPosition}
              onChange={(event) => setProperties((prev) => ({ ...prev, tooltipPosition: event.target.value }))}
            >
              <option value="top">{t('tooltip.position.top')}</option>
              <option value="right">{t('tooltip.position.right')}</option>
              <option value="bottom">{t('tooltip.position.bottom')}</option>
              <option value="left">{t('tooltip.position.left')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={Boolean(properties.tooltipPersistent)}
              onChange={(event) =>
                setProperties((prev) => ({ ...prev, tooltipPersistent: event.target.checked }))
              }
            />
            {t('tooltip.mode.persistent')}
          </label>
        </div>
      )}
      {(propertiesDirty || flowDirty) && <p className="text-[11px] text-amber-600">{t('flow.drawer.noteText')}</p>}
    </div>
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
                  {sessionErrorMessage}
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
    </>
  );
}
