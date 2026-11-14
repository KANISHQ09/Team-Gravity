/**
 * Launch mini-game: fly the gravity turn. Keep the rocket's pitch on the
 * guidance line and throttle down through "max-Q" (the moment of highest
 * aerodynamic pressure). Time is compressed; numbers are GAME values.
 */

export interface LaunchInput {
  /** -1 pitch down (towards horizontal), +1 pitch up. */
  readonly pitch: number;
  /** -1 throttle down, +1 throttle up. */
  readonly throttle: number;
}

export interface LaunchState {
  readonly t: number;
  /** km */
  readonly alt: number;
  /** km downrange */
  readonly down: number;
  /** km/s */
  readonly v: number;
  /** degrees above the horizon */
  readonly pitch: number;
  readonly throttle: number;
  /** Aerodynamic pressure, 1 = structural limit. */
  readonly q: number;
  readonly pitchErrSum: number;
  readonly qOverTime: number;
  readonly done: boolean;
}

export const LAUNCH_DURATION = 26;
export const Q_LIMIT = 1;

export function launchTargetPitch(t: number): number {
  if (t < 2.5) return 90;
  const f = Math.min(1, (t - 2.5) / (LAUNCH_DURATION - 2.5));
  return 90 - 86 * Math.pow(f, 0.75);
}

export function launchStart(): LaunchState {
  return {
    t: 0,
    alt: 0,
    down: 0,
    v: 0,
    pitch: 90,
    throttle: 1,
    q: 0,
    pitchErrSum: 0,
    qOverTime: 0,
    done: false,
  };
}

/** Wind gusts low in the atmosphere push the nose around; the player corrects. */
function gust(t: number, alt: number): number {
  const lowAir = Math.exp(-alt / 15);
  return (Math.sin(t * 1.7) * 6 + Math.sin(t * 0.9 + 2) * 4) * lowAir;
}

export function launchStep(s: LaunchState, input: LaunchInput, dt: number): LaunchState {
  if (s.done) return s;
  const t = s.t + dt;
  const pitch = Math.max(0, Math.min(95, s.pitch + (input.pitch * 22 + gust(t, s.alt)) * dt));
  const throttle = Math.max(0.4, Math.min(1, s.throttle + input.throttle * 0.9 * dt));
  // Thrust-to-mass rises as propellant burns off.
  const accel = throttle * (0.19 + 0.012 * t);
  const rad = (pitch * Math.PI) / 180;
  const v = Math.max(0, s.v + (accel - 0.06 * Math.sin(rad)) * dt);
  const alt = Math.max(0, s.alt + v * Math.sin(rad) * dt * 5.2);
  const down = s.down + v * Math.cos(rad) * dt * 5.2;
  const q = Math.exp(-alt / 12) * v * v * 4.4;
  const err = Math.abs(pitch - launchTargetPitch(t));
  return {
    t,
    alt,
    down,
    v,
    pitch,
    throttle,
    q,
    pitchErrSum: s.pitchErrSum + err * dt,
    qOverTime: s.qOverTime + (q > Q_LIMIT ? dt : 0),
    done: t >= LAUNCH_DURATION,
  };
}

/** What a perfect flight computer would do; used for "auto-pilot" and tests. */
export function launchAutopilot(s: LaunchState): LaunchInput {
  const target = launchTargetPitch(s.t + 0.3) - gust(s.t, s.alt) * 0.05;
  const pitch = Math.max(-1, Math.min(1, (target - s.pitch) / 3));
  const throttle = s.q > Q_LIMIT * 0.9 ? -1 : 1;
  return { pitch, throttle };
}

export function launchResult(s: LaunchState): { score: number; orbit: boolean; summary: string } {
  const meanErr = s.pitchErrSum / Math.max(1, s.t);
  const pitchScore = Math.max(0, 100 - meanErr * 6);
  const qScore = Math.max(0, 100 - s.qOverTime * 35);
  const orbit = s.v >= 7 && s.alt >= 140;
  const orbitScore = orbit ? 100 : Math.min(80, (s.v / 7.8) * 80);
  const score = Math.round(0.45 * pitchScore + 0.3 * qScore + 0.25 * orbitScore);
  const summary = orbit
    ? `Reached orbit at ${Math.round(s.alt)} km. Average steering error ${meanErr.toFixed(1)}°, ${s.qOverTime.toFixed(1)} s over the pressure limit.`
    : `The upper stage made up the shortfall: you ended at ${Math.round(s.alt)} km and ${s.v.toFixed(1)} km/s.`;
  return { score, orbit, summary };
}
