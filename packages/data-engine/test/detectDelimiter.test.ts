
import { describe, expect, it } from 'vitest';
import { detectDelimiter } from '../src/csv/detectDelimiter.js';

describe('detectDelimiter', () => {
  it('detects comma delimiter', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('detects semicolon delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('detects tab delimiter', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('ignores delimiters inside quoted values', () => {
    expect(
      detectDelimiter('name;description\nAn;"hello, world"'),
    ).toBe(';');
  });

  it('defaults to comma when no delimiter is found', () => {
    expect(detectDelimiter('singlecolumn\nvalue')).toBe(',');
  });

  it('supports multiline quoted fields', () => {
    expect(
      detectDelimiter(
        'name;note\nAn;"first line\nsecond, line"\nBinh;ok',
      ),
    ).toBe(';');
  });
});
