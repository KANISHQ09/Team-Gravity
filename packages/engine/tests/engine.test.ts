import { designEditSchema, emptyDesign } from '@gravity/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildRiskMatrix,
  catalog,
  computeBudgets,
  createRng,
  evaluateReadiness,
  reviewDesign,
  runMission,
  simulate,
  traceability,
  validate,
} from '../src/index.ts';
import { BALANCE_DESIGNS, design } from './fixtures/designs.ts';

const lunar = BALANCE_DESIGNS['lunar-orbiter']![0]!.design;
const cubesat = BALANCE_DESIGNS['cubesat-earth-observer']![0]!.design;
const allDesigns = Object.values(BALANCE_DESIGNS).flatMap((list) => list.map((d) => d.design));

describe('prng', () => {
  it('is deterministic and uniform-ish', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 1000 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b.next()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('determinism (SRS-SIM-03) and numeric safety', () => {
  it('same design + seed gives an identical result, with no NaN anywhere', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allDesigns),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (d, seed) => {
          const first = runMission(d, seed);
          const second = runMission(d, seed);
          expect(second).toEqual(first);
          const json = JSON.stringify(first);
          expect(json).not.toContain('NaN');
          expect(json).not.toContain('null,"science":NaN');
          expect(first.run.science).toBeGreaterThanOrEqual(0);
          expect(first.run.science).toBeLessThanOrEqual(first.run.idealScience + 1e-6);
          expect(first.report.total).toBeGreaterThanOrEqual(0);
          expect(first.report.total).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('never throws on arbitrary part combinations (SRS-ERR: engine returns problems instead)', () => {
    const ids = catalog.parts.map((p) => p.id);
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ids), { maxLength: 14 }),
        fc.constantFrom(...catalog.orbits.map((o) => o.id), null),
        fc.constantFrom(...catalog.launchVehicles.map((v) => v.id), null),
        fc.integer({ min: 0, max: 1000 }),
        (partIds, orbitId, launchVehicleId, seed) => {
          const d = {
            ...emptyDesign('lunar-orbiter', 'engineer'),
            goalIds: ['moon-ice'],
            partIds,
            orbitId,
            launchVehicleId,
          };
          const review = reviewDesign(d);
          expect(review.gauges).toHaveLength(6);
          const { run } = runMission(d, seed);
          expect(Number.isFinite(run.science)).toBe(true);
        },
      ),
      { numRuns: 80 },
    );
  });
});

describe('balance: no single perfect design (SRS-SCR-06)', () => {
  for (const [scenarioId, list] of Object.entries(BALANCE_DESIGNS)) {
    it(`${scenarioId} has at least three launchable designs scoring ≥ 85 (median of 11 seeds)`, () => {
      expect(list.length).toBeGreaterThanOrEqual(3);
      for (const { name, design: d } of list) {
        expect(reviewDesign(d).canLaunch, name).toBe(true);
        const scores = Array.from(
          { length: 11 },
          (_, seed) => runMission(d, seed + 1).report.total,
        ).sort((x, y) => x - y);
        expect(scores[5], `${name}: ${scores.join(',')}`).toBeGreaterThanOrEqual(85);
      }
    });
  }
});

describe('budgets (SRS-DES-04/05)', () => {
  it('returns six gauges with limits, margins and contributors', () => {
    const gauges = computeBudgets(lunar, catalog);
    expect(gauges.map((g) => g.key)).toEqual(['mass', 'power', 'budget', 'data', 'comms', 'time']);
    const mass = gauges[0]!;
    expect(mass.limit).toBe(1500);
    expect(mass.contributors[0]?.name).toBe('Bipropellant engine');
    for (const g of gauges) expect(g.why.length).toBeGreaterThan(20);
  });

  it('marks the mass gauge unknown until a launch vehicle is chosen', () => {
    const g = computeBudgets({ ...lunar, launchVehicleId: null }, catalog)[0]!;
    expect(g.status).toBe('unknown');
    expect(g.fix).toMatch(/launch vehicle/i);
  });
});

describe('validation (SRS-LOR-03, SRS-EDU-03)', () => {
  it('states the exact mass deficit when the rocket is too small', () => {
    const issues = validate({ ...lunar, launchVehicleId: 'lv-small' }, catalog);
    const over = issues.find((i) => i.code === 'launch-overweight');
    expect(over?.severity).toBe('error');
    expect(over?.message).toBe('Over launch capacity by 834.0 kg');
    expect(over?.why).toContain('894.0 kg');
    expect(over?.fix.length).toBeGreaterThan(10);
  });

  it('reports a Δv shortfall in m/s', () => {
    const noEngine = { ...lunar, partIds: lunar.partIds.filter((p) => p !== 'prop-biprop') };
    const dv = validate(noEngine, catalog).find((i) => i.code === 'delta-v-short');
    expect(dv?.message).toBe('Δv short by 900 m/s');
  });

  it('explains uncovered goals and magnetorquers away from Earth', () => {
    const d = {
      ...lunar,
      partIds: lunar.partIds
        .map((p) => (p === 'adcs-wheels-redundant' ? 'adcs-magnetorquer' : p))
        .filter((p) => p !== 'inst-altimeter'),
    };
    const codes = validate(d, catalog).map((i) => i.code);
    expect(codes).toContain('goal-uncovered');
    expect(codes).toContain('magnetorquer-no-field');
  });

  it('blocks advanced parts on Explorer', () => {
    const d = { ...cubesat, partIds: [...cubesat.partIds, 'battery-l'] };
    expect(validate(d, catalog).some((i) => i.code === 'advanced-part')).toBe(true);
  });

  it('finds every problem in an empty design without throwing', () => {
    const issues = validate(emptyDesign('mars-orbiter', 'flight-director'), catalog);
    expect(issues.filter((i) => i.severity === 'error').length).toBeGreaterThanOrEqual(8);
  });
});

