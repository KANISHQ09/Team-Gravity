import type { Catalog, Design, Part } from '@gravity/shared';
import {
  type DesignAnalysis,
  analyzeDesign,
  antennaRateMbps,
  instrumentsFor,
} from '../models/analysis.ts';
import { NEEDS_POINTING, POINTING_NEEDED_ARCSEC, SURFACE_MAPPING } from '../models/constants.ts';
import { EVENT_NAMES, type EventType, hazards, mitigationFacts } from '../readiness/risk.ts';
import { createRng } from './prng.ts';

export type SimPhase =
  'development' | 'launch' | 'transfer' | 'insertion' | 'science' | 'end-of-life';
export const PHASES: readonly SimPhase[] = [
  'development',
  'launch',
  'transfer',
  'insertion',
  'science',
  'end-of-life',
];
export const PHASE_NAMES: Record<SimPhase, string> = {
  development: 'Development',
  launch: 'Launch',
  transfer: 'Transfer / cruise',
  insertion: 'Orbit insertion',
  science: 'Science operations',
  'end-of-life': 'End of life',
};

export type SimEventType =
  EventType | 'instrument-failure' | 'insertion-dispersion' | 'schedule-overrun';

export interface SimEvent {
  readonly phase: SimPhase;
  /** Day relative to launch (negative = before launch). */
  readonly day: number;
  readonly type: SimEventType;
  readonly title: string;
  readonly effect: string;
  /** Whether a design choice softened or cancelled the event. */
  readonly mitigated: boolean;
  /** Whether any design choice could have softened it. */
  readonly mitigable: boolean;
  readonly mitigatedBy?: string;
}

/** Science lost to one cause, for the causal report. */
export type LossCause =
  | 'orbit-mapping'
  | 'pointing'
  | 'downlink'
  | 'storage'
  | 'power'
  | 'battery'
  | 'safe-mode'
  | 'instrument-lost'
  | 'insertion';

export interface SamplePoint {
  readonly day: number;
  readonly science: number;
  readonly batteryPct: number;
  readonly dataReturnedGbit: number;
  readonly dataLostGbit: number;
}

export interface RunResult {
  readonly seed: number;
  readonly design: Design;
  readonly outcome: 'full' | 'partial' | 'failure';
  readonly failurePhase: SimPhase | null;
  readonly failureReason: string | null;
  readonly phasesCompleted: number;
  readonly events: readonly SimEvent[];
  readonly science: number;
  /** Science the design would return with no losses at all. */
  readonly idealScience: number;
  readonly baselineScience: number;
  readonly thresholdScience: number;
  readonly losses: Readonly<Record<LossCause, number>>;
  readonly goalScience: readonly { goalId: string; title: string; science: number; met: boolean }[];
  readonly dataReturnedGbit: number;
  readonly dataLostGbit: number;
  readonly safeModeDays: number;
  readonly launchDelayDays: number;
  readonly descopedInstruments: readonly string[];
  readonly samples: readonly SamplePoint[];
}

const emptyLosses = (): Record<LossCause, number> => ({
  'orbit-mapping': 0,
  pointing: 0,
  downlink: 0,
  storage: 0,
  power: 0,
  battery: 0,
  'safe-mode': 0,
  'instrument-lost': 0,
  insertion: 0,
});

/**
 * Deterministic mission simulation (SRS-SIM-01…05). The same design, catalog and
 * seed always return the identical result. Callers should validate first: the
 * simulation assumes a launchable design and reports launch blockers as failure.
 */
export function simulate(design: Design, seed: number, catalog: Catalog): RunResult {
  return simulateAnalysis(analyzeDesign(design, catalog), seed);
}

