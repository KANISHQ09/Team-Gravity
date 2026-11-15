import {
  type Catalog,
  type Design,
  type DesignEdit,
  type Mitigation,
  type Part,
  type PartCategory,
  applyEdit,
} from '@gravity/shared';
import { gaugesFromAnalysis } from '../budgets/index.ts';
import { analyzeDesign } from '../models/analysis.ts';
import { REQUIRED_LINK_MARGIN_DB } from '../models/constants.ts';
import { hasBlockingErrors, validateAnalysis } from '../validate/index.ts';
import { readinessFromAnalysis } from './index.ts';
import { risksFromAnalysis } from './risk.ts';

/** One change the auto-fix made, explained in plain language. */
export interface FixStep {
  readonly title: string;
  /** Problems this change cleared. */
  readonly fixed: readonly string[];
  readonly edits: readonly DesignEdit[];
}

export interface AutoFixResult {
  readonly design: Design;
  readonly steps: readonly FixStep[];
  readonly launchable: boolean;
  /** Problems still left (empty when everything could be fixed). */
  readonly remaining: readonly string[];
}

const MITIGATION_NAME: Record<Mitigation, string> = {
  'budget-reserve': 'a budget reserve',
  'schedule-margin': 'schedule margin',
  'extra-testing': 'extra testing',
};

/** Categories with exactly one useful item (swap rather than stack). */
const SINGLE: readonly PartCategory[] = ['bus', 'computer', 'adcs', 'propulsion'];
/** Categories where a second item can help (more power, storage or links). */
const STACKABLE: readonly PartCategory[] = ['solar', 'battery', 'antenna'];

/** Starting spacecraft for each size class, used only for categories that are missing. */
const TEMPLATE: Record<'cube' | 'medium', Partial<Record<PartCategory, string>>> = {
  cube: {
    bus: 'bus-cubesat-6u',
    solar: 'solar-cube-deploy',
    battery: 'battery-cube',
    antenna: 'antenna-sband-patch',
    computer: 'computer-cots',
    adcs: 'adcs-cube-wheels',
  },
  medium: {
    bus: 'bus-medium',
    solar: 'solar-deploy-m',
    battery: 'battery-m',
    antenna: 'antenna-mga',
    computer: 'computer-std',
    adcs: 'adcs-wheels',
  },
};

const MAX_REPAIRS = 20;

interface Evaluation {
  readonly badness: number;
  readonly costM: number;
  readonly launchable: boolean;
  readonly problems: readonly string[];
}

/**
 * How far a design is from launch-ready. Blocking errors dominate, then the
 * readiness review, then gauges. Cost is kept apart: it only breaks ties, so the
 * fix never downgrades a part just to save money.
 */
function evaluate(design: Design, catalog: Catalog): Evaluation {
  const a = analyzeDesign(design, catalog);
  const issues = validateAnalysis(a);
  const readiness = readinessFromAnalysis(a);
  const errors = issues.filter((i) => i.severity === 'error');
  const launchable = !hasBlockingErrors(issues) && readiness.ready;
  let badness = errors.length * 100 + (launchable ? 0 : 40);
  const problems = errors.map((i) => i.message);
  for (const item of readiness.items) {
    if (item.status === 'red') {
      badness += item.critical ? 30 : 8;
      problems.push(item.label);
    } else if (item.status === 'yellow') {
      badness += item.critical ? 6 : 2;
      if (item.critical) problems.push(item.label);
    }
  }
  if (!launchable && errors.length === 0 && readiness.blockers.length === 0) {
    problems.push('Readiness review below 80% green');
  }
  for (const g of gaugesFromAnalysis(a)) {
    if (g.status === 'over' || g.status === 'unknown') badness += 8;
    else if (g.status === 'warning') badness += 3;
    // Closer to the target margin counts as progress, even before the gauge turns green.
    if (g.key !== 'comms' && g.margin !== null && g.margin < g.target) {
      badness += 20 * (g.target - Math.max(-1, g.margin));
    }
  }
  // Communications is judged in decibels (downlink at least twice the data).
  if (a.linkMarginDb < REQUIRED_LINK_MARGIN_DB.value) {
    badness += 5 * (REQUIRED_LINK_MARGIN_DB.value - Math.max(-10, a.linkMarginDb));
  }
  // Each risk counts on its own, so mitigating one is progress even if the
  // risk check as a whole is still yellow.
  for (const r of risksFromAnalysis(a))
    badness += r.level === 'red' ? 8 : r.level === 'yellow' ? 3 : 0;
  return { badness, costM: a.costM, launchable, problems: [...new Set(problems)] };
}

