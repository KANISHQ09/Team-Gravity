import { afterAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.ts';
import { makeApp } from './helpers.ts';

const app = await makeApp({
  probes: [
    { name: 'postgres', check: async () => {} },
    { name: 'redis', check: async () => Promise.reject(new Error('down')) },
  ],
});

afterAll(async () => {
  await app.close();
});

describe('GET /healthz and /readyz', () => {
  it('reports liveness with the engine version', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', engineApiVersion: 1 });
  });

  it('reports a degraded dependency with 503', async () => {
    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'degraded',
      checks: { postgres: 'ok', redis: 'down' },
    });
  });
});

describe('loadEnv', () => {
  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('treats empty values (KEY= in .env) as not set', () => {
    // Mirrors a freshly copied .env.example with JWT_SIGNING_KEY left blank.
    const env = loadEnv({ JWT_SIGNING_KEY: '', PORT: '' });
    expect(env.JWT_SIGNING_KEY).toBeUndefined();
    expect(env.PORT).toBe(3000);
    expect(env.jwtKeyGenerated).toBe(true);
    expect(env.jwtKey.length).toBeGreaterThanOrEqual(32);
  });

  it('still rejects a JWT key that is set but too short', () => {
    expect(() => loadEnv({ JWT_SIGNING_KEY: 'short' })).toThrow(/JWT_SIGNING_KEY/);
  });

  it('refuses to start in production without a JWT key', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/required in production/);
  });
});
