import type { Body, Difficulty, ProvenanceLabel } from '@gravity/shared';

/** A constant together with where it comes from (docs/DATA_LEDGER.md). */
export interface Constant {
  readonly value: number;
  readonly unit: string;
  readonly provenance: ProvenanceLabel;
  readonly note: string;
}

const c = (value: number, unit: string, provenance: ProvenanceLabel, note: string): Constant => ({
  value,
  unit,
  provenance,
  note,
});

export const G0 = c(9.80665, 'm/s²', 'DERIVED', 'Standard gravity (definition)');
export const SOLAR_CONSTANT = c(1361, 'W/m²', 'NASA', 'Solar flux at 1 AU');
export const ARRAY_DERATING = c(0.85, '-', 'GAME', 'Packing, temperature and ageing losses');
export const BATTERY_DEPTH_OF_DISCHARGE = c(0.6, '-', 'GAME', 'Usable share of battery energy');
export const MAX_DOWNLINK_MBPS = c(300, 'Mbit/s', 'GAME', 'Upper cap on any link');
export const REQUIRED_LINK_MARGIN_DB = c(3, 'dB', 'NASA', 'Deep-space link margin (CML checklist)');
export const POINTING_NEEDED_ARCSEC = c(60, 'arcsec', 'GAME', 'Pointing needed for sharp images');
export const LAUNCH_HAZARD_SCALE = c(0.3, '-', 'GAME', 'Softens launch-failure odds for play');

export const BODY: Record<Body, { muKm3s2: number; radiusKm: number; magneticField: boolean }> = {
  earth: { muKm3s2: 398600.4, radiusKm: 6371, magneticField: true }, // DERIVED
  moon: { muKm3s2: 4902.8, radiusKm: 1737.4, magneticField: false }, // DERIVED
  mars: { muKm3s2: 42828.4, radiusKm: 3389.5, magneticField: false }, // DERIVED
};

/** Ground-network cost per station per day of operations (M$, GAME). */
export const OPS_COST_PER_STATION_DAY: Record<Body, number> = {
  earth: 0.001,
  moon: 0.02,
  mars: 0.03,
};

/**
 * Margin targets by difficulty (Gravity.md §0.6.4). Explorer only warns
 * below 10%; Flight Director follows the JPL CML 4 checklist (35%).
 */
export const MARGIN_TARGET: Record<Difficulty, number> = {
  explorer: 0.1,
  engineer: 0.2,
  'flight-director': 0.35,
};

/** Random-event frequency multiplier by difficulty (GAME). */
export const EVENT_RATE: Record<Difficulty, number> = {
  explorer: 0.5,
  engineer: 1,
  'flight-director': 1.5,
};

/** Score multiplier by difficulty (SRS-SCR-02). */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  explorer: 1,
  engineer: 1.15,
  'flight-director': 1.3,
};

/** Measurements that map a surface and therefore depend on orbit quality and pointing. */
export const SURFACE_MAPPING = new Set([
  'visible-imaging',
  'multispectral-imaging',
  'altimetry',
  'radar-sounding',
]);

/** Measurements that need precise pointing. */
export const NEEDS_POINTING = new Set(['visible-imaging', 'multispectral-imaging', 'spectroscopy']);
