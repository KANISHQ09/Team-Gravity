import { randomInt } from 'node:crypto';
import { createAdapter } from '@socket.io/redis-adapter';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import type { z } from 'zod';
import type { MissionResult } from '@gravity/engine';
import {
  type ClientToServerEvents,
  type RoomLeftEvent,
  type ServerToClientEvents,
  designPatchSchema,
  emptyPayloadSchema,
  memberRemoveSchema,
  proposalCreateSchema,
  proposalRespondSchema,
  roleClaimSchema,
  roomJoinSchema,
  voteCastSchema,
} from '@gravity/shared';
import type { TokenPayload } from '../plugins/security.ts';
import type { RoomArchive } from '../modules/rooms/archive.ts';
import {
  type Room,
  RoomError,
  type RoomService,
  allGo,
  snapshot,
} from '../modules/rooms/service.ts';

interface SocketData {
  userId: string;
  roomId: string | null;
  /** Simple token bucket: at most 20 events per second (SRS-SEC). */
  tokens: number;
  refilledAt: number;
}

type ServerEvents = ServerToClientEvents<MissionResult>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no server-to-server events
type GravityServer = Server<ClientToServerEvents, ServerEvents, {}, SocketData>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no server-to-server events
type GravitySocket = Socket<ClientToServerEvents, ServerEvents, {}, SocketData>;

export interface GatewayOptions {
  readonly corsOrigin: string;
  /** When set, rooms broadcast across server instances (SRS-REL-04). */
  readonly redis?: Redis | null;
  readonly archive: RoomArchive;
  readonly onArchiveError?: (error: unknown) => void;
}

const EVENTS_PER_SECOND = 20;
const channel = (roomId: string) => `room:${roomId}`;

/**
 * Socket.IO gateway for co-op rooms (docs/API_DOCUMENTATION.md §3).
 * Every payload is validated with the shared Zod schemas; the room service
 * enforces roles, versions, votes and host rules.
 */
