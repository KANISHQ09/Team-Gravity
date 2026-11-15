import type { Catalog, Design, Measurement, Segment } from '@gravity/shared';
import { type DesignAnalysis, analyzeDesign, instrumentsFor } from '../models/analysis.ts';
import { MARGIN_TARGET, REQUIRED_LINK_MARGIN_DB } from '../models/constants.ts';

/** How a requirement is checked (Design and Develop Science Missions, SRC-03). */
export type VerificationMethod = 'test' | 'analysis' | 'inspection' | 'demonstration';
export type RequirementStatus = 'pass' | 'fail' | 'unknown';

export interface Requirement {
  readonly id: string;
  readonly text: string;
  readonly segment: Segment;
  readonly verification: VerificationMethod;
  /** Measurable target, shown next to the current value. */
  readonly target: string;
  readonly actual: string;
  readonly status: RequirementStatus;
  readonly goalId?: string;
}

export interface TraceRow {
  readonly goalId: string;
  readonly goal: string;
  readonly measurement: Measurement;
  readonly instruments: readonly string[];
  readonly requirementIds: readonly string[];
}

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const status = (known: boolean, ok: boolean): RequirementStatus =>
  !known ? 'unknown' : ok ? 'pass' : 'fail';

/** Measurable requirements derived from the goals and the scenario (SRS-REQ-01, SRS-TRC-01). */
export function deriveRequirements(design: Design, catalog: Catalog): Requirement[] {
  return requirementsFromAnalysis(analyzeDesign(design, catalog));
}

export function requirementsFromAnalysis(a: DesignAnalysis): Requirement[] {
  const { scenario, goals, parts, orbit, launchVehicle, design } = a.resolved;
  const margin = MARGIN_TARGET[design.difficulty];
  const reqs: Requirement[] = [];

  goals.forEach((goal, i) => {
    const inst = instrumentsFor(parts, goal.measurement);
    reqs.push({
      id: `REQ-SCI-${i + 1}`,
      text: `Carry an instrument that measures ${goal.measurement.replace('-', ' ')} to "${goal.title.toLowerCase()}".`,
      segment: 'space',
      verification: 'inspection',
      target: '≥ 1 instrument',
      actual: inst.length ? inst.map((p) => p.name).join(', ') : 'none',
      status: inst.length ? 'pass' : 'fail',
      goalId: goal.id,
    });
  });

  reqs.push({
    id: 'REQ-DATA-1',
    text: 'Return all science data to Earth every day.',
    segment: 'ground',
    verification: 'analysis',
    target: `≥ ${fmt(a.dataGeneratedGbitPerDay, 1)} Gbit/day`,
    actual: `${fmt(a.downlinkGbitPerDay, 1)} Gbit/day`,
    status: status(orbit !== null, a.downlinkGbitPerDay >= a.dataGeneratedGbitPerDay),
  });
  reqs.push({
    id: 'REQ-COMM-1',
    text: `Keep a link margin of at least ${REQUIRED_LINK_MARGIN_DB.value} dB.`,
    segment: 'ground',
    verification: 'test',
    target: `≥ ${REQUIRED_LINK_MARGIN_DB.value} dB`,
    actual: `${fmt(a.linkMarginDb, 1)} dB`,
    status: status(orbit !== null, a.linkMarginDb >= REQUIRED_LINK_MARGIN_DB.value),
  });
  reqs.push({
    id: 'REQ-USER-1',
    text: 'Deliver science products to the science team for the full mission.',
    segment: 'user',
    verification: 'demonstration',
    target: `${scenario.missionDays} days of operations`,
    actual: orbit ? `${scenario.missionDays} days planned` : 'no orbit chosen',
    status: status(orbit !== null, true),
  });

  const massKnown = a.launchCapacityKg !== null && a.launchCapacityKg > 0;
  reqs.push({
    id: 'REQ-MASS-1',
    text: `Keep launch mass at least ${pct(margin)} below the launch vehicle's capacity.`,
    segment: 'launch',
    verification: 'analysis',
    target: massKnown
      ? `≤ ${fmt(a.launchCapacityKg! * (1 - margin))} kg`
      : 'choose a launch vehicle',
    actual: `${fmt(a.wetMassKg, 1)} kg`,
    status: status(massKnown, massKnown && a.wetMassKg <= a.launchCapacityKg! * (1 - margin)),
  });
  reqs.push({
    id: 'REQ-DV-1',
    text: 'Carry enough Δv to reach and keep the operational orbit.',
    segment: 'space',
    verification: 'analysis',
    target: `≥ ${fmt(a.deltaVRequiredMs)} m/s`,
    actual: `${fmt(a.deltaVAvailableMs)} m/s`,
    status: status(orbit !== null, a.deltaVAvailableMs >= a.deltaVRequiredMs),
  });
  reqs.push({
    id: 'REQ-PWR-1',
    // Same definition as the power gauge: at least `margin` of the generated power left spare.
    text: `Keep at least ${pct(margin)} of the generated power spare.`,
    segment: 'space',
    verification: 'analysis',
    target: `≥ ${fmt(a.powerConsumptionW / (1 - margin))} W`,
    actual: `${fmt(a.powerGenerationW)} W`,
    status: status(orbit !== null, a.powerGenerationW * (1 - margin) >= a.powerConsumptionW),
  });
  reqs.push({
    id: 'REQ-PWR-2',
    text: 'Survive the longest eclipse on battery power.',
    segment: 'space',
    verification: 'test',
    target: `≥ ${fmt(a.eclipseEnergyNeedWh)} Wh usable`,
    actual: `${fmt(a.batteryUsableWh)} Wh`,
    status: status(orbit !== null, a.batteryUsableWh >= a.eclipseEnergyNeedWh),
  });
  reqs.push({
    id: 'REQ-COST-1',
    text: `Stay within the ${fmt(scenario.budgetM)} M$ budget.`,
    segment: 'ground',
    verification: 'analysis',
    target: `≤ ${fmt(scenario.budgetM)} M$`,
    actual: `${fmt(a.costM, 1)} M$`,
    status: status(launchVehicle !== null, a.costM <= scenario.budgetM),
  });
  reqs.push({
    id: 'REQ-SCHED-1',
    text: 'Finish building and testing before the launch period opens.',
    segment: 'launch',
    verification: 'inspection',
    target: `≤ ${fmt(scenario.developmentMonths)} months`,
    actual: `${fmt(a.devMonths, 1)} months`,
    status: status(parts.length > 0, a.devMonths <= scenario.developmentMonths),
  });
  return reqs;
}

/** Science Traceability Matrix: goal → measurement → instrument → requirement (SRS-TRC-01). */
export function traceability(design: Design, catalog: Catalog): TraceRow[] {
  const a = analyzeDesign(design, catalog);
  const reqs = requirementsFromAnalysis(a);
  return a.resolved.goals.map((g) => ({
    goalId: g.id,
    goal: g.title,
    measurement: g.measurement,
    instruments: instrumentsFor(a.resolved.parts, g.measurement).map((p) => p.name),
    requirementIds: [
      ...reqs.filter((r) => r.goalId === g.id).map((r) => r.id),
      'REQ-DATA-1',
      'REQ-COMM-1',
    ],
  }));
}
