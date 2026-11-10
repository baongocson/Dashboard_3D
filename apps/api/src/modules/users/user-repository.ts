import type { PublicUser } from '@dashboard/contracts';

export interface UserRecord {
  id: string;
  /** Trimmed username as the user typed it (kept for display). */
  username: string;
  /** Unique key: see `normalizeUsername` in contracts. */
  usernameNormalized: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
export type NewUser = Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>;

export class UsernameTakenError extends Error {
  constructor() {
    super('Username is already taken');
    this.name = 'UsernameTakenError';
  }
}

/**
 * Storage port for accounts. `create` must be atomic on `usernameNormalized`
 * (MongoDB: unique index) so two concurrent registrations cannot both succeed.
 * Implementations throw `DatabaseUnavailableError` when storage cannot be reached.
 */
export interface UserRepository {
  create(user: NewUser, now: Date): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByNormalizedUsername(usernameNormalized: string): Promise<UserRecord | null>;
  updateDisplayName(id: string, displayName: string, now: Date): Promise<UserRecord | null>;
}

/** Only these fields ever leave the API; passwordHash never does. */
export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, displayName: user.displayName };
}
