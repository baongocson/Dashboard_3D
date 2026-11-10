import { z } from 'zod';
import {
  authSessionResponseSchema,
  projectSnapshotSchema,
  projectSchema,
  syncChunkSchema,
  CSRF_HEADER,
  SESSION_ACTIVITY_HEADER,
} from '@dashboard/contracts';
import { db } from '../storage/db';
import type { LocalChunkRecord } from '../storage/types';
import { readDatasetChunks } from '../storage/services/chunk_service';

export type Account = z.infer<typeof authSessionResponseSchema>;
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  csrf?: string,
  background = false,
): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    signal: AbortSignal.timeout(30_000),
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
      ...(background ? { [SESSION_ACTIVITY_HEADER]: 'background' } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const parsed = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(await response.json());
    throw new HttpError(
      parsed.success ? parsed.data.error.message : `HTTP ${String(response.status)}`,
      response.status,
    );
  }
  return response.status === 204 ? null : response.json();
}
function encode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function decode(base64: string) {
  const text = atob(base64),
    bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
}

export async function syncProject(
  projectId: string,
  account: Account,
  claimLocal = false,
): Promise<void> {
  const project = await db.projects.get(projectId);
  if (
    !project ||
    (project.ownerId !== account.user.id && !(claimLocal && project.ownerId === 'local'))
  )
    return;
  if (project.ownerId === 'local') {
    project.ownerId = account.user.id;
    await db.projects.put(project);
  }
  const pending = (await db.outbox.where('projectId').equals(projectId).toArray()).filter(
    (o) => o.status !== 'synced',
  );
  if (!pending.length) return;
  if (pending.some((o) => o.status === 'conflict'))
    throw new Error(
      'Xung đột revision: bản local được giữ riêng. Tạo bản sao để đồng bộ hoặc mở bản server.',
    );
  let job = await db.syncJobs.get(projectId);
  if (!job) {
    const session = await db.sessions.get(project.sessionId);
    const versions = await db.versions.where('projectId').equals(projectId).toArray();
    const manifests = await db.manifests.bulkGet(versions.map((v) => v.manifestId));
    const ids = new Set(versions.map((v) => v.id));
    const history = (await db.histories.toArray()).filter((h) => ids.has(h.toVersionId));
    const snapshot = projectSnapshotSchema.parse({
      project,
      session,
      versions,
      manifests,
      history,
    });
    const revision =
      (await db.remoteRevisions.get(`${account.user.id}:${projectId}`))?.revision ?? 0;
    job = {
      projectId,
      ownerId: account.user.id,
      snapshot,
      operationId: pending[0]?.operationId ?? crypto.randomUUID(),
      baseRevision: revision,
      operationIds: pending.map((o) => o.operationId),
    };
    await db.syncJobs.add(job);
  }
  if (job.ownerId !== account.user.id) throw new Error('Project thuộc tài khoản khác.');
  try {
    // Sequential chunks provide backpressure; immutable IDs make retry safe after a lost ACK.
    for (const manifest of job.snapshot.manifests) {
      await readDatasetChunks(manifest.id);
      const missing = new Set<string>();
      for (let offset = 0; offset < manifest.chunks.length; offset += 200) {
        const result = z
          .object({ missing: z.array(z.string()) })
          .parse(
            await api(
              '/sync/missing',
              'POST',
              manifest.chunks.slice(offset, offset + 200),
              account.csrfToken,
              true,
            ),
          );
        for (const id of result.missing) missing.add(id);
      }
      for (const ref of manifest.chunks) {
        if (!missing.has(ref.id)) continue;
        const chunk = await db.chunks.get(ref.id);
        if (!chunk) throw new Error('Thiếu chunk local; không thể đồng bộ.');
        await api(
          `/sync/chunks/${encodeURIComponent(ref.id)}`,
          'PUT',
          { id: ref.id, bytes: ref.bytes, sha256: ref.sha256, data: encode(chunk.data) },
          account.csrfToken,
          true,
        );
      }
    }
    const ack = z
      .object({ revision: z.number().int().positive(), conflict: z.literal(false) })
      .parse(
        await api(
          `/sync/${encodeURIComponent(projectId)}/commit`,
          'POST',
          { operationId: job.operationId, baseRevision: job.baseRevision, snapshot: job.snapshot },
          account.csrfToken,
          true,
        ),
      );
    await db.transaction('rw', [db.outbox, db.syncJobs, db.remoteRevisions], async () => {
      for (const operationId of job.operationIds)
        await db.outbox.update(operationId, { status: 'synced' });
      await db.remoteRevisions.put({
        key: `${account.user.id}:${projectId}`,
        revision: ack.revision,
      });
      await db.syncJobs.delete(projectId);
    });
  } catch (caught: unknown) {
    const status =
      caught instanceof HttpError && caught.status === 409
        ? 'conflict'
        : caught instanceof HttpError && caught.status === 401
          ? 'auth-required'
          : 'retryable-error';
    for (const operationId of job.operationIds) await db.outbox.update(operationId, { status });
    throw caught;
  }
}
export const remoteListSchema = z.array(
  z.object({ project: projectSchema, revision: z.number(), updatedAt: z.string() }),
);
export async function downloadProject(projectId: string, account: Account): Promise<void> {
  const pending = await db.outbox.where('projectId').equals(projectId).toArray();
  if (pending.some((o) => o.status !== 'synced'))
    throw new Error('Project có thay đổi local chưa đồng bộ; giữ bản local, không ghi đè.');
  const remote = z
    .object({ revision: z.number(), snapshot: projectSnapshotSchema })
    .parse(await api(`/projects/${encodeURIComponent(projectId)}`));
  if (remote.snapshot.project.ownerId !== account.user.id)
    throw new Error('Project không thuộc tài khoản hiện tại.');
  const chunks: LocalChunkRecord[] = [];
  for (const manifest of remote.snapshot.manifests)
    for (const [ordinal, ref] of manifest.chunks.entries()) {
      const chunk = syncChunkSchema.parse(
        await api(
          `/projects/${encodeURIComponent(projectId)}/chunks/${encodeURIComponent(ref.id)}`,
        ),
      );
      if (chunk.sha256 !== ref.sha256 || chunk.bytes !== ref.bytes || chunk.id !== ref.id)
        throw new Error('Chunk server không khớp manifest.');
      const data = decode(chunk.data);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (hash !== ref.sha256 || data.byteLength !== ref.bytes)
        throw new Error('Chunk server bị hỏng.');
      chunks.push({ ...ref, manifestId: manifest.id, ordinal, data });
    }
  await db.transaction(
    'rw',
    [
      db.projects,
      db.sessions,
      db.versions,
      db.manifests,
      db.chunks,
      db.histories,
      db.remoteRevisions,
      db.outbox,
    ],
    async () => {
      const { snapshot } = remote;
      const stillPending = await db.outbox.where('projectId').equals(projectId).toArray();
      if (stillPending.some((o) => o.status !== 'synced'))
        throw new Error('Local vừa thay đổi; không ghi đè.');
      await db.chunks.bulkPut(chunks);
      await db.manifests.bulkPut(snapshot.manifests);
      await db.versions.bulkPut(snapshot.versions);
      await db.histories.bulkPut(snapshot.history);
      await db.projects.put(snapshot.project);
      await db.sessions.put(snapshot.session);
      await db.remoteRevisions.put({
        key: `${account.user.id}:${projectId}`,
        revision: remote.revision,
      });
    },
  );
}
