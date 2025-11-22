export const DEFAULT_BASE_INFO_ITEM_MIN_WIDTH = 240;

export function getBaseInfoFieldConfigs(t) {
  return [
    { key: 'text', label: t('editor.textLabel'), minWidth: 240, type: 'input' },
    {
      key: 'href',
      label: t('editor.hrefLabel'),
      minWidth: 240,
      type: 'input',
      visibleWhen: (state) => state.type !== 'tooltip' && state.type !== 'area',
    },
    {
      key: 'linkTarget',
      label: t('editor.linkTargetLabel'),
      minWidth: 200,
      type: 'select',
      visibleWhen: (state) => state.type === 'link',
    },
    { key: 'actionFlow', label: t('editor.actionFlowLabel'), minWidth: 240, type: 'flow', visibleWhen: (state) => state.type === 'button' },
    {
      key: 'tooltipPosition',
      label: t('editor.tooltipPositionLabel'),
      minWidth: 220,
      type: 'select',
      visibleWhen: (state) => state.type === 'tooltip',
    },
    {
      key: 'tooltipPersistent',
      label: t('editor.tooltipPersistenceLabel'),
      minWidth: 220,
      type: 'toggle',
      visibleWhen: (state) => state.type === 'tooltip',
    },
    {
      key: 'areaLayout',
      label: t('editor.areaLayoutLabel'),
      minWidth: 220,
      type: 'layout',
      visibleWhen: (state) => state.type === 'area',
    },
  ];
}
