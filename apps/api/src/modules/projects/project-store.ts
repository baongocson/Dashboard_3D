import { createHash } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import { datasetSchema, type ProjectSnapshot, syncChunkSchema } from '@dashboard/contracts';
import type { z } from 'zod';
import { ApiError } from '../../shared/api-error.js';
import { guardMongo, isDuplicateKey } from '../../shared/mongo-errors.js';

export type SyncChunk = z.infer<typeof syncChunkSchema>;
export type StoredProject = {
  id: string;
  ownerId: string;
  revision: number;
  updatedAt: string;
  snapshot: ProjectSnapshot;
};
export interface ProjectStore {
  ready(): Promise<boolean>;
  list(ownerId: string): Promise<StoredProject[]>;
  get(ownerId: string, id: string): Promise<StoredProject | null>;
  putChunk(ownerId: string, chunk: SyncChunk): Promise<void>;
  getChunk(ownerId: string, id: string): Promise<SyncChunk | null>;
  commit(
    ownerId: string,
    id: string,
    operationId: string,
    baseRevision: number,
    snapshot: ProjectSnapshot,
  ): Promise<{ revision: number; conflict: boolean }>;
}
export function verifyChunk(input: unknown): SyncChunk {
  const chunk = syncChunkSchema.parse(input);
  const buffer = Buffer.from(chunk.data, 'base64');
  if (
    buffer.length !== chunk.bytes ||
    buffer.toString('base64') !== chunk.data ||
    createHash('sha256').update(buffer).digest('hex') !== chunk.sha256
  )
    throw new ApiError('VALIDATION_ERROR', 'Invalid chunk bytes or SHA-256');
  return chunk;
}
export async function verifySnapshot(
  store: ProjectStore,
  ownerId: string,
  snapshot: ProjectSnapshot,
): Promise<void> {
  const manifests = new Map(snapshot.manifests.map((m) => [m.id, m]));
  for (const version of snapshot.versions) {
    const manifest = manifests.get(version.manifestId);
    if (!manifest) throw new ApiError('VALIDATION_ERROR', 'Missing manifest');
    const buffers: Buffer[] = [];
    for (const ref of manifest.chunks) {
      const chunk = await store.getChunk(ownerId, ref.id);
      if (!chunk || chunk.sha256 !== ref.sha256 || chunk.bytes !== ref.bytes)
        throw new ApiError('VALIDATION_ERROR', 'Missing or invalid chunk');
      buffers.push(Buffer.from(verifyChunk(chunk).data, 'base64'));
    }
    const bytes = Buffer.concat(buffers);
    if (bytes.length !== manifest.totalBytes)
      throw new ApiError('VALIDATION_ERROR', 'Manifest size mismatch');
    const dataset = datasetSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    if (dataset.versionId !== version.id)
      throw new ApiError('VALIDATION_ERROR', 'Dataset version mismatch');
  }
}
export class MemoryProjectStore implements ProjectStore {
  private projects = new Map<string, StoredProject>();
  private chunks = new Map<string, SyncChunk>();
  private operations = new Map<string, { revision: number; fingerprint: string }>();
  ready() {
    return Promise.resolve(true);
  }
  async list(ownerId: string) {
    await Promise.resolve();
    return structuredClone([...this.projects.values()].filter((p) => p.ownerId === ownerId));
  }
  async get(ownerId: string, id: string) {
    await Promise.resolve();
    const p = this.projects.get(id);
    return p?.ownerId === ownerId ? structuredClone(p) : null;
  }
  async putChunk(ownerId: string, chunk: SyncChunk) {
    await Promise.resolve();
    const key = `${ownerId}:${chunk.id}`,
      existing = this.chunks.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(chunk))
      throw new ApiError('VALIDATION_ERROR', 'Chunk is immutable');
    this.chunks.set(key, structuredClone(chunk));
  }
  async getChunk(ownerId: string, id: string) {
    await Promise.resolve();
    return this.chunks.get(`${ownerId}:${id}`) ?? null;
  }
  async commit(
    ownerId: string,
    id: string,
    operationId: string,
    baseRevision: number,
    snapshot: ProjectSnapshot,
  ) {
    await Promise.resolve();
    const key = `${ownerId}:${operationId}`,
      fingerprint = JSON.stringify({ id, baseRevision, snapshot });
    const ack = this.operations.get(key);
    if (ack) {
      if (ack.fingerprint !== fingerprint)
        throw new ApiError('VALIDATION_ERROR', 'Operation ID reused with different content');
      return { revision: ack.revision, conflict: false };
    }
    const existing = this.projects.get(id);
    if (existing && existing.ownerId !== ownerId)
      throw new ApiError('NOT_FOUND', 'Project not found');
    if ((existing?.revision ?? 0) !== baseRevision)
      return { revision: existing?.revision ?? 0, conflict: true };
    const revision = baseRevision + 1;
    this.projects.set(id, {
      id,
      ownerId,
      revision,
      updatedAt: new Date().toISOString(),
      snapshot: structuredClone(snapshot),
    });
    this.operations.set(key, { revision, fingerprint });
    return { revision, conflict: false };
  }
}
export async function createMongoProjectStore(
  client: MongoClient,
  database: Db,
): Promise<ProjectStore> {
  const projects = database.collection<StoredProject>('projects');
  const chunks = database.collection<SyncChunk & { ownerId: string }>('datasetChunks');
  const operations = database.collection<{
    ownerId: string;
    operationId: string;
    fingerprint: string;
    revision: number;
  }>('syncOperations');
  await Promise.all([
    projects.createIndex({ id: 1 }, { unique: true }, {}),
    projects.createIndex({ ownerId: 1, updatedAt: -1 }, {}, {}),
    chunks.createIndex({ ownerId: 1, id: 1 }, { unique: true }, {}),
    operations.createIndex({ ownerId: 1, operationId: 1 }, { unique: true }, {}),
  ]);
  const repository: ProjectStore = {
    async ready() {
      try {
        await database.command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    },
    async list(ownerId) {
      return projects.find({ ownerId }).project<StoredProject>({ _id: 0 }).toArray();
    },
    async get(ownerId, id) {
      return projects.findOne({ ownerId, id }, { projection: { _id: 0 } });
    },
    async getChunk(ownerId, id) {
      const raw = await chunks.findOne({ ownerId, id });
      return raw ? syncChunkSchema.parse(raw) : null;
    },
    async putChunk(ownerId, chunk) {
      try {
        await chunks.updateOne(
          { ownerId, id: chunk.id },
          { $setOnInsert: { ...chunk, ownerId } },
          { upsert: true },
        );
      } catch (error: unknown) {
        if (!isDuplicateKey(error)) throw error;
      }
      const saved = await chunks.findOne({ ownerId, id: chunk.id });
      if (!saved || saved.sha256 !== chunk.sha256 || saved.bytes !== chunk.bytes)
        throw new ApiError('VALIDATION_ERROR', 'Chunk is immutable');
    },
    async commit(ownerId, id, operationId, baseRevision, snapshot) {
      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ id, baseRevision, snapshot }))
        .digest('hex');
      const session = client.startSession();
      try {
        const result = await session.withTransaction(async () => {
          const ack = await operations.findOne({ ownerId, operationId }, { session });
          if (ack) {
            if (ack.fingerprint !== fingerprint)
              throw new ApiError('VALIDATION_ERROR', 'Operation ID reused');
            return { revision: ack.revision, conflict: false };
          }
          const existing = await projects.findOne({ id }, { session });
          if (existing && existing.ownerId !== ownerId)
            throw new ApiError('NOT_FOUND', 'Project not found');
          if ((existing?.revision ?? 0) !== baseRevision)
            return { revision: existing?.revision ?? 0, conflict: true };
          const revision = baseRevision + 1;
          const document = { id, ownerId, revision, snapshot, updatedAt: new Date().toISOString() };
          if (existing)
            await projects.replaceOne({ id, ownerId, revision: baseRevision }, document, {
              session,
            });
          else await projects.insertOne(document, { session });
          await operations.insertOne({ ownerId, operationId, fingerprint, revision }, { session });
          return { revision, conflict: false };
        });
        return result;
      } catch (error: unknown) {
        if (!isDuplicateKey(error)) throw error;
        const ack = await operations.findOne({ ownerId, operationId });
        if (ack) {
          if (ack.fingerprint !== fingerprint)
            throw new ApiError('VALIDATION_ERROR', 'Operation ID reused');
          return { revision: ack.revision, conflict: false };
        }
        const current = await projects.findOne({ id });
        if (current && current.ownerId !== ownerId)
          throw new ApiError('NOT_FOUND', 'Project not found');
        if (current && current.revision !== baseRevision)
          return { revision: current.revision, conflict: true };
        throw error;
      } finally {
        await session.endSession();
      }
    },
  };
  return {
    ready: () => repository.ready(),
    list: (ownerId) => guardMongo(() => repository.list(ownerId)),
    get: (ownerId, id) => guardMongo(() => repository.get(ownerId, id)),
    getChunk: (ownerId, id) => guardMongo(() => repository.getChunk(ownerId, id)),
    putChunk: (ownerId, chunk) => guardMongo(() => repository.putChunk(ownerId, chunk)),
    commit: (ownerId, id, operationId, baseRevision, snapshot) =>
      guardMongo(() => repository.commit(ownerId, id, operationId, baseRevision, snapshot)),
  };
}
