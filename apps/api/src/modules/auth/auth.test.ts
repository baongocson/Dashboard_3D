// API tests for accounts. Storage is the labeled in-memory TEST DOUBLE:
// these tests do NOT verify MongoDB/Atlas (see mongo.integration.test.ts).
import { authSessionResponseSchema, publicUserSchema } from '@dashboard/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { MemoryUserRepository } from '../users/memory-user-repository.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { MemoryAuthSessionRepository } from './session-repository.js';

const ORIGIN = 'http://localhost:4173';
const PASSWORD = 'correct horse battery';
const HOUR = 60 * 60 * 1000;
const FAST_SCRYPT = { N: 2 ** 10, r: 8, p: 1 };

it('reserves rate limit slots before concurrent password checks', async () => {
  const t = setup();
  await t.register('Concurrent');
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => t.login('Concurrent', 'wrong password value')),
  );
  expect(responses.filter((r) => r.statusCode === 401)).toHaveLength(5);
  expect(responses.filter((r) => r.statusCode === 429)).toHaveLength(15);
});
it('rejected CSRF mutation does not extend idle expiry', async () => {
  const t = setup();
  await t.register('Alice');
  const login = await t.signIn('Alice');
  t.advance(2 * HOUR);
  expect(
    (
      await t.app.inject({
        method: 'PATCH',
        url: '/users/me',
        payload: { displayName: 'Name' },
        headers: { origin: ORIGIN, cookie: login.cookie, 'x-csrf-token': 'invalid' },
      })
    ).statusCode,
  ).toBe(403);
  const probe = await t.app.inject({
    url: '/auth/session',
    headers: { cookie: login.cookie, 'x-session-activity': 'background' },
  });
  expect(authSessionResponseSchema.parse(probe.json()).idleExpiresAt).toBe(
    login.body.idleExpiresAt,
  );
});
it('rejects unpaired Unicode surrogates at registration', async () => {
  const t = setup();
  expect((await t.register('Unicode', 'valid-length-password\ud800')).statusCode).toBe(400);
});

type App = ReturnType<typeof createApp>;
const apps: App[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function setup(options: { origins?: string[]; ip?: string } = {}) {
  const clock = { now: new Date('2026-11-06T00:00:00.000Z') };
  const users = new MemoryUserRepository();
  const sessions = new MemoryAuthSessionRepository();
  const app = createApp({
    logger: false,
    allowedOrigins: options.origins ?? [ORIGIN],
    authStores: { users, sessions },
    sessionSecret: 'test-secret-test-secret-test-secret',
    auth: {
      now: () => clock.now,
      scryptParams: FAST_SCRYPT,
      rateLimiter: new LoginRateLimiter({
        windowMs: 15 * 60 * 1000,
        maxFailuresPerAccount: 5,
        maxFailuresPerIp: 50,
      }),
    },
  });
  apps.push(app);
  const origin = options.origins?.[0] ?? ORIGIN;

  const post = (url: string, payload: unknown, extra: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url, payload: payload as object, headers: { origin, ...extra } });
  const register = (username: string, password = PASSWORD) =>
    post('/auth/register', { username, password });
  const login = (username: string, password = PASSWORD, extra: Record<string, string> = {}) =>
    post('/auth/login', { username, password }, extra);
  async function signIn(username: string) {
    const response = await login(username);
    expect(response.statusCode).toBe(200);
    const cookie = sessionCookie(response.headers['set-cookie']);
    const body = authSessionResponseSchema.parse(response.json());
    return { cookie, csrfToken: body.csrfToken, body };
  }
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  return { app, users, sessions, post, register, login, signIn, advance, origin };
}

function sessionCookie(header: string | string[] | number | undefined): string {
  const values = Array.isArray(header) ? header : [String(header)];
  const value = values.find((item) => item.startsWith('dashboard_session='));
  if (!value) throw new Error('no session cookie');
  const pair = value.split(';')[0];
  if (!pair) throw new Error('bad cookie');
  return pair;
}

