import type { FastifyInstance, FastifyRequest } from 'fastify';
import { catalog } from '@gravity/catalog';
import {
  type CreateRoomResponse,
  type JoinRoomResponse,
  createRoomSchema,
  roomCodeSchema,
} from '@gravity/shared';
import { sendProblem, zodDetail } from '../../plugins/errors.ts';
import type { TokenPayload } from '../../plugins/security.ts';
import { RoomError, type RoomService, snapshot } from './service.ts';

/**
 * Rate limiting runs before authentication, so read the guest ID from the
 * token here. An invalid token falls back to the IP and is then rejected by
 * the auth preHandler anyway.
 */
function guestOrIp(app: FastifyInstance) {
  return (request: FastifyRequest): string => {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = app.jwt.verify<TokenPayload>(header.slice(7));
        if (payload.typ === 'access') return `guest:${payload.sub}`;
      } catch {
        // fall through to the IP
      }
    }
    return `ip:${request.ip}`;
  };
}

/** REST: create and join co-op rooms. Live play happens over Socket.IO. */
export function roomRoutes(app: FastifyInstance, rooms: RoomService) {
  app.post(
    '/api/v1/rooms',
    {
      preHandler: app.authenticate,
      // 5 room creations per hour per guest.
      config: { rateLimit: { max: 5, timeWindow: '1 hour', keyGenerator: guestOrIp(app) } },
    },
    async (request, reply) => {
      const parsed = createRoomSchema.safeParse(request.body);
      if (!parsed.success)
        return sendProblem(request, reply, 400, 'Invalid request body', zodDetail(parsed.error));
      if (!catalog.scenarios.some((s) => s.id === parsed.data.scenarioId)) {
        return sendProblem(request, reply, 422, 'Unknown scenario', parsed.data.scenarioId);
      }
      const room = await rooms.create(
        request.user.sub,
        parsed.data.scenarioId,
        parsed.data.difficulty,
      );
      return reply
        .code(201)
        .send({ code: room.code, roomId: room.id } satisfies CreateRoomResponse);
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
        const room = await rooms.join(code.data, request.user.sub);
        return snapshot(room) satisfies JoinRoomResponse;
      } catch (e) {
        if (e instanceof RoomError)
          return sendProblem(request, reply, e.status, e.title, e.message);
        throw e;
      }
    },
  );
}
