import type { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DesignAppliedEvent, RoomSnapshot } from '@gravity/shared';
import {
  createRoom,
  guestToken,
  listen,
  makeApp,
  nextEvent,
  socketClient,
  waitFor,
} from './helpers.ts';

/**
 * Two server instances sharing one Redis (SRS-REL-03/04). Runs only when
 * TEST_REDIS_URL is set, e.g. the local Docker Redis:
 *   TEST_REDIS_URL=redis://localhost:6379/15 pnpm --filter @gravity/server test
 * Use a spare database number (/15): the test flushes it.
 */
const url = process.env['TEST_REDIS_URL'];

describe.skipIf(!url)('rooms in Redis across two server instances', () => {
  const redisClients: Redis[] = [];
  const sockets: Socket[] = [];
  const apps: FastifyInstance[] = [];

  const instance = async () => {
    const redis = new Redis(url!, { maxRetriesPerRequest: 2 });
    redisClients.push(redis);
    const app = await makeApp({ redis });
    apps.push(app);
    return { app, url: await listen(app) };
  };

  beforeAll(async () => {
    const r = new Redis(url!);
    await r.flushdb();
    await r.quit();
  });
  afterAll(async () => {
    for (const s of sockets) s.close();
    for (const a of apps) await a.close().catch(() => {});
    await Promise.allSettled(redisClients.map((r) => r.quit()));
  });

  it('shares one room between instances and recovers it after a restart', async () => {
    const a = await instance();
    const b = await instance();
    const host = await guestToken(a.app);
    const guest = await guestToken(a.app); // same signing key, so valid on both
    const { code } = await createRoom(a.app, host.token);

    // Host on instance A, guest on instance B.
    const sa = await socketClient(a.url, host.token, sockets);
    sa.emit('room:join', { code });
    await nextEvent(sa, 'room:state');
    const sb = await socketClient(b.url, guest.token, sockets);
    const seen = waitFor<RoomSnapshot>(sa, 'room:state', (r) => r.members.length === 2);
    sb.emit('room:join', { code });
    await seen;

    sb.emit('role:claim', { roles: ['operations'] });
    await nextEvent(sb, 'room:state');
    // An edit on B reaches the player on A through the Redis adapter.
    const applied = nextEvent<DesignAppliedEvent>(sa, 'design:applied');
    sb.emit('design:patch', { edit: { type: 'setGroundStations', count: 3 }, baseVersion: 0 });
    expect((await applied).design.groundStations).toBe(3);

    // Restart: close both instances, start a fresh one on the same Redis.
    for (const s of sockets) s.close();
    await a.app.close();
    await b.app.close();
    const c = await instance();
    const back = await socketClient(c.url, host.token, sockets);
    const state = nextEvent<RoomSnapshot>(back, 'room:state');
    back.emit('room:join', { code });
    const snap = await state;
    expect(snap.design.groundStations).toBe(3);
    expect(snap.version).toBe(1);
    expect(snap.members.find((m) => m.userId === guest.guestId)?.roles).toEqual(['operations']);
  });
});
