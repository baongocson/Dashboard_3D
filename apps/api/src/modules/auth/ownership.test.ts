// Ownership pattern for business modules (projects, datasets, versions, sessions, charts, sync).
// The `/test-notes` routes exist ONLY in this test: they mimic how a module should combine
// `app.requireAuth`, `requireUserId` and `requireOwned`. Real project ownership still has to be
// tested against Tuấn's routes once they exist.
import { randomUUID } from 'node:crypto';
import { authSessionResponseSchema } from '@dashboard/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { MemoryUserRepository } from '../users/memory-user-repository.js';
import { requireOwned, requireUserId } from './auth.module.js';
import { MemoryAuthSessionRepository } from './session-repository.js';

const ORIGIN = 'http://localhost:4173';
const PASSWORD = 'correct horse battery';

interface Note {
  id: string;
  ownerId: string;
  text: string;
}

let app: ReturnType<typeof createApp> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

function setup() {
  const notes = new Map<string, Note>();
  const instance = createApp({
    logger: false,
    authStores: { users: new MemoryUserRepository(), sessions: new MemoryAuthSessionRepository() },
    auth: { scryptParams: { N: 2 ** 10, r: 8, p: 1 } },
  });
  app = instance;

  void instance.register(
    (scope, _options, done) => {
      scope.addHook('preHandler', instance.requireAuth);
      // List: filter by owner in the query itself.
      scope.get('/', (request) => ({
        notes: [...notes.values()].filter((note) => note.ownerId === requireUserId(request)),
      }));
      // Create: ownerId always comes from the session, never from the body.
      scope.post<{ Body: { text: string; ownerId?: string } }>('/', async (request, reply) => {
        const note: Note = {
          id: randomUUID(),
          ownerId: requireUserId(request),
          text: request.body.text,
        };
        notes.set(note.id, note);
        return reply.status(201).send({ note });
      });
      // Read/update/delete by ID: load, then requireOwned.
      scope.get<{ Params: { id: string } }>('/:id', (request) => ({
        note: requireOwned(request, notes.get(request.params.id)),
      }));
      scope.patch<{ Params: { id: string }; Body: { text: string } }>('/:id', (request) => {
        const note = requireOwned(request, notes.get(request.params.id));
        note.text = request.body.text;
        return { note };
      });
      scope.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const note = requireOwned(request, notes.get(request.params.id));
        notes.delete(note.id);
        return reply.status(204).send();
      });
      done();
    },
    { prefix: '/test-notes' },
  );

  async function account(username: string) {
    const headers = { origin: ORIGIN };
    const payload = { username, password: PASSWORD };
    await instance.inject({ method: 'POST', url: '/auth/register', headers, payload });
    const login = await instance.inject({ method: 'POST', url: '/auth/login', headers, payload });
    const cookie = String(login.headers['set-cookie']).split(';')[0] ?? '';
    const { csrfToken, user } = authSessionResponseSchema.parse(login.json());
    const as = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: object) =>
      instance.inject({
        method,
        url,
        headers: { origin: ORIGIN, cookie, 'x-csrf-token': csrfToken },
        ...(body ? { payload: body } : {}),
      });
    return { user, as, cookie };
  }
  return { instance, notes, account };
}

describe('ownership pattern for business modules', () => {
  it('isolates two accounts: foreign resources are 404 for read, update and delete', async () => {
    const t = setup();
    const alice = await t.account('alice');
    const bob = await t.account('bob');
    const created = await alice.as('POST', '/test-notes', { text: 'alice only' });
    expect(created.statusCode).toBe(201);
    const { note } = created.json<{ note: Note }>();
    expect(note.ownerId).toBe(alice.user.id);

    expect((await bob.as('GET', '/test-notes')).json()).toEqual({ notes: [] });
    for (const [method, body] of [['GET'], ['PATCH', { text: 'hacked' }], ['DELETE']] as const) {
      const response = await bob.as(method, `/test-notes/${note.id}`, body);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }
    // A foreign ID and a non-existent ID are indistinguishable.
    const missing = await bob.as('GET', `/test-notes/${randomUUID()}`);
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toBe((await bob.as('GET', `/test-notes/${note.id}`)).body);

    expect(t.notes.get(note.id)?.text).toBe('alice only');
    expect((await alice.as('GET', `/test-notes/${note.id}`)).statusCode).toBe(200);
  });

  it('ignores an ownerId sent by the client', async () => {
    const t = setup();
    const alice = await t.account('alice');
    const bob = await t.account('bob');
    const response = await bob.as('POST', '/test-notes', { text: 'x', ownerId: alice.user.id });
    expect(response.json<{ note: Note }>().note.ownerId).toBe(bob.user.id);
    expect((await alice.as('GET', '/test-notes')).json()).toEqual({ notes: [] });
  });

  it('protects every route of the module with login and CSRF', async () => {
    const t = setup();
    const alice = await t.account('alice');
    const { note } = (await alice.as('POST', '/test-notes', { text: 'x' })).json<{ note: Note }>();

    const anonymous = await t.instance.inject({ method: 'GET', url: '/test-notes' });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });

    const forged = await t.instance.inject({
      method: 'DELETE',
      url: `/test-notes/${note.id}`,
      headers: { origin: ORIGIN, cookie: 'dashboard_session=forged' },
    });
    expect(forged.statusCode).toBe(401);

    // Real session cookie but no CSRF token (e.g. a cross-site request that carried the cookie).
    const noCsrf = await t.instance.inject({
      method: 'DELETE',
      url: `/test-notes/${note.id}`,
      headers: { origin: ORIGIN, cookie: alice.cookie },
    });
    expect(noCsrf.statusCode).toBe(403);
    expect(noCsrf.json()).toMatchObject({ error: { code: 'CSRF_INVALID' } });
    expect(t.notes.has(note.id)).toBe(true);
  });
});
