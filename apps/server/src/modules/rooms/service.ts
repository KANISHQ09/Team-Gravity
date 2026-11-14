import { randomInt, randomUUID } from 'node:crypto';
import { reviewDesign, runMission } from '@gravity/engine';
import {
  type DesignEdit,
  type Difficulty,
  type ProposalMessage,
  REJOIN_GRACE_SECONDS,
  type Role,
  type RoomSnapshot,
  type VoteChoice,
  applyEdit,
  editOwner,
  emptyDesign,
} from '@gravity/shared';
import { type Member, type Proposal, type Room, type RoomStore, memoryRoomStore } from './store.ts';

export type { Member, Proposal, Room } from './store.ts';

export class RoomError extends Error {
  constructor(
    readonly title: string,
    detail: string,
    readonly status = 400,
  ) {
    super(detail);
  }
}

// No 0/O/1/I so codes are easy to read aloud (matches roomCodeSchema).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_MEMBERS = 4;
export const IDLE_MS = 30 * 60 * 1000;
export const REJOIN_GRACE_MS = REJOIN_GRACE_SECONDS * 1000;
/** Compare-and-swap retries before giving up; conflicts need two edits in the same instant. */
const MAX_ATTEMPTS = 8;

const roleName = (role: Role) => role.replace('-', ' ');

/** Public, serialisable view of a room (RoomSnapshot in packages/shared). */
export function snapshot(room: Room): RoomSnapshot {
  return {
    roomId: room.id,
    code: room.code,
    hostId: room.hostId,
    scenarioId: room.scenarioId,
    difficulty: room.difficulty,
    status: room.status,
    design: room.design,
    version: room.version,
    members: Object.values(room.members)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => ({
        userId: m.userId,
        roles: m.roles,
        vote: m.vote,
        connected: m.connections > 0,
        isHost: m.userId === room.hostId,
      })),
    proposals: Object.values(room.proposals),
  };
}

export function allGo(room: Room): boolean {
  return Object.values(room.members).every((m) => m.vote?.vote === 'go');
}

/**
 * Authoritative co-op rules (SRS-COL). State lives in a RoomStore (memory for
 * one instance, Redis for several); this class only decides what may change.
 */
export class RoomService {
  constructor(
    private readonly store: RoomStore = memoryRoomStore(),
    private readonly now: () => number = Date.now,
  ) {}

