/**
 * @gravity/engine: all GRAVITY game rules (validate, budgets, readiness,
 * simulate, score). Pure and deterministic: no DOM, network, clock or
 * unseeded randomness (enforced by ESLint).
 *
 * Placeholder until feature development starts (Phase 8).
 */
import { CATALOG_VERSION } from '@gravity/catalog';

export const ENGINE_API_VERSION = 0;

/** Catalog version this engine build was compiled against. */
export const SUPPORTED_CATALOG_VERSION = CATALOG_VERSION;
