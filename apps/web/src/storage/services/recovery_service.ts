import {
  datasetSchema,
  manifestSchema,
  sessionSchema,
  versionSchema,
} from '@dashboard/contracts';

import { db } from '../db';
import { readDatasetChunks } from './chunk_service';

export type RecoveryResult = {
  sessionId: string;
  projectId: string;
  datasetId: string;
  versionId: string;
  dataset: ReturnType<typeof datasetSchema.parse>;
};

export async function recoverSession(
  sessionId: string,
): Promise<RecoveryResult> {
  if (!sessionId.trim()) {
    throw new Error('sessionId không được để trống.');
  }

  return db.transaction(
    'r',
    db.sessions,
    db.versions,
    db.manifests,
    db.chunks,
    async () => {
      // 1. Lấy và kiểm tra Session
      const rawSession = await db.sessions.get(sessionId);

      if (!rawSession) {
        throw new Error(`Không tìm thấy Session: ${sessionId}`);
      }

      const session = sessionSchema.parse(rawSession);

      // 2. Lấy Version hiện tại mà Session đang sử dụng
      const rawVersion = await db.versions.get(
        session.currentVersionId,
      );

      if (!rawVersion) {
        throw new Error(
          `Không tìm thấy Version: ${session.currentVersionId}`,
        );
      }

      const version = versionSchema.parse(rawVersion);

      // 3. Kiểm tra quan hệ Session - Version
      if (version.projectId !== session.projectId) {
        throw new Error('Version không thuộc Project của Session.');
      }

      if (version.datasetId !== session.datasetId) {
        throw new Error('Dataset của Version không khớp với Session.');
      }

      // 4. Lấy Manifest tương ứng với Version
      const rawManifest = await db.manifests.get(
        version.manifestId,
      );

      if (!rawManifest) {
        throw new Error(
          `Không tìm thấy Manifest: ${version.manifestId}`,
        );
      }

      const manifest = manifestSchema.parse(rawManifest);

      // 5. Khôi phục Dataset từ các Chunk
      const dataset = await readDatasetChunks(manifest.id);

      // 6. Kiểm tra Dataset có đúng Version không
      const validatedDataset = datasetSchema.parse(dataset);

      if (validatedDataset.versionId !== version.id) {
        throw new Error(
          'Version ID của Dataset không khớp với Version đang khôi phục.',
        );
      }

      return {
        sessionId: session.id,
        projectId: session.projectId,
        datasetId: session.datasetId,
        versionId: version.id,
        dataset: validatedDataset,
      };
    },
  );
}