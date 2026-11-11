import { describe, it, expect } from 'vitest';
import type { Dataset } from '@dashboard/contracts';
import { axisOptions, scatterRows, ticks, coordinate } from './scatterModel';
const data: Dataset = {
  versionId: 'known',
  columns: ['x', 'y', 'z', 'constant', 'missing']
    .map((id) => ({ id, name: id, type: 'number' as const }))
    .concat([]),
  rows: [
    { id: 'min', cells: { x: 10, y: -20, z: 100, constant: 7, missing: null } },
    { id: 'mid', cells: { x: 20, y: 0, z: 200, constant: 7, missing: null } },
    { id: 'max', cells: { x: 30, y: 20, z: 300, constant: 7, missing: null } },
    { id: 'invalid', cells: { x: null, y: NaN, z: Infinity, constant: 7, missing: null } },
  ],
};
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture value');
  return value;
}
const options = axisOptions(data);
const axes = ['x', 'y', 'z'].map((id) => required(options.find((a) => a.id === id)));
describe('scatter coordinates shared with ticks', () => {
  it('maps extrema and midpoint on every axis and preserves source rows when skipping invalid', () => {
    const result = scatterRows(data, axes);
    expect(result.points.map((p) => [p.rowId, p.index, p.position])).toEqual([
      ['min', 0, [-4, -4, -4]],
      ['mid', 1, [0, 0, 0]],
      ['max', 2, [4, 4, 4]],
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain('Z');
    for (const a of axes) for (const t of ticks(a)) expect(coordinate(t.value, a)).toBe(t.position);
  });
  it('updates coordinate order when axes change, including reversed direction of source values', () => {
    const changed = {
      ...data,
      rows: data.rows.map((r, i) => ({
        ...r,
        cells: { ...r.cells, z: i < 3 ? 300 - i * 100 : null },
      })),
    };
    const opts = axisOptions(changed);
    const swapped = ['z', 'x', 'y'].map((id) => required(opts.find((a) => a.id === id)));
    expect(scatterRows(changed, swapped).points.map((p) => p.position)).toEqual([
      [4, -4, -4],
      [0, 0, 0],
      [-4, 4, 4],
    ]);
  });
  it('handles constant, all missing and nonfinite values without substituting zero', () => {
    const constant = required(options.find((a) => a.id === 'constant'));
    expect(ticks(constant)).toEqual([{ value: 7, position: 0 }]);
    const empty = required(options.find((a) => a.id === 'missing'));
    expect(ticks(empty)).toEqual([]);
    expect(scatterRows(data, [empty, constant, required(axes[0])]).points).toEqual([]);
  });
  it('never coerces text and uses explicit text length; reordered rows retain identity', () => {
    const text: Dataset = {
      versionId: 'text',
      columns: [{ id: 'app', name: 'App', type: 'text' }],
      rows: [
        { id: 'a', cells: { app: '001' } },
        { id: 'b', cells: { app: 'Ứng dụng 😀' } },
      ],
    };
    const opts = axisOptions(text);
    expect(opts.map((a) => a.id)).toEqual(['__row', 'length:app']);
    expect(opts[1]?.values).toEqual([3, 10]);
    const sorted = {
      ...data,
      rows: [required(data.rows[2]), required(data.rows[0]), required(data.rows[1])],
    };
    const sortedOptions = axisOptions(sorted);
    expect(
      scatterRows(
        sorted,
        ['x', 'y', 'z'].map((id) => required(sortedOptions.find((a) => a.id === id))),
      ).points.map((p) => p.rowId),
    ).toEqual(['max', 'min', 'mid']);
  });
});

import { missingPointColor } from './scatterModel';
it('uses the same scatter coordinates regardless of missing fields outside XYZ', () => {
  const input: Dataset = {
    ...data,
    columns: [...data.columns, { id: 'note', name: 'Note', type: 'text' }],
    rows: data.rows.map((r, i) => ({ ...r, cells: { ...r.cells, note: i === 0 ? null : 'ok' } })),
  };
  const model = scatterRows(input, axes);
  expect(model.points.map((p) => p.position)).toEqual([
    [-4, -4, -4],
    [0, 0, 0],
    [4, 4, 4],
  ]);
  expect(model.rejected.map((r) => r.rowId)).toEqual(['invalid']);
  expect(model.points.every((p) => p.position.every((v) => v >= -4 && v <= 4))).toBe(true);
});
it('uses blue for complete rows and progressively darker orange for missing values', () => {
  expect(missingPointColor(0, 4)).toBe('#38bdf8');
  expect(missingPointColor(1, 4)).toBe('rgb(239, 178, 131)');
  expect(missingPointColor(2, 4)).toBe('rgb(224, 140, 91)');
  expect(missingPointColor(4, 4)).toBe('rgb(194, 65, 12)');
});
