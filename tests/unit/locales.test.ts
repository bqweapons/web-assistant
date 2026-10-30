import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RUNNER_ERROR_MESSAGES } from '../../shared/runnerErrorMessages';

const load = (locale: string) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../public/_locales/${locale}/messages.json`), 'utf8'),
  ) as Record<string, { message: string }>;

describe('locales', () => {
  const locales = { en: load('en'), ja: load('ja'), zh_CN: load('zh_CN') };

  it('has a message for every runner error code in every locale', () => {
    for (const { messageKey } of Object.values(RUNNER_ERROR_MESSAGES)) {
      for (const [name, messages] of Object.entries(locales)) {
        expect(messages[messageKey]?.message, `${name}:${messageKey}`).toBeTruthy();
      }
    }
  });

  it('has no literal backslash-escaped quotes in messages', () => {
    for (const [name, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.message.includes('\\"'), `${name}:${key}`).toBe(false);
      }
    }
  });
});