export function simulateAnalysis(a: DesignAnalysis, seed: number): RunResult {
  const rng = createRng(seed);
  const { scenario, orbit, goals, design } = a.resolved;
  const h = hazards(a);
  const m = mitigationFacts(a);
  const events: SimEvent[] = [];
  const losses = emptyLosses();
  const samples: SamplePoint[] = [];
  const descoped: string[] = [];
  let parts: Part[] = [...a.resolved.parts];

  const base = {
    seed,
    design,
    baselineScience: scenario.baselineScience,
    thresholdScience: scenario.thresholdScience,
  };
  const fail = (phase: SimPhase, reason: string, completed: number): RunResult => ({
    ...base,
    outcome: 'failure',
    failurePhase: phase,
    failureReason: reason,
    phasesCompleted: completed,
    events,
    science: 0,
    idealScience: 0,
    losses,
    goalScience: goals.map((g) => ({ goalId: g.id, title: g.title, science: 0, met: false })),
    dataReturnedGbit: 0,
    dataLostGbit: 0,
    safeModeDays: 0,
    launchDelayDays: 0,
    descopedInstruments: descoped,
    samples,
  });

  if (
    !orbit ||
    a.launchCapacityKg === null ||
    a.wetMassKg > a.launchCapacityKg ||
    a.launchCapacityKg === 0
  ) {
    return fail(
      'launch',
      'The design cannot be launched: check the launch vehicle, orbit and mass.',
      0,
    );
  }

  // ---------- Phase 1: development ----------
  let launchDelayDays = 0;
  if (a.devMonths > scenario.developmentMonths) {
    const late = Math.round((a.devMonths - scenario.developmentMonths) * 30);
    launchDelayDays += late;
    events.push({
      phase: 'development',
      day: -late,
      type: 'schedule-overrun',
      title: 'Development ran late',
      effect: `Building took ${Math.round(a.devMonths)} months, ${Math.round(a.devMonths - scenario.developmentMonths)} more than planned. Launch slipped ${late} days.`,
      mitigated: false,
      mitigable: true,
    });
  }
  if (rng.chance(h.launchSlip)) {
    const slip = 30 + Math.floor(rng.next() * 90);
    if (m.scheduleMargin) {
      events.push({
        phase: 'development',
        day: -slip,
        type: 'launch-slip',
        title: EVENT_NAMES['launch-slip'],
        effect: `A ${slip}-day delay in testing was absorbed by your schedule margin.`,
        mitigated: true,
        mitigable: true,
        mitigatedBy: 'Schedule margin',
      });
    } else {
      launchDelayDays += slip;
      events.push({
        phase: 'development',
        day: -slip,
        type: 'launch-slip',
        title: EVENT_NAMES['launch-slip'],
        effect: `Testing problems delayed launch by ${slip} days.`,
        mitigated: false,
        mitigable: true,
      });
    }
  }
  if (rng.chance(h.budgetCut)) {
    const newBudget = scenario.budgetM * 0.9;
    const instruments = parts.filter((p) => p.category === 'instrument');
    if (m.budgetReserve) {
      // Name what actually helped: a bought reserve, or simply a design well under budget.
      const bought = design.mitigations.includes('budget-reserve');
      events.push({
        phase: 'development',
        day: -200,
        type: 'budget-cut',
        title: EVENT_NAMES['budget-cut'],
        effect: bought
          ? 'The budget was cut by 10%. Your reserve covered it and no instrument was removed.'
          : 'The budget was cut by 10%. Your design was well under budget, so nothing had to be removed.',
        mitigated: true,
        mitigable: true,
        mitigatedBy: bought ? 'Budget reserve' : 'Cost margin',
      });
    } else if (a.costM > newBudget && instruments.length > 1) {
      // Descope: remove the instrument contributing least to selected goals.
      const value = (p: Part) =>
        goals.reduce(
          (s, g) =>
            s + ((p.measures ?? []).includes(g.measurement) ? g.weight * (p.scienceValue ?? 0) : 0),
          0,
        );
      const victim = [...instruments].sort((x, y) => value(x) - value(y))[0]!;
      parts = parts.filter((p) => p !== victim);
      descoped.push(victim.name);
      events.push({
        phase: 'development',
        day: -200,
        type: 'budget-cut',
        title: EVENT_NAMES['budget-cut'],
        effect: `The budget was cut by 10% and your design no longer fit. The ${victim.name} was removed from the mission.`,
        mitigated: false,
        mitigable: true,
      });
    } else {
      events.push({
        phase: 'development',
        day: -200,
        type: 'budget-cut',
        title: EVENT_NAMES['budget-cut'],
        effect: 'The budget was cut by 10%, but your design still fit within it.',
        mitigated: true,
        mitigable: true,
        mitigatedBy: 'Cost margin',
      });
    }
  }
  const lateForWindow = launchDelayDays > scenario.launchPeriodDays && scenario.body !== 'earth';
  // Missing a deep-space launch period shortens science operations (next window is later).
  const opsDays = Math.max(
    0,
    Math.round(scenario.missionDays * (lateForWindow ? (scenario.body === 'mars' ? 0.6 : 0.9) : 1)),
  );
  if (lateForWindow) {
    events.push({
      phase: 'development',
      day: 0,
      type: 'launch-slip',
      title: 'Launch period missed',
      effect: `The ${launchDelayDays}-day delay missed the ${scenario.launchPeriodDays}-day launch period. Waiting for the next one cut science operations to ${opsDays} days.`,
      mitigated: false,
      mitigable: true,
    });
  }

  // ---------- Phase 2: launch ----------
  if (rng.chance(h.launchFailure)) {
    events.push({
      phase: 'launch',
      day: 0,
      type: 'launch-failure',
      title: EVENT_NAMES['launch-failure'],
      effect: `The ${a.resolved.launchVehicle?.name ?? 'rocket'} failed during ascent. Every launch carries some risk.`,
      mitigated: false,
      mitigable: false,
    });
    return { ...fail('launch', 'The launch vehicle failed during ascent.', 1), launchDelayDays };
  }

  // ---------- Phase 3: transfer ----------
  let safeModeDays = 0;
  let storageFactor = 1;
  for (let day = 1; day <= orbit.transferDays; day++) {
    if (rng.chance(h.speDaily)) {
      if (m.radHard) {
        events.push({
          phase: 'transfer',
          day,
          type: 'solar-particle-event',
          title: EVENT_NAMES['solar-particle-event'],
          effect:
            'A solar storm swept past during cruise. The radiation-hardened computer was unaffected.',
          mitigated: true,
          mitigable: true,
          mitigatedBy: 'Radiation-hardened computer',
        });
      } else {
        const damaged = rng.chance(0.25);
        if (damaged) storageFactor *= 0.5;
        events.push({
          phase: 'transfer',
          day,
          type: 'solar-particle-event',
          title: EVENT_NAMES['solar-particle-event'],
          effect: damaged
            ? 'A solar storm during cruise damaged the computer: half of the data recorder no longer works.'
            : 'A solar storm during cruise reset the computer; it recovered after checks.',
          mitigated: false,
          mitigable: true,
        });
      }
    }
  }

  // ---------- Phase 4: orbit insertion ----------
  let insertionFactor = 1;
  if (a.deltaVRequiredMs > 0) {
    if (a.deltaVAvailableMs < a.deltaVRequiredMs) {
      events.push({
        phase: 'insertion',
        day: orbit.transferDays,
        type: 'insertion-dispersion',
        title: 'Orbit insertion failed',
        effect: `The engine ran out of fuel ${Math.round(a.deltaVRequiredMs - a.deltaVAvailableMs)} m/s short of orbit.`,
        mitigated: false,
        mitigable: true,
      });
      return { ...fail('insertion', 'Not enough Δv to brake into orbit.', 3), launchDelayDays };
    }
    const extraNeeded = 0.03 + rng.next() * 0.05;
    const spare = (a.deltaVAvailableMs - a.deltaVRequiredMs) / a.deltaVRequiredMs;
    if (spare < extraNeeded) {
      insertionFactor = 0.7;
      events.push({
        phase: 'insertion',
        day: orbit.transferDays,
        type: 'insertion-dispersion',
        title: 'Insertion needed extra fuel',
        effect: `Navigation errors needed ${Math.round(extraNeeded * 100)}% more Δv than planned. With only ${Math.round(spare * 100)}% spare, the spacecraft settled into a higher orbit and maps 30% less well.`,
        mitigated: false,
        mitigable: true,
      });
    } else {
      events.push({
        phase: 'insertion',
        day: orbit.transferDays,
        type: 'insertion-dispersion',
        title: 'Orbit insertion',
        effect: `Navigation errors needed ${Math.round(extraNeeded * 100)}% extra Δv; your ${Math.round(spare * 100)}% fuel margin covered it.`,
        mitigated: true,
        mitigable: true,
        mitigatedBy: 'Δv margin',
      });
    }
  }

  // ---------- Phase 5: science operations (one step per day) ----------
  const start = orbit.transferDays;
  let pointingOk = a.pointingArcsec !== null && a.pointingArcsec <= POINTING_NEEDED_ARCSEC.value;
  let batteryWh = a.batteryUsableWh;
  let antennaDownUntil = -1;
  let safeModeUntil = -1;
  let science = 0;
  let idealScience = 0;
  let dataReturned = 0;
  let dataLost = 0;
  const goalScience = new Map(goals.map((g) => [g.id, 0]));
  const dead = new Set<Part>();
  const antennas = parts.filter((p) => p.category === 'antenna');
  const contactMinutes = Math.min(1440, orbit.contactMinutesPerDay * design.groundStations);
  const storage = a.storageGbit;
  const powerDuty =
    a.powerConsumptionW > 0 ? Math.min(1, a.powerGenerationW / a.powerConsumptionW) : 1;

  for (let d = 1; d <= opsDays; d++) {
    const day = start + d;
    // --- Random events ---
    if (rng.chance(h.speDaily)) {
      if (m.radHard) {
        events.push({
          phase: 'science',
          day,
          type: 'solar-particle-event',
          title: EVENT_NAMES['solar-particle-event'],
          effect: 'A solar storm hit. The radiation-hardened computer kept running normally.',
          mitigated: true,
          mitigable: true,
          mitigatedBy: 'Radiation-hardened computer',
        });
      } else {
        safeModeUntil = Math.max(safeModeUntil, d + 5);
        const damaged = rng.chance(0.25);
        if (damaged) storageFactor *= 0.5;
        events.push({
          phase: 'science',
          day,
          type: 'solar-particle-event',
          title: EVENT_NAMES['solar-particle-event'],
          effect: damaged
            ? 'A solar storm crashed the computer: 5 days in safe mode, and half of the data recorder was damaged.'
            : 'A solar storm crashed the computer: 5 days in safe mode with no science.',
          mitigated: false,
          mitigable: true,
        });
      }
    }
    if (pointingOk && rng.chance(h.wheelDaily)) {
      if (m.redundantWheels) {
        events.push({
          phase: 'science',
          day,
          type: 'reaction-wheel-failure',
          title: EVENT_NAMES['reaction-wheel-failure'],
          effect: 'A reaction wheel failed. The spare wheel took over and pointing stayed precise.',
          mitigated: true,
          mitigable: true,
          mitigatedBy: 'Spare reaction wheel',
        });
      } else {
        pointingOk = false;
        events.push({
          phase: 'science',
          day,
          type: 'reaction-wheel-failure',
          title: EVENT_NAMES['reaction-wheel-failure'],
          effect:
            'A reaction wheel failed with no spare. Pointing became rough, halving image quality and weakening any high-gain antenna.',
          mitigated: false,
          mitigable: true,
        });
      }
    }
    if (d > antennaDownUntil && rng.chance(h.antennaDaily)) {
      antennaDownUntil = d + 20;
      events.push({
        phase: 'science',
        day,
        type: 'antenna-anomaly',
        title: EVENT_NAMES['antenna-anomaly'],
        effect: m.linkResilient
          ? 'The antenna mispointed for 20 days. Your extra ground contact time or link margin limited the data lost.'
          : 'The antenna mispointed for 20 days, cutting the downlink to 30%.',
        mitigated: m.linkResilient,
        mitigable: true,
        ...(m.linkResilient ? { mitigatedBy: 'Link margin or second ground station' } : {}),
      });
    }
    if (rng.chance(h.batteryDaily)) {
      const before = batteryWh >= a.eclipseEnergyNeedWh;
      batteryWh *= 0.85;
      const after = batteryWh >= a.eclipseEnergyNeedWh;
      events.push({
        phase: 'science',
        day,
        type: 'battery-degradation',
        title: EVENT_NAMES['battery-degradation'],
        effect:
          before && !after
            ? 'Battery cells wore out and lost 15% capacity. It can no longer cover full eclipses, so instruments now pause in shadow.'
            : 'Battery cells lost 15% capacity, but enough remains to cover eclipses.',
        mitigated: after,
        mitigable: true,
        ...(after ? { mitigatedBy: 'Battery margin' } : {}),
      });
    }
    for (const inst of parts.filter((p) => p.category === 'instrument' && !dead.has(p))) {
      let p = (1 - inst.reliability) / 365;
      if (d <= 60) p *= m.extraTesting ? 1 : 3; // early "infant mortality" unless parts were extra-tested
      if (rng.chance(p)) {
        dead.add(inst);
        events.push({
          phase: 'science',
          day,
          type: 'instrument-failure',
          title: `${inst.name} failed`,
          effect: `The ${inst.name} stopped working on day ${d} of science operations.`,
          mitigated: false,
          mitigable: d <= 60,
        });
      }
    }

    // --- Resources for today ---
    const generated = parts
      .filter((p) => p.category === 'instrument' && !dead.has(p))
      .reduce((s, p) => s + (p.dataGbitPerDay ?? 0), 0);
    let rate = antennas.length
      ? Math.max(...antennas.map((x) => antennaRateMbps(x, orbit, pointingOk ? 1 : 600)))
      : 0;
    if (d <= antennaDownUntil) rate *= m.linkResilient ? 0.8 : 0.3;
    const downlink = (rate * contactMinutes * 60) / 1000;
    const storageNeed = generated * (1 - contactMinutes / 1440);
    const downFrac = generated > 0 ? Math.min(1, downlink / generated) : 1;
    const storeFrac = storageNeed > 0 ? Math.min(1, (storage * storageFactor) / storageNeed) : 1;
    const batteryDuty = batteryWh >= a.eclipseEnergyNeedWh ? 1 : 1 - orbit.eclipseFraction;
    const safe = d <= safeModeUntil;
    if (safe) safeModeDays++;
    dataReturned += generated * downFrac * storeFrac * (safe ? 0 : powerDuty * batteryDuty);
    dataLost += generated * (1 - downFrac * storeFrac);

    // --- Science for today, with each loss attributed in a fixed order ---
    for (const goal of goals) {
      const original = instrumentsFor(a.resolved.parts, goal.measurement)[0];
      if (!original) continue;
      const ideal = goal.weight * (original.scienceValue ?? 0);
      idealScience += ideal;
      let v = ideal;
      const take = (cause: LossCause, factor: number) => {
        losses[cause] += v * (1 - factor);
        v *= factor;
      };
      const alive = instrumentsFor(parts, goal.measurement).filter((p) => !dead.has(p))[0];
      take('instrument-lost', alive ? (alive.scienceValue ?? 0) / (original.scienceValue ?? 1) : 0);
      if (SURFACE_MAPPING.has(goal.measurement)) {
        take('orbit-mapping', orbit.mappingQuality);
        take('insertion', insertionFactor);
      }
      if (NEEDS_POINTING.has(goal.measurement)) take('pointing', pointingOk ? 1 : 0.5);
      take('downlink', downFrac);
      take('storage', storeFrac);
      take('power', powerDuty);
      take('battery', batteryDuty);
      take('safe-mode', safe ? 0 : 1);
      science += v;
      goalScience.set(goal.id, (goalScience.get(goal.id) ?? 0) + v);
    }

    if (d % 7 === 0 || d === opsDays) {
      samples.push({
        day,
        science,
        batteryPct: a.batteryUsableWh > 0 ? Math.round((batteryWh / a.batteryUsableWh) * 100) : 0,
        dataReturnedGbit: dataReturned,
        dataLostGbit: dataLost,
      });
    }
  }

  const outcome =
    science >= scenario.baselineScience
      ? 'full'
      : science >= scenario.thresholdScience
        ? 'partial'
        : 'failure';
  return {
    ...base,
    outcome,
    failurePhase: outcome === 'failure' ? 'science' : null,
    failureReason:
      outcome === 'failure' ? 'Science return stayed below the Threshold level.' : null,
    phasesCompleted: PHASES.length,
    events,
    science,
    idealScience,
    losses,
    goalScience: goals.map((g) => {
      const s = goalScience.get(g.id) ?? 0;
      return {
        goalId: g.id,
        title: g.title,
        science: s,
        met: s >= g.weight * scenario.thresholdScience,
      };
    }),
    dataReturnedGbit: dataReturned,
    dataLostGbit: dataLost,
    safeModeDays,
    launchDelayDays,
    descopedInstruments: descoped,
    samples,
  };
}
