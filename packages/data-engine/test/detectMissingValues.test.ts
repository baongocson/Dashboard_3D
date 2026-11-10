
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  detectMissingValues,
} from '../src/missing/detectMissingValues.js';

describe('detectMissingValues', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [
      { id: 'c1', name: 'Name', type: 'text' },
      { id: 'c2', name: 'Age', type: 'number' },
      { id: 'c3', name: 'City', type: 'text' },
    ],
    rows: [
      {
        id: 'r1',
        cells: { c1: 'An', c2: 20, c3: 'HCM' },
      },
      {
        id: 'r2',
        cells: { c1: 'Binh', c2: null, c3: 'Ha Noi' },
      },
      {
        id: 'r3',
        cells: { c1: 'Chi', c2: 22, c3: null },
      },
    ],
  };

  it('detects missing cells', () => {
    const report = detectMissingValues(dataset);

    expect(report.totalMissingCells).toBe(2);
    expect(report.totalCells).toBe(9);
    expect(report.missingCells).toEqual([
      { rowId: 'r2', columnId: 'c2' },
      { rowId: 'r3', columnId: 'c3' },
    ]);
  });

  it('calculates missing percentages', () => {
    const report = detectMissingValues(dataset);

    expect(report.missingPercentage).toBeCloseTo(
      (2 / 9) * 100,
    );

    expect(report.columns[1]?.missingPercentage).toBeCloseTo(
      100 / 3,
    );

    expect(report.columns[2]?.missingPercentage).toBeCloseTo(
      100 / 3,
    );
  });

  it('does not modify the original dataset', () => {
    const original = structuredClone(dataset);

    detectMissingValues(dataset);

    expect(dataset).toEqual(original);
  });

  it('handles datasets with no rows', () => {
    const emptyDataset: Dataset = {
      versionId: 'empty',
      columns: [
        { id: 'c1', name: 'Value', type: 'number' },
      ],
      rows: [],
    };

    const report = detectMissingValues(emptyDataset);

    expect(report.totalMissingCells).toBe(0);
    expect(report.totalCells).toBe(0);
    expect(report.missingPercentage).toBe(0);
    expect(report.columns[0]?.missingPercentage).toBe(0);
  });
});
