import type { Catalog, Design } from '@gravity/shared';
import { type DesignAnalysis, analyzeDesign } from '../models/analysis.ts';
import { EVENT_RATE, LAUNCH_HAZARD_SCALE } from '../models/constants.ts';

export type EventType =
  | 'solar-particle-event'
  | 'reaction-wheel-failure'
  | 'launch-slip'
  | 'budget-cut'
  | 'antenna-anomaly'
  | 'battery-degradation'
  | 'launch-failure';

export const EVENT_NAMES: Record<EventType, string> = {
  'solar-particle-event': 'Solar storm (solar particle event)',
  'reaction-wheel-failure': 'Reaction wheel failure',
  'launch-slip': 'Launch slip',
  'budget-cut': 'Budget cut',
  'antenna-anomaly': 'Antenna pointing anomaly',
  'battery-degradation': 'Battery degradation',
  'launch-failure': 'Launch failure',
};

/** Probabilities used by both the risk matrix and the simulation (GAME model). */
export interface Hazards {
  /** Daily probabilities during flight. */
  readonly speDaily: number;
  readonly wheelDaily: number;
  readonly antennaDaily: number;
  readonly batteryDaily: number;
  /** One-off probabilities. */
  readonly launchSlip: number;
  readonly budgetCut: number;
  readonly launchFailure: number;
}

export function hazards(a: DesignAnalysis): Hazards {
  const { design, orbit, parts, launchVehicle, scenario } = a.resolved;
  const rate = EVENT_RATE[design.difficulty];
  const worst = (cat: string) =>
    Math.min(1, ...parts.filter((p) => p.category === cat).map((p) => p.reliability));
  const scheduleMargin = (scenario.developmentMonths - a.devMonths) / scenario.developmentMonths;
  return {
    speDaily: 0.0015 * (orbit?.radiation ?? 1) * rate,
    wheelDaily: ((1 - worst('adcs')) / 365) * rate,
    antennaDaily: ((1 - worst('antenna')) / 365) * 2 * rate,
    batteryDaily: 0.0008 * rate,
    launchSlip: Math.min(0.9, (scheduleMargin < 0.15 ? 0.3 : 0.15) * rate),
    budgetCut: Math.min(0.9, 0.25 * rate),
    launchFailure: (1 - (launchVehicle?.reliability ?? 1)) * LAUNCH_HAZARD_SCALE.value,
  };
}

export const overDays = (daily: number, days: number) => 1 - (1 - daily) ** days;

export interface Risk {
  readonly type: EventType;
  readonly name: string;
  readonly probability: number;
  /** 1 (rare) … 5 (near certain). */
  readonly likelihood: number;
  /** 1 (minor) … 5 (mission loss). */
  readonly impact: number;
  readonly score: number;
  readonly level: 'green' | 'yellow' | 'red';
  readonly mitigated: boolean;
  readonly mitigation: string;
}

const likelihoodOf = (p: number) => (p < 0.05 ? 1 : p < 0.15 ? 2 : p < 0.35 ? 3 : p < 0.65 ? 4 : 5);

/** Facts about the design that soften specific events. */
export function mitigationFacts(a: DesignAnalysis) {
  const { parts, design } = a.resolved;
  const costMargin = (a.resolved.scenario.budgetM - a.costM) / a.resolved.scenario.budgetM;
  return {
    radHard: parts.some((p) => p.category === 'computer' && p.radHard),
    redundantWheels: parts.some((p) => p.category === 'adcs' && p.redundant),
    linkResilient: design.groundStations >= 2 || a.linkMarginDb >= 6,
    energyMargin: a.batteryUsableWh >= a.eclipseEnergyNeedWh * 1.5,
    scheduleMargin: design.mitigations.includes('schedule-margin'),
    budgetReserve: design.mitigations.includes('budget-reserve') || costMargin >= 0.2,
    extraTesting: design.mitigations.includes('extra-testing'),
  };
}

/** 5×5 likelihood × impact matrix (CML checklist, Gravity.md §0.6.4). */
export function buildRiskMatrix(design: Design, catalog: Catalog): Risk[] {
  return risksFromAnalysis(analyzeDesign(design, catalog));
}

export function risksFromAnalysis(a: DesignAnalysis): Risk[] {
  const h = hazards(a);
  const m = mitigationFacts(a);
  const flightDays = (a.resolved.orbit?.transferDays ?? 0) + a.resolved.scenario.missionDays;
  // Name a fix that actually fits: a CubeSat cannot carry an 8 kg rad-hard computer.
  const cube = a.resolved.parts.some((p) => p.id === 'bus-cubesat-6u');
  const make = (
    type: EventType,
    probability: number,
    impactUnmitigated: number,
    mitigated: boolean,
    mitigation: string,
  ): Risk => {
    const likelihood = likelihoodOf(probability);
    const impact = mitigated ? 1 : impactUnmitigated;
    const score = likelihood * impact;
    return {
      type,
      name: EVENT_NAMES[type],
      probability,
      likelihood,
      impact,
      score,
      level: score >= 15 ? 'red' : score >= 8 ? 'yellow' : 'green',
      mitigated,
      mitigation,
    };
  };
  return [
    make(
      'solar-particle-event',
      overDays(h.speDaily, flightDays),
      4,
      m.radHard,
      cube ? 'Radiation-tolerant CubeSat computer' : 'Radiation-hardened computer',
    ),
    make(
      'reaction-wheel-failure',
      overDays(h.wheelDaily, flightDays),
      3,
      m.redundantWheels,
      'Spare reaction wheel',
    ),
    make(
      'antenna-anomaly',
      overDays(h.antennaDaily, flightDays),
      3,
      m.linkResilient,
      'Second ground station or ≥ 6 dB link margin',
    ),
    make(
      'battery-degradation',
      overDays(h.batteryDaily, flightDays),
      3,
      m.energyMargin,
      'Battery 50% larger than eclipses need',
    ),
    make('launch-slip', h.launchSlip, 3, m.scheduleMargin, 'Schedule margin'),
    make('budget-cut', h.budgetCut, 3, m.budgetReserve, 'Budget reserve or ≥ 20% cost margin'),
    make('launch-failure', h.launchFailure, 5, false, 'Choose a more reliable launch vehicle'),
  ].sort((x, y) => y.score - x.score);
}
