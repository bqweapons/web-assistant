import React, { useMemo, useState } from 'react';
import { BUILDER_STEP_TYPES, createDefaultStep, normalizeBuilderSteps, validateBuilderSteps } from '../../../common/flow-builder.js';
import { PlusIcon } from './Icons.jsx';
import { btnSecondary } from '../styles/buttons.js';

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
                    className={`${btnSecondary} text-xs px-3 py-2`}
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
                    className={`${btnSecondary} text-xs px-3 py-2`}
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
                    className={`${btnSecondary} text-xs px-3 py-2`}
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
              const template = createDefaultStep(nextType, step.id || `step-${index}`);
              onChange({ ...template, id: step.id || template.id });
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
            onChange={(event) => onChange({ ...step, timeout: Number(event.target.value) || undefined })}
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
            onChange={(event) => onChange({ ...step, retry: Number(event.target.value) || undefined })}
            placeholder="0"
          />
        </label>
      </div>
    </div>
  );
}

export function FlowBuilder({ value, onChange, t, onPickSelector }) {
  const [draggingIndex, setDraggingIndex] = useState(null);
  const steps = useMemo(() => normalizeBuilderSteps(value), [value]);

  const updateStep = (index, next) => {
    const nextSteps = [...steps];
    nextSteps[index] = next;
    onChange?.(nextSteps);
  };

  const handleReorder = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return;
    const nextSteps = [...steps];
    const [moved] = nextSteps.splice(from, 1);
    nextSteps.splice(to, 0, moved);
    onChange?.(nextSteps);
  };

  const handleAdd = () => {
    onChange?.([...steps, createDefaultStep('click', `step-${Date.now()}`)]);
  };

  const validation = useMemo(() => validateBuilderSteps(steps), [steps]);
  const error = validation.valid ? '' : validation.errors[0]?.message;

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div
          key={step.id || index}
          draggable
          onDragStart={(event) => {
            setDraggingIndex(index);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingIndex !== null) {
              handleReorder(draggingIndex, index);
              setDraggingIndex(null);
            }
          }}
          onDragEnd={() => setDraggingIndex(null)}
        >
          <StepEditor
            index={index}
            step={step}
            t={t}
            onChange={(next) => updateStep(index, next)}
            onDelete={() => onChange?.(steps.filter((_, i) => i !== index))}
            onPick={(idx) => onPickSelector?.({ kind: 'step', index: idx, stepType: step.type })}
          />
        </div>
      ))}

      <button
        type="button"
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-white"
        onClick={handleAdd}
      >
        <PlusIcon className="h-4 w-4" />
        {t('flow.actions.addStep')}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
