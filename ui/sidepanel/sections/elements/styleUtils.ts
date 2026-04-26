// Style helpers extracted from ElementsSection. Pure functions — no React
// or DOM side effects beyond the single `colorToHex` path which temporarily
// mounts a probe element to resolve CSS color keywords.

export type StylePreset = {
  value: string;
  label: string;
  styles: Record<string, string> | null;
};

export const detectStylePreset = (
  stylePresets: StylePreset[],
  style: Record<string, string> = {},
) => {
  const normalized = Object.keys(style).reduce<Record<string, string>>((acc, key) => {
    acc[key] = typeof style[key] === 'string' ? style[key].trim() : '';
    return acc;
  }, {});
  const match = stylePresets.find((preset) => {
    if (!preset.styles) {
      return false;
    }
    const entries = Object.entries(preset.styles);
    if (entries.length === 0) {
      return false;
    }
    return entries.every(([key, value]) => (normalized[key] || '').trim() === (value || '').trim());
  });
  return match?.value || '';
};

export const toKebabCase = (value: string) =>
  value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

export const formatCustomCss = (
  rules: Record<string, string>,
  customCssOrder: readonly string[],
) => {
  const entries: string[] = [];
  const used = new Set<string>();
  const pushEntry = (key: string) => {
    const rawValue = rules[key];
    if (!rawValue) {
      return;
    }
    const value = rawValue.trim();
    if (!value) {
      return;
    }
    entries.push(`${toKebabCase(key)}: ${value};`);
    used.add(key);
  };
  customCssOrder.forEach(pushEntry);
  Object.keys(rules).forEach((key) => {
    if (!used.has(key)) {
      pushEntry(key);
    }
  });
  return entries.join('\n');
};

export const parseCustomCss = (raw: string) => {
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

export const getNumericValue = (value: string) => {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : '';
};

export const normalizeHex = (raw: string) => {
  const value = raw.trim();
  if (!value.startsWith('#')) {
    return '';
  }
  const hex = value.slice(1);
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((ch) => `${ch}${ch}`)
      .join('')}`;
  }
  if (hex.length === 4) {
    return `#${hex
      .slice(0, 3)
      .split('')
      .map((ch) => `${ch}${ch}`)
      .join('')}`;
  }
  if (hex.length === 6) {
    return `#${hex}`;
  }
  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`;
  }
  return '';
};

export const colorToHex = (value: string) => {
  const normalized = value.trim();
  const hex = normalizeHex(normalized);
  if (hex) {
    return hex;
  }
  if (!normalized) {
    return '';
  }
  if (typeof document === 'undefined') {
    return '';
  }
  const test = document.createElement('div');
  test.style.color = '';
  test.style.color = normalized;
  if (!test.style.color) {
    return '';
  }
  document.body.appendChild(test);
  const rgb = getComputedStyle(test).color;
  test.remove();
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/);
  if (!match) {
    return '';
  }
  const [, r, g, b, a] = match;
  if (a !== undefined && Number(a) === 0) {
    return '';
  }
  const toHex = (num: string) => Number(num).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const resolveColorValue = (value: string, fallback: string) => {
  const hex = colorToHex(value);
  if (hex) {
    return hex;
  }
  const fallbackHex = colorToHex(fallback);
  if (fallbackHex) {
    return fallbackHex;
  }
  return '#ffffff';
};
