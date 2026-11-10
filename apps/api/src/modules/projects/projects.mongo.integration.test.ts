import { setServers } from 'node:dns';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMongoProjectStore, verifySnapshot, type ProjectStore } from './project-store.js';
import { snapshotFixture } from '../../../../../tests/support/snapshot.js';

if (process.env.MONGODB_TEST_DNS) setServers(process.env.MONGODB_TEST_DNS.split(','));
const uri = process.env.MONGODB_TEST_URI?.trim() || undefined;
describe.skipIf(!uri)('real MongoDB chunk publication and idempotency', () => {
  const client = new MongoClient(uri ?? 'mongodb://unused', { serverSelectionTimeoutMS: 20_000 });
  const database = client.db(process.env.MONGODB_TEST_DB_NAME ?? 'dashboard_dev');
  const ownerId = `integration-${randomUUID()}`,
    prefix = randomUUID();
  let store: ProjectStore;
  let connected = false;
  const { snapshot, chunk } = snapshotFixture(ownerId, prefix);
  beforeAll(async () => {
    await client.connect();
    connected = true;
    store = await createMongoProjectStore(client, database);
  }, 30_000);
  afterAll(async () => {
    if (connected)
      await Promise.all(
        ['projects', 'datasetChunks', 'syncOperations'].map((name) =>
          database.collection(name).deleteMany({ ownerId }),
        ),
      );
    await client.close();
  }, 20_000);
  it('verifies chunk completeness; atomically publishes and replays a lost ACK', async () => {
    await expect(verifySnapshot(store, ownerId, snapshot)).rejects.toThrow('Missing');
    await store.putChunk(ownerId, chunk);
    await verifySnapshot(store, ownerId, snapshot);
    expect(await store.commit(ownerId, snapshot.project.id, `${prefix}-op1`, 0, snapshot)).toEqual({
      revision: 1,
      conflict: false,
    });
    expect(await store.commit(ownerId, snapshot.project.id, `${prefix}-op2`, 1, snapshot)).toEqual({
      revision: 2,
      conflict: false,
    });
    expect(await store.commit(ownerId, snapshot.project.id, `${prefix}-op1`, 0, snapshot)).toEqual({
      revision: 1,
      conflict: false,
    });
    expect(
      await store.commit(ownerId, snapshot.project.id, `${prefix}-stale`, 0, snapshot),
    ).toEqual({ revision: 2, conflict: true });
    expect(await store.get('other-account', snapshot.project.id)).toBeNull();
    expect((await store.get(ownerId, snapshot.project.id))?.revision).toBe(2);
  }, 30_000);
  it('handles concurrent first publication and duplicate operation delivery', async () => {
    const race = snapshotFixture(ownerId, `${prefix}-race`);
    await store.putChunk(ownerId, race.chunk);
    await verifySnapshot(store, ownerId, race.snapshot);
    const outcomes = await Promise.all(
      ['a', 'b'].map((suffix) =>
        store.commit(
          ownerId,
          race.snapshot.project.id,
          `${prefix}-race-${suffix}`,
          0,
          race.snapshot,
        ),
      ),
    );
    expect(outcomes.filter((r) => r.conflict)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.conflict)).toHaveLength(1);
    const replay = snapshotFixture(ownerId, `${prefix}-replay`);
    await Promise.all([
      store.putChunk(ownerId, replay.chunk),
      store.putChunk(ownerId, replay.chunk),
    ]);
    const repeated = await Promise.all([
      store.commit(ownerId, replay.snapshot.project.id, `${prefix}-repeated`, 0, replay.snapshot),
      store.commit(ownerId, replay.snapshot.project.id, `${prefix}-repeated`, 0, replay.snapshot),
    ]);
    expect(repeated).toEqual([
      { revision: 1, conflict: false },
      { revision: 1, conflict: false },
    ]);
  }, 30_000);
});
