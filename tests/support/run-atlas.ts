import { spawnSync } from 'node:child_process';

let uri = process.env.MONGODB_TEST_URI ?? process.env.MONGODB_URI;
if (!uri) throw new Error('Provide backend-only MONGODB_TEST_URI or MONGODB_URI using --env-file.');
const username = process.env.MONGODB_USERNAME,
  password = process.env.MONGODB_PASSWORD;
if (username && password)
  uri = uri.replace(
    /(mongodb(?:\+srv)?:\/\/)[^@]*@/u,
    `$1${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
  );
const result = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'apps/api/src/modules/auth/mongo.integration.test.ts',
    'apps/api/src/modules/projects/projects.mongo.integration.test.ts',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      MONGODB_TEST_URI: uri,
      MONGODB_TEST_DNS: '1.1.1.1,8.8.8.8',
      MONGODB_TEST_DB_NAME: process.env.MONGODB_TEST_DB_NAME ?? 'dashboard_dev',
    },
  },
);
process.exitCode = result.status ?? 1;