  async create(hostId: string, scenarioId: string, difficulty: Difficulty): Promise<Room> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const now = this.now();
      const room: Room = {
        id: randomUUID(),
        code: Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
          '',
        ),
        hostId,
        scenarioId,
        difficulty,
        status: 'lobby',
        design: emptyDesign(scenarioId, difficulty),
        version: 0,
        rev: 0,
        members: { [hostId]: this.newMember(hostId, now) },
        proposals: {},
        proposalsResolved: 0,
        noGoVotes: 0,
        lastActivity: now,
        result: null,
      };
      if (await this.store.create(room, IDLE_MS)) return room;
    }
    throw new Error('Could not allocate a room code');
  }

  get(id: string): Promise<Room | null> {
    return this.store.get(id);
  }

  async byCode(code: string): Promise<Room> {
    const id = await this.store.idForCode(code);
    const room = id ? await this.store.get(id) : null;
    if (!room) throw new RoomError('Room not found', `No room with code ${code}.`, 404);
    return room;
  }

  /** Adds the player to the room (REST join, or the first socket `room:join`). */
  async join(code: string, userId: string): Promise<Room> {
    const { id } = await this.byCode(code);
    return (await this.mutate(id, (room) => this.addMember(room, userId))).room;
  }

  /** A socket for this player joined the room channel. */
  async connect(code: string, userId: string): Promise<Room> {
    const { id } = await this.byCode(code);
    const { room } = await this.mutate(id, (room) => {
      this.addMember(room, userId);
      const me = room.members[userId]!;
      me.connections++;
      me.disconnectedAt = null;
    });
    return room;
  }

  /** A socket closed. The player keeps their seat for REJOIN_GRACE_MS (SRS-COL-06). */
  async disconnect(roomId: string, userId: string): Promise<Room | null> {
    if (!(await this.store.get(roomId))) return null;
    const { room } = await this.mutate(roomId, (room) => {
      const me = room.members[userId];
      if (!me) return;
      me.connections = Math.max(0, me.connections - 1);
      if (me.connections === 0) me.disconnectedAt = this.now();
    });
    return room;
  }

  async claimRoles(roomId: string, userId: string, roles: Role[]): Promise<Room> {
    const { room } = await this.mutate(roomId, (room) => {
      const me = this.member(room, userId);
      this.assertEditable(room);
      for (const role of roles) {
        const holder = Object.values(room.members).find(
          (m) => m.userId !== userId && m.roles.includes(role),
        );
        if (holder)
          throw new RoomError(
            'Role taken',
            `Another player already holds the ${roleName(role)} role.`,
            409,
          );
      }
      me.roles = [...new Set(roles)];
      if (room.status === 'lobby') room.status = 'design';
    });
    return room;
  }

  /** Applies an edit if the caller owns it and is up to date (optimistic concurrency). */
  async patch(roomId: string, userId: string, edit: DesignEdit, baseVersion: number) {
    const { room } = await this.mutate(roomId, (room) => {
      const me = this.member(room, userId);
      this.assertEditable(room);
      const owner = editOwner(edit);
      if (!me.roles.includes(owner)) {
        throw new RoomError(
          'Not your role',
          `This change belongs to the ${roleName(owner)}. Send a proposal instead.`,
          403,
        );
      }
      if (baseVersion !== room.version) {
        throw new RoomError(
          'Version conflict',
          `The design changed (now version ${room.version}). Rebase and try again.`,
          409,
        );
      }
      this.apply(room, edit);
    });
    return room;
  }

  async propose(roomId: string, userId: string, edit: DesignEdit, message: ProposalMessage) {
    return this.mutate(roomId, (room): Proposal => {
      this.member(room, userId);
      this.assertEditable(room);
      const proposal: Proposal = {
        id: randomUUID(),
        from: userId,
        edit,
        owner: editOwner(edit),
        message,
      };
      room.proposals[proposal.id] = proposal;
      return proposal;
    });
  }

  async respond(roomId: string, userId: string, proposalId: string, accept: boolean) {
    return this.mutate(roomId, (room): Proposal => {
      const me = this.member(room, userId);
      this.assertEditable(room);
      const proposal = room.proposals[proposalId];
      if (!proposal)
        throw new RoomError('Proposal not found', 'This proposal was already answered.', 404);
      if (!me.roles.includes(proposal.owner)) {
        throw new RoomError(
          'Not your role',
          'Only the owner of this part of the design can answer.',
          403,
        );
      }
      delete room.proposals[proposalId];
      room.proposalsResolved++;
      if (accept) this.apply(room, proposal.edit);
      return proposal;
    });
  }

  async vote(roomId: string, userId: string, vote: VoteChoice): Promise<Room> {
    const { room } = await this.mutate(roomId, (room) => {
      const me = this.member(room, userId);
      this.assertEditable(room);
      me.vote = vote;
      if (vote.vote === 'no-go') room.noGoVotes++;
    });
    return room;
  }

  /** The player leaves for good: frees their roles and drops their open proposals. */
  async leave(roomId: string, userId: string): Promise<Room | null> {
    const { room } = await this.mutate(roomId, (room) => {
      this.member(room, userId);
      this.dropMember(room, userId);
    });
    if (Object.keys(room.members).length === 0) {
      await this.store.delete(room);
      return null;
    }
    return room;
  }

  /** Host frees the seat of a player who has been away longer than the grace period. */
  async remove(roomId: string, hostId: string, targetId: string): Promise<Room> {
    const { room } = await this.mutate(roomId, (room) => {
      if (hostId !== room.hostId)
        throw new RoomError('Host only', 'Only the room host can remove a player.', 403);
      if (targetId === hostId)
        throw new RoomError('Not allowed', 'Use room:leave to leave the room yourself.', 400);
      const target = this.member(room, targetId, 404);
      if (!this.awayTooLong(target)) {
        throw new RoomError(
          'Player still active',
          `A player can be removed only after ${REJOIN_GRACE_SECONDS / 60} minutes offline.`,
          409,
        );
      }
      this.dropMember(room, targetId);
    });
    return room;
  }

  /** Host launches once every player voted GO and the readiness gate passes (SRS-COL-04). */
  async start(roomId: string, userId: string, seed: number): Promise<Room> {
    const { room } = await this.mutate(roomId, (room) => {
      this.member(room, userId);
      if (userId !== room.hostId)
        throw new RoomError('Host only', 'Only the room host can launch.', 403);
      this.assertEditable(room);
      if (!allGo(room))
        throw new RoomError('Waiting for GO', 'Every player must vote GO before launch.', 409);
      if (!reviewDesign(room.design).canLaunch)
        throw new RoomError(
          'Launch blocked',
          'The design does not pass the readiness review.',
          409,
        );
      room.result = runMission(room.design, seed, {
        playerCount: Object.keys(room.members).length,
        proposalsResolved: room.proposalsResolved,
        noGoVotes: room.noGoVotes,
      });
      room.status = 'report';
    });
    return room;
  }

  /** Removes rooms idle for 30 minutes (SRS-REL-03). Returns the number removed. */
  sweep(): Promise<number> {
    return this.store.sweep(this.now(), IDLE_MS);
  }

  size(): Promise<number> {
    return this.store.size();
  }

  /**
   * Load → change → save with compare-and-swap, retrying if another request
   * (or server instance) saved the room in between. `change` must only touch
   * the room it is given; it may run more than once.
   */
  private async mutate<T>(
    roomId: string,
    change: (room: Room) => T,
  ): Promise<{ room: Room; value: T }> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const room = await this.store.get(roomId);
      if (!room) throw new RoomError('Room not found', 'This room has closed.', 404);
      this.handOverHost(room);
      const value = change(room);
      room.rev++;
      room.lastActivity = this.now();
      if (await this.store.update(room, IDLE_MS)) return { room, value };
    }
    throw new RoomError('Room busy', 'Too many changes at once. Try again.', 503);
  }

  private newMember(userId: string, now: number): Member {
    // Not connected until a socket joins, so the grace period starts now.
    return { userId, roles: [], vote: null, connections: 0, disconnectedAt: now, joinedAt: now };
  }

  private addMember(room: Room, userId: string) {
    if (room.members[userId]) return;
    if (Object.keys(room.members).length >= MAX_MEMBERS)
      throw new RoomError('Room full', 'This room already has four players.', 409);
    if (room.status === 'simulating' || room.status === 'report') {
      throw new RoomError(
        'Mission already launched',
        'This room has already launched its mission.',
        409,
      );
    }
    room.members[userId] = this.newMember(userId, this.now());
  }

  private dropMember(room: Room, userId: string) {
    delete room.members[userId];
    for (const [id, p] of Object.entries(room.proposals))
      if (p.from === userId) delete room.proposals[id];
    if (room.hostId === userId) {
      const next = this.successor(room);
      if (next) room.hostId = next.userId;
    }
  }

  private awayTooLong(m: Member): boolean {
    return (
      m.connections === 0 &&
      m.disconnectedAt !== null &&
      this.now() - m.disconnectedAt >= REJOIN_GRACE_MS
    );
  }

  /** Earliest-joined remaining player, preferring one who is online. */
  private successor(room: Room): Member | undefined {
    const others = Object.values(room.members)
      .filter((m) => m.userId !== room.hostId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    return others.find((m) => m.connections > 0) ?? others[0];
  }

  /** A host who stays away past the grace period hands over to an online player (SRS-COL-06). */
  private handOverHost(room: Room) {
    const host = room.members[room.hostId];
    if (host && !this.awayTooLong(host)) return;
    const next = this.successor(room);
    if (next && next.connections > 0) room.hostId = next.userId;
  }

  private apply(room: Room, edit: DesignEdit) {
    room.design = applyEdit(room.design, edit);
    room.version++;
    // Any change to the design resets everyone's GO/NO-GO vote.
    for (const m of Object.values(room.members)) m.vote = null;
  }

  private assertEditable(room: Room) {
    if (room.status === 'simulating' || room.status === 'report') {
      throw new RoomError('Mission already launched', 'The design can no longer change.', 409);
    }
  }

  private member(room: Room, userId: string, status = 403): Member {
    const m = room.members[userId];
    if (!m) throw new RoomError('Not a member', 'Join the room first.', status);
    return m;
  }
}
