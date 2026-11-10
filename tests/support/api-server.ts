// Explicit E2E test server. Production server.ts never enables in-memory stores.
import { createApp } from '../../apps/api/src/app';
import { MemoryUserRepository } from '../../apps/api/src/modules/users/memory-user-repository';
import { MemoryAuthSessionRepository } from '../../apps/api/src/modules/auth/session-repository';
import { MemoryProjectStore } from '../../apps/api/src/modules/projects/project-store';
const app = createApp({
  logger: false,
  authStores: { users: new MemoryUserRepository(), sessions: new MemoryAuthSessionRepository() },
  projectStore: new MemoryProjectStore(),
  auth: { scryptParams: { N: 2 ** 10, r: 8, p: 1 } },
  sessionSecret: 'e2e-only-secret-e2e-only-secret-e2e',
});
await app.listen({ port: 3001, host: 'localhost' });
process.once('SIGTERM', () => {
  void app.close();
});
