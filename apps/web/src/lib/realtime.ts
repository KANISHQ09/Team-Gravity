import type { MissionResult } from '@gravity/engine';
import {
  type DesignAppliedEvent,
  type DesignEdit,
  type DesignRejectedEvent,
  type Difficulty,
  type ProposalUpdateEvent,
  type Role,
  type RoomErrorEvent,
  type RoomLeftEvent,
  type RoomSnapshot,
  type VoteUpdateEvent,
  PROPOSAL_MESSAGES,
  REJOIN_GRACE_SECONDS,
  ROLES,
  editOwner,
} from '@gravity/shared';
import { io } from 'socket.io-client';
import { registerRemote, useGame } from '../store/game.ts';
import { myMember, playerLabel, useOnline } from '../store/online.ts';
import { API_BASE, createRoom, guestSession } from './api.ts';

/** Minimal socket surface we use, so tests can pass a fake. */
export interface RoomSocket {
  on(event: string, handler: (payload: never) => void): unknown;
  emit(event: string, payload?: unknown): unknown;
  disconnect(): unknown;
}
export type SocketFactory = (url: string, token: string) => RoomSocket;

const defaultFactory: SocketFactory = (url, token) =>
  io(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  }) as unknown as RoomSocket;

let socket: RoomSocket | null = null;
let lastCode: string | null = null;

/** Milliseconds a disconnected player keeps their seat before the host may remove them. */
export const REJOIN_GRACE_MS = REJOIN_GRACE_SECONDS * 1000;

/** Seconds left before the host may remove an offline player (0 = removable now). */
export function removableIn(userId: string, now = Date.now()): number {
  const since = useOnline.getState().offlineSince[userId];
  if (since === undefined) return Infinity;
  return Math.max(0, Math.ceil((REJOIN_GRACE_MS - (now - since)) / 1000));
}

function applySnapshot(s: RoomSnapshot) {
  const before = useOnline.getState();
  const now = Date.now();
  // Track how long each player has been offline (the server sends only a flag).
  const offlineSince: Record<string, number> = {};
  for (const m of s.members) {
    if (!m.connected) offlineSince[m.userId] = before.offlineSince[m.userId] ?? now;
  }
  const left = before.members.filter((m) => !s.members.some((n) => n.userId === m.userId));
  const hostChanged = before.hostId !== null && before.hostId !== s.hostId;

  useOnline.getState().set({
    roomId: s.roomId,
    code: s.code,
    hostId: s.hostId,
    roomStatus: s.status,
    version: s.version,
    members: s.members,
    proposals: s.proposals,
    offlineSince,
  });

  const after = useOnline.getState();
  const notices: string[] = [];
  for (const m of left) {
    notices.push(
      `${playerLabel(before, m.userId).replace(' · host', '')} left the room; their roles are free to claim.`,
    );
  }
  if (hostChanged) {
    notices.push(
      s.hostId === after.me
        ? 'You are now the room host: you start the launch and can free the seat of a player who has gone.'
        : `${playerLabel(after, s.hostId)} is now the room host.`,
    );
  }
  if (notices.length) useGame.setState({ notice: notices.join(' ') });

  const game = useGame.getState();
  if (!game.design || game.design !== s.design) useGame.setState({ design: s.design });
  if (game.screen === 'home' && (s.status === 'lobby' || s.status === 'design')) {
    useGame.setState({ screen: 'mission', stage: 'goals' });
  }
}

