import { anomalyAutopilot, anomalyResult, anomalyStart, anomalyStep } from './anomalyGame.ts';
import {
  insertionAutopilot,
  insertionResult,
  insertionStart,
  insertionStep,
} from './insertionGame.ts';
import { launchAutopilot, launchResult, launchStart, launchStep } from './launchGame.ts';
import { pilotSummary } from './pilotScore.ts';
import { scienceAutopilot, scienceResult, scienceStart, scienceStep } from './scienceGame.ts';

const DT = 1 / 60;

function run<S extends { done: boolean }, I>(
  start: S,
  step: (s: S, i: I, dt: number) => S,
  input: (s: S) => I,
) {
  let s = start;
  for (let i = 0; i < 60 * 60 && !s.done; i++) s = step(s, input(s), DT);
  return s;
}

describe('pilot mini-games', () => {
  it('launch: good steering and throttling beat doing nothing', () => {
    const good = launchResult(run(launchStart(), launchStep, launchAutopilot));
    const idle = launchResult(run(launchStart(), launchStep, () => ({ pitch: 0, throttle: 0 })));
    expect(good.score).toBeGreaterThanOrEqual(90);
    expect(good.orbit).toBe(true);
    expect(idle.score).toBeLessThan(40);
  });

  it('launch: ignoring max-Q costs points', () => {
    const noThrottle = launchResult(
      run(launchStart(), launchStep, (s) => ({ ...launchAutopilot(s), throttle: 1 })),
    );
    const good = launchResult(run(launchStart(), launchStep, launchAutopilot));
    expect(noThrottle.score).toBeLessThan(good.score);
  });

  it.each(['capture', 'circularize'] as const)(
    'insertion (%s): a timed burn reaches orbit',
    (kind) => {
      const good = insertionResult(
        run(insertionStart(kind, 1.5), insertionStep, insertionAutopilot),
      );
      const none = insertionResult(run(insertionStart(kind, 1.5), insertionStep, () => false));
      expect(good.score).toBeGreaterThanOrEqual(80);
      expect(none.score).toBeLessThan(good.score - 40);
    },
  );

  it('insertion: burning the whole time ends badly', () => {
    const hold = insertionResult(run(insertionStart('capture', 1.5), insertionStep, () => true));
    expect(hold.score).toBeLessThan(20);
  });

  it('science: capturing and downlinking returns data; idling returns none', () => {
    const good = scienceResult(run(scienceStart(7), scienceStep, scienceAutopilot));
    const idle = scienceResult(
      run(scienceStart(7), scienceStep, () => ({ steer: 0, capture: false, downlink: false })),
    );
    expect(good.score).toBeGreaterThanOrEqual(70);
    expect(idle.score).toBe(0);
  });

  it('science: the same seed gives the same targets', () => {
    expect(scienceStart(42).targets).toEqual(scienceStart(42).targets);
  });

  it.each(['stabilize', 'reflex'] as const)('anomaly (%s): reacting well scores high', (kind) => {
    const good = anomalyResult(run(anomalyStart(kind), anomalyStep, anomalyAutopilot));
    const idle = anomalyResult(
      run(anomalyStart(kind), anomalyStep, () => ({ x: 0, y: 0, act: false })),
    );
    expect(good.score).toBeGreaterThanOrEqual(80);
    expect(idle.score).toBeLessThanOrEqual(40);
  });

  it('pilot rating averages the games and awards medals', () => {
    const s = pilotSummary([
      { id: 'launch', label: 'Launch', score: 90, summary: '', autopilot: false },
      { id: 'science', label: 'Science', score: 80, summary: '', autopilot: false },
    ]);
    expect(s?.score).toBe(85);
    expect(s?.medal).toBe('gold');
    expect(pilotSummary([])).toBeNull();
  });
});
