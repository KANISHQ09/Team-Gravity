import type { DesignEdit, Role } from '@gravity/shared';
import { create } from 'zustand';
import type { Vote } from './game.ts';

export interface OnlineMember {
  readonly userId: string;
  readonly roles: readonly Role[];
  readonly vote: Vote | null;
  readonly connected: boolean;
}

export interface OnlineProposal {
  readonly id: string;
  readonly from: string;
  readonly edit: DesignEdit;
  readonly owner: Role;
  readonly message: string;
}

export type OnlineStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface OnlineState {
  /** True while the player is in an online room: design edits go through the server. */
  active: boolean;
  status: OnlineStatus;
  code: string | null;
  roomId: string | null;
  me: string | null;
  hostId: string | null;
  roomStatus: 'lobby' | 'design' | 'simulating' | 'report';
  version: number;
  members: OnlineMember[];
  proposals: OnlineProposal[];
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
  roomStatus: 'lobby' as const,
  version: 0,
  members: [] as OnlineMember[],
  proposals: [] as OnlineProposal[],
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
