import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type { z } from 'zod';
import {
  designPatchSchema,
  proposalCreateSchema,
  proposalRespondSchema,
  roleClaimSchema,
  roomJoinSchema,
  voteCastSchema,
} from '@gravity/shared';
import type { TokenPayload } from '../plugins/security.ts';
import { RoomError, type RoomService, snapshot } from '../modules/rooms/service.ts';

interface SocketData {
  userId: string;
  roomId: string | null;
  /** Simple token bucket: at most 20 events per second (SRS-SEC). */
  tokens: number;
  refilledAt: number;
}

const EVENTS_PER_SECOND = 20;
const channel = (roomId: string) => `room:${roomId}`;

/**
 * Socket.IO gateway for co-op rooms (docs/API_DOCUMENTATION.md §3).
 * Every payload is validated with the shared Zod schemas; the room service
 * enforces roles, versions and votes.
 */
export function attachGateway(
  app: FastifyInstance,
  rooms: RoomService,
  corsOrigin: string,
): Server {
  const io = new Server(app.server, {
    cors: { origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true },
    serveClient: false,
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown }).token;
    try {
      if (typeof token !== 'string') throw new Error('missing');
      const payload = app.jwt.verify<TokenPayload>(token);
      if (payload.typ !== 'access') throw new Error('wrong type');
      const data = socket.data as SocketData;
      data.userId = payload.sub;
      data.roomId = null;
      data.tokens = EVENTS_PER_SECOND;
      data.refilledAt = Date.now();
      next();
    } catch {
      next(new Error('Unauthorized: a valid guest access token is required'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    const allow = (): boolean => {
      const now = Date.now();
      data.tokens = Math.min(
        EVENTS_PER_SECOND,
        data.tokens + ((now - data.refilledAt) / 1000) * EVENTS_PER_SECOND,
      );
      data.refilledAt = now;
      if (data.tokens < 1) return false;
      data.tokens -= 1;
      return true;
    };

    const fail = (event: string, title: string, detail: string) =>
      socket.emit('room:error', { event, title, detail });

    /** Wraps a handler with rate limiting, schema validation and error mapping. */
    function on<S extends z.ZodType>(
      event: string,
      schema: S,
      handler: (payload: z.infer<S>) => void,
    ) {
      socket.on(event, (raw: unknown) => {
        if (!allow())
          return fail(event, 'Too Many Requests', 'Slow down: at most 20 events per second.');
        const parsed = schema.safeParse(raw);
        if (!parsed.success)
          return fail(
            event,
            'Invalid message',
            parsed.error.issues.map((i) => i.message).join('; '),
          );
        try {
          handler(parsed.data);
        } catch (e) {
          if (e instanceof RoomError) {
            if (event === 'design:patch') {
              const room = data.roomId ? rooms.byId(data.roomId) : undefined;
              socket.emit('design:rejected', {
                title: e.title,
                reason: e.message,
                latestVersion: room?.version ?? 0,
              });
              return;
            }
            return fail(event, e.title, e.message);
          }
          app.log.error({ err: e, event }, 'socket handler failed');
          fail(event, 'Internal error', 'Something went wrong on the server.');
        }
      });
    }

    const currentRoom = () => {
      const room = data.roomId ? rooms.byId(data.roomId) : undefined;
      if (!room) throw new RoomError('Not in a room', 'Send room:join first.', 409);
      return room;
    };
    const broadcastState = (roomId: string) => {
      const room = rooms.byId(roomId);
      if (room) io.to(channel(roomId)).emit('room:state', snapshot(room));
    };

    on('room:join', roomJoinSchema, ({ code }) => {
      const room = rooms.join(code, data.userId);
      data.roomId = room.id;
      void socket.join(channel(room.id));
      rooms.setConnected(room, data.userId, true);
      broadcastState(room.id);
    });

    on('role:claim', roleClaimSchema, ({ roles }) => {
      const room = currentRoom();
      rooms.claimRoles(room, data.userId, roles);
      broadcastState(room.id);
    });

    on('design:patch', designPatchSchema, ({ edit, baseVersion }) => {
      const room = currentRoom();
      rooms.patch(room, data.userId, edit, baseVersion);
      io.to(channel(room.id)).emit('design:applied', {
        edit,
        version: room.version,
        design: room.design,
        by: data.userId,
      });
      broadcastState(room.id);
    });

    on('proposal:create', proposalCreateSchema, ({ edit, message }) => {
      const room = currentRoom();
      const proposal = rooms.propose(room, data.userId, edit, message);
      io.to(channel(room.id)).emit('proposal:update', { proposal, status: 'open' });
    });

    on('proposal:respond', proposalRespondSchema, ({ proposalId, accept }) => {
      const room = currentRoom();
      const proposal = rooms.respond(room, data.userId, proposalId, accept);
      io.to(channel(room.id)).emit('proposal:update', {
        proposal,
        status: accept ? 'accepted' : 'rejected',
      });
      broadcastState(room.id);
    });

    on('vote:cast', voteCastSchema, (vote) => {
      const room = currentRoom();
      rooms.vote(room, data.userId, vote);
      io.to(channel(room.id)).emit('vote:update', {
        votes: [...room.members.values()].map((m) => ({ userId: m.userId, vote: m.vote })),
        allGo: rooms.allGo(room),
      });
    });

    socket.on('sim:start', () => {
      if (!allow()) return fail('sim:start', 'Too Many Requests', 'Slow down.');
      try {
        const room = currentRoom();
        const result = rooms.start(room, data.userId, randomInt(0, 2 ** 31 - 1));
        io.to(channel(room.id)).emit('sim:result', result);
        broadcastState(room.id);
      } catch (e) {
        if (e instanceof RoomError) return fail('sim:start', e.title, e.message);
        app.log.error({ err: e }, 'sim:start failed');
        fail('sim:start', 'Internal error', 'Something went wrong on the server.');
      }
    });

    socket.on('disconnect', () => {
      const room = data.roomId ? rooms.byId(data.roomId) : undefined;
      if (!room) return;
      rooms.setConnected(room, data.userId, false);
      broadcastState(room.id);
    });
  });

  return io;
}
