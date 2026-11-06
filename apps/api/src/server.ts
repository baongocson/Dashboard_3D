import { MongoClient } from 'mongodb';
import { createApp, DEFAULT_WEB_ORIGIN } from './app.js';
import { createMongoAuthStores, type AuthStores } from './modules/auth/stores.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer between 1 and 65535');
const allowedOrigins = (process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN)
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// TEMPORARY wiring until the database plugin/config validation (Trâm, apps/api/src/plugins and
// apps/api/src/config) lands. Without MONGODB_URI, account routes answer 503 instead of faking.
let mongo: MongoClient | undefined;
let authStores: AuthStores | undefined;
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  const dbName = process.env.MONGODB_DB_NAME;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!dbName) throw new Error('MONGODB_DB_NAME is required when MONGODB_URI is set');
  if (!sessionSecret || sessionSecret.length < 32)
    throw new Error('SESSION_SECRET (at least 32 characters) is required when MONGODB_URI is set');
  mongo = new MongoClient(mongoUri);
  await mongo.connect();
  authStores = await createMongoAuthStores(mongo.db(dbName));
}

const app = createApp({
  allowedOrigins,
  ...(authStores ? { authStores } : {}),
  ...(process.env.SESSION_SECRET ? { sessionSecret: process.env.SESSION_SECRET } : {}),
});
app.addHook('onClose', async () => {
  await mongo?.close();
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void app.close();
  });
}
try {
  await app.listen({ port, host: 'localhost' });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
