import { timingSafeEqual } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import { CSRF_HEADER, SESSION_ACTIVITY_HEADER, type PublicUser } from '@dashboard/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../shared/api-error.js';
import type { AuthService } from './auth.service.js';

export const SESSION_COOKIE = 'dashboard_session';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_BODY_LIMIT = 8 * 1024;

/** What `requireAuth` attaches to the request. Other modules use `requireUserId`. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  user: PublicUser;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    /**
     * preHandler for protected routes: valid login session + CSRF token on mutations.
     * Usage (Tuấn): `app.get('/projects', { preHandler: app.requireAuth }, handler)`.
     */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Owner ID for ownership checks. Throws if the route forgot `requireAuth`. */
export function requireUserId(request: FastifyRequest): string {
  if (!request.auth) throw new ApiError('AUTH_REQUIRED', 'Login required');
  return request.auth.userId;
}

/**
 * Returns the resource only if the signed-in user owns it. Missing and foreign resources both
 * answer 404 NOT_FOUND so a user cannot probe which IDs exist. Prefer filtering by owner in the
 * query itself (`{ _id, ownerId }`); use this when a record was loaded by ID alone.
 */
export function requireOwned<T extends { ownerId: string }>(
  request: FastifyRequest,
  resource: T | null | undefined,
): T {
  const userId = requireUserId(request);
  if (!resource || resource.ownerId !== userId)
    throw new ApiError('NOT_FOUND', 'Resource not found');
  return resource;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface AuthModuleOptions {
  service: AuthService;
  /** Exact origins allowed for state-changing requests (same list as CORS). */
  allowedOrigins: readonly string[];
  /** true when served over HTTPS. */
  cookieSecure: boolean;
}

export function registerAuthModule(app: FastifyInstance, options: AuthModuleOptions) {
  const { service, allowedOrigins, cookieSecure } = options;
  void app.register(fastifyCookie);
  app.decorateRequest('auth', null);

  // Origin check on every state-changing request of the whole API (not only /auth):
  // blocks cross-site form posts and login CSRF together with SameSite=Lax.
  app.addHook('onRequest', (request, _reply, done) => {
    const origin = request.headers.origin;
    if (UNSAFE_METHODS.has(request.method) && (!origin || !allowedOrigins.includes(origin))) {
      done(new ApiError('ORIGIN_REJECTED', 'Request origin is not allowed'));
      return;
    }
    done();
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
  } as const;

  function clearSessionCookie(reply: FastifyReply) {
    void reply.clearCookie(SESSION_COOKIE, cookieOptions);
  }

  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const extend = request.headers[SESSION_ACTIVITY_HEADER] !== 'background';
    let result;
    try {
      result = await service.authenticate(request.cookies[SESSION_COOKIE], false);
    } catch (error: unknown) {
      if (error instanceof ApiError) clearSessionCookie(reply);
      throw error;
    }
    if (UNSAFE_METHODS.has(request.method)) {
      const header = request.headers[CSRF_HEADER];
      if (typeof header !== 'string' || !safeEqual(header, result.session.csrfToken))
        throw new ApiError('CSRF_INVALID', 'Missing or invalid CSRF token');
    }
    if (extend) await service.authenticate(request.cookies[SESSION_COOKIE], true);
    request.auth = {
      userId: result.user.id,
      sessionId: result.session.id,
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
      },
    };
  });

  void app.register(
    (auth, _options, done) => {
      auth.addHook('onSend', (_request, reply, payload, next) => {
        void reply.header('cache-control', 'no-store');
        next(null, payload);
      });

      auth.post('/register', { bodyLimit: AUTH_BODY_LIMIT }, async (request, reply) => {
        const user = await service.register(request.body);
        return reply.status(201).send({ user });
      });

      auth.post('/login', { bodyLimit: AUTH_BODY_LIMIT }, async (request, reply) => {
        const previousToken = request.cookies[SESSION_COOKIE];
        const { token, response } = await service.login(request.body, request.ip);
        // A new login replaces whatever session this browser had.
        if (previousToken) await service.logout(previousToken);
        void reply.setCookie(SESSION_COOKIE, token, {
          ...cookieOptions,
          expires: new Date(response.absoluteExpiresAt),
        });
        return response;
      });

      // Only the Origin check applies (no CSRF token): forced logout is low impact, and a
      // revocation queued while offline must still be deliverable after the CSRF token is gone.
      auth.post('/logout', { bodyLimit: AUTH_BODY_LIMIT }, async (request, reply) => {
        await service.logout(request.cookies[SESSION_COOKIE]);
        clearSessionCookie(reply);
        return reply.status(204).send();
      });

      // Session probe for the web app on load: returns the user and the CSRF token to send on mutations.
      auth.get('/session', async (request, reply) => {
        const extend = request.headers[SESSION_ACTIVITY_HEADER] !== 'background';
        try {
          const result = await service.authenticate(request.cookies[SESSION_COOKIE], extend);
          return service.toResponse(result.session, result.user);
        } catch (error: unknown) {
          if (error instanceof ApiError) clearSessionCookie(reply);
          throw error;
        }
      });
      done();
    },
    { prefix: '/auth' },
  );
}
