import { describe, expect, it } from 'vitest';
import { datasetSchema } from '@dashboard/contracts';

import { parseCsv } from '../src/csv/parseCsv.js';
import { createDataset, CsvDatasetError } from '../src/csv/createDataset.js';

describe('createDataset', () => {
  it('creates a valid dataset from CSV headers', () => {
    const parsed = parseCsv('id,name\n001,An\n002,Binh', ',');

    const dataset = createDataset(parsed, {
      header: 'first-row',
      versionId: 'version-1',
    });

    expect(datasetSchema.safeParse(dataset).success).toBe(true);
    expect(dataset.columns.map((column) => column.name)).toEqual(['id', 'name']);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]?.cells['column-1']).toBe('001');
  });

  it('generates column names when headers are absent', () => {
    const parsed = parseCsv('An,20\nBinh,21', ',');

    const dataset = createDataset(parsed, {
      header: 'generated',
      versionId: 'version-1',
    });

    expect(dataset.columns.map((column) => column.name)).toEqual(['column_1', 'column_2']);
    expect(dataset.rows).toHaveLength(2);
  });

  it('converts blank cells to null', () => {
    const parsed = parseCsv('name,age\nAn,\nBinh, ', ',');

    const dataset = createDataset(parsed, {
      header: 'first-row',
      versionId: 'version-1',
    });

    expect(dataset.rows[0]?.cells['column-2']).toBeNull();
    expect(dataset.rows[1]?.cells['column-2']).toBeNull();
  });

  it('rejects duplicate column names', () => {
    const parsed = parseCsv('name,name\nAn,Binh', ',');

    expect(() =>
      createDataset(parsed, {
        header: 'first-row',
        versionId: 'version-1',
      }),
    ).toThrow(CsvDatasetError);
  });

  it('rejects rows with incorrect column counts', () => {
    const parsed = parseCsv('a,b\n1,2\n3,4,5', ',');

    expect(() =>
      createDataset(parsed, {
        header: 'first-row',
        versionId: 'version-1',
      }),
    ).toThrow('Line 3: expected 2 columns, received 3');
  });

  it('supports confirmed column names', () => {
    const parsed = parseCsv('a,b\n1,2', ',');

    const dataset = createDataset(parsed, {
      header: 'first-row',
      versionId: 'version-1',
      confirmedHeaders: ['Name', 'Value'],
    });

    expect(dataset.columns.map((column) => column.name)).toEqual(['Name', 'Value']);
  });

  it('infers numeric and boolean columns', () => {
    const parsed = parseCsv('id,age,active\n001,20,true\n002,21,false', ',');

    const dataset = createDataset(parsed, {
      header: 'first-row',
      versionId: 'version-1',
    });

    expect(dataset.columns.map((column) => column.type)).toEqual(['text', 'number', 'boolean']);

    expect(dataset.rows[0]?.cells['column-1']).toBe('001');
    expect(dataset.rows[0]?.cells['column-2']).toBe(20);
    expect(dataset.rows[0]?.cells['column-3']).toBe(true);
  });

  it('handles additional missing tokens', () => {
    const parsed = parseCsv('name,age\nAn,NA\nBinh,21', ',');

    const dataset = createDataset(parsed, {
      header: 'first-row',
      versionId: 'version-1',
      additionalMissingTokens: ['NA'],
    });

    expect(dataset.columns[1]?.type).toBe('number');
    expect(dataset.rows[0]?.cells['column-2']).toBeNull();
    expect(dataset.rows[1]?.cells['column-2']).toBe(21);
  });

  it('preserves unsafe integers as text', () => {
    const parsed = parseCsv('id,value\n001,9007199254740993', ',');

    const dataset = createDataset(parsed, {
      header: 'first-row',
      versionId: 'version-1',
    });

    expect(dataset.columns[1]?.type).toBe('text');
    expect(dataset.rows[0]?.cells['column-2']).toBe('9007199254740993');
  });
});
