import { DEFAULT_BUTTON_STYLE } from '../../selector/types/button.js';
import { DEFAULT_LINK_STYLE } from '../../selector/types/link.js';
import {
  DEFAULT_TOOLTIP_STYLE,
  VALID_TOOLTIP_POSITIONS,
} from '../../selector/types/tooltip.js';
import { getStyleFieldConfigs as buildStyleFieldConfigs } from '../styles/style-config.js';

export function getDefaultElementValues(values = {}, suggestedStyle = {}, t) {
  const configs = buildStyleFieldConfigs(t);
  const type = values.type === 'link' ? 'link' : values.type === 'tooltip' ? 'tooltip' : 'button';
  const text = typeof values.text === 'string' ? values.text : '';
  const href = typeof values.href === 'string' ? values.href : '';
  const actionFlow = typeof values.actionFlow === 'string' ? values.actionFlow : '';
  const position = resolvePosition(values.position);
  const tooltipPosition = resolveTooltipPosition(values.tooltipPosition);
  const tooltipPersistent = Boolean(values.tooltipPersistent);
  const defaults =
    type === 'link' ? DEFAULT_LINK_STYLE : type === 'tooltip' ? DEFAULT_TOOLTIP_STYLE : DEFAULT_BUTTON_STYLE;
  const style = {};
  const styleSuggestions = {};

  configs.forEach(({ name }) => {
    const providedRaw = values.style && typeof values.style[name] === 'string' ? values.style[name] : '';
    const provided = typeof providedRaw === 'string' ? providedRaw.trim() : '';
    if (provided) {
      style[name] = provided;
    } else if (defaults && typeof defaults[name] === 'string') {
      style[name] = defaults[name];
    } else {
      style[name] = '';
    }

    if (suggestedStyle && typeof suggestedStyle[name] === 'string') {
      const hint = suggestedStyle[name].trim();
      if (hint) {
        styleSuggestions[name] = hint;
      }
    }
  });

  return {
    type,
    text,
    href,
    actionFlow,
    position,
    tooltipPosition,
    tooltipPersistent,
    style,
    styleSuggestions,
  };
}

export function getSuggestedStyles(target) {
  if (!(target instanceof Element)) {
    return {};
  }
  const computed = window.getComputedStyle(target);
  const maybe = (value) => (value && value !== 'auto' ? value : '');
  const background = computed.backgroundColor;
  return {
    color: maybe(computed.color),
    backgroundColor:
      background && background !== 'rgba(0, 0, 0, 0)' ? background : '',
    fontSize: maybe(computed.fontSize),
    fontWeight: maybe(computed.fontWeight),
    padding: maybe(computed.padding),
    borderRadius: maybe(computed.borderRadius),
  };
}

export function resolvePosition(value) {
  if (value === 'append' || value === 'prepend' || value === 'before' || value === 'after') {
    return value;
  }
  return 'append';
}

export function resolveTooltipPosition(value) {
  if (value && VALID_TOOLTIP_POSITIONS.has(value)) {
    return value;
  }
  return 'top';
}
