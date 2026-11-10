import { describe, expect, it } from 'vitest';
import { CsvParseError, parseCsv } from '../src/csv/parseCsv.js';

describe('parseCsv', () => {
  it('parses a basic comma-separated CSV', () => {
    const result = parseCsv('id,value\n001,2\n002,\n', ',');

    expect(result.records).toEqual([
      ['id', 'value'],
      ['001', '2'],
      ['002', ''],
    ]);

    expect(result.sourceLines).toEqual([1, 2, 3]);
  });

  it('supports BOM and semicolon delimiter', () => {
    const result = parseCsv('\uFEFFname;value\nAn;1\nBinh;2\n', ';');

    expect(result.records).toEqual([
      ['name', 'value'],
      ['An', '1'],
      ['Binh', '2'],
    ]);
  });

  it('supports quoted delimiters and newlines', () => {
    const result = parseCsv('name,value\n"An, Binh","line 1\nline 2"', ',');

    expect(result.records).toEqual([
      ['name', 'value'],
      ['An, Binh', 'line 1\nline 2'],
    ]);

    expect(result.sourceLines).toEqual([1, 2]);
  });

  it('skips empty lines but keeps empty fields', () => {
    const result = parseCsv('a,b\n\n,\n0, \n', ',');

    expect(result.records).toEqual([
      ['a', 'b'],
      ['', ''],
      ['0', ' '],
    ]);
  });

  it('rejects unclosed quoted fields', () => {
    expect(() => parseCsv('a,b\n"unfinished,2', ',')).toThrow(CsvParseError);
  });

  it('rejects unexpected text after closing quotes', () => {
    expect(() => parseCsv('a,b\n"hello"x,2', ',')).toThrow(CsvParseError);
  });
});
