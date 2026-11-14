import { randomInt, randomUUID } from 'node:crypto';
import { type MissionResult, reviewDesign, runMission } from '@gravity/engine';
import {
  type Design,
  type DesignEdit,
  type Difficulty,
  type NO_GO_REASONS,
  type PROPOSAL_MESSAGES,
  type Role,
  applyEdit,
  editOwner,
  emptyDesign,
} from '@gravity/shared';

export type Vote = { vote: 'go' } | { vote: 'no-go'; reason: (typeof NO_GO_REASONS)[number] };

export interface Member {
  readonly userId: string;
  roles: Role[];
  vote: Vote | null;
  connected: boolean;
}

export interface Proposal {
  readonly id: string;
  readonly from: string;
  readonly edit: DesignEdit;
  readonly owner: Role;
  readonly message: (typeof PROPOSAL_MESSAGES)[number];
}

export interface Room {
  readonly id: string;
  readonly code: string;
  readonly hostId: string;
  status: 'lobby' | 'design' | 'simulating' | 'report';
  design: Design;
  version: number;
  members: Map<string, Member>;
  proposals: Map<string, Proposal>;
  proposalsResolved: number;
  noGoVotes: number;
  lastActivity: number;
  result: MissionResult | null;
}

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

/** Public, serialisable view of a room (no internal maps). */
export function snapshot(room: Room) {
  return {
    roomId: room.id,
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    design: room.design,
    version: room.version,
    members: [...room.members.values()].map((m) => ({
      userId: m.userId,
      roles: m.roles,
      vote: m.vote,
      connected: m.connected,
    })),
    proposals: [...room.proposals.values()],
  };
}

/**
 * In-memory room store, authoritative for co-op (SRS-COL). One server
 * instance holds all rooms; the Redis adapter for multi-instance scaling is
 * a documented follow-up.
 */
