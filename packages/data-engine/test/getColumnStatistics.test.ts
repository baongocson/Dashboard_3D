
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  getColumnStatistics,
} from '../src/stats/getColumnStatistics.js';

describe('getColumnStatistics', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [
      { id: 'c1', name: 'Name', type: 'text' },
      { id: 'c2', name: 'Age', type: 'number' },
    ],
    rows: [
      { id: 'r1', cells: { c1: 'An', c2: 20 } },
      { id: 'r2', cells: { c1: 'Binh', c2: 25 } },
      { id: 'r3', cells: { c1: 'An', c2: null } },
      { id: 'r4', cells: { c1: null, c2: 30 } },
    ],
  };

  it('calculates numeric statistics', () => {
    expect(getColumnStatistics(dataset, 'c2')).toEqual({
      columnId: 'c2',
      columnName: 'Age',
      columnType: 'number',
      totalCount: 4,
      missingCount: 1,
      validCount: 3,
      uniqueCount: 3,
      min: 20,
      max: 30,
      mean: 25,
    });
  });

  it('calculates text column statistics', () => {
    expect(getColumnStatistics(dataset, 'c1')).toEqual({
      columnId: 'c1',
      columnName: 'Name',
      columnType: 'text',
      totalCount: 4,
      missingCount: 1,
      validCount: 3,
      uniqueCount: 2,
      min: null,
      max: null,
      mean: null,
    });
  });

  it('throws an error for unknown columns', () => {
    expect(() =>
      getColumnStatistics(dataset, 'unknown'),
    ).toThrow('Column not found: unknown');
  });

  it('handles numeric columns containing only null', () => {
    const emptyDataset: Dataset = {
      versionId: 'v2',
      columns: [
        { id: 'c1', name: 'Value', type: 'number' },
      ],
      rows: [
        { id: 'r1', cells: { c1: null } },
        { id: 'r2', cells: { c1: null } },
      ],
    };

    const result = getColumnStatistics(emptyDataset, 'c1');

    expect(result.missingCount).toBe(2);
    expect(result.uniqueCount).toBe(0);
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
    expect(result.mean).toBeNull();
  });

it('handles large numeric datasets without argument limits', () => {
  const largeDataset: Dataset = {
    versionId: 'large-v1',
    columns: [
      { id: 'c1', name: 'Value', type: 'number' },
    ],
    rows: Array.from({ length: 100_000 }, (_, index) => ({
      id: `row-${String(index)}`,
      cells: { c1: index + 1 },
    })),
  };

  const result = getColumnStatistics(largeDataset, 'c1');

  expect(result.totalCount).toBe(100_000);
  expect(result.uniqueCount).toBe(100_000);
  expect(result.min).toBe(1);
  expect(result.max).toBe(100_000);
  expect(result.mean).toBeCloseTo(50_000.5);
});

});
