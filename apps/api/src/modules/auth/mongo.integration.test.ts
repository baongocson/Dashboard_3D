// Real MongoDB integration. Runs only when MONGODB_TEST_URI points at a disposable server
// (local mongod or an Atlas test cluster). It creates and then DROPS a uniquely named database.
// When skipped, MongoDB/Atlas account storage is NOT verified.
import { randomUUID } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createMongoAuthStores } from './stores.js';

const uri = process.env.MONGODB_TEST_URI;
const ORIGIN = 'http://localhost:4173';
const PASSWORD = 'correct horse battery';

describe.skipIf(!uri)('accounts on a real MongoDB (MONGODB_TEST_URI)', () => {
  let client: MongoClient;
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    client = new MongoClient(uri ?? '');
    await client.connect();
    db = client.db(`dashboard3d_auth_test_${randomUUID().slice(0, 8)}`);
    app = createApp({
      logger: false,
      authStores: await createMongoAuthStores(db),
      sessionSecret: 'integration-secret-integration-secret',
      auth: { scryptParams: { N: 2 ** 10, r: 8, p: 1 } },
    });
  });
  afterAll(async () => {
    await app.close();
    await db.dropDatabase();
    await client.close();
  });

  const post = (url: string, payload: object, cookie?: string) =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    });

  it('creates the unique username index', async () => {
    const indexes = await db.collection('users').indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { usernameNormalized: 1 }, unique: true }),
    );
  });

  it('enforces uniqueness for concurrent registrations via the index', async () => {
    const results = await Promise.all(
      ['Race', 'race', ' RACE '].map((username) =>
        post('/auth/register', { username, password: PASSWORD }),
      ),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409, 409]);
    expect(await db.collection('users').countDocuments({ usernameNormalized: 'race' })).toBe(1);
  });

  it('persists hash-only users and server-side sessions, and revokes on logout', async () => {
    await post('/auth/register', { username: 'persisted', password: PASSWORD });
    const stored = await db.collection('users').findOne({ usernameNormalized: 'persisted' });
    expect(stored?.passwordHash).toMatch(/^scrypt\$v1\$/);
    expect(JSON.stringify(stored)).not.toContain(PASSWORD);

    const login = await post('/auth/login', { username: 'persisted', password: PASSWORD });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0] ?? '';
    const token = cookie.split('=')[1] ?? '';
    const session = await db.collection('auth_sessions').findOne({ userId: stored?._id });
    expect(session).not.toBeNull();
    expect(JSON.stringify(session)).not.toContain(token); // only an HMAC of the token is stored

    expect((await post('/auth/logout', {}, cookie)).statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/auth/session', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });
});
