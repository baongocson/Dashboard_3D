import {
  MongoClient,
  MongoNetworkError,
  MongoNetworkTimeoutError,
  MongoNotConnectedError,
  MongoServerError,
  MongoTopologyClosedError,
} from 'mongodb';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { MemoryAuthSessionRepository } from '../modules/auth/session-repository.js';
import { MemoryUserRepository } from '../modules/users/memory-user-repository.js';
import { MongoUserRepository } from '../modules/users/mongo-user-repository.js';
import type { UserRepository } from '../modules/users/user-repository.js';
import { DatabaseUnavailableError } from './api-error.js';
import { guardMongo, isMongoUnavailable } from './mongo-errors.js';

const fail = (error: Error) => () => Promise.reject(error);

describe('MongoDB error classification', () => {
  it.each([
    ['network', new MongoNetworkError('socket closed')],
    ['network timeout', new MongoNetworkTimeoutError('timed out')],
    ['client not connected', new MongoNotConnectedError('not connected')],
    ['topology closed', new MongoTopologyClosedError()],
    [
      'retryable server error',
      new MongoServerError({
        message: 'not primary',
        code: 10107,
        errorLabels: ['RetryableWriteError'],
      }),
    ],
  ])('treats %s as database unavailable (503)', async (_label, error) => {
    expect(isMongoUnavailable(error)).toBe(true);
    await expect(guardMongo(fail(error))).rejects.toBeInstanceOf(DatabaseUnavailableError);
  });

  it.each([
    [
      'unauthorized (missing privilege)',
      new MongoServerError({ message: 'not authorized', code: 13 }),
    ],
    ['document validation', new MongoServerError({ message: 'validation failed', code: 121 })],
    ['programming error', new TypeError('x is undefined')],
  ])('rethrows %s unchanged instead of hiding it as 503', async (_label, error) => {
    expect(isMongoUnavailable(error)).toBe(false);
    await expect(guardMongo(fail(error))).rejects.toBe(error);
  });

  it('maps duplicate keys only when the caller asks to', async () => {
    const duplicate = new MongoServerError({ message: 'E11000', code: 11000 });
    const mapped = new Error('taken');
    await expect(guardMongo(fail(duplicate), () => mapped)).rejects.toBe(mapped);
    await expect(guardMongo(fail(duplicate))).rejects.toBe(duplicate);
  });
});

describe('API response for storage failures', () => {
  async function login(users: UserRepository) {
    const app = createApp({
      logger: false,
      authStores: { users, sessions: new MemoryAuthSessionRepository() },
      auth: { scryptParams: { N: 2 ** 10, r: 8, p: 1 } },
    });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: 'http://localhost:4173' },
        payload: { username: 'alice', password: 'correct horse battery' },
      });
      return { status: response.statusCode, body: response.body };
    } finally {
      await app.close();
    }
  }

  it('answers 503 DATABASE_UNAVAILABLE when the real driver cannot reach MongoDB', async () => {
    // Nothing listens on port 1: the driver itself raises MongoServerSelectionError.
    const client = new MongoClient('mongodb://127.0.0.1:1', { serverSelectionTimeoutMS: 300 });
    try {
      const { status, body } = await login(new MongoUserRepository(client.db('unreachable')));
      expect(status).toBe(503);
      expect(JSON.parse(body)).toEqual({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is unavailable, please retry later',
        },
      });
    } finally {
      await client.close();
    }
  });

  it('answers 500 INTERNAL_ERROR for bugs, without leaking internals', async () => {
    const users = new MemoryUserRepository();
    users.findByNormalizedUsername = () =>
      guardMongo(fail(new MongoServerError({ message: 'not authorized on secretdb', code: 13 })));
    const { status, body } = await login(users);
    expect(status).toBe(500);
    expect(JSON.parse(body)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
