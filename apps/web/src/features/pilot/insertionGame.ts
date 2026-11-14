/**
 * Orbit-insertion mini-game with real (2D, two-body) orbital mechanics.
 * Units: body radius = 1, gravitational parameter = 1.
 *
 * - "capture": arrive on a hyperbola and burn retrograde near the closest
 *   point to be captured into a circular orbit (Moon, Mars).
 * - "circularize": coast up to the top of a low elliptical orbit and burn
 *   prograde to make it circular (Earth missions).
 */

export type InsertionKind = 'capture' | 'circularize';

export interface InsertionState {
  readonly kind: InsertionKind;
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** Target circular orbit radius. */
  readonly target: number;
  /** Remaining propellant as Δv. */
  readonly fuel: number;
  readonly fuel0: number;
  /** Engine acceleration, sized so an ideal burn lasts about 1.4 seconds. */
  readonly thrust: number;
  readonly burning: boolean;
  readonly passedClosest: boolean;
  readonly minR: number;
  readonly done: boolean;
}

const MAX_T = 30;
const SUBSTEPS = 8;

export function insertionStart(kind: InsertionKind, target: number): InsertionState {
  if (kind === 'capture') {
    const vInf = 0.5;
    const x0 = -9;
    // Aim (solve for the offset b) so the closest approach is a little above the
    // target: a real burn takes time and pulls the low point down.
    const aim = target * 1.04;
    let b = aim * Math.sqrt(1 + 2 / (aim * vInf * vInf));
    let v0 = vInf;
    for (let i = 0; i < 20; i++) {
      const r0 = Math.hypot(x0, b);
      v0 = Math.sqrt(vInf * vInf + 2 / r0);
      const energy = (v0 * v0) / 2 - 1 / r0;
      b = (aim * Math.sqrt(2 * (energy + 1 / aim))) / v0;
    }
    const r0 = Math.hypot(x0, b);
    const needed = Math.sqrt(vInf * vInf + 2 / target) - Math.sqrt(1 / target);
    return {
      kind,
      t: 0,
      x: x0,
      y: b,
      vx: v0,
      vy: 0,
      target,
      fuel: needed * 1.5,
      fuel0: needed * 1.5,
      thrust: needed / 1.4,
      burning: false,
      passedClosest: false,
      minR: r0,
      done: false,
    };
  }
  // Ellipse with perigee just above the surface and apogee at the target radius.
  const rp = 1.02;
  const a = (rp + target) / 2;
  const vApo = Math.sqrt(2 / target - 1 / a);
  const needed = Math.sqrt(1 / target) - vApo;
  // Start a little before apogee: rotate the apogee point back along the orbit.
  const ang = 1.0;
  const r0 = target * 0.985;
  const vStart = Math.sqrt(2 / r0 - 1 / a);
  const h = target * vApo;
  const vt = h / r0;
  const vr = Math.sqrt(Math.max(0, vStart * vStart - vt * vt));
  const ux = Math.cos(Math.PI - ang);
  const uy = Math.sin(Math.PI - ang);
  return {
    kind,
    t: 0,
    x: ux * r0,
    y: uy * r0,
    // Tangential (counter-clockwise) plus outward radial velocity, still climbing.
    vx: -uy * vt + ux * vr,
    vy: ux * vt + uy * vr,
    target,
    fuel: needed * 1.6,
    fuel0: needed * 1.6,
    thrust: needed / 1.4,
    burning: false,
    passedClosest: false,
    minR: r0,
    done: false,
  };
}

