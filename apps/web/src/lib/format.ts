export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

export const bodyName = (body: string) =>
  body === 'earth' ? 'Earth' : body === 'moon' ? 'the Moon' : 'Mars';

export const DIFFICULTY_LABEL = {
  explorer: 'Explorer',
  engineer: 'Engineer',
  'flight-director': 'Flight Director',
} as const;

export const CATEGORY_LABEL: Record<string, string> = {
  bus: 'Bus',
  solar: 'Solar arrays',
  battery: 'Batteries',
  antenna: 'Antennas',
  computer: 'Computers',
  adcs: 'Attitude control',
  propulsion: 'Propulsion',
  instrument: 'Instruments',
};
