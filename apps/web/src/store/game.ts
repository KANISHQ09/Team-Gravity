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
import { type MissionResult, reviewDesign } from '@gravity/engine';
import type { PilotSummary } from '../features/pilot/pilotScore.ts';
import { runMissionOffThread } from '../lib/engineWorker.ts';
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

/** One finished mission, kept for comparing designs (trade space). */
export interface RunRecord {
  readonly id: string;
  readonly scenarioId: string;
  readonly label: string;
  readonly costM: number;
  readonly science: number;
  readonly total: number;
  readonly outcome: 'full' | 'partial' | 'failure';
  readonly risk: 'green' | 'yellow' | 'red';
  readonly design: Design;
}

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
  /** Pilot rating from the 3D flight mini-games; separate from the mission score. */
  pilot: PilotSummary | null;
  /** Recent missions on this device, for the trade-space chart (newest last, max 20). */
  history: RunRecord[];
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
  recordRun(result: MissionResult): void;
  setPilot(pilot: PilotSummary | null): void;
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

/**
 * While the player is in an online room, these send actions to the server
 * instead of applying them locally (registered by lib/realtime.ts; kept as a
 * hook to avoid a circular import).
 */
export interface RemoteActions {
  active(): boolean;
  edit(edit: DesignEdit): void;
  vote(vote: Vote): void;
  respond(proposalId: string, accept: boolean): void;
  launch(): void;
  /** Leave the room but keep the design for solo iteration. */
  leaveKeepingDesign(): void;
}
let remote: RemoteActions | null = null;
export const registerRemote = (r: RemoteActions | null) => {
  remote = r;
};
const online = () => (remote?.active() ? remote : null);

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
      pilot: null,
      notice: null,
      history: [],

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
        const r = online();
        if (r) return r.edit(edit);
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
        const r = online();
        if (r) return r.respond(id, accept);
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
        const r = online();
        if (r) return r.vote(vote);
        const votes = [...get().votes];
        votes[player] = vote;
        set({ votes, noGoVotes: get().noGoVotes + (vote.vote === 'no-go' ? 1 : 0) });
      },

      launch: () => {
        const r = online();
        if (r) return r.launch();
        const { design, players, proposalsResolved, noGoVotes } = get();
        if (!design) return;
        const team =
          players.length > 1
            ? { playerCount: players.length, proposalsResolved, noGoVotes }
            : undefined;
        const run = runMissionOffThread(design, newSeed(), team);
        if ('sync' in run) {
          set({ result: run.sync, pilot: null, screen: 'flight', notice: null });
          get().recordRun(run.sync);
          return;
        }
        set({ notice: 'Launching… running the mission simulation.' });
        void run.promise.then((result) => {
          set({ result, pilot: null, screen: 'flight', notice: null });
          get().recordRun(result);
        });
      },

      redesign: (edit) => {
        // After an online mission, iterate on the design solo (the room is finished).
        online()?.leaveKeepingDesign();
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

      setPilot: (pilot) => set({ pilot }),

      recordRun: (result) => {
        const { design } = result.run;
        const review = reviewDesign(design);
        const worstRisk = review.risks.some((r) => r.level === 'red')
          ? 'red'
          : review.risks.some((r) => r.level === 'yellow')
            ? 'yellow'
            : 'green';
        const sameScenario = get().history.filter((h) => h.scenarioId === design.scenarioId).length;
        const record: RunRecord = {
          id: `${Date.now().toString(36)}-${result.run.seed}`,
          scenarioId: design.scenarioId,
          label: `Run ${sameScenario + 1}`,
          costM: review.analysis.costM,
          science: result.run.science,
          total: result.report.total,
          outcome: result.run.outcome,
          risk: worstRisk,
          design,
        };
        set({ history: [...get().history, record].slice(-20) });
      },
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
        history: s.history,
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
