import { applyCardStyle } from '../ui/card.js';
import { DEFAULT_BASE_INFO_ITEM_MIN_WIDTH, getBaseInfoFieldConfigs } from './base-info-config.js';

/**
 * Builds the base info fieldset using a config-driven card layout.
 * @param {{
 *   t: import('../../common/i18n.js').TranslateFunction;
 *   nodes: Record<string, HTMLElement>;
 }} options
 */
export function createBaseInfoSection({ t, nodes, getState }) {
  const fieldset = document.createElement('fieldset');
  Object.assign(fieldset.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '16px',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  });

  const legend = document.createElement('legend');
  legend.textContent = t('editor.sections.basics.title');
  Object.assign(legend.style, {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6b7280',
    padding: '0 6px',
  });
  fieldset.appendChild(legend);

  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'stretch',
  });

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
