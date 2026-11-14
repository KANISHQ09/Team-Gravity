import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RoomService } from '../src/modules/rooms/service.ts';
import { BALANCE_DESIGNS } from '../../../packages/engine/tests/fixtures/designs.ts';
import { guestToken, makeApp } from './helpers.ts';

let app: FastifyInstance;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  app = await makeApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  for (const s of sockets) s.close();
  await app.close();
});

function client(token: string): Promise<Socket> {
  const s = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

const next = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));

describe('co-op rooms over Socket.IO (SRS-COL)', () => {
  it('rejects sockets without a valid token', async () => {
    await expect(client('nope')).rejects.toThrow(/Unauthorized/);
  });

  it('runs a two-player room from join to a shared result', async () => {
    const host = await guestToken(app);
    const guest = await guestToken(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { authorization: `Bearer ${host.token}` },
      payload: { scenarioId: 'lunar-orbiter', difficulty: 'engineer' },
    });
    expect(created.statusCode).toBe(201);
    const { code } = created.json<{ code: string }>();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const a = await client(host.token);
    const b = await client(guest.token);
    a.emit('room:join', { code });
    await next(a, 'room:state');
    const joined = next<{ members: unknown[] }>(a, 'room:state');
    b.emit('room:join', { code });
    expect((await joined).members).toHaveLength(2);

    // Host takes architect + science, guest takes engineering + operations.
    a.emit('role:claim', { roles: ['mission-architect', 'science-lead'] });
    await next(a, 'room:state');
    const clash = next<{ title: string }>(b, 'room:error');
    b.emit('role:claim', { roles: ['science-lead'] });
    expect((await clash).title).toBe('Role taken');
    b.emit('role:claim', { roles: ['spacecraft-engineer', 'operations'] });
    await next(b, 'room:state');

    // Wrong role → rejected; owner → applied and broadcast to both players.
    const rejected = next<{ title: string }>(a, 'design:rejected');
    a.emit('design:patch', {
      edit: { type: 'addPart', partId: 'bus-medium', category: 'bus' },
      baseVersion: 0,
    });
    expect((await rejected).title).toBe('Not your role');

    const design = BALANCE_DESIGNS['lunar-orbiter']![0]!.design;
    let version = 0;
    const send = async (s: Socket, edit: object) => {
      const applied = next<{ version: number }>(a, 'design:applied');
      s.emit('design:patch', { edit, baseVersion: version });
      version = (await applied).version;
    };
    await send(a, { type: 'setGoals', goalIds: design.goalIds });
    await send(a, { type: 'setOrbit', orbitId: design.orbitId });
    await send(a, { type: 'setLaunchVehicle', launchVehicleId: design.launchVehicleId });
    await send(b, { type: 'setMitigations', mitigations: design.mitigations });
    const owner = (id: string) => (id.startsWith('inst-') ? a : b);
    const categoryOf: Record<string, string> = {
      bus: 'bus',
      solar: 'solar',
      battery: 'battery',
      antenna: 'antenna',
      computer: 'computer',
      adcs: 'adcs',
      prop: 'propulsion',
      inst: 'instrument',
    };
    for (const partId of design.partIds) {
      await send(owner(partId), {
        type: 'addPart',
        partId,
        category: categoryOf[partId.split('-')[0]!],
      });
    }

    // Stale version → conflict.
    const conflict = next<{ title: string; latestVersion: number }>(b, 'design:rejected');
    b.emit('design:patch', { edit: { type: 'setGroundStations', count: 2 }, baseVersion: 0 });
    expect(await conflict).toMatchObject({ title: 'Version conflict', latestVersion: version });

    // A proposal across roles, accepted by its owner.
    const proposed = next<{ proposal: { id: string } }>(b, 'proposal:update');
    b.emit('proposal:create', {
      edit: { type: 'setOrbit', orbitId: 'lunar-polar-100' },
      message: 'This improves our science return',
    });
    const { proposal } = await proposed;
    const answered = next<{ status: string }>(b, 'proposal:update');
    a.emit('proposal:respond', { proposalId: proposal.id, accept: true });
    expect((await answered).status).toBe('accepted');

    // Launch needs everyone's GO; only the host can start.
    const early = next<{ title: string }>(a, 'room:error');
    a.emit('sim:start');
    expect((await early).title).toBe('Waiting for GO');
    a.emit('vote:cast', { vote: 'go' });
    await next(a, 'vote:update');
    const allGo = next<{ allGo: boolean }>(a, 'vote:update');
    b.emit('vote:cast', { vote: 'go' });
    expect((await allGo).allGo).toBe(true);
    const notHost = next<{ title: string }>(b, 'room:error');
    b.emit('sim:start');
    expect((await notHost).title).toBe('Host only');

    const resultA = next<{
      report: { total: number; breakdown: { collaboration: { points: number } | null } };
    }>(a, 'sim:result');
    const resultB = next<{ report: { total: number } }>(b, 'sim:result');
    a.emit('sim:start');
    const [ra, rb] = await Promise.all([resultA, resultB]);
    expect(ra.report.total).toBe(rb.report.total);
    expect(ra.report.breakdown.collaboration?.points).toBeGreaterThan(0);
  });

  it('validates every message', async () => {
    const g = await guestToken(app);
    const s = await client(g.token);
    const err = next<{ title: string }>(s, 'room:error');
    s.emit('room:join', { code: 'lower-case' });
    expect((await err).title).toBe('Invalid message');
  });
});

describe('RoomService rules', () => {
  it('caps rooms at four players and sweeps idle rooms after 30 minutes', () => {
    let now = 0;
    const rooms = new RoomService(() => now);
    const room = rooms.create('u1', 'lunar-orbiter', 'engineer');
    for (const u of ['u2', 'u3', 'u4']) rooms.join(room.code, u);
    expect(() => rooms.join(room.code, 'u5')).toThrow(/four players/);
    now = 31 * 60 * 1000;
    expect(rooms.sweep()).toBe(1);
    expect(rooms.size).toBe(0);
  });

  it('resets GO votes whenever the design changes', () => {
    const rooms = new RoomService();
    const room = rooms.create('u1', 'lunar-orbiter', 'engineer');
    rooms.claimRoles(room, 'u1', [
      'mission-architect',
      'science-lead',
      'spacecraft-engineer',
      'operations',
    ]);
    rooms.vote(room, 'u1', { vote: 'go' });
    expect(rooms.allGo(room)).toBe(true);
    rooms.patch(room, 'u1', { type: 'setGroundStations', count: 2 }, 0);
    expect(rooms.allGo(room)).toBe(false);
  });
});
