import { defineConfig } from 'drizzle-kit';

// Used by `pnpm --filter @gravity/server db:generate` and `db:migrate`.
// The first real migration (0001_init) is generated once the schema in
// src/db/schema is written (Phase 8, see docs/ARCHITECTURE.md).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://gravity:gravity@localhost:5432/gravity',
  },
  strict: true,
  verbose: true,
});
