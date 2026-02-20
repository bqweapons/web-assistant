import { getSiteData } from '../../shared/storage';
import { deriveSiteKey, type StructuredHiddenRecord } from '../../shared/siteDataSchema';
import { deriveSiteKeyFromUrl } from '../../shared/urlKeys';

const HIDDEN_RULES_STYLE_ID = 'ladybird-hidden-rules';

type RuntimeHiddenRule = {
  siteKey: string;
  selector: string;
  enabled: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeHiddenRule = (value: unknown, fallbackSiteKey: string): RuntimeHiddenRule | null => {
  if (!isRecord(value)) {
    return null;
  }
  const siteKey =
    deriveSiteKey(typeof value.siteKey === 'string' ? value.siteKey : '') || fallbackSiteKey;
  const selector = typeof value.selector === 'string' ? value.selector.trim() : '';
  if (!siteKey || !selector) {
    return null;
  }
  return {
    siteKey,
    selector,
    enabled: value.enabled !== false,
  };
};

const isSelectorValid = (selector: string) => {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

const buildHiddenCss = (rules: RuntimeHiddenRule[]) =>
  rules
    .filter((rule) => rule.enabled)
    .map((rule) => rule.selector)
    .filter((selector) => isSelectorValid(selector))
    .map((selector) => `${selector} { display: none !important; }`)
    .join('\n');

const getStyleElement = () => document.getElementById(HIDDEN_RULES_STYLE_ID) as HTMLStyleElement | null;

const ensureStyleElement = () => {
  let styleElement = getStyleElement();
  if (styleElement) {
    return styleElement;
  }
  styleElement = document.createElement('style');
  styleElement.id = HIDDEN_RULES_STYLE_ID;
  styleElement.setAttribute('data-ladybird-hidden-rules', 'true');
  const parent = document.head || document.documentElement;
  parent.appendChild(styleElement);
  return styleElement;
};

export const clearHiddenRulesStyle = () => {
  getStyleElement()?.remove();
};

const applyHiddenRules = (rules: RuntimeHiddenRule[]) => {
  const cssText = buildHiddenCss(rules);
  if (!cssText.trim()) {
    clearHiddenRulesStyle();
    return;
  }
  const styleElement = ensureStyleElement();
  styleElement.textContent = cssText;
};

export const rehydratePersistedHiddenRules = async () => {
  if (window.top !== window) {
    return;
  }
  const siteKey = deriveSiteKeyFromUrl(window.location.href);
  if (!siteKey) {
    clearHiddenRulesStyle();
    return;
  }
  try {
    const data = await getSiteData(siteKey);
    const hiddenRules = (Array.isArray(data.hidden) ? data.hidden : [])
      .map((rule) => normalizeHiddenRule(rule as StructuredHiddenRecord, siteKey))
      .filter((rule): rule is RuntimeHiddenRule => Boolean(rule))
      .filter((rule) => rule.siteKey === siteKey);
    applyHiddenRules(hiddenRules);
  } catch (error) {
    console.warn('Failed to rehydrate persisted hidden rules', error);
    clearHiddenRulesStyle();
  }
};
