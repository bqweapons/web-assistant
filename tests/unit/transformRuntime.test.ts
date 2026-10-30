import { describe, expect, it } from 'vitest';
import { runSafeTransformCode } from '../../entrypoints/background/transformRuntime';

const run = (code: string, extra: Partial<Parameters<typeof runSafeTransformCode>[0]> = {}) =>
  runSafeTransformCode({ code, input: ' Hello ', nowTimestamp: 0, ...extra });

describe('runSafeTransformCode', () => {
  it('runs ordinary transforms', () => {
    expect(run('return helpers.upper(input)')).toBe(' HELLO ');
    expect(run('const name = row.name; return String(name)', { row: { name: 'Ann' } })).toBe('Ann');
    expect(run('return row["name"]', { row: { name: 'Bob' } })).toBe('Bob');
  });

  // REVIEW-FIXES 1.7: these reached the real Function constructor before the fix.
  it.each([
    'return String.constructor("return 1")()',
    'return String["constructor"]("return 1")()',
    'return String.prototype.constructor',
    'return String[("cons" + "tructor")]',
    'return helpers.trim.constructor',
    'return row.__proto__',
  ])('blocks sandbox escape: %s', (code) => {
    expect(() => run(code, { row: { a: '1' } })).toThrow(/Forbidden property access/);
  });

  it('rejects unsupported statements', () => {
    expect(() => run('fetch("https://example.com")')).toThrow();
  });
});
