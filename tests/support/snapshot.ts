import { createHash } from 'node:crypto';
import type { ProjectSnapshot } from '@dashboard/contracts';

export function snapshotFixture(ownerId: string, prefix: string) {
  const id = (suffix: string) => `${prefix}-${suffix}`;
  const bytes = Buffer.from(
    JSON.stringify({
      versionId: id('v1'),
      columns: [{ id: 'c', name: 'value', type: 'number' }],
      rows: [{ id: 'r', cells: { c: 2 } }],
    }),
  );
  const chunk = {
    id: id('chunk'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    data: bytes.toString('base64'),
  };
  const snapshot: ProjectSnapshot = {
    project: {
      id: id('project'),
      ownerId,
      name: 'Fixture',
      datasetId: id('dataset'),
      sessionId: id('session'),
    },
    session: {
      id: id('session'),
      projectId: id('project'),
      datasetId: id('dataset'),
      currentVersionId: id('v1'),
      section: 'collection',
      confirmedConfiguration: {},
      charts: [],
      views: [],
      table: { filters: [], sorts: [], selection: null },
    },
    versions: [
      {
        id: id('v1'),
        projectId: id('project'),
        datasetId: id('dataset'),
        parentVersionId: null,
        manifestId: id('manifest'),
        source: 'import',
      },
    ],
    manifests: [
      {
        id: id('manifest'),
        totalBytes: bytes.length,
        chunks: [{ id: chunk.id, bytes: chunk.bytes, sha256: chunk.sha256, ordinal: 0 }],
      },
    ],
    history: [],
  };
  return { snapshot, chunk };
}
