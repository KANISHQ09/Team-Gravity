import type { Catalog, Design } from '@gravity/shared';
import { gaugesFromAnalysis } from '../budgets/index.ts';
import { type DesignAnalysis, analyzeDesign } from '../models/analysis.ts';
import { MARGIN_TARGET } from '../models/constants.ts';
import { validateAnalysis } from '../validate/index.ts';
import { risksFromAnalysis } from './risk.ts';

export type CheckStatus = 'green' | 'yellow' | 'red';

export interface CheckItem {
  readonly id: string;
  readonly label: string;
  readonly status: CheckStatus;
  /** Critical items must be green to launch, whatever the overall percentage. */
  readonly critical: boolean;
  readonly detail: string;
  /** How to turn the item green (shown for red and yellow items). */
  readonly fix: string | null;
}

export interface Readiness {
  readonly items: readonly CheckItem[];
  readonly greenFraction: number;
  /** True when ≥ 80% of items are green and every critical item is green (SRS-CML-02). */
  readonly ready: boolean;
  readonly blockers: readonly CheckItem[];
}

export const READINESS_THRESHOLD = 0.8;

/** Launch readiness review, computed by the engine, never self-reported (SRS-CML-03). */
export function evaluateReadiness(design: Design, catalog: Catalog): Readiness {
  return readinessFromAnalysis(analyzeDesign(design, catalog));
}

export function readinessFromAnalysis(a: DesignAnalysis): Readiness {
  const { design, parts } = a.resolved;
  const fd = design.difficulty === 'flight-director';
  const explorer = design.difficulty === 'explorer';
  const issues = validateAnalysis(a);
  const gauges = gaugesFromAnalysis(a);
  const risks = risksFromAnalysis(a);
  const items: CheckItem[] = [];

  const errorsIn = (codes: string[]) =>
    issues.filter((i) => i.severity === 'error' && codes.some((c) => i.code.startsWith(c)));

  // Science
  const sciErrors = errorsIn(['no-goals', 'goal-uncovered', 'no-instruments']);
  items.push({
    id: 'science',
    label: 'Every science goal has an instrument',
    status: sciErrors.length ? 'red' : 'green',
    critical: true,
    detail: sciErrors.length
      ? sciErrors.map((i) => i.message).join('; ')
      : 'All selected goals are covered.',
    fix: sciErrors[0]?.fix ?? null,
  });

  // Master Equipment List completeness
  const melErrors = errorsIn([
    'missing-',
    'multiple-bus',
    'unknown-part',
    'advanced-part',
    'bus-overloaded',
  ]);
  items.push({
    id: 'mel',
    label: 'Master Equipment List complete and buildable',
    status: melErrors.length ? 'red' : 'green',
    critical: true,
    detail: melErrors.length
      ? melErrors.map((i) => i.message).join('; ')
      : `${parts.length} parts, all systems present.`,
    fix: melErrors[0]?.fix ?? null,
  });

  // Orbit, launch and Δv
  const launchErrors = errorsIn([
    'no-orbit',
    'orbit-not-allowed',
    'no-launch-vehicle',
    'launch-',
    'magnetorquer-no-field',
  ]);
  items.push({
    id: 'launch',
    label: 'Launch vehicle and orbit compatible',
    status: launchErrors.length ? 'red' : 'green',
    critical: true,
    detail: launchErrors.length
      ? launchErrors.map((i) => i.message).join('; ')
      : 'The rocket can deliver this spacecraft to its orbit.',
    fix: launchErrors[0]?.fix ?? null,
  });
  const dvError = errorsIn(['delta-v-short'])[0];
  items.push({
    id: 'delta-v',
    label: 'Enough Δv to reach the orbit',
    status: dvError ? 'red' : 'green',
    critical: true,
    detail:
      dvError?.message ??
      `${Math.round(a.deltaVAvailableMs)} m/s available for ${Math.round(a.deltaVRequiredMs)} m/s needed.`,
    fix: dvError?.fix ?? null,
  });
  if (a.deltaVRequiredMs > 0 && !dvError) {
    const spare = (a.deltaVAvailableMs - a.deltaVRequiredMs) / a.deltaVRequiredMs;
    items.push({
      id: 'delta-v-margin',
      label: 'Δv margin ≥ 10% for navigation errors',
      status: spare >= 0.1 ? 'green' : 'yellow',
      critical: false,
      detail: `${Math.round(spare * 100)}% spare Δv.`,
      fix:
        spare >= 0.1
          ? null
          : 'Orbit insertion usually needs a few percent more Δv than planned. Carry more fuel or pick an orbit that needs less.',
    });
  }

  // Resource margins (one item per gauge)
  const target = MARGIN_TARGET[design.difficulty];
  for (const g of gauges) {
    const status: CheckStatus =
      g.status === 'ok' ? 'green' : g.status === 'warning' ? 'yellow' : 'red';
    const critical =
      g.key === 'mass' || g.key === 'budget' || (fd && (g.key === 'power' || g.key === 'comms'));
    items.push({
      id: `margin-${g.key}`,
      label: `${g.label} margin ≥ ${Math.round(g.target * 100)}%`,
      status,
      critical: critical && !(explorer && g.key !== 'mass' && g.key !== 'budget'),
      detail:
        g.margin === null
          ? 'Not known yet.'
          : `${Math.round(g.margin * 100)}% spare (${g.used.toLocaleString('en-US', { maximumFractionDigits: 1 })} of ${(g.limit ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${g.unit}).`,
      fix: g.fix,
    });
  }

  // Energy through eclipses
  const energyOk = a.batteryUsableWh >= a.eclipseEnergyNeedWh;
  const energyMargin =
    a.eclipseEnergyNeedWh > 0 ? a.batteryUsableWh / a.eclipseEnergyNeedWh - 1 : 1;
  items.push({
    id: 'energy',
    label: 'Battery covers eclipses',
    status: !energyOk ? 'red' : energyMargin < target ? 'yellow' : 'green',
    critical: fd,
    detail: `${Math.round(a.batteryUsableWh)} Wh usable for ${Math.round(a.eclipseEnergyNeedWh)} Wh per eclipse.`,
    fix:
      energyOk && energyMargin >= target
        ? null
        : 'Add battery capacity or choose an orbit with shorter eclipses.',
  });

  // Risk matrix
  const red = risks.filter((r) => r.level === 'red');
  const yellow = risks.filter((r) => r.level === 'yellow');
  items.push({
    id: 'risk',
    label: 'No red risks left unmitigated',
    status: red.length ? 'red' : yellow.length ? 'yellow' : 'green',
    critical: fd,
    detail:
      red.length || yellow.length
        ? [...red, ...yellow].map((r) => `${r.name} (score ${r.score})`).join('; ')
        : 'All risks are low or mitigated.',
    // List every red risk's fix at once, so players do not discover them one by one.
    fix: red.length
      ? `Mitigate: ${red.map((r) => `${r.name} → ${r.mitigation}`).join('; ')}.`
      : yellow[0]
        ? `Consider: ${yellow[0].mitigation}.`
        : null,
  });

  const greenFraction = items.filter((i) => i.status === 'green').length / items.length;
  const blockers = items.filter((i) => i.critical && i.status !== 'green');
  return {
    items,
    greenFraction,
    ready: greenFraction >= READINESS_THRESHOLD && blockers.length === 0,
    blockers,
  };
}
