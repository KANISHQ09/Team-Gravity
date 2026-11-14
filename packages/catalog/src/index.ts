/**
 * @gravity/catalog: game data (scenarios, parts, launch vehicles, orbits,
 * real-mission analogs, glossary) stored as JSON in ../data and validated
 * against the shared Zod schemas when this module loads.
 */
import {
  type Catalog,
  type LaunchVehicle,
  type Orbit,
  type Part,
  type Scenario,
  catalogSchema,
} from '@gravity/shared';
import analogs from '../data/analogs.json';
import glossary from '../data/glossary.json';
import launchVehicles from '../data/launch-vehicles.json';
import orbits from '../data/orbits.json';
import parts from '../data/parts.json';
import scenarios from '../data/scenarios.json';

/** Bump when catalog data changes so saved designs and caches can tell. */
export const CATALOG_VERSION = 1;

/** Validated catalog. Throws at import time if any data file is invalid. */
export const catalog: Catalog = catalogSchema.parse({
  version: CATALOG_VERSION,
  parts,
  launchVehicles,
  orbits,
  scenarios,
  analogs,
  glossary,
});

function index<T extends { id: string }>(items: readonly T[], kind: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`Duplicate ${kind} id: ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

const partsById = index(catalog.parts, 'part');
const vehiclesById = index(catalog.launchVehicles, 'launch vehicle');
const orbitsById = index(catalog.orbits, 'orbit');
const scenariosById = index(catalog.scenarios, 'scenario');

export const findPart = (id: string): Part | undefined => partsById.get(id);
export const findLaunchVehicle = (id: string): LaunchVehicle | undefined => vehiclesById.get(id);
export const findOrbit = (id: string): Orbit | undefined => orbitsById.get(id);
export const findScenario = (id: string): Scenario | undefined => scenariosById.get(id);

// Cross-reference checks that the schemas alone cannot express.
for (const scenario of catalog.scenarios) {
  for (const orbitId of scenario.allowedOrbitIds) {
    const orbit = orbitsById.get(orbitId);
    if (!orbit) throw new Error(`Scenario ${scenario.id} allows unknown orbit ${orbitId}`);
    if (orbit.body !== scenario.body) {
      throw new Error(`Scenario ${scenario.id} allows orbit ${orbitId} around another body`);
    }
  }
  const weights = scenario.goals.reduce((sum, g) => sum + g.weight, 0);
  if (Math.abs(weights - 1) > 1e-9) {
    throw new Error(`Goal weights of ${scenario.id} add up to ${weights}, not 1`);
  }
  if (scenario.thresholdScience >= scenario.baselineScience) {
    throw new Error(`Threshold science of ${scenario.id} must be below its Baseline`);
  }
}
