import type { StageId } from '../../store/game.ts';

/** Tutorial hints shown on Explorer difficulty (FR-15, SRS-EDU-01). */
export const STAGE_HINTS: Record<StageId, string> = {
  goals:
    'Real missions start from the science. Pick the goals first: each one needs a certain kind of measurement, which decides your instruments later.',
  concept:
    'Choose where to fly and how to get there. Lower orbits give sharper data but more shadow; the rocket must be able to reach your orbit with your full mass.',
  requirements:
    'Requirements turn goals into numbers you can check. Each one says how it will be verified: by test, analysis, inspection or demonstration.',
  design:
    'Add a bus first, then power (solar + battery), an antenna, a computer, attitude control and your instruments. Watch the gauges on the right as you go.',
  verify:
    'The readiness review is your launch gate: at least 80% of items green and every critical item green. Each red item tells you how to fix it.',
  launch:
    'Everyone on the team votes GO or NO-GO. Any change to the design resets the vote, so agree before you launch.',
};
