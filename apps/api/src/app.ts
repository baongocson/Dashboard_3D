import { randomBytes } from 'node:crypto';
import fastifyCors from '@fastify/cors';
import { CSRF_HEADER, SESSION_ACTIVITY_HEADER } from '@dashboard/contracts';
import Fastify from 'fastify';
import { apiErrorHandler } from './modules/auth/api-error.js';
import { registerAuthModule } from './modules/auth/auth.module.js';
import { AuthService, type AuthServiceOptions } from './modules/auth/auth.service.js';
import { unavailableAuthStores, type AuthStores } from './modules/auth/stores.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';

export const DEFAULT_WEB_ORIGIN = 'http://localhost:4173';

export interface AppOptions {
  /** Exact frontend origins for CORS and the Origin check (WEB_ORIGIN). */
  allowedOrigins?: readonly string[];
  /** Account storage. Omitted = MongoDB not configured → account routes answer 503. */
  authStores?: AuthStores;
  /** SESSION_SECRET; a random per-process key is used when omitted (sessions die on restart). */
  sessionSecret?: string;
  /** Secure cookie flag; defaults to true when every allowed origin is https. */
  cookieSecure?: boolean;
  auth?: Omit<AuthServiceOptions, 'users' | 'sessions' | 'sessionSecret'>;
  logger?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const allowedOrigins = options.allowedOrigins ?? [DEFAULT_WEB_ORIGIN];
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              `req.headers["${CSRF_HEADER}"]`,
              'res.headers["set-cookie"]',
              'password',
              'passwordHash',
              'MONGODB_URI',
              'SESSION_SECRET',
            ],
          },
  });
  app.setErrorHandler(apiErrorHandler);

  void app.register(fastifyCors, {
    origin: [...allowedOrigins],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', CSRF_HEADER, SESSION_ACTIVITY_HEADER],
  });

  // Liveness only: this endpoint does NOT claim Atlas is reachable or sync is ready.
  app.get('/health', () => ({ status: 'ok', database: 'not-configured', syncReady: false }));

  const stores = options.authStores ?? unavailableAuthStores;
  const service = new AuthService({
    ...options.auth,
    users: stores.users,
    sessions: stores.sessions,
    sessionSecret: options.sessionSecret ?? randomBytes(32).toString('hex'),
  });
  registerAuthModule(app, {
    service,
    allowedOrigins,
    cookieSecure:
      options.cookieSecure ?? allowedOrigins.every((origin) => origin.startsWith('https://')),
  });
  registerUsersRoutes(app, { users: stores.users, now: () => service.getNow() });
  return app;
}
