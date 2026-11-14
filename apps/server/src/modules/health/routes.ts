import type { FastifyInstance } from 'fastify';
import { ENGINE_API_VERSION } from '@gravity/engine';

export interface ReadinessProbe {
  readonly name: string;
  readonly check: () => Promise<void>;
}

/** /healthz (liveness) and /readyz (dependencies reachable). Outside /api/v1. */
export function healthRoutes(app: FastifyInstance, probes: readonly ReadinessProbe[] = []): void {
  app.get('/healthz', { config: { rateLimit: false } }, () => ({
    status: 'ok',
    engineApiVersion: ENGINE_API_VERSION,
  }));

  app.get('/readyz', { config: { rateLimit: false } }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'down'> = {};
    await Promise.all(
      probes.map(async (p) => {
        try {
          await p.check();
          checks[p.name] = 'ok';
        } catch {
          checks[p.name] = 'down';
        }
      }),
    );
    const ready = Object.values(checks).every((v) => v === 'ok');
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'degraded', checks });
  });
}
