import { getTooltipPositionOptions } from '../styles/style-presets.js';

export const DEFAULT_BASE_INFO_ITEM_MIN_WIDTH = 240;

export function getBaseInfoFieldConfigs(t) {
  return [
    {
      key: 'text',
      type: 'input',
      label: t('editor.textLabel'),
      minWidth: 240,
      stateKey: 'text',
      placeholder: (state) =>
        state.type === 'tooltip' ? t('editor.tooltipTextPlaceholder') : t('editor.textPlaceholder'),
    },
    {
      key: 'href',
      type: 'input',
      minWidth: 240,
      stateKey: 'href',
      visibleWhen: (state) => state.type !== 'tooltip' && state.type !== 'area',
      labelForState: (state) =>
        state.type === 'tooltip'
          ? t('editor.hrefTooltipLabel')
          : state.type === 'link'
            ? t('editor.hrefLabel')
            : t('editor.hrefOptionalLabel'),
      placeholder: (state) =>
        state.type === 'tooltip' || state.type === 'area'
          ? t('editor.hrefTooltipPlaceholder')
          : state.type === 'link'
            ? t('editor.hrefPlaceholder')
            : t('editor.hrefOptionalPlaceholder'),
      onTypeChange: ({ state, applyDefaults, setState }) => {
        if ((state.type === 'tooltip' || state.type === 'area') && applyDefaults) {
          setState({ href: '' });
        }
      },
    },
    {
      key: 'linkTarget',
      type: 'select',
      label: t('editor.linkTargetLabel'),
      minWidth: 200,
      stateKey: 'linkTarget',
      options: () => [
        { value: 'new-tab', label: t('editor.linkTarget.newTab') },
        { value: 'same-tab', label: t('editor.linkTarget.sameTab') },
      ],
      visibleWhen: (state) => state.type === 'link',
      onTypeChange: ({ state, applyDefaults, setState }) => {
        if (state.type === 'link' && applyDefaults) {
          setState({ linkTarget: 'new-tab' });
        }
      },
    },
    {
      key: 'actionFlow',
      type: 'flow',
      label: t('editor.actionFlowLabel'),
      minWidth: 240,
      visibleWhen: (state) => state.type === 'button',
      onTypeChange: ({ state, setState }) => {
        if (state.type !== 'button') {
          setState({
            actionFlow: '',
            actionFlowError: '',
            actionFlowSteps: 0,
            actionFlowMode: 'builder',
            actionSteps: [],
          });
        }
      },
    },
    {
      key: 'tooltipPosition',
      type: 'select',
      label: t('editor.tooltipPositionLabel'),
      minWidth: 220,
      stateKey: 'tooltipPosition',
      options: () => getTooltipPositionOptions(t),
      visibleWhen: (state) => state.type === 'tooltip',
      onTypeChange: ({ state, applyDefaults, setState }) => {
        if (state.type === 'tooltip' && applyDefaults) {
          setState({ tooltipPosition: 'top', tooltipPersistent: false });
        }
      },
    },
    {
      key: 'tooltipPersistent',
      type: 'toggle',
      label: t('editor.tooltipPersistenceLabel'),
      hint: t('editor.tooltipPersistenceHint'),
      minWidth: 220,
      stateKey: 'tooltipPersistent',
      visibleWhen: (state) => state.type === 'tooltip',
      onTypeChange: ({ state, applyDefaults, setState }) => {
        if (state.type === 'tooltip' && applyDefaults) {
          setState({ tooltipPersistent: false });
        }
      },
    },
    {
      key: 'areaLayout',
      type: 'select',
      label: t('editor.areaLayoutLabel'),
      minWidth: 220,
      stateKey: 'layout',
      options: () => [
        { value: 'row', label: t('editor.areaLayout.horizontal') },
        { value: 'column', label: t('editor.areaLayout.vertical') },
      ],
      visibleWhen: (state) => state.type === 'area',
      onTypeChange: ({ state, applyDefaults, setState }) => {
        if (state.type === 'area' && applyDefaults) {
          setState({ layout: 'row', href: '', actionFlow: '', actionFlowSteps: 0, actionSteps: [], actionFlowMode: 'builder' });
        }
      },
    },
  ];
}
