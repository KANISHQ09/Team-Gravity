import { useMemo } from 'react';
import { type DesignReview, catalog, reviewDesign } from '@gravity/engine';
import type { Scenario } from '@gravity/shared';
import { useGame } from '../store/game.ts';

/**
 * Full engine review of the current design, recomputed on every change.
 * The engine runs in well under 10 ms, so it stays on the main thread
 * (a Web Worker can be added if designs grow; see apps/web/src/workers).
 */
export function useReview(): { review: DesignReview; scenario: Scenario } | null {
  const design = useGame((s) => s.design);
  return useMemo(() => {
    if (!design) return null;
    const scenario = catalog.scenarios.find((s) => s.id === design.scenarioId);
    if (!scenario) return null;
    return { review: reviewDesign(design), scenario };
  }, [design]);
}
