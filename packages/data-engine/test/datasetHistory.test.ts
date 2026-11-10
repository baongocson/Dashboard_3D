import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  createDatasetHistory,
  getCurrentDataset,
  pushDatasetVersion,
  undoDataset,
  redoDataset,
} from '../src/history/datasetHistory.js';

describe('datasetHistory', () => {
  const v1: Dataset = {
    versionId: 'v1',
    columns: [{ id: 'c1', name: 'Age', type: 'number' }],
    rows: [{ id: 'r1', cells: { c1: null } }],
  };

  const v2: Dataset = {
    ...v1,
    versionId: 'v2',
    rows: [{ id: 'r1', cells: { c1: 25 } }],
  };

  const v3: Dataset = {
    ...v1,
    versionId: 'v3',
    rows: [{ id: 'r1', cells: { c1: 30 } }],
  };

  it('creates history with an initial version', () => {
    const history = createDatasetHistory(v1);

    expect(history.currentIndex).toBe(0);
    expect(history.versions).toHaveLength(1);
    expect(getCurrentDataset(history).versionId).toBe('v1');
  });

  it('pushes a new dataset version', () => {
    const history = pushDatasetVersion(createDatasetHistory(v1), v2);

    expect(history.currentIndex).toBe(1);
    expect(history.versions).toHaveLength(2);
    expect(getCurrentDataset(history).versionId).toBe('v2');
  });

  it('undoes and redoes changes', () => {
    const history = pushDatasetVersion(createDatasetHistory(v1), v2);

    const undone = undoDataset(history);
    expect(getCurrentDataset(undone).versionId).toBe('v1');

    const redone = redoDataset(undone);
    expect(getCurrentDataset(redone).versionId).toBe('v2');
  });

  it('removes the redo branch when a new version is pushed', () => {
    const history = pushDatasetVersion(createDatasetHistory(v1), v2);

    const undone = undoDataset(history);
    const updated = pushDatasetVersion(undone, v3);

    expect(updated.versions.map((item) => item.versionId)).toEqual(['v1', 'v3']);
    expect(updated.currentIndex).toBe(1);
  });

  it('does not allow duplicate version IDs', () => {
    const history = createDatasetHistory(v1);

    expect(() => pushDatasetVersion(history, v1)).toThrow();
  });

  it('does not expose mutable internal datasets', () => {
    const history = createDatasetHistory(v1);
    const current = getCurrentDataset(history);

    const firstRow = current.rows[0];

    expect(firstRow).toBeDefined();

    if (firstRow === undefined) {
      throw new Error('Expected first row to exist');
    }

    firstRow.cells['c1'] = 99;

    expect(getCurrentDataset(history).rows[0]?.cells['c1']).toBeNull();
  });
});
