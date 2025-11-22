export const DEFAULT_BASE_INFO_ITEM_MIN_WIDTH = 240;

export function getBaseInfoFieldConfigs() {
  return [
    { key: 'text', label: 'text', minWidth: 240, type: 'input' },
    { key: 'href', label: 'href', minWidth: 240, type: 'input', visibleWhen: (state) => state.type !== 'tooltip' && state.type !== 'area' },
    { key: 'linkTarget', label: 'linkTarget', minWidth: 200, type: 'select', visibleWhen: (state) => state.type === 'link' },
    { key: 'actionFlow', label: 'actionFlow', minWidth: 240, type: 'flow', visibleWhen: (state) => state.type === 'button' },
    { key: 'tooltipPosition', label: 'tooltipPosition', minWidth: 220, type: 'select', visibleWhen: (state) => state.type === 'tooltip' },
    { key: 'tooltipPersistent', label: 'tooltipPersistent', minWidth: 220, type: 'toggle', visibleWhen: (state) => state.type === 'tooltip' },
    { key: 'areaLayout', label: 'areaLayout', minWidth: 220, type: 'layout', visibleWhen: (state) => state.type === 'area' },
  ];
}
