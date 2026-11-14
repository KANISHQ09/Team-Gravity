import type { Part } from '@gravity/shared';

/**
 * Turns a parts list into a 3D layout (sizes in metres, +Y = top deck, -Y = engine,
 * +Z = instrument face, ±X = solar wings). Pure, so it is unit-tested and shared by
 * the Design-stage builder and the flight replay.
 */

export type Vec3 = readonly [number, number, number];

export type InstrumentKind =
  | 'camera'
  | 'multispectral'
  | 'spectrometer'
  | 'radar'
  | 'magnetometer'
  | 'radiation'
  | 'altimeter';

export interface CraftLayout {
  readonly bus: { readonly size: Vec3; readonly present: boolean; readonly cube: boolean };
  /** One pair of deployable wings (null when there are no deployable arrays). */
  readonly wings: {
    readonly segmentSize: number;
    readonly segments: number;
    readonly gap: number;
  } | null;
  readonly bodySolar: boolean;
  readonly busId: string | null;
  readonly solarIds: readonly string[];
  readonly antennas: readonly {
    readonly partId: string;
    readonly kind: 'whip' | 'patch' | 'dish';
    readonly diameter: number;
    readonly position: Vec3;
  }[];
  readonly instruments: readonly {
    readonly partId: string;
    readonly kind: InstrumentKind;
    readonly size: number;
    readonly position: Vec3;
  }[];
  readonly radar: { readonly partId: string; readonly length: number } | null;
  readonly magnetometer: { readonly partId: string; readonly length: number } | null;
  readonly engine: {
    readonly partId: string;
    readonly kind: 'cold-gas' | 'mono' | 'biprop' | 'electric';
    readonly size: number;
  } | null;
  readonly starTrackers: string | null;
  /** Components inside the bus, shown in X-ray view. */
  readonly internals: readonly {
    readonly partId: string;
    readonly kind: 'battery' | 'computer' | 'wheels' | 'tank';
    readonly position: Vec3;
    readonly size: number;
  }[];
  /** Bounding radius with everything deployed, used to frame the camera. */
  readonly radius: number;
  /** Plain-language description for screen readers. */
  readonly description: string;
}

const BUS_SIZE: Record<string, Vec3> = {
  'bus-cubesat-6u': [0.23, 0.34, 0.11],
  'bus-small': [0.8, 0.9, 0.8],
  'bus-medium': [1.5, 1.8, 1.5],
  'bus-large': [2.4, 3.0, 2.4],
};

