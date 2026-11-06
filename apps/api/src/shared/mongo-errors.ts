import {
  MongoNetworkError,
  MongoNotConnectedError,
  MongoServerError,
  MongoServerSelectionError,
  MongoTopologyClosedError,
} from 'mongodb';
import { DatabaseUnavailableError } from './api-error.js';

export const MONGO_DUPLICATE_KEY = 11000;

/**
 * True only for failures where the database cannot be reached right now (network, no primary
 * selectable, client closed, or a server error the driver labels as transient/retryable).
 * Everything else (bad query, validation, missing privileges) is a bug and must stay a 500.
 */
export function isMongoUnavailable(error: unknown): boolean {
  if (
    error instanceof MongoNetworkError ||
    error instanceof MongoServerSelectionError ||
    error instanceof MongoNotConnectedError ||
    error instanceof MongoTopologyClosedError
  )
    return true;
  return (
    error instanceof MongoServerError &&
    (error.hasErrorLabel('RetryableWriteError') || error.hasErrorLabel('TransientTransactionError'))
  );
}

export function isDuplicateKey(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === MONGO_DUPLICATE_KEY;
}

/**
 * Runs one driver call. Connectivity failures become `DatabaseUnavailableError` (→ 503);
 * `onDuplicateKey` maps unique-index violations; any other error is rethrown unchanged (→ 500).
 */
export async function guardMongo<T>(
  operation: () => Promise<T>,
  onDuplicateKey?: () => Error,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (onDuplicateKey && isDuplicateKey(error)) throw onDuplicateKey();
    if (isMongoUnavailable(error)) throw new DatabaseUnavailableError(error);
    throw error;
  }
}
