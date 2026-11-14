import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/client.ts';
import { users } from '../src/db/schema/index.ts';
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
