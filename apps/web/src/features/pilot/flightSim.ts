import {
  type AnomalyInfo,
  type AnomalyState,
  anomalyAutopilot,
  anomalyResult,
  anomalyStep,
} from './anomalyGame.ts';
import {
  type InsertionState,
  insertionAutopilot,
  insertionResult,
  insertionStep,
} from './insertionGame.ts';
import { type LaunchState, launchAutopilot, launchResult, launchStep } from './launchGame.ts';
import type { PilotGameId } from './pilotScore.ts';
import { type ScienceState, scienceAutopilot, scienceResult, scienceStep } from './scienceGame.ts';

/** Keys (or on-screen buttons) currently held. */
export interface Keys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  downlink: boolean;
}

export type ActiveGame = {
  id: PilotGameId;
  label: string;
  started: boolean;
  auto: boolean;
  finished: boolean;
} & (
  | { type: 'launch'; s: LaunchState }
  | { type: 'insertion'; s: InsertionState }
  | { type: 'science'; s: ScienceState }
  | { type: 'anomaly'; s: AnomalyState; info: AnomalyInfo }
);

/**
 * Mutable, per-frame flight state shared by the 3D scene (which steps it at
 * 60 fps) and the HUD (which samples it a few times a second). Kept outside
 * React state so the games never wait for a re-render.
 */
export interface FlightSim {
  keys: Keys;
  game: ActiveGame | null;
  /** Rocket trail for the launch view. */
  trail: [number, number, number][];
  /** Where the launch ended, so the spacecraft separates there. */
  launchEnd: { alt: number; down: number } | null;
}

export function newFlightSim(): FlightSim {
  return {
    keys: { left: false, right: false, up: false, down: false, action: false, downlink: false },
    game: null,
    trail: [],
    launchEnd: null,
  };
}

const axis = (neg: boolean, pos: boolean) => (pos ? 1 : 0) - (neg ? 1 : 0);

/** Advance the active game by dt using the player's keys or the autopilot. */
export function stepGame(g: ActiveGame, k: Keys, dt: number): void {
  if (!g.started || g.finished) return;
  switch (g.type) {
    case 'launch': {
      const input = g.auto
        ? launchAutopilot(g.s)
        : { pitch: axis(k.right, k.left), throttle: axis(k.down, k.up) };
      g.s = launchStep(g.s, input, dt);
      break;
    }
    case 'insertion':
      g.s = insertionStep(g.s, g.auto ? insertionAutopilot(g.s) : k.action, dt);
      break;
    case 'science': {
      const input = g.auto
        ? scienceAutopilot(g.s)
        : { steer: axis(k.left, k.right), capture: k.action, downlink: k.downlink };
      g.s = scienceStep(g.s, input, dt);
      break;
    }
    case 'anomaly': {
      const input = g.auto
        ? anomalyAutopilot(g.s)
        : { x: axis(k.left, k.right), y: axis(k.down, k.up), act: k.action };
      g.s = anomalyStep(g.s, input, dt);
      break;
    }
  }
}

export function gameDone(g: ActiveGame): boolean {
  return g.s.done;
}

export function gameResult(g: ActiveGame): { score: number; summary: string } {
  switch (g.type) {
    case 'launch':
      return launchResult(g.s);
    case 'insertion':
      return insertionResult(g.s);
    case 'science':
      return scienceResult(g.s);
    case 'anomaly':
      return anomalyResult(g.s);
  }
}
