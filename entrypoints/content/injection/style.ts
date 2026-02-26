import type { RuntimeElement } from './shared';
import { isElementFloating } from './shared';

export const POSITIONING_KEYS = new Set(['position', 'left', 'top', 'right', 'bottom', 'zIndex']);

export const parseCustomCss = (raw?: string) => {
  if (!raw) {
    return {} as Record<string, string>;
  }
  const rules: Record<string, string> = {};
  raw
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [property, ...rest] = segment.split(':');
      if (!property || rest.length === 0) {
        return;
      }
      const value = rest.join(':').trim();
      if (!value) {
        return;
      }
      const key = property
        .trim()
        .toLowerCase()
        .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      if (!key) {
        return;
      }
      rules[key] = value;
    });
  return rules;
};

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

export const formatCustomCss = (rules: Record<string, string>) =>
  Object.entries(rules)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => Boolean(key) && Boolean(value))
    .map(([key, value]) => `${toKebabCase(key)}: ${value};`)
    .join('\n');

export const mergeStyleRules = (element: RuntimeElement) => ({
  ...(element.style?.inline || {}),
  ...parseCustomCss(element.style?.customCss || ''),
});

export const normalizeStyleRules = (rules: Record<string, string>) => {
  const next: Record<string, string> = {};
  Object.entries(rules).forEach(([key, value]) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return;
    }
    next[key] = trimmed;
  });
  return next;
};

export const applyInlineStyles = (
  node: HTMLElement,
  element: RuntimeElement,
  options?: { omitPositioning?: boolean },
) => {
  const omitPositioning = options?.omitPositioning === true;
  const inline = element.style?.inline || {};
  const custom = parseCustomCss(element.style?.customCss || '');
  const merged: Record<string, string> = { ...inline, ...custom };
  Object.entries(merged).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    if (omitPositioning && POSITIONING_KEYS.has(key)) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore style indexing
    node.style[key] = value;
  });
  if (isElementFloating(element) && !omitPositioning) {
    node.style.position = node.style.position || 'absolute';
  }
};
