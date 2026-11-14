import { type MissionResult, type TeamInfo, runMission } from '@gravity/engine';
import type { Design } from '@gravity/shared';

type Reply =
  { id: number; ok: true; result: MissionResult } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: MissionResult) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e: MessageEvent<Reply>) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.result);
        else p.reject(new Error(e.data.error));
      };
      worker.onerror = () => {
        // A broken worker should never block play: fail pending runs and fall back next time.
        for (const p of pending.values()) p.reject(new Error('Simulation worker failed'));
        pending.clear();
        worker = null;
      };
    } catch {
      worker = null;
    }
  }
  return worker;
}

/**
 * Simulate and score a mission. Uses a Web Worker when available; otherwise
 * (tests, very old browsers) runs on the main thread and returns synchronously
 * via `sync`, so callers can update the screen immediately.
 */
export function runMissionOffThread(
  design: Design,
  seed: number,
  team?: TeamInfo,
): { sync: MissionResult } | { promise: Promise<MissionResult> } {
  const w = getWorker();
  if (!w) return { sync: runMission(design, seed, team) };
  const id = nextId++;
  const promise = new Promise<MissionResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, design, seed, team });
  }).catch(() => runMission(design, seed, team));
  return { promise };
}
