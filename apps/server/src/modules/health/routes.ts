import type { FastifyInstance } from 'fastify';
import { ENGINE_API_VERSION } from '@gravity/engine';

/** Liveness probe. Readiness (/readyz: database + Redis) arrives with those modules. */
export function healthRoutes(app: FastifyInstance): void {
  app.get('/healthz', () => ({ status: 'ok', engineApiVersion: ENGINE_API_VERSION }));
}
