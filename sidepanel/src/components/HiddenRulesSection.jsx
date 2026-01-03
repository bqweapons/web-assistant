import React, { useEffect, useState } from 'react';
import { PlusIcon, CloseIcon, TrashIcon } from './Icons.jsx';

export function HiddenRulesSection({
  rules,
  onCreate,
  onDelete,
  onToggle,
  onPickSelector,
  pickerSelection,
  onPickerSelectionHandled,
  pickerError,
  busy,
  t,
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [selector, setSelector] = useState('');
  const [scope, setScope] = useState('page');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pickerSelection?.selector) {
      return;
    }
    setSelector(pickerSelection.selector);
    setError('');
    onPickerSelectionHandled?.();
  }, [pickerSelection, onPickerSelectionHandled]);

  const handleSubmit = () => {
    if (!selector.trim()) {
      setError(t('hidden.error.selector'));
      return;
    }
    setError('');
    onCreate?.({
      name: name.trim() || t('hidden.defaultName'),
      selector: selector.trim(),
      scope,
      note: note.trim(),
      enabled: true,
    });
    setFormOpen(false);
    setName('');
    setSelector('');
    setNote('');
    setScope('page');
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-brand space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{t('hidden.heading')}</h3>
          <p className="text-xs text-slate-500">{t('hidden.description')}</p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex h-9 w-9 items-center justify-center p-0"
          onClick={() => setFormOpen((v) => !v)}
          aria-label={formOpen ? t('hidden.cancel') : t('hidden.add')}
          title={formOpen ? t('hidden.cancel') : t('hidden.add')}
        >
          {formOpen ? <CloseIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
        </button>
      </header>
      {formOpen && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[2fr,1fr]">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              {t('hidden.form.selector')}
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="main article"
                />
                <button
                  type="button"
                  className="btn-primary text-xs px-3 py-2"
                  onClick={() => onPickSelector?.()}
                  aria-label={t('editor.actionPick')}
                  title={t('editor.actionPick')}
                >
                  {t('editor.actionPick')}
                </button>
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {t('hidden.form.name')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('hidden.defaultName')}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              {t('hidden.form.note')}
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('hidden.notePlaceholder')}
              />
            </label>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              {t('hidden.form.scope')}
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="page">{t('hidden.scope.page')}</option>
                <option value="site">{t('hidden.scope.site')}</option>
                <option value="global">{t('hidden.scope.global')}</option>
              </select>
            </label>
            <button
              type="button"
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSubmit}
              disabled={busy}
              aria-label={t('hidden.save')}
              title={t('hidden.save')}
            >
              {t('hidden.save')}
            </button>
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
            {pickerError && <p className="text-[11px] text-rose-600">{pickerError}</p>}
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          {t('hidden.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {rule.name || t('hidden.defaultName')}
                  <span className="ml-2 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                    {t(`hidden.scope.${rule.scope || 'page'}`)}
                  </span>
                </p>
                <p className="text-xs text-slate-600 break-all">{rule.selector}</p>
                {rule.note ? <p className="text-[11px] text-slate-500">{rule.note}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2 text-xs">
                <label className="inline-flex items-center gap-1 text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={rule.enabled !== false}
                    onChange={(e) => onToggle?.(rule, e.target.checked)}
                    disabled={busy}
                  />
                  {rule.enabled !== false ? t('hidden.enabled') : t('hidden.disabled')}
                </label>
                <button
                  type="button"
                  className="btn-secondary inline-flex h-9 w-9 items-center justify-center p-0 text-rose-500 hover:text-rose-600"
                  onClick={() => onDelete?.(rule)}
                  disabled={busy}
                  aria-label={t('manage.delete.confirm')}
                  title={t('manage.delete.confirm')}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
