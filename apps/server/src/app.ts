import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { Env } from './config/env.ts';
import { genRequestId, registerErrorHandling } from './plugins/errors.ts';
import { registerSecurity } from './plugins/security.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { catalogRoutes } from './modules/catalogs/routes.ts';
import { healthRoutes, type ReadinessProbe } from './modules/health/routes.ts';
import { type RoomArchive, noRoomArchive } from './modules/rooms/archive.ts';
import { roomRoutes } from './modules/rooms/routes.ts';
import { RoomService } from './modules/rooms/service.ts';
import { memoryRoomStore, redisRoomStore } from './modules/rooms/store.ts';
import { memoryScoreRepository, type ScoreRepository } from './modules/scores/repository.ts';
import { scoreRoutes } from './modules/scores/routes.ts';
import { simulateRoutes } from './modules/simulate/routes.ts';
import { attachGateway } from './realtime/gateway.ts';

export interface AppDeps {
  /** Defaults to in-memory storage when no database is configured. */
  readonly scores?: ScoreRepository;
  readonly redis?: Redis | null;
  readonly probes?: readonly ReadinessProbe[];
  /** Defaults to a Redis-backed room store when `redis` is given, else in memory. */
  readonly rooms?: RoomService;
  /** Saves launched rooms (Postgres); defaults to no archive. */
  readonly roomArchive?: RoomArchive;
}

declare module 'fastify' {
  interface FastifyInstance {
    io: ReturnType<typeof attachGateway>['io'];
    rooms: RoomService;
  }
}

/** Builds the Fastify app without listening, so tests can use app.inject(). */
export async function buildApp(env: Env, deps: AppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
    genReqId: genRequestId,
    bodyLimit: 64 * 1024,
  });
  const scores = deps.scores ?? memoryScoreRepository();
  const redis = deps.redis ?? null;
  const rooms = deps.rooms ?? new RoomService(redis ? redisRoomStore(redis) : memoryRoomStore());

  registerErrorHandling(app);
  await registerSecurity(app, env, redis);

  healthRoutes(app, deps.probes);
  authRoutes(app, {
    secure: env.NODE_ENV === 'production',
    onGuest: (id) => scores.ensureGuest(id),
  });
  catalogRoutes(app);
  simulateRoutes(app);
  scoreRoutes(app, scores);
  roomRoutes(app, rooms);

  const gateway = attachGateway(app, rooms, {
    corsOrigin: env.CORS_ORIGIN,
    redis,
    archive: deps.roomArchive ?? noRoomArchive,
    onArchiveError: (err) => app.log.error({ err }, 'room archive failed'),
  });
  app.decorate('io', gateway.io);
  app.decorate('rooms', rooms);

  const sweeper = setInterval(() => {
    rooms.sweep().catch((err: unknown) => app.log.warn({ err }, 'room sweep failed'));
  }, 60_000);
  sweeper.unref();
  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    await gateway.close();
  });

  if (env.jwtKeyGenerated && env.NODE_ENV !== 'test') {
    app.log.warn(
      'JWT_SIGNING_KEY is not set: using a temporary key. Guest sessions reset on restart.',
    );
  }
  return app;
}
