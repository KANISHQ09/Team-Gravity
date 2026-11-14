import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.ts';
import { healthRoutes } from './modules/health/routes.ts';

/** Builds the Fastify app without listening, so tests can use app.inject(). */
export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
  });

  healthRoutes(app);

  return app;
}
