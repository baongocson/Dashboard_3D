import { describe, expect, it } from 'vitest';
import { datasetSchema } from '@dashboard/contracts';

import { importCsv } from '../src/csv/importCsv.js';

describe('importCsv integration', () => {
  const options = {
    encoding: 'utf-8' as const,
    delimiter: 'auto' as const,
    header: 'first-row' as const,
    additionalMissingTokens: ['NA'],
    confirmedHeaders: null,
  };

  it('imports a semicolon CSV automatically', async () => {
    const file = new Blob(['id;name;age;active\n001;An;20;true\n002;Binh;21;false']);

    const dataset = await importCsv(file, options, 'version-1');

    expect(datasetSchema.safeParse(dataset).success).toBe(true);
    expect(dataset.columns.map((column) => column.type)).toEqual([
      'text',
      'text',
      'number',
      'boolean',
    ]);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]?.cells['column-1']).toBe('001');
    expect(dataset.rows[0]?.cells['column-3']).toBe(20);
  });

  it('handles missing tokens in an imported file', async () => {
    const file = new Blob(['name,age\nAn,NA\nBinh,21']);

    const dataset = await importCsv(file, options, 'version-2');

    expect(dataset.rows[0]?.cells['column-2']).toBeNull();
    expect(dataset.rows[1]?.cells['column-2']).toBe(21);
  });

  it('rejects invalid import options', async () => {
    const file = new Blob(['name,age\nAn,20']);

    await expect(
      importCsv(
        file,
        {
          ...options,
          encoding: 'latin1' as 'utf-8',
        },
        'version-3',
      ),
    ).rejects.toThrow();
  });

  it('rejects CSV with duplicate headers', async () => {
    const file = new Blob(['name,name\nAn,Binh']);

    await expect(importCsv(file, options, 'version-4')).rejects.toThrow('Tên cột rỗng hoặc trùng');
  });

  it('rejects invalid UTF-8 content', async () => {
    const file = new Blob([new Uint8Array([0xc3, 0x28])]);

    await expect(importCsv(file, options, 'version-5')).rejects.toThrow('Invalid UTF-8 encoding');
  });

  it('preserves identifiers and unsafe integers as text', async () => {
    const file = new Blob(['id,value\n001,9007199254740993\n002,9007199254740995']);

    const dataset = await importCsv(file, options, 'version-6');

    expect(dataset.columns.map((column) => column.type)).toEqual(['text', 'text']);

    expect(dataset.rows[0]?.cells['column-1']).toBe('001');
    expect(dataset.rows[0]?.cells['column-2']).toBe('9007199254740993');
  });

  it('rejects rows with missing or extra columns', async () => {
    const file = new Blob(['a,b\n1,2\n3,4,5']);

    await expect(importCsv(file, options, 'version-7')).rejects.toThrow(
      'Line 3: expected 2 columns, received 3',
    );
  });

  it('preserves quoted multiline fields', async () => {
    const file = new Blob(['id;note\n001;"first line\nsecond, line"\n002;ok']);

    const dataset = await importCsv(file, options, 'version-8');

    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]?.cells['column-2']).toBe('first line\nsecond, line');
  });
});
