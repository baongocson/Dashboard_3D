import type { Db } from 'mongodb';
import { MongoUserRepository } from '../users/mongo-user-repository.js';
import type { UserRepository } from '../users/user-repository.js';
import { DatabaseUnavailableError } from './api-error.js';
import { MongoAuthSessionRepository, type AuthSessionRepository } from './session-repository.js';

export interface AuthStores {
  users: UserRepository;
  sessions: AuthSessionRepository;
}

const unavailable = () => Promise.reject(new DatabaseUnavailableError());

/**
 * Used when MongoDB is not configured: every account operation answers 503
 * DATABASE_UNAVAILABLE. No temporary account or fake login is ever created.
 */
export const unavailableAuthStores: AuthStores = {
  users: {
    create: unavailable,
    findById: unavailable,
    findByNormalizedUsername: unavailable,
    updateDisplayName: unavailable,
  },
  sessions: {
    create: unavailable,
    findByTokenHash: unavailable,
    touch: unavailable,
    revoke: unavailable,
  },
};

/** MongoDB adapters for accounts and login sessions; creates the indexes they rely on. */
export async function createMongoAuthStores(db: Db): Promise<AuthStores> {
  const users = new MongoUserRepository(db);
  const sessions = new MongoAuthSessionRepository(db);
  await users.ensureIndexes();
  await sessions.ensureIndexes();
  return { users, sessions };
}
