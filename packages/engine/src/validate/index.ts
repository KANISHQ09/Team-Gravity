import type { Catalog, Design, PartCategory } from '@gravity/shared';
import { type DesignAnalysis, analyzeDesign, instrumentsFor } from '../models/analysis.ts';
import { BODY } from '../models/constants.ts';

export type IssueSeverity = 'error' | 'warning' | 'info';

/** Where in the six-stage flow the player fixes the issue. */
export type IssueArea = 'goals' | 'orbit' | 'launch' | 'parts' | 'operations';

export interface Issue {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly area: IssueArea;
  readonly message: string;
  readonly why: string;
  readonly fix: string;
}

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** All problems with a design. Errors block launch (SRS-LOR-03, SRS-ERR). Never throws. */
export function validate(design: Design, catalog: Catalog): Issue[] {
  return validateAnalysis(analyzeDesign(design, catalog));
}

export function validateAnalysis(a: DesignAnalysis): Issue[] {
  const issues: Issue[] = [];
  const { scenario, parts, orbit, launchVehicle, design, goals, unknownPartIds } = a.resolved;
  const add = (i: Issue) => issues.push(i);
  const count = (c: PartCategory) => parts.filter((p) => p.category === c).length;

  for (const id of unknownPartIds) {
    add({
      code: 'unknown-part',
      severity: 'error',
      area: 'parts',
      message: `Unknown part "${id}"`,
      why: 'This design refers to a part that is not in the catalog (it may come from an older version).',
      fix: 'Remove the part and choose a replacement from the parts list.',
    });
  }

  // --- Goals (stage 1) ---
  if (goals.length === 0) {
    add({
      code: 'no-goals',
      severity: 'error',
      area: 'goals',
      message: 'No science goals selected',
      why: 'Real missions start from the science: the goals decide which instruments, orbit and data rates you need.',
      fix: 'Pick at least one science goal in the Mission Brief.',
    });
  }
  for (const goal of goals) {
    if (instrumentsFor(parts, goal.measurement).length === 0) {
      add({
        code: 'goal-uncovered',
        severity: 'error',
        area: 'parts',
        message: `No instrument can "${goal.title.toLowerCase()}"`,
        why: `This goal needs ${goal.measurement.replace('-', ' ')}, and none of your instruments measures it.`,
        fix: `Add an instrument that measures ${goal.measurement.replace('-', ' ')}, or drop the goal.`,
      });
    }
  }

  // --- Orbit and launch (stage 2/4) ---
  if (!orbit) {
    add({
      code: 'no-orbit',
      severity: 'error',
      area: 'orbit',
      message: 'No orbit chosen',
      why: 'The orbit decides lighting, eclipses, contact time, radiation and how much fuel you need.',
      fix: 'Choose one of the orbits allowed for this scenario.',
    });
  } else if (!scenario.allowedOrbitIds.includes(orbit.id)) {
    add({
      code: 'orbit-not-allowed',
      severity: 'error',
      area: 'orbit',
      message: `${orbit.name} is not an option for this mission`,
      why: `This scenario targets ${scenario.body === 'earth' ? 'Earth' : scenario.body === 'moon' ? 'the Moon' : 'Mars'}.`,
      fix: 'Choose one of the orbits listed for this scenario.',
    });
  }
  if (!launchVehicle) {
    add({
      code: 'no-launch-vehicle',
      severity: 'error',
      area: 'launch',
      message: 'No launch vehicle chosen',
      why: 'Your spacecraft needs a rocket that can carry its full mass, including fuel, to your orbit.',
      fix: 'Choose a launch vehicle.',
    });
  } else if (orbit && a.launchCapacityKg !== null) {
    if (a.launchCapacityKg === 0) {
      add({
        code: 'launch-cannot-reach',
        severity: 'error',
        area: 'launch',
        message: `${launchVehicle.name} cannot reach ${orbit.name}`,
        why: 'Each rocket class has a limited reach. Small rockets cannot send anything to the Moon or Mars.',
        fix: 'Choose a launch vehicle with capacity for this orbit.',
      });
    } else if (a.wetMassKg > a.launchCapacityKg) {
      add({
        code: 'launch-overweight',
        severity: 'error',
        area: 'launch',
        message: `Over launch capacity by ${fmt(a.wetMassKg - a.launchCapacityKg, 1)} kg`,
        why: `Your spacecraft weighs ${fmt(a.wetMassKg, 1)} kg with fuel, but ${launchVehicle.name} can carry ${fmt(a.launchCapacityKg)} kg to this orbit.`,
        fix: 'Pick a bigger launch vehicle, or remove heavy parts or fuel.',
      });
    }
  }

  // --- Spacecraft (stage 4) ---
  const required: [PartCategory, string, string][] = [
    ['bus', 'a spacecraft bus', 'The bus is the body that holds everything together.'],
    ['solar', 'a solar array', 'Without solar panels the spacecraft has no power source.'],
    ['battery', 'a battery', 'Batteries keep the spacecraft alive in shadow.'],
    ['antenna', 'an antenna', 'Without an antenna, no data ever reaches Earth.'],
    ['computer', 'a flight computer', 'The computer runs the spacecraft and stores data.'],
    ['adcs', 'attitude control', 'Attitude control points the panels, antenna and instruments.'],
  ];
  for (const [cat, label, why] of required) {
    if (count(cat) === 0) {
      add({
        code: `missing-${cat}`,
        severity: 'error',
        area: 'parts',
        message: `Missing ${label}`,
        why,
        fix: `Add ${label} from the parts list.`,
      });
    }
  }
  if (count('bus') > 1) {
    add({
      code: 'multiple-bus',
      severity: 'error',
      area: 'parts',
      message: 'More than one spacecraft bus',
      why: 'A spacecraft has a single body; extra buses add mass without carrying anything.',
      fix: 'Keep one bus and remove the others.',
    });
  }
  if (a.busCapacityKg !== null && a.carriedMassKg > a.busCapacityKg) {
    add({
      code: 'bus-overloaded',
      severity: 'error',
      area: 'parts',
      message: `Bus overloaded by ${fmt(a.carriedMassKg - a.busCapacityKg, 1)} kg`,
      why: `The bus can carry ${fmt(a.busCapacityKg)} kg of equipment and fuel, but you added ${fmt(a.carriedMassKg, 1)} kg.`,
      fix: 'Choose a larger bus, or remove equipment or fuel.',
    });
  }
  if (count('instrument') === 0) {
    add({
      code: 'no-instruments',
      severity: 'error',
      area: 'parts',
      message: 'No science instruments',
      why: 'A science mission without instruments returns no science.',
      fix: 'Add instruments that match your goals.',
    });
  }

  // Δv
  if (orbit && a.deltaVAvailableMs < a.deltaVRequiredMs) {
    add({
      code: 'delta-v-short',
      severity: 'error',
      area: 'parts',
      message: `Δv short by ${fmt(a.deltaVRequiredMs - a.deltaVAvailableMs)} m/s`,
      why: `Reaching and keeping ${orbit.name} needs ${fmt(a.deltaVRequiredMs)} m/s of Δv, but your propulsion provides ${fmt(a.deltaVAvailableMs)} m/s.`,
      fix: 'Add a propulsion system with more fuel or higher efficiency (Isp), or choose an orbit that needs less Δv.',
    });
  }

  // Power and energy
  if (parts.length && a.powerConsumptionW > a.powerGenerationW) {
    add({
      code: 'power-deficit',
      severity: 'warning',
      area: 'parts',
      message: `Power short by ${fmt(a.powerConsumptionW - a.powerGenerationW)} W`,
      why: `Your parts use ${fmt(a.powerConsumptionW)} W, but the solar array averages ${fmt(a.powerGenerationW)} W over an orbit. Instruments will be switched off part of the time.`,
      fix: 'Add a bigger solar array or remove power-hungry parts.',
    });
  }
  if (orbit && count('battery') > 0 && a.batteryUsableWh < a.eclipseEnergyNeedWh) {
    add({
      code: 'battery-too-small',
      severity: 'warning',
      area: 'parts',
      message: `Battery ${fmt(a.eclipseEnergyNeedWh - a.batteryUsableWh)} Wh too small for eclipses`,
      why: `Each eclipse lasts ${fmt(a.eclipseHours * 60)} minutes and needs ${fmt(a.eclipseEnergyNeedWh)} Wh, but the battery can safely give ${fmt(a.batteryUsableWh)} Wh. The spacecraft will enter safe mode in shadow.`,
      fix: 'Add a bigger battery or choose an orbit with shorter eclipses.',
    });
  }

  // Pointing
  if (orbit && !BODY[orbit.body].magneticField && parts.some((p) => p.id === 'adcs-magnetorquer')) {
    const only = parts
      .filter((p) => p.category === 'adcs')
      .every((p) => p.id === 'adcs-magnetorquer');
    add({
      code: 'magnetorquer-no-field',
      severity: only ? 'error' : 'warning',
      area: 'parts',
      message: 'Magnetorquers do not work here',
      why: `Magnetorquers push against a planet's magnetic field. ${orbit.body === 'moon' ? 'The Moon' : 'Mars'} has no global magnetic field to push against.`,
      fix: 'Use reaction wheels for attitude control.',
    });
  }

  // Communications
  if (orbit && count('antenna') > 0 && a.dataGeneratedGbitPerDay > a.downlinkGbitPerDay) {
    const lostPct = (1 - a.downlinkGbitPerDay / a.dataGeneratedGbitPerDay) * 100;
    add({
      code: 'downlink-short',
      severity: 'warning',
      area: 'operations',
      message: `${fmt(lostPct)}% of science data cannot be sent home`,
      why: `Instruments make ${fmt(a.dataGeneratedGbitPerDay, 1)} Gbit/day, but the downlink carries ${fmt(a.downlinkGbitPerDay, 1)} Gbit/day.`,
      fix: 'Use a higher-gain antenna, add ground stations, or choose instruments that make less data.',
    });
  }

  // Advanced parts on Explorer
  if (design.difficulty === 'explorer') {
    for (const p of parts.filter((x) => x.advanced)) {
      add({
        code: 'advanced-part',
        severity: 'error',
        area: 'parts',
        message: `${p.name} is an advanced part`,
        why: 'Explorer difficulty keeps to simpler parts. Advanced parts unlock on Engineer.',
        fix: 'Remove it or switch to Engineer difficulty.',
      });
    }
  }

  return issues;
}

export const hasBlockingErrors = (issues: readonly Issue[]) =>
  issues.some((i) => i.severity === 'error');
