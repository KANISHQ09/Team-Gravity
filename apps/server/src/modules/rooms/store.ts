import type { Redis } from 'ioredis';
import type { MissionResult } from '@gravity/engine';
import type {
  Design,
  Difficulty,
  ProposalView,
  RoomStatus,
  Role,
  VoteChoice,
} from '@gravity/shared';

export interface Member {
  readonly userId: string;
  roles: Role[];
  vote: VoteChoice | null;
  /** Open sockets for this player (a player may have two tabs). */
  connections: number;
  /** Epoch ms of the last disconnect while `connections` is 0; null while connected. */
  disconnectedAt: number | null;
  /** Join order: decides who becomes host when the host leaves. */
  readonly joinedAt: number;
}

export type Proposal = ProposalView;

/**
 * Room state. Plain JSON (no Maps, no classes) so the same object can be kept
 * in memory or in Redis, and survive a server restart (SRS-REL-03).
 */
export interface Room {
  readonly id: string;
  readonly code: string;
  hostId: string;
  readonly scenarioId: string;
  readonly difficulty: Difficulty;
  status: RoomStatus;
  design: Design;
  /** Design version, sent to clients for optimistic concurrency. */
  version: number;
  /** Storage revision: bumped on every save, used for compare-and-swap. */
  rev: number;
  members: Record<string, Member>;
  proposals: Record<string, Proposal>;
  proposalsResolved: number;
  noGoVotes: number;
  lastActivity: number;
  result: MissionResult | null;
}

/**
 * Where rooms live. Every write is compare-and-swap on `rev`, so two server
 * instances editing the same room never lose an update: the loser reloads
 * and retries (see RoomService.mutate).
 */
export interface RoomStore {
  get(id: string): Promise<Room | null>;
  idForCode(code: string): Promise<string | null>;
  /** Saves a new room; false if the code is already taken. */
  create(room: Room, ttlMs: number): Promise<boolean>;
  /** Saves only if the stored rev equals `room.rev - 1`; false on conflict. */
  update(room: Room, ttlMs: number): Promise<boolean>;
  delete(room: Room): Promise<void>;
  /** Removes rooms idle longer than `idleMs`. Redis expires keys itself and returns 0. */
  sweep(now: number, idleMs: number): Promise<number>;
  size(): Promise<number>;
}

/** Single-instance store. Rooms are kept serialised so they behave exactly like Redis copies. */
export function memoryRoomStore(): RoomStore {
  const rooms = new Map<string, string>();
  const codes = new Map<string, string>();
  const read = (id: string) => {
    const raw = rooms.get(id);
    return raw ? (JSON.parse(raw) as Room) : null;
  };
  return {
    get: async (id) => read(id),
    idForCode: async (code) => codes.get(code) ?? null,
    create: async (room) => {
      if (codes.has(room.code)) return false;
      codes.set(room.code, room.id);
      rooms.set(room.id, JSON.stringify(room));
      return true;
    },
    update: async (room) => {
      const current = read(room.id);
      if (!current || current.rev !== room.rev - 1) return false;
      rooms.set(room.id, JSON.stringify(room));
      return true;
    },
    delete: async (room) => {
      rooms.delete(room.id);
      codes.delete(room.code);
    },
    sweep: async (now, idleMs) => {
      let removed = 0;
      for (const id of [...rooms.keys()]) {
        const room = read(id);
        if (room && now - room.lastActivity > idleMs) {
          rooms.delete(id);
          codes.delete(room.code);
          removed++;
        }
      }
      return removed;
    },
    size: async () => rooms.size,
  };
}

const roomKey = (id: string) => `gravity:room:${id}`;
const codeKey = (code: string) => `gravity:roomcode:${code}`;

// KEYS: room, code. ARGV: expected rev ('' = must not exist), new rev, json, ttl ms, room id.
// Atomic in Redis, so the check and the write cannot interleave with another instance.
const SAVE_SCRIPT = `
local cur = redis.call('HGET', KEYS[1], 'rev')
if ARGV[1] == '' then
  if cur then return 0 end
  if redis.call('SET', KEYS[2], ARGV[5], 'NX', 'PX', ARGV[4]) == false then return 0 end
elseif cur ~= ARGV[1] then
  return 0
end
redis.call('HSET', KEYS[1], 'rev', ARGV[2], 'data', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
redis.call('PEXPIRE', KEYS[2], ARGV[4])
return 1
`;

/**
 * Shared store for several server instances (SRS-REL-03/04). Keys expire after
 * the idle timeout, so abandoned rooms clean themselves up.
 */
export function redisRoomStore(redis: Redis): RoomStore {
  const save = async (room: Room, expectedRev: string, ttlMs: number) =>
    (await redis.eval(
      SAVE_SCRIPT,
      2,
      roomKey(room.id),
      codeKey(room.code),
      expectedRev,
      String(room.rev),
      JSON.stringify(room),
      String(ttlMs),
      room.id,
    )) === 1;

  return {
    get: async (id) => {
      const raw = await redis.hget(roomKey(id), 'data');
      return raw ? (JSON.parse(raw) as Room) : null;
    },
    idForCode: (code) => redis.get(codeKey(code)),
    create: (room, ttlMs) => save(room, '', ttlMs),
    update: (room, ttlMs) => save(room, String(room.rev - 1), ttlMs),
    delete: async (room) => {
      await redis.del(roomKey(room.id), codeKey(room.code));
    },
    sweep: async () => 0,
    size: async () => {
      let count = 0;
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', roomKey('*'), 'COUNT', 200);
        cursor = next;
        count += keys.length;
      } while (cursor !== '0');
      return count;
    },
  };
}
