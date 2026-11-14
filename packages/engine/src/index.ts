/**
 * @gravity/engine: all GRAVITY game rules. Pure and deterministic: no DOM,
 * network, clock or unseeded randomness (enforced by ESLint).
 */
import type { Catalog, Design } from '@gravity/shared';
import { catalog as defaultCatalog, CATALOG_VERSION } from '@gravity/catalog';
import { type Gauge, gaugesFromAnalysis } from './budgets/index.ts';
import { type DesignAnalysis, analyzeDesign } from './models/analysis.ts';
import { type Readiness, readinessFromAnalysis } from './readiness/index.ts';
import { type Risk, risksFromAnalysis } from './readiness/risk.ts';
import { type Requirement, requirementsFromAnalysis } from './requirements/index.ts';
import { type RunResult, simulateAnalysis } from './simulate/index.ts';
import { type ScoreReport, type TeamInfo, score } from './score/index.ts';
import { type Issue, hasBlockingErrors, validateAnalysis } from './validate/index.ts';

export const ENGINE_API_VERSION = 1;
export const SUPPORTED_CATALOG_VERSION = CATALOG_VERSION;
export { defaultCatalog as catalog };

export * from './budgets/index.ts';
export * from './models/analysis.ts';
export * from './models/constants.ts';
export * from './readiness/index.ts';
export * from './readiness/risk.ts';
export * from './requirements/index.ts';
export * from './score/index.ts';
export * from './score/sensitivity.ts';
export * from './simulate/index.ts';
export { createRng, type Rng } from './simulate/prng.ts';
export * from './validate/index.ts';

/** Everything the design screens show, computed in one pass. */
export interface DesignReview {
  readonly analysis: DesignAnalysis;
  readonly gauges: readonly Gauge[];
  readonly issues: readonly Issue[];
  readonly requirements: readonly Requirement[];
  readonly risks: readonly Risk[];
  readonly readiness: Readiness;
  /** True when launch is allowed: no blocking errors and the readiness gate passes. */
  readonly canLaunch: boolean;
}

export function reviewDesign(design: Design, catalog: Catalog = defaultCatalog): DesignReview {
  const analysis = analyzeDesign(design, catalog);
  const issues = validateAnalysis(analysis);
  const readiness = readinessFromAnalysis(analysis);
  return {
    analysis,
    gauges: gaugesFromAnalysis(analysis),
    issues,
    requirements: requirementsFromAnalysis(analysis),
    risks: risksFromAnalysis(analysis),
    readiness,
    canLaunch: !hasBlockingErrors(issues) && readiness.ready,
  };
}

export interface MissionResult {
  readonly run: RunResult;
  readonly report: ScoreReport;
}

/** Simulate and score in one call: used by the web app and recomputed by the server. */
export function runMission(
  design: Design,
  seed: number,
  team?: TeamInfo,
  catalog: Catalog = defaultCatalog,
): MissionResult {
  const run = simulateAnalysis(analyzeDesign(design, catalog), seed);
  return { run, report: score(run, catalog, team) };
}
