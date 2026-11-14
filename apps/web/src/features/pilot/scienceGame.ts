/**
 * Science-operations mini-game. The ground track scrolls under the spacecraft;
 * steer the instrument across the track to line up with each science target and
 * capture it, then send the data home while a ground station is in view, before
 * the onboard recorder fills up.
 */

export interface ScienceTarget {
  /** Position along the ground track (track units). */
  readonly along: number;
  /** Position across the track, -1…1. */
  readonly cross: number;
  readonly status: 'waiting' | 'captured' | 'missed' | 'lost';
}

export interface ScienceState {
  readonly t: number;
  /** How far along the track we are (track units). */
  readonly track: number;
  /** Instrument pointing across the track, -1…1. */
  readonly pointer: number;
  readonly targets: readonly ScienceTarget[];
  /** Data waiting onboard (units). */
  readonly stored: number;
  readonly returned: number;
  readonly stations: readonly { readonly from: number; readonly to: number }[];
  readonly downlinking: boolean;
  readonly done: boolean;
}

export interface ScienceInput {
  /** -1 / +1 steer the instrument across the track. */
  readonly steer: number;
  readonly capture: boolean;
  readonly downlink: boolean;
}

export const SCIENCE_DURATION = 40;
export const TRACK_SPEED = 0.13;
export const RECORDER_CAPACITY = 4;
const WINDOW = 0.05;
const AIM = 0.16;

/** Seeded so a given mission always shows the same targets. */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scienceStart(seed: number, targetCount = 10): ScienceState {
  const r = rng(seed);
  const targets: ScienceTarget[] = [];
  for (let i = 0; i < targetCount; i++) {
    targets.push({
      along: 0.45 + i * 0.44 + r() * 0.12,
      cross: (r() * 2 - 1) * 0.8,
      status: 'waiting',
    });
  }
  const stations = [1.3, 3.0, 4.6].map((c) => ({ from: c, to: c + 0.45 }));
  return {
    t: 0,
    track: 0,
    pointer: 0,
    targets,
    stored: 0,
    returned: 0,
    stations,
    downlinking: false,
    done: false,
  };
}

export function inStationWindow(s: ScienceState): boolean {
  return s.stations.some((w) => s.track >= w.from && s.track <= w.to);
}

export function scienceStep(s: ScienceState, input: ScienceInput, dt: number): ScienceState {
  if (s.done) return s;
  const t = s.t + dt;
  const track = s.track + TRACK_SPEED * dt;
  const pointer = Math.max(-1, Math.min(1, s.pointer + input.steer * 1.5 * dt));
  let stored = s.stored;
  const targets = s.targets.map((tg) => {
    if (tg.status !== 'waiting') return tg;
    const d = tg.along - track;
    if (d < -WINDOW) return { ...tg, status: 'missed' as const };
    if (input.capture && Math.abs(d) <= WINDOW && Math.abs(pointer - tg.cross) <= AIM) {
      if (stored + 1 > RECORDER_CAPACITY) return { ...tg, status: 'lost' as const };
      stored += 1;
      return { ...tg, status: 'captured' as const };
    }
    return tg;
  });
  const window = s.stations.some((w) => track >= w.from && track <= w.to);
  const downlinking = input.downlink && window && stored > 0;
  let returned = s.returned;
  if (downlinking) {
    const sent = Math.min(stored, 2.2 * dt);
    stored -= sent;
    returned += sent;
  }
  return {
    ...s,
    t,
    track,
    pointer,
    targets,
    stored,
    returned,
    downlinking,
    done: t >= SCIENCE_DURATION,
  };
}

export function scienceAutopilot(s: ScienceState): ScienceInput {
  const next = s.targets.find((tg) => tg.status === 'waiting');
  const aimAt = next ? next.cross : 0;
  const steer = Math.max(-1, Math.min(1, (aimAt - s.pointer) * 4));
  const capture = !!next && Math.abs(next.along - s.track) <= 0.04;
  return { steer, capture, downlink: true };
}

export function scienceResult(s: ScienceState): { score: number; summary: string } {
  const total = s.targets.length;
  const captured = s.targets.filter((tg) => tg.status === 'captured').length;
  const lost = s.targets.filter((tg) => tg.status === 'lost').length;
  // Data still onboard at the end counts for half: it may come down later.
  const value = s.returned + s.stored * 0.5;
  const score = Math.round(Math.max(0, Math.min(100, (value / total) * 100 - lost * 3)));
  const summary =
    `Captured ${captured} of ${total} targets and sent ${s.returned.toFixed(1)} data packets home` +
    (lost ? `; ${lost} lost because the recorder was full.` : '.');
  return { score, summary };
}