describe('registration', () => {
  it('creates an account usable immediately but does not log in', async () => {
    const t = setup();
    const response = await t.register('Alice.B-1_');
    expect(response.statusCode).toBe(201);
    const body = response.json<{ user: unknown }>();
    expect(publicUserSchema.parse(body.user)).toMatchObject({
      username: 'Alice.B-1_',
      displayName: 'Alice.B-1_',
    });
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await t.login('alice.b-1_')).statusCode).toBe(200);
  });

  it('stores only a salted scrypt hash, never the password', async () => {
    const t = setup();
    await t.register('alice');
    await t.register('bob');
    const alice = await t.users.findByNormalizedUsername('alice');
    const bob = await t.users.findByNormalizedUsername('bob');
    expect(alice?.passwordHash).toMatch(/^scrypt\$v1\$/);
    expect(alice?.passwordHash).not.toContain(PASSWORD);
    expect(alice?.passwordHash).not.toBe(bob?.passwordHash);
  });

  it.each([
    { label: 'missing fields', payload: {} },
    { label: 'missing password', payload: { username: 'alice' } },
    { label: 'username too short', payload: { username: 'ab', password: PASSWORD } },
    { label: 'username too long', payload: { username: 'a'.repeat(31), password: PASSWORD } },
    { label: 'space in username', payload: { username: 'alice smith', password: PASSWORD } },
    { label: 'non-ASCII username', payload: { username: 'nguyễn', password: PASSWORD } },
    { label: 'password 14 chars', payload: { username: 'alice', password: 'x'.repeat(14) } },
    { label: 'password 129 chars', payload: { username: 'alice', password: 'x'.repeat(129) } },
    {
      label: '14 code points (28 UTF-16 units)',
      payload: { username: 'alice', password: '😀'.repeat(14) },
    },
    {
      label: 'extra email field',
      payload: { username: 'alice', password: PASSWORD, email: 'a@b.c' },
    },
  ])('rejects invalid input: $label', async ({ payload }) => {
    const t = setup();
    const response = await t.post('/auth/register', payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(t.users.size).toBe(0);
  });

  it('accepts boundary lengths, Unicode and whitespace in passwords exactly as typed', async () => {
    const t = setup();
    expect((await t.register('abc', 'x'.repeat(15))).statusCode).toBe(201);
    expect((await t.register('a'.repeat(30), 'x'.repeat(128))).statusCode).toBe(201);
    expect((await t.register('emoji', '😀'.repeat(15))).statusCode).toBe(201);
    expect((await t.register('spaces', '  Mật khẩu có dấu  ')).statusCode).toBe(201);
    expect((await t.login('spaces', '  Mật khẩu có dấu  ')).statusCode).toBe(200);
    expect((await t.login('spaces', 'Mật khẩu có dấu')).statusCode).toBe(401);
    expect((await t.login('spaces', '  MẬT KHẨU CÓ DẤU  ')).statusCode).toBe(401);
  });

  it('rejects duplicates after trim + case-insensitive normalization', async () => {
    const t = setup();
    expect((await t.register('Alice')).statusCode).toBe(201);
    const duplicate = await t.register('  aLiCe ');
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: 'USERNAME_TAKEN' } });
  });

  it('lets exactly one of two concurrent duplicate registrations succeed', async () => {
    const t = setup();
    const results = await Promise.all([t.register('race'), t.register('RACE')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(t.users.size).toBe(1);
  });
});

describe('login and session', () => {
  it('rejects a wrong password and an unknown user identically, without a cookie', async () => {
    const t = setup();
    await t.register('alice');
    const wrong = await t.login('alice', 'wrong password 123');
    const unknown = await t.login('nobody', PASSWORD);
    for (const response of [wrong, unknown]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect' },
      });
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('sets an HttpOnly SameSite=Lax cookie (Secure only on https) and no-store', async () => {
    const t = setup();
    await t.register('alice');
    const response = await t.login('alice');
    const raw = String(response.headers['set-cookie']);
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/SameSite=Lax/);
    expect(raw).not.toMatch(/Secure/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.json())).not.toMatch(/password|hash|dashboard_session/i);

    const secure = setup({ origins: ['https://dashboard.example'] });
    await secure.register('alice');
    expect(String((await secure.login('alice')).headers['set-cookie'])).toMatch(/Secure/);
  });

  it('reports the session to the web app and requires login otherwise', async () => {
    const t = setup();
    await t.register('alice');
    const anonymous = await t.app.inject({ method: 'GET', url: '/auth/session' });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
    const forged = await t.app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { cookie: 'dashboard_session=forged' },
    });
    expect(forged.statusCode).toBe(401);

    const { cookie, body } = await t.signIn('alice');
    const response = await t.app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(authSessionResponseSchema.parse(response.json())).toEqual(body);
    expect(body.idleExpiresAt).toBe('2026-11-07T00:00:00.000Z');
    expect(body.absoluteExpiresAt).toBe('2026-11-13T00:00:00.000Z');
  });

  it('expires after 24 h idle; user activity extends it, background requests do not', async () => {
    const t = setup();
    await t.register('alice');
    const { cookie } = await t.signIn('alice');
    const probe = (background = false) =>
      t.app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { cookie, ...(background ? { 'x-session-activity': 'background' } : {}) },
      });

    t.advance(23 * HOUR);
    expect((await probe(true)).statusCode).toBe(200); // background: no extension
    t.advance(2 * HOUR);
    const expired = await probe();
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toMatchObject({ error: { code: 'SESSION_EXPIRED' } });
    expect(String(expired.headers['set-cookie'])).toMatch(/dashboard_session=;/);

    const second = await t.signIn('alice');
    t.advance(23 * HOUR);
    const active = await t.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { cookie: second.cookie },
    });
    expect(active.statusCode).toBe(200);
    t.advance(23 * HOUR); // 46 h since login, 23 h since last activity
    expect(
      (await t.app.inject({ method: 'GET', url: '/users/me', headers: { cookie: second.cookie } }))
        .statusCode,
    ).toBe(200);
  });

  it('expires 7 days after login even with continuous activity', async () => {
    const t = setup();
    await t.register('alice');
    const { cookie } = await t.signIn('alice');
    const me = () => t.app.inject({ method: 'GET', url: '/users/me', headers: { cookie } });
    for (let hour = 12; hour < 7 * 24; hour += 12) {
      t.advance(12 * HOUR);
      expect((await me()).statusCode).toBe(200);
    }
    t.advance(12 * HOUR);
    expect((await me()).json()).toMatchObject({ error: { code: 'SESSION_EXPIRED' } });
  });

  it('logout revokes the session server-side and is idempotent', async () => {
    const t = setup();
    await t.register('alice');
    const { cookie } = await t.signIn('alice');
    const out = await t.post('/auth/logout', undefined, { cookie });
    expect(out.statusCode).toBe(204);
    expect(String(out.headers['set-cookie'])).toMatch(/dashboard_session=;/);
    // The old cookie (e.g. kept by another tab) no longer works.
    const reused = await t.app.inject({ method: 'GET', url: '/auth/session', headers: { cookie } });
    expect(reused.json()).toMatchObject({ error: { code: 'SESSION_EXPIRED' } });
    // Replaying a revocation queued offline, or logging out with no session, still succeeds.
    expect((await t.post('/auth/logout', undefined, { cookie })).statusCode).toBe(204);
    expect((await t.post('/auth/logout', undefined)).statusCode).toBe(204);
  });

  it('a new login on the same browser revokes the previous session', async () => {
    const t = setup();
    await t.register('alice');
    await t.register('bob');
    const first = await t.signIn('alice');
    const second = await t.login('bob', PASSWORD, { cookie: first.cookie });
    expect(second.statusCode).toBe(200);
    const old = await t.app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { cookie: first.cookie },
    });
    expect(old.statusCode).toBe(401);
  });
});

