import type { FastifyInstance } from 'fastify';
import { catalog } from '@gravity/catalog';
import { createRoomSchema, roomCodeSchema } from '@gravity/shared';
import { sendProblem, zodDetail } from '../../plugins/errors.ts';
import { RoomError, type RoomService, snapshot } from './service.ts';

/** REST: create and join co-op rooms. Live play happens over Socket.IO. */
export function roomRoutes(app: FastifyInstance, rooms: RoomService) {
  app.post(
    '/api/v1/rooms',
    {
      preHandler: app.authenticate,
      // 5 room creations per hour per guest.
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
          keyGenerator: (req) => (req.user as { sub?: string } | undefined)?.sub ?? req.ip,
        },
      },
    },
    async (request, reply) => {
      const parsed = createRoomSchema.safeParse(request.body);
      if (!parsed.success)
        return sendProblem(request, reply, 400, 'Invalid request body', zodDetail(parsed.error));
      if (!catalog.scenarios.some((s) => s.id === parsed.data.scenarioId)) {
        return sendProblem(request, reply, 422, 'Unknown scenario', parsed.data.scenarioId);
      }
      const room = rooms.create(request.user.sub, parsed.data.scenarioId, parsed.data.difficulty);
      return reply.code(201).send({ code: room.code, roomId: room.id });
    },
  );

  app.post<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/join',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const code = roomCodeSchema.safeParse(request.params.code);
      if (!code.success)
        return sendProblem(request, reply, 400, 'Invalid room code', zodDetail(code.error));
      try {
        const room = rooms.join(code.data, request.user.sub);
        return snapshot(room);
      } catch (e) {
        if (e instanceof RoomError)
          return sendProblem(request, reply, e.status, e.title, e.message);
        throw e;
      }
    },
  );
}
