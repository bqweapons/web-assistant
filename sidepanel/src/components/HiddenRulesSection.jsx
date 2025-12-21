import React, { useState } from 'react';

export function HiddenRulesSection({ rules, onCreate, onDelete, onToggle, busy, t }) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [selector, setSelector] = useState('');
  const [scope, setScope] = useState('page');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

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
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg"
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? t('hidden.cancel') : t('hidden.add')}
        </button>
      </header>
      {formOpen && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[2fr,1fr]">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              {t('hidden.form.selector')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="main article"
              />
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
              className="mt-2 w-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={busy}
            >
              {t('hidden.save')}
            </button>
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
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
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-60"
                  onClick={() => onDelete?.(rule)}
                  disabled={busy}
                >
                  {t('manage.delete.confirm')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
