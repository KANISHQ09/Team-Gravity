import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MissionResult } from '@gravity/engine';
import type {
  DesignEdit,
  DesignRejectedEvent,
  PartCategory,
  Role,
  RoomErrorEvent,
  RoomLeftEvent,
  RoomSnapshot,
} from '@gravity/shared';
import { REJOIN_GRACE_MS, RoomService } from '../src/modules/rooms/service.ts';
import { memoryRoomStore } from '../src/modules/rooms/store.ts';
import { BALANCE_DESIGNS } from '../../../packages/engine/tests/fixtures/designs.ts';
import {
  PART_CATEGORY,
  createRoom,
  guestToken,
  listen,
  makeApp,
  nextEvent,
  socketClient,
  waitFor,
} from './helpers.ts';

let app: FastifyInstance;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  app = await makeApp();
  url = await listen(app);
});
afterAll(async () => {
  for (const s of sockets) s.close();
  await app.close();
});

const ROLE_ORDER: Role[] = [
  'mission-architect',
  'spacecraft-engineer',
  'science-lead',
  'operations',
];

/** Every edit needed to build a fixture design, tagged with the role that owns it. */
function designEdits(): { role: Role; edit: DesignEdit }[] {
  const d = BALANCE_DESIGNS['lunar-orbiter']![0]!.design;
  const edits: { role: Role; edit: DesignEdit }[] = [
    { role: 'mission-architect', edit: { type: 'setGoals', goalIds: d.goalIds } },
    { role: 'mission-architect', edit: { type: 'setOrbit', orbitId: d.orbitId } },
    {
      role: 'mission-architect',
      edit: { type: 'setLaunchVehicle', launchVehicleId: d.launchVehicleId },
    },
    { role: 'operations', edit: { type: 'setMitigations', mitigations: d.mitigations } },
    { role: 'operations', edit: { type: 'setGroundStations', count: d.groundStations } },
  ];
  for (const partId of d.partIds) {
    const category = PART_CATEGORY[partId.split('-')[0]!] as PartCategory;
    const role: Role =
      category === 'instrument'
        ? 'science-lead'
        : ['solar', 'battery', 'antenna'].includes(category)
          ? 'operations'
          : 'spacecraft-engineer';
    edits.push({ role, edit: { type: 'addPart', partId, category } });
  }
  return edits;
}

async function joinAll(code: string, count: number) {
  const players: { s: Socket; guestId: string }[] = [];
  for (let i = 0; i < count; i++) {
    const g = await guestToken(app);
    const s = await socketClient(url, g.token, sockets);
    const joined = waitFor<RoomSnapshot>(s, 'room:state', (r) =>
      r.members.some((m) => m.userId === g.guestId),
    );
    s.emit('room:join', { code });
    await joined;
    players.push({ s, guestId: g.guestId });
  }
  return players;
}

