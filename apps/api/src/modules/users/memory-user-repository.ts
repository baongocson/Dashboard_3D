import { randomUUID } from 'node:crypto';
import {
  UsernameTakenError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from './user-repository.js';

/**
 * TEST DOUBLE — in-process memory only, lost on restart. Used by unit/API tests.
 * Passing tests with this repository does NOT verify MongoDB/Atlas persistence.
 */
export class MemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>();
  private readonly idByUsername = new Map<string, string>();

  create(user: NewUser, now: Date): Promise<UserRecord> {
    // Check-and-insert runs synchronously, emulating a unique index.
    if (this.idByUsername.has(user.usernameNormalized))
      return Promise.reject(new UsernameTakenError());
    const record: UserRecord = { ...user, id: randomUUID(), createdAt: now, updatedAt: now };
    this.byId.set(record.id, record);
    this.idByUsername.set(record.usernameNormalized, record.id);
    return Promise.resolve({ ...record });
  }

  findById(id: string): Promise<UserRecord | null> {
    const record = this.byId.get(id);
    return Promise.resolve(record ? { ...record } : null);
  }

  findByNormalizedUsername(usernameNormalized: string): Promise<UserRecord | null> {
    const id = this.idByUsername.get(usernameNormalized);
    return id === undefined ? Promise.resolve(null) : this.findById(id);
  }

  updateDisplayName(id: string, displayName: string, now: Date): Promise<UserRecord | null> {
    const record = this.byId.get(id);
    if (!record) return Promise.resolve(null);
    record.displayName = displayName;
    record.updatedAt = now;
    return Promise.resolve({ ...record });
  }

  /** Test helper: number of stored accounts. */
  get size(): number {
    return this.byId.size;
  }
}
