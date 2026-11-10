import type { ApiErrorCode, ApiErrorResponse } from '@dashboard/contracts';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  AUTH_REQUIRED: 401,
  SESSION_EXPIRED: 401,
  ORIGIN_REJECTED: 403,
  CSRF_INVALID: 403,
  NOT_FOUND: 404,
  USERNAME_TAKEN: 409,
  TOO_MANY_ATTEMPTS: 429,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** Error with a contract code; the global handler turns it into `ApiErrorResponse`. */
export class ApiError extends Error {
  readonly statusCode: number;
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details: Pick<ApiErrorResponse['error'], 'issues' | 'retryAfterSeconds'> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusByCode[code];
  }
}

/** Thrown by repositories when MongoDB is not configured or cannot be reached. */
export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Database is unavailable', { cause });
    this.name = 'DatabaseUnavailableError';
  }
}

export function validationError(error: ZodError): ApiError {
  return new ApiError('VALIDATION_ERROR', 'Request is invalid', {
    issues: error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  });
}

function toResponse(error: ApiError): ApiErrorResponse {
  return { error: { code: error.code, message: error.message, ...error.details } };
}

export function sendApiError(reply: FastifyReply, error: ApiError) {
  if (error.details.retryAfterSeconds !== undefined)
    void reply.header('retry-after', String(error.details.retryAfterSeconds));
  return reply.status(error.statusCode).send(toResponse(error));
}

/** Global handler: every error leaves the API in the contract format, never with internals. */
export function apiErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) return sendApiError(reply, validationError(error));
  if (error instanceof ApiError) return sendApiError(reply, error);
  if (error instanceof DatabaseUnavailableError) {
    request.log.warn({ err: error.cause }, 'database unavailable');
    return sendApiError(
      reply,
      new ApiError('DATABASE_UNAVAILABLE', 'Database is unavailable, please retry later'),
    );
  }
  // Fastify body parsing / size errors are client errors.
  if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    } satisfies ApiErrorResponse);
  }
  request.log.error({ err: error }, 'unhandled error');
  return sendApiError(reply, new ApiError('INTERNAL_ERROR', 'Internal server error'));
}