function instrumentKind(p: Part): InstrumentKind {
  const m = p.measures ?? [];
  if (m.includes('radar-sounding')) return 'radar';
  if (m.includes('magnetic-field')) return 'magnetometer';
  if (m.includes('radiation')) return 'radiation';
  if (m.includes('altimetry')) return 'altimeter';
  if (m.includes('spectroscopy')) return 'spectrometer';
  if (m.includes('multispectral-imaging')) return 'multispectral';
  return 'camera';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function layoutCraft(parts: readonly Part[]): CraftLayout {
  const bus = parts.find((p) => p.category === 'bus');
  const size: Vec3 = (bus && BUS_SIZE[bus.id]) || [0.5, 0.5, 0.5];
  const [w, h, d] = size;
  const cube = bus?.id === 'bus-cubesat-6u';
  const maxDim = Math.max(w, h, d);

  // Solar: body-mounted cells cover the bus; deployable area becomes a pair of wings.
  const solar = parts.filter((p) => p.category === 'solar');
  const bodySolar = solar.some((p) => p.id === 'solar-body');
  const deployArea = solar
    .filter((p) => p.id !== 'solar-body')
    .reduce((s, p) => s + (p.areaM2 ?? 0), 0);
  let wings: CraftLayout['wings'] = null;
  if (deployArea > 0) {
    const segmentSize = h * 0.85;
    const perWing = deployArea / 2;
    const segments = Math.max(1, Math.min(6, Math.round(perWing / (segmentSize * segmentSize))));
    wings = { segmentSize, segments, gap: segmentSize * 0.18 };
  }

  // Antennas on the top deck; dishes get the centre, small antennas the corners.
  const antennas: CraftLayout['antennas'][number][] = [];
  let corner = 0;
  const corners: Vec3[] = [
    [w * 0.3, h / 2, d * 0.3],
    [-w * 0.3, h / 2, d * 0.3],
    [w * 0.3, h / 2, -d * 0.3],
    [-w * 0.3, h / 2, -d * 0.3],
  ];
  let dishes = 0;
  for (const p of parts.filter((x) => x.category === 'antenna')) {
    const gain = p.gainDbi ?? 0;
    if (gain >= 15) {
      const big = gain >= 30;
      antennas.push({
        partId: p.id,
        kind: 'dish',
        diameter: big ? Math.max(0.6, w * 1.1) : Math.max(0.25, w * 0.45),
        position: dishes === 0 ? [0, h / 2, 0] : [w * 0.32, h / 2, -d * 0.32],
      });
      dishes++;
    } else {
      antennas.push({
        partId: p.id,
        kind: gain >= 5 ? 'patch' : 'whip',
        diameter: cube ? 0.05 : Math.min(w, d) * 0.15,
        position: corners[corner++ % corners.length]!,
      });
    }
  }

  // Instruments on the +Z face in a grid; radar and magnetometer go on booms.
  const inst = parts
    .filter((p) => p.category === 'instrument')
    .map((p) => ({ partId: p.id, kind: instrumentKind(p) }));
  const faceKinds = inst.filter((k) => k.kind !== 'radar' && k.kind !== 'magnetometer');
  const cols = faceKinds.length <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(faceKinds.length / cols));
  const cell = Math.min(w / cols, (h * 0.8) / rows);
  const instruments = faceKinds.map(({ partId, kind }, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - (cols - 1) / 2) * (w / cols);
    const y = ((rows - 1) / 2 - r) * ((h * 0.8) / rows);
    return { partId, kind, size: cell * 0.7, position: [x, y, d / 2] as Vec3 };
  });
  const radarPart = inst.find((k) => k.kind === 'radar');
  const magPart = inst.find((k) => k.kind === 'magnetometer');
  const radar = radarPart ? { partId: radarPart.partId, length: maxDim * 3 } : null;
  const magnetometer = magPart ? { partId: magPart.partId, length: maxDim * 2 } : null;
  const radarBoomLength = radar?.length ?? 0;
  const magBoomLength = magnetometer?.length ?? 0;

  const prop = parts.find((p) => p.category === 'propulsion');
  const engine: CraftLayout['engine'] = prop
    ? {
        partId: prop.id,
        kind:
          prop.id === 'prop-cold-gas'
            ? 'cold-gas'
            : prop.id === 'prop-electric'
              ? 'electric'
              : prop.id.startsWith('prop-biprop')
                ? 'biprop'
                : 'mono',
        size: w * (prop.id.startsWith('prop-biprop') ? 0.38 : 0.26),
      }
    : null;
  const adcs = parts.find((p) => p.category === 'adcs');
  const starTrackers = adcs && (adcs.pointingArcsec ?? Infinity) <= 60 ? adcs.id : null;

  // Internal layout: batteries and computer low down, wheels in the middle, tank at the centre.
  const internals: CraftLayout['internals'][number][] = [];
  const inner = Math.min(w, d);
  parts
    .filter((p) => p.category === 'battery')
    .forEach((p, i) =>
      internals.push({
        partId: p.id,
        kind: 'battery',
        position: [-w * 0.25, -h * 0.3 + i * inner * 0.22, -d * 0.15],
        size: inner * 0.28,
      }),
    );
  const computer = parts.find((p) => p.category === 'computer');
  if (computer) {
    internals.push({
      partId: computer.id,
      kind: 'computer',
      position: [w * 0.25, -h * 0.3, -d * 0.15],
      size: inner * 0.28,
    });
  }
  if (adcs && adcs.id !== 'adcs-magnetorquer') {
    internals.push({
      partId: adcs.id,
      kind: 'wheels',
      position: [0, h * 0.22, 0],
      size: inner * 0.3,
    });
  }
  if (prop && (prop.propellantKg ?? 0) > 0) {
    internals.push({
      partId: prop.id,
      kind: 'tank',
      position: [0, -h * 0.05, 0],
      size: inner * 0.3,
    });
  }

  const wingReach = wings ? w / 2 + wings.gap + wings.segmentSize * wings.segments : 0;
  const dishReach = antennas.reduce((m, a) => Math.max(m, h / 2 + a.diameter * 0.8), 0);
  const radius = Math.max(
    Math.hypot(w, h, d) / 2,
    wingReach,
    dishReach,
    w / 2 + radarBoomLength,
    d / 2 + magBoomLength,
  );

  const bits: string[] = [];
  if (wings) bits.push(`two solar wings of ${plural(wings.segments, 'panel')} each`);
  if (bodySolar) bits.push('solar cells on its body');
  if (dishes) bits.push(plural(dishes, 'dish antenna'));
  if (antennas.length > dishes) bits.push(plural(antennas.length - dishes, 'small antenna'));
  if (inst.length) bits.push(plural(inst.length, 'instrument'));
  if (engine) bits.push(engine.kind === 'electric' ? 'an ion engine' : 'a rocket engine');
  const busName = bus ? bus.name.toLowerCase() : 'no bus yet';
  const description = bus
    ? `Spacecraft built on a ${busName}${bits.length ? ` with ${bits.join(', ')}` : ''}.`
    : 'No spacecraft yet: add a bus to start building.';

  return {
    bus: { size, present: !!bus, cube },
    busId: bus?.id ?? null,
    solarIds: solar.map((p) => p.id),
    wings,
    bodySolar,
    antennas,
    instruments,
    radar,
    magnetometer,
    engine,
    starTrackers,
    internals,
    radius,
    description,
  };
}
