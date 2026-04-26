import SelectMenu from '../../components/SelectMenu';
import { t } from '../../utils/i18n';
import {
  getElementActionFlowId,
  getElementHref,
  getElementLayout,
  getElementLinkTarget,
  getElementType,
  type StoredElementRecord,
} from './normalize';

// Basics (name + site scope checkbox) and Action (type-specific flow /
// link / layout editor) panels extracted from the element details
// drawer. The callback-heavy contract lets the parent keep owning
// editElement state so the preview effect and save pipeline continue to
// see the same object reference.

type ElementBasicsActionProps = {
  editElement: StoredElementRecord;
  actionFlowOptions: Array<{ value: string; label: string; rightLabel?: string; sticky?: boolean }>;
  selectButtonClass: string;
  currentPageScopedKey: string | null;
  defaultPageKey: string | null;
  onChangeEditElement: (next: StoredElementRecord) => void;
  onRequestCreateFlow: (seedName: string) => void;
};

export default function ElementBasicsAction({
  editElement,
  actionFlowOptions,
  selectButtonClass,
  currentPageScopedKey,
  defaultPageKey,
  onChangeEditElement,
  onRequestCreateFlow,
}: ElementBasicsActionProps) {
  const typeLower = getElementType(editElement).toLowerCase();
  return (
    <>
      <div className="rounded border border-border bg-card p-3">
        <div className="text-xs font-semibold text-foreground">
          {t('sidepanel_elements_basics', 'Basics')}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span>{t('sidepanel_field_name', 'Name')}</span>
            <input
              className="input"
              value={editElement.text}
              onChange={(event) =>
                onChangeEditElement({
                  ...editElement,
                  text: event.target.value,
                  updatedAt: Date.now(),
                })
              }
              placeholder={t('sidepanel_elements_name_placeholder', 'Element text')}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4"
            checked={editElement.scope === 'site'}
            onChange={(event) =>
              onChangeEditElement({
                ...editElement,
                scope: event.target.checked ? 'site' : 'page',
                context: {
                  ...editElement.context,
                  pageKey: event.target.checked
                    ? null
                    : editElement.context.pageKey || currentPageScopedKey || defaultPageKey,
                },
                updatedAt: Date.now(),
              })
            }
          />
            <span>{t('sidepanel_elements_apply_site', 'Apply to entire site')}</span>
          </label>
        </div>
      </div>
      <div className="rounded border border-border bg-card p-3">
        <div className="text-xs font-semibold text-foreground">
          {t('sidepanel_elements_action_title', 'Action')}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {typeLower === 'button' ? (
            <div className="grid gap-1 sm:col-span-2">
              <span>{t('sidepanel_field_action_flow', 'Action flow')}</span>
              <SelectMenu
                value={getElementActionFlowId(editElement)}
                options={actionFlowOptions}
                useInputStyle={false}
                buttonClassName={selectButtonClass}
                onChange={(value) => {
                  if (value === '__create__') {
                    onRequestCreateFlow(editElement.text.trim());
                    return;
                  }
                  onChangeEditElement({
                    ...editElement,
                    behavior: {
                      ...editElement.behavior,
                      actionFlowId: value,
                    },
                    updatedAt: Date.now(),
                  });
                }}
              />
            </div>
          ) : null}
          {typeLower === 'link' ? (
            <>
              <label className="grid gap-1 sm:col-span-2">
                <span>{t('sidepanel_elements_link_url', 'Link URL')}</span>
                <input
                  className="input"
                  value={getElementHref(editElement)}
                  onChange={(event) =>
                    onChangeEditElement({
                      ...editElement,
                      behavior: {
                        ...editElement.behavior,
                        href: event.target.value,
                      },
                      updatedAt: Date.now(),
                    })
                  }
                  placeholder={t('sidepanel_elements_link_placeholder', 'https://example.com')}
                />
              </label>
              <div className="grid gap-1 sm:col-span-2">
                <span>{t('sidepanel_elements_link_target', 'Link target')}</span>
                <SelectMenu
                  value={getElementLinkTarget(editElement)}
                  options={[
                    { value: 'new-tab', label: t('sidepanel_elements_link_new_tab', 'Open in new tab') },
                    { value: 'same-tab', label: t('sidepanel_elements_link_same_tab', 'Open in same tab') },
                  ]}
                  useInputStyle={false}
                  buttonClassName={selectButtonClass}
                  onChange={(value) =>
                    onChangeEditElement({
                      ...editElement,
                      behavior: {
                        ...editElement.behavior,
                        target: value === 'same-tab' ? 'same-tab' : 'new-tab',
                      },
                      updatedAt: Date.now(),
                    })
                  }
                />
              </div>
            </>
          ) : null}
          {typeLower === 'area' ? (
            <div className="grid gap-1 sm:col-span-2">
              <span>{t('sidepanel_field_layout', 'Layout')}</span>
              <SelectMenu
                value={getElementLayout(editElement)}
                options={[
                  { value: 'row', label: t('sidepanel_layout_row', 'Row') },
                  { value: 'column', label: t('sidepanel_layout_column', 'Column') },
                ]}
                useInputStyle
                buttonClassName={selectButtonClass}
                onChange={(value) =>
                  onChangeEditElement({
                    ...editElement,
                    behavior: {
                      ...editElement.behavior,
                      layout: value === 'column' ? 'column' : 'row',
                    },
                    updatedAt: Date.now(),
                  })
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
