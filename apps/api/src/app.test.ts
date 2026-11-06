import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('foundation API', () => {
  it('does not report Atlas readiness from a liveness response', async () => {
    const app = createApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      const body: unknown = response.json();
      expect(body).toEqual({ status: 'ok', database: 'not-configured', syncReady: false });
      expect(
        (await app.inject({ method: 'POST', url: '/auth/login', payload: {} })).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
});
