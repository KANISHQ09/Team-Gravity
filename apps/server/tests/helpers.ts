import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
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

/** Opens an authenticated Socket.IO client; `track` collects it for cleanup. */
export function socketClient(url: string, token: string, track: Socket[]): Promise<Socket> {
  const s = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
  track.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

/** Resolves with the next payload of `event` on `s`. */
export const nextEvent = <T>(s: Socket, event: string) =>
  new Promise<T>((resolve) => s.once(event, resolve));

/** Resolves with the first payload of `event` that matches `pred`. */
export function waitFor<T>(s: Socket, event: string, pred: (payload: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const handler = (payload: T) => {
      if (!pred(payload)) return;
      s.off(event, handler);
      resolve(payload);
    };
    s.on(event, handler);
  });
}

export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
}

export async function createRoom(
  app: FastifyInstance,
  token: string,
  scenarioId = 'lunar-orbiter',
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/rooms',
    headers: { authorization: `Bearer ${token}` },
    payload: { scenarioId, difficulty: 'engineer' },
  });
  return res.json<{ code: string; roomId: string }>();
}

/** Category of a catalog part from its ID prefix (fixture designs use these prefixes). */
export const PART_CATEGORY: Record<string, string> = {
  bus: 'bus',
  solar: 'solar',
  battery: 'battery',
  antenna: 'antenna',
  computer: 'computer',
  adcs: 'adcs',
  prop: 'propulsion',
  inst: 'instrument',
};