interface Candidate {
  readonly title: string;
  readonly edits: DesignEdit[];
  /** Small penalty for overriding a choice the player made (their orbit). */
  readonly penalty: number;
}

/** Every sensible single change for the repair phase. */
function candidates(design: Design, catalog: Catalog): Candidate[] {
  const out: Candidate[] = [];
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId);
  if (!scenario) return out;
  const partById = (id: string) => catalog.parts.find((p) => p.id === id);
  const current = design.partIds.map(partById).filter((p): p is Part => !!p);
  const cube = current.some((p) => p.id === 'bus-cubesat-6u');
  const hasBus = current.some((p) => p.category === 'bus');
  // CubeSat-sized subsystems (power, battery, computer, wheels) only make sense on a
  // CubeSat bus; small instruments can fly on any spacecraft.
  const cubeOnly = (p: Part) =>
    /-cube/.test(p.id) && ['solar', 'battery', 'computer', 'adcs'].includes(p.category);
  const allowed = (p: Part) =>
    !(p.advanced && design.difficulty === 'explorer') && !(hasBus && !cube && cubeOnly(p));
  const ofCategory = (c: PartCategory) => current.filter((p) => p.category === c);

  for (const orbitId of scenario.allowedOrbitIds) {
    if (orbitId === design.orbitId) continue;
    const orbit = catalog.orbits.find((o) => o.id === orbitId);
    if (orbit) {
      out.push({
        title: `Fly in ${orbit.name}`,
        edits: [{ type: 'setOrbit', orbitId }],
        penalty: 4,
      });
    }
  }
  for (const lv of catalog.launchVehicles) {
    if (lv.id === design.launchVehicleId) continue;
    out.push({
      title: `Launch on the ${lv.name}`,
      edits: [{ type: 'setLaunchVehicle', launchVehicleId: lv.id }],
      penalty: 0,
    });
  }
  for (const category of [...SINGLE, ...STACKABLE]) {
    const have = ofCategory(category);
    for (const p of catalog.parts.filter((x) => x.category === category && allowed(x))) {
      // A second array, battery or antenna (even the same model) can be the fix.
      if (STACKABLE.includes(category) && have.length > 0 && have.length < 3) {
        out.push({
          title: `Add another ${p.name}`,
          edits: [{ type: 'addPart', partId: p.id, category }],
          penalty: 0,
        });
      }
      if (have.length === 1 && have[0]!.id === p.id) continue;
      const removeAll: DesignEdit[] = have.map((h) => ({
        type: 'removePart',
        partId: h.id,
        category,
      }));
      out.push({
        title: have.length
          ? `Swap the ${have.map((h) => h.name).join(' and ')} for the ${p.name}`
          : `Add the ${p.name}`,
        edits: [...removeAll, { type: 'addPart', partId: p.id, category }],
        penalty: 0,
      });
    }
  }
  // Swap an instrument for another that serves the same goal (e.g. less data, less mass).
  for (const p of current.filter((x) => x.category === 'instrument')) {
    for (const q of catalog.parts.filter(
      (x) =>
        x.category === 'instrument' &&
        x.id !== p.id &&
        allowed(x) &&
        (x.measures ?? []).some((m) => p.measures?.includes(m)),
    )) {
      out.push({
        title: `Swap the ${p.name} for the ${q.name}`,
        edits: [
          { type: 'removePart', partId: p.id, category: 'instrument' },
          { type: 'addPart', partId: q.id, category: 'instrument' },
        ],
        penalty: 2,
      });
    }
  }
  for (const p of current) {
    if (!allowed(p)) {
      out.push({
        title: `Remove the ${p.name} (advanced part)`,
        edits: [{ type: 'removePart', partId: p.id, category: p.category }],
        penalty: 0,
      });
    }
  }
  if (design.groundStations < 3) {
    out.push({
      title: `Use ${design.groundStations + 1} ground stations`,
      edits: [{ type: 'setGroundStations', count: design.groundStations + 1 }],
      penalty: 0,
    });
  }
  if (design.groundStations > 1) {
    out.push({
      title: `Use ${design.groundStations - 1} ground station${design.groundStations - 1 > 1 ? 's' : ''} to save money`,
      edits: [{ type: 'setGroundStations', count: design.groundStations - 1 }],
      penalty: 1,
    });
  }
  for (const m of design.mitigations) {
    out.push({
      title: `Drop ${MITIGATION_NAME[m]} to save money`,
      edits: [{ type: 'setMitigations', mitigations: design.mitigations.filter((x) => x !== m) }],
      penalty: 1,
    });
  }
  for (const m of Object.keys(MITIGATION_NAME) as Mitigation[]) {
    if (design.mitigations.includes(m)) continue;
    out.push({
      title: `Add ${MITIGATION_NAME[m]}`,
      edits: [{ type: 'setMitigations', mitigations: [...design.mitigations, m] }],
      penalty: 0,
    });
  }
  return out;
}

