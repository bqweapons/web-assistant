import { applyCardStyle } from '../ui/card.js';
import { createSectionShell } from '../ui/section.js';
import { DEFAULT_BASE_INFO_ITEM_MIN_WIDTH } from './base-info-config.js';
import { DEFAULT_STYLE_ITEM_MIN_WIDTH } from '../styles/style-config.js';

/**
 * Builds form sections from a unified config.
 * @param {{
 *   t: import('../../common/i18n.js').TranslateFunction;
 *   sections: Array<{
 *     key: string;
 *     legend: string;
 *     fields?: Array<{ name?: string; key?: string; minWidth?: number; visibleWhen?: (state: any) => boolean }>;
 *     prebuilt?: HTMLElement;
 *     isStyle?: boolean;
 *   }>;
 *   nodes: Record<string, HTMLElement>;
 *   getState: () => any;
 * }} options
 * @returns {HTMLElement[]} fieldsets
 */
export function buildFormSections({ t, sections, nodes, getState }) {
  const stateGetter = typeof getState === 'function' ? getState : () => ({});
  const fieldsets = [];

  sections.forEach((section) => {
    if (section.prebuilt instanceof HTMLElement) {
      fieldsets.push(section.prebuilt);
      return;
    }
    const { fieldset, container } = createSectionShell({ legendText: section.legend });
    const defaultWidth = section.isStyle ? DEFAULT_STYLE_ITEM_MIN_WIDTH : DEFAULT_BASE_INFO_ITEM_MIN_WIDTH;

    (section.fields || []).forEach((field) => {
      const key = field.name || field.key;
      const node = nodes[key];
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const width = typeof field.minWidth === 'number' ? field.minWidth : defaultWidth;
      applyCardStyle(node, width);
      container.appendChild(node);
    });

    fieldset.appendChild(container);

    const applyVisibility = () => {
      const state = stateGetter() || {};
      (section.fields || []).forEach((field) => {
        const key = field.name || field.key;
        const node = nodes[key];
        if (!(node instanceof HTMLElement)) return;
        const visible = typeof field.visibleWhen === 'function' ? !!field.visibleWhen(state) : true;
        node.style.display = visible ? 'flex' : 'none';
      });
    };

    applyVisibility();
    fieldset.dataset.sectionKey = section.key;
    fieldset.dataset.applyVisibility = 'true';
    fieldset.applyVisibility = applyVisibility;
    fieldsets.push(fieldset);
  });

  return fieldsets;
}

