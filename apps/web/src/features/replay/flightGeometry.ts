/** Small, non-3D helpers shared by the flight screen and the lazy 3D scene. */

/** Capture-game orbit radius in body radii (the game is tuned around it). */
export const CAPTURE_TARGET = 1.45;

/** Exaggerated altitude (in planet radii) so low orbits are still visible. */
export const visAlt = (km: number) => 0.05 + 0.12 * Math.log2(1 + km / 400);

/** Circularisation target for Earth missions, in Earth radii. */
export const earthOrbitRatio = (altKm: number) => 1 + visAlt(altKm);
