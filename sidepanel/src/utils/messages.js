import { parseActionFlowDefinition } from '../../../common/flows.js';

export function createMessage(key, values) {
  return { key, values };
}

export function formatPreview(preview, t) {
  if (!preview) {
    return t('picker.previewTarget');
  }
  const parts = [];
  if (preview.tag) {
    parts.push(preview.tag);
  }
  if (preview.classes) {
    parts.push(`.${preview.classes}`);
  }
  if (preview.text) {
    parts.push(`"${preview.text}"`);
  }
  return parts.length > 0 ? parts.join(' ') : t('picker.previewTarget');
}

export function summarizeFlow(actionFlow) {
  if (typeof actionFlow !== 'string') {
    return null;
  }
  const trimmed = actionFlow.trim();
  if (!trimmed) {
    return null;
  }
  const { definition, error } = parseActionFlowDefinition(trimmed);
  if (error || !definition) {
    return null;
  }
  return { steps: definition.stepCount };
}
