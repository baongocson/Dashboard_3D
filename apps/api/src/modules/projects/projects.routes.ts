import { z } from 'zod';
import { chunkReferenceSchema, syncCommitSchema } from '@dashboard/contracts';
import type { FastifyInstance } from 'fastify';
import { requireUserId } from '../auth/auth.module.js';
import { ApiError } from '../../shared/api-error.js';
import { verifyChunk, verifySnapshot, type ProjectStore } from './project-store.js';

export function registerProjectRoutes(app: FastifyInstance, store: ProjectStore | undefined) {
  const ready = () => {
    if (!store) throw new ApiError('DATABASE_UNAVAILABLE', 'MongoDB storage is not configured');
    return store;
  };
  app.get('/projects', { preHandler: app.requireAuth }, async (req) => {
    const rows = await ready().list(requireUserId(req));
    return rows.map(({ snapshot, revision, updatedAt }) => ({
      project: snapshot.project,
      revision,
      updatedAt,
    }));
  });
  app.get('/projects/:id', { preHandler: app.requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const project = await ready().get(requireUserId(req), id);
    if (!project) throw new ApiError('NOT_FOUND', 'Project not found');
    return project;
  });
  app.get('/projects/:id/chunks/:chunkId', { preHandler: app.requireAuth }, async (req) => {
    const { id, chunkId } = z.object({ id: z.string(), chunkId: z.string() }).parse(req.params);
    const ownerId = requireUserId(req),
      repo = ready(),
      project = await repo.get(ownerId, id);
    if (!project || !project.snapshot.manifests.some((m) => m.chunks.some((c) => c.id === chunkId)))
      throw new ApiError('NOT_FOUND', 'Chunk not found');
    const chunk = await repo.getChunk(ownerId, chunkId);
    if (!chunk) throw new ApiError('NOT_FOUND', 'Chunk not found');
    return chunk;
  });
  app.put(
    '/sync/chunks/:chunkId',
    { preHandler: app.requireAuth, bodyLimit: 1_500_000 },
    async (req) => {
      const { chunkId } = z.object({ chunkId: z.string() }).parse(req.params);
      const chunk = verifyChunk(req.body);
      if (chunk.id !== chunkId) throw new ApiError('VALIDATION_ERROR', 'Chunk ID mismatch');
      await ready().putChunk(requireUserId(req), chunk);
      return { accepted: true };
    },
  );
  app.post('/sync/missing', { preHandler: app.requireAuth }, async (req) => {
    const references = z.array(chunkReferenceSchema).max(200).parse(req.body);
    const ownerId = requireUserId(req),
      repo = ready();
    const missing: string[] = [];
    for (const reference of references) {
      const chunk = await repo.getChunk(ownerId, reference.id);
      if (!chunk || chunk.bytes !== reference.bytes || chunk.sha256 !== reference.sha256)
        missing.push(reference.id);
    }
    return { missing };
  });
  app.post(
    '/sync/:id/commit',
    { preHandler: app.requireAuth, bodyLimit: 4_000_000 },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params),
        input = syncCommitSchema.parse(req.body),
        ownerId = requireUserId(req),
        repo = ready();
      if (input.snapshot.project.id !== id || input.snapshot.project.ownerId !== ownerId)
        throw new ApiError('NOT_FOUND', 'Project not found');
      await verifySnapshot(repo, ownerId, input.snapshot);
      const result = await repo.commit(
        ownerId,
        id,
        input.operationId,
        input.baseRevision,
        input.snapshot,
      );
      return reply.status(result.conflict ? 409 : 200).send(result);
    },
  );
}