export function insertionStep(s: InsertionState, burn: boolean, dt: number): InsertionState {
  if (s.done) return s;
  let { x, y, vx, vy, fuel } = s;
  const h = dt / SUBSTEPS;
  let burning = false;
  for (let i = 0; i < SUBSTEPS; i++) {
    const r = Math.hypot(x, y);
    const g = -1 / (r * r * r);
    let ax = g * x;
    let ay = g * y;
    if (burn && fuel > 0) {
      const v = Math.hypot(vx, vy) || 1;
      const dir = s.kind === 'capture' ? -1 : 1;
      ax += (dir * s.thrust * vx) / v;
      ay += (dir * s.thrust * vy) / v;
      fuel = Math.max(0, fuel - s.thrust * h);
      burning = true;
    }
    vx += ax * h;
    vy += ay * h;
    x += vx * h;
    y += vy * h;
  }
  const r = Math.hypot(x, y);
  const t = s.t + dt;
  const radialSpeed = (x * vx + y * vy) / r;
  const passedClosest =
    s.passedClosest || (s.kind === 'capture' ? radialSpeed > 0 && r < 4 : radialSpeed < 0);
  const crashed = r < 1;
  const energy = (vx * vx + vy * vy) / 2 - 1 / r;
  const escaped = s.kind === 'capture' && passedClosest && energy >= 0 && r > 4;
  // Finished once we are clearly past the burn point and coasting.
  const settled =
    passedClosest &&
    !burn &&
    (s.kind === 'capture' ? (radialSpeed > 0 && r > s.target * 1.6) || t > 18 : t > 12);
  return {
    ...s,
    t,
    x,
    y,
    vx,
    vy,
    fuel,
    burning,
    passedClosest,
    minR: Math.min(s.minR, r),
    done: crashed || escaped || t >= MAX_T || settled,
  };
}

/** Periapsis and apoapsis of the current orbit, or null if it is not closed. */
export function orbitOf(
  x: number,
  y: number,
  vx: number,
  vy: number,
): { rp: number; ra: number } | null {
  const r = Math.hypot(x, y);
  const v2 = vx * vx + vy * vy;
  const energy = v2 / 2 - 1 / r;
  if (energy >= 0) return null;
  const a = -1 / (2 * energy);
  const hh = x * vy - y * vx;
  const e = Math.sqrt(Math.max(0, 1 - (hh * hh) / a));
  return { rp: a * (1 - e), ra: a * (1 + e) };
}

/** Future path for the trajectory preview line. */
export function predictPath(s: InsertionState, steps = 240, dt = 0.08): [number, number][] {
  let { x, y, vx, vy } = s;
  const out: [number, number][] = [[x, y]];
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < 4; k++) {
      const r = Math.hypot(x, y);
      if (r < 1) return out;
      const g = -1 / (r * r * r);
      vx += g * x * (dt / 4);
      vy += g * y * (dt / 4);
      x += vx * (dt / 4);
      y += vy * (dt / 4);
    }
    out.push([x, y]);
    if (Math.hypot(x, y) > 14) break;
  }
  return out;
}

export function insertionAutopilot(s: InsertionState): boolean {
  const r = Math.hypot(s.x, s.y);
  const o = orbitOf(s.x, s.y, s.vx, s.vy);
  const radial = (s.x * s.vx + s.y * s.vy) / r;
  // Burn only near the closest (capture) or highest (circularize) point.
  if (Math.abs(radial) > (s.kind === 'capture' ? 0.35 : 0.12)) return false;
  if (s.kind === 'capture')
    return r < s.target * 1.4 && (!o || (o.ra > o.rp * 1.04 && r - o.rp < 0.03 * r));
  return !o || o.rp < s.target * 0.98;
}

export function insertionResult(s: InsertionState): { score: number; summary: string } {
  const orbit = orbitOf(s.x, s.y, s.vx, s.vy);
  if (s.minR < 1)
    return { score: 5, summary: 'The spacecraft hit the surface: the orbit dipped too low.' };
  if (!orbit) {
    return {
      score: 10,
      summary: 'Not enough braking: the spacecraft flew past on an escape path.',
    };
  }
  // Capture: getting caught at all matters most, then how round the orbit is.
  const err =
    s.kind === 'capture'
      ? ((orbit.ra - orbit.rp) / orbit.ra) * 0.5 +
        Math.abs((orbit.ra + orbit.rp) / 2 / s.target - 1) * 0.5
      : (Math.abs(orbit.rp - s.target) + Math.abs(orbit.ra - s.target)) / s.target;
  const fuelLeft = s.fuel / s.fuel0;
  const score = Math.round(
    Math.max(0, Math.min(100, 100 - err * (s.kind === 'capture' ? 250 : 400) + fuelLeft * 6)),
  );
  const shape =
    err < 0.08
      ? 'an almost perfect circular orbit'
      : err < 0.35
        ? 'a slightly stretched orbit'
        : 'a very stretched orbit';
  return {
    score,
    summary: `You reached ${shape} with ${Math.round(fuelLeft * 100)}% of the burn propellant left.`,
  };
}
