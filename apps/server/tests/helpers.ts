import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDeps } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';

export const testEnv = () =>
  loadEnv({
    NODE_ENV: 'test',
    JWT_SIGNING_KEY: 'test-key-that-is-long-enough-for-hmac-signing-0123456789',
  });

export async function makeApp(deps: AppDeps = {}): Promise<FastifyInstance> {
  return buildApp(testEnv(), deps);
}

export async function guestToken(
  app: FastifyInstance,
): Promise<{ token: string; guestId: string; cookie: string }> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/guest' });
  const body = res.json<{ accessToken: string; guestId: string }>();
  const setCookie = res.headers['set-cookie'];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie) ?? '';
  return { token: body.accessToken, guestId: body.guestId, cookie: cookie.split(';')[0]! };
}
