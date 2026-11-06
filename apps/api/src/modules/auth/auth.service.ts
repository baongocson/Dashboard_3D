import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  loginRequestSchema,
  normalizeUsername,
  registerRequestSchema,
  type AuthSessionResponse,
  type PublicUser,
} from '@dashboard/contracts';
import {
  toPublicUser,
  UsernameTakenError,
  type UserRecord,
  type UserRepository,
} from '../users/user-repository.js';
import { ApiError, validationError } from './api-error.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import {
  DEFAULT_SCRYPT_PARAMS,
  hashPassword,
  verifyPassword,
  type ScryptParams,
} from './password.js';
import type { AuthSessionRecord, AuthSessionRepository } from './session-repository.js';

export interface AuthServiceOptions {
  users: UserRepository;
  sessions: AuthSessionRepository;
  /** HMAC key for stored session-token hashes (SESSION_SECRET). */
  sessionSecret: string;
  now?: () => Date;
  /** Proposed config (task-01-decisions): idle 24 h, absolute 7 days. */
  idleTimeoutMs?: number;
  absoluteTimeoutMs?: number;
  /** Minimum gap between activity writes, to avoid a database write on every request. */
  touchIntervalMs?: number;
  scryptParams?: ScryptParams;
  rateLimiter?: LoginRateLimiter;
}

export interface AuthenticatedSession {
  session: AuthSessionRecord;
  user: UserRecord;
}

const HOUR = 60 * 60 * 1000;

export class AuthService {
  readonly users: UserRepository;
  private readonly sessions: AuthSessionRepository;
  private readonly sessionSecret: string;
  private readonly now: () => Date;
  private readonly idleTimeoutMs: number;
  private readonly absoluteTimeoutMs: number;
  private readonly touchIntervalMs: number;
  private readonly scryptParams: ScryptParams;
  private readonly rateLimiter: LoginRateLimiter;
  private dummyHash: Promise<string> | undefined;

  constructor(options: AuthServiceOptions) {
    this.users = options.users;
    this.sessions = options.sessions;
    this.sessionSecret = options.sessionSecret;
    this.now = options.now ?? (() => new Date());
    this.idleTimeoutMs = options.idleTimeoutMs ?? 24 * HOUR;
    this.absoluteTimeoutMs = options.absoluteTimeoutMs ?? 7 * 24 * HOUR;
    this.touchIntervalMs = options.touchIntervalMs ?? 60 * 1000;
    this.scryptParams = options.scryptParams ?? DEFAULT_SCRYPT_PARAMS;
    this.rateLimiter = options.rateLimiter ?? new LoginRateLimiter();
  }

  getNow(): Date {
    return this.now();
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.sessionSecret).update(token).digest('hex');
  }

  /** Creates an account usable immediately. Does NOT create a login session (client goes to login). */
  async register(body: unknown): Promise<PublicUser> {
    const parsed = registerRequestSchema.safeParse(body);
    if (!parsed.success) throw validationError(parsed.error);
    const { username, password } = parsed.data;
    const passwordHash = await hashPassword(password, this.scryptParams);
    try {
      const user = await this.users.create(
        {
          username,
          usernameNormalized: normalizeUsername(username),
          displayName: username,
          passwordHash,
        },
        this.now(),
      );
      return toPublicUser(user);
    } catch (error: unknown) {
      if (error instanceof UsernameTakenError)
        throw new ApiError('USERNAME_TAKEN', 'This username is already taken');
      throw error;
    }
  }

  async login(
    body: unknown,
    ip: string,
  ): Promise<{ token: string; response: AuthSessionResponse }> {
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) throw validationError(parsed.error);
    const usernameNormalized = normalizeUsername(parsed.data.username);
    const nowMs = this.now().getTime();

    const retryAfterSeconds = this.rateLimiter.retryAfterSeconds(ip, usernameNormalized, nowMs);
    if (retryAfterSeconds !== null)
      throw new ApiError('TOO_MANY_ATTEMPTS', 'Too many failed login attempts, try again later', {
        retryAfterSeconds,
      });

    const user = await this.users.findByNormalizedUsername(usernameNormalized);
    // Unknown usernames still pay for one hash so response time does not reveal which exist.
    this.dummyHash ??= hashPassword(randomUUID(), this.scryptParams);
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) {
      this.rateLimiter.recordFailure(ip, usernameNormalized, nowMs);
      throw new ApiError('INVALID_CREDENTIALS', 'Username or password is incorrect');
    }
    this.rateLimiter.recordSuccess(ip, usernameNormalized);

    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    const absoluteExpiresAt = new Date(now.getTime() + this.absoluteTimeoutMs);
    const session: AuthSessionRecord = {
      id: randomUUID(),
      tokenHash: this.hashToken(token),
      userId: user.id,
      csrfToken: randomBytes(32).toString('base64url'),
      createdAt: now,
      lastActivityAt: now,
      idleExpiresAt: this.idleExpiry(now, absoluteExpiresAt),
      absoluteExpiresAt,
      revokedAt: null,
    };
    await this.sessions.create(session);
    return { token, response: this.toResponse(session, user) };
  }

  private idleExpiry(now: Date, absoluteExpiresAt: Date): Date {
    return new Date(Math.min(now.getTime() + this.idleTimeoutMs, absoluteExpiresAt.getTime()));
  }

  /**
   * Validates a session token against the server clock (never the client's).
   * `extend` = the request is a valid user activity; background sync passes false so it
   * cannot keep a session alive forever.
   */
  async authenticate(token: string | undefined, extend: boolean): Promise<AuthenticatedSession> {
    if (!token) throw new ApiError('AUTH_REQUIRED', 'Login required');
    const session = await this.sessions.findByTokenHash(this.hashToken(token));
    if (!session) throw new ApiError('AUTH_REQUIRED', 'Login required');
    const now = this.now();
    if (
      session.revokedAt !== null ||
      now >= session.idleExpiresAt ||
      now >= session.absoluteExpiresAt
    )
      throw new ApiError('SESSION_EXPIRED', 'Session expired, please log in again');
    const user = await this.users.findById(session.userId);
    if (!user) throw new ApiError('SESSION_EXPIRED', 'Session expired, please log in again');

    if (extend && now.getTime() - session.lastActivityAt.getTime() >= this.touchIntervalMs) {
      session.lastActivityAt = now;
      session.idleExpiresAt = this.idleExpiry(now, session.absoluteExpiresAt);
      await this.sessions.touch(session.id, session.lastActivityAt, session.idleExpiresAt);
    }
    return { session, user };
  }

  /** Idempotent: unknown/expired tokens are a successful no-op so offline revocations can be replayed. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const session = await this.sessions.findByTokenHash(this.hashToken(token));
    if (session && session.revokedAt === null) await this.sessions.revoke(session.id, this.now());
  }

  toResponse(session: AuthSessionRecord, user: UserRecord): AuthSessionResponse {
    return {
      user: toPublicUser(user),
      csrfToken: session.csrfToken,
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    };
  }
}
