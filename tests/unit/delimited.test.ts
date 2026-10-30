import { describe, expect, it } from 'vitest';
import { extractDelimitedMeta, mapDelimitedRowsToObjects, parseDelimitedRows } from '../../shared/delimited';

describe('parseDelimitedRows', () => {
  it('handles quotes, escaped quotes, embedded newlines and CRLF', () => {
    const text = 'name,note\r\n"Doe, Jane","said ""hi""\nthen left"\r\nBob,ok\r\n';
    expect(parseDelimitedRows(text, ',')).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'said "hi"\nthen left'],
      ['Bob', 'ok'],
    ]);
  });

  it('drops blank rows and supports TSV', () => {
    expect(parseDelimitedRows('a\tb\n\n1\t2\n', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('extractDelimitedMeta', () => {
  it('reads header columns and counts data rows', () => {
    const meta = extractDelimitedMeta('email, name\nx@y.z,X\n', ',', true);
    expect(meta.columns).toEqual(['email', 'name']);
    expect(meta.rowCount).toBe(1);
  });

  it('names columns when there is no header', () => {
    const meta = extractDelimitedMeta('1,2\n3,4', ',', false);
    expect(meta.columns).toEqual(['column1', 'column2']);
    expect(meta.rowCount).toBe(2);
  });
});

describe('mapDelimitedRowsToObjects', () => {
  it('maps rows to objects and fills missing cells', () => {
    const { rows } = mapDelimitedRowsToObjects([['a', 'b'], ['1']], true);
    expect(rows).toEqual([{ a: '1', b: '' }]);
  });
});
