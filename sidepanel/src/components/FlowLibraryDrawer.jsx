import React, { useEffect, useMemo, useState } from 'react';
import { FlowBuilder } from './FlowBuilder.jsx';
import { validateBuilderSteps } from '../../../common/flow-builder.js';

export function FlowLibraryDrawer({ open, flow, onClose, onSave, onRun, onPickSelector, busyAction, t }) {
  const [name, setName] = useState(flow?.name || '');
  const [description, setDescription] = useState(flow?.description || '');
  const [steps, setSteps] = useState(flow?.steps || []);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(flow?.name || '');
    setDescription(flow?.description || '');
    setSteps(flow?.steps || []);
    setError('');
  }, [flow?.id, open]);

  const validation = useMemo(() => validateBuilderSteps(steps), [steps]);

  const handleSave = (runAfterSave = false) => {
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
    onSave?.(payload, { runAfterSave });
  };

  const handleRun = () => {
    if (!validation.valid) {
      setError(validation.errors[0]?.message || t('flow.session.error'));
      return;
    }
    onRun?.({ ...(flow || {}), name: name.trim() || flow?.name || 'Flow', steps: validation.steps });
  };

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
                {flow?.id ? t('flow.library.editTitle') : t('flow.library.createTitle')}
              </h3>
              <p className="text-xs text-slate-500">{t('flow.library.subtitle')}</p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              onClick={onClose}
            >
              {t('flow.actions.close')}
            </button>
          </header>

          <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
            </div>
            <aside className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">{t('flow.library.summary')}</p>
              <p className="text-sm text-slate-900">
                {t('flow.library.stepsCount', { count: validation?.steps?.length || 0 })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleSave(false)}
                  disabled={busyAction}
                >
                  {t('flow.actions.save')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleSave(true)}
                  disabled={busyAction}
                >
                  {t('flow.library.saveAndRun')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleRun}
                  disabled={busyAction}
                >
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
