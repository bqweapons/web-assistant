import React, { useEffect, useState } from 'react';
import { MessageType, sendMessage } from '../../../common/messaging.js';
import { SaveIcon, CloseIcon } from './Icons.jsx';
import { ElementForm } from './ElementForm.jsx';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js';
import { initializeProperties, normalizePropertiesForSave } from '../element-form.js';

export function ElementDrawer({ open, onClose, item, onSave, busyAction, onSwitchToFlow, t, tabId, pageUrl }) {
  const [properties, setProperties] = useState(() => initializeProperties(item, t));
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setProperties(initializeProperties(item, t));
      return;
    }
    setProperties(initializeProperties(item, t));
  }, [open, item?.id, t]);

  useEffect(() => {
    if (!open || !item?.id || !tabId) {
      return;
    }
    const payload = normalizePropertiesForSave(properties, t, {
      fallbackPageUrl: item?.pageUrl,
      fallbackSiteUrl: item?.siteUrl,
    });
    const previewElement = { ...item, ...payload, id: item.id };
    sendMessage(MessageType.PREVIEW_ELEMENT, {
      tabId,
      pageUrl: previewElement.pageUrl || pageUrl,
      element: previewElement,
    }).catch(() => {});
  }, [item?.id, item?.pageUrl, item?.siteUrl, open, pageUrl, properties, t, tabId]);

  useEffect(() => {
    if (!open || !item?.id || !tabId) {
      return;
    }
    const previewId = item.id;
    const previewPage = item.pageUrl || pageUrl;
    return () => {
      sendMessage(MessageType.PREVIEW_ELEMENT, {
        tabId,
        pageUrl: previewPage,
        id: previewId,
        reset: true,
      }).catch(() => {});
    };
  }, [item?.id, item?.pageUrl, open, pageUrl, tabId]);

  const handleSave = () => {
    const payload = normalizePropertiesForSave(properties, t, {
      fallbackPageUrl: item?.pageUrl,
      fallbackSiteUrl: item?.siteUrl,
    });
    onSave?.(payload);
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
        <div className="mx-auto max-w-4xl rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-slate-900">{t('editor.title')}</h3>
              <p className="text-xs text-slate-500">{t('manage.sections.add.description')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-primary inline-flex h-9 w-9 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSave}
                disabled={busyAction}
                aria-label={t('flow.actions.save')}
                title={t('flow.actions.save')}
              >
                <SaveIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-secondary inline-flex h-9 w-9 items-center justify-center p-0"
                onClick={onClose}
                aria-label={t('flow.actions.close')}
                title={t('flow.actions.close')}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="relative py-4 space-y-4">
            <div className="max-h-[60vh] min-h-0 overflow-y-auto">
              <div className="px-5">
                <ElementForm
                  value={properties}
                  onChange={setProperties}
                  t={t}
                  onEditFlow={onSwitchToFlow}
                  actionFlowSource={item?.actionFlow}
                />
              </div>
            </div>

            <div className="h-2" />
          </div>
        </div>
      </div>
    </>
  );
}
