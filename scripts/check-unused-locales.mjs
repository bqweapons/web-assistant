import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const LOCALES_ROOT = path.join(ROOT, 'public', '_locales');
const BASE_LOCALE = 'en';
const SCAN_DIRS = ['entrypoints', 'ui', 'shared', 'components', 'types', 'scripts'];
const SCAN_FILES = ['wxt.config.ts', 'package.json'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html']);

const STRING_KEY_PATTERNS = [
  /\bt\(\s*'([^']+)'/g,
  /\bt\(\s*"([^"]+)"/g,
  /chrome\.i18n\.getMessage\(\s*'([^']+)'/g,
  /chrome\.i18n\.getMessage\(\s*"([^"]+)"/g,
  /\b[A-Za-z0-9_]*(?:I18nMessage|getMessage)\(\s*'([^']+)'/g,
  /\b[A-Za-z0-9_]*(?:I18nMessage|getMessage)\(\s*"([^"]+)"/g,
  /__MSG_([A-Za-z0-9_]+)__/g,
  /\b[A-Za-z0-9_]+Key\s*:\s*'([^']+)'/g,
  /\b[A-Za-z0-9_]+Key\s*:\s*"([^"]+)"/g,
];

function fail(message) {
  console.error(`i18n:unused-check failed: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`unable to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function addMatches(text, usedKeys) {
  for (const pattern of STRING_KEY_PATTERNS) {
    let match;
    while ((match = pattern.exec(text))) {
      usedKeys.add(match[1]);
    }
  }
}

function walkForUsedKeys(targetPath, usedKeys) {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      walkForUsedKeys(path.join(targetPath, entry), usedKeys);
    }
    return;
  }

  if (!SCAN_EXTENSIONS.has(path.extname(targetPath))) {
    return;
  }

  const text = fs.readFileSync(targetPath, 'utf8');
  addMatches(text, usedKeys);
}

function main() {
  const baseFile = path.join(LOCALES_ROOT, BASE_LOCALE, 'messages.json');
  const baseLocale = readJson(baseFile);
  if (!baseLocale || typeof baseLocale !== 'object' || Array.isArray(baseLocale)) {
    fail(`base locale ${baseFile} must be an object`);
    process.exit(process.exitCode || 1);
  }

  const usedKeys = new Set();
  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(ROOT, dir);
    if (fs.existsSync(fullDir)) {
      walkForUsedKeys(fullDir, usedKeys);
    }
  }
  for (const file of SCAN_FILES) {
    const fullFile = path.join(ROOT, file);
    if (fs.existsSync(fullFile)) {
      walkForUsedKeys(fullFile, usedKeys);
    }
  }

  const localeKeys = Object.keys(baseLocale);
  const unused = localeKeys.filter((key) => !usedKeys.has(key)).sort();

  if (unused.length > 0) {
    fail(`${unused.length} unused locale key(s) found in ${baseFile}`);
    for (const key of unused) {
      console.error(`  - ${key}`);
    }
    process.exit(process.exitCode || 1);
  }

  console.log(`i18n:unused-check passed (0 unused keys in ${BASE_LOCALE})`);
}

main();
