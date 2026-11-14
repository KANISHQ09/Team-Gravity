import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

export type Database = ReturnType<typeof createDatabase>['db'];

/** Postgres connection with a small pool; close() ends it on shutdown. */
export function createDatabase(url: string) {
  const sql = postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 5 });
  const db = drizzle(sql, { schema });
  return {
    db,
    ping: async () => {
      await sql`select 1`;
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
