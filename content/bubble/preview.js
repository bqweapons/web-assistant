import { applyButtonPreview } from '../selector/types/button.js';
import { applyLinkPreview } from '../selector/types/link.js';
import { applyTooltipPreview } from '../selector/types/tooltip.js';
import { applyAreaPreview } from '../selector/types/area.js';

/**
 * Ensures the preview element matches the desired type, replacing the node if needed.
 * @param {HTMLElement | null} currentElement
 * @param {'button' | 'link' | 'tooltip' | 'area'} type
 * @returns {HTMLElement}
 */
export function ensurePreviewElement(currentElement, type) {
  if (type === 'tooltip') {
    if (!currentElement || currentElement.dataset.previewType !== 'tooltip') {
      const replacement = createTooltipContainer();
      if (currentElement && currentElement.parentElement) {
        currentElement.parentElement.replaceChild(replacement, currentElement);
      }
      return replacement;
    }
    return currentElement;
  }

  if (type === 'area') {
    if (!currentElement || currentElement.dataset.previewType !== 'area') {
      const replacement = document.createElement('div');
      replacement.dataset.previewType = 'area';
      if (currentElement && currentElement.parentElement) {
        currentElement.parentElement.replaceChild(replacement, currentElement);
      }
      return replacement;
    }
    return currentElement;
  }

  const desiredTagName = type === 'link' ? 'a' : 'button';
  let element = currentElement;
  if (
    !element ||
    element.dataset.previewType === 'tooltip' ||
    element.tagName.toLowerCase() !== desiredTagName
  ) {
    const replacement = document.createElement(desiredTagName);
    replacement.tabIndex = -1;
    replacement.style.cursor = 'default';
    replacement.addEventListener('click', (event) => event.preventDefault());
    if (element && element.parentElement) {
      element.parentElement.replaceChild(replacement, element);
    }
    element = replacement;
  }

  delete element.dataset.previewType;
  if (type === 'link') {
    element.setAttribute('href', '#');
    element.setAttribute('role', 'link');
  } else {
    element.removeAttribute('href');
    element.removeAttribute('role');
  }

  return element;
}

/**
 * Applies preview styling/content based on payload.
 * @param {HTMLElement} previewElement
 * @param {{
 *   type: 'button' | 'link' | 'tooltip' | 'area';
 *   text: string;
 *   href?: string;
 *   position: 'append' | 'prepend' | 'before' | 'after';
 *   style?: Record<string, string>;
 *   tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
 *   tooltipPersistent?: boolean;
 * }} payload
 * @param {(key: string, params?: Record<string, any>) => string} t
 */
export function applyPreview(previewElement, payload, t) {
  if (!(previewElement instanceof HTMLElement)) {
    return;
  }

  if (payload.type === 'tooltip') {
    applyTooltipPreview(previewElement, payload, t);
    return;
  }

  if (payload.type === 'area') {
    applyAreaPreview(previewElement);
    const textValue = payload.text && payload.text.trim() ? payload.text : t('editor.previewArea');
    previewElement.textContent = textValue;
    if (payload.style) {
      Object.entries(payload.style).forEach(([key, value]) => {
        previewElement.style[key] = value;
      });
    }
    return;
  }

  const textValue =
    payload.text && payload.text.trim()
      ? payload.text
      : payload.type === 'link'
        ? t('editor.previewLink')
        : t('editor.previewButton');

  previewElement.textContent = textValue;

  if (payload.type === 'link') {
    applyLinkPreview(previewElement);
  } else {
    applyButtonPreview(previewElement);
  }

  if (payload.style) {
    Object.entries(payload.style).forEach(([key, value]) => {
      previewElement.style[key] = value;
    });
  }
}

function createTooltipContainer() {
  const container = document.createElement('div');
  container.dataset.previewType = 'tooltip';
  container.className = 'page-augmentor-preview-tooltip';
  container.dataset.position = 'top';
  container.dataset.persistent = 'false';
  container.dataset.previewVisible = 'true';
  container.tabIndex = -1;

  const trigger = document.createElement('span');
  trigger.className = 'page-augmentor-preview-tooltip-trigger';
  trigger.textContent = 'i';
  trigger.setAttribute('aria-hidden', 'true');

  const bubble = document.createElement('div');
  bubble.className = 'page-augmentor-preview-tooltip-bubble';
  bubble.textContent = '';

  container.append(trigger, bubble);
  return container;
}
