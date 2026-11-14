import type {
  Catalog,
  Design,
  Goal,
  LaunchVehicle,
  Measurement,
  Orbit,
  Part,
  Scenario,
} from '@gravity/shared';
import {
  ARRAY_DERATING,
  BATTERY_DEPTH_OF_DISCHARGE,
  BODY,
  G0,
  MAX_DOWNLINK_MBPS,
  NEEDS_POINTING,
  OPS_COST_PER_STATION_DAY,
  POINTING_NEEDED_ARCSEC,
  SOLAR_CONSTANT,
} from './constants.ts';

/** One item's share of a total, so the UI and report can say *what* caused it. */
export interface Contribution {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
}

/** A design with every catalog reference resolved (unknown IDs are dropped and reported). */
export interface ResolvedDesign {
  readonly design: Design;
  readonly scenario: Scenario;
  readonly parts: readonly Part[];
  readonly unknownPartIds: readonly string[];
  readonly launchVehicle: LaunchVehicle | null;
  readonly orbit: Orbit | null;
  readonly goals: readonly Goal[];
}

export function resolveDesign(design: Design, catalog: Catalog): ResolvedDesign {
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${design.scenarioId}`);
  const parts: Part[] = [];
  const unknownPartIds: string[] = [];
  for (const id of design.partIds) {
    const part = catalog.parts.find((p) => p.id === id);
    if (part) parts.push(part);
    else unknownPartIds.push(id);
  }
  return {
    design,
    scenario,
    parts,
    unknownPartIds,
    launchVehicle: catalog.launchVehicles.find((v) => v.id === design.launchVehicleId) ?? null,
    orbit: catalog.orbits.find((o) => o.id === design.orbitId) ?? null,
    goals: scenario.goals.filter((g) => design.goalIds.includes(g.id)),
  };
}

/** Every derived number the budgets, validation, readiness and simulation need. */
export interface DesignAnalysis {
  readonly resolved: ResolvedDesign;
  // Mass
  readonly dryMassKg: number;
  readonly propellantKg: number;
  readonly wetMassKg: number;
  readonly busCapacityKg: number | null;
  /** Mass the bus must carry: everything except the bus, including propellant. */
  readonly carriedMassKg: number;
  readonly launchCapacityKg: number | null;
  readonly massContributions: readonly Contribution[];
  // Propulsion
  readonly deltaVAvailableMs: number;
  readonly deltaVRequiredMs: number;
  // Power and energy
  readonly powerGenerationW: number;
  readonly powerConsumptionW: number;
  readonly powerContributions: readonly Contribution[];
  readonly orbitPeriodH: number;
  readonly eclipseHours: number;
  readonly batteryUsableWh: number;
  readonly eclipseEnergyNeedWh: number;
  // Data and communications
  readonly dataGeneratedGbitPerDay: number;
  readonly dataContributions: readonly Contribution[];
  readonly downlinkMbps: number;
  readonly downlinkGbitPerDay: number;
  readonly storageGbit: number;
  readonly storageNeedGbit: number;
  readonly linkMarginDb: number;
  readonly pointingArcsec: number | null;
  // Cost and schedule
  readonly costM: number;
  readonly costContributions: readonly Contribution[];
  readonly devMonths: number;
  readonly devContributions: readonly Contribution[];
  // Reliability
  readonly yearReliability: number;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function contributions(parts: readonly Part[], pick: (p: Part) => number): Contribution[] {
  const byId = new Map<string, Contribution>();
  for (const p of parts) {
    const prev = byId.get(p.id);
    byId.set(p.id, { id: p.id, name: p.name, amount: (prev?.amount ?? 0) + pick(p) });
  }
  return [...byId.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
}

/** Effective antenna gain: a high-gain dish loses 10 dB if pointing is too rough. */
function effectiveGainDbi(antenna: Part, pointingArcsec: number | null): number {
  const gain = antenna.gainDbi ?? 0;
  const precise = pointingArcsec !== null && pointingArcsec <= POINTING_NEEDED_ARCSEC.value;
  return gain >= 30 && !precise ? gain - 10 : gain;
}

/** Data rate of one antenna in Mbit/s (simplified link budget, GAME calibration). */
export function antennaRateMbps(
  antenna: Part,
  orbit: Orbit,
  pointingArcsec: number | null,
): number {
  const gainLinear = 10 ** (effectiveGainDbi(antenna, pointingArcsec) / 10);
  const distanceThousandKm = orbit.earthDistanceKm / 1000;
  const rate =
    (orbit.groundAntennaFactor * (antenna.txPowerW ?? 0) * gainLinear) / distanceThousandKm ** 2;
  return Math.min(rate, MAX_DOWNLINK_MBPS.value);
}

/** Orbital period (hours) from Kepler's third law. */
export function orbitPeriodHours(orbit: Orbit): number {
  const body = BODY[orbit.body];
  const a = body.radiusKm + orbit.altitudeKm;
  return (2 * Math.PI * Math.sqrt(a ** 3 / body.muKm3s2)) / 3600;
}

/** Instruments in the design that can make a measurement (best first). */
export function instrumentsFor(parts: readonly Part[], m: Measurement): Part[] {
  return parts
    .filter((p) => p.category === 'instrument' && (p.measures ?? []).includes(m))
    .sort((a, b) => (b.scienceValue ?? 0) - (a.scienceValue ?? 0));
}

export function analyzeDesign(design: Design, catalog: Catalog): DesignAnalysis {
  const resolved = resolveDesign(design, catalog);
  const { parts, orbit, launchVehicle, scenario } = resolved;
  const of = (cat: Part['category']) => parts.filter((p) => p.category === cat);

  // --- Mass and Δv (Tsiolkovsky rocket equation) ---
  const dryMassKg = sum(parts.map((p) => p.massKg));
  const engines = of('propulsion');
  const propellantKg = sum(engines.map((p) => p.propellantKg ?? 0));
  const wetMassKg = dryMassKg + propellantKg;
  const buses = of('bus');
  const bus = buses[0] ?? null;
  const busCapacityKg = bus?.payloadCapacityKg ?? null;
  const carriedMassKg = wetMassKg - (bus?.massKg ?? 0);
  const ispEffective =
    propellantKg > 0
      ? sum(engines.map((p) => (p.ispS ?? 0) * (p.propellantKg ?? 0))) / propellantKg
      : 0;
  const deltaVAvailableMs =
    propellantKg > 0 && dryMassKg > 0
      ? ispEffective * G0.value * Math.log(wetMassKg / dryMassKg)
      : 0;
  const launchCapacityKg =
    launchVehicle && orbit ? (launchVehicle.capacityKg[orbit.orbitClass] ?? 0) : null;

  // --- Pointing ---
  const adcs = of('adcs');
  const pointingArcsec = adcs.length
    ? Math.min(...adcs.map((p) => p.pointingArcsec ?? Infinity))
    : null;
  // Magnetorquers need a planetary magnetic field to work.
  const usablePointing =
    orbit && !BODY[orbit.body].magneticField
      ? adcs.filter((p) => p.id !== 'adcs-magnetorquer')
      : adcs;
  const effectivePointing = usablePointing.length
    ? Math.min(...usablePointing.map((p) => p.pointingArcsec ?? Infinity))
    : null;

  // --- Power and energy ---
  const sunAu = orbit?.sunDistanceAu ?? 1;
  const eclipse = orbit?.eclipseFraction ?? 0;
  const sunlitW = sum(
    of('solar').map(
      (p) =>
        (p.areaM2 ?? 0) *
        (p.efficiency ?? 0) *
        (SOLAR_CONSTANT.value / sunAu ** 2) *
        ARRAY_DERATING.value,
    ),
  );
  const powerGenerationW = sunlitW * (1 - eclipse);
  const powerConsumptionW = sum(parts.map((p) => p.powerW));
  const orbitPeriodH = orbit ? orbitPeriodHours(orbit) : 0;
  const eclipseHours = orbitPeriodH * eclipse;
  const batteryUsableWh =
    sum(of('battery').map((p) => p.capacityWh ?? 0)) * BATTERY_DEPTH_OF_DISCHARGE.value;
  const eclipseEnergyNeedWh = powerConsumptionW * eclipseHours;

  // --- Data and communications ---
  const instruments = of('instrument');
  const dataGeneratedGbitPerDay = sum(instruments.map((p) => p.dataGbitPerDay ?? 0));
  const antennas = of('antenna');
  const downlinkMbps =
    orbit && antennas.length
      ? Math.max(...antennas.map((a) => antennaRateMbps(a, orbit, effectivePointing)))
      : 0;
  const contactMinutes = orbit
    ? Math.min(1440, orbit.contactMinutesPerDay * design.groundStations)
    : 0;
  const downlinkGbitPerDay = (downlinkMbps * contactMinutes * 60) / 1000;
  const storageGbit = sum(of('computer').map((p) => p.storageGbit ?? 0));
  // Data produced while out of contact has to wait on the recorder.
  const storageNeedGbit = dataGeneratedGbitPerDay * (1 - contactMinutes / 1440);
  const linkMarginDb =
    dataGeneratedGbitPerDay > 0
      ? downlinkGbitPerDay > 0
        ? 10 * Math.log10(downlinkGbitPerDay / dataGeneratedGbitPerDay)
        : -30
      : 30;

  // --- Cost ---
  const opsCostM = orbit
    ? OPS_COST_PER_STATION_DAY[orbit.body] * design.groundStations * scenario.missionDays
    : 0;
  const partCost = contributions(parts, (p) => p.costM);
  const baseCost = sum(parts.map((p) => p.costM)) + (launchVehicle?.costM ?? 0) + opsCostM;
  const reservePct =
    (design.mitigations.includes('budget-reserve') ? 0.1 : 0) +
    (design.mitigations.includes('extra-testing') ? 0.05 : 0);
  const costContributions: Contribution[] = [
    ...(launchVehicle
      ? [{ id: launchVehicle.id, name: launchVehicle.name, amount: launchVehicle.costM }]
      : []),
    ...partCost,
    ...(opsCostM > 0
      ? [{ id: 'operations', name: 'Ground-station operations', amount: opsCostM }]
      : []),
    ...(reservePct > 0
      ? [{ id: 'reserves', name: 'Reserves and extra testing', amount: baseCost * reservePct }]
      : []),
  ].sort((a, b) => b.amount - a.amount);
  const costM = baseCost * (1 + reservePct);

  // --- Schedule: longest part to build, plus integration time per part ---
  const longest = parts.length ? Math.max(...parts.map((p) => p.devMonths)) : 0;
  const extraMonths =
    (design.mitigations.includes('schedule-margin') ? 2 : 0) +
    (design.mitigations.includes('extra-testing') ? 1 : 0);
  const devMonths = parts.length ? longest + 2 + 0.25 * parts.length + extraMonths : 0;

  return {
    resolved,
    dryMassKg,
    propellantKg,
    wetMassKg,
    busCapacityKg,
    carriedMassKg,
    launchCapacityKg,
    massContributions: contributions(parts, (p) => p.massKg + (p.propellantKg ?? 0)),
    deltaVAvailableMs,
    deltaVRequiredMs: orbit?.deltaVRequiredMs ?? 0,
    powerGenerationW,
    powerConsumptionW,
    powerContributions: contributions(parts, (p) => p.powerW),
    orbitPeriodH,
    eclipseHours,
    batteryUsableWh,
    eclipseEnergyNeedWh,
    dataGeneratedGbitPerDay,
    dataContributions: contributions(instruments, (p) => p.dataGbitPerDay ?? 0),
    downlinkMbps,
    downlinkGbitPerDay,
    storageGbit,
    storageNeedGbit,
    linkMarginDb,
    pointingArcsec: effectivePointing ?? pointingArcsec,
    costM,
    costContributions,
    devMonths,
    devContributions: contributions(parts, (p) => p.devMonths).slice(0, 3),
    yearReliability: parts.reduce((r, p) => r * p.reliability, 1),
  };
}

/** Whether the design's pointing is good enough for measurements that need it. */
export function pointingOk(analysis: DesignAnalysis): boolean {
  return (
    analysis.pointingArcsec !== null && analysis.pointingArcsec <= POINTING_NEEDED_ARCSEC.value
  );
}

export { NEEDS_POINTING };
