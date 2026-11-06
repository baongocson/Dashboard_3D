import { describe, expect, it } from 'vitest';
import {
  applyPublicationSchema,
  cellSchema,
  csvFileSchema,
  datasetSchema,
  manifestSchema,
  previewSchema,
  sessionSchema,
  workerRequestSchema,
} from '../src/index';
import { csvCases } from '../../../tests/fixtures/rules';

describe('data and import boundaries', () => {
  it('preserves valid zero, missing, identifiers and unsafe integers stored as text', () => {
    for (const value of [0, null, '001', '9007199254740993'])
      expect(cellSchema.parse(value)).toBe(value);
    for (const value of [
      NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      undefined,
      {},
      new Date(),
    ])
      expect(cellSchema.safeParse(value).success).toBe(false);
  });

  it('accepts exactly the decimal limit and rejects larger or empty inputs', () => {
    expect(csvFileSchema.safeParse({ name: 'data.csv', bytes: 20_000_000 }).success).toBe(true);
    for (const bytes of [0, -1, 20_000_001, 20 * 1024 * 1024])
      expect(csvFileSchema.safeParse({ name: 'data.csv', bytes }).success).toBe(false);
  });

  it.each(csvCases)('can represent expected CSV output losslessly: $id', (fixture) => {
    const columns = fixture.expectedColumns.map((name, index) => ({
      id: `c${String(index)}`,
      name,
      type: fixture.expectedRows.some((row) => typeof row[index] === 'number') ? 'number' : 'text',
    }));
    const rows = fixture.expectedRows.map((values, index) => ({
      id: `source-row-${String(index)}`,
      cells: Object.fromEntries(
        columns.map((column, columnIndex) => [column.id, values[columnIndex]]),
      ),
    }));
    expect(datasetSchema.parse({ versionId: 'v0', columns, rows }).rows).toEqual(rows);
  });

  it('rejects ambiguous row/column identities, shape and type mismatches', () => {
    const base = {
      versionId: 'v0',
      columns: [{ id: 'c1', name: 'amount', type: 'number' }],
      rows: [{ id: 'r1', cells: { c1: 0 } }],
    };
    expect(datasetSchema.safeParse(base).success).toBe(true);
    expect(datasetSchema.safeParse({ ...base, rows: [...base.rows, ...base.rows] }).success).toBe(
      false,
    );
    expect(
      datasetSchema.safeParse({ ...base, columns: [...base.columns, ...base.columns] }).success,
    ).toBe(false);
    for (const cells of [{}, { c1: 0, other: 1 }, { c1: '2' }])
      expect(datasetSchema.safeParse({ ...base, rows: [{ id: 'r1', cells }] }).success).toBe(false);
  });
});

const manifest = {
  id: 'manifest-1',
  chunks: [{ id: 'chunk-1', ordinal: 0, bytes: 12, sha256: 'a'.repeat(64) }],
  totalBytes: 12,
};
const publication = {
  version: {
    id: 'v1',
    projectId: 'p1',
    datasetId: 'd1',
    parentVersionId: 'v0',
    manifestId: 'manifest-1',
    source: 'apply',
  },
  manifest,
  history: {
    operationId: 'op1',
    kind: 'apply',
    fromVersionId: 'v0',
    toVersionId: 'v1',
    method: 'fill-cell',
    columnIds: ['c1'],
    rowIds: ['r1'],
    parameters: { value: 7 },
    changes: { rows: 1, columns: 1, cells: 1 },
  },
  outbox: {
    operationId: 'op1',
    projectId: 'p1',
    kind: 'apply',
    baseRevision: 0,
    dependsOn: [],
    status: 'pending',
  },
  currentVersionId: 'v1',
};

describe('publication and session contracts', () => {
  it('requires consistent publication references and an outbox at the publication boundary', () => {
    expect(applyPublicationSchema.safeParse(publication).success).toBe(true);
    for (const invalid of [
      { ...publication, outbox: undefined },
      { ...publication, currentVersionId: 'v0' },
      { ...publication, outbox: { ...publication.outbox, operationId: 'op2' } },
      { ...publication, version: { ...publication.version, parentVersionId: 'unrelated' } },
    ])
      expect(applyPublicationSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects truncated and duplicate chunk manifests', () => {
    expect(manifestSchema.safeParse({ ...manifest, totalBytes: 13 }).success).toBe(false);
    expect(
      manifestSchema.safeParse({
        ...manifest,
        chunks: [...manifest.chunks, ...manifest.chunks],
        totalBytes: 24,
      }).success,
    ).toBe(false);
  });

  it('ties preview and cell selection to the same version and rejects sync fields', () => {
    const preview = {
      id: 'preview1',
      jobId: 'job1',
      baseVersionId: 'v0',
      configFingerprint: 'config1',
      configuration: {
        method: 'fill-cell',
        selection: { versionId: 'v0', rowId: 'r1', columnId: 'c1' },
        value: 7,
      },
      changes: { rows: 1, columns: 1, cells: 1 },
      examples: [{ rowId: 'r1', columnId: 'c1', before: null, after: 7 }],
      errors: [],
      warnings: [],
    };
    expect(previewSchema.safeParse(preview).success).toBe(true);
    expect(previewSchema.safeParse({ ...preview, baseVersionId: 'v2' }).success).toBe(false);
    expect(previewSchema.safeParse({ ...preview, outbox: publication.outbox }).success).toBe(false);
  });

  it('can restore a chart from an older version without moving its selection to current data', () => {
    const session = {
      id: 's1',
      projectId: 'p1',
      datasetId: 'd1',
      currentVersionId: 'v1',
      section: 'missing',
      confirmedConfiguration: { method: 'fill-cell' },
      charts: [
        {
          id: 'chart1',
          section: 'missing',
          versionId: 'v0',
          configuration: {},
          resultManifestId: 'chart-manifest',
          displayedRows: 2,
          totalRows: 3,
        },
      ],
      views: [{ chartId: 'chart1', position: [3, 4, 5], target: [0, 0, 0], zoom: 1.5 }],
      table: {
        filters: [],
        sorts: [{ columnId: 'c1', direction: 'desc' }],
        selection: { versionId: 'v0', rowId: 'r1', columnId: 'c1' },
      },
    };
    const restored = sessionSchema.parse(session);
    expect(restored.table.selection?.versionId).toBe('v0');
    expect(restored.currentVersionId).toBe('v1');
    expect(restored.views).toEqual(session.views);
    expect(sessionSchema.safeParse({ ...session, runningJob: 'job1' }).success).toBe(false);
  });

  it('does not accept arbitrary Worker commands as trusted messages', () => {
    expect(workerRequestSchema.safeParse({ type: 'ping', jobId: 'job1' }).success).toBe(true);
    expect(workerRequestSchema.safeParse({ type: 'apply', jobId: 'job1', data: [] }).success).toBe(
      false,
    );
  });
});
