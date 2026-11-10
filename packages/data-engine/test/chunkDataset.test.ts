
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';
import { chunkDataset } from '../src/worker/chunkDataset.js';

describe('chunkDataset', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [{ id: 'c1', name: 'Age', type: 'number' }],
    rows: [
      { id: 'r1', cells: { c1: 10 } },
      { id: 'r2', cells: { c1: 20 } },
      { id: 'r3', cells: { c1: 30 } },
      { id: 'r4', cells: { c1: 40 } },
      { id: 'r5', cells: { c1: 50 } },
    ],
  };

  it('splits rows into chunks of the requested size', () => {
    const chunks = chunkDataset(dataset, 2);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.rows.length)).toEqual([2, 2, 1]);
  });

  it('preserves row order and chunk boundaries', () => {
    const chunks = chunkDataset(dataset, 2);

    expect(chunks.map((chunk) => [chunk.start, chunk.end])).toEqual([
      [0, 2],
      [2, 4],
      [4, 5],
    ]);

    expect(chunks.flatMap((chunk) => chunk.rows.map((row) => row.id))).toEqual([
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
    ]);
  });

  it('returns no chunks for an empty dataset', () => {
    const emptyDataset: Dataset = { ...dataset, rows: [] };

    expect(chunkDataset(emptyDataset, 2)).toEqual([]);
  });

  it('rejects invalid chunk sizes', () => {
    expect(() => chunkDataset(dataset, 0)).toThrow();
    expect(() => chunkDataset(dataset, -1)).toThrow();
    expect(() => chunkDataset(dataset, 1.5)).toThrow();
    expect(() => chunkDataset(dataset, Number.POSITIVE_INFINITY)).toThrow();
  });

  it('does not modify the original dataset', () => {
    const originalRows = [...dataset.rows];

    chunkDataset(dataset, 2);

    expect(dataset.rows).toEqual(originalRows);
  });
});
