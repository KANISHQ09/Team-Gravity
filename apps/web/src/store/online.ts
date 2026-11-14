import type { ProposalView, RoomMemberView, RoomStatus } from '@gravity/shared';
import { create } from 'zustand';

/** Same shapes as the server sends (packages/shared/src/realtime.ts). */
export type OnlineMember = RoomMemberView;
export type OnlineProposal = ProposalView;

export type OnlineStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface OnlineState {
  /** True while the player is in an online room: design edits go through the server. */
  active: boolean;
  status: OnlineStatus;
  code: string | null;
  roomId: string | null;
  me: string | null;
  hostId: string | null;
  roomStatus: RoomStatus;
  version: number;
  members: OnlineMember[];
  proposals: OnlineProposal[];
  /** When (ms, this device's clock) each offline player was first seen offline. */
  offlineSince: Record<string, number>;
  error: string | null;
  set(partial: Partial<Omit<OnlineState, 'set' | 'reset'>>): void;
  reset(): void;
}

const initial = {
  active: false,
  status: 'idle' as OnlineStatus,
  code: null,
  roomId: null,
  me: null,
  hostId: null,
  roomStatus: 'lobby' as RoomStatus,
  version: 0,
  members: [] as OnlineMember[],
  proposals: [] as OnlineProposal[],
  offlineSince: {} as Record<string, number>,
  error: null,
};

/** Online co-op room state. Not persisted: a reload rejoins with the room code. */
export const useOnline = create<OnlineState>()((set) => ({
  ...initial,
  set: (partial) => set(partial),
  reset: () => set(initial),
}));

export const myMember = (s: Pick<OnlineState, 'members' | 'me'>) =>
  s.members.find((m) => m.userId === s.me);

/** Short, friendly label for a guest ID (no personal data exists to show). */
export const playerLabel = (s: Pick<OnlineState, 'members' | 'me' | 'hostId'>, userId: string) => {
  const index = s.members.findIndex((m) => m.userId === userId);
  const base = `Player ${index + 1}`;
  return `${base}${userId === s.me ? ' (you)' : ''}${userId === s.hostId ? ' · host' : ''}`;
};
