/**
 * Anomaly-response mini-games, triggered by real events from the mission run.
 * - "stabilize": an attitude error drifts; steer it back into the target zone
 *   and hold it there (failed reaction wheel, antenna lost lock).
 * - "reflex": a threat approaches; act in the right window, not too early
 *   (science lost) and not too late (damage) (solar storm, battery, glitch).
 */

export type AnomalyKind = 'stabilize' | 'reflex';

export interface AnomalyInfo {
  readonly kind: AnomalyKind;
  readonly title: string;
  readonly instruction: string;
  readonly action: string;
}

const INFO: Record<string, AnomalyInfo> = {
  'solar-particle-event': {
    kind: 'reflex',
    title: 'Solar storm incoming',
    instruction:
      'Charged particles are racing out from the Sun. Enter safe mode just before they hit.',
    action: 'Enter safe mode',
  },
  'battery-degradation': {
    kind: 'reflex',
    title: 'Battery overheating',
    instruction: 'The battery is heating up. Switch off non-essential loads before it trips.',
    action: 'Shed power loads',
  },
  'instrument-failure': {
    kind: 'reflex',
    title: 'Instrument glitch',
    instruction: 'An instrument has frozen. Power-cycle it when the reset window opens.',
    action: 'Power-cycle',
  },
  'reaction-wheel-failure': {
    kind: 'stabilize',
    title: 'Reaction wheel failed',
    instruction:
      'The spacecraft is starting to tumble. Use the thrusters to bring the pointing error back inside the circle and hold it there.',
    action: 'Fire thrusters',
  },
  'antenna-anomaly': {
    kind: 'stabilize',
    title: 'Antenna lost lock',
    instruction:
      'The dish has drifted off Earth. Steer it back on target and hold it until the link locks.',
    action: 'Steer the dish',
  },
};

export function anomalyInfo(eventType: string): AnomalyInfo | null {
  return INFO[eventType] ?? null;
}

export interface AnomalyState {
  readonly kind: AnomalyKind;
  readonly t: number;
  /** stabilize: pointing error (x, y), 1 = edge of the view. */
  readonly ex: number;
  readonly ey: number;
  /** stabilize: seconds held inside the zone. */
  readonly held: number;
  /** reflex: threat progress 0…1 (1 = impact). */
  readonly wave: number;
  /** reflex: wave value when the player acted, or null. */
  readonly actedAt: number | null;
  readonly done: boolean;
}

export const HOLD_NEEDED = 3;
export const ZONE = 0.25;
const STAB_LIMIT = 14;
const WAVE_TIME = 5;

export function anomalyStart(kind: AnomalyKind): AnomalyState {
  return { kind, t: 0, ex: 0.55, ey: -0.35, held: 0, wave: 0, actedAt: null, done: false };
}

export function anomalyStep(
  s: AnomalyState,
  input: { x: number; y: number; act: boolean },
  dt: number,
): AnomalyState {
  if (s.done) return s;
  const t = s.t + dt;
  if (s.kind === 'stabilize') {
    // A slow spin pushes the error outward and sideways; the player counters it.
    const drift = 0.35;
    let ex = s.ex + (s.ex * drift - s.ey * 0.6 * drift + input.x * 1.3) * dt;
    let ey = s.ey + (s.ey * drift + s.ex * 0.6 * drift + input.y * 1.3) * dt;
    ex = Math.max(-1.2, Math.min(1.2, ex));
    ey = Math.max(-1.2, Math.min(1.2, ey));
    const inside = Math.hypot(ex, ey) <= ZONE;
    const held = inside ? s.held + dt : s.held;
    return { ...s, t, ex, ey, held, done: held >= HOLD_NEEDED || t >= STAB_LIMIT };
  }
  const wave = Math.min(1, t / WAVE_TIME);
  const actedAt = s.actedAt ?? (input.act ? wave : null);
  return { ...s, t, wave, actedAt, done: actedAt !== null || wave >= 1 };
}

export function anomalyAutopilot(s: AnomalyState): { x: number; y: number; act: boolean } {
  if (s.kind === 'stabilize') {
    return {
      x: Math.max(-1, Math.min(1, -s.ex * 3)),
      y: Math.max(-1, Math.min(1, -s.ey * 3)),
      act: false,
    };
  }
  return { x: 0, y: 0, act: s.wave >= 0.8 };
}

export function anomalyResult(s: AnomalyState): { score: number; summary: string } {
  if (s.kind === 'stabilize') {
    if (s.held < HOLD_NEEDED) {
      return {
        score: Math.round((s.held / HOLD_NEEDED) * 40),
        summary: 'The craft stayed unstable; mission control had to step in.',
      };
    }
    const score = Math.round(Math.max(40, Math.min(100, 100 - (s.t - 4) * 6)));
    return { score, summary: `Stabilised in ${s.t.toFixed(1)} s.` };
  }
  if (s.actedAt === null)
    return { score: 10, summary: 'Too late: the spacecraft took the full hit.' };
  if (s.actedAt < 0.6) {
    return { score: 50, summary: 'Safe, but early: science time was lost while waiting.' };
  }
  const score = Math.round(Math.max(60, 100 - Math.abs(s.actedAt - 0.82) * 200));
  return { score, summary: 'Perfect timing: protected just before impact.' };
}