describe('request protection', () => {
  it('rejects state-changing requests without an allowed Origin', async () => {
    const t = setup();
    const missing = await t.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'alice', password: PASSWORD },
    });
    const foreign = await t.post(
      '/auth/register',
      { username: 'alice', password: PASSWORD },
      { origin: 'https://evil.example' },
    );
    for (const response of [missing, foreign]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'ORIGIN_REJECTED' } });
    }
    expect(t.users.size).toBe(0);
  });

  it('allows CORS with credentials only for the configured origin', async () => {
    const t = setup();
    const preflight = (origin: string) =>
      t.app.inject({
        method: 'OPTIONS',
        url: '/users/me',
        headers: {
          origin,
          'access-control-request-method': 'PATCH',
          'access-control-request-headers': 'content-type,x-csrf-token',
        },
      });
    const allowed = await preflight(ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect((await preflight('https://evil.example')).headers['access-control-allow-origin']).toBe(
      undefined,
    );
  });

  it('requires the session CSRF token on authenticated mutations', async () => {
    const t = setup();
    await t.register('alice');
    await t.register('bob');
    const alice = await t.signIn('alice');
    const bob = await t.signIn('bob');
    const patch = (headers: Record<string, string>) =>
      t.app.inject({
        method: 'PATCH',
        url: '/users/me',
        payload: { displayName: 'Alice A.' },
        headers: { origin: ORIGIN, cookie: alice.cookie, ...headers },
      });
    for (const headers of [{}, { 'x-csrf-token': 'wrong' }, { 'x-csrf-token': bob.csrfToken }]) {
      const response = await patch(headers);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: 'CSRF_INVALID' } });
    }
    const ok = await patch({ 'x-csrf-token': alice.csrfToken });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ user: { username: 'alice', displayName: 'Alice A.' } });
  });

  it('protects /users/me and keeps two accounts separate', async () => {
    const t = setup();
    expect((await t.app.inject({ method: 'GET', url: '/users/me' })).statusCode).toBe(401);
    await t.register('alice');
    await t.register('bob');
    const alice = await t.signIn('alice');
    const bob = await t.signIn('bob');
    await t.app.inject({
      method: 'PATCH',
      url: '/users/me',
      payload: { displayName: 'Only Alice' },
      headers: { origin: ORIGIN, cookie: alice.cookie, 'x-csrf-token': alice.csrfToken },
    });
    const me = async (cookie: string) =>
      (await t.app.inject({ method: 'GET', url: '/users/me', headers: { cookie } })).json<{
        user: { username: string; displayName: string };
      }>().user;
    expect(await me(alice.cookie)).toMatchObject({ username: 'alice', displayName: 'Only Alice' });
    expect(await me(bob.cookie)).toMatchObject({ username: 'bob', displayName: 'bob' });
  });

  it('limits failed logins per account+IP, then allows retry after the window', async () => {
    const t = setup();
    await t.register('alice');
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect((await t.login('alice', 'wrong password 123')).statusCode).toBe(401);
    const blocked = await t.login('ALICE'); // correct password, normalized username
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({
      error: { code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 900 },
    });
    expect(blocked.headers['retry-after']).toBe('900');
    expect(blocked.headers['set-cookie']).toBeUndefined();
    // Another account from the same IP is unaffected.
    await t.register('bob');
    expect((await t.login('bob')).statusCode).toBe(200);
    t.advance(15 * 60 * 1000);
    expect((await t.login('alice')).statusCode).toBe(200);
  });
});
