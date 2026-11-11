import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';
import { boxSummary, missingByColumn } from './chartSummary';
const data = (values: (number | null)[]): Dataset => ({
  versionId: 'fixture',
  columns: [{ id: 'x', name: 'x', type: 'number' }],
  rows: values.map((x, i) => ({ id: String(i), cells: { x } })),
});
describe('Collection summary across every source row', () => {
  it('counts only null, including zero-height bars', () => {
    const input: Dataset = {
      versionId: 'missing-fixture',
      columns: [
        { id: 'n', name: 'n', type: 'number' },
        { id: 'b', name: 'b', type: 'boolean' },
        { id: 's', name: 's', type: 'text' },
      ],
      rows: [
        { id: 'a', cells: { n: 0, b: false, s: '' } },
        { id: 'b', cells: { n: null, b: false, s: null } },
      ],
    };
    expect(missingByColumn(input).map((c) => [c.count, c.percent])).toEqual([
      [1, 50],
      [0, 0],
      [1, 50],
    ]);
    expect(
      missingByColumn({ ...input, rows: [] }).every((c) => c.count === 0 && c.percent === 0),
    ).toBe(true);
  });
  it('uses system linear quartiles and observed whiskers, not fences', () => {
    const result = boxSummary(data([1, 2, 3, 4, 5, 100, null]), 'x');
    expect(result.stats).toEqual({
      q1: 2.25,
      q2: 3.5,
      q3: 4.75,
      low: 1,
      high: 5,
      min: 1,
      max: 100,
    });
    expect(result.valid).toBe(6);
    expect(result.missing).toBe(1);
    expect(result.outliers.map((v) => v.value)).toEqual([100]);
  });
  it('handles empty, singleton, constant and zero-IQR outliers', () => {
    expect(boxSummary(data([null, null]), 'x').stats).toBeNull();
    expect(boxSummary(data([7]), 'x').stats).toEqual({
      q1: 7,
      q2: 7,
      q3: 7,
      low: 7,
      high: 7,
      min: 7,
      max: 7,
    });
    expect(boxSummary(data([7, 7, 7]), 'x').outliers).toEqual([]);
    expect(boxSummary(data([0, 0, 0, 0, 10]), 'x').outliers.map((v) => v.value)).toEqual([10]);
  });
});
