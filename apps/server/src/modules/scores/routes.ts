import type { FastifyInstance } from 'fastify';
import { CATALOG_VERSION, catalog } from '@gravity/catalog';
import { hasBlockingErrors, reviewDesign, runMission } from '@gravity/engine';
import { leaderboardQuerySchema, scoreSubmitSchema } from '@gravity/shared';
import { sendProblem, zodDetail } from '../../plugins/errors.ts';
import type { ScoreRepository } from './repository.ts';

/** Scores and leaderboards. The server always recomputes the score (anti-cheat). */
export function scoreRoutes(app: FastifyInstance, repo: ScoreRepository) {
  app.post('/api/v1/scores', { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = scoreSubmitSchema.safeParse(request.body);
    if (!parsed.success)
      return sendProblem(request, reply, 400, 'Invalid request body', zodDetail(parsed.error));
    const { design, seed, teamName, playerCount } = parsed.data;
    if (!catalog.scenarios.some((s) => s.id === design.scenarioId)) {
      return sendProblem(
        request,
        reply,
        422,
        'Design cannot be scored',
        `Unknown scenario: ${design.scenarioId}`,
      );
    }
    if (hasBlockingErrors(reviewDesign(design).issues)) {
      return sendProblem(
        request,
        reply,
        422,
        'Design cannot be scored',
        'This design could not be launched, so it has no score.',
      );
    }
    // Recompute from design + seed; any score sent by the client is ignored.
    const team =
      playerCount > 1 ? { playerCount, proposalsResolved: playerCount, noGoVotes: 0 } : undefined;
    const { run, report } = runMission(design, seed, team);
    const { rank } = await repo.record({
      guestId: request.user.sub,
      design,
      catalogVersion: CATALOG_VERSION,
      seed,
      outcome: run.outcome,
      total: report.total,
      breakdown: report.breakdown,
      teamName,
      playerCount,
    });
    return reply.code(201).send({ total: report.total, outcome: run.outcome, rank });
  });

  app.get<{ Params: { scenarioId: string } }>(
    '/api/v1/leaderboards/:scenarioId',
    async (request, reply) => {
      const query = leaderboardQuerySchema.safeParse(request.query);
      if (!query.success)
        return sendProblem(request, reply, 400, 'Invalid query', zodDetail(query.error));
      if (!catalog.scenarios.some((s) => s.id === request.params.scenarioId)) {
        return sendProblem(
          request,
          reply,
          404,
          'Not Found',
          `Unknown scenario: ${request.params.scenarioId}`,
        );
      }
      reply.header('cache-control', 'public, max-age=30');
      return { entries: await repo.top(request.params.scenarioId, query.data.difficulty, 50) };
    },
  );
}
