import { type Catalog, type Design, type DesignEdit, applyEdit } from '@gravity/shared';
import { analyzeDesign } from '../models/analysis.ts';
import { readinessFromAnalysis } from '../readiness/index.ts';
import { simulateAnalysis } from '../simulate/index.ts';
import { hasBlockingErrors, validateAnalysis } from '../validate/index.ts';

/** How one single change to the design would move science and cost (SRS-TRD-02). */
export interface SensitivityRow {
  readonly label: string;
  readonly edit: DesignEdit;
  /** Average change in science points over the sample seeds. */
  readonly scienceDelta: number;
  readonly costDeltaM: number;
  /** Whether the changed design could still launch. */
  readonly launchable: boolean;
}

export interface Sensitivity {
  readonly baseScience: number;
  readonly baseCostM: number;
  readonly rows: readonly SensitivityRow[];
}

/** Fixed seeds so the analysis is deterministic and comparable between designs. */
const SAMPLE_SEEDS = [11, 23, 37, 41, 59];

function evaluate(design: Design, catalog: Catalog) {
  const a = analyzeDesign(design, catalog);
  const launchable = !hasBlockingErrors(validateAnalysis(a)) && readinessFromAnalysis(a).ready;
  const science = launchable
    ? SAMPLE_SEEDS.reduce((s, seed) => s + simulateAnalysis(a, seed).science, 0) /
      SAMPLE_SEEDS.length
    : 0;
  return { science, costM: a.costM, launchable };
}

/**
 * "Science partials": try one change at a time and report the effect.
 * Candidates: other allowed orbits, ±1 ground station, removing each instrument.
 */
export function sensitivity(design: Design, catalog: Catalog): Sensitivity {
  const base = evaluate(design, catalog);
  const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId);
  const candidates: { label: string; edit: DesignEdit }[] = [];

  for (const orbitId of scenario?.allowedOrbitIds ?? []) {
    if (orbitId === design.orbitId) continue;
    const orbit = catalog.orbits.find((o) => o.id === orbitId);
    if (orbit)
      candidates.push({ label: `Fly in ${orbit.name}`, edit: { type: 'setOrbit', orbitId } });
  }
  if (design.groundStations < 3) {
    candidates.push({
      label: `Use ${design.groundStations + 1} ground stations`,
      edit: { type: 'setGroundStations', count: design.groundStations + 1 },
    });
  }
  if (design.groundStations > 1) {
    candidates.push({
      label: `Use ${design.groundStations - 1} ground station${design.groundStations - 1 > 1 ? 's' : ''}`,
      edit: { type: 'setGroundStations', count: design.groundStations - 1 },
    });
  }
  for (const partId of new Set(design.partIds)) {
    const part = catalog.parts.find((p) => p.id === partId);
    if (part?.category === 'instrument') {
      candidates.push({
        label: `Remove the ${part.name}`,
        edit: { type: 'removePart', partId, category: 'instrument' },
      });
    }
  }

  const rows = candidates.map(({ label, edit }) => {
    const r = evaluate(applyEdit(design, edit), catalog);
    return {
      label,
      edit,
      scienceDelta: r.science - base.science,
      costDeltaM: r.costM - base.costM,
      launchable: r.launchable,
    };
  });
  rows.sort((x, y) => Math.abs(y.scienceDelta) - Math.abs(x.scienceDelta));
  return { baseScience: base.science, baseCostM: base.costM, rows };
}
