import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authSessionResponseSchema } from '@dashboard/contracts';
import { createApp } from '../../app.js';
import { MemoryUserRepository } from '../users/memory-user-repository.js';
import { MemoryAuthSessionRepository } from '../auth/session-repository.js';
import { MemoryProjectStore } from './project-store.js';
import { snapshotFixture } from '../../../../../tests/support/snapshot.js';

const origin = 'http://localhost:4173';
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp({
    logger: false,
    sessionSecret: 'test-secret-test-secret-test-secret',
    authStores: { users: new MemoryUserRepository(), sessions: new MemoryAuthSessionRepository() },
    projectStore: new MemoryProjectStore(),
    auth: { scryptParams: { N: 2 ** 10, r: 8, p: 1 } },
  });
});
afterEach(async () => {
  await app.close();
});
async function signIn(username: string) {
  const payload = { username, password: 'correct horse battery' };
  expect(
    (await app.inject({ method: 'POST', url: '/auth/register', headers: { origin }, payload }))
      .statusCode,
  ).toBe(201);
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { origin },
    payload,
  });
  const account = authSessionResponseSchema.parse(response.json());
  const cookie = `dashboard_session=${response.cookies[0]?.value ?? ''}`;
  return { account, headers: { origin, cookie, 'x-csrf-token': account.csrfToken } };
}
describe('project API and publication (explicit memory test double)', () => {
  it('requires login and CSRF; rejects malformed input without publishing', async () => {
    expect((await app.inject({ url: '/projects' })).statusCode).toBe(401);
    const { account, headers } = await signIn('Alice');
    const { chunk } = snapshotFixture(account.user.id, 'a');
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/sync/chunks/a-chunk',
          headers: { origin, cookie: headers.cookie },
          payload: chunk,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/sync/chunks/a-chunk',
          headers,
          payload: { ...chunk, data: 'invalid' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('does not publish missing chunks; commits once and replays ACK after later commits', async () => {
    const { account, headers } = await signIn('Alice');
    const { snapshot, chunk } = snapshotFixture(account.user.id, 'a');
    const commit = (operationId: string, baseRevision: number) =>
      app.inject({
        method: 'POST',
        url: '/sync/a-project/commit',
        headers,
        payload: { operationId, baseRevision, snapshot },
      });
    expect((await commit('op1', 0)).statusCode).toBe(400);
    expect(
      (await app.inject({ method: 'GET', url: '/projects/a-project', headers })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'PUT', url: '/sync/chunks/a-chunk', headers, payload: chunk }))
        .statusCode,
    ).toBe(200);
    expect((await commit('op1', 0)).json()).toEqual({ revision: 1, conflict: false });
    expect((await commit('op2', 1)).json()).toEqual({ revision: 2, conflict: false });
    expect((await commit('op1', 0)).json()).toEqual({ revision: 1, conflict: false });
    expect((await commit('stale', 0)).statusCode).toBe(409);
    const latest = await app.inject({ url: '/projects/a-project', headers });
    expect(latest.json()).toMatchObject({ revision: 2 });
  });
  it('separates ownership for list, metadata, chunks and publication', async () => {
    const alice = await signIn('Alice'),
      bob = await signIn('Bob');
    const { snapshot, chunk } = snapshotFixture(alice.account.user.id, 'a');
    await app.inject({
      method: 'PUT',
      url: '/sync/chunks/a-chunk',
      headers: alice.headers,
      payload: chunk,
    });
    await app.inject({
      method: 'POST',
      url: '/sync/a-project/commit',
      headers: alice.headers,
      payload: { snapshot, operationId: 'op1', baseRevision: 0 },
    });
    expect((await app.inject({ url: '/projects', headers: bob.headers })).json()).toEqual([]);
    expect(
      (await app.inject({ url: '/projects/a-project', headers: bob.headers })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ url: '/projects/a-project/chunks/a-chunk', headers: bob.headers }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/sync/a-project/commit',
          headers: bob.headers,
          payload: { snapshot, operationId: 'op1', baseRevision: 0 },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('rejects mismatched dataset version and changed operation content', async () => {
    const { account, headers } = await signIn('Alice');
    const { snapshot, chunk } = snapshotFixture(account.user.id, 'a');
    await app.inject({ method: 'PUT', url: '/sync/chunks/a-chunk', headers, payload: chunk });
    await app.inject({
      method: 'POST',
      url: '/sync/a-project/commit',
      headers,
      payload: { snapshot, operationId: 'op1', baseRevision: 0 },
    });
    const changed = structuredClone(snapshot);
    changed.project.name = 'Changed';
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/sync/a-project/commit',
          headers,
          payload: { snapshot: changed, operationId: 'op1', baseRevision: 0 },
        })
      ).statusCode,
    ).toBe(400);
    const wrong = structuredClone(snapshot);
    if (wrong.versions[0]) wrong.versions[0].id = 'wrong';
    wrong.session.currentVersionId = 'wrong';
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/sync/a-project/commit',
          headers,
          payload: { snapshot: wrong, operationId: 'wrong', baseRevision: 1 },
        })
      ).statusCode,
    ).toBe(400);
  });
});
