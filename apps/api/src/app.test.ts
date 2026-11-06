import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('foundation API', () => {
  it('does not report Atlas readiness from a liveness response', async () => {
    const app = createApp({ logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      const body: unknown = response.json();
      expect(body).toEqual({ status: 'ok', database: 'not-configured', syncReady: false });
    } finally {
      await app.close();
    }
  });

  it('never fakes accounts when MongoDB is not configured', async () => {
    const app = createApp({ logger: false });
    try {
      for (const url of ['/auth/register', '/auth/login']) {
        const response = await app.inject({
          method: 'POST',
          url,
          headers: { origin: 'http://localhost:4173' },
          payload: { username: 'alice', password: 'correct horse battery' },
        });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({ error: { code: 'DATABASE_UNAVAILABLE' } });
        expect(response.headers['set-cookie']).toBeUndefined();
      }
    } finally {
      await app.close();
    }
  });
});
