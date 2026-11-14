import { catalog } from '@gravity/engine';
import type { DesignEdit } from '@gravity/shared';

/** Plain-language description of a design edit, for proposals. */
export function describeEdit(edit: DesignEdit): string {
  const name = (id: string | null) =>
    id === null
      ? 'nothing'
      : ((
          catalog.parts.find((p) => p.id === id) ??
          catalog.orbits.find((o) => o.id === id) ??
          catalog.launchVehicles.find((v) => v.id === id)
        )?.name ?? id);
  switch (edit.type) {
    case 'addPart':
      return `add ${name(edit.partId)}`;
    case 'removePart':
      return `remove ${name(edit.partId)}`;
    case 'setOrbit':
      return `change the orbit to ${name(edit.orbitId)}`;
    case 'setLaunchVehicle':
      return `change the rocket to ${name(edit.launchVehicleId)}`;
    case 'setGoals':
      return `change the science goals (${edit.goalIds.length} selected)`;
    case 'setGroundStations':
      return `use ${edit.count} ground station(s)`;
    case 'setMitigations':
      return 'change the risk reserves';
  }
}
