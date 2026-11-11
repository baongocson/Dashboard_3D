import { describe, expect, it } from 'vitest';
import { MAX_CSV_BYTES } from '@dashboard/contracts';
import { defaultCsvOptions, validateCsvInput } from './csvInput';

describe('Collection input preflight', () => {
  const options = defaultCsvOptions();
  it('has the expected contract defaults', () => {
    expect(options).toEqual({
      encoding: 'utf-8',
      delimiter: 'auto',
      header: 'first-row',
      additionalMissingTokens: [],
      confirmedHeaders: null,
    });
  });
  it('requires a selected file', () => {
    expect(validateCsvInput(null, options)).toMatch(/select/i);
  });
  it('rejects empty files and non-csv files', () => {
    expect(validateCsvInput({ name: 'data.csv', size: 0 }, options)).toMatch(/empty/i);
    expect(validateCsvInput({ name: 'data.xlsx', size: 10 }, options)).toMatch(/csv/i);
  });
  it('allows the exact byte limit and blocks one byte above', () => {
    expect(validateCsvInput({ name: 'dataset.CSV', size: MAX_CSV_BYTES }, options)).toBeNull();
    expect(validateCsvInput({ name: 'dataset.csv', size: MAX_CSV_BYTES + 1 }, options)).toMatch(
      /exceeds/i,
    );
  });
  it('allows optional missing tokens from the contract', () => {
    expect(
      validateCsvInput(
        { name: 'data.csv', size: 10 },
        { ...options, additionalMissingTokens: ['NA', '-'] },
      ),
    ).toBeNull();
  });
});
