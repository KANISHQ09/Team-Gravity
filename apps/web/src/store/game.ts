import {
  type Design,
  type DesignEdit,
  type Difficulty,
  type NO_GO_REASONS,
  type Role,
  applyEdit,
  assignRoles,
  designSchema,
  editOwner,
  emptyDesign,
} from '@gravity/shared';
import { type MissionResult, runMission } from '@gravity/engine';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The six NASA-style stages (Gravity.md §0.6.2). */
export const STAGES = [
  { id: 'goals', title: 'Need & Goals' },
  { id: 'concept', title: 'Concept' },
  { id: 'requirements', title: 'Requirements' },
  { id: 'design', title: 'Design' },
  { id: 'verify', title: 'Build & Verify' },
  { id: 'launch', title: 'Implement' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

export type Screen = 'home' | 'mission' | 'flight' | 'report' | 'glossary' | 'about';
export type Vote = { vote: 'go' } | { vote: 'no-go'; reason: (typeof NO_GO_REASONS)[number] };

export interface Player {
  readonly name: string;
  readonly roles: readonly Role[];
}

export interface Proposal {
  readonly id: string;
  readonly from: number;
  readonly edit: DesignEdit;
  readonly owner: Role;
}

interface GameState {
  screen: Screen;
  stage: StageId;
  design: Design | null;
  players: Player[];
  activePlayer: number;
  proposals: Proposal[];
  proposalsResolved: number;
  votes: (Vote | null)[];
  noGoVotes: number;
  result: MissionResult | null;
  /** Message explaining why the last action was not applied (shown in a live region). */
  notice: string | null;

  go(screen: Screen): void;
  setStage(stage: StageId): void;
  startMission(scenarioId: string, difficulty: Difficulty, playerCount: number): void;
  edit(edit: DesignEdit): void;
  respondToProposal(id: string, accept: boolean): void;
  passDevice(): void;
  castVote(player: number, vote: Vote): void;
  launch(): void;
  /** Back to the studio with the same design, to iterate (US-07). */
  redesign(edit?: DesignEdit): void;
  loadDesign(design: Design): void;
  dismissNotice(): void;
}

const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

/** Seeds come from the browser's crypto RNG; the engine itself stays deterministic. */
function newSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % 2 ** 31;
}

export const canEdit = (player: Player | undefined, edit: DesignEdit) =>
  !!player && player.roles.includes(editOwner(edit));

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      stage: 'goals',
      design: null,
      players: [],
      activePlayer: 0,
      proposals: [],
      proposalsResolved: 0,
      votes: [],
      noGoVotes: 0,
      result: null,
      notice: null,

      go: (screen) => set({ screen, notice: null }),
      setStage: (stage) => set({ stage, screen: 'mission', notice: null }),

      startMission: (scenarioId, difficulty, playerCount) => {
        const groups = assignRoles(playerCount);
        set({
          screen: 'mission',
          stage: 'goals',
          design: emptyDesign(scenarioId, difficulty),
          players: groups.map((roles, i) => ({ name: PLAYER_NAMES[i]!, roles })),
          activePlayer: 0,
          proposals: [],
          proposalsResolved: 0,
          votes: groups.map(() => null),
          noGoVotes: 0,
          result: null,
          notice: null,
        });
      },

      edit: (edit) => {
        const { design, players, activePlayer, proposals } = get();
        if (!design) return;
        const player = players[activePlayer];
        if (canEdit(player, edit)) {
          // Any change to the design invalidates earlier GO votes.
          set({ design: applyEdit(design, edit), votes: players.map(() => null), notice: null });
          return;
        }
        const owner = editOwner(edit);
        const id = `p${Date.now().toString(36)}${proposals.length}`;
        set({
          proposals: [...proposals, { id, from: activePlayer, edit, owner }],
          notice: `This change belongs to the ${owner.replace('-', ' ')}. It was sent as a proposal for them to accept or reject.`,
        });
      },

      respondToProposal: (id, accept) => {
        const { proposals, design, players, activePlayer } = get();
        const proposal = proposals.find((p) => p.id === id);
        if (!proposal || !design) return;
        if (!players[activePlayer]?.roles.includes(proposal.owner)) {
          set({ notice: 'Only the owner of this part of the design can answer the proposal.' });
          return;
        }
        set({
          proposals: proposals.filter((p) => p.id !== id),
          proposalsResolved: get().proposalsResolved + 1,
          design: accept ? applyEdit(design, proposal.edit) : design,
          votes: accept ? players.map(() => null) : get().votes,
          notice: accept ? 'Proposal accepted.' : 'Proposal rejected.',
        });
      },

      passDevice: () => {
        const { players, activePlayer } = get();
        set({ activePlayer: (activePlayer + 1) % Math.max(1, players.length), notice: null });
      },

      castVote: (player, vote) => {
        const votes = [...get().votes];
        votes[player] = vote;
        set({ votes, noGoVotes: get().noGoVotes + (vote.vote === 'no-go' ? 1 : 0) });
      },

      launch: () => {
        const { design, players, proposalsResolved, noGoVotes } = get();
        if (!design) return;
        const team =
          players.length > 1
            ? { playerCount: players.length, proposalsResolved, noGoVotes }
            : undefined;
        const result = runMission(design, newSeed(), team);
        set({ result, screen: 'flight', notice: null });
      },

      redesign: (edit) => {
        const { design, players } = get();
        if (!design) return;
        set({
          design: edit ? applyEdit(design, edit) : design,
          screen: 'mission',
          stage: 'design',
          votes: players.map(() => null),
          result: null,
          notice: edit ? 'Suggested change applied. Review it, then launch again.' : null,
        });
      },

      loadDesign: (design) => {
        const groups = assignRoles(1);
        set({
          design,
          players: groups.map((roles, i) => ({ name: PLAYER_NAMES[i]!, roles })),
          activePlayer: 0,
          votes: [null],
          proposals: [],
          screen: 'mission',
          stage: 'design',
          result: null,
          notice: 'Shared design loaded.',
        });
      },

      dismissNotice: () => set({ notice: null }),
    }),
    {
      name: 'gravity-game-v1',
      storage: createJSONStorage(() => localStorage),
      // Persist the design and team, not transient results or messages.
      partialize: (s) => ({
        screen: s.screen === 'flight' || s.screen === 'report' ? 'mission' : s.screen,
        stage: s.stage,
        design: s.design,
        players: s.players,
        activePlayer: s.activePlayer,
        proposals: s.proposals,
        proposalsResolved: s.proposalsResolved,
        votes: s.votes,
        noGoVotes: s.noGoVotes,
      }),
      // Drop a saved design that no longer matches the schema (e.g. after an update).
      merge: (persisted, current) => {
        const p = persisted as Partial<GameState> | undefined;
        if (!p?.design || !designSchema.safeParse(p.design).success) return current;
        return { ...current, ...p };
      },
    },
  ),
);

/** Encode a design as a URL-safe share code (SRS-SAV-02). */
export function encodeDesign(design: Design): string {
  const json = JSON.stringify(design);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDesign(code: string): Design | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const parsed = designSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
