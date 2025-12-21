import React, { useEffect, useMemo, useState } from 'react';
import { btnSecondary } from '../styles/buttons.js';

export function ElementDrawer({
  open,
  onClose,
  item,
  onSave,
  onPickSelector,
  pickerSelection,
  onPickerSelectionHandled,
  pickerError,
  busyAction,
  onSwitchToFlow,
  t,
}) {
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
    actionFlowId: item?.actionFlowId || '',
    position: item?.position || 'append',
    layout: item?.layout || 'row',
    style: item?.style || {},
  });

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
      actionFlowId: item?.actionFlowId || '',
      position: item?.position || 'append',
      layout: item?.layout || 'row',
      style: item?.style || {},
    });
  }, [item?.id]);

  useEffect(() => {
    if (!pickerSelection || !pickerSelection.selector) {
      return;
    }
    if (pickerSelection.target?.kind === 'property') {
      setProperties((prev) => ({ ...prev, selector: pickerSelection.selector }));
    } else if (pickerSelection.target?.kind === 'action') {
      setProperties((prev) => ({ ...prev, actionSelector: pickerSelection.selector }));
    }
    onPickerSelectionHandled?.();
  }, [pickerSelection, onPickerSelectionHandled]);

  const updateStyle = (key, value) => {
    setProperties((prev) => {
      const nextStyle = { ...(prev.style || {}) };
      if (value === '' || value === undefined || value === null) {
        delete nextStyle[key];
      } else {
        nextStyle[key] = value;
      }
      return { ...prev, style: nextStyle };
    });
  };

  const renderStyleControls = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.color')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.color || ''}
            onChange={(e) => updateStyle('color', e.target.value)}
            placeholder="#111827"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.backgroundColor')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.backgroundColor || ''}
            onChange={(e) => updateStyle('backgroundColor', e.target.value)}
            placeholder="#ffffff"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.fontSize')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.fontSize || ''}
            onChange={(e) => updateStyle('fontSize', e.target.value)}
            placeholder="14px"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.fontWeight')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.fontWeight || ''}
            onChange={(e) => updateStyle('fontWeight', e.target.value)}
            placeholder="600"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.padding')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.padding || ''}
            onChange={(e) => updateStyle('padding', e.target.value)}
            placeholder="8px 12px"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.border')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.border || ''}
            onChange={(e) => updateStyle('border', e.target.value)}
            placeholder="1px solid #e2e8f0"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.borderRadius')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.borderRadius || ''}
            onChange={(e) => updateStyle('borderRadius', e.target.value)}
            placeholder="10px"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.boxShadow')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.boxShadow || ''}
            onChange={(e) => updateStyle('boxShadow', e.target.value)}
            placeholder="0 4px 12px rgba(0,0,0,0.08)"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.width')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.width || ''}
            onChange={(e) => updateStyle('width', e.target.value)}
            placeholder="auto"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.height')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.height || ''}
            onChange={(e) => updateStyle('height', e.target.value)}
            placeholder="auto"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.position')}
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.position || ''}
            onChange={(e) => updateStyle('position', e.target.value)}
          >
            <option value="">{t('manage.actions.cancel')}</option>
            <option value="static">static</option>
            <option value="relative">relative</option>
            <option value="absolute">absolute</option>
            <option value="fixed">fixed</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.zIndex')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.zIndex || ''}
            onChange={(e) => updateStyle('zIndex', e.target.value)}
            placeholder="1000"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.top')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.top || ''}
            onChange={(e) => updateStyle('top', e.target.value)}
            placeholder="auto"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.right')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.right || ''}
            onChange={(e) => updateStyle('right', e.target.value)}
            placeholder="auto"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.bottom')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.bottom || ''}
            onChange={(e) => updateStyle('bottom', e.target.value)}
            placeholder="auto"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          {t('editor.styles.left')}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={properties.style?.left || ''}
            onChange={(e) => updateStyle('left', e.target.value)}
            placeholder="auto"
          />
        </label>
      </div>
    </div>
  );

  const renderPropertiesTab = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{t('editor.title')}</h4>
            <p className="text-xs text-slate-500">{t('manage.sections.add.description')}</p>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-800">
            {t('type.' + (properties.type || 'button')) || properties.type || 'button'}
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700">
            {t('editor.textLabel')}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={properties.text}
              onChange={(event) => setProperties((prev) => ({ ...prev, text: event.target.value }))}
              placeholder={t('editor.textPlaceholder')}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            {t('editor.hrefLabel')}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={properties.href}
              onChange={(event) => setProperties((prev) => ({ ...prev, href: event.target.value }))}
              placeholder={t('editor.hrefPlaceholder')}
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">{t('editor.selectorLabel')}</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={properties.selector}
                onChange={(event) => setProperties((prev) => ({ ...prev, selector: event.target.value }))}
                placeholder="main button"
              />
              <button
                type="button"
                className={`${btnSecondary} text-xs px-3 py-2`}
                onClick={() => onPickSelector?.({ kind: 'property' })}
                disabled={busyAction}
              >
                {t('editor.actionPick')}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">{t('editor.actionLabel')}</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={properties.actionSelector}
                onChange={(event) => setProperties((prev) => ({ ...prev, actionSelector: event.target.value }))}
                placeholder={t('editor.actionPlaceholder')}
              />
              <button
                type="button"
                className={`${btnSecondary} text-xs px-3 py-2`}
                onClick={() => onPickSelector?.({ kind: 'action' })}
                disabled={busyAction}
              >
                {t('editor.actionPick')}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">{t('editor.positionLabel')}</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={properties.position || 'append'}
              onChange={(event) => setProperties((prev) => ({ ...prev, position: event.target.value }))}
            >
              <option value="append">{t('position.append')}</option>
              <option value="prepend">{t('position.prepend')}</option>
              <option value="before">{t('position.before')}</option>
              <option value="after">{t('position.after')}</option>
            </select>
          </div>
        </div>
        {properties.type === 'link' && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-700">
              {t('editor.linkTargetLabel')}
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={properties.linkTarget || 'new-tab'}
                onChange={(event) => setProperties((prev) => ({ ...prev, linkTarget: event.target.value }))}
              >
                <option value="new-tab">{t('editor.linkTarget.newTab')}</option>
                <option value="same-tab">{t('editor.linkTarget.sameTab')}</option>
              </select>
            </label>
          </div>
        )}
        {properties.type === 'tooltip' && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              {t('tooltip.position.top')}
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
        {properties.type === 'area' && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-700">
              {t('editor.areaLayoutLabel')}
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={properties.layout || 'row'}
                onChange={(event) => setProperties((prev) => ({ ...prev, layout: event.target.value }))}
              >
                <option value="row">{t('editor.areaLayout.horizontal')}</option>
                <option value="column">{t('editor.areaLayout.vertical')}</option>
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{t('editor.stylesLegend')}</h4>
            <p className="text-xs text-slate-500">{t('editor.stylesHint')}</p>
          </div>
        </div>
        {renderStyleControls()}
      </div>
    </div>
  );

  const handleSave = () => {
    onSave?.(properties);
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
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {item?.text || t('flow.drawer.untitled')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${btnSecondary} text-xs px-3 py-2`}
                onClick={onClose}
              >
                {t('flow.actions.close')}
              </button>
            </div>
          </header>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-3 overflow-y-auto pr-1 max-h-[60vh]">{renderPropertiesTab()}</div>
            <aside className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{t('flow.session.status')}</p>
                  <p className="text-sm text-slate-900">{t('flow.status.idle')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${btnSecondary} text-xs px-3 py-2`}
                  onClick={handleSave}
                  disabled={busyAction}
                >
                  {t('flow.actions.save')}
                </button>
              </div>
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
