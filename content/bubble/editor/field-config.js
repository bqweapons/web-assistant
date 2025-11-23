import { getTooltipPositionOptions } from '../styles/style-presets.js';

export const DEFAULT_BASE_INFO_ITEM_MIN_WIDTH = 240;
export const DEFAULT_STYLE_ITEM_MIN_WIDTH = 260;

export function getTypeOptions(t) {
  return [
    { value: 'button', label: t('type.button') },
    { value: 'link', label: t('type.link') },
    { value: 'tooltip', label: t('type.tooltip') },
    { value: 'area', label: t('type.area') },
  ];
}

export function getBaseInfoFieldConfigs(t) {
  return [
    {
      name: 'type',
      key: 'type',
      type: 'select',
      label: t('editor.typeLabel'),
      minWidth: 200,
      stateKey: 'type',
      options: () => getTypeOptions(t),
    },
    {
      name: 'text',
      key: 'text',
      type: 'input',
      label: t('editor.textLabel'),
      minWidth: 240,
      stateKey: 'text',
      placeholder: (state) =>
        state.type === 'tooltip' ? t('editor.tooltipTextPlaceholder') : t('editor.textPlaceholder'),
      onChange: ({ value, setState }) => setState({ text: typeof value === 'string' ? value.trim() : '' }),
    },
    {
      name: 'href',
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
      onReset: ({ state, applyDefaults, setState }) => {
        if (!applyDefaults) return;
        if (state.type === 'tooltip' || state.type === 'area') {
          setState({ href: '' });
        }
      },
      onChange: ({ value, setState }) => {
        const next = typeof value === 'string' ? value.trim() : '';
        setState({ href: next });
      },
    },
    {
      name: 'linkTarget',
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
      onReset: ({ state, applyDefaults, setState }) => {
        if (state.type === 'link' && applyDefaults) {
          setState({ linkTarget: 'new-tab' });
        } else if (applyDefaults) {
          setState({ linkTarget: 'new-tab' });
        }
      },
    },
    {
      name: 'actionFlow',
      key: 'actionFlow',
      type: 'flow',
      label: t('editor.actionFlowLabel'),
      minWidth: 240,
      buttonPlacement: 'stacked',
      builderConfig: (state) => ({
        allowAdd: !state.actionFlowLocked,
        allowDelete: !state.actionFlowLocked,
        emptyHint: state.actionFlowLocked ? t('editor.actionFlowSummaryUnavailable') : t('editor.actionBuilder.empty'),
        disallowAddWhenHref: (snapshot) => Boolean(snapshot.href && snapshot.href.trim()),
      }),
      summaryHint: (state) => {
        if (state.actionFlowLocked) {
          return t('editor.actionFlowSummaryUnavailable');
        }
        return state.type === 'button'
          ? t('editor.actionFlowHintDefault', { limit: 4000 })
          : t('editor.actionFlowSummaryUnavailable');
      },
      disabledWhen: (state) => state.type !== 'button' || state.actionFlowLocked,
      visibleWhen: (state) => state.type === 'button',
      onReset: ({ state, applyDefaults, setState }) => {
        if (!applyDefaults) return;
        const base = {
          actionFlow: '',
          actionFlowError: '',
          actionFlowSteps: 0,
          actionFlowMode: 'builder',
          actionSteps: [],
        };
        if (state.type !== 'button') {
          setState(base);
        } else {
          setState(base);
        }
      },
    },
    {
      name: 'tooltipPosition',
      key: 'tooltipPosition',
      type: 'select',
      label: t('editor.tooltipPositionLabel'),
      minWidth: 220,
      stateKey: 'tooltipPosition',
      options: () => getTooltipPositionOptions(t),
      visibleWhen: (state) => state.type === 'tooltip',
      onReset: ({ state, applyDefaults, setState }) => {
        if (!applyDefaults) return;
        if (state.type === 'tooltip') {
          setState({ tooltipPosition: 'top' });
        } else {
          setState({ tooltipPosition: 'top', tooltipPersistent: false });
        }
      },
    },
    {
      name: 'tooltipPersistent',
      key: 'tooltipPersistent',
      type: 'toggle',
      label: t('editor.tooltipPersistenceLabel'),
      hint: t('editor.tooltipPersistenceHint'),
      minWidth: 220,
      stateKey: 'tooltipPersistent',
      visibleWhen: (state) => state.type === 'tooltip',
      onReset: ({ applyDefaults, setState }) => {
        if (applyDefaults) {
          setState({ tooltipPersistent: false });
        }
      },
    },
    {
      name: 'areaLayout',
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
      onReset: ({ state, applyDefaults, setState }) => {
        if (!applyDefaults) return;
        if (state.type === 'area') {
          setState({
            layout: 'row',
            href: '',
            actionFlow: '',
            actionFlowSteps: 0,
            actionSteps: [],
            actionFlowMode: 'builder',
          });
        } else {
          setState({ layout: 'row' });
        }
      },
    },
  ];
}

