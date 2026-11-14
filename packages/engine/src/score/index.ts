import type { Analog, Catalog, DesignEdit, Measurement } from '@gravity/shared';
import { gaugesFromAnalysis } from '../budgets/index.ts';
import { type DesignAnalysis, analyzeDesign } from '../models/analysis.ts';
import { DIFFICULTY_MULTIPLIER } from '../models/constants.ts';
import { readinessFromAnalysis } from '../readiness/index.ts';
import { mitigationFacts } from '../readiness/risk.ts';
import type { LossCause, RunResult } from '../simulate/index.ts';

/** Co-op facts that feed the collaboration score. Omit for solo play. */
export interface TeamInfo {
  readonly playerCount: number;
  /** Proposals the team accepted or rejected (both count: they were discussed). */
  readonly proposalsResolved: number;
  /** NO-GO votes cast before the final unanimous GO. */
  readonly noGoVotes: number;
}

export interface ScoreComponent {
  readonly points: number;
  readonly max: number;
  readonly note: string;
}

export interface Suggestion {
  readonly text: string;
  /** Pre-filled change for "Try changing…" (SRS-SCR-05), when one exact edit fixes it. */
  readonly edit?: DesignEdit;
}

export interface ScoreReport {
  /** Displayed score, 0–100 (capped). */
  readonly total: number;
  /** Uncapped score after the difficulty multiplier. */
  readonly raw: number;
  readonly multiplier: number;
  readonly outcome: RunResult['outcome'];
  readonly breakdown: {
    readonly performance: ScoreComponent;
    readonly science: ScoreComponent;
    readonly efficiency: ScoreComponent;
    readonly decisions: ScoreComponent;
    /** null in solo play: its 15 points are redistributed across the others. */
    readonly collaboration: ScoreComponent | null;
  };
  /** At least three "Because X, Y happened, which Z" statements (SRS-SCR-04). */
  readonly causes: readonly string[];
  readonly suggestions: readonly Suggestion[];
  readonly analogs: readonly Analog[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Lower-cases only a leading ASCII capital, so "Δv margin" keeps its Δ. */
const lowerFirst = (s: string) =>
  /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Score a finished run (SRS-SCR-01…06). Pure: the server recomputes it to stop cheating. */
export function score(run: RunResult, catalog: Catalog, team?: TeamInfo): ScoreReport {
  const a = analyzeDesign(run.design, catalog);
  const coop = team !== undefined && team.playerCount > 1;

  // Mission performance (30): phases completed + goals met.
  const goalsMet = run.goalScience.filter((g) => g.met).length;
  const goalShare = a.resolved.scenario.goals.length
    ? goalsMet / a.resolved.scenario.goals.length
    : 0;
  const performance = 30 * (0.5 * (run.phasesCompleted / 6) + 0.5 * goalShare);

  // Science value (25): science returned vs Baseline.
  const science = 25 * clamp01(run.science / run.baselineScience);

  // Resource efficiency (15): healthy margins score best; over-limit and gross over-design lose points.
  const gauges = gaugesFromAnalysis(a);
  const gaugeScore = (margin: number | null, target: number, over: boolean) => {
    if (over) return 0;
    if (margin === null) return 0.5;
    if (margin < target) return 0.8 * clamp01(margin / Math.max(target, 0.01));
    if (margin <= 0.6) return 1;
    return 1 - 0.5 * clamp01((margin - 0.6) / 0.4);
  };
  const efficiency =
    (15 * gauges.reduce((s, g) => s + gaugeScore(g.margin, g.target, g.status === 'over'), 0)) /
    gauges.length;

  // Decision quality (15): readiness at launch + how many bad events your choices softened.
  const readiness = readinessFromAnalysis(a);
  const mitigable = run.events.filter((e) => e.mitigable);
  const mitigatedRatio = mitigable.length
    ? mitigable.filter((e) => e.mitigated).length / mitigable.length
    : 1;
  const decisions = 15 * (0.6 * readiness.greenFraction + 0.4 * mitigatedRatio);

  // Team collaboration (15, co-op only).
  const collaboration = coop
    ? 15 *
      clamp01(
        0.7 + 0.3 * Math.min(1, team.proposalsResolved / team.playerCount) - 0.05 * team.noGoVotes,
      )
    : null;

  const sumWithoutTeam = performance + science + efficiency + decisions;
  const base =
    collaboration === null ? (sumWithoutTeam * 100) / 85 : sumWithoutTeam + collaboration;
  const multiplier = DIFFICULTY_MULTIPLIER[run.design.difficulty];
  const raw = base * multiplier;

  return {
    total: Math.min(100, Math.round(raw)),
    raw: r1(raw),
    multiplier,
    outcome: run.outcome,
    breakdown: {
      performance: {
        points: r1(performance),
        max: 30,
        note: `${run.phasesCompleted}/6 phases completed, ${goalsMet}/${a.resolved.scenario.goals.length} goals met.`,
      },
      science: {
        points: r1(science),
        max: 25,
        note: `${Math.round(run.science)} of ${run.baselineScience} Baseline science points returned.`,
      },
      efficiency: {
        points: r1(efficiency),
        max: 15,
        note: `${gauges.filter((g) => g.status === 'ok').length}/6 resources with a healthy margin.`,
      },
      decisions: {
        points: r1(decisions),
        max: 15,
        note: `Readiness ${Math.round(readiness.greenFraction * 100)}% green; ${mitigable.filter((e) => e.mitigated).length}/${mitigable.length} events softened by your choices.`,
      },
      collaboration:
        collaboration === null
          ? null
          : {
              points: r1(collaboration),
              max: 15,
              note: `${team!.proposalsResolved} proposals discussed, ${team!.noGoVotes} NO-GO votes before launch.`,
            },
    },
    causes: buildCauses(run, a),
    suggestions: buildSuggestions(run, a, catalog),
    analogs: matchAnalogs(run.design.goalIds, a, catalog),
  };
}

const LOSS_TEXT: Record<LossCause, (a: DesignAnalysis) => string> = {
  downlink: (a) =>
    `your antenna could send only ${a.downlinkGbitPerDay.toFixed(1)} of the ${a.dataGeneratedGbitPerDay.toFixed(1)} Gbit your instruments made each day, so data piled up and was lost`,
  storage: () => 'the data recorder filled up between ground contacts, so new data was overwritten',
  power: (a) =>
    `the solar array made only ${Math.round(a.powerGenerationW)} W for ${Math.round(a.powerConsumptionW)} W of equipment, so instruments ran part-time`,
  battery: () => 'the battery could not cover every eclipse, so instruments paused in shadow',
  'safe-mode': () => 'solar storms crashed the computer and sent the spacecraft into safe mode',
  'instrument-lost': () =>
    'instruments failed or were removed, so their goals stopped collecting data',
  pointing: () => 'pointing was too rough for sharp images, which halved imaging science',
  'orbit-mapping': (a) =>
    `${a.resolved.orbit?.name ?? 'the orbit'} keeps the spacecraft far from the surface or in poor light, so mapping instruments returned less`,
  insertion: () => 'the thin Δv margin left the spacecraft in a higher orbit than planned',
};

function buildCauses(run: RunResult, a: DesignAnalysis): string[] {
  const causes: string[] = [];
  if (run.failureReason && run.failurePhase && run.failurePhase !== 'science') {
    const ev = [...run.events].reverse().find((e) => !e.mitigated);
    causes.push(
      `Because ${ev ? ev.effect.charAt(0).toLowerCase() + ev.effect.slice(1).replace(/\.$/, '') : run.failureReason.toLowerCase()}, the mission ended in the ${run.failurePhase} phase.`,
    );
  }
  const losses = (Object.entries(run.losses) as [LossCause, number][])
    .filter(([, v]) => v >= 1)
    .sort((x, y) => y[1] - x[1]);
  for (const [cause, lost] of losses) {
    const pct = run.idealScience > 0 ? Math.round((lost / run.idealScience) * 100) : 0;
    causes.push(
      `Because ${LOSS_TEXT[cause](a)}, the mission lost ${Math.round(lost)} science points (${pct}% of its potential).`,
    );
  }
  const mitigated = run.events
    .filter((x) => x.mitigated && x.mitigatedBy)
    .sort((x, y) => x.day - y.day);
  for (const e of mitigated) {
    if (causes.length >= 6) break;
    const when = e.day < 0 ? `${-e.day} days before launch` : `on day ${e.day}`;
    causes.push(
      `Because of your ${lowerFirst(e.mitigatedBy!)}, the ${lowerFirst(e.title)} ${when} did no lasting harm.`,
    );
  }
  // Always explain at least three outcomes (SRS-SCR-04).
  const fallback = [
    `Because your instruments covered ${run.goalScience.filter((g) => g.met).length} of ${run.goalScience.length} selected goals with enough data, those goals were met.`,
    `Because your design generated ${Math.round(a.powerGenerationW)} W for ${Math.round(a.powerConsumptionW)} W of equipment, power ${a.powerGenerationW >= a.powerConsumptionW ? 'never limited' : 'limited'} the instruments.`,
    `Because you used ${a.resolved.design.groundStations} ground station${a.resolved.design.groundStations > 1 ? 's' : ''}, about ${Math.round(run.dataReturnedGbit)} Gbit of science data reached Earth.`,
  ];
  for (const f of fallback) if (causes.length < 3) causes.push(f);
  return causes;
}

function buildSuggestions(run: RunResult, a: DesignAnalysis, catalog: Catalog): Suggestion[] {
  const { design, scenario, parts } = a.resolved;
  const out: Suggestion[] = [];
  const top = (Object.entries(run.losses) as [LossCause, number][])
    .filter(([, v]) => v >= 1)
    .sort((x, y) => y[1] - x[1])
    .map(([c]) => c);
  const has = (id: string) => parts.some((p) => p.id === id);
  for (const cause of top) {
    if (cause === 'downlink' && design.groundStations < 3) {
      out.push({
        text: 'Add a ground station to double your contact time (or fit a higher-gain antenna).',
        edit: { type: 'setGroundStations', count: design.groundStations + 1 },
      });
    } else if (cause === 'storage' && !has('computer-radhard')) {
      out.push({
        text: 'Fit the radiation-hardened computer: it has a 512 Gbit recorder.',
        edit: { type: 'addPart', partId: 'computer-radhard', category: 'computer' },
      });
    } else if (cause === 'power') {
      out.push({ text: 'Add a larger solar array so instruments can run all the time.' });
    } else if (cause === 'battery') {
      out.push({ text: 'Add battery capacity to ride through eclipses and battery wear.' });
    } else if (cause === 'safe-mode' && !has('computer-radhard')) {
      out.push({
        text: 'Use the radiation-hardened computer so solar storms cannot crash it.',
        edit: { type: 'addPart', partId: 'computer-radhard', category: 'computer' },
      });
    } else if (cause === 'pointing' && !has('adcs-wheels-redundant')) {
      out.push({
        text: 'Use reaction wheels with a spare to keep pointing precise.',
        edit: { type: 'addPart', partId: 'adcs-wheels-redundant', category: 'adcs' },
      });
    } else if (cause === 'orbit-mapping') {
      const best = catalog.orbits
        .filter((o) => scenario.allowedOrbitIds.includes(o.id))
        .sort(
          (x, y) => y.mappingQuality - x.mappingQuality || x.deltaVRequiredMs - y.deltaVRequiredMs,
        )[0];
      if (best && best.id !== design.orbitId) {
        out.push({
          text: `Try ${best.name}: it maps the surface better (check your Δv first).`,
          edit: { type: 'setOrbit', orbitId: best.id },
        });
      }
    } else if (cause === 'instrument-lost' && !design.mitigations.includes('extra-testing')) {
      out.push({
        text: 'Buy extra testing to catch early instrument failures before launch.',
        edit: { type: 'setMitigations', mitigations: [...design.mitigations, 'extra-testing'] },
      });
    } else if (cause === 'insertion') {
      out.push({ text: 'Carry more fuel: keep at least 10% Δv margin for navigation errors.' });
    }
  }
  if (
    run.events.some((e) => e.type === 'budget-cut' && !e.mitigated) &&
    !design.mitigations.includes('budget-reserve')
  ) {
    out.push({
      text: 'Keep a budget reserve so a cut does not remove an instrument.',
      edit: { type: 'setMitigations', mitigations: [...design.mitigations, 'budget-reserve'] },
    });
  }
  if (
    run.events.some((e) => e.type === 'launch-slip' && !e.mitigated) &&
    !design.mitigations.includes('schedule-margin')
  ) {
    out.push({
      text: 'Add schedule margin so testing delays do not push the launch.',
      edit: { type: 'setMitigations', mitigations: [...design.mitigations, 'schedule-margin'] },
    });
  }
  const m = mitigationFacts(a);
  if (out.length === 0 && !m.redundantWheels) {
    out.push({
      text: 'Your mission went well. For more safety, try reaction wheels with a spare.',
      edit: { type: 'addPart', partId: 'adcs-wheels-redundant', category: 'adcs' },
    });
  }
  return out.slice(0, 5);
}

/** Real NASA missions with similar targets and measurements (SRS-ANA-01). */
export function matchAnalogs(
  goalIds: readonly string[],
  a: DesignAnalysis,
  catalog: Catalog,
): Analog[] {
  const wanted = new Set<Measurement>(
    a.resolved.scenario.goals.filter((g) => goalIds.includes(g.id)).map((g) => g.measurement),
  );
  return catalog.analogs
    .map((an) => ({
      an,
      score:
        (an.body === a.resolved.scenario.body ? 10 : 0) +
        an.measures.filter((x) => wanted.has(x)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.an.launchYear - y.an.launchYear)
    .slice(0, 2)
    .map((x) => x.an);
}
