import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { runMission } from '@gravity/engine';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/client.ts';
import { roomMembers, rooms as rooms_, users } from '../src/db/schema/index.ts';
import { postgresRoomArchive } from '../src/modules/rooms/archive.ts';
import { RoomService } from '../src/modules/rooms/service.ts';
import { postgresScoreRepository } from '../src/modules/scores/repository.ts';
import { BALANCE_DESIGNS } from '../../../packages/engine/tests/fixtures/designs.ts';

/**
 * Integration test against a real PostgreSQL with the migrations applied.
 * Runs only when TEST_DATABASE_URL is set (e.g. the local Docker database):
 *   TEST_DATABASE_URL=postgres://gravity:gravity@localhost:5432/gravity pnpm --filter @gravity/server test
 */
const url = process.env['TEST_DATABASE_URL'];

describe.skipIf(!url)('Postgres score repository', () => {
  it('stores a score through users → designs → runs → scores and ranks it', async () => {
    const database = createDatabase(url!);
    const guestId = randomUUID();
    try {
      const repo = postgresScoreRepository(database.db);
      const design = { ...BALANCE_DESIGNS['mars-orbiter']![0]!.design };
      // Rank is computed at insert time, so insert the higher score first.
      const high = await repo.record({
        guestId,
        design,
        catalogVersion: 1,
        seed: 2,
        outcome: 'full',
        total: 99.9,
        breakdown: {},
        teamName: 'Bold Probes',
        playerCount: 2,
      });
      const low = await repo.record({
        guestId,
        design,
        catalogVersion: 1,
        seed: 1,
        outcome: 'partial',
        total: 0.5,
        breakdown: {},
        teamName: 'Quiet Owls',
        playerCount: 1,
      });
      expect(low.rank).toBeGreaterThan(high.rank);
      const top = await repo.top(design.scenarioId, design.difficulty, 50);
      expect(top.some((e) => e.teamName === 'Bold Probes' && e.total === 99.9)).toBe(true);
      expect(top.map((e) => e.total)).toEqual([...top.map((e) => e.total)].sort((x, y) => y - x));
    } finally {
      // Remove this test's rows (deleting the guest cascades to designs, runs and scores).
      await database.db.delete(users).where(eq(users.id, guestId));
      await database.close();
    }
  });
});

describe.skipIf(!url)('Postgres room archive', () => {
  it('saves a launched room with its members, design and run', async () => {
    const database = createDatabase(url!);
    const host = randomUUID();
    const guest = randomUUID();
    try {
      const rooms = new RoomService();
      const room = await rooms.create(host, 'mars-orbiter', 'engineer');
      await rooms.join(room.code, guest);
      const fixture = BALANCE_DESIGNS['mars-orbiter']![0]!.design;
      const launched = {
        ...(await rooms.claimRoles(room.id, host, ['mission-architect'])),
        design: { ...fixture, difficulty: 'engineer' as const },
        status: 'report' as const,
        result: runMission(fixture, 7),
      };
      await postgresRoomArchive(database.db).save(launched, 7);
      const [saved] = await database.db.select().from(rooms_).where(eq(rooms_.id, room.id));
      expect(saved).toMatchObject({
        code: room.code,
        scenarioId: 'mars-orbiter',
        status: 'report',
      });
      const members = await database.db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, room.id));
      expect(members.find((m) => m.userId === host)).toMatchObject({
        isHost: true,
        role: 'mission-architect',
      });
      expect(members).toHaveLength(2);
    } finally {
      await database.db.delete(users).where(inArray(users.id, [host, guest]));
      await database.close();
    }
  });
});
