import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import type { Env } from './config/env.ts';
import { genRequestId, registerErrorHandling } from './plugins/errors.ts';
import { registerSecurity } from './plugins/security.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { catalogRoutes } from './modules/catalogs/routes.ts';
import { healthRoutes, type ReadinessProbe } from './modules/health/routes.ts';
import { roomRoutes } from './modules/rooms/routes.ts';
import { RoomService } from './modules/rooms/service.ts';
import { memoryScoreRepository, type ScoreRepository } from './modules/scores/repository.ts';
import { scoreRoutes } from './modules/scores/routes.ts';
import { simulateRoutes } from './modules/simulate/routes.ts';
import { attachGateway } from './realtime/gateway.ts';

export interface AppDeps {
  /** Defaults to in-memory storage when no database is configured. */
  readonly scores?: ScoreRepository;
  readonly redis?: Redis | null;
  readonly probes?: readonly ReadinessProbe[];
  readonly rooms?: RoomService;
}

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
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
  const rooms = deps.rooms ?? new RoomService();

  registerErrorHandling(app);
  await registerSecurity(app, env, deps.redis ?? null);

  healthRoutes(app, deps.probes);
  authRoutes(app, {
    secure: env.NODE_ENV === 'production',
    onGuest: (id) => scores.ensureGuest(id),
  });
  catalogRoutes(app);
  simulateRoutes(app);
  scoreRoutes(app, scores);
  roomRoutes(app, rooms);

  const io = attachGateway(app, rooms, env.CORS_ORIGIN);
  app.decorate('io', io);
  app.decorate('rooms', rooms);

  const sweeper = setInterval(() => rooms.sweep(), 60_000);
  sweeper.unref();
  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    await io.close();
  });

  if (env.jwtKeyGenerated && env.NODE_ENV !== 'test') {
    app.log.warn(
      'JWT_SIGNING_KEY is not set: using a temporary key. Guest sessions reset on restart.',
    );
  }
  return app;
}
