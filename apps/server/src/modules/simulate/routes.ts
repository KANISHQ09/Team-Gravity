import type { FastifyInstance } from 'fastify';
import { hasBlockingErrors, reviewDesign, runMission } from '@gravity/engine';
import { simulateRequestSchema } from '@gravity/shared';
import { catalog } from '@gravity/catalog';
import { sendProblem, zodDetail } from '../../plugins/errors.ts';

/** POST /api/v1/simulate: run the engine on the server (guest+). */
export function simulateRoutes(app: FastifyInstance) {
  app.post('/api/v1/simulate', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = simulateRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return sendProblem(request, reply, 400, 'Invalid request body', zodDetail(parsed.error));
    const { design, seed } = parsed.data;
    if (!catalog.scenarios.some((s) => s.id === design.scenarioId)) {
      return sendProblem(
        request,
        reply,
        422,
        'Design cannot be simulated',
        `Unknown scenario: ${design.scenarioId}`,
      );
    }
    const review = reviewDesign(design);
    if (hasBlockingErrors(review.issues)) {
      return sendProblem(
        request,
        reply,
        422,
        'Design cannot be launched',
        'Fix the listed problems first.',
        {
          issues: review.issues
            .filter((i) => i.severity === 'error')
            .map(({ code, message, why, fix }) => ({ code, message, why, fix })),
        },
      );
    }
    const { run, report } = runMission(design, seed);
    return {
      outcome: run.outcome,
      score: { total: report.total, raw: report.raw, breakdown: report.breakdown },
      causes: report.causes,
      suggestions: report.suggestions,
      events: run.events,
      science: run.science,
    };
  });
}
