import { describe, it, expect } from 'vitest';
import { createDataset } from '../src/csv/createDataset';
import { parseCsv } from '../src/csv/parseCsv';
import { previewOperation } from '../src/operations';
import type { Dataset } from '@dashboard/contracts';
const data: Dataset = {
  versionId: 'source',
  columns: [
    { id: 'text', name: 'Name', type: 'text' },
    { id: 'number', name: 'Value', type: 'number' },
    { id: 'group', name: 'Group', type: 'text' },
  ],
  rows: [
    { id: 'r1', cells: { text: ' <b>A</b> ', number: 0, group: 'low' } },
    { id: 'r2', cells: { text: 'B', number: 1, group: 'mid' } },
    { id: 'r3', cells: { text: 'C', number: null, group: 'high' } },
  ],
};
describe('updated preprocessing workflow', () => {
  it('normalizes default missing tokens but preserves 0, false and the letter o', () => {
    const d = createDataset(
      parseCsv('x,y,z\nnull,0,false\n N/A ,1,true\n  ,2,false\nNULL,3,false\no,4,false', ','),
      { header: 'first-row', versionId: 'csv' },
    );
    expect(d.rows.map((r) => r.cells['column-1'])).toEqual([null, null, null, null, 'o']);
    expect(d.rows[0]?.cells['column-2']).toBe(0);
    expect(d.rows[0]?.cells['column-3']).toBe(false);
  });
  it('performs simultaneous exact replacements without cascading or string coercion', () => {
    const p = previewOperation(
      data,
      {
        method: 'replace',
        columnIds: ['number'],
        replacements: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: null, to: 0 },
        ],
      },
      'replaced',
    );
    expect(p.dataset.rows.map((r) => r.cells.number)).toEqual([1, 2, 0]);
    expect(data.rows[0]?.cells.number).toBe(0);
    expect(p.changes.cells).toBe(3);
    expect(() =>
      previewOperation(
        data,
        { method: 'replace', columnIds: ['number'], replacements: [{ from: 0, to: 'oops' }] },
        'bad',
      ),
    ).toThrow();
    expect(() =>
      previewOperation(
        data,
        {
          method: 'replace',
          columnIds: ['number'],
          replacements: [
            { from: 0, to: 1 },
            { from: 0, to: 2 },
          ],
        },
        'bad',
      ),
    ).toThrow();
  });
  it('applies per-column cleaning as one version and counts final changed cells once', () => {
    const p = previewOperation(
      data,
      {
        method: 'cleaning-batch',
        columnIds: [],
        cleaningPlans: [
          {
            columnId: 'text',
            stripHtml: true,
            trim: true,
            replacements: [{ from: 'A', to: 'Alpha' }],
          },
          {
            columnId: 'group',
            replacements: [
              { from: 'low', to: 'L' },
              { from: 'mid', to: 'M' },
            ],
          },
        ],
      },
      'cleaned',
    );
    expect(p.dataset.versionId).toBe('cleaned');
    expect(p.dataset.rows[0]?.cells.text).toBe('Alpha');
    expect(p.dataset.rows[1]?.cells.group).toBe('M');
    expect(p.changes.cells).toBe(3);
    expect(data.rows[0]?.cells.text).toBe(' <b>A</b> ');
    expect(() =>
      previewOperation(
        data,
        {
          method: 'cleaning-batch',
          columnIds: [],
          cleaningPlans: [
            { columnId: 'text', trim: true },
            { columnId: 'text', trim: true },
          ],
        },
        'bad',
      ),
    ).toThrow();
  });
  it('uses separately supplied category orders, rejects numeric and duplicate/missing ranks', () => {
    const p = previewOperation(
      data,
      { method: 'ordinal', columnIds: ['group'], orders: { group: ['high', 'mid', 'low'] } },
      'ordinal',
    );
    expect(p.dataset.rows.map((r) => r.cells.group)).toEqual([2, 1, 0]);
    expect(() =>
      previewOperation(
        data,
        {
          method: 'ordinal',
          columnIds: ['group'],
          orders: { group: ['high', 'mid', 'low', 'low'] },
        },
        'bad',
      ),
    ).toThrow();
    expect(() =>
      previewOperation(
        data,
        {
          method: 'ordinal',
          columnIds: ['number'],
          orders: { number: ['0', '1'] },
          missingCategory: true,
        },
        'bad',
      ),
    ).toThrow();
  });
  it('deduplicates all features, keeps first stable row and preserves source', () => {
    const duplicated = {
      ...data,
      rows: [...data.rows, { id: 'duplicate', cells: { ...data.rows[0]?.cells } }],
    };
    const p = previewOperation(duplicated, { method: 'deduplicate', columnIds: [] }, 'unique');
    expect(p.changes.rows).toBe(1);
    expect(p.dataset.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(duplicated.rows).toHaveLength(4);
  });
});