describe('four-player co-op mission (Gravity.md §4.8 phase 5)', () => {
  it('completes a mission with one role each and rejects every role bypass', async () => {
    const host = await guestToken(app);
    const { code } = await createRoom(app, host.token);
    const hostSocket = await socketClient(url, host.token, sockets);
    hostSocket.emit('room:join', { code });
    await nextEvent(hostSocket, 'room:state');
    const players = [{ s: hostSocket, guestId: host.guestId }, ...(await joinAll(code, 3))];

    // A fifth player is turned away.
    const fifth = await socketClient(url, (await guestToken(app)).token, sockets);
    const full = nextEvent<RoomErrorEvent>(fifth, 'room:error');
    fifth.emit('room:join', { code });
    expect((await full).title).toBe('Room full');

    for (const [i, role] of ROLE_ORDER.entries()) {
      const claimed = nextEvent<RoomSnapshot>(players[i]!.s, 'room:state');
      players[i]!.s.emit('role:claim', { roles: [role] });
      await claimed;
    }
    const bySocket = (role: Role) => players[ROLE_ORDER.indexOf(role)]!.s;

    // Each player tries one edit owned by the next role: always rejected.
    const edits = designEdits();
    for (const role of ROLE_ORDER) {
      const target = edits.find((e) => e.role !== role)!;
      const s = bySocket(role);
      const rejected = nextEvent<DesignRejectedEvent>(s, 'design:rejected');
      s.emit('design:patch', { edit: target.edit, baseVersion: 0 });
      expect((await rejected).title).toBe('Not your role');
    }

    let version = 0;
    for (const { role, edit } of edits) {
      const applied = waitFor<{ version: number }>(
        hostSocket,
        'design:applied',
        (e) => e.version === version + 1,
      );
      bySocket(role).emit('design:patch', { edit, baseVersion: version });
      version = (await applied).version;
    }

    for (const p of players) {
      const voted = nextEvent(p.s, 'vote:update');
      p.s.emit('vote:cast', { vote: 'go' });
      await voted;
    }
    const results = players.map((p) => nextEvent<MissionResult>(p.s, 'sim:result'));
    hostSocket.emit('sim:start', {});
    const totals = (await Promise.all(results)).map((r) => r.report.total);
    expect(new Set(totals).size).toBe(1);
    expect(totals[0]).toBeGreaterThan(0);

    // After launch the design is frozen.
    const frozen = nextEvent<DesignRejectedEvent>(bySocket('operations'), 'design:rejected');
    bySocket('operations').emit('design:patch', {
      edit: { type: 'setGroundStations', count: 1 },
      baseVersion: version,
    });
    expect((await frozen).title).toBe('Mission already launched');
  });

  it('keeps a seat and roles when a player reconnects, and resends the result after launch', async () => {
    const g = await guestToken(app);
    const { code } = await createRoom(app, g.token);
    const first = await socketClient(url, g.token, sockets);
    first.emit('room:join', { code });
    await nextEvent(first, 'room:state');
    first.emit('role:claim', { roles: ROLE_ORDER });
    await nextEvent(first, 'room:state');
    first.close();

    const again = await socketClient(url, g.token, sockets);
    const state = nextEvent<RoomSnapshot>(again, 'room:state');
    again.emit('room:join', { code });
    const snap = await state;
    expect(snap.members).toHaveLength(1);
    expect(snap.members[0]).toMatchObject({ roles: ROLE_ORDER, connected: true, isHost: true });

    let version = 0;
    for (const { edit } of designEdits()) {
      const applied = nextEvent<{ version: number }>(again, 'design:applied');
      again.emit('design:patch', { edit, baseVersion: version });
      version = (await applied).version;
    }
    again.emit('vote:cast', { vote: 'go' });
    await nextEvent(again, 'vote:update');
    const result = nextEvent<MissionResult>(again, 'sim:result');
    again.emit('sim:start');
    const { report } = await result;
    again.close();

    const late = await socketClient(url, g.token, sockets);
    const resent = nextEvent<MissionResult>(late, 'sim:result');
    late.emit('room:join', { code });
    expect((await resent).report.total).toBe(report.total);
  });

  it('frees roles when a player leaves and hands the host role on', async () => {
    const host = await guestToken(app);
    const { code } = await createRoom(app, host.token);
    const h = await socketClient(url, host.token, sockets);
    h.emit('room:join', { code });
    await nextEvent(h, 'room:state');
    const [other] = await joinAll(code, 1);
    h.emit('role:claim', { roles: ['mission-architect'] });
    await nextEvent(other!.s, 'room:state');

    const left = nextEvent<RoomLeftEvent>(h, 'room:left');
    const after = waitFor<RoomSnapshot>(other!.s, 'room:state', (r) => r.members.length === 1);
    h.emit('room:leave');
    expect(await left).toEqual({ reason: 'left' });
    const snap = await after;
    expect(snap.hostId).toBe(other!.guestId);
    expect(snap.members[0]).toMatchObject({ isHost: true });

    // The architect role is free again.
    const claimed = nextEvent<RoomSnapshot>(other!.s, 'room:state');
    other!.s.emit('role:claim', { roles: ['mission-architect'] });
    expect((await claimed).members[0]!.roles).toEqual(['mission-architect']);
  });

  it('only lets the host remove a player who has been away past the grace period', async () => {
    const host = await guestToken(app);
    const { code } = await createRoom(app, host.token);
    const h = await socketClient(url, host.token, sockets);
    h.emit('room:join', { code });
    await nextEvent(h, 'room:state');
    const [other] = await joinAll(code, 1);
    const err = nextEvent<RoomErrorEvent>(h, 'room:error');
    h.emit('member:remove', { userId: other!.guestId });
    expect((await err).title).toBe('Player still active');
  });
});

describe('RoomService host and seat rules (SRS-COL-06)', () => {
  it('removes an away player after the grace period and hands an away host over', async () => {
    let now = 1_000;
    const rooms = new RoomService(memoryRoomStore(), () => now);
    const room = await rooms.create('host', 'mars-orbiter', 'explorer');
    await rooms.connect(room.code, 'host');
    await rooms.connect(room.code, 'b');
    await rooms.connect(room.code, 'c');
    await rooms.claimRoles(room.id, 'c', ['science-lead']);
    await rooms.disconnect(room.id, 'c');

    now += REJOIN_GRACE_MS - 1;
    await expect(rooms.remove(room.id, 'host', 'c')).rejects.toThrow(/offline/);
    await expect(rooms.remove(room.id, 'b', 'c')).rejects.toThrow(/host/);
    now += 2;
    const after = await rooms.remove(room.id, 'host', 'c');
    expect(Object.keys(after.members)).toEqual(['host', 'b']);

    // Host goes offline past the grace period: the next change makes 'b' host.
    await rooms.disconnect(room.id, 'host');
    now += REJOIN_GRACE_MS;
    const handed = await rooms.vote(room.id, 'b', { vote: 'go' });
    expect(handed.hostId).toBe('b');
  });

  it('deletes the room when the last player leaves', async () => {
    const rooms = new RoomService();
    const room = await rooms.create('solo', 'lunar-orbiter', 'engineer');
    expect(await rooms.leave(room.id, 'solo')).toBeNull();
    expect(await rooms.size()).toBe(0);
    await expect(rooms.byCode(room.code)).rejects.toThrow(/No room/);
  });

  it('never loses a change when edits race (compare-and-swap retry)', async () => {
    const rooms = new RoomService();
    const room = await rooms.create('u1', 'lunar-orbiter', 'engineer');
    await rooms.claimRoles(room.id, 'u1', ROLE_ORDER);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        rooms.propose(
          room.id,
          'u1',
          { type: 'setGroundStations', count: 2 },
          'This lowers mission risk',
        ),
      ),
    );
    const final = await rooms.get(room.id);
    expect(Object.keys(final!.proposals)).toHaveLength(6);
    expect(new Set(results.map((r) => r.value.id)).size).toBe(6);
  });
});
