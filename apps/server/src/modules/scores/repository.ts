import { and, count, desc, eq, gt } from 'drizzle-orm';
import type { Design, Difficulty } from '@gravity/shared';
import type { Database } from '../../db/client.ts';
import { designs, runs, scores, users } from '../../db/schema/index.ts';

export interface ScoreEntry {
  readonly guestId: string;
  readonly design: Design;
  readonly catalogVersion: number;
  readonly seed: number;
  readonly outcome: string;
  readonly total: number;
  readonly breakdown: unknown;
  readonly teamName: string;
  readonly playerCount: number;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly total: number;
  readonly teamName: string;
  readonly playerCount: number;
}

/** Persistence behind an interface so routes are testable (Repository pattern). */
export interface ScoreRepository {
  ensureGuest(guestId: string): Promise<void>;
  record(entry: ScoreEntry): Promise<{ rank: number }>;
  top(scenarioId: string, difficulty: Difficulty, limit: number): Promise<LeaderboardEntry[]>;
}

/** Used when no DATABASE_URL is configured (development, tests, demo without Postgres). */
export function memoryScoreRepository(): ScoreRepository {
  const all: ScoreEntry[] = [];
  const board = (scenarioId: string, difficulty: Difficulty) =>
    all
      .filter((e) => e.design.scenarioId === scenarioId && e.design.difficulty === difficulty)
      .sort((a, b) => b.total - a.total);
  return {
    ensureGuest: async () => {},
    record: async (entry) => {
      all.push(entry);
      const higher = board(entry.design.scenarioId, entry.design.difficulty).filter(
        (e) => e.total > entry.total,
      ).length;
      return { rank: higher + 1 };
    },
    top: async (scenarioId, difficulty, limit) =>
      board(scenarioId, difficulty)
        .slice(0, limit)
        .map((e, i) => ({
          rank: i + 1,
          total: e.total,
          teamName: e.teamName,
          playerCount: e.playerCount,
        })),
  };
}

export function postgresScoreRepository(db: Database): ScoreRepository {
  return {
    ensureGuest: async (guestId) => {
      await db.insert(users).values({ id: guestId, isGuest: true }).onConflictDoNothing();
    },
    record: async (entry) =>
      db.transaction(async (tx) => {
        await tx.insert(users).values({ id: entry.guestId, isGuest: true }).onConflictDoNothing();
        const [design] = await tx
          .insert(designs)
          .values({
            ownerId: entry.guestId,
            scenarioId: entry.design.scenarioId,
            difficulty: entry.design.difficulty,
            catalogVersion: entry.catalogVersion,
            schemaVersion: entry.design.schemaVersion,
            document: entry.design,
          })
          .returning({ id: designs.id });
        const [run] = await tx
          .insert(runs)
          .values({
            designId: design!.id,
            seed: entry.seed,
            outcome: entry.outcome,
            resultSummary: { total: entry.total },
          })
          .returning({ id: runs.id });
        await tx.insert(scores).values({
          runId: run!.id,
          scenarioId: entry.design.scenarioId,
          difficulty: entry.design.difficulty,
          total: entry.total,
          breakdown: entry.breakdown,
          teamName: entry.teamName,
          playerCount: entry.playerCount,
        });
        const [higher] = await tx
          .select({ n: count() })
          .from(scores)
          .where(
            and(
              eq(scores.scenarioId, entry.design.scenarioId),
              eq(scores.difficulty, entry.design.difficulty),
              gt(scores.total, entry.total),
            ),
          );
        return { rank: (higher?.n ?? 0) + 1 };
      }),
    top: async (scenarioId, difficulty, limit) => {
      const rows = await db
        .select({ total: scores.total, teamName: scores.teamName, playerCount: scores.playerCount })
        .from(scores)
        .where(and(eq(scores.scenarioId, scenarioId), eq(scores.difficulty, difficulty)))
        .orderBy(desc(scores.total))
        .limit(limit);
      return rows.map((r, i) => ({
        rank: i + 1,
        total: Number(r.total),
        teamName: r.teamName,
        playerCount: r.playerCount,
      }));
    },
  };
}