export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly byCode = new Map<string, string>();

  constructor(private readonly now: () => number = Date.now) {}

  create(hostId: string, scenarioId: string, difficulty: Difficulty): Room {
    let code = '';
    do {
      code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
        '',
      );
    } while (this.byCode.has(code));
    const room: Room = {
      id: randomUUID(),
      code,
      hostId,
      status: 'lobby',
      design: emptyDesign(scenarioId, difficulty),
      version: 0,
      members: new Map([[hostId, { userId: hostId, roles: [], vote: null, connected: false }]]),
      proposals: new Map(),
      proposalsResolved: 0,
      noGoVotes: 0,
      lastActivity: this.now(),
      result: null,
    };
    this.rooms.set(room.id, room);
    this.byCode.set(code, room.id);
    return room;
  }

  byId(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  join(code: string, userId: string): Room {
    const id = this.byCode.get(code);
    const room = id ? this.rooms.get(id) : undefined;
    if (!room) throw new RoomError('Room not found', `No room with code ${code}.`, 404);
    if (!room.members.has(userId)) {
      if (room.members.size >= MAX_MEMBERS)
        throw new RoomError('Room full', 'This room already has four players.', 409);
      if (room.status === 'simulating' || room.status === 'report') {
        throw new RoomError(
          'Mission already launched',
          'This room has already launched its mission.',
          409,
        );
      }
      room.members.set(userId, { userId, roles: [], vote: null, connected: false });
    }
    this.touch(room);
    return room;
  }

  setConnected(room: Room, userId: string, connected: boolean) {
    const m = room.members.get(userId);
    if (m) m.connected = connected;
  }

  claimRoles(room: Room, userId: string, roles: Role[]) {
    const me = this.member(room, userId);
    for (const role of roles) {
      const holder = [...room.members.values()].find(
        (m) => m.userId !== userId && m.roles.includes(role),
      );
      if (holder)
        throw new RoomError(
          'Role taken',
          `Another player already holds the ${role.replace('-', ' ')} role.`,
          409,
        );
    }
    me.roles = [...new Set(roles)];
    if (room.status === 'lobby') room.status = 'design';
    this.touch(room);
  }

  /** Applies an edit if the caller owns it and is up to date (optimistic concurrency). */
  patch(room: Room, userId: string, edit: DesignEdit, baseVersion: number): void {
    const me = this.member(room, userId);
    this.assertEditable(room);
    const owner = editOwner(edit);
    if (!me.roles.includes(owner)) {
      throw new RoomError(
        'Not your role',
        `This change belongs to the ${owner.replace('-', ' ')}. Send a proposal instead.`,
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
  }

  propose(room: Room, userId: string, edit: DesignEdit, message: Proposal['message']): Proposal {
    this.member(room, userId);
    this.assertEditable(room);
    const proposal: Proposal = {
      id: randomUUID(),
      from: userId,
      edit,
      owner: editOwner(edit),
      message,
    };
    room.proposals.set(proposal.id, proposal);
    this.touch(room);
    return proposal;
  }

  respond(room: Room, userId: string, proposalId: string, accept: boolean): Proposal {
    const me = this.member(room, userId);
    const proposal = room.proposals.get(proposalId);
    if (!proposal)
      throw new RoomError('Proposal not found', 'This proposal was already answered.', 404);
    if (!me.roles.includes(proposal.owner)) {
      throw new RoomError(
        'Not your role',
        'Only the owner of this part of the design can answer.',
        403,
      );
    }
    room.proposals.delete(proposalId);
    room.proposalsResolved++;
    if (accept) this.apply(room, proposal.edit);
    this.touch(room);
    return proposal;
  }

  vote(room: Room, userId: string, vote: Vote) {
    this.member(room, userId).vote = vote;
    if (vote.vote === 'no-go') room.noGoVotes++;
    this.touch(room);
  }

  allGo(room: Room): boolean {
    return [...room.members.values()].every((m) => m.vote?.vote === 'go');
  }

  /** Host launches once every player voted GO and the readiness gate passes (SRS-COL-04). */
  start(room: Room, userId: string, seed: number): MissionResult {
    if (userId !== room.hostId)
      throw new RoomError('Host only', 'Only the room host can launch.', 403);
    if (!this.allGo(room))
      throw new RoomError('Waiting for GO', 'Every player must vote GO before launch.', 409);
    const review = reviewDesign(room.design);
    if (!review.canLaunch)
      throw new RoomError('Launch blocked', 'The design does not pass the readiness review.', 409);
    room.status = 'simulating';
    const result = runMission(room.design, seed, {
      playerCount: room.members.size,
      proposalsResolved: room.proposalsResolved,
      noGoVotes: room.noGoVotes,
    });
    room.result = result;
    room.status = 'report';
    this.touch(room);
    return result;
  }

  /** Removes rooms idle for 30 minutes (SRS-REL-03). Returns the number removed. */
  sweep(): number {
    let removed = 0;
    for (const room of this.rooms.values()) {
      if (this.now() - room.lastActivity > IDLE_MS) {
        this.rooms.delete(room.id);
        this.byCode.delete(room.code);
        removed++;
      }
    }
    return removed;
  }

  get size() {
    return this.rooms.size;
  }

  private apply(room: Room, edit: DesignEdit) {
    room.design = applyEdit(room.design, edit);
    room.version++;
    // Any change to the design resets everyone's GO/NO-GO vote.
    for (const m of room.members.values()) m.vote = null;
  }

  private assertEditable(room: Room) {
    if (room.status === 'simulating' || room.status === 'report') {
      throw new RoomError('Mission already launched', 'The design can no longer change.', 409);
    }
  }

  private member(room: Room, userId: string): Member {
    const m = room.members.get(userId);
    if (!m) throw new RoomError('Not a member', 'Join the room first.', 403);
    return m;
  }

  private touch(room: Room) {
    room.lastActivity = this.now();
  }
}
