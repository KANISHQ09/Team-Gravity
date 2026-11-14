import { Redis } from 'ioredis';
import { buildApp, type AppDeps } from './app.ts';
import { loadEnv } from './config/env.ts';
import { createDatabase } from './db/client.ts';
import type { ReadinessProbe } from './modules/health/routes.ts';
import { postgresRoomArchive } from './modules/rooms/archive.ts';
import { postgresScoreRepository } from './modules/scores/repository.ts';

const env = loadEnv();
const probes: ReadinessProbe[] = [];
const closers: (() => Promise<unknown>)[] = [];
const deps: { -readonly [K in keyof AppDeps]: AppDeps[K] } = {};

if (env.DATABASE_URL) {
  const database = createDatabase(env.DATABASE_URL);
  deps.scores = postgresScoreRepository(database.db);
  deps.roomArchive = postgresRoomArchive(database.db);
  probes.push({ name: 'postgres', check: database.ping });
  closers.push(database.close);
}
if (env.REDIS_URL) {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  redis.on('error', () => {}); // reported through /readyz instead of crashing
  deps.redis = redis;
  probes.push({ name: 'redis', check: async () => void (await redis.ping()) });
  closers.push(() => redis.quit());
}
deps.probes = probes;

const app = await buildApp(env, deps);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await Promise.allSettled(closers.map((c) => c()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(
    {
      storage: env.DATABASE_URL ? 'postgres' : 'memory',
      rooms: env.REDIS_URL ? 'redis' : 'memory',
    },
    'GRAVITY server ready',
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
