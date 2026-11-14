import { type Design, type Difficulty, emptyDesign } from '@gravity/shared';

/** Hand-built reference designs used by tests and the balance check (SRS-SCR-06). */
export function design(
  scenarioId: string,
  difficulty: Difficulty,
  partIds: string[],
  orbitId: string,
  launchVehicleId: string,
  extra: Partial<Design> = {},
  goalIds?: string[],
): Design {
  const goals: Record<string, string[]> = {
    'cubesat-earth-observer': ['eo-land', 'eo-coast', 'eo-radiation'],
    'lunar-orbiter': ['moon-topo', 'moon-ice', 'moon-sites'],
    'mars-orbiter': ['mars-ice', 'mars-air', 'mars-field', 'mars-surface'],
  };
  return {
    ...emptyDesign(scenarioId, difficulty),
    goalIds: goalIds ?? goals[scenarioId] ?? [],
    partIds,
    orbitId,
    launchVehicleId,
    ...extra,
  };
}

const CUBESAT_PAYLOAD = ['inst-multispectral-cube', 'inst-camera-cube', 'inst-radiation'];
const MARS_CORE = ['computer-radhard', 'adcs-wheels-redundant', 'antenna-hga'];

/** Three materially different designs per scenario that should all score ≥ 85. */
export const BALANCE_DESIGNS: Record<string, { name: string; design: Design }[]> = {
  'cubesat-earth-observer': [
    {
      name: 'SSO mapper with CubeSat wheels',
      design: design(
        'cubesat-earth-observer',
        'explorer',
        [
          'bus-cubesat-6u',
          'computer-cots',
          'battery-cube',
          'adcs-cube-wheels',
          'solar-cube-deploy',
          'antenna-sband-patch',
          ...CUBESAT_PAYLOAD,
        ],
        'sso-550',
        'lv-rideshare',
      ),
    },
    {
      name: 'Low Earth orbit, two ground stations',
      design: design(
        'cubesat-earth-observer',
        'explorer',
        [
          'bus-cubesat-6u',
          'computer-cots',
          'battery-cube',
          'battery-cube',
          'adcs-cube-wheels',
          'solar-cube-deploy',
          'antenna-sband-patch',
          ...CUBESAT_PAYLOAD,
        ],
        'leo-400',
        'lv-rideshare',
        { groundStations: 2 },
      ),
    },
    {
      name: 'Space-station orbit, budget reserve, extra panels',
      design: design(
        'cubesat-earth-observer',
        'explorer',
        [
          'bus-cubesat-6u',
          'computer-cots',
          'battery-cube',
          'battery-cube',
          'adcs-cube-wheels',
          'solar-cube-deploy',
          'solar-body',
          'antenna-sband-patch',
          ...CUBESAT_PAYLOAD,
        ],
        'leo-iss',
        'lv-rideshare',
        { mitigations: ['budget-reserve'] },
      ),
    },
  ],
  'lunar-orbiter': [
    {
      name: 'Medium orbiter, high-res camera, polar orbit',
      design: design(
        'lunar-orbiter',
        'engineer',
        [
          'bus-medium',
          'solar-deploy-m',
          'battery-m',
          'antenna-mga',
          'computer-radhard',
          'adcs-wheels-redundant',
          'prop-biprop',
          'inst-altimeter',
          'inst-spectrometer',
          'inst-camera-hires',
        ],
        'lunar-polar-100',
        'lv-medium',
        { mitigations: ['schedule-margin'] },
      ),
    },
    {
      name: 'Lean small-bus orbiter on hydrazine',
      design: design(
        'lunar-orbiter',
        'engineer',
        [
          'bus-small',
          'solar-deploy-s',
          'battery-s',
          'antenna-mga',
          'computer-radhard',
          'adcs-wheels-redundant',
          'prop-hydrazine-m',
          'inst-altimeter',
          'inst-spectrometer',
          'inst-camera-cube',
        ],
        'llo-100',
        'lv-medium',
        { mitigations: ['budget-reserve'] },
      ),
    },
    {
      name: 'Very low 50 km orbit, two stations, extra testing',
      design: design(
        'lunar-orbiter',
        'engineer',
        [
          'bus-medium',
          'solar-deploy-m',
          'battery-m',
          'antenna-mga',
          'computer-radhard',
          'adcs-wheels-redundant',
          'prop-biprop',
          'inst-altimeter',
          'inst-spectrometer',
          'inst-camera-hires',
        ],
        'llo-50',
        'lv-medium',
        { mitigations: ['schedule-margin', 'extra-testing'], groundStations: 2 },
      ),
    },
  ],
  'mars-orbiter': [
    {
      name: 'Medium bus, large engine, Mars sun-synchronous orbit',
      design: design(
        'mars-orbiter',
        'flight-director',
        [
          'bus-medium',
          'solar-deploy-l',
          'battery-m',
          ...MARS_CORE,
          'prop-biprop-l',
          'inst-radar',
          'inst-spectrometer',
          'inst-magnetometer',
          'inst-camera-cube',
        ],
        'mars-sso-400',
        'lv-heavy',
        { groundStations: 2, mitigations: ['schedule-margin', 'budget-reserve'] },
      ),
    },
    {
      name: 'Large bus to low Mars orbit',
      design: design(
        'mars-orbiter',
        'flight-director',
        [
          'bus-large',
          'solar-deploy-l',
          'battery-l',
          ...MARS_CORE,
          'prop-biprop-l',
          'inst-radar',
          'inst-spectrometer',
          'inst-magnetometer',
          'inst-camera-cube',
        ],
        'mars-lmo-300',
        'lv-heavy',
        { groundStations: 2, mitigations: ['schedule-margin'] },
      ),
    },
    {
      name: 'Ion-propelled orbiter on a medium launcher',
      design: design(
        'mars-orbiter',
        'flight-director',
        [
          'bus-medium',
          'solar-deploy-l',
          'solar-deploy-m',
          'battery-l',
          ...MARS_CORE,
          'prop-electric',
          'inst-radar',
          'inst-spectrometer',
          'inst-magnetometer',
          'inst-camera-cube',
        ],
        'mars-sso-400',
        'lv-heavy',
        { groundStations: 2, mitigations: ['schedule-margin', 'budget-reserve'] },
      ),
    },
  ],
};

/**
 * A Flight Director CubeSat: rad-tolerant computer, a second battery for
 * battery-wear margin and schedule margin, so every risk is mitigated.
 */
export const FLIGHT_DIRECTOR_CUBESAT = design(
  'cubesat-earth-observer',
  'flight-director',
  [
    'bus-cubesat-6u',
    'computer-cube-radtol',
    'battery-cube',
    'battery-cube',
    'adcs-cube-wheels',
    'solar-cube-deploy',
    'antenna-sband-patch',
    ...CUBESAT_PAYLOAD,
  ],
  'sso-550',
  'lv-rideshare',
  { mitigations: ['schedule-margin'] },
);
