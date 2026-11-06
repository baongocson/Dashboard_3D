import { randomUUID } from 'node:crypto';
import { MongoServerError, type Collection, type Db } from 'mongodb';
import { DatabaseUnavailableError } from '../auth/api-error.js';
import {
  UsernameTakenError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from './user-repository.js';

export const USERS_COLLECTION = 'users';

interface UserDocument extends Omit<UserRecord, 'id'> {
  _id: string;
}

const DUPLICATE_KEY = 11000;

function fromDocument({ _id, ...rest }: UserDocument): UserRecord {
  return { id: _id, ...rest };
}

/** Wrap driver errors: duplicates become UsernameTakenError, other failures DatabaseUnavailableError. */
async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof MongoServerError && error.code === DUPLICATE_KEY)
      throw new UsernameTakenError();
    throw new DatabaseUnavailableError(error);
  }
}

export class MongoUserRepository implements UserRepository {
  private readonly users: Collection<UserDocument>;

  constructor(db: Db) {
    this.users = db.collection<UserDocument>(USERS_COLLECTION);
  }

  /** Unique index on the normalized username: the source of truth for duplicate registrations. */
  async ensureIndexes(): Promise<void> {
    await guard(() =>
      this.users.createIndexes([
        { key: { usernameNormalized: 1 }, unique: true, name: 'users_usernameNormalized_unique' },
      ]),
    );
  }

  async create(user: NewUser, now: Date): Promise<UserRecord> {
    const document: UserDocument = { _id: randomUUID(), ...user, createdAt: now, updatedAt: now };
    await guard(() => this.users.insertOne(document));
    return fromDocument(document);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const document = await guard(() => this.users.findOne({ _id: id }));
    return document ? fromDocument(document) : null;
  }

  async findByNormalizedUsername(usernameNormalized: string): Promise<UserRecord | null> {
    const document = await guard(() => this.users.findOne({ usernameNormalized }));
    return document ? fromDocument(document) : null;
  }

  async updateDisplayName(id: string, displayName: string, now: Date): Promise<UserRecord | null> {
    const document = await guard(() =>
      this.users.findOneAndUpdate(
        { _id: id },
        { $set: { displayName, updatedAt: now } },
        { returnDocument: 'after' },
      ),
    );
    return document ? fromDocument(document) : null;
  }
}
