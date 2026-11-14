import { CATALOG_VERSION } from '@gravity/catalog';
import type { Database } from '../../db/client.ts';
import { designs, roomMembers, rooms, runs, users } from '../../db/schema/index.ts';
import type { Room } from './store.ts';

/**
 * Keeps the final snapshot of a launched room (ARCHITECTURE §2: Postgres holds
 * "rooms (final snapshot)"). Live state stays in the RoomStore; this is history.
 */
export interface RoomArchive {
  save(room: Room, seed: number): Promise<void>;
}

export const noRoomArchive: RoomArchive = { save: async () => {} };

export function postgresRoomArchive(db: Database): RoomArchive {
  return {
    save: (room, seed) =>
      db.transaction(async (tx) => {
        const memberIds = Object.keys(room.members);
        if (memberIds.length > 0)
          await tx
            .insert(users)
            .values(memberIds.map((id) => ({ id, isGuest: true })))
            .onConflictDoNothing();
        const [design] = await tx
          .insert(designs)
          .values({
            ownerId: room.hostId,
            scenarioId: room.scenarioId,
            difficulty: room.difficulty,
            catalogVersion: CATALOG_VERSION,
            schemaVersion: room.design.schemaVersion,
            document: room.design,
          })
          .returning({ id: designs.id });
        if (room.result) {
          await tx.insert(runs).values({
            designId: design!.id,
            seed,
            outcome: room.result.run.outcome,
            resultSummary: { total: room.result.report.total, roomId: room.id },
          });
        }
        // Codes are reused after rooms expire; the unique code index keeps the first archive.
        const inserted = await tx
          .insert(rooms)
          .values({
            id: room.id,
            code: room.code,
            scenarioId: room.scenarioId,
            difficulty: room.difficulty,
            designId: design!.id,
            status: room.status,
          })
          .onConflictDoNothing()
          .returning({ id: rooms.id });
        if (inserted.length > 0 && memberIds.length > 0) {
          await tx.insert(roomMembers).values(
            Object.values(room.members).map((m) => ({
              roomId: room.id,
              userId: m.userId,
              role: m.roles.join(',') || null,
              isHost: m.userId === room.hostId,
              vote: m.vote?.vote ?? null,
            })),
          );
        }
      }),
  };
}