export function attachGateway(
  app: FastifyInstance,
  rooms: RoomService,
  opts: GatewayOptions,
): { io: GravityServer; close: () => Promise<void> } {
  const io: GravityServer = new Server(app.server, {
    cors: { origin: opts.corsOrigin.split(',').map((o) => o.trim()), credentials: true },
    serveClient: false,
  });

  const adapterClients: Redis[] = [];
  if (opts.redis) {
    const pub = opts.redis.duplicate();
    const sub = opts.redis.duplicate();
    for (const c of [pub, sub]) c.on('error', () => {}); // reported through /readyz
    adapterClients.push(pub, sub);
    io.adapter(createAdapter(pub, sub));
  }

  // Set on shutdown: disconnect handlers still run then, but the adapter's
  // Redis connections are closing, so broadcasts would fail.
  let closing = false;
  const broadcastState = (room: Room) => {
    if (!closing) io.to(channel(room.id)).emit('room:state', snapshot(room));
  };

  /** Takes every socket of a player out of the room channel, on any server instance. */
  async function evict(roomId: string, userId: string, reason: RoomLeftEvent['reason']) {
    for (const s of await io.in(channel(roomId)).fetchSockets()) {
      if (s.data.userId !== userId) continue;
      s.emit('room:left', { reason });
      s.leave(channel(roomId));
    }
  }

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown }).token;
    try {
      if (typeof token !== 'string') throw new Error('missing');
      const payload = app.jwt.verify<TokenPayload>(token);
      if (payload.typ !== 'access') throw new Error('wrong type');
      socket.data.userId = payload.sub;
      socket.data.roomId = null;
      socket.data.tokens = EVENTS_PER_SECOND;
      socket.data.refilledAt = Date.now();
      next();
    } catch {
      next(new Error('Unauthorized: a valid guest access token is required'));
    }
  });

  io.on('connection', (socket: GravitySocket) => {
    const data = socket.data;

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

    const roomId = (): string => {
      if (!data.roomId) throw new RoomError('Not in a room', 'Send room:join first.', 409);
      return data.roomId;
    };

    /** Wraps a handler with rate limiting, schema validation and error mapping. */
    function on<S extends z.ZodType>(
      event: keyof ClientToServerEvents,
      schema: S,
      handler: (payload: z.infer<S>) => Promise<void>,
    ) {
      // Socket.IO's typed `on` can't follow the generic event name, so register untyped.
      (socket as unknown as Socket).on(event, async (raw: unknown) => {
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
          await handler(parsed.data);
        } catch (e) {
          if (e instanceof RoomError) {
            if (event === 'design:patch') {
              const room = data.roomId ? await rooms.get(data.roomId).catch(() => null) : null;
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

    on('room:join', roomJoinSchema, async ({ code }) => {
      if (data.roomId) {
        // Switching rooms: release the old seat's connection first.
        const old = data.roomId;
        data.roomId = null;
        await socket.leave(channel(old));
        const prev = await rooms.disconnect(old, data.userId);
        if (prev) broadcastState(prev);
      }
      const room = await rooms.connect(code, data.userId);
      data.roomId = room.id;
      await socket.join(channel(room.id));
      broadcastState(room);
      // A player who rejoins after launch still gets the shared report.
      if (room.result) socket.emit('sim:result', room.result);
    });

    on('room:leave', emptyPayloadSchema, async () => {
      const id = roomId();
      data.roomId = null;
      await evict(id, data.userId, 'left');
      const room = await rooms.leave(id, data.userId);
      if (room) broadcastState(room);
    });

    on('member:remove', memberRemoveSchema, async ({ userId }) => {
      const room = await rooms.remove(roomId(), data.userId, userId);
      await evict(room.id, userId, 'removed');
      broadcastState(room);
    });

    on('role:claim', roleClaimSchema, async ({ roles }) => {
      broadcastState(await rooms.claimRoles(roomId(), data.userId, roles));
    });

    on('design:patch', designPatchSchema, async ({ edit, baseVersion }) => {
      const room = await rooms.patch(roomId(), data.userId, edit, baseVersion);
      io.to(channel(room.id)).emit('design:applied', {
        edit,
        version: room.version,
        design: room.design,
        by: data.userId,
      });
      broadcastState(room);
    });

    on('proposal:create', proposalCreateSchema, async ({ edit, message }) => {
      const { room, value: proposal } = await rooms.propose(roomId(), data.userId, edit, message);
      io.to(channel(room.id)).emit('proposal:update', { proposal, status: 'open' });
      broadcastState(room);
    });

    on('proposal:respond', proposalRespondSchema, async ({ proposalId, accept }) => {
      const { room, value: proposal } = await rooms.respond(
        roomId(),
        data.userId,
        proposalId,
        accept,
      );
      io.to(channel(room.id)).emit('proposal:update', {
        proposal,
        status: accept ? 'accepted' : 'rejected',
      });
      if (accept)
        io.to(channel(room.id)).emit('design:applied', {
          edit: proposal.edit,
          version: room.version,
          design: room.design,
          by: data.userId,
        });
      broadcastState(room);
    });

    on('vote:cast', voteCastSchema, async (vote) => {
      const room = await rooms.vote(roomId(), data.userId, vote);
      io.to(channel(room.id)).emit('vote:update', {
        votes: Object.values(room.members).map((m) => ({ userId: m.userId, vote: m.vote })),
        allGo: allGo(room),
      });
    });

    on('sim:start', emptyPayloadSchema, async () => {
      const seed = randomInt(0, 2 ** 31 - 1);
      const room = await rooms.start(roomId(), data.userId, seed);
      io.to(channel(room.id)).emit('sim:result', room.result!);
      broadcastState(room);
      // History only: a database problem must not spoil the shared result.
      opts.archive.save(room, seed).catch((e: unknown) => opts.onArchiveError?.(e));
    });

    socket.on('disconnect', async () => {
      const id = data.roomId;
      if (!id) return;
      try {
        const room = await rooms.disconnect(id, data.userId);
        if (room) broadcastState(room);
      } catch (e) {
        app.log.warn({ err: e }, 'disconnect bookkeeping failed');
      }
    });
  });

  return {
    io,
    close: async () => {
      closing = true;
      await io.close();
      await Promise.allSettled(adapterClients.map((c) => c.quit()));
    },
  };
}
