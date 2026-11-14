import { z } from 'zod';
import type { Design, Difficulty } from './domain.ts';
import type { DesignEdit, Role } from './edits.ts';
import type {
  NO_GO_REASONS,
  PROPOSAL_MESSAGES,
  designPatchSchema,
  proposalCreateSchema,
  proposalRespondSchema,
  roleClaimSchema,
  roomJoinSchema,
  voteCastSchema,
} from './api.ts';

/**
 * Socket.IO contract for co-op rooms (docs/API_DOCUMENTATION.md §3).
 * The server types its `Server` with these maps and the web app types its
 * `Socket` with the same maps, so an event or payload cannot drift apart.
 *
 * `sim:result` carries the engine's MissionResult. `packages/shared` must not
 * import the engine (dependency direction), so the maps take it as a type
 * parameter: `ServerToClientEvents<MissionResult>`.
 */

// --- Client → server payloads added for room lifecycle (SRS-COL-06) ---

/** `sim:start` and `room:leave` take no data; `{}` and no payload are both accepted. */
export const emptyPayloadSchema = z.strictObject({}).optional();
export const memberRemoveSchema = z.strictObject({ userId: z.string().min(1).max(64) });

export type ProposalMessage = (typeof PROPOSAL_MESSAGES)[number];
export type NoGoReason = (typeof NO_GO_REASONS)[number];
export type VoteChoice = z.infer<typeof voteCastSchema>;

// --- Server → client views ---

export type RoomStatus = 'lobby' | 'design' | 'simulating' | 'report';

export interface RoomMemberView {
  readonly userId: string;
  readonly roles: Role[];
  readonly vote: VoteChoice | null;
  readonly connected: boolean;
  readonly isHost: boolean;
}

export interface ProposalView {
  readonly id: string;
  /** userId of the player who proposed the change. */
  readonly from: string;
  readonly edit: DesignEdit;
  /** The role that must accept or reject it. */
  readonly owner: Role;
  readonly message: ProposalMessage;
}

/** Full room snapshot, sent as `room:state` after every change. */
export interface RoomSnapshot {
  readonly roomId: string;
  readonly code: string;
  readonly hostId: string;
  readonly scenarioId: string;
  readonly difficulty: Difficulty;
  readonly status: RoomStatus;
  readonly design: Design;
  /** Design version for optimistic concurrency: send it back as `baseVersion`. */
  readonly version: number;
  readonly members: RoomMemberView[];
  readonly proposals: ProposalView[];
}

export interface DesignAppliedEvent {
  readonly edit: DesignEdit;
  readonly version: number;
  readonly design: Design;
  /** userId of the player whose edit (or accepted proposal) changed the design. */
  readonly by: string;
}

export interface DesignRejectedEvent {
  readonly title: string;
  readonly reason: string;
  /** Rebase on this version and try again. */
  readonly latestVersion: number;
}

export interface ProposalUpdateEvent {
  readonly proposal: ProposalView;
  readonly status: 'open' | 'accepted' | 'rejected';
}

export interface VoteUpdateEvent {
  readonly votes: { readonly userId: string; readonly vote: VoteChoice | null }[];
  readonly allGo: boolean;
}

export interface RoomErrorEvent {
  /** The client event that failed. */
  readonly event: string;
  readonly title: string;
  readonly detail: string;
}

/** Sent to a player who is no longer in the room. */
export interface RoomLeftEvent {
  readonly reason: 'left' | 'removed';
}

// --- Event maps (Socket.IO generics) ---

export interface ClientToServerEvents {
  'room:join': (payload: z.input<typeof roomJoinSchema>) => void;
  'room:leave': (payload?: Record<string, never>) => void;
  'role:claim': (payload: z.input<typeof roleClaimSchema>) => void;
  'design:patch': (payload: z.input<typeof designPatchSchema>) => void;
  'proposal:create': (payload: z.input<typeof proposalCreateSchema>) => void;
  'proposal:respond': (payload: z.input<typeof proposalRespondSchema>) => void;
  'vote:cast': (payload: z.input<typeof voteCastSchema>) => void;
  /** Host only: a player disconnected for 2+ minutes frees their seat and roles. */
  'member:remove': (payload: z.input<typeof memberRemoveSchema>) => void;
  /** Host only: needs every player's GO and a passed readiness review. */
  'sim:start': (payload?: Record<string, never>) => void;
}

export interface ServerToClientEvents<TResult = unknown> {
  'room:state': (snapshot: RoomSnapshot) => void;
  'room:left': (event: RoomLeftEvent) => void;
  'room:error': (event: RoomErrorEvent) => void;
  'design:applied': (event: DesignAppliedEvent) => void;
  'design:rejected': (event: DesignRejectedEvent) => void;
  'proposal:update': (event: ProposalUpdateEvent) => void;
  'vote:update': (event: VoteUpdateEvent) => void;
  /** Same result for every player; also re-sent to a player who rejoins after launch. */
  'sim:result': (result: TResult) => void;
}

// --- REST responses ---

export interface GuestSessionResponse {
  readonly accessToken: string;
  readonly guestId: string;
  /** Seconds until the access token expires. */
  readonly expiresIn: number;
}

export interface CreateRoomResponse {
  readonly code: string;
  readonly roomId: string;
}

/** `POST /rooms/:code/join` returns the room snapshot. */
export type JoinRoomResponse = RoomSnapshot;

/** Seconds a disconnected player keeps their seat before the host may remove them. */
export const REJOIN_GRACE_SECONDS = 120;
