import { createWorkerRuntime } from '../src/worker/processWorkerRuntimeRequest';
import { describe, expect, it } from 'vitest';
import type { Cell, Dataset } from '@dashboard/contracts';
import {
  createDataset,
  inferColumnType,
  parseCsv,
  createMissingProposals,
  applyMissingProposals,
  getColumnStatistics,
} from '../src/index';
import { analyzeDataset, previewOperation } from '../src/operations';
import { csvCases, statisticsCases, missingCases } from '../../../tests/fixtures/rules';

function single(values: Cell[], type: Dataset['columns'][number]['type'] = 'number'): Dataset {
  return {
    versionId: 'v1',
    columns: [{ id: 'c', name: 'value', type }],
    rows: values.map((v, i) => ({ id: `r${String(i)}`, cells: { c: v } })),
  };
}
describe('review regressions and agreed rules', () => {
  it.each(csvCases)('preserves CSV $id', (fixture) => {
    const result = createDataset(parseCsv(fixture.input, fixture.options.delimiter), {
      header: fixture.options.header ? 'first-row' : 'generated',
      versionId: 'v1',
    });
    expect(result.columns.map((c) => c.name)).toEqual(fixture.expectedColumns);
    expect(result.rows.map((r) => result.columns.map((c) => r.cells[c.id]))).toEqual(
      fixture.expectedRows,
    );
  });
  it('retains a quoted empty record', () => {
    expect(parseCsv('a\n""\n', ',').records).toEqual([['a'], ['']]);
  });
  it.each(['001e0', '1.0000000000000001', '2026-11-10'])('keeps %s as text', (value) => {
    expect(inferColumnType([value])).toBe('text');
  });
  it('rejects stale proposals and computes a finite opposite-sign mean', () => {
    const dataset = single([null, 2]);
    const proposals = createMissingProposals(dataset, [{ columnId: 'c', strategy: 'mean' }]);
    expect(() =>
      applyMissingProposals({ ...single([null, 100]), versionId: 'v2' }, proposals, 'v3'),
    ).toThrow('Stale');
    expect(getColumnStatistics(single([-1e308, 1e308]), 'c').mean).toBe(0);
  });
  it('validates malformed Worker messages at runtime', async () => {
    const responses: unknown[] = [];
    await createWorkerRuntime(() => Promise.resolve()).handleRequest(
      { taskId: 't', type: 'dataset-summary', dataset: { versionId: '', columns: [], rows: [] } },
      (r) => responses.push(r),
    );
    expect(responses).toEqual([expect.objectContaining({ taskId: 't', status: 'error' })]);
  });
  it('matches quantiles, population deviation and Pearson N/A', () => {
    const stats = analyzeDataset(single([...statisticsCases.quantile.input])).columns[0]
      ?.statistics;
    expect(stats).toMatchObject({ q1: 1.75, median: 2.5, q3: 3.25 });
    expect(analyzeDataset(single([1, 2, 3])).columns[0]?.statistics?.deviation).toBeCloseTo(
      Math.sqrt(2 / 3),
    );
    expect(analyzeDataset(single([1, 1])).correlation[0]?.coefficient).toBeNull();
  });
  it.each([
    ['forward', missingCases.forward],
    ['backward', missingCases.backward],
    ['interpolate', missingCases.interpolation],
  ] as const)('matches missing %s', (method, fixture) => {
    const result = previewOperation(single([...fixture.input]), { method, columnIds: ['c'] }, 'v2');
    expect(result.dataset.rows.map((r) => r.cells.c)).toEqual(fixture.expected);
  });
  it('mode tie uses first source occurrence; single-cell statistics use the whole column', () => {
    const mode = previewOperation(
      single([...missingCases.modeTie.input], 'text'),
      { method: 'mode', columnIds: ['c'] },
      'v2',
    );
    expect(mode.dataset.rows[4]?.cells.c).toBe('b');
    expect(mode.warnings).toHaveLength(1);
    const mean = previewOperation(
      single([2, null, 8, null]),
      { method: 'mean', columnIds: ['c'], rowId: 'r1' },
      'v2',
    );
    expect(mean.dataset.rows.map((r) => r.cells.c)).toEqual([2, 5, 8, null]);
  });
  it('sort maps interpolation back to stable source rows', () => {
    const dataset = single([6, 2, null]);
    dataset.columns.push({ id: 'x', name: 'axis', type: 'number' });
    dataset.rows.forEach((r, i) => {
      r.cells.x = [3, 1, 2][i] ?? 0;
    });
    const result = previewOperation(
      dataset,
      { method: 'interpolate', columnIds: ['c'], sortColumnId: 'x' },
      'v2',
    );
    expect(result.dataset.rows.map((r) => r.cells.c)).toEqual([6, 2, 4]);
    expect(result.dataset.rows.map((r) => r.id)).toEqual(['r0', 'r1', 'r2']);
  });
  it('interpolates on explicit date axes and rejects duplicate times', () => {
    const source = single([0, null, 30]);
    source.columns.push({ id: 'time', name: 'Time', type: 'date' });
    source.rows.forEach((row, index) => {
      row.cells.time = ['2026-01-01', '2026-01-02', '2026-01-04'][index] ?? null;
    });
    expect(
      previewOperation(
        source,
        { method: 'interpolate', columnIds: ['c'], sortColumnId: 'time' },
        'v2',
      ).dataset.rows[1]?.cells.c,
    ).toBe(10);
    if (source.rows[1]) source.rows[1].cells.time = '2026-01-01';
    expect(() =>
      previewOperation(
        source,
        { method: 'interpolate', columnIds: ['c'], sortColumnId: 'time' },
        'v2',
      ),
    ).toThrow('không thiếu/trùng');
  });
  it('rejects transform domains and constant scaling without mutating source', () => {
    const source = single([-1, 4, null]);
    expect(() => previewOperation(source, { method: 'sqrt', columnIds: ['c'] }, 'v2')).toThrow(
      'x ≥ 0',
    );
    expect(() => previewOperation(source, { method: 'log1p', columnIds: ['c'] }, 'v2')).toThrow(
      'x > -1',
    );
    expect(() =>
      previewOperation(single([2, 2]), { method: 'standard', columnIds: ['c'] }, 'v2'),
    ).toThrow('0');
    expect(source.rows[0]?.cells.c).toBe(-1);
  });
  it('IQR clips and deletes exactly detected outliers', () => {
    const input = single([0, 1, 2, 3, 100]);
    expect(
      previewOperation(input, { method: 'iqr-clip', columnIds: ['c'] }, 'v2').dataset.rows[4]?.cells
        .c,
    ).toBe(6);
    expect(
      previewOperation(input, { method: 'iqr-drop', columnIds: ['c'] }, 'v2').dataset.rows,
    ).toHaveLength(4);
  });
  it('encoding preserves explicit ordinal order and previews onehot columns', () => {
    const input = single(['high', 'low', 'high'], 'text');
    const ordinal = previewOperation(
      input,
      { method: 'ordinal', columnIds: ['c'], categories: ['low', 'high'], keepOriginal: false },
      'v2',
    );
    expect(ordinal.dataset.rows.map((r) => r.cells.c)).toEqual([1, 0, 1]);
    expect(
      previewOperation(input, { method: 'onehot', columnIds: ['c'], keepOriginal: true }, 'v2')
        .dataset.columns,
    ).toHaveLength(3);
  });
  it('detects metadata-only changes and constant columns without rounding artifacts', () => {
    const source = single([2, 2, 2]);
    expect(analyzeDataset(source).correlation[0]?.coefficient).toBeNull();
    expect(() => previewOperation(source, { method: 'standard', columnIds: ['c'] }, 'v2')).toThrow(
      '0',
    );
    expect(
      previewOperation(source, { method: 'rename', columnIds: ['c'], value: 'renamed' }, 'v2')
        .changes.columns,
    ).toBe(1);
    const text = single(['2026-11-10'], 'text');
    expect(previewOperation(text, { method: 'date', columnIds: ['c'] }, 'v2').changes.columns).toBe(
      1,
    );
  });
  it('handles mixed per-column Missing plans and keeps skipped columns unchanged', () => {
    const source: Dataset = {
      versionId: 'v1',
      columns: [
        { id: 'a', name: 'A', type: 'number' },
        { id: 'b', name: 'B', type: 'text' },
        { id: 'c', name: 'C', type: 'text' },
      ],
      rows: [
        { id: 'r1', cells: { a: 2, b: 'x', c: null } },
        { id: 'r2', cells: { a: null, b: null, c: 'keep' } },
      ],
    };
    const result = previewOperation(
      source,
      {
        method: 'missing-batch',
        columnIds: [],
        plans: [
          { columnId: 'a', method: 'median' },
          { columnId: 'b', method: 'mode' },
        ],
      },
      'v2',
    );
    expect(result.dataset.rows.map((r) => r.cells)).toEqual([
      { a: 2, b: 'x', c: null },
      { a: 2, b: 'x', c: 'keep' },
    ]);
    expect(source.rows[1]?.cells.a).toBeNull();
    expect(result.changes.cells).toBe(2);
  });
  it('estimates Yeo–Johnson MLE without automatic scaling, rejects constant inputs', () => {
    const preview = previewOperation(
      single([-2, -1, 0, 1, 2, null]),
      { method: 'yeojohnson', columnIds: ['c'] },
      'v2',
    );
    expect(preview.parameters['c:lambda']).toBeCloseTo(1, 4);
    expect(preview.dataset.rows[0]?.cells.c).toBeCloseTo(-2, 4);
    expect(preview.dataset.rows[5]?.cells.c).toBeNull();
    expect(() =>
      previewOperation(single([2, 2, 2]), { method: 'yeojohnson', columnIds: ['c'] }, 'v2'),
    ).toThrow('cột hằng');
  });
  it('requires explicit missing encoding and distinguishes missing from a text group', () => {
    const source = single(['missing', null, 'other'], 'text');
    expect(() => previewOperation(source, { method: 'onehot', columnIds: ['c'] }, 'v2')).toThrow(
      'missing trước',
    );
    const result = previewOperation(
      source,
      { method: 'onehot', columnIds: ['c'], missingCategory: true },
      'v2',
    );
    expect(result.dataset.columns.map((c) => c.name)).toEqual([
      'value__missing',
      'value__other',
      'value__missing_2',
    ]);
    const missingRow = result.dataset.rows[1];
    expect(result.dataset.columns.map((c) => missingRow?.cells[c.id])).toEqual([0, 0, 1]);
  });
});
