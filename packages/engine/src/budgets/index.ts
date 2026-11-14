import type { Catalog, ResourceKey } from '@gravity/shared';
import { type Contribution, type DesignAnalysis, analyzeDesign } from '../models/analysis.ts';
import { MARGIN_TARGET, REQUIRED_LINK_MARGIN_DB } from '../models/constants.ts';
import type { Design } from '@gravity/shared';

export type GaugeStatus = 'ok' | 'warning' | 'over' | 'unknown';

export interface Gauge {
  readonly key: ResourceKey;
  readonly label: string;
  readonly unit: string;
  readonly used: number;
  /** null when the limit is not known yet (e.g. no launch vehicle chosen). */
  readonly limit: number | null;
  /** Spare share of the limit (0.25 = 25% unused); null when the limit is unknown. */
  readonly margin: number | null;
  /** Margin the current difficulty asks for. */
  readonly target: number;
  readonly status: GaugeStatus;
  readonly critical: boolean;
  /** Plain-language explanation of what this resource means for the mission. */
  readonly why: string;
  /** What to change when the gauge is not OK. */
  readonly fix: string | null;
  readonly contributors: readonly Contribution[];
}

function maxGauge(
  base: Omit<Gauge, 'margin' | 'status' | 'fix'>,
  fixes: { over: string; warning: string },
): Gauge {
  if (base.limit === null) return { ...base, margin: null, status: 'unknown', fix: fixes.over };
  const margin = base.limit > 0 ? (base.limit - base.used) / base.limit : base.used > 0 ? -1 : 1;
  const status: GaugeStatus = margin < 0 ? 'over' : margin < base.target ? 'warning' : 'ok';
  return {
    ...base,
    margin,
    status,
    fix: status === 'over' ? fixes.over : status === 'warning' ? fixes.warning : null,
  };
}

/** The six resource gauges for a design (SRS-DES-04/05, SRS-RES-01…07). */
export function computeBudgets(design: Design, catalog: Catalog): Gauge[] {
  return gaugesFromAnalysis(analyzeDesign(design, catalog));
}

export function gaugesFromAnalysis(a: DesignAnalysis): Gauge[] {
  const { scenario, design } = a.resolved;
  const target = MARGIN_TARGET[design.difficulty];
  const critical = (k: ResourceKey) => scenario.criticalResource === k;

  const mass = maxGauge(
    {
      key: 'mass',
      label: 'Mass',
      unit: 'kg',
      used: a.wetMassKg,
      limit: a.launchCapacityKg,
      target,
      critical: critical('mass'),
      why: 'The rocket can only lift so much to your orbit. Fuel counts too, and every kilogram you add needs more fuel to steer.',
      contributors: a.massContributions,
    },
    {
      over:
        a.launchCapacityKg === null
          ? 'Choose a launch vehicle and an orbit to see how much mass you can launch.'
          : 'Pick a bigger launch vehicle, or remove heavy parts and fuel you do not need.',
      warning: 'Mass estimates grow as designs mature. Keep more spare launch capacity.',
    },
  );

  const power = maxGauge(
    {
      key: 'power',
      label: 'Power',
      unit: 'W',
      used: a.powerConsumptionW,
      limit: a.powerGenerationW,
      target,
      critical: critical('power'),
      why: 'Solar panels must make, on average over each orbit, all the power your parts use. Shadow and distance from the Sun reduce what they make.',
      contributors: a.powerContributions,
    },
    {
      over: 'Add a larger solar array, or remove power-hungry parts. Without enough power, instruments must be switched off part of the time.',
      warning: 'Solar panels wear out over time. Add more array area to keep a safety margin.',
    },
  );

  const budget = maxGauge(
    {
      key: 'budget',
      label: 'Budget',
      unit: 'M$',
      used: a.costM,
      limit: scenario.budgetM,
      target,
      critical: critical('budget'),
      why: 'Development, launch and operations all cost money. A real budget cut can force you to remove instruments.',
      contributors: a.costContributions,
    },
    {
      over: 'Choose cheaper parts, a cheaper launch vehicle or fewer ground stations.',
      warning: 'Keep a reserve: costs usually grow and budgets can be cut.',
    },
  );

  const data = maxGauge(
    {
      key: 'data',
      label: 'Data storage',
      unit: 'Gbit',
      used: a.storageNeedGbit,
      limit: a.storageGbit,
      target,
      critical: critical('data'),
      why: 'Instruments keep producing data between ground-station contacts. The onboard recorder must hold it until the next contact, or data is lost.',
      contributors: a.dataContributions,
    },
    {
      over: 'Use a computer with a bigger recorder, add contact time with more ground stations, or choose instruments that produce less data.',
      warning:
        'A fuller recorder leaves little room for a missed contact. Add storage or contact time.',
    },
  );

  // Communications is judged in decibels: how much the downlink exceeds what the instruments produce.
  const required = REQUIRED_LINK_MARGIN_DB.value;
  const commsStatus: Gauge['status'] =
    a.dataGeneratedGbitPerDay === 0
      ? 'ok'
      : a.downlinkGbitPerDay === 0
        ? 'over'
        : a.linkMarginDb < 0
          ? 'over'
          : a.linkMarginDb < required
            ? 'warning'
            : 'ok';
  const comms: Gauge = {
    key: 'comms',
    label: 'Communications',
    unit: 'Gbit/day',
    used: a.dataGeneratedGbitPerDay,
    limit: a.downlinkGbitPerDay,
    margin:
      a.downlinkGbitPerDay > 0
        ? (a.downlinkGbitPerDay - a.dataGeneratedGbitPerDay) / a.downlinkGbitPerDay
        : null,
    target,
    status: commsStatus,
    critical: critical('comms'),
    why: `Science only counts once it reaches Earth. The downlink must carry everything the instruments produce, ideally with at least ${required} dB of link margin (twice what is needed).`,
    fix:
      commsStatus === 'ok'
        ? null
        : 'Use a higher-gain antenna, add ground stations, or produce less data. Far from Earth, only a big dish works.',
    contributors: a.dataContributions,
  };

  const time = maxGauge(
    {
      key: 'time',
      label: 'Schedule',
      unit: 'months',
      used: a.devMonths,
      limit: scenario.developmentMonths,
      target,
      critical: critical('time'),
      why: 'Every part must be built and tested before the launch period. The slowest part sets the pace, and each extra part adds integration time.',
      contributors: a.devContributions,
    },
    {
      over: 'Replace slow, complex parts with simpler ones, or use fewer parts.',
      warning: 'Development often runs late. Keep schedule margin before the launch period.',
    },
  );

  return [mass, power, budget, data, comms, time];
}