/**
 * Repair a design until it can launch, in two phases:
 * 1. build what is missing (goals, orbit, a spacecraft sized for the mission
 *    budget, an instrument per goal, enough Δv, a rocket that can lift it);
 * 2. repair what is left, one change at a time, keeping only changes that
 *    clear a problem (cheapest first). Deterministic; every step is explained.
 */
export function autoFix(design: Design, catalog: Catalog): AutoFixResult {
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId);
  let d = design;
  let current = evaluate(d, catalog);
  const steps: FixStep[] = [];
  const apply = (title: string, edits: DesignEdit[]) => {
    if (edits.length === 0) return;
    const next = edits.reduce(applyEdit, d);
    const e = evaluate(next, catalog);
    steps.push({ title, fixed: current.problems.filter((p) => !e.problems.includes(p)), edits });
    d = next;
    current = e;
  };
  if (!scenario) return { design, steps, launchable: false, remaining: current.problems };
  // Already launch-ready: nothing to fix, and the player's choices stand.
  if (current.launchable) return { design, steps, launchable: true, remaining: [] };

  const allowed = (p: Part) => !(p.advanced && d.difficulty === 'explorer');
  const partById = (id: string) => catalog.parts.find((p) => p.id === id);
  const fitted = () => d.partIds.map(partById).filter((p): p is Part => !!p);
  const has = (c: PartCategory) => fitted().some((p) => p.category === c);

  // ---- Phase 1: build what is missing ----
  if (d.goalIds.length === 0) {
    apply('Select all the science goals', [
      { type: 'setGoals', goalIds: scenario.goals.map((g) => g.id) },
    ]);
  }
  if (!d.orbitId || !scenario.allowedOrbitIds.includes(d.orbitId)) {
    const orbit = catalog.orbits
      .filter((o) => scenario.allowedOrbitIds.includes(o.id))
      .sort(
        (x, y) => y.mappingQuality - x.mappingQuality || x.deltaVRequiredMs - y.deltaVRequiredMs,
      )[0];
    if (orbit) apply(`Fly in ${orbit.name}`, [{ type: 'setOrbit', orbitId: orbit.id }]);
  }
  const bus = fitted().find((p) => p.category === 'bus');
  const size: 'cube' | 'medium' =
    bus?.id === 'bus-cubesat-6u' || (!bus && scenario.budgetM <= 20) ? 'cube' : 'medium';
  const template: Partial<Record<PartCategory, string>> = {
    ...TEMPLATE[size],
    // Deep space needs the big dish to talk to Earth.
    ...(size === 'medium' && scenario.body === 'mars' ? { antenna: 'antenna-hga' } : {}),
  };
  for (const [category, id] of Object.entries(template) as [PartCategory, string][]) {
    const p = partById(id);
    if (p && !has(category) && allowed(p)) {
      apply(`Add the ${p.name}`, [{ type: 'addPart', partId: p.id, category }]);
    }
  }
  for (const goal of scenario.goals.filter((g) => d.goalIds.includes(g.id))) {
    if (fitted().some((p) => p.measures?.includes(goal.measurement))) continue;
    const options = catalog.parts
      .filter(
        (p) => p.category === 'instrument' && allowed(p) && p.measures?.includes(goal.measurement),
      )
      // CubeSats take the lightest option; bigger craft take the best science.
      .sort((x, y) =>
        size === 'cube' ? x.massKg - y.massKg : (y.scienceValue ?? 0) - (x.scienceValue ?? 0),
      );
    const p = options[0];
    if (p) {
      apply(`Add the ${p.name} to "${goal.title.toLowerCase()}"`, [
        { type: 'addPart', partId: p.id, category: 'instrument' },
      ]);
    }
  }
  const before = analyzeDesign(d, catalog);
  if (before.deltaVAvailableMs < before.deltaVRequiredMs) {
    const have = fitted().filter((p) => p.category === 'propulsion');
    const remove: DesignEdit[] = have.map((h) => ({
      type: 'removePart',
      partId: h.id,
      category: 'propulsion',
    }));
    const engine = catalog.parts
      .filter((p) => p.category === 'propulsion' && allowed(p))
      .sort((x, y) => x.massKg - y.massKg)
      .find((p) => {
        const edits: DesignEdit[] = [
          ...remove,
          { type: 'addPart', partId: p.id, category: 'propulsion' },
        ];
        const a = analyzeDesign(edits.reduce(applyEdit, d), catalog);
        return a.deltaVAvailableMs >= a.deltaVRequiredMs * 1.1;
      });
    if (engine) {
      apply(
        have.length
          ? `Swap in the ${engine.name} for enough Δv`
          : `Add the ${engine.name} for enough Δv`,
        [...remove, { type: 'addPart', partId: engine.id, category: 'propulsion' }],
      );
    }
  }
  const liftable = catalog.launchVehicles
    .slice()
    .sort((x, y) => x.costM - y.costM)
    .find((lv) => {
      const e = evaluate(
        applyEdit(d, { type: 'setLaunchVehicle', launchVehicleId: lv.id }),
        catalog,
      );
      return !e.problems.some((p) => /launch|capacity|Mass margin/i.test(p));
    });
  if (liftable && liftable.id !== d.launchVehicleId) {
    apply(`Launch on the ${liftable.name}`, [
      { type: 'setLaunchVehicle', launchVehicleId: liftable.id },
    ]);
  }

  // ---- Phase 2: repair what is left, one change at a time ----
  const tieBreak = (e: Evaluation) => e.costM / Math.max(1, scenario.budgetM);
  // A design that can already launch is left alone: the player's choices stand.
  for (let i = 0; i < MAX_REPAIRS && !current.launchable; i++) {
    const scored = candidates(d, catalog)
      .map((c) => {
        const e = evaluate(c.edits.reduce(applyEdit, d), catalog);
        return { c, e, score: e.badness + c.penalty + tieBreak(e) };
      })
      .sort((x, y) => x.score - y.score);
    const best = scored[0];
    if (best && best.e.badness + best.c.penalty <= current.badness - 0.5) {
      apply(best.c.title, best.c.edits);
      continue;
    }
    // No single change helps: look two changes ahead among the most promising ones.
    let pair: { a: Candidate; b: Candidate; score: number; badness: number } | null = null;
    const top = scored.slice(0, 12);
    for (const x of top) {
      const afterX = x.c.edits.reduce(applyEdit, d);
      for (const y of candidates(afterX, catalog).slice(0, 80)) {
        const e = evaluate(y.edits.reduce(applyEdit, afterX), catalog);
        const badness = e.badness + x.c.penalty + y.penalty;
        const score = badness + tieBreak(e);
        if (!pair || score < pair.score) pair = { a: x.c, b: y, score, badness };
      }
    }
    if (!pair || pair.badness > current.badness - 0.5) break;
    apply(pair.a.title, pair.a.edits);
    apply(pair.b.title, pair.b.edits);
  }
  if (!current.launchable && design.partIds.length > 0) {
    // Repairs got stuck (the design is far from a working one): rebuild the spacecraft
    // from a clean sheet, keeping the player's goals and orbit.
    const clean: Design = { ...design, partIds: [], launchVehicleId: null, mitigations: [] };
    const fresh = autoFix(clean, catalog);
    if (fresh.launchable) {
      const reset: DesignEdit[] = [
        ...design.partIds.map((id): DesignEdit => ({
          type: 'removePart',
          partId: id,
          category: partById(id)?.category ?? 'instrument',
        })),
        { type: 'setLaunchVehicle', launchVehicleId: null },
        { type: 'setMitigations', mitigations: [] },
      ];
      return {
        design: fresh.design,
        steps: [
          {
            title: 'Start the spacecraft again from a clean sheet (your goals and orbit stay)',
            fixed: [],
            edits: reset,
          },
          ...fresh.steps,
        ],
        launchable: true,
        remaining: [],
      };
    }
  }
  return { design: d, steps, launchable: current.launchable, remaining: current.problems };
}
