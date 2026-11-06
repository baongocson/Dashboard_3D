import type { Collection, Db } from 'mongodb';
import { DatabaseUnavailableError } from './api-error.js';

/**
 * Login session (phiên đăng nhập) — not the data-processing work session in modules/sessions.
 * The cookie token itself is never stored; only an HMAC of it.
 */
export interface AuthSessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  csrfToken: string;
  createdAt: Date;
  lastActivityAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthSessionRepository {
  create(session: AuthSessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  touch(id: string, lastActivityAt: Date, idleExpiresAt: Date): Promise<void>;
  revoke(id: string, revokedAt: Date): Promise<void>;
}

/** TEST DOUBLE — memory only. Does NOT verify MongoDB/Atlas persistence. */
export class MemoryAuthSessionRepository implements AuthSessionRepository {
  private readonly byTokenHash = new Map<string, AuthSessionRecord>();

  create(session: AuthSessionRecord): Promise<void> {
    this.byTokenHash.set(session.tokenHash, { ...session });
    return Promise.resolve();
  }
  findByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const session = this.byTokenHash.get(tokenHash);
    return Promise.resolve(session ? { ...session } : null);
  }
  touch(id: string, lastActivityAt: Date, idleExpiresAt: Date): Promise<void> {
    for (const session of this.byTokenHash.values())
      if (session.id === id) Object.assign(session, { lastActivityAt, idleExpiresAt });
    return Promise.resolve();
  }
  revoke(id: string, revokedAt: Date): Promise<void> {
    for (const session of this.byTokenHash.values())
      if (session.id === id && session.revokedAt === null) session.revokedAt = revokedAt;
    return Promise.resolve();
  }
}

export const AUTH_SESSIONS_COLLECTION = 'auth_sessions';
interface AuthSessionDocument extends Omit<AuthSessionRecord, 'id'> {
  _id: string;
}

async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    throw new DatabaseUnavailableError(error);
  }
}

export class MongoAuthSessionRepository implements AuthSessionRepository {
  private readonly sessions: Collection<AuthSessionDocument>;
  constructor(db: Db) {
    this.sessions = db.collection<AuthSessionDocument>(AUTH_SESSIONS_COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    await guard(() =>
      this.sessions.createIndexes([
        { key: { tokenHash: 1 }, unique: true, name: 'auth_sessions_tokenHash_unique' },
        { key: { userId: 1 }, name: 'auth_sessions_userId' },
        // Housekeeping only: validity is always checked in code against the server clock.
        { key: { absoluteExpiresAt: 1 }, expireAfterSeconds: 0, name: 'auth_sessions_ttl' },
      ]),
    );
  }

  async create({ id, ...rest }: AuthSessionRecord): Promise<void> {
    await guard(() => this.sessions.insertOne({ _id: id, ...rest }));
  }
  async findByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const document = await guard(() => this.sessions.findOne({ tokenHash }));
    if (!document) return null;
    const { _id, ...rest } = document;
    return { id: _id, ...rest };
  }
  async touch(id: string, lastActivityAt: Date, idleExpiresAt: Date): Promise<void> {
    await guard(() =>
      this.sessions.updateOne(
        { _id: id, revokedAt: null },
        { $set: { lastActivityAt, idleExpiresAt } },
      ),
    );
  }
  async revoke(id: string, revokedAt: Date): Promise<void> {
    await guard(() =>
      this.sessions.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt } }),
    );
  }
}
