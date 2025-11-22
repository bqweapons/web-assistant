import { getBaseInfoFieldConfigs } from './base-info-config.js';
import { DEFAULT_STYLE_ITEM_MIN_WIDTH, getStyleFieldConfigs } from '../styles/style-config.js';

export function getFormSections(t) {
  const styleFields = getStyleFieldConfigs(t).map((field) => ({
    ...field,
    key: field.name,
    type: 'styleInput',
  }));

  return [
    {
      key: 'base',
      legend: t('editor.sections.basics.title'),
      fields: getBaseInfoFieldConfigs(t),
    },
    {
      key: 'style',
      legend: t('editor.stylesLegend'),
      fields: [
        {
          key: 'stylePreset',
          label: t('editor.styles.presetsLabel'),
          minWidth: DEFAULT_STYLE_ITEM_MIN_WIDTH,
          type: 'stylePreset',
        },
        ...styleFields,
        {
          key: 'customCss',
          label: t('editor.styles.customCss'),
          minWidth: DEFAULT_STYLE_ITEM_MIN_WIDTH,
          type: 'customStyle',
          group: 'advanced',
        },
        {
          key: 'styleHint',
          label: '',
          message: t('editor.stylesHint'),
          type: 'note',
        },
      ],
      isStyle: true,
    },
  ];
}
