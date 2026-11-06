import Fastify from 'fastify';

export function createApp() {
  const app = Fastify({
    logger: {
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'password',
        'passwordHash',
        'MONGODB_URI',
        'SESSION_SECRET',
      ],
    },
  });
  // Liveness only: this endpoint does NOT claim Atlas is reachable or sync is ready.
  app.get('/health', () => ({ status: 'ok', database: 'not-configured', syncReady: false }));
  return app;
}
