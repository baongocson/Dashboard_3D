import Dexie from 'dexie';
import { readDatasetChunks } from './chunk_service';

import { z } from 'zod';

import { applyPublicationSchema, sessionSchema } from '@dashboard/contracts';

import { db } from '../db';

export type ApplyPublication = z.infer<typeof applyPublicationSchema>;

export async function publishApply(sessionId: string, input: ApplyPublication): Promise<string> {
  if (!sessionId.trim()) {
    throw new Error('sessionId không được để trống');
  }

  const publication = applyPublicationSchema.parse(input);

  return db.transaction(
    'rw',
    [db.versions, db.chunks, db.manifests, db.histories, db.outbox, db.sessions],
    async () => {
      const session = await db.sessions.get(sessionId);

      if (!session) {
        throw new Error(`Không tìm thấy session: ${sessionId}`);
      }

      if (session.projectId !== publication.version.projectId) {
        throw new Error('Session và Version không cùng project');
      }

      if (session.datasetId !== publication.version.datasetId) {
        throw new Error('Session và Version không cùng dataset');
      }

      if (session.currentVersionId !== publication.history.fromVersionId) {
        throw new Error(
          'Phiên bản hiện tại đã thay đổi. Không thể publication trên base version cũ.',
        );
      }

      const nextSession = sessionSchema.parse({
        ...session,
        currentVersionId: publication.currentVersionId,
      });

      const savedManifest = await db.manifests.get(publication.manifest.id);

      if (!savedManifest) {
        throw new Error('Manifest chưa được lưu trong IndexedDB');
      }

      if (JSON.stringify(savedManifest) !== JSON.stringify(publication.manifest)) {
        throw new Error('Manifest không khớp với Publication');
      }
      const verified = await Dexie.waitFor(readDatasetChunks(savedManifest.id));
      if (verified.versionId !== publication.version.id)
        throw new Error('Dataset version mismatch');
      await db.versions.add(publication.version);
      await db.histories.add(publication.history);
      await db.outbox.add(publication.outbox);
      await db.sessions.put(nextSession);

      return publication.currentVersionId;
    },
  );
}
