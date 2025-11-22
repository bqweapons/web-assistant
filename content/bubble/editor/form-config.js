import { getBaseInfoFieldConfigs } from './base-info-config.js';
import { getStyleFieldConfigs } from '../styles/style-config.js';

export function getFormSections(t) {
  return [
    {
      key: 'base',
      legend: t('editor.sections.basics.title'),
      fields: getBaseInfoFieldConfigs(),
    },
    {
      key: 'style',
      legend: t('editor.stylesLegend'),
      fields: getStyleFieldConfigs(t),
      isStyle: true,
    },
  ];
}

