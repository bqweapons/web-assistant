export const AUTO_ADS_RULE_PREFIX = 'hidden-auto-ads-v1-';

export const AUTO_ADS_PRESETS = [
  { key: 'doubleclick-iframe', selector: 'iframe[src*="doubleclick.net"]' },
  { key: 'googlesyndication-iframe', selector: 'iframe[src*="googlesyndication.com"]' },
  { key: 'google-ads-id', selector: '[id*="google_ads"]' },
  { key: 'google-ad-class', selector: '[class*="google-ad"]' },
  { key: 'ad-prefix-id', selector: '[id^="ad-"]' },
  { key: 'ad-infix-id', selector: '[id*="-ad-"]' },
  { key: 'ad-prefix-class', selector: '[class^="ad-"]' },
  { key: 'ad-infix-class', selector: '[class*="-ad-"]' },
  { key: 'advert-class', selector: '[class*="advert"]' },
  { key: 'advert-id', selector: '[id*="advert"]' },
  { key: 'data-ad', selector: '[data-ad]' },
  { key: 'aria-label-advert', selector: '[aria-label*="advert"]' },
] as const;

export const AUTO_ADS_SELECTORS = AUTO_ADS_PRESETS.map((preset) => preset.selector);
