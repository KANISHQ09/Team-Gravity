/// <reference lib="webworker" />
/**
 * Runs mission simulations off the main thread so the interface never
 * freezes, even on slow devices. The engine is pure, so the worker gives
 * exactly the same result as running it directly.
 */
import { runMission, type TeamInfo } from '@gravity/engine';
import type { Design } from '@gravity/shared';

export interface SimRequest {
  readonly id: number;
  readonly design: Design;
  readonly seed: number;
  readonly team?: TeamInfo;
}

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { id, design, seed, team } = event.data;
  try {
    self.postMessage({ id, ok: true, result: runMission(design, seed, team) });
  } catch (e) {
    self.postMessage({ id, ok: false, error: (e as Error).message });
  }
};