export function getStyleFieldConfigs(t) {
  return [
    { key: 'color', name: 'color', type: 'styleInput', label: t('editor.styles.color'), placeholder: '#2563eb', colorPicker: true, group: 'basic' },
    {
      key: 'backgroundColor',
      name: 'backgroundColor',
      type: 'styleInput',
      label: t('editor.styles.backgroundColor'),
      placeholder: '#1b84ff',
      colorPicker: true,
      group: 'basic',
    },
    { key: 'position', name: 'position', type: 'styleInput', label: t('editor.styles.position'), placeholder: 'relative', minWidth: 200, group: 'advanced' },
    { key: 'top', name: 'top', type: 'styleInput', label: t('editor.styles.top'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'left', name: 'left', type: 'styleInput', label: t('editor.styles.left'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'right', name: 'right', type: 'styleInput', label: t('editor.styles.right'), placeholder: '', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'bottom', name: 'bottom', type: 'styleInput', label: t('editor.styles.bottom'), placeholder: '', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'zIndex', name: 'zIndex', type: 'styleInput', label: t('editor.styles.zIndex'), placeholder: '1000', minWidth: 220, group: 'advanced' },
    { key: 'width', name: 'width', type: 'styleInput', label: t('editor.styles.width'), placeholder: '260px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'height', name: 'height', type: 'styleInput', label: t('editor.styles.height'), placeholder: '120px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'fontWeight', name: 'fontWeight', type: 'styleInput', label: t('editor.styles.fontWeight'), placeholder: '600', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'paddingTop', name: 'paddingTop', type: 'styleInput', label: t('editor.styles.paddingTop'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'paddingRight', name: 'paddingRight', type: 'styleInput', label: t('editor.styles.paddingRight'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'paddingBottom', name: 'paddingBottom', type: 'styleInput', label: t('editor.styles.paddingBottom'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'paddingLeft', name: 'paddingLeft', type: 'styleInput', label: t('editor.styles.paddingLeft'), placeholder: '12px', minWidth: 220, group: 'advanced', adjustable: true },
    { key: 'fontSize', name: 'fontSize', type: 'styleInput', label: t('editor.styles.fontSize'), placeholder: '12px', minWidth: 220, group: 'basic', adjustable: true },
    { key: 'boxShadow', name: 'boxShadow', type: 'styleInput', label: t('editor.styles.boxShadow'), placeholder: '0 12px 32px rgba(15, 23, 42, 0.18)', minWidth: 220, group: 'advanced' },
    { key: 'border', name: 'border', type: 'styleInput', label: t('editor.styles.border'), placeholder: '1px solid rgba(148, 163, 184, 0.4)', minWidth: 220, group: 'advanced' },
    { key: 'borderRadius', name: 'borderRadius', type: 'styleInput', label: t('editor.styles.borderRadius'), placeholder: '8px', minWidth: 220, group: 'advanced' },
  ];
}

export function getStyleSectionFields(t) {
  return [
    {
      key: 'stylePreset',
      type: 'stylePreset',
      label: t('editor.styles.presetsLabel'),
      minWidth: DEFAULT_STYLE_ITEM_MIN_WIDTH,
    },
    ...getStyleFieldConfigs(t),
    {
      key: 'customCss',
      type: 'customStyle',
      label: t('editor.styles.customCss'),
      minWidth: DEFAULT_STYLE_ITEM_MIN_WIDTH,
      group: 'advanced',
    },
    {
      key: 'styleHint',
      type: 'note',
      label: '',
      message: t('editor.stylesHint'),
    },
  ];
}

export function getEditorSections(t) {
  return [
    {
      key: 'base',
      legend: t('editor.sections.basics.title'),
      fields: getBaseInfoFieldConfigs(t),
    },
    {
      key: 'style',
      legend: t('editor.stylesLegend'),
      fields: getStyleSectionFields(t),
      isStyle: true,
    },
  ];
}
