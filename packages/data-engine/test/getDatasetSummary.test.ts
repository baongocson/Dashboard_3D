
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  getDatasetSummary,
} from '../src/stats/getDatasetSummary.js';

describe('getDatasetSummary', () => {
  it('counts rows, columns, and cells', () => {
    const dataset: Dataset = {
      versionId: 'v1',
      columns: [
        { id: 'c1', name: 'Name', type: 'text' },
        { id: 'c2', name: 'Age', type: 'number' },
      ],
      rows: [
        { id: 'r1', cells: { c1: 'An', c2: 20 } },
        { id: 'r2', cells: { c1: 'Binh', c2: 21 } },
      ],
    };

    expect(getDatasetSummary(dataset)).toEqual({
      rowCount: 2,
      columnCount: 2,
      cellCount: 4,
      missingCellCount: 0,
      nonMissingCellCount: 4,
    });
  });

  it('counts missing cells', () => {
    const dataset: Dataset = {
      versionId: 'v2',
      columns: [
        { id: 'c1', name: 'Name', type: 'text' },
        { id: 'c2', name: 'Age', type: 'number' },
      ],
      rows: [
        { id: 'r1', cells: { c1: 'An', c2: null } },
        { id: 'r2', cells: { c1: null, c2: 21 } },
      ],
    };

    expect(getDatasetSummary(dataset)).toEqual({
      rowCount: 2,
      columnCount: 2,
      cellCount: 4,
      missingCellCount: 2,
      nonMissingCellCount: 2,
    });
  });

  it('supports datasets with no rows', () => {
    const dataset: Dataset = {
      versionId: 'v3',
      columns: [
        { id: 'c1', name: 'Name', type: 'text' },
      ],
      rows: [],
    };

    expect(getDatasetSummary(dataset)).toEqual({
      rowCount: 0,
      columnCount: 1,
      cellCount: 0,
      missingCellCount: 0,
      nonMissingCellCount: 0,
    });
  });
});