describe('requirements, traceability, risk and readiness', () => {
  it('builds a Science Traceability Matrix row per goal', () => {
    const rows = traceability(lunar, catalog);
    expect(rows.map((r) => r.measurement)).toEqual([
      'altimetry',
      'spectroscopy',
      'visible-imaging',
    ]);
    expect(rows[1]?.instruments).toEqual(['Imaging spectrometer']);
    expect(rows[0]?.requirementIds).toContain('REQ-SCI-1');
  });

  it('gives every requirement a verification method and a status', () => {
    const reqs = reviewDesign(lunar).requirements;
    expect(reqs.length).toBeGreaterThanOrEqual(12);
    for (const r of reqs) {
      expect(['test', 'analysis', 'inspection', 'demonstration']).toContain(r.verification);
      expect(['pass', 'fail', 'unknown']).toContain(r.status);
    }
  });

  it('lets a radiation-hardened computer mitigate solar storms', () => {
    const withCots = {
      ...lunar,
      partIds: lunar.partIds.map((p) => (p === 'computer-radhard' ? 'computer-std' : p)),
    };
    const spe = (d: typeof lunar) =>
      buildRiskMatrix(d, catalog).find((r) => r.type === 'solar-particle-event')!;
    expect(spe(lunar).mitigated).toBe(true);
    expect(spe(withCots).mitigated).toBe(false);
    expect(spe(withCots).score).toBeGreaterThan(spe(lunar).score);
  });

  it('gates launch at 80% green with every critical item green (SRS-CML-02)', () => {
    expect(evaluateReadiness(lunar, catalog).ready).toBe(true);
    const empty = evaluateReadiness(emptyDesign('lunar-orbiter', 'engineer'), catalog);
    expect(empty.ready).toBe(false);
    expect(empty.blockers.length).toBeGreaterThan(0);
    for (const item of empty.items.filter((i) => i.status !== 'green'))
      expect(item.fix).not.toBeNull();
  });
});

describe('simulation and scoring (SRS-SIM, SRS-SCR)', () => {
  it('runs all six phases for a good design', () => {
    const run = simulate(lunar, 7, catalog);
    expect(run.phasesCompleted).toBe(6);
    expect(run.samples.length).toBeGreaterThan(40);
    expect(['full', 'partial']).toContain(run.outcome);
  });

  it('fails at launch when the design cannot be launched', () => {
    const run = simulate({ ...lunar, launchVehicleId: 'lv-small' }, 1, catalog);
    expect(run.outcome).toBe('failure');
    expect(run.failurePhase).toBe('launch');
  });

  it('produces every random event type over many seeds', () => {
    const risky = {
      ...lunar,
      difficulty: 'flight-director' as const,
      partIds: lunar.partIds.map((p) =>
        p === 'computer-radhard'
          ? 'computer-std'
          : p === 'adcs-wheels-redundant'
            ? 'adcs-wheels'
            : p,
      ),
      mitigations: [],
    };
    const wanted = [
      'solar-particle-event',
      'reaction-wheel-failure',
      'launch-slip',
      'budget-cut',
      'antenna-anomaly',
      'battery-degradation',
    ];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400 && !wanted.every((t) => seen.has(t)); seed++) {
      for (const e of simulate(risky, seed, catalog).events) seen.add(e.type);
    }
    for (const t of wanted) expect(seen.has(t), t).toBe(true);
  });

  it('explains at least three causes and suggests valid edits', () => {
    const bad = design(
      'cubesat-earth-observer',
      'explorer',
      [
        'bus-cubesat-6u',
        'computer-cots',
        'battery-cube',
        'adcs-magnetorquer',
        'solar-cube-deploy',
        'antenna-uhf',
        'inst-multispectral-cube',
        'inst-camera-cube',
        'inst-radiation',
      ],
      'sso-550',
      'lv-rideshare',
    );
    const { run, report } = runMission(bad, 3);
    expect(run.losses.downlink).toBeGreaterThan(0);
    expect(run.losses.pointing).toBeGreaterThan(0);
    expect(report.causes.length).toBeGreaterThanOrEqual(3);
    expect(report.causes[0]).toMatch(/^Because /);
    expect(report.suggestions.length).toBeGreaterThan(0);
    for (const s of report.suggestions)
      if (s.edit) expect(designEditSchema.safeParse(s.edit).success).toBe(true);
    expect(report.total).toBeLessThan(runMission(cubesat, 3).report.total);
  });

  it('redistributes the collaboration points in solo play and scores them in co-op', () => {
    const solo = runMission(lunar, 5).report;
    expect(solo.breakdown.collaboration).toBeNull();
    const team = runMission(lunar, 5, {
      playerCount: 4,
      proposalsResolved: 4,
      noGoVotes: 0,
    }).report;
    expect(team.breakdown.collaboration?.points).toBe(15);
    expect(team.multiplier).toBe(1.15);
  });

  it('matches real NASA missions with similar measurements', () => {
    const { report } = runMission(lunar, 1);
    expect(report.analogs[0]?.name).toContain('Lunar Reconnaissance Orbiter');
    expect(report.analogs.every((a) => a.url.startsWith('https://science.nasa.gov/'))).toBe(true);
  });
});
