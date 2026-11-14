import { z } from 'zod';
import { type Design, type PartCategory, mitigationSchema, partCategorySchema } from './domain.ts';

/**
 * Every change to a design is one of these edits. The web app applies them
 * locally (solo and hot-seat) and the server applies the same edits in
 * co-op rooms, after checking the editor's role.
 */
export const designEditSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setGoals'), goalIds: z.array(z.string()).max(4) }),
  z.object({ type: z.literal('setOrbit'), orbitId: z.string().nullable() }),
  z.object({ type: z.literal('setLaunchVehicle'), launchVehicleId: z.string().nullable() }),
  z.object({ type: z.literal('addPart'), partId: z.string(), category: partCategorySchema }),
  z.object({
    type: z.literal('removePart'),
    partId: z.string(),
    category: partCategorySchema,
  }),
  z.object({ type: z.literal('setGroundStations'), count: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal('setMitigations'), mitigations: z.array(mitigationSchema) }),
]);
export type DesignEdit = z.infer<typeof designEditSchema>;

export const roleSchema = z.enum([
  'mission-architect',
  'spacecraft-engineer',
  'science-lead',
  'operations',
]);
export type Role = z.infer<typeof roleSchema>;

export const ROLES: readonly Role[] = roleSchema.options;

export const ROLE_INFO: Record<Role, { name: string; owns: string }> = {
  'mission-architect': {
    name: 'Mission Architect',
    owns: 'Science goals, orbit and launch vehicle',
  },
  'spacecraft-engineer': {
    name: 'Spacecraft Engineer',
    owns: 'Bus, computer, attitude control and propulsion',
  },
  'science-lead': { name: 'Science Lead', owns: 'Science instruments' },
  operations: {
    name: 'Operations & Resources',
    owns: 'Solar arrays, batteries, antennas, ground stations and risk reserves',
  },
};

const PART_OWNER: Record<PartCategory, Role> = {
  bus: 'spacecraft-engineer',
  computer: 'spacecraft-engineer',
  adcs: 'spacecraft-engineer',
  propulsion: 'spacecraft-engineer',
  instrument: 'science-lead',
  solar: 'operations',
  battery: 'operations',
  antenna: 'operations',
};

/** The role that owns an edit. Other roles must send a proposal instead. */
export function editOwner(edit: DesignEdit): Role {
  switch (edit.type) {
    case 'setGoals':
    case 'setOrbit':
    case 'setLaunchVehicle':
      return 'mission-architect';
    case 'addPart':
    case 'removePart':
      return PART_OWNER[edit.category];
    case 'setGroundStations':
    case 'setMitigations':
      return 'operations';
  }
}

/** Roles held by each player when fewer than four people play (roles merge). */
export function assignRoles(playerCount: number): Role[][] {
  switch (playerCount) {
    case 1:
      return [[...ROLES]];
    case 2:
      return [
        ['mission-architect', 'science-lead'],
        ['spacecraft-engineer', 'operations'],
      ];
    case 3:
      return [['mission-architect', 'science-lead'], ['spacecraft-engineer'], ['operations']];
    default:
      return ROLES.map((r) => [r]);
  }
}

/** Pure: returns a new design with the edit applied. */
export function applyEdit(design: Design, edit: DesignEdit): Design {
  switch (edit.type) {
    case 'setGoals':
      return { ...design, goalIds: [...new Set(edit.goalIds)] };
    case 'setOrbit':
      return { ...design, orbitId: edit.orbitId };
    case 'setLaunchVehicle':
      return { ...design, launchVehicleId: edit.launchVehicleId };
    case 'addPart':
      return { ...design, partIds: [...design.partIds, edit.partId] };
    case 'removePart': {
      const i = design.partIds.lastIndexOf(edit.partId);
      if (i < 0) return design;
      return { ...design, partIds: design.partIds.filter((_, j) => j !== i) };
    }
    case 'setGroundStations':
      return { ...design, groundStations: edit.count };
    case 'setMitigations':
      return { ...design, mitigations: [...new Set(edit.mitigations)] };
  }
}
