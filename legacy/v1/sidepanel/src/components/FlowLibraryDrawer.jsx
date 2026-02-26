import React, { useEffect, useMemo, useState } from 'react';
import { FlowBuilder } from './FlowBuilder.jsx';
import { SaveIcon, PlayIcon } from './Icons.jsx';
import { normalizeBuilderSteps, validateBuilderSteps } from '../../../common/flow-builder.js';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js';

export function FlowLibraryDrawer({
  open,
  flow,
  mode = 'library',
  seed = { baseSteps: [], defaultLabel: '', templateId: '' },
  templates = [],
  onClose,
  onSave,
  onRun,
  onPickSelector,
  pickerSelection,
  onPickerSelectionHandled,
  pickerError,
  busyAction,
  t,
}) {
  const isElementMode = mode === 'element';
  const [name, setName] = useState(flow?.name || '');
  const [description, setDescription] = useState(flow?.description || '');
  const [steps, setSteps] = useState(flow?.steps || []);
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');
  useBodyScrollLock(open);

  const defaultLabel = typeof seed?.defaultLabel === 'string' ? seed.defaultLabel : '';
  const seedTemplateId = typeof seed?.templateId === 'string' ? seed.templateId : '';
  const templateOptions = useMemo(
    () =>
      (templates || [])
        .slice()
        .sort((a, b) => (a?.name || '').localeCompare(b?.name || '')),
    [templates],
  );
  const selectedTemplate = useMemo(
    () => templateOptions.find((option) => option?.id === templateId) || null,
    [templateId, templateOptions],
  );

  useEffect(() => {
    const fallbackLabel = isElementMode ? '' : defaultLabel;
    let nextTemplateId = isElementMode ? seedTemplateId : '';
    let nextName = flow?.name || fallbackLabel;
    let nextDescription = flow?.description || fallbackLabel;
    let nextSteps = flow?.steps ? normalizeBuilderSteps(flow.steps) : isElementMode ? [] : [];

    if (isElementMode && nextTemplateId) {
      const selected = templateOptions.find((option) => option?.id === nextTemplateId);
      if (selected) {
        nextName = selected.name || nextName;
        nextDescription = selected.description || '';
        nextSteps = normalizeBuilderSteps(selected.steps || []);
      } else {
        nextTemplateId = '';
        nextName = '';
        nextDescription = '';
        nextSteps = [];
      }
    }

    setName(nextName);
    setDescription(nextDescription);
    setSteps(nextSteps);
    setTemplateId(nextTemplateId);
    setError('');
  }, [flow?.id, open, isElementMode, defaultLabel, seedTemplateId, templateOptions]);

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

  const validation = useMemo(() => validateBuilderSteps(steps), [steps]);

  const handleSave = (runAfterSave = false) => {
    if (isElementMode) {
      if (!templateId) {
        setError(t('flow.library.errorSelect'));
        return;
      }
      setError('');
      onSave?.({ templateId }, { runAfterSave });
      return;
    }
    if (!name.trim()) {
      setError(t('flow.library.errorName'));
      return;
    }
    if (!validation.valid) {
      setError(validation.errors[0]?.message || t('flow.session.error'));
      return;
    }
    setError('');
    const payload = {
      ...(flow || {}),
      name: name.trim(),
      description: description.trim(),
      steps: validation.steps,
    };
    if (isElementMode && templateId) {
      payload.templateId = templateId;
    }
    onSave?.(payload, { runAfterSave });
  };

  const handleRun = () => {
    if (!validation.valid) {
      setError(validation.errors[0]?.message || t('flow.session.error'));
      return;
    }
    onRun?.({ ...(flow || {}), name: name.trim() || flow?.name || 'Flow', steps: validation.steps });
  };

  const handleTemplateChange = (event) => {
    const nextId = event.target.value;
    setTemplateId(nextId);
    setError('');
    if (!nextId) {
      if (isElementMode) {
        setSteps([]);
        setName('');
        setDescription('');
      }
      return;
    }
    const selected = templateOptions.find((option) => option?.id === nextId);
    if (selected?.steps) {
      setSteps(normalizeBuilderSteps(selected.steps));
      setName(selected.name || '');
      setDescription(selected.description || '');
    }
  };

  const elementActionsDisabled = isElementMode && !templateId;
  const headerTitle = isElementMode
    ? t('editor.actionFlowTitle')
    : flow?.id
      ? t('flow.library.editTitle')
      : t('flow.library.createTitle');
  const headerSubtitle = isElementMode ? t('editor.actionFlowDescription') : t('flow.library.subtitle');

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
              <h3 className="text-base font-semibold text-slate-900">{headerTitle}</h3>
              <p className="text-xs text-slate-500">{headerSubtitle}</p>
            </div>
            <button
              type="button"
              className="btn-secondary inline-flex items-center justify-center px-3 py-2 text-xs"
              onClick={onClose}
            >
              {t('flow.actions.close')}
            </button>
          </header>

          <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[2fr,1fr]">
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {isElementMode && (
                <label className="block text-xs font-semibold text-slate-700">
                  {t('flow.library.templateLabel')}
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={templateId}
                    onChange={handleTemplateChange}
                  >
                    <option value="">{t('flow.library.templatePlaceholder')}</option>
                    {templateOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name || t('flow.drawer.untitled')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!isElementMode && (
                <>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('flow.library.name')}
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={t('flow.library.namePlaceholder')}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('flow.library.descriptionField')}
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={3}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder={t('flow.library.descriptionPlaceholder')}
                    />
                  </label>
                  <FlowBuilder value={steps} onChange={setSteps} onPickSelector={onPickSelector} t={t} />
                  {pickerError && <p className="text-xs text-rose-600">{pickerError}</p>}
                </>
              )}
              {isElementMode && selectedTemplate?.description ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {selectedTemplate.description}
                </p>
              ) : null}
            </div>
            <aside className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">{t('flow.library.summary')}</p>
              <p className="text-sm text-slate-900">
                {t('flow.library.stepsCount', { count: validation?.steps?.length || 0 })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary inline-flex items-center justify-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleSave(false)}
                  disabled={busyAction || elementActionsDisabled}
                >
                  <SaveIcon className="h-4 w-4" />
                  {t('flow.actions.save')}
                </button>
                {!isElementMode && (
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center justify-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handleSave(true)}
                    disabled={busyAction}
                  >
                    <PlayIcon className="h-4 w-4" />
                    {t('flow.library.saveAndRun')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary inline-flex items-center justify-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={isElementMode ? () => handleSave(true) : handleRun}
                  disabled={busyAction || elementActionsDisabled}
                >
                  <PlayIcon className="h-4 w-4" />
                  {t('flow.actions.run')}
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
