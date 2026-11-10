import Dexie, { type Table } from 'dexie';
import type { z } from 'zod';

import { projectSchema, sessionSchema } from '@dashboard/contracts';

import type {
  LocalDatasetRecord,
  LocalVersionRecord,
  LocalManifestRecord,
  LocalChunkRecord,
  LocalChartRecord,
  LocalHistoryRecord,
  LocalOutboxRecord,
} from './types';
import type { ProjectSnapshot } from '@dashboard/contracts';

export type Project = z.infer<typeof projectSchema>;
export type Session = z.infer<typeof sessionSchema>;

class DashboardDatabase extends Dexie {
  projects!: Table<Project, string>;
  sessions!: Table<Session, string>;

  datasets!: Table<LocalDatasetRecord, string>;
  versions!: Table<LocalVersionRecord, string>;
  manifests!: Table<LocalManifestRecord, string>;
  chunks!: Table<LocalChunkRecord, string>;
  charts!: Table<LocalChartRecord, string>;
  histories!: Table<LocalHistoryRecord, string>;
  outbox!: Table<LocalOutboxRecord, string>;
  syncJobs!: Table<
    {
      projectId: string;
      ownerId: string;
      operationId: string;
      baseRevision: number;
      snapshot: ProjectSnapshot;
      operationIds: string[];
    },
    string
  >;
  remoteRevisions!: Table<{ key: string; revision: number }, string>;

  constructor() {
    super('dashboard-3d-local');

    this.version(3).stores({
      projects: '&id, ownerId, datasetId, sessionId',

      sessions: '&id, projectId, datasetId, currentVersionId',

      datasets: '&id, projectId, name, updatedAt',

      versions: '&id, projectId, datasetId, manifestId, parentVersionId, source',

      manifests: '&id',

      chunks: '&id, manifestId, ordinal, [manifestId+ordinal]',

      charts: '&id, projectId, versionId, updatedAt',

      histories: '&operationId, kind, fromVersionId, toVersionId',

      outbox: '&operationId, projectId, kind, status',
    });
    this.version(4).stores({ syncJobs: '&projectId,ownerId', remoteRevisions: '&key' });
  }
}

export const db = new DashboardDatabase();
