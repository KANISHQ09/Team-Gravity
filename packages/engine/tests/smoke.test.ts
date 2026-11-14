import { describe, expect, it } from 'vitest';
import { ENGINE_API_VERSION, SUPPORTED_CATALOG_VERSION } from '../src/index.ts';

// Smoke test: proves the test runner and cross-package imports work.
// Replace with real engine tests in Phase 8.
describe('engine package', () => {
  it('exposes its API version and the catalog version it supports', () => {
    expect(ENGINE_API_VERSION).toBe(0);
    expect(SUPPORTED_CATALOG_VERSION).toBe(0);
  });
});
