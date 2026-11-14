import { describe, expect, it } from 'vitest';
import { catalog, findOrbit, findScenario } from '../src/index.ts';

describe('catalog', () => {
  it('meets the MVP minimums (SRS-MIS-01, SRS-LOR-01/02)', () => {
    expect(catalog.scenarios.map((s) => s.id)).toEqual([
      'cubesat-earth-observer',
      'lunar-orbiter',
      'mars-orbiter',
    ]);
    expect(catalog.parts.length).toBeGreaterThanOrEqual(15);
    expect(catalog.launchVehicles.length).toBeGreaterThanOrEqual(4);
    for (const s of catalog.scenarios) expect(s.allowedOrbitIds.length).toBeGreaterThanOrEqual(4);
  });

  it('labels every entry with a provenance', () => {
    const all = [
      ...catalog.parts,
      ...catalog.launchVehicles,
      ...catalog.orbits,
      ...catalog.scenarios,
      ...catalog.analogs,
    ];
    for (const item of all) expect(item.provenance).toMatch(/^(NASA|NASA\/GMAT|DERIVED|GAME)$/);
  });

  it('cites a source for every NASA-labelled entry', () => {
    for (const a of catalog.analogs) {
      if (a.provenance === 'NASA') expect(a.sourceId).toMatch(/^SRC-\d+$/);
    }
  });

  it('has an instrument for every measurement a goal needs', () => {
    const measured = new Set(catalog.parts.flatMap((p) => p.measures ?? []));
    for (const s of catalog.scenarios) {
      for (const g of s.goals) expect(measured.has(g.measurement)).toBe(true);
    }
  });

  it('has at least one launch vehicle that reaches each scenario', () => {
    for (const s of catalog.scenarios) {
      const cls = findOrbit(s.allowedOrbitIds[0] ?? '')?.orbitClass;
      expect(cls).toBeDefined();
      expect(catalog.launchVehicles.some((v) => (v.capacityKg[cls!] ?? 0) > 0)).toBe(true);
    }
  });

  it('finds items by id', () => {
    expect(findScenario('lunar-orbiter')?.body).toBe('moon');
    expect(findScenario('nope')).toBeUndefined();
  });
});
