import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';

const app = buildApp(loadEnv({ NODE_ENV: 'test' }));

afterAll(async () => {
  await app.close();
});

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', engineApiVersion: 0 });
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
  });

  it('still rejects a JWT key that is set but too short', () => {
    expect(() => loadEnv({ JWT_SIGNING_KEY: 'short' })).toThrow(/JWT_SIGNING_KEY/);
  });
});
