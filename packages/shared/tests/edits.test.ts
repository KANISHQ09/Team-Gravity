import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  assignRoles,
  designEditSchema,
  editOwner,
  emptyDesign,
  ROLES,
  teamNameSchema,
} from '../src/index.ts';

describe('applyEdit', () => {
  const base = emptyDesign('lunar-orbiter', 'engineer');

  it('adds and removes one copy of a part at a time', () => {
    let d = applyEdit(base, { type: 'addPart', partId: 'battery-s', category: 'battery' });
    d = applyEdit(d, { type: 'addPart', partId: 'battery-s', category: 'battery' });
    expect(d.partIds).toEqual(['battery-s', 'battery-s']);
    d = applyEdit(d, { type: 'removePart', partId: 'battery-s', category: 'battery' });
    expect(d.partIds).toEqual(['battery-s']);
  });

  it('never mutates the input design', () => {
    const before = JSON.parse(JSON.stringify(base)) as typeof base;
    applyEdit(base, { type: 'setOrbit', orbitId: 'llo-100' });
    expect(base).toEqual(before);
  });

  it('removing a part that is not there is a no-op', () => {
    expect(applyEdit(base, { type: 'removePart', partId: 'x', category: 'bus' })).toBe(base);
  });

  it('de-duplicates goals', () => {
    const d = applyEdit(base, { type: 'setGoals', goalIds: ['a', 'a', 'b'] });
    expect(d.goalIds).toEqual(['a', 'b']);
  });
});

describe('roles', () => {
  it('maps every edit to exactly one owning role', () => {
    expect(editOwner({ type: 'setOrbit', orbitId: null })).toBe('mission-architect');
    expect(editOwner({ type: 'addPart', partId: 'x', category: 'instrument' })).toBe(
      'science-lead',
    );
    expect(editOwner({ type: 'addPart', partId: 'x', category: 'propulsion' })).toBe(
      'spacecraft-engineer',
    );
    expect(editOwner({ type: 'setGroundStations', count: 2 })).toBe('operations');
  });

  it('covers all four roles exactly once for 1 to 4 players', () => {
    for (let n = 1; n <= 4; n++) {
      const groups = assignRoles(n);
      expect(groups).toHaveLength(n);
      expect(groups.flat().sort()).toEqual([...ROLES].sort());
    }
  });

  it('rejects unknown edit types', () => {
    expect(designEditSchema.safeParse({ type: 'deleteEverything' }).success).toBe(false);
  });
});

describe('teamNameSchema', () => {
  it('accepts preset words only', () => {
    expect(teamNameSchema.safeParse('Lunar Owls').success).toBe(true);
    expect(teamNameSchema.safeParse('Lunar Owls Extra').success).toBe(false);
    expect(teamNameSchema.safeParse('Anything Goes').success).toBe(false);
  });
});
