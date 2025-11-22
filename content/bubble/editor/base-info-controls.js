import { applyCardStyle } from '../ui/card.js';
import { createSectionShell } from '../ui/section.js';
import { DEFAULT_BASE_INFO_ITEM_MIN_WIDTH, getBaseInfoFieldConfigs } from './base-info-config.js';

/**
 * Builds the base info fieldset using a config-driven card layout.
 * @param {{
 *   t: import('../../common/i18n.js').TranslateFunction;
 *   nodes: Record<string, HTMLElement>;
 }} options
 */
export function createBaseInfoSection({ t, nodes, getState }) {
  const { fieldset, container } = createSectionShell({ legendText: t('editor.sections.basics.title') });

  const configs = getBaseInfoFieldConfigs();

  const applyVisibility = () => {
    const state = typeof getState === 'function' ? getState() : {};
    configs.forEach(({ key, minWidth, visibleWhen }) => {
      const node = nodes[key];
      if (!(node instanceof HTMLElement)) return;
      const width = typeof minWidth === 'number' ? minWidth : DEFAULT_BASE_INFO_ITEM_MIN_WIDTH;
      applyCardStyle(node, width);
      const isVisible = typeof visibleWhen === 'function' ? !!visibleWhen(state) : true;
      node.style.display = isVisible ? 'flex' : 'none';
    });
  };

  configs.forEach(({ key, minWidth }) => {
    const node = nodes[key];
    if (node instanceof HTMLElement) {
      const width = typeof minWidth === 'number' ? minWidth : DEFAULT_BASE_INFO_ITEM_MIN_WIDTH;
      applyCardStyle(node, width);
      container.appendChild(node);
    }
  });

  fieldset.appendChild(container);
  applyVisibility();

  return {
    fieldset,
    updateVisibility: applyVisibility,
  };
}
