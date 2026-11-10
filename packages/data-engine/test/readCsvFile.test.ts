
import { describe, expect, it } from 'vitest';
import { MAX_CSV_BYTES } from '@dashboard/contracts';

import {
  CsvFileError,
  readCsvFile,
} from '../src/csv/readCsvFile.js';

describe('readCsvFile', () => {
  it('reads a valid UTF-8 CSV file', async () => {
    const file = new Blob(['name,age\nAn,20'], {
      type: 'text/csv',
    });

    await expect(readCsvFile(file)).resolves.toBe(
      'name,age\nAn,20',
    );
  });

  it('supports Vietnamese UTF-8 characters', async () => {
    const file = new Blob(['name\nNguyễn Văn An']);

    await expect(readCsvFile(file)).resolves.toBe(
      'name\nNguyễn Văn An',
    );
  });

  it('removes UTF-8 BOM', async () => {
    const file = new Blob([
      new Uint8Array([0xef, 0xbb, 0xbf]),
      'name,age\nAn,20',
    ]);

    await expect(readCsvFile(file)).resolves.toBe(
      'name,age\nAn,20',
    );
  });

  it('rejects empty files', async () => {
    const file = new Blob([]);

    await expect(readCsvFile(file)).rejects.toThrow(
      CsvFileError,
    );
  });

  it('rejects files larger than 20 MB', async () => {
    const file = new Blob([
      new Uint8Array(MAX_CSV_BYTES + 1),
    ]);

    await expect(readCsvFile(file)).rejects.toThrow(
      'exceeds',
    );
  });

  it('rejects invalid UTF-8 bytes', async () => {
    const file = new Blob([
      new Uint8Array([0xc3, 0x28]),
    ]);

    await expect(readCsvFile(file)).rejects.toThrow(
      'Invalid UTF-8 encoding',
    );
  });
});
