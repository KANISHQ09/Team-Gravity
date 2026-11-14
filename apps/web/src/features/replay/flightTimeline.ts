import type { SimPhase } from '@gravity/engine';
import type { Body } from '@gravity/shared';

/** Simulated days per second at 1× speed (the 2D clock). */
export const DAYS_PER_SECOND = 25;
/** Day the cinematic launch sequence starts (L-3 days on the mission clock). */
export const LAUNCH_START = -3;
/** Day the launch-failure explosion happens. */
export const LAUNCH_FAILURE_DAY = -0.6;

export interface FlightTimeline {
  readonly target: Body;
  readonly transfer: number;
  readonly endDay: number;
  readonly failurePhase: SimPhase | null;
  readonly outcome: 'full' | 'partial' | 'failure';
}

export type Shot =
  | 'prelaunch'
  | 'ascent'
  | 'separation'
  | 'parking'
  | 'transfer'
  | 'insertion'
  | 'science'
  | 'ended';

const BODY_NAME: Record<Body, string> = { earth: 'Earth', moon: 'the Moon', mars: 'Mars' };

/**
 * How fast the mission clock runs (days per real second). With the 3D view on,
 * launch, cruise, insertion and science get a minimum screen time so the
 * camera has time to show them; otherwise it is the plain 2D rate.
 */
export function flightRate(
  day: number,
  tl: FlightTimeline,
  speed: number,
  cinematic: boolean,
): number {
  const base = DAYS_PER_SECOND * speed;
  if (!cinematic) return base;
  const k = Math.sqrt(speed / 5);
  const t = tl.transfer;
  let cine: number;
  if (day < LAUNCH_START) cine = base;
  else if (day < 1) cine = 0.42 * k;
  else if (t > 0 && day < t - 1) cine = Math.max(0.3, (t - 2) / 8) * k;
  else if (t > 0 && day < t + 2) cine = 0.5 * k;
  else cine = Math.max(1, (tl.endDay - Math.max(1, t + 2)) / 16) * k;
  return Math.min(base, cine);
}

/** Which camera shot and caption belong to a moment of the flight. */
export function shotAt(day: number, tl: FlightTimeline): { shot: Shot; caption: string } {
  const done = day >= tl.endDay;
  const where = BODY_NAME[tl.target];
  if (tl.failurePhase === 'launch' && day >= LAUNCH_FAILURE_DAY) {
    return { shot: 'ended', caption: 'Launch failure: the rocket was lost' };
  }
  if (day < LAUNCH_START) return { shot: 'prelaunch', caption: 'Final checks on the launch pad' };
  if (day < -2.6) return { shot: 'ascent', caption: 'Ignition and liftoff!' };
  if (day < -1.2) return { shot: 'ascent', caption: 'Climbing through the atmosphere' };
  if (day < -0.4) return { shot: 'ascent', caption: 'Upper stage burning to orbit' };
  if (day < 0) return { shot: 'separation', caption: 'Fairing separation' };
  if (day < 0.6) {
    return { shot: 'separation', caption: 'Spacecraft separation: solar arrays deploying' };
  }
  const t = tl.transfer;
  if (t > 0) {
    if (tl.failurePhase === 'insertion' && day >= t) {
      return { shot: 'ended', caption: `Insertion failed: the spacecraft flew past ${where}` };
    }
    if (day < 1) return { shot: 'parking', caption: 'Parking orbit: preparing the transfer burn' };
    if (day < t - 1) return { shot: 'transfer', caption: `Cruising to ${where}` };
    if (day < t + 0.8) return { shot: 'insertion', caption: 'Orbit insertion burn' };
  }
  if (done) {
    return tl.outcome === 'failure'
      ? { shot: 'ended', caption: 'Signal lost: the mission ended early' }
      : { shot: 'ended', caption: 'Mission complete' };
  }
  return { shot: 'science', caption: `Science operations around ${where}` };
}
