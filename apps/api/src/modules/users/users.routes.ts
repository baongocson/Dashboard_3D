import { updateProfileRequestSchema } from '@dashboard/contracts';
import type { FastifyInstance } from 'fastify';
import { ApiError, validationError } from '../../shared/api-error.js';
import { requireUserId } from '../auth/auth.module.js';
import { toPublicUser, type UserRepository } from './user-repository.js';

export function registerUsersRoutes(
  app: FastifyInstance,
  options: { users: UserRepository; now: () => Date },
) {
  const { users, now } = options;
  void app.register(
    (scope, _options, done) => {
      scope.addHook('preHandler', app.requireAuth);

      scope.get('/me', async (request) => {
        const user = await users.findById(requireUserId(request));
        if (!user) throw new ApiError('NOT_FOUND', 'User not found');
        return { user: toPublicUser(user) };
      });

      // Only the signed-in user's own profile can be changed; there is no /users/:id.
      scope.patch('/me', { bodyLimit: 8 * 1024 }, async (request) => {
        const parsed = updateProfileRequestSchema.safeParse(request.body);
        if (!parsed.success) throw validationError(parsed.error);
        const user = await users.updateDisplayName(
          requireUserId(request),
          parsed.data.displayName,
          now(),
        );
        if (!user) throw new ApiError('NOT_FOUND', 'User not found');
        return { user: toPublicUser(user) };
      });
      done();
    },
    { prefix: '/users' },
  );
}
