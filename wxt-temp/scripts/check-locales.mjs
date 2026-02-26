import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const LOCALES_ROOT = path.join(ROOT, 'public', '_locales');
const LOCALES = ['en', 'ja', 'zh_CN'];
const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;
const BROKEN_QUESTION_RUN_RE = /\?{4,}/;

function fail(message) {
  console.error(`i18n:check failed: ${message}`);
  process.exitCode = 1;
}

function readLocaleJson(locale) {
  const filePath = path.join(LOCALES_ROOT, locale, 'messages.json');
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`unable to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`locale file ${filePath} must be an object`);
    return null;
  }

  for (const [key, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`${filePath} key "${key}" must be an object with a "message" string`);
      continue;
    }
    if (typeof entry.message !== 'string') {
      fail(`${filePath} key "${key}" must have a string "message"`);
    }
  }

  return { filePath, data: parsed };
}

function getPlaceholderSet(message) {
  return new Set(message.match(PLACEHOLDER_RE) ?? []);
}

function setsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

function formatSet(set) {
  return [...set].sort().join(', ') || '(none)';
}

function validateLocaleContent(locale, localeObj, enObj) {
  const { filePath, data } = localeObj;
  const isNonEnglish = locale !== 'en';

  for (const [key, entry] of Object.entries(data)) {
    const message = typeof entry?.message === 'string' ? entry.message : '';
    const enMessage = typeof enObj.data[key]?.message === 'string' ? enObj.data[key].message : '';

    if (isNonEnglish && message.includes('\uFFFD')) {
      fail(`${filePath} key "${key}" contains replacement character (�)`);
    }
    if (isNonEnglish && BROKEN_QUESTION_RUN_RE.test(message)) {
      fail(`${filePath} key "${key}" contains suspicious "????" sequence`);
    }
    if (enMessage !== '' && message === '') {
      fail(`${filePath} key "${key}" has empty message while en is non-empty`);
    }

    if (enMessage !== '') {
      const enPlaceholders = getPlaceholderSet(enMessage);
      const localePlaceholders = getPlaceholderSet(message);
      if (!setsEqual(enPlaceholders, localePlaceholders)) {
        fail(
          `${filePath} key "${key}" placeholder mismatch (en=${formatSet(enPlaceholders)} ${locale}=${formatSet(localePlaceholders)})`,
        );
      }
    }
  }
}

function validateKeyParity(baseLocale, baseObj, locale, localeObj) {
  const baseKeys = new Set(Object.keys(baseObj.data));
  const localeKeys = new Set(Object.keys(localeObj.data));
  const missing = [...baseKeys].filter((key) => !localeKeys.has(key)).sort();
  const extra = [...localeKeys].filter((key) => !baseKeys.has(key)).sort();

  if (missing.length) {
    fail(`${localeObj.filePath} missing keys vs ${baseLocale}: ${missing.join(', ')}`);
  }
  if (extra.length) {
    fail(`${localeObj.filePath} extra keys vs ${baseLocale}: ${extra.join(', ')}`);
  }
}

function main() {
  const localeObjects = Object.fromEntries(LOCALES.map((locale) => [locale, readLocaleJson(locale)]));
  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  const en = localeObjects.en;
  for (const locale of LOCALES) {
    const localeObj = localeObjects[locale];
    validateKeyParity('en', en, locale, localeObj);
    validateLocaleContent(locale, localeObj, en);
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
  console.log(`i18n:check passed (${LOCALES.join(', ')})`);
}

main();
