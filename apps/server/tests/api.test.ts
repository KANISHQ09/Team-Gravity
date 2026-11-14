import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { BALANCE_DESIGNS } from '../../../packages/engine/tests/fixtures/designs.ts';
import { guestToken, makeApp } from './helpers.ts';

const lunar = BALANCE_DESIGNS['lunar-orbiter']![0]!.design;
let app: FastifyInstance;
let auth: { authorization: string };
let cookie: string;

beforeAll(async () => {
  app = await makeApp();
  const g = await guestToken(app);
  auth = { authorization: `Bearer ${g.token}` };
  cookie = g.cookie;
});
afterAll(async () => {
  await app.close();
});

describe('auth', () => {
  it('issues a guest token and an HttpOnly refresh cookie scoped to /api/v1/auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/guest' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ expiresIn: 900 });
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(setCookie).toMatch(/SameSite=Lax/);
  });

  it('refreshes the access token from the cookie, and not from a missing one', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ accessToken: string }>().accessToken.length).toBeGreaterThan(20);
    const missing = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh' });
    expect(missing.statusCode).toBe(401);
  });

  it('rejects a refresh token used as an access token', async () => {
    const refresh = cookie.split('=')[1]!;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulate',
      headers: { authorization: `Bearer ${refresh}` },
      payload: { design: lunar, seed: 1 },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('catalogs', () => {
  it('serves the catalog with an ETag and honours If-None-Match', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/catalogs/latest' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ scenarios: unknown[] }>().scenarios).toHaveLength(3);
    const etag = res.headers.etag as string;
    const again = await app.inject({
      method: 'GET',
      url: '/api/v1/catalogs/1',
      headers: { 'if-none-match': etag },
    });
    expect(again.statusCode).toBe(304);
  });

  it('returns Problem Details for an unknown version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/catalogs/99' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.json()).toMatchObject({
      status: 404,
      title: 'Not Found',
      instance: '/api/v1/catalogs/99',
    });
    expect(res.json<{ correlationId: string }>().correlationId).toBeTruthy();
  });
});

describe('simulate', () => {
  it('requires a guest token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulate',
      payload: { design: lunar, seed: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('runs the engine deterministically on the server', async () => {
    const run = () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/simulate',
        headers: auth,
        payload: { design: lunar, seed: 42 },
      });
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.statusCode).toBe(200);
    expect(a.json()).toEqual(b.json());
    expect(a.json<{ causes: string[] }>().causes.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects unknown fields (strict schemas)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulate',
      headers: auth,
      payload: { design: lunar, seed: 1, score: 100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('refuses designs that cannot launch, listing why and how to fix', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulate',
      headers: auth,
      payload: { design: { ...lunar, launchVehicleId: 'lv-small' }, seed: 1 },
    });
    expect(res.statusCode).toBe(422);
    const issues = res.json<{ issues: { message: string; fix: string }[] }>().issues;
    expect(issues[0]?.message).toBe('Over launch capacity by 834.0 kg');
  });
});

describe('scores and leaderboard', () => {
  it('recomputes every score on the server and ranks it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scores',
      headers: auth,
      payload: { design: lunar, seed: 7, teamName: 'Lunar Owls', playerCount: 1 },
    });
    expect(res.statusCode).toBe(201);
    const { total, rank } = res.json<{ total: number; rank: number }>();
    expect(total).toBeGreaterThan(0);
    expect(rank).toBe(1);
    const board = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboards/lunar-orbiter?difficulty=engineer',
    });
    expect(board.json()).toEqual({
      entries: [{ rank: 1, total, teamName: 'Lunar Owls', playerCount: 1 }],
    });
  });

  it('ignores client-sent scores and rejects free-text team names', async () => {
    const cheat = await app.inject({
      method: 'POST',
      url: '/api/v1/scores',
      headers: auth,
      payload: { design: lunar, seed: 7, teamName: 'Lunar Owls', playerCount: 1, total: 100 },
    });
    expect(cheat.statusCode).toBe(400);
    const name = await app.inject({
      method: 'POST',
      url: '/api/v1/scores',
      headers: auth,
      payload: { design: lunar, seed: 7, teamName: 'Anything I want', playerCount: 1 },
    });
    expect(name.statusCode).toBe(400);
  });

  it('validates the leaderboard query', async () => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/leaderboards/lunar-orbiter?difficulty=godmode',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/leaderboards/pluto?difficulty=engineer' }))
        .statusCode,
    ).toBe(404);
  });
});
