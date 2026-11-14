import type { Part } from '@gravity/shared';

export interface DeploymentCheck {
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

/**
 * The hangar's "deployment test": quick functional checks a real team runs on
 * the flight model before shipping it to the launch site.
 */
export function deploymentChecks(
  parts: readonly Part[],
  deltaVNeededMs: number,
): DeploymentCheck[] {
  const has = (c: Part['category']) => parts.some((p) => p.category === c);
  const solar = parts.filter((p) => p.category === 'solar');
  const battery = has('battery');
  const instruments = parts.filter((p) => p.category === 'instrument').length;
  const propellant = parts.reduce((s, p) => s + (p.propellantKg ?? 0), 0);
  return [
    {
      label: 'Structure',
      pass: has('bus'),
      detail: has('bus')
        ? 'The bus holds everything together.'
        : 'No bus: nothing to bolt parts onto.',
    },
    {
      label: 'Solar array deployment',
      pass: solar.length > 0,
      detail:
        solar.length > 0
          ? 'Arrays unfolded and are making power.'
          : 'No solar arrays: the batteries would run flat within hours.',
    },
    {
      label: 'Power storage',
      pass: battery,
      detail: battery
        ? 'Batteries carry the craft through shadow.'
        : 'No battery: everything shuts down in eclipse.',
    },
    {
      label: 'Radio check',
      pass: has('antenna'),
      detail: has('antenna')
        ? 'Signal received by the ground station.'
        : 'No antenna: no one can hear the spacecraft.',
    },
    {
      label: 'Flight computer boot',
      pass: has('computer'),
      detail: has('computer')
        ? 'Computer booted and stored test data.'
        : 'No computer: nothing runs the spacecraft.',
    },
    {
      label: 'Attitude control',
      pass: has('adcs'),
      detail: has('adcs')
        ? 'The craft holds its pointing.'
        : 'No attitude control: the craft will tumble.',
    },
    {
      label: 'Instrument first light',
      pass: instruments > 0,
      detail:
        instruments > 0
          ? `${instruments} instrument(s) took test images.`
          : 'No instruments: no science.',
    },
    {
      label: 'Engine hot-fire',
      pass: deltaVNeededMs <= 0 || propellant > 0,
      detail:
        deltaVNeededMs <= 0
          ? propellant > 0
            ? 'Engine fired; useful for keeping the orbit.'
            : 'No engine needed for this orbit.'
          : propellant > 0
            ? 'Engine fired cleanly.'
            : 'This orbit needs an engine to get there or stay there.',
    },
  ];
}
