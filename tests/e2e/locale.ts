import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The browser UI language decides chrome.i18n output on the page, and it can
// follow the OS language. Match a message in any of the shipped locales.
const locales = ['en', 'ja', 'zh_CN'].map(
  (locale) =>
    JSON.parse(
      fs.readFileSync(path.resolve(HERE, `../../public/_locales/${locale}/messages.json`), 'utf8'),
    ) as Record<string, { message: string }>,
);

export const anyLocale = (key: string, vars: Record<string, string> = {}) =>
  locales.map((messages) => {
    let text = messages[key]?.message ?? '';
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(value);
    }
    return text;
  });

export const matchesAnyLocale = (actual: string, key: string, vars?: Record<string, string>) =>
  anyLocale(key, vars).some((text) => text && actual.includes(text));