/** Wire server events into the stores. Exported for tests. */
export function attach(s: RoomSocket, code: string) {
  socket = s;
  lastCode = code;
  const online = () => useOnline.getState();
  const notice = (text: string) => useGame.setState({ notice: text });

  s.on('connect', () => {
    online().set({ status: 'connected', error: null });
    s.emit('room:join', { code });
  });
  s.on('disconnect', () => online().set({ status: 'disconnected' }));
  s.on('connect_error', (e: Error) => online().set({ status: 'error', error: e.message }));
  s.on('room:state', (snap: RoomSnapshot) => applySnapshot(snap));
  s.on('room:left', (p: RoomLeftEvent) => {
    // We asked to leave: leaveRoom() already tidied up.
    if (p.reason !== 'removed') return;
    leaveKeepingDesign(false);
    notice(
      'The host freed your seat because you were offline for a while. Your design is kept, so you can carry on solo or join the room again with its code.',
    );
  });
  s.on('design:applied', (p: DesignAppliedEvent) => {
    online().set({ version: p.version });
    useGame.setState({ design: p.design, notice: null });
  });
  s.on('design:rejected', (p: DesignRejectedEvent) => {
    online().set({ version: p.latestVersion });
    notice(`${p.title}: ${p.reason}`);
  });
  s.on('proposal:update', (p: ProposalUpdateEvent) => {
    const rest = online().proposals.filter((x) => x.id !== p.proposal.id);
    online().set({ proposals: p.status === 'open' ? [...rest, p.proposal] : rest });
  });
  s.on('vote:update', (p: VoteUpdateEvent) => {
    const votes = new Map(p.votes.map((v) => [v.userId, v.vote]));
    online().set({
      members: online().members.map((m) => ({ ...m, vote: votes.get(m.userId) ?? null })),
    });
  });
  s.on('sim:result', (result: MissionResult) => {
    online().set({ roomStatus: 'report' });
    useGame.setState({ result, screen: 'flight', notice: null });
    useGame.getState().recordRun(result);
  });
  s.on('room:error', (p: RoomErrorEvent) => notice(`${p.title}: ${p.detail}`));
}

async function connect(code: string, factory: SocketFactory) {
  const { token, guestId } = await guestSession();
  socket?.disconnect();
  lastCode = code;
  useOnline.getState().set({ active: true, status: 'connecting', me: guestId, code, error: null });
  socket = factory(API_BASE, token);
  attach(socket, code);
}

/** Create a room on the server and join it as host. */
export async function hostRoom(
  scenarioId: string,
  difficulty: Difficulty,
  factory = defaultFactory,
) {
  useOnline.getState().set({ status: 'connecting', error: null });
  try {
    const { code } = await createRoom(scenarioId, difficulty);
    useGame.setState({ result: null, votes: [], proposals: [] });
    await connect(code, factory);
  } catch (e) {
    useOnline.getState().set({ status: 'error', error: (e as Error).message });
  }
}

export async function joinRoom(code: string, factory = defaultFactory) {
  useOnline.getState().set({ status: 'connecting', error: null });
  try {
    useGame.setState({ result: null, votes: [], proposals: [] });
    await connect(code.trim().toUpperCase(), factory);
  } catch (e) {
    useOnline.getState().set({ status: 'error', error: (e as Error).message });
  }
}

/** Close the connection; tell the server first when leaving for good, so the seat and roles free up at once. */
function closeSocket(sayLeave: boolean) {
  if (sayLeave) socket?.emit('room:leave', {});
  socket?.disconnect();
  socket = null;
  lastCode = null;
  useOnline.getState().reset();
}

export function leaveRoom() {
  closeSocket(true);
  useGame.setState({ screen: 'home', notice: null });
}

/** Host only: free the seat of a player who has been offline past the grace period. */
export function removeMember(userId: string) {
  socket?.emit('member:remove', { userId });
}

/** Send an edit: directly if this player owns it, otherwise as a proposal to the owner. */
export function sendEdit(edit: DesignEdit) {
  const o = useOnline.getState();
  const me = myMember(o);
  if (!socket || !me) return;
  if (me.roles.includes(editOwner(edit))) {
    socket.emit('design:patch', { edit, baseVersion: o.version });
  } else {
    socket.emit('proposal:create', { edit, message: PROPOSAL_MESSAGES[2] });
    useGame.setState({
      notice: `This change belongs to the ${editOwner(edit).replace('-', ' ')}. It was sent to them as a proposal.`,
    });
  }
}

/** Leave the room but keep its design, so the player can iterate solo with all four roles. */
function leaveKeepingDesign(sayLeave = true) {
  closeSocket(sayLeave);
  useGame.setState({
    players: [{ name: 'Player 1', roles: [...ROLES] }],
    activePlayer: 0,
    votes: [null],
    proposals: [],
  });
}

registerRemote({
  active: () => useOnline.getState().active,
  edit: sendEdit,
  vote: (vote) => socket?.emit('vote:cast', vote),
  respond: (proposalId, accept) => socket?.emit('proposal:respond', { proposalId, accept }),
  launch: () => socket?.emit('sim:start'),
  leaveKeepingDesign: () => leaveKeepingDesign(true),
  leave: leaveRoom,
});

export const claimRoles = (roles: Role[]) => socket?.emit('role:claim', { roles });
export const currentRoomCode = () => lastCode;
