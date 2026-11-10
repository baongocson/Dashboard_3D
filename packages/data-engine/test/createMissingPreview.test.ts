import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import { createMissingPreview } from '../src/missing/createMissingPreview.js';

describe('createMissingPreview', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [
      { id: 'c1', name: 'Name', type: 'text' },
      { id: 'c2', name: 'Age', type: 'number' },
    ],
    rows: [
      { id: 'r1', cells: { c1: 'An', c2: null } },
      { id: 'r2', cells: { c1: null, c2: 21 } },
      { id: 'r3', cells: { c1: 'Chi', c2: null } },
    ],
  };

  it('creates preview items with row and column positions', () => {
    const preview = createMissingPreview(dataset);

    expect(preview.totalMissingCells).toBe(3);
    expect(preview.items).toEqual([
      {
        rowId: 'r2',
        rowIndex: 1,
        columnId: 'c1',
        columnName: 'Name',
        columnIndex: 0,
      },
      {
        rowId: 'r1',
        rowIndex: 0,
        columnId: 'c2',
        columnName: 'Age',
        columnIndex: 1,
      },
      {
        rowId: 'r3',
        rowIndex: 2,
        columnId: 'c2',
        columnName: 'Age',
        columnIndex: 1,
      },
    ]);
    expect(preview.hasMore).toBe(false);
  });

  it('limits the number of preview items', () => {
    const preview = createMissingPreview(dataset, 2);

    expect(preview.totalMissingCells).toBe(3);
    expect(preview.items).toHaveLength(2);
    expect(preview.hasMore).toBe(true);
  });

  it('supports a zero-item preview', () => {
    const preview = createMissingPreview(dataset, 0);

    expect(preview.items).toEqual([]);
    expect(preview.totalMissingCells).toBe(3);
    expect(preview.hasMore).toBe(true);
  });

  it('rejects invalid limits', () => {
    expect(() => createMissingPreview(dataset, -1)).toThrow();
    expect(() => createMissingPreview(dataset, 1.5)).toThrow();
    expect(() => createMissingPreview(dataset, Number.NaN)).toThrow();
  });

  it('does not modify the original dataset', () => {
    const original = structuredClone(dataset);

    createMissingPreview(dataset);

    expect(dataset).toEqual(original);
  });
});
