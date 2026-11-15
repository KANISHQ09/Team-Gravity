import { applyEdit, designEditSchema, emptyDesign } from '@gravity/shared';
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
import { BALANCE_DESIGNS, FLIGHT_DIRECTOR_CUBESAT, design } from './fixtures/designs.ts';

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

describe('sensitivity (SRS-TRD-02)', () => {
  it('ranks single changes by their effect on science, deterministically', async () => {
    const { sensitivity } = await import('../src/index.ts');
    const first = sensitivity(lunar, catalog);
    expect(sensitivity(lunar, catalog)).toEqual(first);
    expect(first.baseScience).toBeGreaterThan(0);
    const labels = first.rows.map((r) => r.label);
    expect(labels).toContain('Use 2 ground stations');
    expect(labels).toContain('Remove the High-resolution camera');
    // Launchable changes first, each group sorted by size of effect.
    const firstBlocked = first.rows.findIndex((r) => !r.launchable);
    const ok = firstBlocked < 0 ? first.rows : first.rows.slice(0, firstBlocked);
    expect(first.rows.slice(ok.length).every((r) => !r.launchable)).toBe(true);
    const sizes = ok.map((r) => Math.abs(r.scienceDelta));
    expect(sizes).toEqual([...sizes].sort((x, y) => y - x));
    // Removing an instrument lowers science and saves money.
    const remove = first.rows.find((r) => r.label === 'Remove the Imaging spectrometer')!;
    expect(remove.scienceDelta).toBeLessThan(0);
    expect(remove.costDeltaM).toBeLessThan(0);
  });

  it('explains why a what-if change would block the launch', async () => {
    const { sensitivity } = await import('../src/index.ts');
    // The walkthrough CubeSat: one instrument per goal, so removing any one leaves a goal uncovered.
    const rows = sensitivity(cubesat, catalog).rows;
    const remove = rows.find((r) => r.label === 'Remove the CubeSat camera')!;
    expect(remove.launchable).toBe(false);
    expect(remove.blockedBy).toMatch(/goal|instrument/i);
    expect(rows.filter((r) => r.launchable).every((r) => r.blockedBy === null)).toBe(true);
    expect(rows.at(-1)?.launchable).toBe(false);
  });
});

describe('every scenario is winnable at every difficulty', () => {
  const difficulties = ['explorer', 'engineer', 'flight-director'] as const;
  for (const [scenarioId, list] of Object.entries(BALANCE_DESIGNS)) {
    for (const difficulty of difficulties) {
      it(`${scenarioId} @ ${difficulty} has a launchable design with a median score ≥ 85`, () => {
        const candidates = [
          ...list.map((x) => ({ ...x.design, difficulty })),
          ...(scenarioId === 'cubesat-earth-observer'
            ? [{ ...FLIGHT_DIRECTOR_CUBESAT, difficulty }]
            : []),
        ];
        const winners = candidates.filter((d) => {
          if (!reviewDesign(d).canLaunch) return false;
          const s = Array.from({ length: 11 }, (_, k) => runMission(d, k + 1).report.total).sort(
            (a, b) => a - b,
          );
          return s[5]! >= 85;
        });
        expect(winners.length).toBeGreaterThanOrEqual(1);
      });
    }
  }
});

describe('"Try changing…" suggestions (SRS-SCR-05)', () => {
  const launchable = (d: Parameters<typeof validate>[0]) =>
    !validate(d, catalog).some((i) => i.severity === 'error');

  it('never offer a one-click change that blocks a launchable design', () => {
    // The CubeSat from the demo: magnetorquers only, rideshare launch with little spare mass.
    const demoCubesat = design(
      'cubesat-earth-observer',
      'explorer',
      [
        'bus-cubesat-6u',
        'solar-cube-deploy',
        'battery-cube',
        'antenna-sband-patch',
        'computer-cots',
        'adcs-magnetorquer',
        'inst-multispectral-cube',
        'inst-camera-cube',
      ],
      'sso-550',
      'lv-rideshare',
      {},
      ['eo-land', 'eo-coast'],
    );
    expect(launchable(demoCubesat)).toBe(true);
    for (const d of [demoCubesat, ...allDesigns]) {
      for (const seed of [1, 7, 42, 99, 1234]) {
        for (const sg of runMission(d, seed).report.suggestions) {
          if (sg.edit) expect(launchable(applyEdit(d, sg.edit)), sg.text).toBe(true);
        }
      }
    }
  });

  it('suggests CubeSat-sized wheels when pointing is too rough on a CubeSat', () => {
    const d = design(
      'cubesat-earth-observer',
      'explorer',
      [
        'bus-cubesat-6u',
        'solar-cube-deploy',
        'battery-cube',
        'antenna-sband-patch',
        'computer-cots',
        'adcs-magnetorquer',
        'inst-multispectral-cube',
        'inst-camera-cube',
      ],
      'sso-550',
      'lv-rideshare',
      {},
      ['eo-land', 'eo-coast'],
    );
    const edits = runMission(d, 1).report.suggestions.flatMap((s) => (s.edit ? [s.edit] : []));
    expect(edits).toContainEqual({ type: 'addPart', partId: 'adcs-cube-wheels', category: 'adcs' });
  });
});

describe('difficulty levels', () => {
  const levels = ['explorer', 'engineer', 'flight-director'] as const;

  it('power requirement and power gauge agree at every difficulty', () => {
    for (const d of allDesigns) {
      for (const difficulty of levels) {
        const r = reviewDesign({ ...d, difficulty });
        const req = r.requirements.find((q) => q.id === 'REQ-PWR-1')!;
        const gauge = r.gauges.find((g) => g.key === 'power')!;
        if (gauge.margin === null) continue;
        expect(req.status === 'pass', `${d.scenarioId} ${difficulty}`).toBe(
          gauge.margin >= gauge.target - 1e-9,
        );
      }
    }
  });

  it('harder levels bring more random events and a bigger score multiplier', () => {
    const counts = levels.map((difficulty) => {
      let events = 0;
      for (let seed = 1; seed <= 60; seed++)
        events += runMission({ ...cubesat, difficulty }, seed).run.events.length;
      return events;
    });
    expect(counts[0]).toBeLessThan(counts[1]!);
    expect(counts[1]).toBeLessThan(counts[2]!);
    const mult = levels.map(
      (difficulty) => runMission({ ...cubesat, difficulty }, 1).report.multiplier,
    );
    expect(mult).toEqual([1, 1.15, 1.3]);
  });

  it('Flight Director lists every red risk fix, sized for a CubeSat', () => {
    const r = reviewDesign({ ...cubesat, difficulty: 'flight-director' });
    const item = r.readiness.items.find((i) => i.id === 'risk')!;
    expect(item.status).toBe('red');
    expect(item.critical).toBe(true);
    const reds = r.risks.filter((x) => x.level === 'red');
    expect(reds.length).toBeGreaterThan(0);
    for (const x of reds) expect(item.fix).toContain(x.name);
    expect(item.fix).toMatch(/Radiation-tolerant CubeSat computer/);
  });
});
