import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { commitPreview, createProject, openProject, undoWorkspace } from './workspace';
import { previewOperation } from '../../../../packages/data-engine/src/operations';
import { saveDatasetChunks } from './services/chunk_service';
import { publishApply } from './services/publication_service';
import type { Dataset } from '@dashboard/contracts';

const dataset: Dataset = {
  versionId: 'v1',
  columns: [{ id: 'c', name: 'score', type: 'number' }],
  rows: [
    { id: 'r1', cells: { c: 2 } },
    { id: 'r2', cells: { c: null } },
  ],
};
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
  await db.open();
});
describe('durable local publication', () => {
  it('commits result, history, outbox and pointer together; reopens and undoes', async () => {
    const open = await createProject(dataset, 'data.csv', 20, 'alice');
    const preview = previewOperation(dataset, { method: 'mean', columnIds: ['c'] }, 'v2');
    expect(await db.histories.count()).toBe(0);
    const next = await commitPreview(open, preview, open.workspace);
    expect((await openProject(open.session.id)).dataset.rows[1]?.cells.c).toBe(2);
    expect(await db.histories.count()).toBe(1);
    expect(await db.outbox.count()).toBe(2);
    const undone = await undoWorkspace(next, next.workspace);
    expect(undone.dataset).toEqual(dataset);
    expect((await openProject(open.session.id)).dataset).toEqual(dataset);
    expect(await db.histories.count()).toBe(2);
  });
  it.each(['missing', 'hash', 'version'] as const)(
    'rejects %s chunk/content without publishing',
    async (fault) => {
      const open = await createProject(dataset, 'data.csv', 20, 'alice');
      const result = { ...dataset, versionId: fault === 'version' ? 'wrong' : 'v2' };
      const { manifest } = await saveDatasetChunks(
        open.session.datasetId,
        result.versionId,
        result,
      );
      const first = manifest.chunks[0];
      if (!first) throw new Error('fixture missing chunk');
      if (fault === 'missing') await db.chunks.delete(first.id);
      if (fault === 'hash')
        await db.chunks.update(first.id, { data: new ArrayBuffer(first.bytes) });
      const publication = {
        version: {
          id: 'v2',
          projectId: open.session.projectId,
          datasetId: open.session.datasetId,
          parentVersionId: 'v1',
          manifestId: manifest.id,
          source: 'apply' as const,
        },
        manifest,
        currentVersionId: 'v2',
        history: {
          operationId: 'op',
          kind: 'apply' as const,
          fromVersionId: 'v1',
          toVersionId: 'v2',
          method: 'fill',
          columnIds: ['c'],
          rowIds: ['r2'],
          parameters: {},
          changes: { cells: 1, rows: 0, columns: 0 },
        },
        outbox: {
          operationId: 'op',
          projectId: open.session.projectId,
          kind: 'apply' as const,
          baseRevision: null,
          dependsOn: [],
          status: 'pending' as const,
        },
      };
      await expect(publishApply(open.session.id, publication)).rejects.toThrow();
      expect((await db.sessions.get(open.session.id))?.currentVersionId).toBe('v1');
      expect(await db.versions.get('v2')).toBeUndefined();
      expect(await db.histories.count()).toBe(0);
      expect(await db.outbox.count()).toBe(1);
    },
  );
  it('transaction abort on outbox failure preserves prior commit', async () => {
    const open = await createProject(dataset, 'data.csv', 20, 'alice');
    vi.spyOn(db.outbox, 'add').mockRejectedValueOnce(
      new DOMException('Quota full', 'QuotaExceededError'),
    );
    await expect(
      commitPreview(
        open,
        previewOperation(dataset, { method: 'mean', columnIds: ['c'] }, 'v2'),
        open.workspace,
      ),
    ).rejects.toThrow('Quota full');
    expect((await db.sessions.get(open.session.id))?.currentVersionId).toBe('v1');
    expect(await db.versions.get('v2')).toBeUndefined();
    expect(await db.histories.count()).toBe(0);
  });
  it('rejects concurrent stale base publication', async () => {
    const open = await createProject(dataset, 'data.csv', 20, 'alice');
    const a = previewOperation(dataset, { method: 'fill', columnIds: ['c'], value: 3 }, 'v2');
    const b = previewOperation(dataset, { method: 'fill', columnIds: ['c'], value: 4 }, 'v3');
    const outcomes = await Promise.allSettled([
      commitPreview(open, a, open.workspace),
      commitPreview(open, b, open.workspace),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await db.histories.count()).toBe(1);
  });
});
